import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
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
import { IntentChat } from './components/IntentChat';
import { OneClickYield } from './components/OneClickYield';
import { ArbitrageExecutor } from './components/ArbitrageExecutor';
import { NotificationSettings } from './components/NotificationSettings';
import { TransactionHistory } from './components/TransactionHistory';
import { MultiWalletManager } from './components/MultiWalletManager';
import LandingPage from './components/LandingPage';
import { Activity, Zap, ArrowRightLeft, Bell, History, Wallet } from 'lucide-react';
import { orchestrator, agentStatusManager, geminiService } from './services/api';
import { authService } from './services/auth';
import { parseIntent } from './services/intentParser';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast-custom.css';

const App: React.FC = () => {
  // Wagmi wallet connection
  const { address: connectedAddress, isConnected } = useAccount();
  
  // Auto-create guest session on first load
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      authService.loginAsGuest();
    }
  }, []);

  // Auto-save connected wallet address for agents to use
  useEffect(() => {
    if (isConnected && connectedAddress) {
      localStorage.setItem('trackedWalletAddress', connectedAddress);
      addLog('SYSTEM', `🔗 Wallet connected: ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`);
    }
  }, [isConnected, connectedAddress]);

  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [rightPanelView, setRightPanelView] = useState<'chat' | 'yield' | 'arbitrage' | 'alerts' | 'history' | 'wallets'>('chat');
  
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
  
  // --- Intent Chat State ---
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    type: 'user' | 'system' | 'agent';
    content: string;
    timestamp: number;
    agentName?: string;
  }>>([]);
  const [isProcessingIntent, setIsProcessingIntent] = useState(false);
  
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
        // Arbitrage Hunter - Real price monitoring
        addLog(agent.name, '🔍 Fetching real-time prices across chains...');
        
        const { detectArbitrageOpportunities } = await import('./services/priceFetcher');
        const opportunities = await detectArbitrageOpportunities('USDC', 0.3, 1000);
        
        if (opportunities.length > 0) {
          const topOpportunity = opportunities[0];
          const analysis = await geminiService.chat({
            prompt: `As Arbitrage Hunter, analyze this real arbitrage opportunity: ${topOpportunity.tokenSymbol} price difference of ${topOpportunity.priceDifference.toFixed(2)}% between ${topOpportunity.fromChainName} ($${topOpportunity.fromPrice.toFixed(4)}) and ${topOpportunity.toChainName} ($${topOpportunity.toPrice.toFixed(4)}). Estimated profit: $${topOpportunity.profitAfterFees.toFixed(2)}. Provide a brief analysis.`
          });
          
          result = { 
            type: 'arbitrage_detection', 
            opportunities: opportunities.map(opp => 
              `${opp.tokenSymbol}: ${opp.priceDifference.toFixed(2)}% diff (${opp.fromChainName} → ${opp.toChainName}) - Profit: $${opp.profitAfterFees.toFixed(2)}`
            ),
            topOpportunity: {
              token: topOpportunity.tokenSymbol,
              fromChain: topOpportunity.fromChainName,
              toChain: topOpportunity.toChainName,
              priceDiff: `${topOpportunity.priceDifference.toFixed(2)}%`,
              profit: `$${topOpportunity.profitAfterFees.toFixed(2)}`,
              confidence: topOpportunity.confidence
            },
            profit: `$${topOpportunity.profitAfterFees.toFixed(2)}`,
            analysis: analysis.text,
            totalOpportunities: opportunities.length
          };
          taskType = 'arbitrage_detection';
          summary = `Detected ${opportunities.length} real arbitrage opportunities. Best: ${topOpportunity.priceDifference.toFixed(2)}% price difference (${topOpportunity.fromChainName} → ${topOpportunity.toChainName}) - Profit: $${topOpportunity.profitAfterFees.toFixed(2)}`;
        } else {
          // No opportunities found
          const analysis = await geminiService.chat({
            prompt: `As Arbitrage Hunter, report that no profitable arbitrage opportunities were found after scanning real prices across Ethereum, Arbitrum, Optimism, Polygon, and Base chains.`
          });
          result = { 
            type: 'arbitrage_detection', 
            opportunities: [],
            message: 'No profitable arbitrage opportunities found (after fees)',
            analysis: analysis.text 
          };
          taskType = 'arbitrage_detection';
          summary = `Scanned real prices across 5 chains. No profitable arbitrage opportunities found (price differences too small after fees).`;
        }
      } else if (agent.role === 'Archivist') {
        // Portfolio Guardian - Real position tracking
        addLog(agent.name, '🔍 Querying wallet balances across chains...');
        
        // Get wallet address from localStorage, wagmi connection, or use a default demo address
        let walletAddress = localStorage.getItem('trackedWalletAddress');
        
        // Try to get from wagmi if available
        if (!walletAddress && typeof window !== 'undefined') {
          try {
            // Check if wagmi is available and wallet is connected
            const wagmiState = (window as any).__WAGMI_STATE__;
            if (wagmiState?.connections?.size > 0) {
              const connection = Array.from(wagmiState.connections.values())[0] as any;
              walletAddress = connection?.accounts?.[0];
            }
          } catch {
            // Wagmi not available, continue with fallback
          }
        }
        
        // Fallback to demo address if still no address
        if (!walletAddress) {
          walletAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address as demo
        }
        
        try {
          const { getPortfolioSummary } = await import('./services/portfolioTracker');
          const portfolio = await getPortfolioSummary(walletAddress);
          
          // Group positions by chain and token
          const positionsByChain: Record<string, number> = {};
          const positionsByToken: Record<string, number> = {};
          
          portfolio.positions.forEach(pos => {
            positionsByChain[pos.chainName] = (positionsByChain[pos.chainName] || 0) + pos.valueUSD;
            positionsByToken[pos.tokenSymbol] = (positionsByToken[pos.tokenSymbol] || 0) + pos.valueUSD;
          });
          
          const analysis = await geminiService.chat({
            prompt: `As Portfolio Guardian, analyze this real cross-chain portfolio: Total value: $${portfolio.totalValueUSD.toFixed(2)}, ${portfolio.tokenCount} positions across ${portfolio.chains.length} chains (${portfolio.chains.join(', ')}). Positions by token: ${Object.entries(positionsByToken).map(([token, value]) => `${token}: $${value.toFixed(2)}`).join(', ')}. ${portfolio.pnl24h !== undefined ? `24h PnL: ${portfolio.pnl24h >= 0 ? '+' : ''}$${portfolio.pnl24h.toFixed(2)} (${portfolio.pnlPercent !== undefined ? (portfolio.pnlPercent >= 0 ? '+' : '') + portfolio.pnlPercent.toFixed(2) + '%' : 'N/A'})` : ''}. Provide a brief portfolio analysis.`
          });
          
          result = { 
            type: 'position_monitoring', 
            positions: portfolio.tokenCount,
            totalValue: `$${portfolio.totalValueUSD.toFixed(2)}`,
            pnl: portfolio.pnl24h !== undefined ? `${portfolio.pnl24h >= 0 ? '+' : ''}$${portfolio.pnl24h.toFixed(2)}` : 'N/A',
            pnlPercent: portfolio.pnlPercent !== undefined ? `${portfolio.pnlPercent >= 0 ? '+' : ''}${portfolio.pnlPercent.toFixed(2)}%` : 'N/A',
            analysis: analysis.text,
            chains: portfolio.chains,
            positionsByChain,
            positionsByToken,
            walletAddress: walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4),
            lastUpdated: new Date(portfolio.lastUpdated).toLocaleString()
          };
          taskType = 'position_monitoring';
          summary = `Tracked ${portfolio.tokenCount} real positions across ${portfolio.chains.length} chains - Total value: $${portfolio.totalValueUSD.toFixed(2)}${portfolio.pnl24h !== undefined ? `, PnL: ${portfolio.pnl24h >= 0 ? '+' : ''}$${portfolio.pnl24h.toFixed(2)}` : ''}`;
        } catch (error: any) {
          console.error('Portfolio tracking error:', error);
          addLog('ERROR', `Failed to fetch portfolio: ${error.message}`);
          
          // Fallback to analysis only
          const analysis = await geminiService.chat({
            prompt: `As Portfolio Guardian, report that portfolio tracking encountered an error: ${error.message}. Suggest checking wallet address and network connectivity.`
          });
          
          result = { 
            type: 'position_monitoring', 
            positions: 0,
            totalValue: '$0.00',
            pnl: 'N/A',
            analysis: analysis.text,
            chains: [],
            error: error.message
          };
          taskType = 'position_monitoring';
          summary = `Portfolio tracking failed: ${error.message}`;
        }
      } else if (agent.role === 'Oracle') {
        // Rebalancer - Real allocation management
        addLog(agent.name, '⚖️ Analyzing portfolio allocations across chains...');
        
        const walletAddress = localStorage.getItem('trackedWalletAddress') || 
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
        
        try {
          const { analyzePortfolioDrift } = await import('./services/rebalancer');
          const driftAnalysis = await analyzePortfolioDrift(walletAddress);
          
          const currentAlloc: Record<string, number> = {};
          const targetAlloc: Record<string, number> = {};
          driftAnalysis.allocations.forEach(a => {
            currentAlloc[a.tokenSymbol] = Math.round(a.currentPercent);
            targetAlloc[a.tokenSymbol] = a.targetPercent;
          });
          
          const analysis = await geminiService.chat({
            prompt: `As Rebalancer, analyze this real portfolio drift: Total value: $${driftAnalysis.totalValueUSD.toFixed(2)}, Average drift: ${driftAnalysis.totalDrift.toFixed(1)}%. ${driftAnalysis.recommendations.join('. ')}. Needs rebalancing: ${driftAnalysis.needsRebalancing}. Provide a brief rebalancing recommendation.`
          });
          
          result = { 
            type: 'rebalancing', 
            drift: `${driftAnalysis.totalDrift.toFixed(1)}%`,
            current: currentAlloc,
            target: targetAlloc,
            needsRebalancing: driftAnalysis.needsRebalancing,
            actions: driftAnalysis.actions,
            recommendations: driftAnalysis.recommendations,
            analysis: analysis.text 
          };
          taskType = 'rebalancing';
          summary = driftAnalysis.needsRebalancing 
            ? `Rebalancing needed: ${driftAnalysis.totalDrift.toFixed(1)}% drift detected. ${driftAnalysis.actions.length} actions recommended.`
            : `Portfolio balanced: Only ${driftAnalysis.totalDrift.toFixed(1)}% drift. No rebalancing needed.`;
        } catch (error: any) {
          console.error('Rebalancing analysis error:', error);
          const analysis = await geminiService.chat({
            prompt: `As Rebalancer, report that allocation analysis encountered an error: ${error.message}`
          });
          result = { 
            type: 'rebalancing', 
            drift: 'N/A',
            current: {},
            target: {},
            error: error.message,
            analysis: analysis.text 
          };
          taskType = 'rebalancing';
          summary = `Rebalancing analysis failed: ${error.message}`;
        }
      } else if (agent.role === 'Merchant') {
        // Yield Seeker - Real yield optimization
        addLog(agent.name, '📈 Scanning DeFi protocols for yield opportunities...');
        
        try {
          const { getYieldComparison, getBestYieldOpportunities } = await import('./services/yieldFetcher');
          const yieldData = await getYieldComparison('USDC');
          const topOpportunities = await getBestYieldOpportunities('USDC', undefined, 500000);
          
          if (topOpportunities.length > 0) {
            const best = yieldData.bestOpportunity;
            const analysis = await geminiService.chat({
              prompt: `As Yield Seeker, analyze these real yield opportunities: Found ${topOpportunities.length} opportunities. Best: ${best?.protocol} on ${best?.chainName} with ${best?.apy.toFixed(2)}% APY, TVL: $${(best?.tvl || 0).toLocaleString()}, Risk: ${best?.risk}. Average APY across all opportunities: ${yieldData.averageApy.toFixed(2)}%. Provide a brief yield optimization recommendation.`
            });
            
            result = { 
              type: 'yield_optimization',
              opportunities: topOpportunities.slice(0, 10).map(opp => 
                `${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY (${opp.risk} risk)`
              ),
              bestYield: `${best?.apy.toFixed(2)}%`,
              bestProtocol: best?.protocol,
              bestChain: best?.chainName,
              averageApy: `${yieldData.averageApy.toFixed(2)}%`,
              totalOpportunities: topOpportunities.length,
              analysis: analysis.text 
            };
            taskType = 'yield_optimization';
            summary = `Found ${topOpportunities.length} real yield opportunities. Best: ${best?.apy.toFixed(2)}% APY on ${best?.protocol} (${best?.chainName})`;
          } else {
            const analysis = await geminiService.chat({
              prompt: `As Yield Seeker, report that no significant yield opportunities were found for USDC across supported chains.`
            });
            result = { 
              type: 'yield_optimization',
              opportunities: [],
              bestYield: 'N/A',
              message: 'No yield opportunities found',
              analysis: analysis.text 
            };
            taskType = 'yield_optimization';
            summary = `Scanned DeFi protocols. No significant yield opportunities found.`;
          }
        } catch (error: any) {
          console.error('Yield fetching error:', error);
          const analysis = await geminiService.chat({
            prompt: `As Yield Seeker, report that yield scanning encountered an error: ${error.message}`
          });
          result = { 
            type: 'yield_optimization',
            opportunities: [],
            bestYield: 'N/A',
            error: error.message,
            analysis: analysis.text 
          };
          taskType = 'yield_optimization';
          summary = `Yield scanning failed: ${error.message}`;
        }
      } else if (agent.role === 'Sentinel') {
        // Risk Sentinel - Real route validation
        addLog(agent.name, '🛡️ Analyzing route safety via LI.FI...');
        
        try {
          const { analyzeRouteRisk } = await import('./services/riskAnalyzer');
          
          // Default route: USDC Ethereum -> Arbitrum for analysis
          const riskAnalysis = await analyzeRouteRisk({
            fromChain: 1, // Ethereum
            toChain: 42161, // Arbitrum
            fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
            toToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC on Arbitrum
            fromAmount: '1000000000', // 1000 USDC
          });
          
          const analysis = await geminiService.chat({
            prompt: `As Risk Sentinel, analyze this real route risk assessment: Risk Score: ${riskAnalysis.riskScore}/100, Status: ${riskAnalysis.status}, Slippage: ${riskAnalysis.slippage.toFixed(2)}%, Gas: $${riskAnalysis.gasCostUSD.toFixed(2)}, Steps: ${riskAnalysis.stepsCount}, Bridges: ${riskAnalysis.bridgesUsed.join(', ') || 'None'}. Issues: ${riskAnalysis.issues.join(', ') || 'None'}. Provide a safety recommendation.`
          });
          
          result = { 
            type: 'risk_analysis',
            riskScore: riskAnalysis.riskScore,
            status: riskAnalysis.status,
            slippage: `${riskAnalysis.slippage.toFixed(2)}%`,
            gasCostUSD: `$${riskAnalysis.gasCostUSD.toFixed(2)}`,
            estimatedTime: `${Math.round(riskAnalysis.estimatedTime / 60)} min`,
            bridgesUsed: riskAnalysis.bridgesUsed,
            stepsCount: riskAnalysis.stepsCount,
            issues: riskAnalysis.issues,
            recommendations: riskAnalysis.recommendations,
            isValid: riskAnalysis.isValid,
            confidence: riskAnalysis.confidence,
            analysis: analysis.text 
          };
          taskType = 'risk_analysis';
          summary = `Route validated: Risk score ${riskAnalysis.riskScore}/100 - ${riskAnalysis.status}. ${riskAnalysis.issues.length > 0 ? `Issues: ${riskAnalysis.issues[0]}` : 'No issues detected.'}`;
        } catch (error: any) {
          console.error('Risk analysis error:', error);
          const analysis = await geminiService.chat({
            prompt: `As Risk Sentinel, report that route validation encountered an error: ${error.message}`
          });
          result = { 
            type: 'risk_analysis',
            riskScore: 100,
            status: 'UNKNOWN',
            slippage: 'N/A',
            error: error.message,
            analysis: analysis.text 
          };
          taskType = 'risk_analysis';
          summary = `Route validation failed: ${error.message}`;
        }
      } else if (agent.role === 'Glitch') {
        // Route Executor - Real execution preparation
        addLog(agent.name, '⚡ Preparing cross-chain route via LI.FI...');
        
        try {
          const { prepareExecution, getExecutionSummary } = await import('./services/routeExecutor');
          
          // Prepare execution for USDC Ethereum -> Arbitrum
          const walletAddress = localStorage.getItem('trackedWalletAddress') || 
            '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
          
          const executionPlan = await prepareExecution({
            fromChain: 1, // Ethereum
            toChain: 42161, // Arbitrum
            fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
            toToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC on Arbitrum
            fromAmount: '1000000000', // 1000 USDC
            fromAddress: walletAddress,
          });
          
          const summary_exec = getExecutionSummary(executionPlan);
          
          result = { 
            type: 'cross_chain_swap',
            route: summary_exec.route,
            status: executionPlan.readyToExecute ? 'READY' : 'NOT_READY',
            estimatedTime: summary_exec.estimatedTime,
            gasCost: summary_exec.gasCost,
            netValue: summary_exec.netValue,
            estimatedOutput: `$${executionPlan.estimatedOutputUSD.toFixed(2)}`,
            steps: executionPlan.steps.map(s => `${s.stepNumber}. ${s.type} via ${s.tool} (${s.fromChain}→${s.toChain})`),
            warnings: executionPlan.warnings,
            readyToExecute: executionPlan.readyToExecute,
            note: 'Execution requires wallet connection and transaction signing'
          };
          taskType = 'cross_chain_swap';
          summary = executionPlan.readyToExecute 
            ? `⚡ Route ready: ${summary_exec.route} - Est. time: ${summary_exec.estimatedTime}, Gas: ${summary_exec.gasCost}`
            : `⚠️ Route not ready: ${executionPlan.warnings[0] || 'Check route parameters'}`;
        } catch (error: any) {
          console.error('Route preparation error:', error);
          result = { 
            type: 'cross_chain_swap',
            route: 'N/A',
            status: 'ERROR',
            error: error.message
          };
          taskType = 'cross_chain_swap';
          summary = `Route preparation failed: ${error.message}`;
        }
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

  // Handle intent submission
  const handleIntentSubmit = useCallback(async (intent: string) => {
    // Add user message
    const userMessage = {
      id: `msg_${Date.now()}_user`,
      type: 'user' as const,
      content: intent,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMessage]);
    setIsProcessingIntent(true);
    
    // Parse intent
    const analysis = parseIntent(intent);
    
    // Add system message
    setTimeout(() => {
      const systemMessage = {
        id: `msg_${Date.now()}_system`,
        type: 'system' as const,
        content: analysis.description,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, systemMessage]);
      
      // Activate required agents
      const agentsToActivate = analysis.requiredAgents.filter(id => !activeAgents.includes(id));
      
      if (agentsToActivate.length > 0) {
        agentsToActivate.forEach(agentId => {
          const agent = AGENTS.find(a => a.id === agentId);
          if (agent) {
            handleActivateAgent(agentId);
            addLog('SYSTEM', `🤖 Auto-activated ${agent.name} for intent execution`);
          }
        });
      }
      
      // Create connections
      const newConnections = [...persistentEdges];
      analysis.connections.forEach(conn => {
        const exists = newConnections.some(
          e => e.source === conn.source && e.target === conn.target
        );
        if (!exists) {
          newConnections.push(conn);
        }
      });
      
      setPersistentEdges(newConnections);
      localStorage.setItem('agentConnections', JSON.stringify(newConnections));
      
      // Add agent confirmation messages
      setTimeout(() => {
        analysis.requiredAgents.forEach(agentId => {
          const agent = AGENTS.find(a => a.id === agentId);
          if (agent) {
            const agentMessage = {
              id: `msg_${Date.now()}_${agentId}`,
              type: 'agent' as const,
              content: `✅ ${agent.name} connected and ready. Workflow configured.`,
              timestamp: Date.now(),
              agentName: agent.name
            };
            setChatMessages(prev => [...prev, agentMessage]);
          }
        });
        
        setIsProcessingIntent(false);
        toast.success('Workflow connected! Agents are ready.');
      }, 1000);
    }, 500);
  }, [activeAgents, persistentEdges, handleActivateAgent, addLog, setPersistentEdges]);
  
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

        {/* Right Side: Intent Chat / Yield Rotation & Details Panel */}
        <div className="w-96 flex flex-col border-l border-white/10 overflow-hidden">
          {/* Tab Buttons */}
          <div className="flex border-b border-white/10 bg-black/40">
            <button
              onClick={() => setRightPanelView('chat')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                rightPanelView === 'chat' 
                  ? 'bg-neon-green/10 text-neon-green border-b-2 border-neon-green' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              INTENT CHAT
            </button>
            <button
              onClick={() => setRightPanelView('yield')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                rightPanelView === 'yield' 
                  ? 'bg-neon-green/10 text-neon-green border-b-2 border-neon-green' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap size={14} />
              YIELD
            </button>
            <button
              onClick={() => setRightPanelView('arbitrage')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                rightPanelView === 'arbitrage' 
                  ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-400' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ArrowRightLeft size={14} />
              ARB
            </button>
            <button
              onClick={() => setRightPanelView('alerts')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                rightPanelView === 'alerts' 
                  ? 'bg-orange-500/10 text-orange-400 border-b-2 border-orange-400' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bell size={14} />
              24/7
            </button>
            <button
              onClick={() => setRightPanelView('history')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                rightPanelView === 'history' 
                  ? 'bg-yellow-500/10 text-yellow-400 border-b-2 border-yellow-400' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History size={14} />
              TXS
            </button>
            <button
              onClick={() => setRightPanelView('wallets')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                rightPanelView === 'wallets' 
                  ? 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-400' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wallet size={14} />
              👛
            </button>
          </div>
          
          {/* Panel Content - Takes remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightPanelView === 'chat' ? (
              <IntentChat
                onIntentSubmit={handleIntentSubmit}
                messages={chatMessages}
                isProcessing={isProcessingIntent}
              />
            ) : rightPanelView === 'yield' ? (
              <div className="h-full overflow-y-auto p-3">
                <OneClickYield 
                  onLog={(message, type) => {
                    addLog('YIELD', message);
                    if (type === 'success') {
                      toast.success(message, { position: 'bottom-right' });
                    } else if (type === 'error') {
                      toast.error(message, { position: 'bottom-right' });
                    }
                  }}
                />
              </div>
            ) : rightPanelView === 'arbitrage' ? (
              <div className="h-full overflow-y-auto p-3">
                <ArbitrageExecutor 
                  onLog={(message, type) => {
                    addLog('ARB', message);
                    if (type === 'success') {
                      toast.success(message, { position: 'bottom-right' });
                    } else if (type === 'error') {
                      toast.error(message, { position: 'bottom-right' });
                    }
                  }}
                />
              </div>
            ) : rightPanelView === 'alerts' ? (
              <div className="h-full overflow-y-auto p-3">
                <NotificationSettings 
                  onLog={(message, type) => {
                    addLog('ALERTS', message);
                    if (type === 'success') {
                      toast.success(message, { position: 'bottom-right' });
                    } else if (type === 'error') {
                      toast.error(message, { position: 'bottom-right' });
                    }
                  }}
                />
              </div>
            ) : rightPanelView === 'history' ? (
              <div className="h-full overflow-y-auto p-3">
                <TransactionHistory 
                  onLog={(message, type) => {
                    addLog('HISTORY', message);
                    if (type === 'success') {
                      toast.success(message, { position: 'bottom-right' });
                    } else if (type === 'error') {
                      toast.error(message, { position: 'bottom-right' });
                    }
                  }}
                />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-3">
                <MultiWalletManager 
                  onLog={(message, type) => {
                    addLog('WALLET', message);
                    if (type === 'success') {
                      toast.success(message, { position: 'bottom-right' });
                    } else if (type === 'error') {
                      toast.error(message, { position: 'bottom-right' });
                    }
                  }}
                />
              </div>
            )}
          </div>
          
          {/* Details Panel (when agent selected) - Fixed height */}
          {selectedAgent && (
            <div className="h-96 border-t border-white/10 overflow-hidden flex-shrink-0">
              <AgentDetailPanel
                agent={selectedAgent}
                onClose={() => setSelectedAgentId(null)}
                onActivate={handleActivateAgent}
                onDeactivate={handleDeactivateAgent}
                onExecuteTask={executeAgentTask}
                onDeleteAgent={handleDeleteAgent}
                isActive={activeAgents.includes(selectedAgent.id)}
              />
            </div>
          )}
        </div>

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
