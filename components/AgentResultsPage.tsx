import React, { useState } from 'react';
import { AgentTaskResult, AgentMetadata } from '../types';
import { TrendingUp, TrendingDown, Shield, Search, Target, Zap, Clock, CheckCircle, XCircle, AlertCircle, DollarSign, Activity, Server, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { AGENT_ABILITIES } from '../constants';
import LottieAvatar from './LottieAvatar';

interface AgentResultsPageProps {
  agents: AgentMetadata[];
  results: AgentTaskResult[];
  onBack: () => void;
  onClearResults?: () => void;
  activeAgents?: string[]; // IDs of currently active agents on canvas
  agentConnections?: Array<{source: string, target: string}>; // Canvas connections
}

export const AgentResultsPage: React.FC<AgentResultsPageProps> = ({ 
  agents, 
  results, 
  onBack, 
  onClearResults,
  activeAgents = [],
  agentConnections = []
}) => {
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

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

  const getTaskIcon = (taskType: AgentTaskResult['taskType']) => {
    switch (taskType) {
      case 'fraud_detection': return <Shield className="w-5 h-5" />;
      case 'pattern_analysis': return <Search className="w-5 h-5" />;
      case 'database_search': return <Search className="w-5 h-5" />;
      case 'verification': return <CheckCircle className="w-5 h-5" />;
      case 'user_assistance': return <TrendingUp className="w-5 h-5" />;
      case 'education': return <Target className="w-5 h-5" />;
      case 'alert_broadcast': return <Zap className="w-5 h-5" />;
      case 'strategic_command': return <Target className="w-5 h-5" />;
      case 'custom_order': return <Zap className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getTaskName = (taskType: AgentTaskResult['taskType']) => {
    switch (taskType) {
      case 'fraud_detection': return 'Fraud Detection';
      case 'pattern_analysis': return 'Pattern Analysis';
      case 'database_search': return 'Database Search';
      case 'verification': return 'Verification Check';
      case 'user_assistance': return 'User Protection';
      case 'education': return 'Scam Education';
      case 'alert_broadcast': return 'Emergency Alert';
      case 'strategic_command': return 'Strategic Command';
      case 'custom_order': return 'Custom Operation';
      default: return taskType.replace(/_/g, ' ').toUpperCase();
    }
  };

  const getStatusBadge = (status: AgentTaskResult['status']) => {
    switch (status) {
      case 'success': 
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-xs font-mono">
            <CheckCircle className="w-3 h-3" />
            <span>SUCCESS</span>
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
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-xs font-mono">
            <AlertCircle className="w-3 h-3" />
            <span>PENDING</span>
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

  const getAgentById = (agentId: string) => {
    return agents.find(a => a.id === agentId);
  };

  // Get agent's primary task specialization from config
  const getAgentSpecialization = (agent: any) => {
    const ability = AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES];
    if (ability) {
      const apis = ability.apis.length > 0 ? ` (${ability.apis.join(', ')})` : '';
      return `${ability.primary}${apis}`;
    }
    return agent.description;
  };

  // Get agent's operations list
  const getAgentOperations = (agentId: string) => {
    const ability = AGENT_ABILITIES[agentId as keyof typeof AGENT_ABILITIES];
    return ability?.operations || [];
  };

  // Determine who ordered this task (Captain or upstream agent)
  const getTaskOrderSource = (agentId: string) => {
    const incoming = agentConnections.filter(c => c.target === agentId);
    if (incoming.length === 0) return null;
    const sourceAgent = agents.find(a => a.id === incoming[0].source);
    return sourceAgent;
  };

  // Get specific order/mission from Captain for each agent
  const getCaptainOrder = (agentId: string) => {
    const ability = AGENT_ABILITIES[agentId as keyof typeof AGENT_ABILITIES];
    if (!ability) return null;

    const orders: { [key: string]: string } = {
      'a0': `"Coordinate all fraud defense operations using ${ability.apis.join(' & ')}. Prioritize threats, allocate team resources, and maintain strategic oversight of scam prevention network."`,
      'a1': `"Scan for emerging fraud patterns using ${ability.apis.join(' & ')}. Monitor SMS scams, LINE impersonation, QR code frauds, and fake banking alerts. Report new threat patterns immediately."`,
      'a2': `"Search intelligence database for pattern matches using ${ability.apis.join(' & ')}. Cross-reference suspicious activity with historical fraud cases. Provide similarity scores and case recommendations."`,
      'a3': `"Assist citizens with scam verification using ${ability.apis.join(' & ')}. Analyze suspicious SMS, emails, and calls. Provide instant protection guidance and friendly fraud prevention advice."`,
      'a4': `"Create fraud awareness content using ${ability.apis.join(' & ')}. Develop interactive training, educational videos, infographics, and scam simulations. Make fraud prevention engaging and viral."`,
      'a5': `"Protect businesses from BEC and invoice fraud using ${ability.apis.join(' & ')}. Verify email authenticity, analyze invoices, detect domain spoofing, and prevent wire transfer scams."`,
      'a6': `"Broadcast emergency fraud alerts using ${ability.apis.join(' & ')}. Deliver multi-channel warnings via SMS, LINE, Email, and push notifications. Lightning-fast threat distribution to protect citizens."`
    };

    return orders[agentId] || null;
  };

  const calculateMetrics = (agentResults: AgentTaskResult[]) => {
    const successCount = agentResults.filter(r => r.status === 'success').length;
    const estimatedCost = agentResults.length * 0.001; // Estimate $0.001 per task
    const avgResponseTime = Math.floor(Math.random() * 2000) + 500; // Mock response time
    
    return {
      successRate: agentResults.length > 0 ? (successCount / agentResults.length * 100).toFixed(1) : '0',
      totalCost: estimatedCost.toFixed(4),
      avgResponseTime: avgResponseTime.toFixed(0),
      totalTasks: agentResults.length
    };
  };

  // Filter results to only show active agents
  const activeResults = activeAgents.length > 0 
    ? results.filter(r => activeAgents.includes(r.agentId))
    : results;

  // Group results by agent
  const resultsByAgent = activeResults.reduce((acc, result) => {
    if (!acc[result.agentId]) {
      acc[result.agentId] = [];
    }
    acc[result.agentId].push(result);
    return acc;
  }, {} as Record<string, AgentTaskResult[]>);

  // Determine if agent is Captain
  const isCaptain = (agentId: string) => agentId === 'a0';

  // Get agents connected to this agent
  const getConnectedAgents = (agentId: string) => {
    const outgoing = agentConnections
      .filter(c => c.source === agentId)
      .map(c => agents.find(a => a.id === c.target))
      .filter(Boolean);
    const incoming = agentConnections
      .filter(c => c.target === agentId)
      .map(c => agents.find(a => a.id === c.source))
      .filter(Boolean);
    return { outgoing, incoming };
  };

  // Sort agents: Captain first, then by activity
  const sortedAgentIds = Object.keys(resultsByAgent).sort((a, b) => {
    if (a === 'a0') return -1;
    if (b === 'a0') return 1;
    return resultsByAgent[b].length - resultsByAgent[a].length;
  });

  // Parse and format data based on task type
  const renderTaskData = (result: AgentTaskResult, isExpanded: boolean) => {
    if (!result.data) return null;

    try {
      const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;

      // Sentiment Analysis
      if (result.taskType === 'sentiment_analysis' && data.articles) {
        const articles = data.articles.slice(0, isExpanded ? undefined : 3);
        return (
          <div className="space-y-3">
            {articles.map((article: any, idx: number) => (
              <div key={idx} className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="text-white font-medium text-sm flex-1">{article.title}</h4>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${
                    article.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
                    article.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {article.sentiment}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mb-2">{article.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="font-mono">{article.source}</span>
                  <span>•</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  {article.url && (
                    <>
                      <span>•</span>
                      <a href={article.url} target="_blank" rel="noopener noreferrer" 
                         className="text-neon-green hover:underline flex items-center gap-1">
                        Read <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!isExpanded && data.articles.length > 3 && (
              <div className="text-center text-xs text-gray-500">
                +{data.articles.length - 3} more articles
              </div>
            )}
          </div>
        );
      }

      // Market Research - Price data with proper formatting
      if (result.taskType === 'market_research' && data.price) {
        const priceDisplay = data.price < 1 
          ? `$${data.price.toFixed(6)}` 
          : `$${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const changeAmount = data.price * (data.changePercent / 100);
        const volumeDisplay = typeof data.volume === 'string' ? data.volume : `$${(data.volume / 1e9).toFixed(2)}B`;
        const marketCapDisplay = typeof data.marketCap === 'string' ? data.marketCap : `$${(data.marketCap / 1e9).toFixed(2)}B`;
        
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900/50 border border-neon-green/30 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1 font-mono">CURRENT PRICE</div>
                <div className="text-2xl font-bold text-neon-green font-mono">{priceDisplay}</div>
                <div className="text-xs text-gray-500 mt-1 font-mono">{data.asset || data.symbol}/USD</div>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1 font-mono">24H CHANGE</div>
                <div className={`text-2xl font-bold font-mono ${data.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                </div>
                <div className={`text-xs mt-1 font-mono ${data.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${data.changePercent >= 0 ? '+' : ''}{changeAmount.toFixed(2)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 font-mono">24H VOLUME</div>
                <div className="text-lg font-mono text-white">{volumeDisplay}</div>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 font-mono">MARKET CAP</div>
                <div className="text-lg font-mono text-white">{marketCapDisplay}</div>
              </div>
            </div>

            {(data.high24h || data.low24h) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1 font-mono">24H HIGH</div>
                  <div className="text-sm font-mono text-green-400">
                    ${data.high24h < 1 ? data.high24h.toFixed(6) : data.high24h?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1 font-mono">24H LOW</div>
                  <div className="text-sm font-mono text-red-400">
                    ${data.low24h < 1 ? data.low24h.toFixed(6) : data.low24h?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-neon-green font-mono mb-1">
                <Activity className="w-3 h-3" />
                <span>DATA SOURCE</span>
              </div>
              <div className="text-xs text-gray-400">{data.dataSource || 'AI-powered fraud analysis from Gemini'}</div>
            </div>
          </div>
        );
      }

      // Default: show formatted JSON for other types
      return (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
          <pre className="text-xs text-gray-300 overflow-x-auto font-mono whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
    } catch (e) {
      return (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
          <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
            {String(result.data)}
          </pre>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] text-white overflow-hidden flex flex-col">
      <div className="flex-shrink-0 p-6 bg-[#050505] border-b border-white/10">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <button
            onClick={onBack}
            className="mb-6 px-4 py-2 bg-black hover:bg-gray-900 border border-neon-green text-neon-green rounded font-mono text-sm transition-all hover:shadow-[0_0_15px_rgba(67,255,77,0.3)] flex items-center gap-2"
          >
            ← BACK TO GRID
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-neon-green mb-2 font-mono">AGENT OPERATIONS REPORT</h1>
              <p className="text-gray-400 font-mono text-sm">
                {activeAgents.length > 0 
                  ? `Monitoring ${activeAgents.length} active agent${activeAgents.length > 1 ? 's' : ''} on canvas`
                  : 'Real-time intelligence from autonomous agents'}
              </p>
            </div>
            <div className="text-right flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4 text-right">
                <div>
                  <div className="text-xs text-gray-500 font-mono">ACTIVE AGENTS</div>
                  <div className="text-2xl font-bold text-neon-green font-mono">{activeAgents.length}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono">OPERATIONS</div>
                  <div className="text-2xl font-bold text-white font-mono">{activeResults.length}</div>
                </div>
              </div>
              {onClearResults && results.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all task results? This cannot be undone.')) {
                      onClearResults();
                    }
                  }}
                  className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-500/50 text-red-400 rounded font-mono text-xs transition-all hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                >
                  🗑️ CLEAR ALL
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Results Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6 p-6 pb-8">
        {sortedAgentIds.map((agentId) => {
          const agentResults = resultsByAgent[agentId];
          const agent = getAgentById(agentId);
          if (!agent) return null;
          
          const metrics = calculateMetrics(agentResults);
          // Use local animated avatar (same as AgentCard)
          const spriteUrl = agent.avatar;
          const connections = getConnectedAgents(agentId);
          const isAgentCaptain = isCaptain(agentId);

          return (
            <div key={agentId} className={`bg-black/60 backdrop-blur-sm border rounded-xl overflow-hidden ${
              isAgentCaptain 
                ? 'border-yellow-500/50 shadow-[0_0_25px_rgba(234,179,8,0.15)]'
                : 'border-neon-green/30 shadow-[0_0_20px_rgba(67,255,77,0.1)]'
            }`}>
              {/* Agent Header */}
              <div className={`bg-gradient-to-r border-b p-6 ${
                isAgentCaptain
                  ? 'from-yellow-500/10 to-transparent border-yellow-500/20'
                  : 'from-neon-green/10 to-transparent border-neon-green/20'
              }`}>
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-16 h-16 rounded-lg border-2 overflow-hidden ${
                        isAgentCaptain ? 'border-yellow-500/50' : 'border-neon-green/50'
                      }`}>
                      {agent.avatarType === 'lottie' ? (
                        <LottieAvatar 
                          animationPath={spriteUrl}
                          width={64}
                          height={64}
                          className="w-full h-full"
                        />
                      ) : (
                        <img 
                          src={spriteUrl} 
                          alt={agent.name} 
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className={`text-2xl font-bold font-mono ${
                          isAgentCaptain ? 'text-yellow-500' : 'text-neon-green'
                        }`}>
                          {agent.name}
                        </h2>
                        {isAgentCaptain ? (
                          <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-500 text-xs font-mono">
                            👑 CAPTAIN
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-neon-green/20 border border-neon-green/50 rounded text-neon-green text-xs font-mono">
                            ⛓️ ON-CHAIN
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-1 font-bold">{agent.role}</p>
                      <p className="text-gray-500 text-xs mb-2 font-mono">{getAgentSpecialization(agent)}</p>
                      {getAgentOperations(agent.id).length > 0 && (
                        <div className="flex items-start gap-2 mb-3 text-xs">
                          <span className="text-gray-500 font-mono">OPERATIONS:</span>
                          <div className="flex flex-wrap gap-1">
                            {getAgentOperations(agent.id).map((op, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400 font-mono">
                                {op}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* API Integrations */}
                      {AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES]?.apis && 
                       AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES].apis.length > 0 && (
                        <div className="flex items-start gap-2 mb-3 text-xs">
                          <span className="text-gray-500 font-mono">APIs:</span>
                          <div className="flex flex-wrap gap-1">
                            {AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES].apis.map((api: string, idx: number) => (
                              <span 
                                key={idx} 
                                className="px-1.5 py-0.5 bg-neon-green/10 border border-neon-green/30 rounded text-neon-green font-mono hover:bg-neon-green/20 transition-colors"
                                title={AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES].apiEndpoints?.[api] || api}
                              >
                                ⚡ {api}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-neon-green" />
                          <span className="text-gray-500">TS:</span>
                          <span className="text-white">{agent.trustScore}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">TOKEN:</span>
                          <span className="text-white">#{agent.tokenId}</span>
                        </div>
                        {connections.incoming.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">←</span>
                            <span className="text-blue-400">{connections.incoming.length} upstream</span>
                          </div>
                        )}
                        {connections.outgoing.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">→</span>
                            <span className="text-purple-400">{connections.outgoing.length} downstream</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Show task order source and connections */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        {!isAgentCaptain && connections.incoming.length > 0 && (
                          <div className="mb-3 bg-blue-500/10 border border-blue-500/30 rounded p-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-blue-400 font-mono font-bold">📋 RECEIVES ORDERS FROM:</span>
                              {connections.incoming.map((conn: any, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 font-mono">
                                  {conn.name} {conn.id === 'a0' ? '👑' : ''}
                                </span>
                              ))}
                            </div>
                            {getCaptainOrder(agent.id) && (
                              <div className="text-xs text-blue-300 mt-2 font-mono italic bg-blue-500/5 p-2 rounded border-l-2 border-blue-500">
                                <div className="text-blue-400 font-bold mb-1">📜 MISSION ORDER:</div>
                                {getCaptainOrder(agent.id)}
                              </div>
                            )}
                          </div>
                        )}
                        {isAgentCaptain && connections.outgoing.length > 0 && (
                          <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-yellow-400 font-mono font-bold">⚡ COMMANDING AGENTS:</span>
                              {connections.outgoing.map((conn: any, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/50 rounded text-purple-400 font-mono">
                                  {conn.name}
                                </span>
                              ))}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 font-mono">
                              Orchestrating operations and coordinating agent activities
                            </div>
                          </div>
                        )}
                        {(connections.incoming.length > 0 || connections.outgoing.length > 0) && (
                          <div className="flex items-center gap-4 text-xs flex-wrap">
                            {connections.incoming.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-mono">RECEIVES FROM:</span>
                                {connections.incoming.map((conn: any, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 font-mono">
                                    {conn.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {connections.outgoing.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-mono">SENDS TO:</span>
                                {connections.outgoing.map((conn: any, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/50 rounded text-purple-400 font-mono">
                                    {conn.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Panel */}
                  <div className="grid grid-cols-4 gap-3 min-w-[400px]">
                    <div className="bg-black/50 border border-gray-700 rounded p-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <Activity className="w-3 h-3" />
                        <span>TASKS</span>
                      </div>
                      <div className="text-lg font-bold text-white font-mono">{metrics.totalTasks}</div>
                    </div>
                    <div className="bg-black/50 border border-gray-700 rounded p-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>SUCCESS</span>
                      </div>
                      <div className="text-lg font-bold text-green-400 font-mono">{metrics.successRate}%</div>
                    </div>
                    <div className="bg-black/50 border border-gray-700 rounded p-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <Clock className="w-3 h-3" />
                        <span>AVG TIME</span>
                      </div>
                      <div className="text-lg font-bold text-blue-400 font-mono">{metrics.avgResponseTime}ms</div>
                    </div>
                    <div className="bg-black/50 border border-gray-700 rounded p-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <DollarSign className="w-3 h-3" />
                        <span>COST</span>
                      </div>
                      <div className="text-lg font-bold text-yellow-400 font-mono">${metrics.totalCost}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Results */}
              <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                {agentResults.map((result, idx) => {
                  const globalIdx = results.indexOf(result);
                  const isExpanded = expandedResults.has(globalIdx);
                  
                  return (
                    <div 
                      key={globalIdx}
                      className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden hover:border-neon-green/30 transition-all"
                    >
                      {/* Task Header */}
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => toggleResult(globalIdx)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-gray-800 rounded text-neon-green">
                            {getTaskIcon(result.taskType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white font-mono text-sm">
                                {/* Use custom operation title if available, otherwise use default task name */}
                                {(result.data && typeof result.data === 'object' && 'operationTitle' in result.data) 
                                  ? (result.data as any).operationTitle 
                                  : getTaskName(result.taskType)}
                              </h3>
                              {getStatusBadge(result.status)}
                              <span className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 text-xs font-mono">
                                {agent.role}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs">{result.summary}</p>
                            <p className="text-gray-500 text-xs mt-1 italic">
                              Specialized {agent.role} operation using {agent.capabilities?.[0] || 'core capabilities'}
                            </p>
                            {/* Transaction Link for on-chain operations */}
                            {result.txUrl && (
                              <a 
                                href={result.txUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-neon-green hover:text-neon-green/80 mt-1 font-mono"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Transaction on HashScan
                              </a>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {result.txHash && (
                            <div className="flex items-center gap-1 text-xs bg-neon-green/10 px-2 py-1 rounded border border-neon-green/30">
                              <span className="text-gray-500 font-mono">TX:</span>
                              <span className="text-neon-green font-mono">{result.txHash.slice(0, 6)}...{result.txHash.slice(-4)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(result.timestamp)}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Task Data (Expandable) */}
                      {isExpanded && result.data && (
                        <div className="border-t border-gray-700 p-4">
                          {renderTaskData(result, isExpanded)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {sortedAgentIds.length === 0 && activeAgents.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-gray-400 mb-2 font-mono">NO AGENTS ACTIVE</h2>
            <p className="text-gray-500 font-mono text-sm">Activate agents on the canvas to see their operations...</p>
          </div>
        )}
        
        {sortedAgentIds.length === 0 && activeAgents.length > 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-gray-400 mb-2 font-mono">NO OPERATIONS YET</h2>
            <p className="text-gray-500 font-mono text-sm">
              {activeAgents.length} agent{activeAgents.length > 1 ? 's are' : ' is'} active. Waiting for task results...
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
