import React, { useState, useEffect } from 'react';
import { AgentTaskResult, AgentMetadata, LogMessage } from '../types';
import { Shield, Search, Target, Zap, Clock, CheckCircle, XCircle, AlertCircle, DollarSign, Activity, Server, ChevronDown, ChevronUp, Users, TrendingUp, Radio, Brain, Database, Bell, ArrowLeft, BarChart3, ListChecks, Terminal } from 'lucide-react';
import { AGENT_ABILITIES } from '../constants';
import LottieAvatar from './LottieAvatar';
import { ArcBadge, ArcRouteIndicator, ArcStatsDisplay } from './ArcBadge';

interface OperationsDashboardProps {
  agents: AgentMetadata[];
  results: AgentTaskResult[];
  onBack: () => void;
  activeAgents?: string[];
  agentConnections?: Array<{source: string, target: string}>;
  agentStatuses?: Record<string, 'idle' | 'negotiating' | 'streaming' | 'offline'>;
  /** When true, fits in a panel instead of full screen */
  embedded?: boolean;
  /** System logs for the Logs tab */
  logs?: LogMessage[];
}

export const OperationsDashboard: React.FC<OperationsDashboardProps> = ({ 
  agents, 
  results, 
  onBack, 
  activeAgents = [],
  agentConnections = [],
  agentStatuses = {},
  embedded = false,
  logs = []
}) => {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'results' | 'logs'>('hierarchy');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['a0']));
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [totalCost, setTotalCost] = useState(0);
  const [apiCalls, setApiCalls] = useState(0);

  // Auto-migrate old data on mount
  useEffect(() => {
    const storedResults = localStorage.getItem('taskResults');
    if (storedResults) {
      try {
        const parsed = JSON.parse(storedResults);
        // Check if any result has old crypto agent names
        const hasOldData = parsed.some((r: AgentTaskResult) => 
          ['Dolphin Trainer', 'Octopus Architect', 'Sea Turtle Guardian', 'Flying Fish Scout', 
           'Hamster Analyst', 'Parrot Oracle'].includes(r.agentName)
        );
        
        if (hasOldData) {
          console.warn('🔄 Detected old crypto agent data in localStorage. Clearing...');
          localStorage.removeItem('taskResults');
          localStorage.removeItem('activeAgents');
          window.location.reload();
        }
      } catch (e) {
        console.error('Failed to parse stored results:', e);
      }
    }
  }, []);

  const clearAllData = () => {
    if (confirm('Clear all task results and start fresh?')) {
      localStorage.removeItem('taskResults');
      localStorage.removeItem('activeAgents');
      window.location.reload();
    }
  };

  // Calculate costs and API usage
  useEffect(() => {
    // All tasks now use Gemini AI only ($0.002 per call)
    const cost = results.length * 0.002;
    setTotalCost(cost);
    setApiCalls(results.length);
  }, [results]);

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const toggleResult = (index: number) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'arbitrage_detection': return <TrendingUp className="w-4 h-4" />;
      case 'yield_optimization': return <TrendingUp className="w-4 h-4" />;
      case 'rebalancing': return <Target className="w-4 h-4" />;
      case 'cross_chain_swap': return <Zap className="w-4 h-4" />;
      case 'yield_deposit': return <TrendingUp className="w-4 h-4" />;
      case 'position_monitoring': return <Database className="w-4 h-4" />;
      case 'risk_analysis': return <Shield className="w-4 h-4" />;
      case 'strategy_coordination': return <Target className="w-4 h-4" />;
      case 'custom_order': return <Zap className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: AgentTaskResult['status']) => {
    switch (status) {
      case 'success': 
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-xs font-mono">
            <CheckCircle className="w-3 h-3" />
            <span>COMPLETED</span>
          </div>
        );
      case 'failed': 
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs font-mono">
            <XCircle className="w-3 h-3" />
            <span>FAILED</span>
          </div>
        );
      case 'pending': 
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-xs font-mono animate-pulse">
            <Radio className="w-3 h-3" />
            <span>PROCESSING</span>
          </div>
        );
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCommanderOrder = (agentId: string) => {
    const orders: { [key: string]: string } = {
      'a1': 'Monitor all arbitrage opportunities across chains. Scan DEX prices and identify profitable price differences. Alert team immediately.',
      'a2': 'Track all cross-chain positions and calculate PnL. Match historical patterns. Provide intelligence on portfolio performance.',
      'a3': 'Find best yield opportunities across protocols. Answer questions about optimal strategies. Provide friendly, immediate optimization.',
      'a4': 'Validate route safety and analyze slippage. Educate team about risk management. Create engaging risk analysis reports.',
      'a5': 'Monitor portfolio allocations and detect drift. Maintain target allocations across chains. Protect portfolio from imbalance.',
      'a6': 'Execute LI.FI routes with minimal latency. Send execution status updates. Maximum speed delivery required.'
    };
    return orders[agentId] || 'Standby for orders from Paul Atreides.';
  };

  const getSubordinates = (agentId: string) => {
    return agentConnections
      .filter(c => c.source === agentId)
      .map(c => agents.find(a => a.id === c.target))
      .filter(Boolean) as AgentMetadata[];
  };

  const getCommander = (agentId: string) => {
    const incoming = agentConnections.find(c => c.target === agentId);
    if (incoming) {
      return agents.find(a => a.id === incoming.source);
    }
    return null;
  };

  const resultsByAgent = results.reduce((acc, result) => {
    if (!acc[result.agentId]) {
      acc[result.agentId] = [];
    }
    acc[result.agentId].push(result);
    return acc;
  }, {} as Record<string, AgentTaskResult[]>);

  const calculateAgentMetrics = (agentId: string, agentResults: AgentTaskResult[]) => {
    const successCount = agentResults.filter(r => r.status === 'success').length;
    const abilities = AGENT_ABILITIES[agentId];
    const apiUsage = abilities?.apis?.join(', ') || 'None';
    
    // Calculate cost - all tasks use Gemini AI ($0.002/call)
    let estimatedCost = agentResults.length * 0.002;
    
    return {
      totalTasks: agentResults.length,
      successRate: agentResults.length > 0 ? ((successCount / agentResults.length) * 100).toFixed(0) : '0',
      estimatedCost: estimatedCost.toFixed(4),
      apiUsage: apiUsage,
      status: agentStatuses[agentId] || 'offline'
    };
  };

  const sortedAgentIds = activeAgents.sort((a, b) => {
    if (a === 'a0') return -1;
    if (b === 'a0') return 1;
    const aResults = resultsByAgent[a]?.length || 0;
    const bResults = resultsByAgent[b]?.length || 0;
    return bResults - aResults;
  });

  return (
    <div className={`flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden ${embedded ? 'min-h-0 flex-1' : 'h-screen'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-neon-green/20 to-transparent border-b border-neon-green/50 p-6 backdrop-blur-md flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors group flex items-center gap-2 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-mono text-sm">Back</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 font-mono flex items-center gap-3">
                  <Activity className="w-8 h-8 text-neon-green animate-pulse" />
                  Operations Dashboard
                </h1>
                <p className="text-gray-400 text-sm font-mono">
                  Command hierarchy, task results, and operational metrics
                </p>
              </div>
            </div>
            
            {/* Clear Data Button */}
            <button
              onClick={clearAllData}
              className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-mono text-sm flex items-center gap-2"
              title="Clear all stored task data"
            >
              <XCircle className="w-4 h-4" />
              Clear Data
            </button>
          </div>

          {/* Global Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-black/40 border border-neon-green/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-neon-green" />
                <span className="text-xs text-gray-400 font-mono">ACTIVE AGENTS</span>
              </div>
              <div className="text-2xl font-bold text-neon-green font-mono">{activeAgents.length}</div>
            </div>
            <div className="bg-black/40 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400 font-mono">TOTAL TASKS</span>
              </div>
              <div className="text-2xl font-bold text-blue-400 font-mono">{results.length}</div>
            </div>
            <div className="bg-black/40 border border-purple-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400 font-mono">API CALLS</span>
              </div>
              <div className="text-2xl font-bold text-purple-400 font-mono">{apiCalls}</div>
            </div>
            <div className="bg-black/40 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-400 font-mono">TOTAL COST</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400 font-mono">${totalCost.toFixed(4)}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                activeTab === 'hierarchy'
                  ? 'bg-neon-green/20 border-2 border-neon-green text-neon-green'
                  : 'bg-black/40 border-2 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              COMMAND HIERARCHY
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                activeTab === 'results'
                  ? 'bg-neon-green/20 border-2 border-neon-green text-neon-green'
                  : 'bg-black/40 border-2 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              TASK RESULTS ({results.length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                activeTab === 'logs'
                  ? 'bg-neon-green/20 border-2 border-neon-green text-neon-green'
                  : 'bg-black/40 border-2 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              <Terminal className="w-4 h-4" />
              SYSTEM LOGS ({logs.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'logs' ? (
          // LOGS VIEW
          <div className="bg-black/40 border border-neon-green/30 rounded-lg p-4 space-y-1.5 font-mono text-xs">
            <div className="flex items-center gap-2 mb-3 text-neon-green">
              <Terminal className="w-4 h-4" />
              <span className="font-bold">LIVE SYSTEM LOGS</span>
            </div>
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Start a workflow to see activity.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded hover:bg-white/5">
                  <span className="text-gray-500 min-w-[60px] flex-shrink-0">{log.timestamp}</span>
                  <span className={`flex-shrink-0 ${
                    log.type === 'A2A' ? 'text-blue-400' :
                    log.type === 'COMMANDER' ? 'text-neon-green' :
                    log.type === 'x402' ? 'text-yellow-400' : 'text-gray-400'
                  }`}>
                    {log.type === 'A2A' ? 'A2A' : log.type === 'COMMANDER' ? 'CMD' : log.type === 'x402' ? 'x402' : 'SYS'}
                  </span>
                  <span className="break-all text-gray-300">{log.content}</span>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'hierarchy' ? (
          // HIERARCHY VIEW
          sortedAgentIds.length === 0 ? (
            <div className="text-center py-20">
              <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 font-mono">No active agents. Activate agents to see their command structure.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAgentIds.map(agentId => {
                const agent = agents.find(a => a.id === agentId);
                if (!agent) return null;

                const agentResults = resultsByAgent[agentId] || [];
                const metrics = calculateAgentMetrics(agentId, agentResults);
                const isExpanded = expandedAgents.has(agentId);
                const subordinates = getSubordinates(agentId);
                const commander = getCommander(agentId);
                const commanderOrder = getCommanderOrder(agentId);

                return (
                  <div 
                    key={agentId}
                    className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-2 border-neon-green/30 rounded-xl overflow-hidden hover:border-neon-green/50 transition-all"
                  >
                    <div 
                      className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleAgent(agentId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="relative w-[60px] h-[60px] rounded-full overflow-hidden border-2 border-neon-green/50 flex-shrink-0">
                            {agent.avatarType === 'lottie' ? (
                              <LottieAvatar animationPath={agent.avatar} width={60} height={60} className="w-full h-full" />
                            ) : (
                              <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                            )}
                            {metrics.status === 'streaming' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse border-2 border-gray-900" />
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-xl font-bold text-white font-mono">{agent.name}</h3>
                              <span className="px-2 py-1 bg-neon-green/20 border border-neon-green/50 rounded text-neon-green text-xs font-mono">
                                {agent.role}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mb-2">{agent.description}</p>

                            <div className="flex items-center gap-6 text-xs font-mono">
                              <div className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-blue-400" />
                                <span className="text-gray-400">Tasks:</span>
                                <span className="text-blue-400 font-bold">{metrics.totalTasks}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-green-400" />
                                <span className="text-gray-400">Success:</span>
                                <span className="text-green-400 font-bold">{metrics.successRate}%</span>
                              </div>
                              {subordinates.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-purple-400" />
                                  <span className="text-gray-400">Squad:</span>
                                  <span className="text-purple-400 font-bold">{subordinates.length}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="ml-4">
                          {isExpanded ? (
                            <ChevronUp className="w-6 h-6 text-neon-green" />
                          ) : (
                            <ChevronDown className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-neon-green/30 bg-black/30 p-6 space-y-6">
                        {(commander || subordinates.length > 0) && (
                          <div className="bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/30 rounded-lg p-4">
                            <h4 className="text-sm font-mono text-purple-400 mb-3 flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              COMMAND CHAIN
                            </h4>
                            <div className="space-y-2">
                              {commander && (
                                <div className="flex items-center gap-2 text-sm font-mono">
                                  <ChevronUp className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-400">Reports to:</span>
                                  <span className="text-white font-bold">{commander.name}</span>
                                </div>
                              )}
                              {subordinates.length > 0 && (
                                <div className="flex items-center gap-2 text-sm font-mono">
                                  <ChevronDown className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-400">Commands:</span>
                                  <div className="flex gap-2 flex-wrap">
                                    {subordinates.map(sub => (
                                      <span key={sub.id} className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">
                                        {sub.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {agentId !== 'a0' && (
                          <div className="bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-lg p-4">
                            <h4 className="text-sm font-mono text-yellow-400 mb-2 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              MISSION ORDERS
                            </h4>
                            <p className="text-gray-300 text-sm leading-relaxed">{commanderOrder}</p>
                          </div>
                        )}

                        <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/30 rounded-lg p-4">
                          <h4 className="text-sm font-mono text-blue-400 mb-2 flex items-center gap-2">
                            <Server className="w-4 h-4" />
                            API INTEGRATIONS
                          </h4>
                          <p className="text-gray-300 text-sm font-mono">{metrics.apiUsage || 'None'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // RESULTS VIEW
          results.length === 0 ? (
            <div className="text-center py-20">
              <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 font-mono">No task results yet. Agent activities will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.slice().reverse().map((result, index) => {
                const agent = agents.find(a => a.id === result.agentId);
                const isExpanded = expandedResults.has(index);
                
                return (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-2 border-gray-700 rounded-xl overflow-hidden hover:border-neon-green/30 transition-all"
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleResult(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {agent && (
                            <div className="w-[50px] h-[50px] rounded-full overflow-hidden border-2 border-neon-green/30 flex-shrink-0">
                              {agent.avatarType === 'lottie' ? (
                                <LottieAvatar animationPath={agent.avatar} width={50} height={50} className="w-full h-full" />
                              ) : (
                                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              {getTaskIcon(result.taskType)}
                              <h3 className="text-lg font-bold text-white font-mono">
                                {agent?.name || result.agentName}
                              </h3>
                              <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-xs font-mono">
                                {result.taskType.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm">{result.summary}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {getStatusBadge(result.status)}
                          <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(result.timestamp)}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-neon-green" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && result.data && (
                      <div className="border-t border-gray-700 bg-black/30 p-4">
                        {/* Rich rendering for rebalancing results */}
                        {result.data.type === 'rebalancing' && result.data.actions ? (
                          <div className="space-y-4">
                            {/* Arc Badge if any action used Arc/CCTP */}
                            {result.data.arcPowered && (
                              <div className="flex items-center gap-3">
                                <ArcBadge
                                  isArcRoute={true}
                                  size="md"
                                  showDetails={true}
                                  sourceChain={result.data.actions.find((a: any) => a.isArcRoute)?.fromChain}
                                  destinationChain={result.data.actions.find((a: any) => a.isArcRoute)?.toChain}
                                  estimatedTime="~15 min"
                                />
                              </div>
                            )}

                            {/* Status header */}
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-bold ${
                                result.data.status === 'EXECUTED' ? 'text-green-400' :
                                result.data.status === 'PARTIAL' ? 'text-yellow-400' :
                                result.data.status === 'FAILED' ? 'text-red-400' : 'text-blue-400'
                              }`}>
                                {result.data.status}
                              </span>
                              {result.data.drift && (
                                <span className="text-xs text-gray-400">Drift: {result.data.drift}</span>
                              )}
                              {result.data.crossChain && (
                                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">Cross-Chain</span>
                              )}
                            </div>

                            {/* Actions list */}
                            <div className="space-y-2">
                              {result.data.actions.map((action: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-lg ${action.action === 'sell' ? 'text-red-400' : 'text-green-400'}`}>
                                      {action.action === 'sell' ? '\u{1F4C9}' : '\u{1F4C8}'}
                                    </span>
                                    <div>
                                      <span className="text-white text-sm font-medium">
                                        {action.action.toUpperCase()} ${action.amount?.toFixed(2)} {action.token}
                                      </span>
                                      {action.fromChain && action.toChain && action.fromChain !== action.toChain && (
                                        <div className="text-xs text-gray-400">
                                          {action.fromChain} → {action.toChain}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ArcRouteIndicator isArcRoute={action.isArcRoute || false} />
                                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                                      action.status === 'executed' ? 'bg-green-500/20 text-green-300' :
                                      action.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                                      action.status === 'quoted' ? 'bg-blue-500/20 text-blue-300' :
                                      'bg-gray-500/20 text-gray-300'
                                    }`}>
                                      {action.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Arc stats if available */}
                            {result.data.arcStats && (
                              <ArcStatsDisplay stats={result.data.arcStats} />
                            )}
                          </div>
                        ) : result.data.type === 'cross_chain_swap' && result.data.arcPowered ? (
                          <div className="space-y-4">
                            <ArcBadge
                              isArcRoute={true}
                              size="md"
                              showDetails={true}
                              sourceChain={result.data.route?.split('→')?.[0]?.trim()}
                              destinationChain={result.data.route?.split('→')?.[1]?.trim()}
                              estimatedTime={result.data.estimatedTime}
                            />
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-bold ${result.data.status === 'EXECUTED' ? 'text-green-400' : 'text-blue-400'}`}>
                                {result.data.status}
                              </span>
                              {result.data.transactionHash && (
                                <span className="text-xs text-gray-400 font-mono">TX: {result.data.transactionHash.slice(0, 14)}...</span>
                              )}
                            </div>
                            {result.data.steps && (
                              <div className="space-y-1">
                                {result.data.steps.map((step: string, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                                    <ArcRouteIndicator isArcRoute={true} />
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <pre className="text-xs text-gray-300 font-mono overflow-x-auto mt-2">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
        </div>
      </div>
    </div>
  );
};
