// Auto Arbitrage Monitor - Background monitoring and automatic execution
// Periodically scans for arbitrage opportunities and executes when profitable

import { Address } from 'viem';
import {
  scanArbitrageOpportunities,
  createArbitragePlan,
  executeArbitrage,
  ArbitrageExecutionPlan,
  ExecutionResult,
  getTokenBalance,
} from './arbitrageExecutor';
import { ArbitrageOpportunity } from './priceFetcher';

export interface AutoArbConfig {
  enabled: boolean;
  walletAddress: Address | null;
  walletClient: any | null;
  sourceChainId: number | null;     // Chain where user has funds
  inputToken: string;                // Token to use (default: USDC)
  maxTradeAmount: string;            // Max amount per trade (in token units)
  minProfitPercent: number;          // Minimum profit % to trigger
  minNetProfit: number;              // Minimum net profit in USD
  maxGasCost: number;                // Maximum gas cost in USD
  checkIntervalMs: number;           // How often to scan
  cooldownMs: number;                // Cooldown after execution
}

export interface ArbExecutionRecord {
  id: string;
  timestamp: number;
  plan: ArbitrageExecutionPlan;
  result: ExecutionResult;
}

export interface ArbMonitorState {
  isRunning: boolean;
  lastCheck: number | null;
  lastExecution: number | null;
  checksCount: number;
  executionsCount: number;
  totalProfit: number;
  currentOpportunities: ArbitrageOpportunity[];
  pendingPlan: ArbitrageExecutionPlan | null;
  executionHistory: ArbExecutionRecord[];
  error: string | null;
  status: string;
}

type StatusCallback = (status: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
type StateCallback = (state: ArbMonitorState) => void;

class AutoArbitrageMonitor {
  private config: AutoArbConfig;
  private state: ArbMonitorState;
  private intervalId: NodeJS.Timeout | null = null;
  private onStatusUpdate: StatusCallback | null = null;
  private onStateChange: StateCallback | null = null;
  private isExecuting: boolean = false;

  constructor() {
    this.config = this.loadConfig();
    this.state = this.getInitialState();
  }

  private getInitialState(): ArbMonitorState {
    return {
      isRunning: false,
      lastCheck: null,
      lastExecution: null,
      checksCount: 0,
      executionsCount: 0,
      totalProfit: this.loadTotalProfit(),
      currentOpportunities: [],
      pendingPlan: null,
      executionHistory: this.loadHistory(),
      error: null,
      status: 'Idle',
    };
  }

  private loadConfig(): AutoArbConfig {
    const stored = localStorage.getItem('autoArbConfig');
    if (stored) {
      try {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) };
      } catch {
        return this.getDefaultConfig();
      }
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): AutoArbConfig {
    return {
      enabled: false,
      walletAddress: null,
      walletClient: null,
      sourceChainId: null,
      inputToken: 'USDC',
      maxTradeAmount: '1000000000', // 1000 USDC (6 decimals)
      minProfitPercent: 0.3,        // 0.3%
      minNetProfit: 5,              // $5 minimum
      maxGasCost: 20,               // $20 max gas
      checkIntervalMs: 30000,       // 30 seconds
      cooldownMs: 120000,           // 2 minutes
    };
  }

  private saveConfig(): void {
    const { walletAddress, walletClient, ...saveable } = this.config;
    localStorage.setItem('autoArbConfig', JSON.stringify(saveable));
  }

  private loadHistory(): ArbExecutionRecord[] {
    const stored = localStorage.getItem('autoArbHistory');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  }

  private saveHistory(): void {
    const records = this.state.executionHistory.slice(-50);
    localStorage.setItem('autoArbHistory', JSON.stringify(records));
  }

  private loadTotalProfit(): number {
    const stored = localStorage.getItem('autoArbTotalProfit');
    return stored ? parseFloat(stored) : 0;
  }

  private saveTotalProfit(): void {
    localStorage.setItem('autoArbTotalProfit', this.state.totalProfit.toString());
  }

  private updateState(updates: Partial<ArbMonitorState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️',
    }[type];
    console.log(`[AutoArb ${timestamp}] ${prefix} ${message}`);
    this.onStatusUpdate?.(message, type);
    this.updateState({ status: message });
  }

  // Public API

  setCallbacks(onStatus: StatusCallback, onState: StateCallback): void {
    this.onStatusUpdate = onStatus;
    this.onStateChange = onState;
    this.onStateChange(this.state);
  }

  updateConfig(updates: Partial<AutoArbConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.log(`Config updated`, 'info');
  }

  getConfig(): AutoArbConfig {
    return { ...this.config };
  }

  getState(): ArbMonitorState {
    return { ...this.state };
  }

  async start(walletAddress: Address, walletClient: any, sourceChainId?: number): Promise<void> {
    if (this.state.isRunning) {
      this.log('Monitor already running', 'warning');
      return;
    }

    if (!walletAddress || !walletClient) {
      this.log('Wallet not connected', 'error');
      this.updateState({ error: 'Wallet not connected' });
      return;
    }

    this.config.walletAddress = walletAddress;
    this.config.walletClient = walletClient;
    if (sourceChainId) {
      this.config.sourceChainId = sourceChainId;
    }
    this.config.enabled = true;
    this.saveConfig();

    this.updateState({
      isRunning: true,
      error: null,
    });

    this.log('🚀 Auto-arbitrage monitor started', 'success');
    this.log(`Scanning every ${this.config.checkIntervalMs / 1000}s | Min profit: ${this.config.minProfitPercent}% | Max gas: $${this.config.maxGasCost}`, 'info');

    // Run immediately
    await this.runCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.config.enabled = false;
    this.saveConfig();

    this.updateState({
      isRunning: false,
      pendingPlan: null,
      status: 'Stopped',
    });

    this.log('⏹️ Auto-arbitrage monitor stopped', 'info');
  }

  async runCheck(): Promise<void> {
    if (this.isExecuting) {
      this.log('Skipping check - execution in progress', 'warning');
      return;
    }

    if (!this.config.walletAddress) {
      this.log('No wallet address configured', 'error');
      return;
    }

    // Check cooldown
    if (this.state.lastExecution) {
      const timeSinceExecution = Date.now() - this.state.lastExecution;
      if (timeSinceExecution < this.config.cooldownMs) {
        const remaining = Math.ceil((this.config.cooldownMs - timeSinceExecution) / 1000);
        this.log(`Cooldown: ${remaining}s remaining`, 'info');
        return;
      }
    }

    this.log('Scanning for arbitrage opportunities...', 'info');

    try {
      // Scan for opportunities
      const opportunities = await scanArbitrageOpportunities(
        this.config.inputToken as any,
        this.config.minProfitPercent,
        parseFloat(this.config.maxTradeAmount) / 1e6
      );

      this.updateState({
        lastCheck: Date.now(),
        checksCount: this.state.checksCount + 1,
        currentOpportunities: opportunities,
        error: null,
      });

      if (opportunities.length === 0) {
        this.log(`No opportunities above ${this.config.minProfitPercent}%`, 'info');
        this.updateState({ pendingPlan: null });
        return;
      }

      // Filter by source chain if specified
      let targetOpportunity = opportunities[0];
      if (this.config.sourceChainId) {
        const filtered = opportunities.filter(o => o.fromChain === this.config.sourceChainId);
        if (filtered.length === 0) {
          this.log('No opportunities on configured source chain', 'info');
          return;
        }
        targetOpportunity = filtered[0];
      }

      // Check if we have balance
      let tradeAmount = this.config.maxTradeAmount;
      try {
        const balance = await getTokenBalance(
          this.config.walletAddress,
          targetOpportunity.fromChain,
          this.config.inputToken
        );
        
        if (balance.balance === 0n) {
          this.log(`No ${this.config.inputToken} on ${targetOpportunity.fromChainName}`, 'warning');
          return;
        }
        
        // Use minimum of balance and max trade amount
        const maxAmount = BigInt(this.config.maxTradeAmount);
        tradeAmount = (balance.balance < maxAmount ? balance.balance : maxAmount).toString();
      } catch (error) {
        this.log('Could not check balance', 'warning');
      }

      // Create execution plan
      const plan = await createArbitragePlan(
        targetOpportunity,
        this.config.walletAddress,
        tradeAmount,
        this.config.inputToken
      );

      if (!plan) {
        this.log('Could not create execution plan', 'warning');
        return;
      }

      // Check profitability criteria
      if (plan.gasCostEstimate > this.config.maxGasCost) {
        this.log(`Gas too high: $${plan.gasCostEstimate.toFixed(2)} > $${this.config.maxGasCost}`, 'warning');
        return;
      }

      if (plan.netProfit < this.config.minNetProfit) {
        this.log(`Profit too low: $${plan.netProfit.toFixed(2)} < $${this.config.minNetProfit}`, 'info');
        return;
      }

      this.log(`✨ Found: ${plan.opportunity.priceDifference.toFixed(2)}% arb, $${plan.netProfit.toFixed(2)} profit`, 'success');
      this.updateState({ pendingPlan: plan });

      // Auto-execute if enabled
      if (this.config.enabled) {
        await this.executeArb(plan);
      }

    } catch (error: any) {
      this.log(`Check failed: ${error.message}`, 'error');
      this.updateState({ error: error.message });
    }
  }

  async executeArb(plan: ArbitrageExecutionPlan): Promise<ArbExecutionRecord | null> {
    if (this.isExecuting) {
      this.log('Execution already in progress', 'warning');
      return null;
    }

    if (!this.config.walletClient) {
      this.log('Wallet client not available', 'error');
      return null;
    }

    this.isExecuting = true;
    this.log(`⚡ Executing: ${plan.opportunity.fromChainName} → ${plan.opportunity.toChainName}`, 'info');

    try {
      const result = await executeArbitrage(
        plan,
        this.config.walletClient,
        (status) => this.log(status, 'info')
      );

      const record: ArbExecutionRecord = {
        id: `arb_${Date.now()}`,
        timestamp: Date.now(),
        plan,
        result,
      };

      // Update total profit
      if (result.success && result.actualProfit) {
        this.updateState({
          totalProfit: this.state.totalProfit + result.actualProfit,
        });
        this.saveTotalProfit();
        this.log(`💰 Profit realized: $${result.actualProfit.toFixed(2)}`, 'success');
      } else if (!result.success) {
        this.log(`Execution failed: ${result.error}`, 'error');
      }

      // Update state
      this.updateState({
        lastExecution: Date.now(),
        executionsCount: this.state.executionsCount + 1,
        pendingPlan: null,
        executionHistory: [...this.state.executionHistory, record],
      });

      this.saveHistory();
      this.isExecuting = false;
      return record;

    } catch (error: any) {
      this.log(`Execution error: ${error.message}`, 'error');
      this.isExecuting = false;
      return null;
    }
  }

  // Manual trigger for current pending plan
  async executePending(): Promise<ArbExecutionRecord | null> {
    if (!this.state.pendingPlan) {
      this.log('No pending plan to execute', 'warning');
      return null;
    }
    return this.executeArb(this.state.pendingPlan);
  }

  clearHistory(): void {
    this.updateState({ 
      executionHistory: [],
      totalProfit: 0,
    });
    localStorage.removeItem('autoArbHistory');
    localStorage.removeItem('autoArbTotalProfit');
    this.log('History cleared', 'info');
  }
}

// Singleton instance
export const autoArbitrageMonitor = new AutoArbitrageMonitor();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).autoArbitrageMonitor = autoArbitrageMonitor;
  console.log('%c🤖 AUTO ARBITRAGE MONITOR', 'color: #00ffff; font-weight: bold; font-size: 14px;');
  console.log('  autoArbitrageMonitor.start(address, wallet, chainId) - Start');
  console.log('  autoArbitrageMonitor.stop() - Stop');
  console.log('  autoArbitrageMonitor.runCheck() - Manual scan');
  console.log('  autoArbitrageMonitor.getState() - Get state');
}
