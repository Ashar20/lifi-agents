// Cross-Chain Arbitrage Executor Component with Auto-Execution
// Real arbitrage detection and execution via LI.FI - NO MOCKS

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { 
  Zap, 
  TrendingUp, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Wallet,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Settings,
  Info,
  Play,
  Square,
  Clock,
  History,
  Activity,
  Bot,
  DollarSign,
  ArrowRightLeft
} from 'lucide-react';
import { Address, formatUnits } from 'viem';
import { ArbitrageOpportunity } from '../services/priceFetcher';
import {
  scanArbitrageOpportunities,
  createArbitragePlan,
  executeArbitrage,
  getTokenBalance,
  ArbitrageExecutionPlan,
  ArbitrageStep,
  CHAINS,
  ARBITRAGE_TOKENS,
} from '../services/arbitrageExecutor';
import {
  autoArbitrageMonitor,
  ArbMonitorState,
  ArbExecutionRecord,
} from '../services/autoArbitrageMonitor';

interface ArbitrageExecutorProps {
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

type ViewMode = 'overview' | 'scanning' | 'opportunities' | 'plan' | 'executing' | 'success' | 'error' | 'auto' | 'history';

export const ArbitrageExecutor: React.FC<ArbitrageExecutorProps> = ({ onLog }) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [executionPlan, setExecutionPlan] = useState<ArbitrageExecutionPlan | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actualProfit, setActualProfit] = useState<number | null>(null);
  
  // Balance state
  const [availableBalance, setAvailableBalance] = useState<string>('0');
  const [tradeAmount, setTradeAmount] = useState<string>('1000'); // In USD
  
  // Auto-mode state
  const [monitorState, setMonitorState] = useState<ArbMonitorState | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  
  // Settings
  const [minProfitPercent, setMinProfitPercent] = useState(0.3);
  const [maxGasCost, setMaxGasCost] = useState(20);
  const [inputToken, setInputToken] = useState('USDC');
  const [checkInterval, setCheckInterval] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  
  // Initialize auto-monitor callbacks
  useEffect(() => {
    autoArbitrageMonitor.setCallbacks(
      (status, type) => {
        setStatusMessage(status);
        onLog?.(status, type as any);
      },
      (state) => {
        setMonitorState(state);
        setIsAutoMode(state.isRunning);
        if (state.currentOpportunities.length > 0) {
          setOpportunities(state.currentOpportunities);
        }
        if (state.pendingPlan) {
          setExecutionPlan(state.pendingPlan);
        }
      }
    );
    
    // Load initial state
    setMonitorState(autoArbitrageMonitor.getState());
    const config = autoArbitrageMonitor.getConfig();
    setMinProfitPercent(config.minProfitPercent);
    setMaxGasCost(config.maxGasCost);
    setInputToken(config.inputToken);
    setCheckInterval(config.checkIntervalMs / 1000);
  }, [onLog]);
  
  // Check balance when chain changes
  useEffect(() => {
    if (address && chainId) {
      checkBalance();
    }
  }, [address, chainId]);
  
  // Check user balance
  const checkBalance = useCallback(async () => {
    if (!address) return;
    
    try {
      const balance = await getTokenBalance(address as Address, chainId, inputToken);
      setAvailableBalance(balance.formatted);
    } catch (err) {
      setAvailableBalance('0');
    }
  }, [address, chainId, inputToken]);
  
  // Start auto-mode
  const handleStartAuto = useCallback(async () => {
    if (!address || !walletClient) {
      onLog?.('Wallet not connected', 'error');
      return;
    }
    
    // Update config before starting
    autoArbitrageMonitor.updateConfig({
      minProfitPercent,
      maxGasCost,
      inputToken,
      checkIntervalMs: checkInterval * 1000,
      sourceChainId: chainId,
    });
    
    await autoArbitrageMonitor.start(address as Address, walletClient, chainId);
    setViewMode('auto');
  }, [address, walletClient, chainId, minProfitPercent, maxGasCost, inputToken, checkInterval, onLog]);
  
  // Stop auto-mode
  const handleStopAuto = useCallback(() => {
    autoArbitrageMonitor.stop();
    setViewMode('overview');
  }, []);
  
  // Manual scan
  const handleScan = useCallback(async () => {
    setViewMode('scanning');
    setError(null);
    setStatusMessage('Scanning for cross-chain arbitrage opportunities...');
    onLog?.('🔍 Scanning for arbitrage...', 'info');
    
    try {
      const opps = await scanArbitrageOpportunities(
        inputToken as any,
        minProfitPercent,
        parseFloat(tradeAmount)
      );
      
      setOpportunities(opps);
      
      if (opps.length === 0) {
        setStatusMessage(`No opportunities found with >${minProfitPercent}% profit`);
        setViewMode('overview');
        onLog?.('No opportunities found', 'info');
      } else {
        setViewMode('opportunities');
        onLog?.(`✅ Found ${opps.length} arbitrage opportunities`, 'success');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan');
      setViewMode('error');
      onLog?.(`❌ Scan failed: ${err.message}`, 'error');
    }
  }, [inputToken, minProfitPercent, tradeAmount, onLog]);
  
  // Select opportunity and create plan
  const handleSelectOpportunity = useCallback(async (opp: ArbitrageOpportunity) => {
    if (!address) return;
    
    setSelectedOpportunity(opp);
    setViewMode('scanning');
    setStatusMessage('Creating execution plan...');
    
    try {
      // Get the token decimals
      const tokens = ARBITRAGE_TOKENS[opp.fromChain];
      const decimals = tokens?.[inputToken]?.decimals || 6;
      
      // Convert USD amount to token amount
      const amountInSmallestUnit = (parseFloat(tradeAmount) * Math.pow(10, decimals)).toString();
      
      const plan = await createArbitragePlan(
        opp,
        address as Address,
        amountInSmallestUnit,
        inputToken
      );
      
      if (!plan) {
        setError('Could not create execution plan - no route found');
        setViewMode('error');
        return;
      }
      
      setExecutionPlan(plan);
      setViewMode('plan');
      onLog?.(`📋 Plan created: ${plan.netProfit.toFixed(2)} USD net profit`, 'info');
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
      setViewMode('error');
    }
  }, [address, inputToken, tradeAmount, onLog]);
  
  // Execute arbitrage
  const handleExecute = useCallback(async () => {
    if (!walletClient || !executionPlan) return;
    
    setViewMode('executing');
    setError(null);
    setIsLoading(true);
    setTxHashes([]);
    onLog?.('🚀 Executing arbitrage...', 'info');
    
    try {
      const result = await executeArbitrage(
        executionPlan,
        walletClient,
        (status, step) => {
          setStatusMessage(status);
          if (step) {
            // Update step status in the plan
            setExecutionPlan(prev => {
              if (!prev) return prev;
              const newSteps = [...prev.steps];
              const idx = newSteps.findIndex(s => s.step === step.step);
              if (idx >= 0) {
                newSteps[idx] = step;
              }
              return { ...prev, steps: newSteps };
            });
          }
          onLog?.(`📍 ${status}`, 'info');
        }
      );
      
      setTxHashes(result.txHashes);
      setActualProfit(result.actualProfit || executionPlan.netProfit);
      
      if (result.success) {
        setViewMode('success');
        onLog?.(`✅ Arbitrage complete! Profit: $${(result.actualProfit || executionPlan.netProfit).toFixed(2)}`, 'success');
        
        // Refresh balance after successful swap
        setTimeout(() => {
          window.dispatchEvent(new Event('refresh-balance'));
          // Refresh available balance
          if (address) {
            checkBalance();
          }
        }, 2000); // Wait 2 seconds for transaction to be mined
      } else {
        setError(result.error || 'Execution failed');
        setViewMode('error');
        onLog?.(`❌ ${result.error}`, 'error');
      }
    } catch (err: any) {
      setError(err.message || 'Execution failed');
      setViewMode('error');
      onLog?.(`❌ Execution error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, executionPlan, onLog]);
  
  // Reset
  const handleReset = () => {
    setViewMode('overview');
    setOpportunities([]);
    setSelectedOpportunity(null);
    setExecutionPlan(null);
    setError(null);
    setTxHashes([]);
    setStatusMessage('');
    setActualProfit(null);
  };
  
  // Format helpers
  const formatUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  const getChainExplorer = (chainId: number) => {
    const allChains = [...CHAINS.mainnet, ...CHAINS.testnet];
    return allChains.find(c => c.id === chainId)?.explorer || 'https://etherscan.io';
  };
  
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };
  
  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-green-400" />;
      case 'executing': return <Loader2 size={14} className="text-yellow-400 animate-spin" />;
      case 'failed': return <AlertCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-gray-400" />;
    }
  };
  
  // Not connected view
  if (!isConnected) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
            <ArrowRightLeft className="text-cyan-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Cross-Chain Arbitrage</h3>
            <p className="text-gray-400 text-sm">Profit from price differences across chains</p>
          </div>
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
          <Wallet className="text-yellow-400" size={24} />
          <div>
            <p className="text-yellow-400 font-medium">Wallet Not Connected</p>
            <p className="text-yellow-400/70 text-sm">Connect your wallet to scan and execute arbitrage</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isAutoMode ? 'bg-cyan-500/20' : 'bg-cyan-500/20'
          }`}>
            {isAutoMode ? (
              <Bot className="text-cyan-400 animate-pulse" size={20} />
            ) : (
              <ArrowRightLeft className="text-cyan-400" size={20} />
            )}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">
              {isAutoMode ? 'Auto-Arbitrage Monitor' : 'Cross-Chain Arbitrage'}
            </h3>
            <p className="text-gray-400 text-sm font-mono">
              Buy → Bridge → Sell
              {isAutoMode && monitorState && (
                <span className="ml-2 text-cyan-400">
                  • {monitorState.checksCount} scans • ${monitorState.totalProfit.toFixed(2)} profit
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* History button */}
          {monitorState && monitorState.executionHistory.length > 0 && (
            <button
              onClick={() => setViewMode(viewMode === 'history' ? 'overview' : 'history')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'history' ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/10 text-gray-400'
              }`}
              title="Execution History"
            >
              <History size={18} />
            </button>
          )}
          
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/10 text-gray-400'
            }`}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          
          {/* Reset button */}
          {viewMode !== 'overview' && viewMode !== 'auto' && !isAutoMode && (
            <button
              onClick={handleReset}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Reset"
            >
              <RefreshCw size={18} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>
      
      {/* Auto-Mode Status Bar */}
      {isAutoMode && monitorState && (
        <div className="px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-cyan-400 animate-pulse" size={16} />
            <span className="text-cyan-400 text-sm font-mono">
              Auto-scanning active
            </span>
            <span className="text-cyan-400/60 text-xs">
              {monitorState.status}
            </span>
          </div>
          <button
            onClick={handleStopAuto}
            className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-mono transition-colors"
          >
            <Square size={12} />
            STOP
          </button>
        </div>
      )}
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Min Profit (%)
              </label>
              <input
                type="number"
                value={minProfitPercent}
                onChange={(e) => setMinProfitPercent(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="0.1"
                max="10"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Max Gas ($)
              </label>
              <input
                type="number"
                value={maxGasCost}
                onChange={(e) => setMaxGasCost(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="1"
                max="100"
                step="1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Trade Amount ($)
              </label>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="100"
                max="100000"
                step="100"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Scan Interval (sec)
              </label>
              <input
                type="number"
                value={checkInterval}
                onChange={(e) => setCheckInterval(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="10"
                max="300"
                step="10"
              />
            </div>
          </div>
          
          {/* Balance display */}
          <div className="mt-3 p-2 bg-black/30 rounded flex items-center justify-between">
            <span className="text-gray-400 text-sm">Available {inputToken}:</span>
            <span className="text-white font-mono">{parseFloat(availableBalance).toFixed(2)}</span>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {/* History View */}
        {viewMode === 'history' && monitorState && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-medium">Execution History</h4>
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-mono text-sm">
                  Total: ${monitorState.totalProfit.toFixed(2)}
                </span>
                <button
                  onClick={() => {
                    autoArbitrageMonitor.clearHistory();
                    setViewMode('overview');
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              </div>
            </div>
            
            {monitorState.executionHistory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No executions yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...monitorState.executionHistory].reverse().map((record) => (
                  <div
                    key={record.id}
                    className={`p-3 rounded-lg border ${
                      record.result.success 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                      {record.result.success ? (
                        <span className="text-green-400 text-xs font-mono">
                          +${(record.result.actualProfit || record.plan.netProfit).toFixed(2)}
                        </span>
                      ) : (
                        <AlertCircle size={14} className="text-red-400" />
                      )}
                    </div>
                    <div className="text-sm text-white">
                      {record.plan.opportunity.fromChainName} → {record.plan.opportunity.toChainName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {record.plan.opportunity.priceDifference.toFixed(2)}% spread
                    </div>
                    {record.result.txHashes.length > 0 && (
                      <a
                        href={`${getChainExplorer(record.plan.opportunity.toChain)}/tx/${record.result.txHashes[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mt-1"
                      >
                        View TX <ExternalLink size={10} />
                      </a>
                    )}
                    {record.result.error && (
                      <p className="text-xs text-red-400 mt-1">{record.result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setViewMode('overview')}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors text-sm"
            >
              Back
            </button>
          </div>
        )}
        
        {/* Overview */}
        {viewMode === 'overview' && !isAutoMode && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="text-cyan-400 mt-0.5" size={18} />
                <div>
                  <p className="text-white text-sm">
                    Scan for price differences across chains and profit by:
                  </p>
                  <ol className="text-gray-400 text-xs mt-2 space-y-1 list-decimal list-inside">
                    <li>Buying on the cheaper chain</li>
                    <li>Bridging to the expensive chain</li>
                    <li>Selling for profit</li>
                  </ol>
                  <p className="text-gray-500 text-xs mt-2">
                    All executed via LI.FI in a single transaction
                  </p>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            {opportunities.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl text-white font-bold">{opportunities.length}</p>
                  <p className="text-xs text-gray-400">Opportunities</p>
                </div>
                <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl text-cyan-400 font-bold">
                    {opportunities[0]?.priceDifference.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">Best Spread</p>
                </div>
                <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl text-green-400 font-bold">
                    ${opportunities[0]?.profitAfterFees.toFixed(0) || 0}
                  </p>
                  <p className="text-xs text-gray-400">Est. Profit</p>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleScan}
                disabled={isLoading}
                className="bg-cyan-500 hover:bg-cyan-500/80 text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <TrendingUp size={20} />
                    Scan Now
                  </>
                )}
              </button>
              
              <button
                onClick={handleStartAuto}
                disabled={isLoading}
                className="bg-purple-500 hover:bg-purple-500/80 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Auto Mode
              </button>
            </div>
          </div>
        )}
        
        {/* Auto Mode Running */}
        {(viewMode === 'auto' || isAutoMode) && viewMode !== 'history' && (
          <div className="space-y-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="text-cyan-400 animate-pulse" size={24} />
                <div>
                  <p className="text-white font-medium">Auto-Arbitrage Running</p>
                  <p className="text-cyan-400/70 text-sm">{statusMessage || 'Monitoring for opportunities...'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-black/30 rounded p-2">
                  <p className="text-xl text-white font-bold">{monitorState?.checksCount || 0}</p>
                  <p className="text-xs text-gray-400">Scans</p>
                </div>
                <div className="bg-black/30 rounded p-2">
                  <p className="text-xl text-white font-bold">{monitorState?.executionsCount || 0}</p>
                  <p className="text-xs text-gray-400">Trades</p>
                </div>
                <div className="bg-black/30 rounded p-2">
                  <p className="text-xl text-white font-bold">{opportunities.length}</p>
                  <p className="text-xs text-gray-400">Opps</p>
                </div>
                <div className="bg-black/30 rounded p-2">
                  <p className="text-xl text-green-400 font-bold">${monitorState?.totalProfit.toFixed(0) || 0}</p>
                  <p className="text-xs text-gray-400">Profit</p>
                </div>
              </div>
            </div>
            
            {/* Current Opportunities */}
            {opportunities.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-400 font-mono uppercase mb-2">Live Opportunities</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {opportunities.slice(0, 5).map((opp, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-1.5 text-sm">
                      <span className="text-white">{opp.fromChainName} → {opp.toChainName}</span>
                      <span className="text-cyan-400 font-mono">{opp.priceDifference.toFixed(2)}%</span>
                      <span className="text-green-400 font-mono">${opp.profitAfterFees.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Pending Plan */}
            {executionPlan && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <h4 className="text-xs text-green-400 font-mono uppercase mb-2">Executing</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {executionPlan.opportunity.fromChainName} → {executionPlan.opportunity.toChainName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">${executionPlan.netProfit.toFixed(2)}</p>
                    <p className="text-gray-400 text-xs">Net profit</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-500 font-mono">
              <Clock size={12} className="inline mr-1" />
              Every {checkInterval}s • Min: {minProfitPercent}% • Max Gas: ${maxGasCost}
            </div>
          </div>
        )}
        
        {/* Scanning State */}
        {viewMode === 'scanning' && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
            <p className="text-white font-medium">{statusMessage || 'Scanning...'}</p>
            <p className="text-gray-400 text-sm mt-2">Checking prices across chains</p>
          </div>
        )}
        
        {/* Opportunities List */}
        {viewMode === 'opportunities' && (
          <div className="space-y-3">
            <h4 className="text-sm text-gray-400 font-mono uppercase">
              Found {opportunities.length} Opportunities
            </h4>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {opportunities.map((opp, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectOpportunity(opp)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-lg p-3 text-left transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{opp.tokenSymbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(opp.confidence)} bg-current/10`}>
                        {opp.confidence}
                      </span>
                    </div>
                    <span className="text-cyan-400 font-bold">{opp.priceDifference.toFixed(2)}%</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">{opp.fromChainName}</span>
                    <span className="text-gray-600">@${opp.fromPrice.toFixed(4)}</span>
                    <ArrowRight size={14} className="text-gray-500" />
                    <span className="text-gray-400">{opp.toChainName}</span>
                    <span className="text-gray-600">@${opp.toPrice.toFixed(4)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-500">On ${opp.volume.toFixed(0)}</span>
                    <span className="text-green-400 font-mono">+${opp.profitAfterFees.toFixed(2)} profit</span>
                  </div>
                </button>
              ))}
            </div>
            
            <button
              onClick={handleReset}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors text-sm"
            >
              Back
            </button>
          </div>
        )}
        
        {/* Execution Plan */}
        {viewMode === 'plan' && executionPlan && (
          <div className="space-y-4">
            {/* Route Overview */}
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs text-cyan-400 font-mono uppercase">Arbitrage Route</h4>
                <span className="text-cyan-400 font-bold">{executionPlan.opportunity.priceDifference.toFixed(2)}% spread</span>
              </div>
              
              <div className="flex items-center justify-center gap-3 text-sm">
                <div className="text-center">
                  <p className="text-white font-medium">{executionPlan.opportunity.fromChainName}</p>
                  <p className="text-gray-400 text-xs">${executionPlan.opportunity.fromPrice.toFixed(4)}</p>
                </div>
                <ArrowRight className="text-cyan-400" size={20} />
                <div className="text-center">
                  <p className="text-white font-medium">{executionPlan.opportunity.toChainName}</p>
                  <p className="text-gray-400 text-xs">${executionPlan.opportunity.toPrice.toFixed(4)}</p>
                </div>
              </div>
            </div>
            
            {/* Steps */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-xs text-gray-400 font-mono uppercase mb-3">Execution Steps</h4>
              <div className="space-y-2">
                {executionPlan.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {getStepStatusIcon(step.status)}
                    <span className="text-gray-400 font-mono w-6">{step.step}.</span>
                    <span className={`uppercase text-xs px-1.5 py-0.5 rounded ${
                      step.action === 'buy' ? 'bg-green-500/20 text-green-400' :
                      step.action === 'bridge' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {step.action}
                    </span>
                    <span className="text-white flex-1">{step.description}</span>
                    <span className="text-gray-500 text-xs">{step.chainName}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Summary */}
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Trade Amount</span>
                <span className="text-white">{formatUsd(parseFloat(executionPlan.inputAmountFormatted))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expected Return</span>
                <span className="text-white">{formatUsd(parseFloat(executionPlan.inputAmountFormatted) + executionPlan.expectedProfit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Gas Cost</span>
                <span className="text-orange-400">{formatUsd(executionPlan.gasCostEstimate)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Net Profit</span>
                <span className={executionPlan.netProfit > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>
                  {formatUsd(executionPlan.netProfit)}
                </span>
              </div>
            </div>
            
            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={isLoading || executionPlan.netProfit <= 0}
              className="w-full bg-cyan-500 hover:bg-cyan-500/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Zap size={20} />
                  Execute Arbitrage
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Executing State */}
        {viewMode === 'executing' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
              <p className="text-white font-medium">{statusMessage || 'Executing...'}</p>
              <p className="text-gray-400 text-sm mt-2">Please confirm in your wallet</p>
            </div>
            
            {/* Live step progress */}
            {executionPlan && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="space-y-2">
                  {executionPlan.steps.map((step, i) => (
                    <div key={i} className={`flex items-center gap-3 text-sm p-2 rounded ${
                      step.status === 'executing' ? 'bg-yellow-500/10' :
                      step.status === 'completed' ? 'bg-green-500/10' :
                      step.status === 'failed' ? 'bg-red-500/10' : ''
                    }`}>
                      {getStepStatusIcon(step.status)}
                      <span className="text-white flex-1">{step.description}</span>
                      {step.txHash && (
                        <a
                          href={`${getChainExplorer(step.chainId)}/tx/${step.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Success State */}
        {viewMode === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="text-green-400 mx-auto mb-4" size={48} />
            <h4 className="text-white font-bold text-lg mb-2">Arbitrage Complete!</h4>
            <p className="text-green-400 text-2xl font-bold mb-2">
              +{formatUsd(actualProfit || executionPlan?.netProfit || 0)}
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Profit captured successfully
            </p>
            
            {txHashes.length > 0 && executionPlan && (
              <div className="space-y-1 mb-4">
                {txHashes.map((hash, i) => (
                  <a
                    key={i}
                    href={`${getChainExplorer(executionPlan.opportunity.toChain)}/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-cyan-400 hover:underline text-sm"
                  >
                    Transaction {i + 1} <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            )}
            
            <button
              onClick={handleReset}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Find More Opportunities
            </button>
          </div>
        )}
        
        {/* Error State */}
        {viewMode === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
            <h4 className="text-white font-bold text-lg mb-2">Arbitrage Failed</h4>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            
            <button
              onClick={handleReset}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArbitrageExecutor;
