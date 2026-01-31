import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AGENTS, INITIAL_LOGS, AGENT_ABILITIES } from './constants';
import { AgentMetadata, LogMessage, AgentTaskResult } from './types';
import UserBar from './components/UserBar';
import FlowCanvas from './components/FlowCanvas';
import AgentCard from './components/AgentCard';
import ConsolePanel from './components/ConsolePanel';
import AgentDetailPanel from './components/AgentDetailPanel';
import { AgentDialogue } from './components/AgentDialogue';
import { OperationsDashboard } from './components/OperationsDashboard';
import { AgentProgressBar } from './components/AgentProgressBar';
import { CaptainControlPanel } from './components/CaptainControlPanel';
import LandingPage from './components/LandingPage';
import { Activity } from 'lucide-react';
import { orchestrator, agentStatusManager, geminiService } from './services/api';
import { authService } from './services/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast-custom.css';

const App: React.FC = () => {
  // Auto-create guest session on first load
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      authService.loginAsGuest();
    }
  }, []);

  const [showLanding, setShowLanding] = useState<boolean>(true);
  
  // --- State ---
  const [activeAgents, setActiveAgents] = useState<string[]>(() => {
    const stored = localStorage.getItem('activeAgents');
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>(INITIAL_LOGS);
  const [streamingEdges, setStreamingEdges] = useState<string[]>([]);
  const [persistentEdges, setPersistentEdges] = useState<Array<{source: string, target: string}>>(() => {
    const saved = localStorage.getItem('agentConnections');
    return saved ? JSON.parse(saved) : [];
  });
  const [agentStatuses, setAgentStatuses] = useState<Record<string, 'idle' | 'negotiating' | 'streaming' | 'offline'>>({});
  const [activeDialogue, setActiveDialogue] = useState<{
    agentId: string;
    dialogue: string;
  } | null>(null);
  
  // Random dialogue bubbles for active agents
  const [randomDialogues, setRandomDialogues] = useState<Record<string, {
    dialogue: string;
    timestamp: number;
  }>>({});
  
  const [taskResults, setTaskResults] = useState<AgentTaskResult[]>(() => {
    const stored = localStorage.getItem('taskResults');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [showOperationsDashboard, setShowOperationsDashboard] = useState(false);
  const [agentPositions, setAgentPositions] = useState<Record<string, { x: number; y: number }>>({});
  
  // --- Mode Control State ---
  const [operationMode, setOperationMode] = useState<'auto' | 'manual'>(() => {
    const saved = localStorage.getItem('operationMode');
    return (saved === 'auto' || saved === 'manual') ? saved : 'manual';
  });
  
  // --- Agent Task Progress Tracking ---
  const [agentProgress, setAgentProgress] = useState<Record<string, {
    isActive: boolean;
    progress: number;
    task: string;
    startTime: number;
  }>>({});
  
  // --- Commander Custom Order ---
  const [commanderCustomOrder, setCommanderCustomOrder] = useState<string>('');
  
  // --- Persist taskResults to localStorage ---
  useEffect(() => {
    localStorage.setItem('taskResults', JSON.stringify(taskResults));
  }, [taskResults]);
  
  // Persist operation mode
  useEffect(() => {
    localStorage.setItem('operationMode', operationMode);
  }, [operationMode]);

  // --- Memoized callback for closing dialogue ---
  const handleCloseDialogue = useCallback(() => {
    setActiveDialogue(null);
  }, []);

  // --- Memoized callback for node position changes ---
  const handleNodePositionsChange = useCallback((positions: Record<string, { x: number; y: number }>) => {
    setAgentPositions(positions);
  }, []);

  // --- Memoized callback for edge changes ---
  const handleEdgesChange = useCallback((edges: any[]) => {
    setPersistentEdges(edges);
    localStorage.setItem('agentConnections', JSON.stringify(edges));
  }, []);

  // --- Initialization: Check API Status ---
  useEffect(() => {
    const checkAPIs = async () => {
      addLog('SYSTEM', '🚀 LI.FI Agents Orchestrator Initializing...');
      addLog('SYSTEM', '🌐 Connecting to LI.FI SDK...');
      
      setTimeout(() => {
        addLog('SYSTEM', '✅ Gemini AI: Ready for agent intelligence');
        addLog('SYSTEM', '✅ LI.FI SDK: Ready for cross-chain routing');
        addLog('SYSTEM', '✅ AI Network: Online and operational');
        addLog('SYSTEM', '🌐 Cross-chain systems ready. Agents standing by.');
      }, 1000);
    };
    
    checkAPIs();
  }, []);

  // Persist active agents
  useEffect(() => {
    localStorage.setItem('activeAgents', JSON.stringify(activeAgents));
  }, [activeAgents]);

  // Random dialogue generator - makes agents chat periodically
  useEffect(() => {
    if (activeAgents.length === 0) return;

    const showRandomDialogue = () => {
      // Pick a random active agent
      const randomIndex = Math.floor(Math.random() * activeAgents.length);
      const agentId = activeAgents[randomIndex];
      const agent = AGENTS.find(a => a.id === agentId);
      
      if (!agent || !agent.personality?.dialogues) return;
      
      // Pick a random dialogue from the agent's personality
      const dialogues = agent.personality.dialogues;
      const randomDialogue = dialogues[Math.floor(Math.random() * dialogues.length)];
      
      // Show dialogue bubble
      setRandomDialogues(prev => ({
        ...prev,
        [agentId]: {
          dialogue: randomDialogue,
          timestamp: Date.now()
        }
      }));
      
      // Auto-hide after 5-8 seconds
      const hideDelay = 5000 + Math.random() * 3000;
      setTimeout(() => {
        setRandomDialogues(prev => {
          const newDialogues = { ...prev };
          delete newDialogues[agentId];
          return newDialogues;
        });
      }, hideDelay);
    };

    // Show dialogues at random intervals (8-20 seconds)
    const interval = setInterval(() => {
      if (Math.random() > 0.2) { // 80% chance to show dialogue
        showRandomDialogue();
      }
    }, 8000 + Math.random() * 12000);

    // Initial dialogue after short delay
    const initialTimeout = setTimeout(showRandomDialogue, 3000 + Math.random() * 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [activeAgents]);

  // Log helper
  const addLog = useCallback((agent: string, message: string) => {
    const newLog: LogMessage = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: agent === 'SYSTEM' ? 'SYSTEM' : agent === 'COMMANDER' ? 'COMMANDER' : 'A2A',
      content: message
    };
    setLogs(prev => [...prev.slice(-99), newLog]);
  }, []);

  // Activate agent
  const handleActivateAgent = useCallback((agentId: string) => {
    if (activeAgents.includes(agentId)) {
      toast.info('Agent is already active');
      return;
    }

    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;

    addLog('SYSTEM', `🤖 Activating ${agent.name}...`);
    
    // Simulate agent activation
    setTimeout(() => {
      setActiveAgents(prev => [...prev, agentId]);
      setAgentStatuses(prev => ({ ...prev, [agentId]: 'idle' }));
      addLog(agent.name, `✅ ${agent.name} is now online and ready!`);
      
      // Random personality dialogue
      if (agent.personality?.dialogues) {
        const randomDialogue = agent.personality.dialogues[Math.floor(Math.random() * agent.personality.dialogues.length)];
        setTimeout(() => addLog(agent.name, randomDialogue), 1000);
      }
      
      toast.success(`${agent.name} activated!`);
    }, 1500);
  }, [activeAgents, addLog]);

  // Deactivate agent
  const handleDeactivateAgent = useCallback((agentId: string) => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;

    addLog('SYSTEM', `🔌 Deactivating ${agent.name}...`);
    
    setTimeout(() => {
      setActiveAgents(prev => prev.filter(id => id !== agentId));
      addLog(agent.name, `👋 ${agent.name} has gone offline.`);
      toast.info(`${agent.name} deactivated`);
    }, 1000);
  }, [addLog]);

  // Delete agent
  const handleDeleteAgent = useCallback((agentId: string) => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;

    addLog('SYSTEM', `🗑️ Removing ${agent.name} from the orchestrator...`);
    setActiveAgents(prev => prev.filter(id => id !== agentId));
    addLog('SYSTEM', `✅ ${agent.name} has been removed from the team.`);
    toast.success(`${agent.name} removed successfully`);
  }, [addLog]);

  // Execute agent task (AI-powered)
  const executeAgentTask = useCallback(async (agentId: string, taskDescription?: string) => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;

    // Update progress tracking
    setAgentProgress(prev => ({
      ...prev,
      [agentId]: {
        isActive: true,
        progress: 0,
        task: taskDescription || `Executing ${agent.role}`,
        startTime: Date.now()
      }
    }));

    addLog(agent.name, `🎯 Starting task: ${taskDescription || agent.role}`);
    
    // Show dialogue
    const dialogues = agent.personality?.dialogues || [];
    const dialogue = dialogues[Math.floor(Math.random() * dialogues.length)] || 'Processing...';
    setActiveDialogue({ agentId, dialogue });

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAgentProgress(prev => {
        const current = prev[agentId];
        if (!current || current.progress >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return {
          ...prev,
          [agentId]: {
            ...current,
            progress: Math.min(current.progress + Math.random() * 20, 90)
          }
        };
      });
    }, 500);

    try {
      // Call appropriate service based on agent role
      let result: any = {};
      let taskType: AgentTaskResult['taskType'] = 'custom_order';
      let summary = '';
      
      if (agent.role === 'Navigator') {
        // Arbitrage Hunter - Price monitoring
        const analysis = await geminiService.chat({
          prompt: `As Arbitrage Hunter, analyze cross-chain price differences. Provide a brief opportunity report focusing on: ${taskDescription || 'USDC price differences between Ethereum and Arbitrum'}`
        });
        result = { 
          type: 'arbitrage_detection', 
          opportunities: ['USDC 0.5% cheaper on Arbitrum', 'ETH price gap detected', 'Triangular arbitrage possible'],
          profit: '$450',
          analysis: analysis.text 
        };
        taskType = 'arbitrage_detection';
        summary = `Detected 3 arbitrage opportunities: ${taskDescription || 'USDC price gap, ETH difference, triangular arb'}`;
      } else if (agent.role === 'Archivist') {
        // Portfolio Guardian - Position tracking
        const analysis = await geminiService.chat({
          prompt: `As Portfolio Guardian, analyze cross-chain positions for: ${taskDescription || 'current portfolio allocation across chains'}. Provide position summary and PnL analysis.`
        });
        result = { 
          type: 'position_monitoring', 
          positions: 12,
          totalValue: '$5,000',
          pnl: '+$250',
          analysis: analysis.text,
          chains: ['Ethereum', 'Arbitrum', 'Polygon']
        };
        taskType = 'position_monitoring';
        summary = `Tracked ${taskDescription || '12 positions across 3 chains - Total value: $5,000, PnL: +$250'}`;
      } else if (agent.role === 'Oracle') {
        // Rebalancer - Allocation management
        const analysis = await geminiService.chat({
          prompt: `As Rebalancer, analyze portfolio allocation drift: ${taskDescription || 'current allocation vs target allocation'}`
        });
        result = { 
          type: 'rebalancing', 
          drift: '10%',
          current: { ETH: 60, USDC: 40 },
          target: { ETH: 50, USDC: 50 },
          recommendation: 'Rebalance needed',
          analysis: analysis.text 
        };
        taskType = 'rebalancing';
        summary = `Rebalancing needed: ${taskDescription || 'Portfolio drift detected - 10% deviation from target'}`;
      } else if (agent.role === 'Merchant') {
        // Yield Seeker - Yield optimization
        const analysis = await geminiService.chat({
          prompt: `As Yield Seeker, find best yield opportunities: ${taskDescription || 'scan for highest APY across all chains'}`
        });
        result = { 
          type: 'yield_optimization',
          opportunities: ['Aave on Arbitrum: 12% APY', 'Compound on Polygon: 15% APY'],
          bestYield: '15%',
          analysis: analysis.text 
        };
        taskType = 'yield_optimization';
        summary = `Found yield opportunities: ${taskDescription || 'Best yield: 15% APY on Polygon Compound'}`;
      } else if (agent.role === 'Sentinel') {
        // Risk Sentinel - Route validation
        const analysis = await geminiService.chat({
          prompt: `As Risk Sentinel, analyze LI.FI route safety: ${taskDescription || 'validate cross-chain route for slippage and bridge security'}`
        });
        result = { 
          type: 'risk_analysis',
          riskScore: 25,
          status: 'SAFE',
          slippage: '0.5%',
          analysis: analysis.text 
        };
        taskType = 'risk_analysis';
        summary = `Route validated: ${taskDescription || 'Risk score: 25/100 - Route safe for execution'}`;
      } else if (agent.role === 'Glitch') {
        // Route Executor - Execution
        result = { 
          type: 'cross_chain_swap',
          route: 'ETH→ARB via LI.FI',
          status: 'EXECUTING',
          estimatedTime: '2 minutes'
        };
        taskType = 'cross_chain_swap';
        summary = `⚡ Executing route: ${taskDescription || 'ETH→ARB via LI.FI - Estimated time: 2 minutes'}`;
      } else {
        // Route Strategist - Strategic coordination
        const analysis = await geminiService.chat({
          prompt: `As Route Strategist, coordinate cross-chain strategy: ${taskDescription || 'analyze market conditions and coordinate team operations'}`
        });
        result = { 
          type: 'strategy_coordination', 
          priority: 'High',
          teamAllocated: 6,
          strategy: analysis.text 
        };
        summary = `Strategic coordination: ${taskDescription || 'Deployed all 6 agents - prioritized arbitrage opportunity - team synchronized'}`;
      }

      // Complete progress
      setAgentProgress(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          progress: 100,
          isActive: false
        }
      }));

      // Save result
      const taskResult: AgentTaskResult = {
        agentId,
        agentName: agent.name,
        taskType,
        timestamp: Date.now(),
        status: 'success',
        data: result,
        summary
      };

      setTaskResults(prev => [taskResult, ...prev].slice(0, 50));
      addLog(agent.name, `✅ ${summary}`);
      
      // Clear dialogue after delay
      setTimeout(() => setActiveDialogue(null), 2000);
      
      toast.success(`${agent.name}: Mission complete!`);
    } catch (error) {
      console.error('Task execution error:', error);
      addLog('ERROR', `❌ ${agent.name} task failed: ${error}`);
      
      setAgentProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[agentId];
        return newProgress;
      });
      
      toast.error(`Task failed for ${agent.name}`);
    }
  }, [addLog]);

  // Handle logout
  const handleLogout = useCallback(() => {
    authService.logout();
    authService.loginAsGuest();
    setShowLanding(true);
    toast.info('Logged out - new guest session created');
  }, []);

  const handleLaunchApp = useCallback(() => {
    setShowLanding(false);
  }, []);

  const handleBackToLanding = useCallback(() => {
    setShowLanding(true);
  }, []);

  // Persist active agents
  useEffect(() => {
    localStorage.setItem('activeAgents', JSON.stringify(activeAgents));
  }, [activeAgents]);

  // Commander orchestration
  const handleCommanderAction = useCallback(async (customOrder?: string) => {
    if (operationMode !== 'auto') {
      toast.info('Switch to AUTO mode for Route Strategist orchestration');
      return;
    }

    const commander = AGENTS.find(a => a.id === 'a0');
    if (!commander || !activeAgents.includes('a0')) {
      toast.error('Route Strategist must be active for orchestration');
      return;
    }

    addLog(commander.name, '👑 Initiating strategic cross-chain coordination...');
    
    const order = customOrder || 'Assess current cross-chain opportunities and deploy team resources optimally';
    
    // Execute commander's analysis
    await executeAgentTask('a0', order);
    
    // Coordinate other active agents
    const otherAgents = activeAgents.filter(id => id !== 'a0');
    if (otherAgents.length > 0) {
      addLog(commander.name, `Deploying ${otherAgents.length} specialized agents to cross-chain positions...`);
      
      for (const agentId of otherAgents.slice(0, 3)) {
        const agent = AGENTS.find(a => a.id === agentId);
        if (agent) {
          const roleOrders: Record<string, string> = {
            'Navigator': 'Scan for arbitrage opportunities across all chains',
            'Archivist': 'Track all cross-chain positions and calculate PnL',
            'Merchant': 'Find best yield opportunities across protocols',
            'Sentinel': 'Validate route safety for upcoming executions',
            'Oracle': 'Monitor portfolio allocations and detect drift',
            'Glitch': 'Prepare LI.FI routes for rapid execution'
          };
          setTimeout(() => {
            executeAgentTask(agentId, roleOrders[agent.role] || `Execute ${agent.role} cross-chain protocols`);
          }, Math.random() * 2000);
        }
      }
    }
  }, [operationMode, activeAgents, executeAgentTask, addLog]);

  // Get selected agent
  const selectedAgent = selectedAgentId ? AGENTS.find(a => a.id === selectedAgentId) || null : null;

  // Main app UI
  const mainApp = (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Top Bar */}
      <UserBar onLogoClick={handleBackToLanding} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-black/40 backdrop-blur-sm border-r border-white/10 flex flex-col overflow-hidden">
          {/* Mode Control */}
          <div className="p-4 border-b border-white/10">
            <CaptainControlPanel
              mode={operationMode}
              onModeChange={setOperationMode}
            />
          </div>

          {/* Agent Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {AGENTS.map((agent) => {
              const isActive = activeAgents.includes(agent.id);
              const status = agentStatuses[agent.id] || (isActive ? 'idle' : 'offline');
              const progress = agentProgress[agent.id];

              return (
                <div key={agent.id} className="relative">
                  <AgentCard
                    agent={agent}
                    isActive={isActive}
                    status={status}
                    onClick={() => setSelectedAgentId(agent.id)}
                    onToggle={() => {
                      if (isActive) {
                        handleDeactivateAgent(agent.id);
                      } else {
                        handleActivateAgent(agent.id);
                      }
                    }}
                    isAutoMode={operationMode === 'auto'}
                    customOrder={agent.id === 'a0' ? commanderCustomOrder : undefined}
                    onCustomOrderChange={agent.id === 'a0' ? setCommanderCustomOrder : undefined}
                  />
                  {progress?.isActive && (
                    <AgentProgressBar
                      agentName={agent.name}
                      progress={progress.progress}
                      task={progress.task}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Operations Dashboard */}
          {taskResults.length > 0 && (
            <div className="p-4 border-t border-white/10">
              <div className="bg-gradient-to-r from-neon-green/10 via-blue-500/10 to-purple-500/10 border border-neon-green/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-neon-green uppercase tracking-wider">Operations</span>
                  <span className="text-neon-green font-bold font-mono">{taskResults.length} tasks</span>
                </div>
                <button
                  onClick={() => setShowOperationsDashboard(true)}
                  className="w-full bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/30 text-neon-green font-semibold py-2.5 px-4 rounded transition-all flex items-center justify-center gap-2 text-sm font-mono"
                >
                  <Activity size={16} />
                  VIEW DASHBOARD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: Flow Canvas & Console */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Canvas */}
          <div className="flex-1 relative">
            <FlowCanvas
              agents={AGENTS}
              activeAgents={activeAgents}
              selectedAgentId={selectedAgentId}
              onAgentSelect={setSelectedAgentId}
              streamingEdges={streamingEdges}
              persistentEdges={persistentEdges}
              onEdgesChange={handleEdgesChange}
              agentStatuses={agentStatuses}
              onNodePositionsChange={handleNodePositionsChange}
              randomDialogues={randomDialogues}
            />

            {/* Dialogue Overlay */}
            {activeDialogue && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
                <AgentDialogue
                  agent={AGENTS.find(a => a.id === activeDialogue.agentId)!}
                  dialogue={activeDialogue.dialogue}
                  onClose={handleCloseDialogue}
                />
              </div>
            )}
          </div>

          {/* Console */}
          <div className="h-48 z-30">
            <ConsolePanel logs={logs} />
          </div>
        </div>

        {/* Right Sidebar: Details Panel */}
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgentId(null)}
          onActivate={handleActivateAgent}
          onDeactivate={handleDeactivateAgent}
          onExecuteTask={executeAgentTask}
          onDeleteAgent={handleDeleteAgent}
          isActive={selectedAgent ? activeAgents.includes(selectedAgent.id) : false}
        />

        {/* Floating Action Button - Operations Dashboard */}
        {taskResults.length > 0 && !showOperationsDashboard && (
          <div className="absolute bottom-6 right-6 z-40">
            <button
              onClick={() => setShowOperationsDashboard(true)}
              className="group bg-gradient-to-r from-neon-green to-blue-500 hover:from-neon-green/90 hover:to-blue-500/90 text-black font-bold px-6 py-3 rounded-full shadow-2xl shadow-neon-green/50 transition-all hover:scale-105 flex items-center gap-2 font-mono"
              title="View Operations Dashboard"
            >
              <Activity size={20} className="animate-pulse" />
              <span>OPERATIONS</span>
              <span className="bg-black/30 text-white px-2 py-0.5 rounded-full text-xs">
                {taskResults.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Operations Dashboard */}
      {showOperationsDashboard && (
        <OperationsDashboard
          agents={AGENTS}
          results={taskResults}
          onBack={() => setShowOperationsDashboard(false)}
          activeAgents={activeAgents}
          agentConnections={persistentEdges}
          agentStatuses={agentStatuses}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );

  // Show landing page on first visit
  if (showLanding) {
    return <LandingPage onLaunchApp={handleLaunchApp} />;
  }

  return mainApp;
};

export default App;
