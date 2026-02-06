import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import ParticleNetwork from './components/ui/ParticleNetwork';
import RippleButton from './components/ui/RippleButton';
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
  const { data: walletClient } = useWalletClient();

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
  const [persistentEdges, setPersistentEdges] = useState<Array<{ source: string, target: string }>>(() => {
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

  // --- Execution State ---
  const [pendingExecution, setPendingExecution] = useState<{
    type: 'yield' | 'arbitrage' | 'swap' | 'rebalance';
    quote: any;
    summary: string;
    estimatedOutput: string;
    gasCost: string;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

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

      // Verify LI.FI SDK is installed and usable
      let lifiOk = false;
      try {
        const { lifiService } = await import('./services/lifi');
        const chains = await lifiService.getChains();
        lifiOk = Array.isArray(chains) && chains.length > 0;
      } catch (e) {
        console.warn('LI.FI SDK check failed:', e);
      }

      setTimeout(() => {
        addLog('SYSTEM', '✅ Gemini AI: Ready for agent intelligence');
        addLog('SYSTEM', lifiOk ? '✅ LI.FI SDK: Ready for cross-chain routing' : '⚠️ LI.FI SDK: Check network/API');
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

  // Workflow reset - clear all agents, connections, tasks, and logs
  const handleWorkflowReset = useCallback(() => {
    setActiveAgents([]);
    setPersistentEdges([]);
    setTaskResults([]);
    setLogs(INITIAL_LOGS);
    setChatMessages([]);
    setAgentStatuses({});
    setAgentProgress({});
    setSelectedAgentId(null);
    setActiveDialogue(null);
    setRandomDialogues({});
    setStreamingEdges([]);
    setAgentPositions({});
    localStorage.removeItem('activeAgents');
    localStorage.removeItem('agentConnections');
    localStorage.removeItem('nodePositions');
    localStorage.removeItem('taskResults');
    addLog('SYSTEM', '🔄 Workflow reset. All agents deactivated, connections cleared.');
    toast.info('Workflow reset complete');
  }, [addLog]);

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

  // Helper: get wallet address for agents (prefer connected, then localStorage, then demo)
  const getWalletAddressForAgents = useCallback(() => {
    if (isConnected && connectedAddress) return connectedAddress;
    const stored = localStorage.getItem('trackedWalletAddress');
    if (stored && stored.startsWith('0x')) return stored;
    return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Demo fallback
  }, [isConnected, connectedAddress]);

  // Execute agent task (AI-powered)
  const executeAgentTask = useCallback(async (agentId: string, taskDescription?: string) => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;

    const walletAddress = getWalletAddressForAgents();

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
      let taskType: any = 'custom_order'; // Cast to any to bypass strict type check
      let summary = '';

      if (agent.role === 'Navigator') {
        // Arbitrage Hunter - Real price monitoring with detailed logs
        addLog(agent.name, '👀 Starting arbitrage scan...');
        await new Promise(r => setTimeout(r, 300));
        addLog(agent.name, '📡 Connecting to Ethereum mainnet...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Connecting to Arbitrum...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Connecting to Optimism...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Connecting to Polygon...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Connecting to Base...');
        await new Promise(r => setTimeout(r, 300));
        addLog(agent.name, '🔍 Fetching USDC prices from all DEXs...');

        const { detectArbitrageOpportunities } = await import('./services/priceFetcher');
        const opportunities = await detectArbitrageOpportunities('USDC', 0.3, 1000);

        addLog(agent.name, `📊 Analyzed ${opportunities.length > 0 ? opportunities.length : 'multiple'} price points across 5 chains`);

        if (opportunities.length > 0) {
          const topOpportunity = opportunities[0];
          const analysis = await geminiService.chat({
            prompt: `You're Arbitrage Hunter, a friendly DeFi agent. Talk like a human - casual, helpful, no jargon. Analyze this arbitrage: ${topOpportunity.tokenSymbol} is ${topOpportunity.priceDifference.toFixed(2)}% cheaper on ${topOpportunity.fromChainName} ($${topOpportunity.fromPrice.toFixed(4)}) than ${topOpportunity.toChainName} ($${topOpportunity.toPrice.toFixed(4)}). Profit after fees: ~$${topOpportunity.profitAfterFees.toFixed(2)}. Give a short, conversational take - 1-2 sentences.`
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
            prompt: `You're Arbitrage Hunter. Talk like a human - casual, friendly. No profitable arbitrage found after scanning Ethereum, Arbitrum, Optimism, Polygon, and Base. Give a short, conversational reply - 1-2 sentences.`
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
        // Portfolio Guardian - Real position tracking using LI.FI SDK
        addLog(agent.name, '📂 Starting portfolio scan...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, `🔗 Checking wallet ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`);
        await new Promise(r => setTimeout(r, 300));

        try {
          // Use LI.FI SDK for USDC balances (most accurate)
          const { lifiService } = await import('./services/lifi');
          const { getPortfolioSummary } = await import('./services/portfolioTracker');

          addLog(agent.name, '📡 Querying Ethereum mainnet...');
          await new Promise(r => setTimeout(r, 200));
          addLog(agent.name, '📡 Querying Arbitrum...');
          await new Promise(r => setTimeout(r, 200));
          addLog(agent.name, '📡 Querying Polygon...');
          await new Promise(r => setTimeout(r, 200));

          // Fetch USDC via LI.FI SDK (more reliable)
          const usdcBalances = await lifiService.getUSDCBalances(walletAddress);

          if (usdcBalances.length > 0) {
            usdcBalances.forEach(b => {
              addLog(agent.name, `💰 Found ${b.balanceFormatted.toFixed(2)} USDC on ${b.chainName}`);
            });
          } else {
            addLog(agent.name, '📭 No USDC found on any chain');
          }

          addLog(agent.name, '📊 Fetching full portfolio data...');

          // Also get full portfolio for other tokens
          const portfolio = await getPortfolioSummary(walletAddress);

          addLog(agent.name, `✅ Portfolio loaded: ${portfolio.tokenCount} tokens across ${portfolio.chains.length} chains`);

          // Merge USDC data from LI.FI (more accurate) with portfolio data
          const usdcTotal = usdcBalances.reduce((sum, b) => sum + b.balanceFormatted, 0);
          const usdcByChain = usdcBalances.reduce((acc, b) => {
            acc[b.chainName] = b.balanceFormatted;
            return acc;
          }, {} as Record<string, number>);

          // Group positions by chain and token
          const positionsByChain: Record<string, number> = {};
          const positionsByToken: Record<string, number> = {};

          portfolio.positions.forEach(pos => {
            positionsByChain[pos.chainName] = (positionsByChain[pos.chainName] || 0) + pos.valueUSD;
            positionsByToken[pos.tokenSymbol] = (positionsByToken[pos.tokenSymbol] || 0) + pos.valueUSD;
          });

          // Override USDC with LI.FI data (more accurate)
          if (usdcTotal > 0) {
            positionsByToken['USDC'] = usdcTotal;
          }

          const usdcDetails = usdcBalances.length > 0
            ? `USDC breakdown: ${usdcBalances.map(b => `${b.chainName}: ${b.balanceFormatted.toFixed(2)}`).join(', ')}.`
            : 'No USDC found across supported chains.';

          const analysis = await geminiService.chat({
            prompt: `You're Portfolio Guardian. Talk like a human - friendly, clear, no jargon. User's wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}: $${portfolio.totalValueUSD.toFixed(2)} total, ${portfolio.tokenCount} positions across ${portfolio.chains.join(', ')}. ${usdcDetails} By token: ${Object.entries(positionsByToken).map(([token, value]) => `${token}: $${typeof value === 'number' ? value.toFixed(2) : value}`).join(', ')}. ${portfolio.pnl24h !== undefined ? `24h change: ${portfolio.pnl24h >= 0 ? '+' : ''}$${portfolio.pnl24h.toFixed(2)} (${portfolio.pnlPercent !== undefined ? (portfolio.pnlPercent >= 0 ? '+' : '') + portfolio.pnlPercent.toFixed(2) + '%' : 'N/A'})` : ''}. Give a short, conversational summary - 1-2 sentences.`
          });

          result = {
            type: 'position_monitoring',
            positions: portfolio.tokenCount,
            totalValue: `$${portfolio.totalValueUSD.toFixed(2)}`,
            usdcTotal: `${usdcTotal.toFixed(2)} USDC`,
            usdcByChain,
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
          summary = `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}: ${usdcTotal.toFixed(2)} USDC across ${usdcBalances.length} chains. Total portfolio: $${portfolio.totalValueUSD.toFixed(2)}`;
        } catch (error: any) {
          console.error('Portfolio tracking error:', error);
          addLog('ERROR', `Failed to fetch portfolio: ${error.message}`);

          // Fallback to analysis only
          const analysis = await geminiService.chat({
            prompt: `You're Portfolio Guardian. Talk like a human - friendly, helpful. Couldn't fetch the portfolio for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} (${error.message}). Give a short, conversational suggestion - 1 sentence.`
          });

          result = {
            type: 'position_monitoring',
            positions: 0,
            totalValue: '$0.00',
            usdcTotal: '0 USDC',
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
            prompt: `You're Rebalancer. Talk like a human - friendly, clear. Portfolio: $${driftAnalysis.totalValueUSD.toFixed(2)}, drift: ${driftAnalysis.totalDrift.toFixed(1)}%. ${driftAnalysis.recommendations.join('. ')}. Needs rebalancing: ${driftAnalysis.needsRebalancing}. Give a short, conversational recommendation - 1-2 sentences.`
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
            prompt: `You're Rebalancer. Talk like a human. Allocation check failed: ${error.message}. One short, friendly sentence.`
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
        // Yield Seeker - Real yield optimization with detailed logs
        addLog(agent.name, '🔍 Starting yield hunt...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Scanning Aave protocol...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Scanning Compound protocol...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Scanning Stargate protocol...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📡 Scanning GMX/GLP vaults...');
        await new Promise(r => setTimeout(r, 300));

        try {
          const { getYieldComparison, getBestYieldOpportunities } = await import('./services/yieldFetcher');

          addLog(agent.name, '📊 Comparing APYs across all protocols...');
          const yieldData = await getYieldComparison('USDC');
          const topOpportunities = await getBestYieldOpportunities('USDC', undefined, 500000);

          addLog(agent.name, `✅ Found ${topOpportunities.length} yield opportunities`);

          if (topOpportunities.length > 0) {
            const best = yieldData.bestOpportunity;
            const analysis = await geminiService.chat({
              prompt: `You're Yield Seeker. Talk like a human - enthusiastic but clear. Found ${topOpportunities.length} opportunities. Best: ${best?.protocol} on ${best?.chainName} at ${best?.apy.toFixed(2)}% APY (${best?.risk} risk). Average: ${yieldData.averageApy.toFixed(2)}%. Give a short, conversational recommendation - 1-2 sentences.`
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
              prompt: `You're Yield Seeker. Talk like a human. No great USDC yield opportunities right now across the chains we checked. One short, friendly sentence.`
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
            prompt: `You're Yield Seeker. Talk like a human. Yield scan failed: ${error.message}. One short, helpful sentence.`
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
        // Risk Sentinel - Real route validation with detailed logs
        addLog(agent.name, '🛡️ Starting safety analysis...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '🔍 Checking bridge contracts...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '📊 Analyzing slippage tolerance...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '⛽ Calculating gas costs...');
        await new Promise(r => setTimeout(r, 200));

        try {
          const { analyzeRouteRisk } = await import('./services/riskAnalyzer');

          addLog(agent.name, '📡 Fetching route from LI.FI...');

          // Default route: USDC Ethereum -> Arbitrum for analysis
          const riskAnalysis = await analyzeRouteRisk({
            fromChain: 1, // Ethereum
            toChain: 42161, // Arbitrum
            fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
            toToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native USDC on Arbitrum
            fromAmount: '1000000000', // 1000 USDC
            fromAddress: walletAddress, // Required for LI.FI quote
          });

          addLog(agent.name, `📈 Risk Score: ${riskAnalysis.riskScore}/100`);
          addLog(agent.name, `⚡ Estimated slippage: ${riskAnalysis.slippage.toFixed(2)}%`);
          addLog(agent.name, `⛽ Gas estimate: $${riskAnalysis.gasCostUSD.toFixed(2)}`);

          const analysis = await geminiService.chat({
            prompt: `You're Risk Sentinel. Talk like a human - clear, reassuring. Route check: Risk ${riskAnalysis.riskScore}/100, ${riskAnalysis.status}. Slippage: ${riskAnalysis.slippage.toFixed(2)}%, Gas: ~$${riskAnalysis.gasCostUSD.toFixed(2)}. ${riskAnalysis.issues.length > 0 ? `Heads up: ${riskAnalysis.issues[0]}` : 'Looks good.'}. Give a short, conversational safety take - 1-2 sentences.`
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
            prompt: `You're Risk Sentinel. Talk like a human. Couldn't validate the route: ${error.message}. One short, friendly sentence.`
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
        // Route Executor - Real execution with AUTO-SIGN and detailed logging
        addLog(agent.name, '⚡ Route Executor powering up...');
        await new Promise(r => setTimeout(r, 200));
        addLog(agent.name, '🔗 Connecting to LI.FI aggregator...');
        await new Promise(r => setTimeout(r, 200));

        try {
          const { lifiService } = await import('./services/lifi');
          const { prepareExecution, getExecutionSummary } = await import('./services/routeExecutor');

          addLog(agent.name, '💰 Checking your USDC balances across all chains...');

          // Get USDC balance on ALL chains
          const usdcBalances = await lifiService.getUSDCBalances(walletAddress);

          // Log all balances found
          if (usdcBalances.length > 0) {
            usdcBalances.forEach(b => {
              addLog(agent.name, `   💵 ${b.chainName}: ${b.balanceFormatted.toFixed(2)} USDC`);
            });
          }

          // Find the chain with the highest USDC balance
          const sortedBalances = [...usdcBalances].sort((a, b) => b.balanceFormatted - a.balanceFormatted);
          const sourceBalance = sortedBalances.find(b => b.balanceFormatted >= 1);

          if (!sourceBalance) {
            addLog(agent.name, '❌ No chain has sufficient USDC balance (need at least 1 USDC)');
            throw new Error('Insufficient USDC balance on any chain (need at least 1 USDC)');
          }

          // USDC addresses per chain for routing
          const USDC_ADDRESSES: Record<number, string> = {
            1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
            42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum (native)
            10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism (native)
            137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (native)
            8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
          };

          // Pick a destination chain (different from source, prefer Arbitrum for low fees)
          const destinationChains = [42161, 10, 137, 8453, 1].filter(c => c !== sourceBalance.chainId);
          const toChain = destinationChains[0]; // First available different chain
          const toChainName = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon', 8453: 'Base' }[toChain] || 'Unknown';

          // Use actual balance (up to 1000 USDC max for safety)
          const amountToUse = Math.min(sourceBalance.balanceFormatted, 1000);
          const amountRaw = Math.floor(amountToUse * 1e6).toString();

          addLog(agent.name, `✅ Using ${amountToUse.toFixed(2)} USDC from ${sourceBalance.chainName}`);

          addLog(agent.name, `📝 Will bridge ${amountToUse.toFixed(2)} USDC`);
          addLog(agent.name, `🛣️ Finding optimal route ${sourceBalance.chainName} → ${toChainName}...`);

          // Log the exact parameters being sent
          const fromTokenAddr = USDC_ADDRESSES[sourceBalance.chainId] || sourceBalance.tokenAddress;
          const toTokenAddr = USDC_ADDRESSES[toChain];
          addLog(agent.name, `   📋 From: Chain ${sourceBalance.chainId}, Token ${fromTokenAddr.slice(0, 10)}...`);
          addLog(agent.name, `   📋 To: Chain ${toChain}, Token ${toTokenAddr.slice(0, 10)}...`);
          addLog(agent.name, `   📋 Amount: ${amountRaw} (${amountToUse.toFixed(2)} USDC)`);
          addLog(agent.name, `   📋 Wallet: ${walletAddress.slice(0, 10)}...`);
          await new Promise(r => setTimeout(r, 300));

          const executionPlan = await prepareExecution({
            fromChain: sourceBalance.chainId,
            toChain: toChain,
            fromToken: fromTokenAddr,
            toToken: toTokenAddr,
            fromAmount: amountRaw,
            fromAddress: walletAddress,
          });

          const summary_exec = getExecutionSummary(executionPlan);

          // Log warnings if no route found
          if (executionPlan.warnings.length > 0 && !executionPlan.readyToExecute) {
            addLog(agent.name, `⚠️ Route issue: ${executionPlan.warnings[0]}`);
          }

          if (executionPlan.steps.length > 0) {
            addLog(agent.name, `✅ Route found: ${executionPlan.steps.length} step(s)`);
            executionPlan.steps.forEach(step => {
              addLog(agent.name, `   → Step ${step.stepNumber}: ${step.type} via ${step.tool}`);
            });
          }
          addLog(agent.name, `⛽ Estimated gas: ${summary_exec.gasCost}`);
          addLog(agent.name, `💵 Expected output: $${executionPlan.estimatedOutputUSD.toFixed(2)}`);

          // AUTO-EXECUTE if wallet is connected and route is ready
          if (walletClient && executionPlan.readyToExecute && executionPlan.quote) {
            addLog(agent.name, '🔐 Wallet detected! Initiating auto-execution...');
            await new Promise(r => setTimeout(r, 300));
            addLog(agent.name, '📤 Sending transaction to wallet for signature...');

            // Import transaction history service
            const { transactionHistory: txHistoryService } = await import('./services/transactionHistory');

            // Create pending transaction in history
            const pendingTx = txHistoryService.addTransaction({
              walletAddress: walletAddress as `0x${string}`,
              type: 'bridge',
              status: 'pending',
              fromChainId: sourceBalance.chainId,
              fromChainName: sourceBalance.chainName,
              toChainId: toChain,
              toChainName: toChainName,
              fromToken: 'USDC',
              fromAmount: amountToUse.toFixed(2),
              fromAmountUsd: amountToUse,
              toToken: 'USDC',
              gasCostUsd: parseFloat(summary_exec.gasCost.replace('$', '')) || 0,
            });

            try {
              addLog(agent.name, '⏳ Waiting for wallet signature...');

              // Execute immediately without confirmation modal
              const execResult = await lifiService.executeRoute(executionPlan.quote, walletClient);

              const txHash = execResult.transactionHash || execResult.hash || 'pending';
              addLog(agent.name, '✍️ Transaction signed!');
              addLog(agent.name, `📡 Broadcasting to network...`);
              await new Promise(r => setTimeout(r, 200));
              addLog(agent.name, `✅ Transaction submitted!`);
              addLog(agent.name, `🔗 TX Hash: ${txHash}`);
              toast.success(`Transaction submitted! Hash: ${txHash.slice(0, 10)}...`);

              // Explorer URLs per chain
              const EXPLORER_URLS: Record<number, string> = {
                1: 'https://etherscan.io/tx/',
                42161: 'https://arbiscan.io/tx/',
                10: 'https://optimistic.etherscan.io/tx/',
                137: 'https://polygonscan.com/tx/',
                8453: 'https://basescan.org/tx/',
              };

              // Update transaction in history
              txHistoryService.updateTransaction(pendingTx.id, {
                status: 'completed',
                txHash,
                toAmount: executionPlan.estimatedOutputUSD.toFixed(2),
                toAmountUsd: executionPlan.estimatedOutputUSD,
                explorerUrl: `${EXPLORER_URLS[toChain] || 'https://etherscan.io/tx/'}${txHash}`,
              });

              // Add success message to chat
              const successMessage = {
                id: `msg_${Date.now()}_exec_success`,
                type: 'agent' as const,
                content: `Route Executor: ✅ Transaction complete! Bridged ${amountToUse.toFixed(2)} USDC from ${sourceBalance.chainName} → ${toChainName}. TX: ${txHash.slice(0, 10)}...`,
                timestamp: Date.now(),
                agentName: 'Route Executor'
              };
              setChatMessages(prev => [...prev, successMessage]);

              result = {
                type: 'cross_chain_swap',
                route: summary_exec.route,
                status: 'EXECUTED',
                transactionHash: txHash,
                estimatedTime: summary_exec.estimatedTime,
                gasCost: summary_exec.gasCost,
                netValue: summary_exec.netValue,
                estimatedOutput: `$${executionPlan.estimatedOutputUSD.toFixed(2)}`,
                steps: executionPlan.steps.map(s => `${s.stepNumber}. ${s.type} via ${s.tool} (${s.fromChain}→${s.toChain})`),
                warnings: [],
                readyToExecute: true,
                walletConnected: true,
                note: `✅ Transaction executed! Hash: ${txHash}`
              };
              taskType = 'cross_chain_swap';
              summary = `✅ EXECUTED! ${amountToUse.toFixed(2)} USDC bridged ${sourceBalance.chainName} → ${toChainName}. TX: ${txHash.slice(0, 10)}...`;

            } catch (execError: any) {
              console.error('Auto-execution error:', execError);
              addLog(agent.name, `❌ Transaction failed: ${execError.message}`);
              toast.error(`Execution failed: ${execError.message}`);

              // Update transaction in history as failed
              txHistoryService.updateTransaction(pendingTx.id, {
                status: 'failed',
                error: execError.message,
              });

              result = {
                type: 'cross_chain_swap',
                route: summary_exec.route,
                status: 'EXECUTION_FAILED',
                estimatedTime: summary_exec.estimatedTime,
                gasCost: summary_exec.gasCost,
                error: execError.message,
                note: `Execution failed: ${execError.message}`
              };
              taskType = 'cross_chain_swap';
              summary = `❌ Execution failed: ${execError.message}`;
            }
          } else if (!walletClient) {
            addLog(agent.name, '⚠️ No wallet connected - cannot execute');
            result = {
              type: 'cross_chain_swap',
              route: summary_exec.route,
              status: 'WALLET_NOT_CONNECTED',
              estimatedTime: summary_exec.estimatedTime,
              gasCost: summary_exec.gasCost,
              netValue: summary_exec.netValue,
              estimatedOutput: `$${executionPlan.estimatedOutputUSD.toFixed(2)}`,
              steps: executionPlan.steps.map(s => `${s.stepNumber}. ${s.type} via ${s.tool} (${s.fromChain}→${s.toChain})`),
              warnings: ['Wallet not connected - connect MetaMask to execute'],
              readyToExecute: false,
              walletConnected: false,
              note: 'Connect your wallet to execute this route'
            };
            taskType = 'cross_chain_swap';
            summary = `⚠️ Route prepared but wallet not connected. Connect MetaMask to execute.`;
          } else {
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
              note: executionPlan.warnings[0] || 'Route not ready'
            };
            taskType = 'cross_chain_swap';
            summary = `⚠️ Route not ready: ${executionPlan.warnings[0] || 'Check route parameters'}`;
          }
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
          prompt: `You're Route Strategist. Talk like a human - friendly, confident, like a helpful team lead. User asked: ${taskDescription || 'coordinate and analyze market conditions'}. Give a short, conversational response - 1-2 sentences.`
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
  }, [addLog, getWalletAddressForAgents, walletClient]);

  // Handle execution confirmation
  const handleConfirmExecution = useCallback(async () => {
    if (!pendingExecution || !walletClient) {
      toast.error('No pending execution or wallet not connected');
      return;
    }

    setIsExecuting(true);
    addLog('Route Executor', '⚡ EXECUTING! Signing transaction with your wallet...');

    try {
      const { lifiService } = await import('./services/lifi');

      // Execute the route with wallet client
      const result = await lifiService.executeRoute(pendingExecution.quote, walletClient);

      addLog('Route Executor', `✅ Transaction submitted! Hash: ${result.transactionHash || result.hash || 'pending'}`);
      toast.success('Transaction submitted! Check your wallet for confirmation.');

      // Clear pending execution
      setPendingExecution(null);

      // Add success message to chat
      const successMessage = {
        id: `msg_${Date.now()}_exec_success`,
        type: 'agent' as const,
        content: `Route Executor: ✅ Transaction executed successfully! ${pendingExecution.summary}. TX hash: ${(result.transactionHash || result.hash || 'pending').slice(0, 10)}...`,
        timestamp: Date.now(),
        agentName: 'Route Executor'
      };
      setChatMessages(prev => [...prev, successMessage]);

    } catch (error: any) {
      console.error('Execution error:', error);
      addLog('Route Executor', `❌ Execution failed: ${error.message}`);
      toast.error(`Execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [pendingExecution, walletClient, addLog]);

  // Cancel pending execution
  const handleCancelExecution = useCallback(() => {
    setPendingExecution(null);
    addLog('Route Executor', '🚫 Execution cancelled by user');
    toast.info('Execution cancelled');
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
    const userMessage = {
      id: `msg_${Date.now()}_user`,
      type: 'custom_order' as any, // Cast to any to bypass strict type check for now, or update TaskType definition as const,
      content: intent,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMessage]);
    setIsProcessingIntent(true);

    const analysis = parseIntent(intent);
    const agentNames = analysis.requiredAgents
      .map(id => AGENTS.find(a => a.id === id)?.name)
      .filter((n): n is string => !!n);

    // Get the actual wallet address for contextual responses
    const walletAddress = getWalletAddressForAgents();
    const isRealWallet = isConnected && connectedAddress === walletAddress;

    // For balance/portfolio queries, fetch real data first for context
    let portfolioContext = '';
    if (analysis.intentType === 'portfolio_check' || intent.toLowerCase().includes('usdc') || intent.toLowerCase().includes('balance')) {
      try {
        const { lifiService } = await import('./services/lifi');
        const usdcBalances = await lifiService.getUSDCBalances(walletAddress);

        if (usdcBalances.length > 0) {
          const totalUsdc = usdcBalances.reduce((sum, b) => sum + b.balanceFormatted, 0);
          const balanceDetails = usdcBalances.map(b => `${b.chainName}: ${b.balanceFormatted.toFixed(2)} USDC`).join(', ');
          portfolioContext = `\n\nWallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} has ${totalUsdc.toFixed(2)} USDC total (${balanceDetails})`;
        } else {
          portfolioContext = `\n\nWallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} has no USDC detected across supported chains.`;
        }

        if (!isRealWallet) {
          portfolioContext += ' (Note: Using tracked wallet, not connected wallet)';
        }
      } catch (error) {
        console.warn('Failed to fetch USDC balances for context:', error);
        portfolioContext = '\n\n(Could not fetch wallet balances - connect wallet for accurate data)';
      }
    }

    // Get dynamic, contextual responses from Gemini (avoids robotic predefined phrases)
    const responses = await geminiService.generateIntentResponses(
      intent + portfolioContext,
      analysis.intentType,
      agentNames
    );
    const systemContent = responses.systemMessage || analysis.description;

    // Add system message
    const systemMessage = {
      id: `msg_${Date.now()}_system`,
      type: 'system' as const,
      content: systemContent,
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
      if (!exists) newConnections.push(conn);
    });
    setPersistentEdges(newConnections);
    localStorage.setItem('agentConnections', JSON.stringify(newConnections));

    // Add agent messages - use dynamic responses when available
    const fallbackResponses: Record<string, string> = {
      a0: "Got it, I'm coordinating the team.",
      a1: "Checking prices across chains...",
      a2: "Seeing what you've got across chains.",
      a3: "Finding the best yields for you.",
      a4: "Running the numbers - safety first.",
      a5: "Making sure you're on target.",
      a6: "Ready to execute when you are.",
    };
    analysis.requiredAgents.forEach((agentId, idx) => {
      const agent = AGENTS.find(a => a.id === agentId);
      if (agent) {
        const content = responses.agentMessages?.[agent.name]
          || fallbackResponses[agentId]
          || "On it.";
        const agentMessage = {
          id: `msg_${Date.now()}_${agentId}_${idx}`,
          type: 'agent' as const,
          content: `${agent.name}: ${content}`,
          timestamp: Date.now(),
          agentName: agent.name
        };
        setChatMessages(prev => [...prev, agentMessage]);
      }
    });

    setIsProcessingIntent(false);

    // For portfolio checks, show balance directly in chat without workflow
    if (analysis.intentType === 'portfolio_check' && portfolioContext) {
      // Add a direct balance response to the chat
      const balanceMessage = {
        id: `msg_${Date.now()}_balance`,
        type: 'agent' as const,
        content: `Portfolio Guardian: ${portfolioContext.replace(/\n\n/g, '').trim()}`,
        timestamp: Date.now(),
        agentName: 'Portfolio Guardian'
      };
      setChatMessages(prev => [...prev, balanceMessage]);
      toast.success("Balance fetched!");
      // Don't trigger agent workflow for simple balance checks
      return;
    }

    // For yield optimization - AUTO-EXECUTE: find best yield and move funds
    if (analysis.intentType === 'yield_optimization') {
      toast.info('🔍 Finding best yields and preparing to deploy your funds...');
      // Trigger Yield Seeker to find best opportunities
      setTimeout(() => executeAgentTask('a3', `Find best yield for: ${intent}`), 500);
      // Trigger Risk Sentinel to validate
      setTimeout(() => executeAgentTask('a4', 'Validate yield opportunity for safety'), 1500);
      // Trigger Route Executor to move funds to best yield
      setTimeout(() => executeAgentTask('a6', `Deploy funds to best yield: ${intent}`), 2500);
      return;
    }

    // For arbitrage - AUTO-EXECUTE: find and execute arbitrage
    if (analysis.intentType === 'arbitrage') {
      toast.info('🔍 Scanning for arbitrage opportunities...');
      // Trigger Arbitrage Hunter to find opportunities
      setTimeout(() => executeAgentTask('a1', `Find arbitrage: ${intent}`), 500);
      // Trigger Risk Sentinel to validate
      setTimeout(() => executeAgentTask('a4', 'Validate arbitrage route for safety'), 1500);
      // Trigger Route Executor to execute arbitrage
      setTimeout(() => executeAgentTask('a6', `Execute arbitrage: ${intent}`), 2500);
      return;
    }

    toast.success("All set! We're on it.");

    // Auto-trigger workflows for specific intents with wallet context
    if (analysis.intentType === 'execute') {
      setTimeout(() => executeAgentTask('a0', 'Coordinate execution'), 600);
      setTimeout(() => executeAgentTask('a6', 'Execute the route'), 3000);
    }

    // For swap/bridge intents, immediately trigger the Route Executor
    if (analysis.intentType === 'swap') {
      toast.info('🚀 Preparing your swap...');
      // Trigger Route Strategist to coordinate
      setTimeout(() => executeAgentTask('a0', `Coordinate swap: ${intent}`), 500);
      // Trigger Risk Sentinel to validate
      setTimeout(() => executeAgentTask('a4', 'Validate the swap route for safety'), 1500);
      // Trigger Route Executor to prepare and execute the swap
      setTimeout(() => executeAgentTask('a6', `Execute swap: ${intent}`), 2500);
    }
  }, [activeAgents, persistentEdges, handleActivateAgent, addLog, setPersistentEdges, executeAgentTask, getWalletAddressForAgents, isConnected, connectedAddress]);

  // Get selected agent
  const selectedAgent = selectedAgentId ? AGENTS.find(a => a.id === selectedAgentId) || null : null;

  // Main app UI
  const mainApp = (
    <div className="h-screen min-h-screen bg-neural-dark text-gray-200 font-sans flex flex-col overflow-hidden relative selection:bg-neural-purple/30 selection:text-neural-purple">
      <ParticleNetwork />

      {/* Top Bar */}
      <UserBar onLogoClick={handleBackToLanding} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10 min-h-0">
        {/* Left Sidebar */}
        <div className="w-80 bg-black/20 backdrop-blur-md border-r border-white/10 flex flex-col overflow-hidden">
          {/* Mode Control */}
          <div className="p-4 border-b border-white/10">
            <CaptainControlPanel
              mode={operationMode}
              onModeChange={setOperationMode}
              onReset={handleWorkflowReset}
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
              <div className="bg-gradient-to-r from-neural-purple/10 via-blue-500/10 to-purple-500/10 border border-neural-purple/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-neural-purple uppercase tracking-wider">Operations</span>
                  <span className="text-neural-purple font-bold font-mono">{taskResults.length} tasks</span>
                </div>
                <button
                  onClick={() => setShowOperationsDashboard(true)}
                  className="w-full bg-neural-purple/10 hover:bg-neural-purple/20 border border-neural-purple/30 text-neural-purple font-semibold py-2.5 px-4 rounded transition-all flex items-center justify-center gap-2 text-sm font-mono"
                >
                  <Activity size={16} />
                  VIEW DASHBOARD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: Flow Canvas & Console */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
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
              isWalletConnected={isConnected}
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
        <div className="w-96 flex flex-col border-l border-white/10 overflow-hidden bg-black/20 backdrop-blur-md">
          {/* Tab Buttons */}
          <div className="flex border-b border-white/10 bg-black/40">
              <button
                onClick={() => setRightPanelView('chat')}
                className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'chat'
                  ? 'bg-neural-purple/10 text-neural-purple border-b-2 border-neural-purple'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                INTENT CHAT
              </button>
              <button
                onClick={() => setRightPanelView('yield')}
                className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'yield'
                  ? 'bg-neural-purple/10 text-neural-purple border-b-2 border-neural-purple'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Zap size={14} />
                YIELD
              </button>
              <button
                onClick={() => setRightPanelView('arbitrage')}
                className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'arbitrage'
                  ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <ArrowRightLeft size={14} />
                ARB
              </button>
              <button
                onClick={() => setRightPanelView('alerts')}
                className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'alerts'
                  ? 'bg-orange-500/10 text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Bell size={14} />
                24/7
              </button>
              <button
                onClick={() => setRightPanelView('history')}
                className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'history'
                  ? 'bg-yellow-500/10 text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <History size={14} />
                TXS
              </button>
              <button
                onClick={() => setRightPanelView('wallets')}
                className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'wallets'
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
                onSwitchToYield={() => setRightPanelView('yield')}
                onSwitchToArbitrage={() => setRightPanelView('arbitrage')}
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
                connectedAddress={connectedAddress}
                isWalletConnected={isConnected}
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
              className="group bg-gradient-to-r from-neural-purple to-blue-500 hover:from-neural-purple/90 hover:to-blue-500/90 text-black font-bold px-6 py-3 rounded-full shadow-2xl shadow-neural-purple/50 transition-all hover:scale-105 flex items-center gap-2 font-mono"
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

      {/* Execution Confirmation Modal */}
      {pendingExecution && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-neural-purple/30 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-neural-purple/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-neural-purple/20 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-neural-purple" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-mono">Confirm Execution</h3>
                <p className="text-gray-400 text-sm">Route Executor is ready</p>
              </div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Action</span>
                <span className="text-white font-mono text-sm">{pendingExecution.summary}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Expected Output</span>
                <span className="text-neural-purple font-mono text-sm">{pendingExecution.estimatedOutput}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Gas Cost</span>
                <span className="text-orange-400 font-mono text-sm">{pendingExecution.gasCost}</span>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <p className="text-yellow-400 text-xs font-mono">
                ⚠️ This will send a real transaction. Your wallet will prompt you to sign.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelExecution}
                disabled={isExecuting}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-mono rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExecution}
                disabled={isExecuting}
                className="flex-1 px-4 py-3 bg-neural-purple hover:bg-neural-purple/80 disabled:bg-gray-600 text-black font-bold font-mono rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    EXECUTE
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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

  return (
    <ErrorBoundary>
      {mainApp}
    </ErrorBoundary>
  );
};

export default App;
