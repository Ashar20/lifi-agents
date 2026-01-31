// Auto Yield Monitor - Background monitoring and automatic execution
// Periodically scans for yield opportunities and executes when profitable

import { Address } from 'viem';
import {
  findBestRotation,
  executeYieldRotation,
  RotationPlan,
  Position,
  YieldOpportunity,
} from './yieldRotation';

export interface AutoYieldConfig {
  enabled: boolean;
  walletAddress: Address | null;
  walletClient: any | null;
  minApyImprovement: number;      // Minimum APY gain to trigger (e.g., 2%)
  maxGasCost: number;              // Maximum gas cost in USD (e.g., 50)
  minPositionValue: number;        // Minimum position value to rotate (e.g., 100 USD)
  checkIntervalMs: number;         // How often to check (e.g., 60000 = 1 min)
  cooldownMs: number;              // Cooldown after execution (e.g., 300000 = 5 min)
  isTestnet: boolean;
}

export interface ExecutionRecord {
  id: string;
  timestamp: number;
  plan: RotationPlan;
  success: boolean;
  txHash?: string;
  error?: string;
  gasCostActual?: number;
}

export interface MonitorState {
  isRunning: boolean;
  lastCheck: number | null;
  lastExecution: number | null;
  checksCount: number;
  executionsCount: number;
  currentPositions: Position[];
  currentOpportunities: YieldOpportunity[];
  pendingPlan: RotationPlan | null;
  executionHistory: ExecutionRecord[];
  error: string | null;
}

type StatusCallback = (status: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
type StateCallback = (state: MonitorState) => void;

class AutoYieldMonitor {
  private config: AutoYieldConfig;
  private state: MonitorState;
  private intervalId: NodeJS.Timeout | null = null;
  private onStatusUpdate: StatusCallback | null = null;
  private onStateChange: StateCallback | null = null;
  private isExecuting: boolean = false;

  constructor() {
    this.config = this.loadConfig();
    this.state = this.getInitialState();
  }

  private getInitialState(): MonitorState {
    return {
      isRunning: false,
      lastCheck: null,
      lastExecution: null,
      checksCount: 0,
      executionsCount: 0,
      currentPositions: [],
      currentOpportunities: [],
      pendingPlan: null,
      executionHistory: this.loadHistory(),
      error: null,
    };
  }

  private loadConfig(): AutoYieldConfig {
    const stored = localStorage.getItem('autoYieldConfig');
    if (stored) {
      try {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) };
      } catch {
        return this.getDefaultConfig();
      }
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): AutoYieldConfig {
    return {
      enabled: false,
      walletAddress: null,
      walletClient: null,
      minApyImprovement: 2,
      maxGasCost: 50,
      minPositionValue: 100,
      checkIntervalMs: 60000, // 1 minute
      cooldownMs: 300000,     // 5 minutes
      isTestnet: false,
    };
  }

  private saveConfig(): void {
    const { walletAddress, walletClient, ...saveable } = this.config;
    localStorage.setItem('autoYieldConfig', JSON.stringify(saveable));
  }

  private loadHistory(): ExecutionRecord[] {
    const stored = localStorage.getItem('autoYieldHistory');
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
    // Keep only last 50 records
    const records = this.state.executionHistory.slice(-50);
    localStorage.setItem('autoYieldHistory', JSON.stringify(records));
  }

  private updateState(updates: Partial<MonitorState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AutoYield ${timestamp}] ${message}`);
    this.onStatusUpdate?.(message, type);
  }

  // Public API

  setCallbacks(onStatus: StatusCallback, onState: StateCallback): void {
    this.onStatusUpdate = onStatus;
    this.onStateChange = onState;
    // Emit current state immediately
    this.onStateChange(this.state);
  }

  updateConfig(updates: Partial<AutoYieldConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.log(`Config updated: ${JSON.stringify(updates)}`, 'info');
  }

  getConfig(): AutoYieldConfig {
    return { ...this.config };
  }

  getState(): MonitorState {
    return { ...this.state };
  }

  async start(walletAddress: Address, walletClient: any): Promise<void> {
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
    this.config.enabled = true;
    this.saveConfig();

    this.updateState({
      isRunning: true,
      error: null,
    });

    this.log('🚀 Auto-yield monitor started', 'success');
    this.log(`Checking every ${this.config.checkIntervalMs / 1000}s | Min APY: ${this.config.minApyImprovement}% | Max Gas: $${this.config.maxGasCost}`, 'info');

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
    });

    this.log('⏹️ Auto-yield monitor stopped', 'info');
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
        this.log(`Cooldown active: ${remaining}s remaining`, 'info');
        return;
      }
    }

    this.log('🔍 Scanning for opportunities...', 'info');

    try {
      const result = await findBestRotation(
        this.config.walletAddress,
        this.config.minApyImprovement,
        this.config.isTestnet
      );

      this.updateState({
        lastCheck: Date.now(),
        checksCount: this.state.checksCount + 1,
        currentPositions: result.positions,
        currentOpportunities: result.opportunities,
        error: null,
      });

      if (result.positions.length === 0) {
        this.log('No positions found in wallet', 'warning');
        return;
      }

      if (!result.bestPlan) {
        this.log(`No opportunities above ${this.config.minApyImprovement}% APY improvement`, 'info');
        this.updateState({ pendingPlan: null });
        return;
      }

      // Check if plan meets criteria
      const { bestPlan } = result;

      // Check minimum position value
      if (bestPlan.fromPosition.valueUsd < this.config.minPositionValue) {
        this.log(`Position value ($${bestPlan.fromPosition.valueUsd.toFixed(2)}) below minimum ($${this.config.minPositionValue})`, 'info');
        return;
      }

      // Check gas cost
      if (bestPlan.gasCostUsd > this.config.maxGasCost) {
        this.log(`Gas cost ($${bestPlan.gasCostUsd.toFixed(2)}) exceeds limit ($${this.config.maxGasCost})`, 'warning');
        return;
      }

      // Check net benefit is positive
      if (bestPlan.netBenefit <= 0) {
        this.log('Net benefit is negative, skipping', 'info');
        return;
      }

      this.log(`✨ Found opportunity: +${bestPlan.apyImprovement.toFixed(2)}% APY on ${bestPlan.toOpportunity.protocol}`, 'success');
      this.updateState({ pendingPlan: bestPlan });

      // Auto-execute if enabled
      if (this.config.enabled) {
        await this.executeRotation(bestPlan);
      }

    } catch (error: any) {
      this.log(`Check failed: ${error.message}`, 'error');
      this.updateState({ error: error.message });
    }
  }

  async executeRotation(plan: RotationPlan): Promise<ExecutionRecord> {
    if (this.isExecuting) {
      throw new Error('Execution already in progress');
    }

    if (!this.config.walletClient) {
      throw new Error('Wallet client not available');
    }

    this.isExecuting = true;
    this.log(`⚡ Executing rotation: ${plan.fromPosition.token} → ${plan.toOpportunity.protocol}`, 'info');

    const record: ExecutionRecord = {
      id: `exec_${Date.now()}`,
      timestamp: Date.now(),
      plan,
      success: false,
    };

    try {
      const result = await executeYieldRotation(
        plan,
        this.config.walletClient,
        (status) => this.log(status, 'info')
      );

      record.success = result.success;
      record.txHash = result.txHash;
      record.error = result.error;

      if (result.success) {
        this.log(`✅ Rotation executed successfully! TX: ${result.txHash?.slice(0, 10)}...`, 'success');
      } else {
        this.log(`❌ Rotation failed: ${result.error}`, 'error');
      }

    } catch (error: any) {
      record.success = false;
      record.error = error.message;
      this.log(`❌ Execution error: ${error.message}`, 'error');
    }

    this.isExecuting = false;

    // Update state
    this.updateState({
      lastExecution: Date.now(),
      executionsCount: this.state.executionsCount + 1,
      pendingPlan: null,
      executionHistory: [...this.state.executionHistory, record],
    });

    this.saveHistory();
    return record;
  }

  clearHistory(): void {
    this.updateState({ executionHistory: [] });
    localStorage.removeItem('autoYieldHistory');
    this.log('Execution history cleared', 'info');
  }
}

// Singleton instance
export const autoYieldMonitor = new AutoYieldMonitor();

// Export for global debugging
if (typeof window !== 'undefined') {
  (window as any).autoYieldMonitor = autoYieldMonitor;
  console.log('%c🤖 AUTO YIELD MONITOR', 'color: #ff00ff; font-weight: bold; font-size: 14px;');
  console.log('  autoYieldMonitor.start(address, walletClient) - Start monitoring');
  console.log('  autoYieldMonitor.stop() - Stop monitoring');
  console.log('  autoYieldMonitor.getState() - Get current state');
  console.log('  autoYieldMonitor.getConfig() - Get configuration');
}
