// One-Click Yield Rotation Component with Auto-Execution
// Real cross-chain yield optimization with wallet signing and auto-monitoring

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
  Bot
} from 'lucide-react';
import { Address } from 'viem';
import {
  findBestRotation,
  oneClickYieldRotation,
  Position,
  YieldOpportunity,
  RotationPlan,
  SUPPORTED_CHAINS,
} from '../services/yieldRotation';
import {
  autoYieldMonitor,
  MonitorState,
  ExecutionRecord,
} from '../services/autoYieldMonitor';

interface OneClickYieldProps {
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

type ViewMode = 'overview' | 'scanning' | 'plan' | 'executing' | 'success' | 'error' | 'auto' | 'history';

export const OneClickYield: React.FC<OneClickYieldProps> = ({ onLog }) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [isTestnet, setIsTestnet] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [opportunities, setOpportunities] = useState<YieldOpportunity[]>([]);
  const [bestPlan, setBestPlan] = useState<RotationPlan | null>(null);
  const [allPlans, setAllPlans] = useState<RotationPlan[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto-mode state
  const [monitorState, setMonitorState] = useState<MonitorState | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  
  // Settings
  const [minApyImprovement, setMinApyImprovement] = useState(2);
  const [maxGasCost, setMaxGasCost] = useState(50);
  const [minPositionValue, setMinPositionValue] = useState(100);
  const [checkInterval, setCheckInterval] = useState(60);
  const [showSettings, setShowSettings] = useState(false);
  
  // Initialize auto-monitor callbacks
  useEffect(() => {
    autoYieldMonitor.setCallbacks(
      (status, type) => {
        setStatusMessage(status);
        onLog?.(status, type as any);
      },
      (state) => {
        setMonitorState(state);
        setIsAutoMode(state.isRunning);
        if (state.currentPositions.length > 0) {
          setPositions(state.currentPositions);
        }
        if (state.pendingPlan) {
          setBestPlan(state.pendingPlan);
        }
      }
    );
    
    // Load initial state
    setMonitorState(autoYieldMonitor.getState());
    const config = autoYieldMonitor.getConfig();
    setMinApyImprovement(config.minApyImprovement);
    setMaxGasCost(config.maxGasCost);
    setMinPositionValue(config.minPositionValue);
    setCheckInterval(config.checkIntervalMs / 1000);
  }, [onLog]);
  
  // Detect testnet
  useEffect(() => {
    const testnetChains = SUPPORTED_CHAINS.testnet.map(c => c.id);
    setIsTestnet(testnetChains.includes(chainId));
    autoYieldMonitor.updateConfig({ isTestnet: testnetChains.includes(chainId) });
  }, [chainId]);
  
  // Start auto-mode
  const handleStartAuto = useCallback(async () => {
    if (!address || !walletClient) {
      onLog?.('Wallet not connected', 'error');
      return;
    }
    
    // Update config before starting
    autoYieldMonitor.updateConfig({
      minApyImprovement,
      maxGasCost,
      minPositionValue,
      checkIntervalMs: checkInterval * 1000,
      isTestnet,
    });
    
    await autoYieldMonitor.start(address as Address, walletClient);
    setViewMode('auto');
  }, [address, walletClient, minApyImprovement, maxGasCost, minPositionValue, checkInterval, isTestnet, onLog]);
  
  // Stop auto-mode
  const handleStopAuto = useCallback(() => {
    autoYieldMonitor.stop();
    setViewMode('overview');
  }, []);
  
  // Manual scan
  const handleScan = useCallback(async () => {
    if (!address) return;
    
    setViewMode('scanning');
    setError(null);
    setStatusMessage('Scanning wallet positions across chains...');
    onLog?.('🔍 Scanning wallet positions...', 'info');
    
    try {
      const result = await findBestRotation(
        address as Address,
        minApyImprovement,
        isTestnet
      );
      
      setPositions(result.positions);
      setOpportunities(result.opportunities);
      setBestPlan(result.bestPlan);
      setAllPlans(result.allPlans);
      
      if (result.positions.length === 0) {
        setError('No token positions found in your wallet.');
        setViewMode('error');
        onLog?.('⚠️ No tokens found in wallet', 'error');
      } else if (!result.bestPlan) {
        setStatusMessage(`Found ${result.positions.length} positions, but no opportunities with >${minApyImprovement}% APY improvement.`);
        setViewMode('overview');
        onLog?.(`Found ${result.positions.length} positions`, 'info');
      } else {
        setViewMode('plan');
        onLog?.(`✅ Found opportunity: ${result.bestPlan.apyImprovement.toFixed(2)}% APY improvement`, 'success');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan positions');
      setViewMode('error');
      onLog?.(`❌ Scan failed: ${err.message}`, 'error');
    }
  }, [address, minApyImprovement, isTestnet, onLog]);
  
  // Execute rotation
  const handleExecute = useCallback(async () => {
    if (!address || !walletClient || !bestPlan) return;
    
    setViewMode('executing');
    setError(null);
    setIsLoading(true);
    onLog?.('🚀 Executing yield rotation...', 'info');
    
    try {
      const result = await oneClickYieldRotation(
        address as Address,
        walletClient,
        {
          isTestnet,
          minApyImprovement,
          maxGasCost,
          onStatusUpdate: (status) => {
            setStatusMessage(status);
            onLog?.(`📍 ${status}`, 'info');
          },
        }
      );
      
      if (result.success) {
        setTxHash(result.result?.txHash || null);
        setViewMode('success');
        onLog?.('✅ Yield rotation executed successfully!', 'success');
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
  }, [address, walletClient, bestPlan, isTestnet, minApyImprovement, maxGasCost, onLog]);
  
  // Reset
  const handleReset = () => {
    setViewMode('overview');
    setPositions([]);
    setOpportunities([]);
    setBestPlan(null);
    setAllPlans([]);
    setError(null);
    setTxHash(null);
    setStatusMessage('');
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
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  const getExplorerUrl = (hash: string, chainId: number) => {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      42161: 'https://arbiscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      8453: 'https://basescan.org/tx/',
      11155111: 'https://sepolia.etherscan.io/tx/',
      421614: 'https://sepolia.arbiscan.io/tx/',
      11155420: 'https://sepolia-optimism.etherscan.io/tx/',
      84532: 'https://sepolia.basescan.org/tx/',
    };
    return (explorers[chainId] || 'https://etherscan.io/tx/') + hash;
  };
  
  // Not connected view
  if (!isConnected) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-neon-green/20 rounded-full flex items-center justify-center">
            <Zap className="text-neon-green" size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">One-Click Yield Rotation</h3>
            <p className="text-gray-400 text-sm">Automatically move capital to best yields</p>
          </div>
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
          <Wallet className="text-yellow-400" size={24} />
          <div>
            <p className="text-yellow-400 font-medium">Wallet Not Connected</p>
            <p className="text-yellow-400/70 text-sm">Connect your wallet to scan positions and optimize yields</p>
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
            isAutoMode ? 'bg-purple-500/20' : 'bg-neon-green/20'
          }`}>
            {isAutoMode ? (
              <Bot className="text-purple-400 animate-pulse" size={20} />
            ) : (
              <Zap className="text-neon-green" size={20} />
            )}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">
              {isAutoMode ? 'Auto-Yield Monitor' : 'One-Click Yield Rotation'}
            </h3>
            <p className="text-gray-400 text-sm font-mono">
              {isTestnet ? '🧪 Testnet' : '🌐 Mainnet'} 
              {isAutoMode && monitorState && (
                <span className="ml-2 text-purple-400">
                  • {monitorState.checksCount} checks • {monitorState.executionsCount} executions
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
                viewMode === 'history' ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-gray-400'
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
              showSettings ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-white/10 text-gray-400'
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
        <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-purple-400 animate-pulse" size={16} />
            <span className="text-purple-400 text-sm font-mono">
              Auto-monitoring active
            </span>
            {monitorState.lastCheck && (
              <span className="text-purple-400/60 text-xs">
                Last check: {formatTime(monitorState.lastCheck)}
              </span>
            )}
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
                Min APY Improvement (%)
              </label>
              <input
                type="number"
                value={minApyImprovement}
                onChange={(e) => setMinApyImprovement(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="0.1"
                max="50"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Max Gas Cost ($)
              </label>
              <input
                type="number"
                value={maxGasCost}
                onChange={(e) => setMaxGasCost(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="1"
                max="500"
                step="5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Min Position Value ($)
              </label>
              <input
                type="number"
                value={minPositionValue}
                onChange={(e) => setMinPositionValue(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="10"
                max="10000"
                step="10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
                Check Interval (sec)
              </label>
              <input
                type="number"
                value={checkInterval}
                onChange={(e) => setCheckInterval(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
                min="30"
                max="600"
                step="30"
              />
            </div>
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
              <button
                onClick={() => {
                  autoYieldMonitor.clearHistory();
                  setViewMode('overview');
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear
              </button>
            </div>
            
            {monitorState.executionHistory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No executions yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...monitorState.executionHistory].reverse().map((record) => (
                  <div
                    key={record.id}
                    className={`p-3 rounded-lg border ${
                      record.success 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                      {record.success ? (
                        <CheckCircle size={14} className="text-green-400" />
                      ) : (
                        <AlertCircle size={14} className="text-red-400" />
                      )}
                    </div>
                    <div className="text-sm text-white">
                      {record.plan.fromPosition.token} → {record.plan.toOpportunity.protocol}
                    </div>
                    <div className="text-xs text-gray-400">
                      +{record.plan.apyImprovement.toFixed(2)}% APY
                    </div>
                    {record.txHash && (
                      <a
                        href={getExplorerUrl(record.txHash, record.plan.toOpportunity.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neon-green hover:underline flex items-center gap-1 mt-1"
                      >
                        View TX <ExternalLink size={10} />
                      </a>
                    )}
                    {record.error && (
                      <p className="text-xs text-red-400 mt-1">{record.error}</p>
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
        
        {/* Overview / Initial State */}
        {viewMode === 'overview' && !isAutoMode && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="text-neon-green mt-0.5" size={18} />
                <div>
                  <p className="text-white text-sm">
                    Scan your wallet or enable <span className="text-purple-400 font-medium">Auto Mode</span> for 
                    hands-free yield optimization across chains.
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Supports: USDC, USDT, DAI, WETH on Ethereum, Arbitrum, Optimism, Polygon, Base
                  </p>
                </div>
              </div>
            </div>
            
            {/* Show positions if we have them */}
            {positions.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-400 font-mono uppercase mb-2">Your Positions</h4>
                <div className="space-y-2">
                  {positions.slice(0, 5).map((pos, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono">{pos.token}</span>
                        <span className="text-gray-500 text-xs">on {pos.chainName}</span>
                      </div>
                      <span className="text-neon-green font-mono">{parseFloat(pos.balanceFormatted).toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleScan}
                disabled={isLoading}
                className="bg-neon-green hover:bg-neon-green/80 text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <TrendingUp size={20} />
                    Manual Scan
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
            {/* Status */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="text-purple-400 animate-pulse" size={24} />
                <div>
                  <p className="text-white font-medium">Auto-Yield Monitor Running</p>
                  <p className="text-purple-400/70 text-sm">{statusMessage || 'Monitoring for opportunities...'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/30 rounded p-2">
                  <p className="text-2xl text-white font-bold">{monitorState?.checksCount || 0}</p>
                  <p className="text-xs text-gray-400">Checks</p>
                </div>
                <div className="bg-black/30 rounded p-2">
                  <p className="text-2xl text-white font-bold">{monitorState?.executionsCount || 0}</p>
                  <p className="text-xs text-gray-400">Executions</p>
                </div>
                <div className="bg-black/30 rounded p-2">
                  <p className="text-2xl text-white font-bold">{positions.length}</p>
                  <p className="text-xs text-gray-400">Positions</p>
                </div>
              </div>
            </div>
            
            {/* Current positions */}
            {positions.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-400 font-mono uppercase mb-2">Tracked Positions</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {positions.map((pos, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-1.5 text-sm">
                      <span className="text-white font-mono">{pos.token}</span>
                      <span className="text-gray-400">{pos.chainName}</span>
                      <span className="text-neon-green font-mono">{parseFloat(pos.balanceFormatted).toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Pending Plan */}
            {bestPlan && (
              <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-3">
                <h4 className="text-xs text-neon-green font-mono uppercase mb-2">Pending Opportunity</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{bestPlan.toOpportunity.protocol}</p>
                    <p className="text-gray-400 text-sm">{bestPlan.toOpportunity.chainName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-neon-green font-bold">+{bestPlan.apyImprovement.toFixed(2)}%</p>
                    <p className="text-gray-400 text-xs">APY improvement</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Config Summary */}
            <div className="text-xs text-gray-500 font-mono">
              <Clock size={12} className="inline mr-1" />
              Check every {checkInterval}s • Min APY: {minApyImprovement}% • Max Gas: ${maxGasCost}
            </div>
          </div>
        )}
        
        {/* Scanning State */}
        {viewMode === 'scanning' && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin text-neon-green mx-auto mb-4" size={40} />
            <p className="text-white font-medium">{statusMessage || 'Scanning...'}</p>
            <p className="text-gray-400 text-sm mt-2">This may take a few moments</p>
          </div>
        )}
        
        {/* Plan View */}
        {viewMode === 'plan' && bestPlan && (
          <div className="space-y-4">
            {/* Current Position */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-xs text-gray-400 font-mono uppercase mb-2">Current Position</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{bestPlan.fromPosition.token}</p>
                  <p className="text-gray-400 text-sm">{bestPlan.fromPosition.chainName}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-mono">{parseFloat(bestPlan.fromPosition.balanceFormatted).toFixed(4)}</p>
                  <p className="text-gray-400 text-sm">{formatUsd(bestPlan.fromPosition.valueUsd)}</p>
                </div>
              </div>
            </div>
            
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-neon-green/20 rounded-full flex items-center justify-center">
                <ArrowRight className="text-neon-green" size={20} />
              </div>
            </div>
            
            {/* Target Opportunity */}
            <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-4">
              <h4 className="text-xs text-neon-green font-mono uppercase mb-2">Best Opportunity</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{bestPlan.toOpportunity.protocol}</p>
                  <p className="text-gray-400 text-sm">{bestPlan.toOpportunity.chainName}</p>
                </div>
                <div className="text-right">
                  <p className="text-neon-green font-bold text-xl">{bestPlan.toOpportunity.apy.toFixed(2)}% APY</p>
                  <p className="text-gray-400 text-sm">TVL: {formatUsd(bestPlan.toOpportunity.tvl)}</p>
                </div>
              </div>
            </div>
            
            {/* Summary */}
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">APY Improvement</span>
                <span className="text-neon-green font-bold">+{bestPlan.apyImprovement.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Est. Annual Gain</span>
                <span className="text-white">{formatUsd(bestPlan.estimatedAnnualGain)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Gas Cost</span>
                <span className="text-orange-400">{formatUsd(bestPlan.gasCostUsd)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Net Annual Benefit</span>
                <span className={bestPlan.netBenefit > 0 ? 'text-neon-green font-bold' : 'text-red-400'}>
                  {formatUsd(bestPlan.netBenefit)}
                </span>
              </div>
            </div>
            
            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={isLoading || bestPlan.netBenefit <= 0}
              className="w-full bg-neon-green hover:bg-neon-green/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Zap size={20} />
                  Execute via LI.FI
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Executing State */}
        {viewMode === 'executing' && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin text-neon-green mx-auto mb-4" size={40} />
            <p className="text-white font-medium">{statusMessage || 'Executing...'}</p>
            <p className="text-gray-400 text-sm mt-2">Please confirm in your wallet</p>
          </div>
        )}
        
        {/* Success State */}
        {viewMode === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="text-neon-green mx-auto mb-4" size={48} />
            <h4 className="text-white font-bold text-lg mb-2">Rotation Complete!</h4>
            <p className="text-gray-400 text-sm mb-4">
              Your capital has been moved to the higher yield opportunity
            </p>
            
            {txHash && bestPlan && (
              <a
                href={getExplorerUrl(txHash, bestPlan.toOpportunity.chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-neon-green hover:underline"
              >
                View Transaction <ExternalLink size={16} />
              </a>
            )}
            
            <button
              onClick={handleReset}
              className="mt-6 w-full bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Scan for More Opportunities
            </button>
          </div>
        )}
        
        {/* Error State */}
        {viewMode === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
            <h4 className="text-white font-bold text-lg mb-2">Something went wrong</h4>
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

export default OneClickYield;
