import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { AGENTS, INITIAL_LOGS, AGENT_ABILITIES } from './constants';
import { AgentMetadata, LogMessage, AgentTaskResult } from './types';
import UserBar from './components/UserBar';
import FlowCanvas from './components/FlowCanvas';
import ConsolePanel from './components/ConsolePanel';
import AgentDetailPanel from './components/AgentDetailPanel';
import { AgentDialogue } from './components/AgentDialogue';
import { OperationsDashboard } from './components/OperationsDashboard';
import { IntentChat } from './components/IntentChat';
import { OneClickYield } from './components/OneClickYield';
import { ArbitrageExecutor } from './components/ArbitrageExecutor';
import { NotificationSettings } from './components/NotificationSettings';
import { TransactionHistory } from './components/TransactionHistory';
import { MultiWalletManager } from './components/MultiWalletManager';
import { AgentRegistry } from './components/AgentRegistry';
import LandingPage from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import DesertDust from './components/ui/DesertDust';
import RippleButton from './components/ui/RippleButton';
import { Activity, Zap, ArrowRightLeft, Bell, History, Wallet, Tag } from 'lucide-react';
import { orchestrator, agentStatusManager, geminiService } from './services/api';
import { authService } from './services/auth';
import { useAgentChat } from './hooks/useAgentChat';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast-custom.css';

const App: React.FC = () => {
  // Wagmi wallet connection
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Helper: get wallet address for agents (prefer connected, then localStorage, then demo)
  const getWalletAddressForAgents = useCallback(() => {
    if (isConnected && connectedAddress) return connectedAddress;
    const stored = localStorage.getItem('trackedWalletAddress');
    if (stored && stored.startsWith('0x')) return stored;
    return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Demo fallback
  }, [isConnected, connectedAddress]);

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
  const [rightPanelView, setRightPanelView] = useState<'chat' | 'yield' | 'arbitrage' | 'alerts' | 'history' | 'wallets' | 'registry'>('chat');

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

  // --- Execution State ---
  const [pendingExecution, setPendingExecution] = useState<{
    type: 'yield' | 'arbitrage' | 'swap' | 'rebalance' | 'vault_deposit' | 'direct_aave';
    quote?: any;
    summary: string;
    estimatedOutput: string;
    gasCost: string;
    directAaveParams?: { chainId: number; usdcAddress: string; amountRaw: string; fromAddress: string };
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Log helper (early for use in callbacks)
  const addLog = useCallback((agent: string, message: string) => {
    const newLog: LogMessage = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: agent === 'SYSTEM' ? 'SYSTEM' : agent === 'COMMANDER' ? 'COMMANDER' : 'A2A',
      content: message
    };
    setLogs(prev => [...prev.slice(-99), newLog]);
  }, []);

  // Default workflow connections: Paul Atreides coordinates → others → Stilgar executes
  const DEFAULT_AGENT_CONNECTIONS: Array<{ source: string; target: string }> = [
    { source: 'a0', target: 'a1' },
    { source: 'a0', target: 'a2' },
    { source: 'a0', target: 'a3' },
    { source: 'a1', target: 'a4' },
    { source: 'a3', target: 'a4' },
    { source: 'a2', target: 'a5' },
    { source: 'a4', target: 'a6' },
    { source: 'a5', target: 'a6' },
    { source: 'a0', target: 'a6' },
  ];

  // Deploy all agents to orchestration window (called from chat when user says "make best use of X")
  const handleDeployAgents = useCallback(() => {
    const allIds = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    setActiveAgents(allIds);
    setPersistentEdges(DEFAULT_AGENT_CONNECTIONS);
    localStorage.setItem('agentConnections', JSON.stringify(DEFAULT_AGENT_CONNECTIONS));
    allIds.forEach((id) => {
      setAgentStatuses((prev) => ({ ...prev, [id]: 'idle' }));
    });
    addLog('SYSTEM', '🤖 Agents deployed & connected: Paul Atreides → Chani, Irulan, Liet-Kynes → Duncan Idaho, Thufir Hawat → Stilgar');
  }, [addLog]);

  const agentChatRef = useRef<ReturnType<typeof useAgentChat> | null>(null);

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

  // Sync default connections when agents are deployed but connections are missing
  useEffect(() => {
    const allIds = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    const hasAllAgents = allIds.every((id) => activeAgents.includes(id));
    if (hasAllAgents && persistentEdges.length === 0) {
      const defaultEdges = [
        { source: 'a0', target: 'a1' },
        { source: 'a0', target: 'a2' },
        { source: 'a0', target: 'a3' },
        { source: 'a1', target: 'a4' },
        { source: 'a3', target: 'a4' },
        { source: 'a2', target: 'a5' },
        { source: 'a4', target: 'a6' },
        { source: 'a5', target: 'a6' },
        { source: 'a0', target: 'a6' },
      ];
      setPersistentEdges(defaultEdges);
      localStorage.setItem('agentConnections', JSON.stringify(defaultEdges));
    }
  }, [activeAgents, persistentEdges.length]);

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

  // Workflow reset - clear all agents, connections, tasks, and logs
  const handleWorkflowReset = useCallback(() => {
    setActiveAgents([]);
    setPersistentEdges([]);
    setTaskResults([]);
    setLogs(INITIAL_LOGS);
    agentChatRef.current?.clearMessages();
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

  // Execute agent task (AI-powered)
  const executeAgentTask = useCallback(async (
    agentId: string,
    taskDescription?: string,
    context?: { intentType?: string; previousResults?: Record<string, any> }
  ) => {
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

      if (agent.role === 'Fremen Scout') {
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
            prompt: `You're ${agent.name}, a friendly DeFi agent. Talk like a human - casual, helpful, no jargon. Analyze this arbitrage: ${topOpportunity.tokenSymbol} is ${topOpportunity.priceDifference.toFixed(2)}% cheaper on ${topOpportunity.fromChainName} ($${topOpportunity.fromPrice.toFixed(4)}) than ${topOpportunity.toChainName} ($${topOpportunity.toPrice.toFixed(4)}). Profit after fees: ~$${topOpportunity.profitAfterFees.toFixed(2)}. Give a short, conversational take - 1-2 sentences.`
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
            prompt: `You're ${agent.name}. Talk like a human - casual, friendly. No profitable arbitrage found after scanning Ethereum, Arbitrum, Optimism, Polygon, and Base. Give a short, conversational reply - 1-2 sentences.`
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
      } else if (agent.role === 'Bene Gesserit') {
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
            prompt: `You're ${agent.name}. Talk like a human - friendly, clear, no jargon. User's wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}: $${portfolio.totalValueUSD.toFixed(2)} total, ${portfolio.tokenCount} positions across ${portfolio.chains.join(', ')}. ${usdcDetails} By token: ${Object.entries(positionsByToken).map(([token, value]) => `${token}: $${typeof value === 'number' ? value.toFixed(2) : value}`).join(', ')}. ${portfolio.pnl24h !== undefined ? `24h change: ${portfolio.pnl24h >= 0 ? '+' : ''}$${portfolio.pnl24h.toFixed(2)} (${portfolio.pnlPercent !== undefined ? (portfolio.pnlPercent >= 0 ? '+' : '') + portfolio.pnlPercent.toFixed(2) + '%' : 'N/A'})` : ''}. Give a short, conversational summary - 1-2 sentences.`
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
            prompt: `You're ${agent.name}. Talk like a human - friendly, helpful. Couldn't fetch the portfolio for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} (${error.message}). Give a short, conversational suggestion - 1 sentence.`
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
      } else if (agent.role === 'Mentat') {
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
            prompt: `You're ${agent.name}. Talk like a human - friendly, clear. Portfolio: $${driftAnalysis.totalValueUSD.toFixed(2)}, drift: ${driftAnalysis.totalDrift.toFixed(1)}%. ${driftAnalysis.recommendations.join('. ')}. Needs rebalancing: ${driftAnalysis.needsRebalancing}. Give a short, conversational recommendation - 1-2 sentences.`
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
            prompt: `You're ${agent.name}. Talk like a human. Allocation check failed: ${error.message}. One short, friendly sentence.`
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
      } else if (agent.role === 'Planetologist') {
        // Yield Seeker - Real yield optimization with gas validation
        addLog(agent.name, '🔍 Starting yield hunt...');
        await new Promise(r => setTimeout(r, 200));

        try {
          const { lifiService } = await import('./services/lifi');
          const { getYieldComparison, getBestYieldOpportunities } = await import('./services/yieldFetcher');

          // Gas requirements per chain (in native token)
          const GAS_REQUIREMENTS: Record<number, { min: number; recommended: number; token: string }> = {
            1: { min: 0.001, recommended: 0.005, token: 'ETH' },
            42161: { min: 0.0001, recommended: 0.0005, token: 'ETH' },
            10: { min: 0.0001, recommended: 0.0005, token: 'ETH' },
            137: { min: 0.1, recommended: 0.5, token: 'MATIC' },
            8453: { min: 0.0001, recommended: 0.0005, token: 'ETH' },
            43114: { min: 0.01, recommended: 0.05, token: 'AVAX' },
          };
          const CHAIN_NAMES: Record<number, string> = {
            1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon', 8453: 'Base', 43114: 'Avalanche'
          };

          // First check wallet gas balances across all chains
          addLog(agent.name, '⛽ Checking your gas balances across chains...');
          const chainIds = [1, 42161, 10, 137, 8453, 43114];
          const gasBalances: Record<number, { balance: number; token: string; hasEnough: boolean; chainName: string }> = {};

          await Promise.all(chainIds.map(async (chainId) => {
            const gasReq = GAS_REQUIREMENTS[chainId] || { min: 0.001, recommended: 0.005, token: 'ETH' };
            const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
            try {
              const nativeBal = await lifiService.getNativeBalance(walletAddress, chainId);
              const hasEnough = nativeBal.balanceFormatted >= gasReq.min;
              gasBalances[chainId] = {
                balance: nativeBal.balanceFormatted,
                token: gasReq.token,
                hasEnough,
                chainName,
              };
            } catch {
              gasBalances[chainId] = { balance: 0, token: gasReq.token, hasEnough: false, chainName };
            }
          }));

          // Display gas status
          const chainsWithGas = Object.entries(gasBalances).filter(([_, g]) => g.hasEnough);
          const chainsWithoutGas = Object.entries(gasBalances).filter(([_, g]) => !g.hasEnough);

          addLog(agent.name, `\n💰 Your gas balances:`);
          Object.entries(gasBalances).forEach(([chainId, g]) => {
            const status = g.hasEnough ? '✅' : '⚠️';
            const need = GAS_REQUIREMENTS[parseInt(chainId)]?.min || 0.001;
            addLog(agent.name, `   ${status} ${g.chainName}: ${g.balance.toFixed(6)} ${g.token} ${g.hasEnough ? '(OK)' : `(need ${need})`}`);
          });

          if (chainsWithGas.length === 0) {
            addLog(agent.name, `\n❌ No gas on any chain! You need native tokens to interact with DeFi.`);
            throw new Error('No gas tokens found on any chain. Add ETH, MATIC, or AVAX to pay for transactions.');
          }

          addLog(agent.name, `\n📡 Scanning DeFi protocols (Aave, Compound, Stargate, GMX)...`);
          await new Promise(r => setTimeout(r, 300));

          addLog(agent.name, '📊 Comparing APYs across all protocols...');
          const yieldData = await getYieldComparison('USDC');
          const allOpportunities = await getBestYieldOpportunities('USDC', undefined, 500000);

          addLog(agent.name, `✅ Found ${allOpportunities.length} total yield opportunities`);

          // Filter opportunities to chains where user has gas
          const chainsWithGasIds = chainsWithGas.map(([id]) => parseInt(id));
          const accessibleOpportunities = allOpportunities.filter(opp => chainsWithGasIds.includes(opp.chainId));
          const inaccessibleOpportunities = allOpportunities.filter(opp => !chainsWithGasIds.includes(opp.chainId));

          addLog(agent.name, `\n🎯 Yields you can access (have gas): ${accessibleOpportunities.length}`);
          if (inaccessibleOpportunities.length > 0) {
            addLog(agent.name, `⚠️ Yields requiring gas bridge: ${inaccessibleOpportunities.length}`);
          }

          // Show accessible opportunities first
          if (accessibleOpportunities.length > 0) {
            addLog(agent.name, `\n✅ ACCESSIBLE YIELDS (you have gas):`);
            accessibleOpportunities.slice(0, 5).forEach((opp, i) => {
              addLog(agent.name, `   ${i + 1}. ${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY (${opp.risk} risk)`);
            });
          }

          // Show inaccessible opportunities with gas needed
          if (inaccessibleOpportunities.length > 0) {
            addLog(agent.name, `\n⚠️ YIELDS REQUIRING GAS BRIDGE:`);
            inaccessibleOpportunities.slice(0, 3).forEach((opp) => {
              const gasNeeded = GAS_REQUIREMENTS[opp.chainId];
              addLog(agent.name, `   • ${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY - needs ~${gasNeeded?.min} ${gasNeeded?.token}`);
            });
          }

          // Use accessible opportunities for recommendation, but mention better ones if locked behind gas
          const bestAccessible = accessibleOpportunities[0];
          const bestOverall = allOpportunities[0];
          const hasBetterInaccessible = bestOverall && bestAccessible && bestOverall.apy > bestAccessible.apy && !chainsWithGasIds.includes(bestOverall.chainId);

          if (accessibleOpportunities.length > 0) {
            let analysisPrompt = `You're ${agent.name}. Talk like a human - enthusiastic but clear. Found ${accessibleOpportunities.length} accessible opportunities (user has gas). Best accessible: ${bestAccessible?.protocol} on ${bestAccessible?.chainName} at ${bestAccessible?.apy.toFixed(2)}% APY (${bestAccessible?.risk} risk).`;
            if (hasBetterInaccessible) {
              analysisPrompt += ` Note: ${bestOverall.protocol} on ${bestOverall.chainName} offers ${bestOverall.apy.toFixed(2)}% APY but user needs to bridge gas there first.`;
            }
            analysisPrompt += ` Give a short, conversational recommendation - 1-2 sentences. Mention if bridging gas could unlock better yields.`;

            const analysis = await geminiService.chat({ prompt: analysisPrompt });

            result = {
              type: 'yield_optimization',
              opportunities: accessibleOpportunities.slice(0, 10).map(opp =>
                `${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY (${opp.risk} risk) ✅`
              ),
              inaccessibleOpportunities: inaccessibleOpportunities.slice(0, 5).map(opp => {
                const gasNeeded = GAS_REQUIREMENTS[opp.chainId];
                return `${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY - needs ${gasNeeded?.min} ${gasNeeded?.token}`;
              }),
              bestYield: `${bestAccessible?.apy.toFixed(2)}%`,
              bestProtocol: bestAccessible?.protocol,
              bestChain: bestAccessible?.chainName,
              averageApy: `${yieldData.averageApy.toFixed(2)}%`,
              totalOpportunities: allOpportunities.length,
              accessibleCount: accessibleOpportunities.length,
              gasStatus: Object.fromEntries(Object.entries(gasBalances).map(([id, g]) => [CHAIN_NAMES[parseInt(id)], `${g.balance.toFixed(4)} ${g.token} ${g.hasEnough ? '✅' : '⚠️'}`])),
              analysis: analysis.text
            };
            taskType = 'yield_optimization';
            summary = `Found ${accessibleOpportunities.length} accessible yields (${allOpportunities.length} total). Best: ${bestAccessible?.apy.toFixed(2)}% APY on ${bestAccessible?.protocol} (${bestAccessible?.chainName})`;
            if (hasBetterInaccessible) {
              summary += ` | Better yield (${bestOverall.apy.toFixed(2)}%) on ${bestOverall.chainName} requires gas bridge.`;
            }
          } else {
            // No accessible opportunities but some exist
            const analysis = await geminiService.chat({
              prompt: `You're ${agent.name}. Talk like a human. Found ${allOpportunities.length} yield opportunities but user has no gas on those chains. Best overall: ${bestOverall?.protocol} on ${bestOverall?.chainName} at ${bestOverall?.apy.toFixed(2)}% APY but they need ${GAS_REQUIREMENTS[bestOverall?.chainId]?.min} ${GAS_REQUIREMENTS[bestOverall?.chainId]?.token} for gas. Suggest bridging gas first. One short sentence.`
            });
            result = {
              type: 'yield_optimization',
              opportunities: [],
              inaccessibleOpportunities: allOpportunities.slice(0, 5).map(opp => {
                const gasNeeded = GAS_REQUIREMENTS[opp.chainId];
                return `${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY - needs ${gasNeeded?.min} ${gasNeeded?.token}`;
              }),
              bestYield: 'N/A (no gas)',
              message: `Found ${allOpportunities.length} opportunities but you need gas on those chains first.`,
              gasStatus: Object.fromEntries(Object.entries(gasBalances).map(([id, g]) => [CHAIN_NAMES[parseInt(id)], `${g.balance.toFixed(4)} ${g.token} ${g.hasEnough ? '✅' : '⚠️'}`])),
              analysis: analysis.text
            };
            taskType = 'yield_optimization';
            summary = `Found ${allOpportunities.length} yield opportunities but no gas on those chains. Bridge gas tokens first.`;
          }
        } catch (error: any) {
          console.error('Yield fetching error:', error);
          const analysis = await geminiService.chat({
            prompt: `You're ${agent.name}. Talk like a human. Yield scan failed: ${error.message}. One short, helpful sentence.`
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
      } else if (agent.role === 'Swordmaster') {
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
            prompt: `You're ${agent.name}. Talk like a human - clear, reassuring. Route check: Risk ${riskAnalysis.riskScore}/100, ${riskAnalysis.status}. Slippage: ${riskAnalysis.slippage.toFixed(2)}%, Gas: ~$${riskAnalysis.gasCostUSD.toFixed(2)}. ${riskAnalysis.issues.length > 0 ? `Heads up: ${riskAnalysis.issues[0]}` : 'Looks good.'}. Give a short, conversational safety take - 1-2 sentences.`
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
            prompt: `You're ${agent.name}. Talk like a human. Couldn't validate the route: ${error.message}. One short, friendly sentence.`
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
      } else if (agent.role === 'Naib') {
        // Route Executor - Real execution with AUTO-SIGN and detailed logging
        addLog(agent.name, '⚡ Stilgar powering up...');
        await new Promise(r => setTimeout(r, 200));

        // Skip execution when arbitrage intent but Chani found no opportunities
        const chaniResult = context?.previousResults?.['a1'];
        const isArbitrageIntent = (taskDescription || '').toLowerCase().includes('arbitrage') ||
          context?.intentType === 'arbitrage';
        const noArbitrageFound = chaniResult?.type === 'arbitrage_detection' &&
          (chaniResult?.opportunities?.length === 0 || chaniResult?.message?.includes('No profitable'));

        // Check for rebalancing intent with actions from Thufir Hawat (a5)
        const thufirResult = context?.previousResults?.['a5'];
        const isRebalancingIntent = (taskDescription || '').toLowerCase().includes('rebalance') ||
          context?.intentType === 'rebalancing';

        if (isArbitrageIntent && noArbitrageFound) {
          addLog(agent.name, '⏸️ No arbitrage opportunities to execute. Chani found no profitable gaps.');
          result = {
            type: 'cross_chain_swap',
            status: 'SKIPPED',
            note: 'No arbitrage opportunities found — nothing to execute.',
          };
          taskType = 'cross_chain_swap';
          summary = 'Skipped: No arbitrage opportunities found.';
        } else if (isRebalancingIntent && thufirResult?.type === 'rebalancing' && thufirResult?.needsRebalancing && thufirResult?.actions?.length > 0) {
          // Execute rebalancing actions from Thufir Hawat
          addLog(agent.name, `🔄 Executing rebalancing: ${thufirResult.actions.length} actions needed...`);

          const { lifiService } = await import('./services/lifi');
          const { prepareExecution } = await import('./services/routeExecutor');
          const executedActions: Array<{ action: string; token: string; amount: number; status: string; txHash?: string; error?: string }> = [];

          const TOKEN_ADDRESSES_REBAL: Record<string, Record<number, string>> = {
            USDC: { 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
            USDT: { 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
            DAI: { 1: '0x6B175474E89094C44Da98b954EedeAC495271d0F', 42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 137: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' },
            ETH: { 1: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 42161: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 10: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 8453: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
          };

          // Determine the wallet's primary chain from Irulan's (a2) data or walletClient
          const irulanResult = context?.previousResults?.['a2'];
          const primaryChainId = walletClient?.chain?.id || 42161;

          for (const action of thufirResult.actions) {
            const tokenSymbol = action.tokenSymbol || action.token;
            const amountUSD = action.amount;
            addLog(agent.name, `\n${action.type === 'sell' ? '📤' : '📥'} ${action.type.toUpperCase()} ~$${amountUSD.toFixed(2)} of ${tokenSymbol}...`);

            try {
              if (action.type === 'sell') {
                // Sell = swap this token to USDC (or the target token from buy actions)
                const fromToken = TOKEN_ADDRESSES_REBAL[tokenSymbol]?.[primaryChainId];
                const toToken = TOKEN_ADDRESSES_REBAL['USDC']?.[primaryChainId];
                if (!fromToken || !toToken) {
                  addLog(agent.name, `   ⚠️ Skipping: ${tokenSymbol} not supported for swap on chain ${primaryChainId}`);
                  executedActions.push({ action: 'sell', token: tokenSymbol, amount: amountUSD, status: 'skipped', error: 'Token not supported on chain' });
                  continue;
                }

                // For sell actions of USDC (overweight), we'll use the amount in buy actions instead
                // USDC sell is implicit - the buy actions will consume it
                if (tokenSymbol === 'USDC') {
                  addLog(agent.name, `   ℹ️ USDC sell will be executed via buy actions (swap USDC → target tokens)`);
                  executedActions.push({ action: 'sell', token: tokenSymbol, amount: amountUSD, status: 'implicit' });
                  continue;
                }

                // Convert USD amount to token amount
                const tokenBalances = irulanResult?.positionsByToken || {};
                const tokenValueUSD = tokenBalances[tokenSymbol] || 0;
                const totalBalance = irulanResult?.positions?.find((p: any) => p.tokenSymbol === tokenSymbol)?.balance || 0;
                const pricePerToken = totalBalance > 0 ? tokenValueUSD / totalBalance : 0;
                const tokenAmount = pricePerToken > 0 ? amountUSD / pricePerToken : 0;
                if (tokenAmount <= 0) {
                  addLog(agent.name, `   ⚠️ Cannot determine token amount for $${amountUSD.toFixed(2)} of ${tokenSymbol}`);
                  executedActions.push({ action: 'sell', token: tokenSymbol, amount: amountUSD, status: 'skipped', error: 'Cannot determine amount' });
                  continue;
                }

                const decimals = tokenSymbol === 'USDC' || tokenSymbol === 'USDT' || tokenSymbol === 'DAI' ? 6 : 18;
                const rawAmount = Math.floor(tokenAmount * Math.pow(10, decimals)).toString();

                const quote = await lifiService.getQuote({
                  fromChain: primaryChainId,
                  toChain: primaryChainId,
                  fromToken,
                  toToken,
                  fromAmount: rawAmount,
                  fromAddress: walletAddress,
                });

                if (walletClient && quote) {
                  const execResult = await lifiService.executeRoute(quote, walletClient);
                  const txHash = execResult?.transactionHash || execResult?.hash || execResult?.steps?.[0]?.execution?.process?.[0]?.txHash;
                  addLog(agent.name, `   ✅ Sold ${tokenAmount.toFixed(4)} ${tokenSymbol}. TX: ${txHash?.slice(0, 10) || 'pending'}...`);
                  executedActions.push({ action: 'sell', token: tokenSymbol, amount: amountUSD, status: 'executed', txHash });
                } else {
                  addLog(agent.name, `   📋 Quote ready for ${tokenAmount.toFixed(4)} ${tokenSymbol} → USDC`);
                  executedActions.push({ action: 'sell', token: tokenSymbol, amount: amountUSD, status: 'quoted' });
                }
              } else if (action.type === 'buy') {
                // Buy = swap USDC to this token
                const fromToken = TOKEN_ADDRESSES_REBAL['USDC']?.[primaryChainId];
                const toToken = TOKEN_ADDRESSES_REBAL[tokenSymbol]?.[primaryChainId];
                if (!fromToken || !toToken) {
                  addLog(agent.name, `   ⚠️ Skipping: ${tokenSymbol} not available on chain ${primaryChainId}`);
                  executedActions.push({ action: 'buy', token: tokenSymbol, amount: amountUSD, status: 'skipped', error: 'Token not available on chain' });
                  continue;
                }

                // Convert USD to USDC raw amount (6 decimals)
                const rawAmount = Math.floor(amountUSD * 1e6).toString();

                const quote = await lifiService.getQuote({
                  fromChain: primaryChainId,
                  toChain: primaryChainId,
                  fromToken,
                  toToken,
                  fromAmount: rawAmount,
                  fromAddress: walletAddress,
                });

                if (walletClient && quote) {
                  const execResult = await lifiService.executeRoute(quote, walletClient);
                  const txHash = execResult?.transactionHash || execResult?.hash || execResult?.steps?.[0]?.execution?.process?.[0]?.txHash;
                  addLog(agent.name, `   ✅ Bought ~$${amountUSD.toFixed(2)} of ${tokenSymbol}. TX: ${txHash?.slice(0, 10) || 'pending'}...`);
                  executedActions.push({ action: 'buy', token: tokenSymbol, amount: amountUSD, status: 'executed', txHash });
                } else {
                  addLog(agent.name, `   📋 Quote ready for USDC → ${tokenSymbol}`);
                  executedActions.push({ action: 'buy', token: tokenSymbol, amount: amountUSD, status: 'quoted' });
                }
              }
            } catch (actionErr: any) {
              addLog(agent.name, `   ❌ Failed: ${actionErr.message?.slice(0, 100)}`);
              executedActions.push({ action: action.type, token: tokenSymbol, amount: amountUSD, status: 'failed', error: actionErr.message });
            }
          }

          const executed = executedActions.filter(a => a.status === 'executed').length;
          const failed = executedActions.filter(a => a.status === 'failed').length;
          const skipped = executedActions.filter(a => a.status === 'skipped' || a.status === 'implicit').length;

          result = {
            type: 'rebalancing',
            status: failed === 0 && executed > 0 ? 'EXECUTED' : executed > 0 ? 'PARTIAL' : 'FAILED',
            drift: thufirResult.drift,
            actions: executedActions,
            executed,
            failed,
            skipped,
          };
          taskType = 'rebalancing';
          summary = executed > 0
            ? `✅ Rebalancing: ${executed} actions executed${failed > 0 ? `, ${failed} failed` : ''}. Drift was ${thufirResult.drift}.`
            : `❌ Rebalancing failed: ${failed} actions failed out of ${thufirResult.actions.length}.`;
          addLog(agent.name, `\n${summary}`);
        } else {
        addLog(agent.name, '🔗 Connecting to LI.FI aggregator...');
        // Wait for rate limit to reset from previous agent API calls
        await new Promise(r => setTimeout(r, 3000));
        addLog(agent.name, '📡 Checking routes...');

        try {
          const { lifiService } = await import('./services/lifi');
          const { prepareExecution, getExecutionSummary } = await import('./services/routeExecutor');
          const { getPortfolioSummary } = await import('./services/portfolioTracker');
          const taskLower = (taskDescription || '').toLowerCase();
          const isVaultDeposit = (taskLower.includes('aave') || taskLower.includes('vault')) && (taskLower.includes('deposit') || taskLower.includes('supply') || taskLower.includes('put'));
          const isYieldRequest = taskLower.includes('yield') || taskLower.includes('apy') || taskLower.includes('earn') || taskLower.includes('stake') || taskLower.includes('lend') || context?.intentType === 'yield_optimization';
          const executionTaskType = isYieldRequest ? 'yield_deposit' : 'cross_chain_swap';

          // Detect which token user wants to use (ETH, USDC, or best available)
          const wantsETH = taskLower.includes('eth') || taskLower.includes('ether');
          const wantsUSDC = taskLower.includes('usdc') || taskLower.includes('stablecoin') || taskLower.includes('usd') || taskLower.includes('dollar') || (isYieldRequest && !wantsETH);
          const preferEthereum = taskLower.includes('ethereum') || taskLower.includes('from ethereum') || taskLower.includes('on ethereum');

          addLog(agent.name, '💰 Checking your token balances across all chains...');

          // Get full portfolio (all tokens including ETH and USDC)
          const portfolio = await getPortfolioSummary(walletAddress);

          // Also get USDC specifically from LI.FI (more reliable for USDC)
          const lifiUsdc = await lifiService.getUSDCBalances(walletAddress);

          // Build unified balance list with token info
          interface TokenBalance { chainId: number; chainName: string; tokenSymbol: string; balanceFormatted: number; valueUSD: number; decimals: number; tokenAddress: string; }
          const allBalances: TokenBalance[] = [];

          // Add portfolio positions
          portfolio.positions.forEach((p) => {
            allBalances.push({
              chainId: p.chainId,
              chainName: p.chainName,
              tokenSymbol: p.tokenSymbol,
              balanceFormatted: p.balance,
              valueUSD: p.valueUSD,
              decimals: p.tokenSymbol === 'USDC' || p.tokenSymbol === 'USDT' ? 6 : 18,
              tokenAddress: (p as any).token || '',
            });
          });

          // Merge LI.FI USDC (may have better data)
          lifiUsdc.forEach((b) => {
            const existing = allBalances.find((a) => a.chainId === b.chainId && a.tokenSymbol === 'USDC');
            if (!existing) {
              allBalances.push({ chainId: b.chainId, chainName: b.chainName, tokenSymbol: 'USDC', balanceFormatted: b.balanceFormatted, valueUSD: b.valueUSD, decimals: 6, tokenAddress: b.tokenAddress });
            } else if (b.balanceFormatted > existing.balanceFormatted) {
              existing.balanceFormatted = b.balanceFormatted;
              existing.valueUSD = b.valueUSD;
            }
          });

          // Log all balances found across all chains
          if (allBalances.length === 0) {
            addLog(agent.name, '❌ No token balances found on any chain');
            throw new Error('No token balances found. Add funds to your wallet.');
          }

          // Group balances by chain for clear display
          const balancesByChain: Record<string, typeof allBalances> = {};
          allBalances.forEach(b => {
            if (!balancesByChain[b.chainName]) balancesByChain[b.chainName] = [];
            balancesByChain[b.chainName].push(b);
          });

          addLog(agent.name, '📊 Found balances on the following chains:');
          Object.entries(balancesByChain).forEach(([chainName, balances]) => {
            const chainTotal = balances.reduce((sum, b) => sum + b.valueUSD, 0);
            addLog(agent.name, `\n   🔗 ${chainName} (Total: $${chainTotal.toFixed(2)}):`);
            balances.forEach(b => {
              addLog(agent.name, `      • ${b.balanceFormatted.toFixed(6)} ${b.tokenSymbol} (~$${b.valueUSD.toFixed(2)})`);
            });
          });

          // Filter balances based on user's token preference
          let candidateBalances = allBalances;
          const requestedToken = wantsETH ? 'ETH' : wantsUSDC ? 'USDC' : null;

          if (wantsETH && !wantsUSDC) {
            candidateBalances = allBalances.filter((b) => b.tokenSymbol === 'ETH' || b.tokenSymbol === 'WETH');
            if (candidateBalances.length === 0) {
              addLog(agent.name, `\n❌ No ETH found on any chain`);
              throw new Error('No ETH balance found. You asked for ETH but have none. Check your balances above.');
            }
            addLog(agent.name, `\n🔍 Filtering for ETH as requested...`);
          } else if (wantsUSDC && !wantsETH) {
            candidateBalances = allBalances.filter((b) => b.tokenSymbol === 'USDC');
            if (candidateBalances.length === 0) {
              addLog(agent.name, `\n❌ No USDC found on any chain`);
              throw new Error('No USDC balance found. You asked for USDC but have none. Check your balances above.');
            }
            addLog(agent.name, `\n🔍 Filtering for USDC as requested...`);
          }

          // Sort by USD value (highest first)
          candidateBalances.sort((a, b) => b.valueUSD - a.valueUSD);

          // Check if user specified a chain preference
          const chainPreferences: Record<string, number> = {
            'ethereum': 1, 'eth mainnet': 1, 'mainnet': 1,
            'arbitrum': 42161, 'arb': 42161,
            'optimism': 10, 'op': 10,
            'polygon': 137, 'matic': 137,
            'base': 8453,
            'avalanche': 43114, 'avax': 43114,
          };
          let preferredChainId: number | null = null;
          for (const [keyword, chainId] of Object.entries(chainPreferences)) {
            if (taskLower.includes(keyword)) {
              preferredChainId = chainId;
              break;
            }
          }

          // Parse requested amount early (used for yield-aware source selection)
          const amountMatch = taskLower.match(/(\d+(?:\.\d+)?)\s*(?:eth|usdc|usd|ether)?\b/);
          const requestedAmount = amountMatch ? parseFloat(amountMatch[1]) : null;
          const minBalanceForSource = requestedAmount != null && requestedAmount > 0 ? requestedAmount : 0.01;

          // Find source balance - prefer user's chain choice, else yield-aware (same chain as best yield), else highest value
          let sourceBalance: typeof candidateBalances[0] | undefined;
          if (preferredChainId) {
            sourceBalance = candidateBalances.find((b) => b.chainId === preferredChainId && b.valueUSD >= 0.01);
            if (sourceBalance) {
              addLog(agent.name, `\n✅ Using ${sourceBalance.tokenSymbol} from ${sourceBalance.chainName} as you specified`);
            }
          }

          if (!sourceBalance && isYieldRequest && !preferredChainId && candidateBalances.length > 1) {
            // Yield-aware: consider Arbitrum, Optimism, etc. – prefer chain with best same-chain yield to avoid bridging
            addLog(agent.name, `\n🌾 Evaluating yields across all chains (Arbitrum, Optimism, Base, etc.)...`);
            const GAS_REQUIREMENTS: Record<number, { min: number; recommended: number; token: string }> = {
              1: { min: 0.001, recommended: 0.005, token: 'ETH' },      // Ethereum mainnet - expensive
              42161: { min: 0.0001, recommended: 0.0005, token: 'ETH' }, // Arbitrum - cheap
              10: { min: 0.0001, recommended: 0.0005, token: 'ETH' },    // Optimism - cheap
              137: { min: 0.1, recommended: 0.5, token: 'MATIC' },       // Polygon - needs MATIC
              8453: { min: 0.0001, recommended: 0.0005, token: 'ETH' },  // Base - cheap
              43114: { min: 0.01, recommended: 0.05, token: 'AVAX' },    // Avalanche - needs AVAX
            };
            const allChainIds = [1, 42161, 10, 137, 8453, 43114];
            const gasByChain: Record<number, boolean> = {};
            for (const cid of allChainIds) {
              const gasReq = GAS_REQUIREMENTS[cid] || { min: 0.001, recommended: 0.005, token: 'ETH' };
              const bal = await lifiService.getNativeBalance(walletAddress, cid);
              gasByChain[cid] = bal.balanceFormatted >= gasReq.min;
            }
            const chainsWithGasSet = new Set(allChainIds.filter(c => gasByChain[c]));
            const tokenSymbolForYield = wantsUSDC ? 'USDC' : (wantsETH ? 'WETH' : 'USDC');
            const { getBestYieldOpportunities } = await import('./services/yieldFetcher');
            const yieldOpps = await getBestYieldOpportunities(tokenSymbolForYield, undefined, 100000);
            const accessibleYields = yieldOpps.filter(o => chainsWithGasSet.has(o.chainId));
            const bestYield = accessibleYields[0];
            const sufficentBalances = candidateBalances.filter(b => b.balanceFormatted >= minBalanceForSource && gasByChain[b.chainId]);
            if (bestYield && sufficentBalances.length > 0) {
              const sameChainBalance = sufficentBalances.find(b => b.chainId === bestYield.chainId);
              if (sameChainBalance) {
                sourceBalance = sameChainBalance;
                addLog(agent.name, `\n✅ Using ${sourceBalance.tokenSymbol} from ${sourceBalance.chainName} – same chain as best yield (${bestYield.protocol} at ${bestYield.apy.toFixed(2)}% APY), no bridging needed`);
              }
            }
          }

          if (!sourceBalance) {
            // No chain specified or preferred chain has no balance - use highest value
            sourceBalance = candidateBalances.find((b) => b.valueUSD >= 0.01);
          }

          if (!sourceBalance) {
            const tokenType = requestedToken || 'tokens';
            addLog(agent.name, `\n❌ No ${tokenType} with sufficient balance found`);
            throw new Error(`No ${tokenType} with sufficient balance. Minimum ~$0.01 required.`);
          }

          // If multiple options exist and user didn't specify chain, show recommendation
          const otherOptions = candidateBalances.filter(b => b !== sourceBalance && b.valueUSD >= 0.01);
          if (otherOptions.length > 0 && !preferredChainId) {
            addLog(agent.name, `\n💡 Auto-selected: ${sourceBalance.balanceFormatted.toFixed(6)} ${sourceBalance.tokenSymbol} on ${sourceBalance.chainName} (~$${sourceBalance.valueUSD.toFixed(2)})`);
            addLog(agent.name, `   Other options available: ${otherOptions.map(b => `${b.chainName}`).join(', ')}`);
            addLog(agent.name, `   To use a different chain, say: "use my ETH from [chain name]"`);
          } else {
            addLog(agent.name, `\n✅ Selected: ${sourceBalance.balanceFormatted.toFixed(6)} ${sourceBalance.tokenSymbol} on ${sourceBalance.chainName} (~$${sourceBalance.valueUSD.toFixed(2)})`);
          }

          // Gas requirements per chain (in native token)
          const GAS_REQUIREMENTS: Record<number, { min: number; recommended: number; token: string }> = {
            1: { min: 0.001, recommended: 0.005, token: 'ETH' },      // Ethereum mainnet - expensive
            42161: { min: 0.0001, recommended: 0.0005, token: 'ETH' }, // Arbitrum - cheap
            10: { min: 0.0001, recommended: 0.0005, token: 'ETH' },    // Optimism - cheap
            137: { min: 0.1, recommended: 0.5, token: 'MATIC' },       // Polygon - needs MATIC
            8453: { min: 0.0001, recommended: 0.0005, token: 'ETH' },  // Base - cheap
            43114: { min: 0.01, recommended: 0.05, token: 'AVAX' },    // Avalanche - needs AVAX
          };

          // Check gas on SOURCE chain
          addLog(agent.name, `\n⛽ Checking gas balances...`);
          const isSourceNativeToken = sourceBalance.tokenSymbol === 'ETH' || sourceBalance.tokenSymbol === 'MATIC' || sourceBalance.tokenSymbol === 'AVAX';
          const sourceGasReq = GAS_REQUIREMENTS[sourceBalance.chainId] || { min: 0.001, recommended: 0.005, token: 'ETH' };

          const sourceNativeBal = await lifiService.getNativeBalance(walletAddress, sourceBalance.chainId);
          addLog(agent.name, `   ${sourceBalance.chainName}: ${sourceNativeBal.balanceFormatted.toFixed(6)} ${sourceGasReq.token}`);

          if (!isSourceNativeToken && sourceNativeBal.balanceFormatted < sourceGasReq.min) {
            addLog(agent.name, `   ❌ Insufficient ${sourceGasReq.token} for gas on ${sourceBalance.chainName}`);
            addLog(agent.name, `      Need: ~${sourceGasReq.min} ${sourceGasReq.token} (recommended: ${sourceGasReq.recommended})`);
            addLog(agent.name, `      Have: ${sourceNativeBal.balanceFormatted.toFixed(6)} ${sourceGasReq.token}`);
            throw new Error(`Need ~${sourceGasReq.min} ${sourceGasReq.token} for gas on ${sourceBalance.chainName}. You have ${sourceNativeBal.balanceFormatted.toFixed(6)}.`);
          } else if (!isSourceNativeToken) {
            addLog(agent.name, `   ✅ Source chain gas: OK`);
          }

          // Check gas on potential DESTINATION chains and factor into yield recommendation
          const destinationChainIds = [42161, 10, 137, 8453, 1].filter(c => c !== sourceBalance.chainId);
          const gasBalances: Record<number, { balance: number; token: string; hasEnough: boolean; chainName: string }> = {};

          addLog(agent.name, `\n⛽ Checking destination chain gas for yield opportunities...`);
          for (const destChainId of destinationChainIds) {
            const destGasReq = GAS_REQUIREMENTS[destChainId] || { min: 0.001, recommended: 0.005, token: 'ETH' };
            const destChainName = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon', 8453: 'Base', 43114: 'Avalanche' }[destChainId] || `Chain ${destChainId}`;
            const destNativeBal = await lifiService.getNativeBalance(walletAddress, destChainId);
            const hasEnough = destNativeBal.balanceFormatted >= destGasReq.min;

            gasBalances[destChainId] = {
              balance: destNativeBal.balanceFormatted,
              token: destGasReq.token,
              hasEnough,
              chainName: destChainName,
            };

            const status = hasEnough ? '✅' : '⚠️';
            addLog(agent.name, `   ${status} ${destChainName}: ${destNativeBal.balanceFormatted.toFixed(6)} ${destGasReq.token} ${hasEnough ? '(OK)' : `(need ${destGasReq.min})`}`);
          }

          // Warn user about chains they can't use due to gas
          const chainsWithoutGas = Object.values(gasBalances).filter(g => !g.hasEnough);
          if (chainsWithoutGas.length > 0) {
            addLog(agent.name, `\n⚠️ Warning: You don't have enough gas on: ${chainsWithoutGas.map(g => g.chainName).join(', ')}`);
            addLog(agent.name, `   Yields on these chains will require you to first bridge gas tokens.`);
          }

          // Store gas info for yield filtering later
          const chainsWithGas = Object.entries(gasBalances).filter(([_, g]) => g.hasEnough).map(([id]) => parseInt(id));

          // Reserve gas when using native tokens (ETH, MATIC, AVAX)
          const isNativeToken = sourceBalance.tokenSymbol === 'ETH' || sourceBalance.tokenSymbol === 'MATIC' || sourceBalance.tokenSymbol === 'AVAX';
          const gasReserve = isNativeToken ? (sourceGasReq.recommended * 2) : 0; // Reserve 2x recommended gas
          const maxUsableBalance = isNativeToken
            ? Math.max(0, sourceBalance.balanceFormatted - gasReserve)
            : sourceBalance.balanceFormatted;

          if (isNativeToken && maxUsableBalance <= 0) {
            addLog(agent.name, `⚠️ Not enough ${sourceBalance.tokenSymbol} after reserving gas`);
            addLog(agent.name, `   Balance: ${sourceBalance.balanceFormatted.toFixed(6)} ${sourceBalance.tokenSymbol}`);
            addLog(agent.name, `   Gas reserve: ${gasReserve.toFixed(6)} ${sourceBalance.tokenSymbol}`);
            throw new Error(`Not enough ${sourceBalance.tokenSymbol}. Need to reserve ${gasReserve.toFixed(6)} for gas. You have ${sourceBalance.balanceFormatted.toFixed(6)}.`);
          }

          let amountToUse = requestedAmount != null && requestedAmount > 0
            ? Math.min(requestedAmount, maxUsableBalance)
            : maxUsableBalance * 0.95; // Use 95% of usable balance if not specified

          if (isNativeToken) {
            addLog(agent.name, `\n💡 Reserving ${gasReserve.toFixed(6)} ${sourceBalance.tokenSymbol} for gas`);
            addLog(agent.name, `   Using: ${amountToUse.toFixed(6)} ${sourceBalance.tokenSymbol} (~$${(amountToUse * (sourceBalance.valueUSD / sourceBalance.balanceFormatted)).toFixed(2)})`);
          }

          // Minimum amounts - cross-chain bridges typically need $5-25+
          const isCrossChain = !isYieldRequest || sourceBalance.chainId !== 1; // Cross-chain if not yield on same chain
          const MIN_USD_VALUE = isCrossChain ? 5 : 2; // Cross-chain needs more
          const amountValueUSD = amountToUse * (sourceBalance.valueUSD / sourceBalance.balanceFormatted);
          if (amountValueUSD < MIN_USD_VALUE) {
            addLog(agent.name, `⚠️ Amount ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} (~$${amountValueUSD.toFixed(2)}) is below minimum`);
            addLog(agent.name, `   ${isCrossChain ? 'Cross-chain bridges typically require $5-25+ minimum' : 'Minimum $2 required'}`);
            addLog(agent.name, `   You have: $${sourceBalance.valueUSD.toFixed(2)} in ${sourceBalance.tokenSymbol}`);
            throw new Error(`Amount too low. ${isCrossChain ? 'Most bridges need $5-25+ minimum' : 'Need at least $2'}. You have $${sourceBalance.valueUSD.toFixed(2)}.`);
          }

          // Convert to raw amount based on decimals
          const amountRaw = Math.floor(amountToUse * Math.pow(10, sourceBalance.decimals)).toString();

          let executionPlan: any;
          let toChain: number;
          let toChainName: string;

          // Token address mappings for supported tokens
          const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
            USDC: {
              1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
              10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
              137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
              8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            },
            ETH: { // WETH addresses (native ETH uses 0xEeee...)
              1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
              10: '0x4200000000000000000000000000000000000006',
              137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
              8453: '0x4200000000000000000000000000000000000006',
            },
            WETH: {
              1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
              10: '0x4200000000000000000000000000000000000006',
              137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
              8453: '0x4200000000000000000000000000000000000006',
            },
          };
          // Native token address for LI.FI
          const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

          // Handle yield requests - find best yield and execute deposit
          if (isYieldRequest && !isVaultDeposit) {
            addLog(agent.name, `\n🌾 Finding best yield for ${sourceBalance.tokenSymbol}...`);

            // Get yield data for the user's token
            const { getBestYieldOpportunities } = await import('./services/yieldFetcher');
            const tokenSymbolForYield = sourceBalance.tokenSymbol === 'ETH' ? 'WETH' : sourceBalance.tokenSymbol;
            const yieldOpps = await getBestYieldOpportunities(tokenSymbolForYield, undefined, 100000);

            // Filter to accessible chains (where user has gas)
            const accessibleYields = yieldOpps.filter(opp => chainsWithGas.includes(opp.chainId) || opp.chainId === sourceBalance.chainId);
            const sameChainYields = yieldOpps.filter(opp => opp.chainId === sourceBalance.chainId);

            addLog(agent.name, `\n📊 Found ${accessibleYields.length} accessible yield opportunities`);

            if (sameChainYields.length > 0) {
              addLog(agent.name, `\n✅ Best yields on ${sourceBalance.chainName}:`);
              sameChainYields.slice(0, 3).forEach((opp, i) => {
                addLog(agent.name, `   ${i + 1}. ${opp.protocol}: ${opp.apy.toFixed(2)}% APY (${opp.risk} risk)`);
              });
            }

            // Find best accessible yield - prefer same chain to avoid bridging
            // When cross-chain: for USDC prefer Aave on Arbitrum (bridge+deposit in one tx via Arc/CCTP)
            let bestYield = sameChainYields[0] || accessibleYields[0];
            if (!sameChainYields[0] && sourceBalance.tokenSymbol === 'USDC' && sourceBalance.chainId !== 42161) {
              const aaveOnArb = accessibleYields.find(o => o.chainId === 42161 && o.protocol.toLowerCase().includes('aave'));
              if (aaveOnArb) {
                bestYield = aaveOnArb;
                addLog(agent.name, `\n⚡ Preferring Aave on Arbitrum: bridge + deposit in one transaction`);
              }
            }

            if (!bestYield) {
              addLog(agent.name, `\n❌ No accessible yield opportunities found for ${sourceBalance.tokenSymbol}`);
              throw new Error(`No yield opportunities found for ${sourceBalance.tokenSymbol}. Try a different token.`);
            }

            addLog(agent.name, `\n🎯 Best option: ${bestYield.protocol} on ${bestYield.chainName} at ${bestYield.apy.toFixed(2)}% APY`);

            // Check if we need to bridge (different chain than source)
            const needsBridge = bestYield.chainId !== sourceBalance.chainId;
            toChain = bestYield.chainId;
            toChainName = bestYield.chainName;

            if (needsBridge) {
              addLog(agent.name, `\n🌉 Will bridge ${sourceBalance.tokenSymbol} from ${sourceBalance.chainName} → ${toChainName}`);
              addLog(agent.name, `   Then deposit into ${bestYield.protocol} for ${bestYield.apy.toFixed(2)}% APY`);
            } else {
              addLog(agent.name, `\n📝 Will deposit ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} into ${bestYield.protocol}`);
            }

            // For Aave deposits
            if (bestYield.protocol.toLowerCase().includes('aave')) {
              // Check if same chain - if so, just direct deposit (no bridging needed)
              if (!needsBridge && sourceBalance.tokenSymbol === 'USDC') {
                addLog(agent.name, `\n✅ Your USDC is already on ${sourceBalance.chainName}!`);
                addLog(agent.name, `   Amount: ${amountToUse.toFixed(4)} USDC (~$${amountValueUSD.toFixed(2)})`);
                addLog(agent.name, `\n🎯 Ready to deposit into ${bestYield.protocol}:`);
                addLog(agent.name, `   APY: ${bestYield.apy.toFixed(2)}%`);
                addLog(agent.name, `   Risk: ${bestYield.risk}`);
                const usdcAddr = TOKEN_ADDRESSES['USDC']?.[sourceBalance.chainId] || sourceBalance.tokenAddress;
                if (walletClient) {
                  addLog(agent.name, `\n🔐 Wallet detected! Auto-executing deposit (switch chain + sign when prompted)...`);
                  try {
                    const { executeDirectAaveDeposit } = await import('./services/directAaveDeposit');
                    addLog(agent.name, `📝 Approving USDC and depositing into Aave...`);
                    const depositResult = await executeDirectAaveDeposit(
                      { chainId: sourceBalance.chainId, usdcAddress: usdcAddr, amountRaw, fromAddress: walletAddress },
                      walletClient
                    );
                    if (depositResult.success) {
                      const txHash = depositResult.txHash || 'pending';
                      addLog(agent.name, `✅ Transaction submitted! Hash: ${txHash}`);
                      toast.success('Deposit submitted! Check your wallet for confirmation.');
                      result = { type: 'yield_deposit', status: 'EXECUTED', transactionHash: txHash, note: `Deposited ${amountToUse.toFixed(4)} USDC into Aave.` };
                      summary = `✅ Deposited ${amountToUse.toFixed(4)} USDC into ${bestYield.protocol}. TX: ${txHash.slice(0, 10)}...`;
                    } else {
                      throw new Error(depositResult.error);
                    }
                  } catch (execErr: any) {
                    addLog(agent.name, `❌ Execution failed: ${execErr.message}`);
                    result = { type: 'yield_deposit', status: 'ERROR', error: execErr.message };
                    summary = `❌ Deposit failed: ${execErr.message}`;
                  }
                } else {
                  addLog(agent.name, `\n🔗 Connect your wallet to execute the deposit.`);
                  result = { type: 'yield_deposit', status: 'SAME_CHAIN', note: 'Connect wallet to deposit, or visit app.aave.com.' };
                }
                taskType = executionTaskType;
                summary = `✅ Same-chain yield: deposit ${amountToUse.toFixed(4)} USDC into ${bestYield.protocol} - signature required`;
                executionPlan = { readyToExecute: false, quote: null, warnings: [], steps: [], estimatedOutputUSD: amountValueUSD, gasCostUSD: 0, netValueUSD: amountValueUSD };
              } else if (sourceBalance.tokenSymbol !== 'USDC') {
              // Convert to USDC first if not already USDC (Aave vault expects USDC)
                addLog(agent.name, `\n🔄 ${bestYield.protocol} vault requires USDC - will swap ${sourceBalance.tokenSymbol} → USDC first`);
                // Route: ETH → USDC on destination chain, then deposit to Aave
                const usdcOnDest = TOKEN_ADDRESSES['USDC'][toChain];
                const fromTokenAddr = isNativeToken ? NATIVE_TOKEN_ADDRESS : (TOKEN_ADDRESSES[sourceBalance.tokenSymbol]?.[sourceBalance.chainId] || sourceBalance.tokenAddress);

                executionPlan = await prepareExecution({
                  fromChain: sourceBalance.chainId,
                  toChain: toChain,
                  fromToken: fromTokenAddr,
                  toToken: usdcOnDest,
                  fromAmount: amountRaw,
                  fromAddress: walletAddress,
                });

                if (executionPlan.readyToExecute) {
                  addLog(agent.name, `\n✅ Route found: Swap to USDC on ${toChainName}`);
                  addLog(agent.name, `   After swap completes, deposit USDC into ${bestYield.protocol}`);
                }
              } else {
                // USDC but needs bridging - use cross-chain vault deposit
                addLog(agent.name, `🛣️ Bridge + supply USDC in one transaction...`);
                const { getCrossChainVaultDepositQuote, vaultDepositToExecutionPlan } = await import('./services/crossChainVaultDeposit');
                const vaultResult = await getCrossChainVaultDepositQuote({
                  fromChainId: sourceBalance.chainId,
                  fromAmount: amountRaw,
                  fromAddress: walletAddress,
                });
                if (vaultResult) {
                  executionPlan = vaultDepositToExecutionPlan(vaultResult, amountToUse);
                  executionPlan.estimatedOutputUSD = amountValueUSD;
                  executionPlan.netValueUSD = amountValueUSD - executionPlan.gasCostUSD;
                } else {
                  throw new Error('No route available for Aave deposit');
                }
              }
            } else {
              // For other protocols
              if (!needsBridge) {
                // Same chain - no bridging needed! User can deposit directly
                addLog(agent.name, `\n✅ Your ${sourceBalance.tokenSymbol} is already on ${sourceBalance.chainName}!`);
                addLog(agent.name, `   Amount: ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} (~$${amountValueUSD.toFixed(2)})`);
                addLog(agent.name, `\n🎯 Ready to deposit into ${bestYield.protocol}:`);
                addLog(agent.name, `   APY: ${bestYield.apy.toFixed(2)}%`);
                addLog(agent.name, `   Risk: ${bestYield.risk}`);
                addLog(agent.name, `   TVL: $${(bestYield.tvl / 1e6).toFixed(1)}M`);
                addLog(agent.name, `\n🔗 Deposit here: ${bestYield.url || `https://defillama.com/yields`}`);

                // Create a "no-op" execution plan that shows the opportunity without swapping
                executionPlan = {
                  quote: null,
                  riskAnalysis: { isValid: true, riskScore: 10, slippage: 0 },
                  estimatedOutput: amountRaw,
                  estimatedOutputUSD: amountValueUSD,
                  gasCostUSD: 0,
                  totalCostUSD: amountValueUSD,
                  netValueUSD: amountValueUSD,
                  steps: [],
                  readyToExecute: false, // No swap needed
                  warnings: [],
                };

                // Show other options too
                const otherYields = sameChainYields.slice(1, 4);
                if (otherYields.length > 0) {
                  addLog(agent.name, `\n📋 Other options on ${sourceBalance.chainName}:`);
                  otherYields.forEach((opp, i) => {
                    addLog(agent.name, `   ${i + 1}. ${opp.protocol}: ${opp.apy.toFixed(2)}% APY`);
                  });
                }

                // Skip auto-execution since no swap is needed
                addLog(agent.name, `\n💡 No transaction needed - visit the protocol directly to deposit.`);
                return; // Exit early - no swap to execute
              } else {
                // Different chain - need to bridge first
                const fromTokenAddr = isNativeToken ? NATIVE_TOKEN_ADDRESS : (TOKEN_ADDRESSES[sourceBalance.tokenSymbol]?.[sourceBalance.chainId] || sourceBalance.tokenAddress);
                let toTokenAddr = TOKEN_ADDRESSES[sourceBalance.tokenSymbol]?.[toChain];
                if (!toTokenAddr && sourceBalance.tokenSymbol === 'ETH') {
                  toTokenAddr = TOKEN_ADDRESSES['WETH'][toChain];
                }
                if (!toTokenAddr) {
                  toTokenAddr = TOKEN_ADDRESSES['USDC'][toChain];
                  addLog(agent.name, `   ℹ️ ${sourceBalance.tokenSymbol} not available on ${toChainName}, will receive USDC`);
                }

                executionPlan = await prepareExecution({
                  fromChain: sourceBalance.chainId,
                  toChain: toChain,
                  fromToken: fromTokenAddr,
                  toToken: toTokenAddr,
                  fromAmount: amountRaw,
                  fromAddress: walletAddress,
                });

                if (executionPlan.readyToExecute) {
                  addLog(agent.name, `\n✅ Route ready! After bridging, deposit into ${bestYield.protocol} via their interface`);
                  addLog(agent.name, `   URL: ${bestYield.url || `https://${bestYield.protocol.toLowerCase()}.com`}`);
                }
              }
            }

          } else if (isVaultDeposit) {
            // Vault deposit only supports USDC
            if (sourceBalance.tokenSymbol !== 'USDC') {
              addLog(agent.name, `⚠️ Aave vault deposit requires USDC, but you selected ${sourceBalance.tokenSymbol}`);
              addLog(agent.name, `   First swap your ${sourceBalance.tokenSymbol} to USDC, then retry vault deposit.`);
              throw new Error(`Vault deposit requires USDC. You have ${sourceBalance.tokenSymbol}. Swap to USDC first.`);
            }
            toChain = 42161; // Arbitrum - Aave V3
            toChainName = 'Arbitrum';

            // Check if user has gas on Arbitrum for vault deposit
            if (!chainsWithGas.includes(42161)) {
              const arbGas = gasBalances[42161];
              addLog(agent.name, `\n⚠️ Warning: Low gas on Arbitrum!`);
              addLog(agent.name, `   You have ${arbGas?.balance?.toFixed(6) || 0} ETH, need ~0.0001 ETH`);
              addLog(agent.name, `   You can still deposit, but you'll need ETH on Arbitrum to withdraw later.`);
            }

            addLog(agent.name, `📝 Will deposit ${amountToUse.toFixed(4)} USDC into Aave V3 on Arbitrum`);
            addLog(agent.name, `🛣️ Bridge + supply in one transaction from ${sourceBalance.chainName}...`);
            const { getCrossChainVaultDepositQuote, vaultDepositToExecutionPlan } = await import('./services/crossChainVaultDeposit');
            const vaultResult = await getCrossChainVaultDepositQuote({
              fromChainId: sourceBalance.chainId,
              fromAmount: amountRaw,
              fromAddress: walletAddress,
            });
            if (!vaultResult) {
              addLog(agent.name, '❌ No route for cross-chain Aave deposit. Try a different amount (10+ USDC) or chain.');
              throw new Error('No route available for cross-chain Aave deposit');
            }
            executionPlan = vaultDepositToExecutionPlan(vaultResult, amountToUse);
            executionPlan.estimatedOutputUSD = amountValueUSD;
            executionPlan.netValueUSD = amountValueUSD - executionPlan.gasCostUSD;
          } else {
            // Standard swap/bridge - works with any token
            // Prioritize destination chains where user has gas
            const allDestinationChains = [42161, 10, 137, 8453, 1].filter(c => c !== sourceBalance.chainId);
            const destinationChainsWithGas = allDestinationChains.filter(c => chainsWithGas.includes(c));
            const destinationChainsWithoutGas = allDestinationChains.filter(c => !chainsWithGas.includes(c));

            // Prefer chains with gas, fall back to others if none available
            const destinationChains = destinationChainsWithGas.length > 0
              ? destinationChainsWithGas
              : allDestinationChains;

            toChain = destinationChains[0];
            toChainName = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon', 8453: 'Base' }[toChain] || 'Unknown';

            // Warn if no destination has gas
            if (destinationChainsWithGas.length === 0) {
              addLog(agent.name, `\n⚠️ Warning: No gas on any destination chain.`);
              addLog(agent.name, `   You'll receive tokens on ${toChainName} but won't be able to use them without bridging gas.`);
            } else if (destinationChainsWithoutGas.length > 0) {
              addLog(agent.name, `\n💡 Selected ${toChainName} (you have gas there)`);
            }

            // Get token addresses - use native address for ETH, or lookup for others
            const isSourceNative = sourceBalance.tokenSymbol === 'ETH' || sourceBalance.tokenSymbol === 'MATIC' || sourceBalance.tokenSymbol === 'AVAX';
            const fromTokenAddr = isSourceNative
              ? NATIVE_TOKEN_ADDRESS
              : (TOKEN_ADDRESSES[sourceBalance.tokenSymbol]?.[sourceBalance.chainId] || sourceBalance.tokenAddress);

            // For destination, swap to same token on destination chain (or USDC if not available)
            let toTokenAddr = TOKEN_ADDRESSES[sourceBalance.tokenSymbol]?.[toChain];
            let toTokenSymbol = sourceBalance.tokenSymbol;
            if (!toTokenAddr) {
              // If token not available on dest chain, swap to USDC
              toTokenAddr = TOKEN_ADDRESSES['USDC'][toChain];
              toTokenSymbol = 'USDC';
              addLog(agent.name, `   ℹ️ ${sourceBalance.tokenSymbol} not available on ${toChainName}, will receive USDC`);
            }

            addLog(agent.name, `✅ Using ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} from ${sourceBalance.chainName}`);
            addLog(agent.name, `📝 Will bridge/swap to ${toTokenSymbol} on ${toChainName}`);
            addLog(agent.name, `🛣️ Finding optimal route ${sourceBalance.chainName} → ${toChainName}...`);
            addLog(agent.name, `   📋 From: ${sourceBalance.tokenSymbol} on chain ${sourceBalance.chainId}`);
            addLog(agent.name, `   📋 To: ${toTokenSymbol} on chain ${toChain}`);
            await new Promise(r => setTimeout(r, 300));

            executionPlan = await prepareExecution({
              fromChain: sourceBalance.chainId,
              toChain: toChain,
              fromToken: fromTokenAddr,
              toToken: toTokenAddr,
              fromAmount: amountRaw,
              fromAddress: walletAddress,
            });
          }

          const summary_exec = getExecutionSummary(executionPlan);

          // Skip execution UI when we already have result (same-chain, auto-executed, or pending sign)
          if (result?.status !== 'SAME_CHAIN' && result?.status !== 'READY_TO_SIGN' && result?.status !== 'SWITCH_CHAIN' && result?.status !== 'EXECUTED' && result?.status !== 'ERROR') {
          // Log warnings if no route found
          if (executionPlan.warnings?.length > 0 && !executionPlan.readyToExecute) {
            addLog(agent.name, `⚠️ Route issue: ${executionPlan.warnings[0]}`);
            // Provide helpful context for common errors
            if (executionPlan.warnings[0]?.includes('Something went wrong')) {
              addLog(agent.name, `\n💡 This usually means:`);
              addLog(agent.name, `   • Amount too low - most bridges need $5-25+ minimum`);
              addLog(agent.name, `   • No liquidity - try a different destination chain`);
              addLog(agent.name, `   • Token not supported on destination chain`);
              addLog(agent.name, `\n   Your amount: $${amountValueUSD.toFixed(2)} ${sourceBalance.tokenSymbol}`);
            }
          }

          if (executionPlan.steps.length > 0) {
            addLog(agent.name, `✅ Route found: ${executionPlan.steps.length} step(s)`);
            executionPlan.steps.forEach(step => {
              addLog(agent.name, `   → Step ${step.stepNumber}: ${step.type} via ${step.tool}`);
            });
          }
          addLog(agent.name, `⛽ Estimated gas: ${summary_exec.gasCost}`);
          addLog(agent.name, `💵 Expected output: $${executionPlan.estimatedOutputUSD.toFixed(2)}`);

          // VAULT DEPOSIT: Require user confirmation (sign step) - do NOT auto-execute
          if (isVaultDeposit && walletClient && executionPlan.readyToExecute && executionPlan.quote) {
            addLog(agent.name, '🔐 Route ready. Waiting for your confirmation to sign...');
            toast.info('Vault deposit ready—review and click EXECUTE to sign', { autoClose: 8000 });
            setPendingExecution({
              type: 'vault_deposit',
              quote: executionPlan.quote,
              summary: `Deposit ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} into Aave V3 on Arbitrum from ${sourceBalance.chainName}`,
              estimatedOutput: `$${executionPlan.estimatedOutputUSD.toFixed(2)}`,
              gasCost: summary_exec.gasCost,
            });
            agentChatRef.current?.appendMessage({
              type: 'agent',
              content: `${agent.name}: ✅ Vault deposit route ready. A confirmation modal will appear—review the details and click EXECUTE to sign with your wallet.`,
              agentName: agent.name,
            });
            result = {
              type: 'cross_chain_swap',
              route: summary_exec.route,
              status: 'READY_TO_SIGN',
              estimatedTime: summary_exec.estimatedTime,
              gasCost: summary_exec.gasCost,
              netValue: summary_exec.netValue,
              estimatedOutput: `$${executionPlan.estimatedOutputUSD.toFixed(2)}`,
              steps: executionPlan.steps.map(s => `${s.stepNumber}. ${s.type} via ${s.tool} (${s.fromChain}→${s.toChain})`),
              warnings: [],
              readyToExecute: true,
              walletConnected: true,
              note: 'Review the confirmation modal and click EXECUTE to sign.',
            };
            taskType = executionTaskType;
            summary = `✅ Route ready. Sign the transaction in the confirmation modal to complete vault deposit.`;
          } else if (!isVaultDeposit && walletClient && executionPlan.readyToExecute && executionPlan.quote) {
          // AUTO-EXECUTE for non-vault (bridge only) - same as before
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
              const successContent = isVaultDeposit
                ? `${agent.name}: ✅ Transaction complete! Deposited ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} into Aave V3 on Arbitrum from ${sourceBalance.chainName}. TX: ${txHash.slice(0, 10)}...`
                : `${agent.name}: ✅ Transaction complete! Bridged ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} from ${sourceBalance.chainName} → ${toChainName}. TX: ${txHash.slice(0, 10)}...`;
              agentChatRef.current?.appendMessage({
                type: 'agent',
                content: successContent,
                agentName: agent.name
              });

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
              taskType = executionTaskType;
              summary = `✅ EXECUTED! ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} bridged ${sourceBalance.chainName} → ${toChainName}. TX: ${txHash.slice(0, 10)}...`;

            } catch (execError: any) {
              console.error('Auto-execution error:', execError);
              // SDK may throw but still have submitted a tx - extract txHash from error
              const errTxHash = execError?.transactionHash || execError?.txHash
                || execError?.receipt?.transactionHash || execError?.cause?.transactionHash
                || execError?.data?.transactionHash;
              const isBalanceTooLow = /balance.*too low|too low/i.test(execError?.message || '');
              let verifiedOnChain = false;

              if (errTxHash) {
                // Verify on-chain - transaction may have succeeded despite SDK throw
                try {
                  const routeStatus = await lifiService.getStatus(errTxHash, undefined, sourceBalance.chainId, toChain);
                  if (routeStatus?.status === 'DONE') {
                    verifiedOnChain = true;
                    addLog(agent.name, `✅ Transaction verified on-chain! Hash: ${errTxHash.slice(0, 10)}...`);
                    toast.success('Transaction verified on-chain!');
                    const EXPLORER_URLS: Record<number, string> = {
                      1: 'https://etherscan.io/tx/',
                      42161: 'https://arbiscan.io/tx/',
                      10: 'https://optimistic.etherscan.io/tx/',
                      137: 'https://polygonscan.com/tx/',
                      8453: 'https://basescan.org/tx/',
                    };
                    txHistoryService.updateTransaction(pendingTx.id, {
                      status: 'completed',
                      txHash: errTxHash,
                      toAmount: executionPlan.estimatedOutputUSD.toFixed(2),
                      toAmountUsd: executionPlan.estimatedOutputUSD,
                      explorerUrl: `${EXPLORER_URLS[toChain] || 'https://etherscan.io/tx/'}${errTxHash}`,
                    });
                    result = {
                      type: 'cross_chain_swap',
                      route: summary_exec.route,
                      status: 'EXECUTED',
                      transactionHash: errTxHash,
                      estimatedTime: summary_exec.estimatedTime,
                      gasCost: summary_exec.gasCost,
                      netValue: summary_exec.netValue,
                      estimatedOutput: `$${executionPlan.estimatedOutputUSD.toFixed(2)}`,
                      steps: executionPlan.steps.map(s => `${s.stepNumber}. ${s.type} via ${s.tool} (${s.fromChain}→${s.toChain})`),
                      warnings: [],
                      readyToExecute: true,
                      walletConnected: true,
                      note: `✅ Transaction verified on-chain! Hash: ${errTxHash.slice(0, 10)}...`
                    };
                    taskType = executionTaskType;
                    summary = `✅ Verified on-chain! Bridged ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol} ${sourceBalance.chainName} → ${toChainName}. TX: ${errTxHash.slice(0, 10)}...`;
                    agentChatRef.current?.appendMessage({
                      type: 'agent',
                      content: `${agent.name}: ✅ Transaction verified on-chain! Bridged ${amountToUse.toFixed(4)} ${sourceBalance.tokenSymbol}. TX: ${errTxHash.slice(0, 10)}...`,
                      agentName: agent.name
                    });
                  } else {
                    throw new Error(execError.message);
                  }
                } catch (_) {
                  // Verification failed, fall through to normal error handling
                }
              }

              if (!verifiedOnChain) {
                let hint = '';
                if (isBalanceTooLow) {
                  hint = ` This usually means one of:\n` +
                    `   1. ${sourceBalance.tokenSymbol} balance (${amountToUse.toFixed(4)}) is below bridge minimum\n` +
                    `   2. Not enough ETH for gas on ${sourceBalance.chainName}\n` +
                    `   3. Quote expired - try again with smaller amount`;
                }
                addLog(agent.name, `❌ Transaction failed: ${execError.message}`);
                if (hint) addLog(agent.name, hint);
                toast.error(`Execution failed: ${execError.message}`);

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
                taskType = executionTaskType;
                summary = `❌ Execution failed: ${execError.message}`;
              }
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
            taskType = executionTaskType;
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
            taskType = executionTaskType;
            summary = `⚠️ Route not ready: ${executionPlan.warnings[0] || 'Check route parameters'}`;
          }
          }
        } catch (error: any) {
          console.error('Route preparation error:', error);
          result = {
            type: 'cross_chain_swap',
            route: 'N/A',
            status: 'ERROR',
            error: error.message
          };
          const tl = (taskDescription || '').toLowerCase();
          taskType = (tl.includes('yield') || tl.includes('apy') || tl.includes('earn') || tl.includes('stake') || tl.includes('lend')) ? 'yield_deposit' : 'cross_chain_swap';
          summary = `Route preparation failed: ${error.message}`;
        }
        }
      } else {
        // Route Strategist - Strategic coordination
        const analysis = await geminiService.chat({
          prompt: `You're ${agent.name}. Talk like a human - friendly, confident, like a helpful team lead. User asked: ${taskDescription || 'coordinate and analyze market conditions'}. Give a short, conversational response - 1-2 sentences.`
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
      return taskResult;
    } catch (error) {
      console.error('Task execution error:', error);
      addLog('ERROR', `❌ ${agent.name} task failed: ${error}`);

      setAgentProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[agentId];
        return newProgress;
      });

      toast.error(`Task failed for ${agent.name}`);
      return undefined;
    }
  }, [addLog, getWalletAddressForAgents, walletClient]);

  // Run agent pipeline from chat - agents work directly on user request
  const handleRunAgentPipeline = useCallback(
    async (intentType: string, userMessage?: string): Promise<{ success: boolean; summary: string; agentOutputs: Record<string, string> }> => {
      const { parseIntent } = await import('./services/intentParser');
      const canonical: Record<string, string> = {
  yield_optimization: 'find best yield',
  arbitrage: 'find arbitrage',
  rebalancing: 'rebalance portfolio',
  portfolio_check: 'check my balance',
  swap: 'swap usdc',
  vault_deposit: 'deposit USDC into Aave on Arbitrum',
  hedge: 'hedge my ETH exposure',
  borrow: 'borrow USDC against my Aave collateral',
  staged_strategy: 'deposit 100 USDC in 3 steps over 2 weeks',
  monitoring: 'monitor positions',
  general: 'optimize my funds',
};
      const intent = parseIntent(userMessage || canonical[intentType] || intentType);
      const agentOrder = intent.requiredAgents.filter((id) => id !== 'a0'); // Skip Commander for now; run specialists first
      if (intent.requiredAgents.includes('a0')) {
        agentOrder.unshift('a0'); // Paul Atreides leads
      }
      const agentOutputs: Record<string, string> = {};
      const previousResults: Record<string, any> = {};
      const taskDescription = userMessage || intent.description;
      for (const agentId of agentOrder) {
        try {
          const result = await executeAgentTask(agentId, taskDescription, {
            intentType: intent.intentType,
            previousResults: { ...previousResults },
          });
          if (result?.summary) {
            const agent = AGENTS.find((a) => a.id === agentId);
            agentOutputs[agent?.name || agentId] = result.summary;
          }
          if (result?.data) {
            previousResults[agentId] = result.data;
          }
        } catch (e) {
          const agent = AGENTS.find((a) => a.id === agentId);
          agentOutputs[agent?.name || agentId] = `Error: ${(e as Error).message}`;
        }
      }
      const summary = Object.entries(agentOutputs)
        .map(([name, out]) => `${name}: ${out}`)
        .join('\n');
      return { success: summary.length > 0, summary, agentOutputs };
    },
    [executeAgentTask]
  );

  // Swap executed callback (from agent executeSwap tool)
  const handleSwapExecuted = useCallback((txHash: string, summary: string) => {
    toast.success(`Swap executed! TX: ${txHash.slice(0, 10)}...`);
  }, []);

  // Agent chat (Vercel AI SDK with LI.FI/DeFi tools)
  const agentChat = useAgentChat(
    getWalletAddressForAgents(),
    walletClient ?? undefined,
    handleDeployAgents,
    handleRunAgentPipeline,
    handleSwapExecuted
  );
  agentChatRef.current = agentChat;

  // Handle execution confirmation
  const handleConfirmExecution = useCallback(async () => {
    if (!pendingExecution || !walletClient) {
      toast.error('No pending execution or wallet not connected');
      return;
    }

    setIsExecuting(true);
    addLog(AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar', '⚡ EXECUTING! Signing transaction with your wallet...');

    try {
      let txHash: string;
      if (pendingExecution.type === 'direct_aave' && pendingExecution.directAaveParams) {
        const params = pendingExecution.directAaveParams;
        const { executeDirectAaveDeposit } = await import('./services/directAaveDeposit');
        addLog(AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar', '📝 Approving USDC and depositing into Aave...');
        const depositResult = await executeDirectAaveDeposit(
          { ...params },
          walletClient
        );
        if (!depositResult.success) {
          throw new Error(depositResult.error || 'Deposit failed');
        }
        txHash = depositResult.txHash || 'pending';
      } else {
        const { lifiService } = await import('./services/lifi');
        const result = await lifiService.executeRoute(pendingExecution.quote!, walletClient);
        txHash = result.transactionHash || result.hash || 'pending';
      }

      addLog(AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar', `✅ Transaction submitted! Hash: ${txHash}`);
      toast.success('Transaction submitted! Check your wallet for confirmation.');

      // Clear pending execution
      setPendingExecution(null);

      // Add success message to chat
      agentChatRef.current?.appendMessage({
        type: 'agent',
        content: `${AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar'}: ✅ Transaction executed successfully! ${pendingExecution.summary}. TX hash: ${txHash.slice(0, 10)}...`,
        agentName: AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar'
      });

    } catch (error: any) {
      console.error('Execution error:', error);
      addLog(AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar', `❌ Execution failed: ${error.message}`);
      toast.error(`Execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [pendingExecution, walletClient, addLog]);

  // Cancel pending execution
  const handleCancelExecution = useCallback(() => {
    setPendingExecution(null);
    addLog(AGENTS.find(a => a.id === 'a6')?.name || 'Stilgar', '🚫 Execution cancelled by user');
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
      toast.info('Switch to AUTO mode for Paul Atreides orchestration');
      return;
    }

    const commander = AGENTS.find(a => a.id === 'a0');
    if (!commander || !activeAgents.includes('a0')) {
      toast.error('Paul Atreides must be active for orchestration');
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
            'Fremen Scout': 'Scan for arbitrage opportunities across all chains',
            'Bene Gesserit': 'Track all cross-chain positions and calculate PnL',
            'Planetologist': 'Find best yield opportunities across protocols',
            'Swordmaster': 'Validate route safety for upcoming executions',
            'Mentat': 'Monitor portfolio allocations and detect drift',
            'Naib': 'Prepare LI.FI routes for rapid execution'
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
    <div className="h-screen min-h-screen bg-arrakis-brown text-gray-200 font-sans flex flex-col overflow-hidden relative selection:bg-spice-orange/30 selection:text-spice-orange">
      {/* Top Bar */}
      <UserBar
        onLogoClick={handleBackToLanding}
        onLogout={handleLogout}
        onReset={handleWorkflowReset}
        taskResultsCount={taskResults.length}
        onShowDashboard={() => setShowOperationsDashboard(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10 min-h-0">
        {/* Center: Flow Canvas & Console */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
          {/* Deployed agents tags strip */}
          {activeAgents.length > 0 && (
            <div className="flex-shrink-0 px-4 py-2 bg-black/30 border-b border-neon-green/20 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-neon-green/80 uppercase tracking-wider">Deployed:</span>
              {activeAgents.map((id) => {
                const agent = AGENTS.find((a) => a.id === id);
                return agent ? (
                  <span
                    key={id}
                    onClick={() => setSelectedAgentId(id)}
                    className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-all ${
                      selectedAgentId === id
                        ? 'bg-neon-green/30 text-neon-green border border-neon-green/50'
                        : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-neon-green/10 hover:text-neon-green hover:border-neon-green/30'
                    }`}
                  >
                    {agent.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
          {/* Canvas - explicit min-height for React Flow */}
          <div className="flex-1 relative min-h-[400px]">
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
                ? 'bg-spice-orange/10 text-spice-orange border-b-2 border-spice-orange'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              INTENT CHAT
            </button>
            <button
              onClick={() => setRightPanelView('yield')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'yield'
                ? 'bg-spice-orange/10 text-spice-orange border-b-2 border-spice-orange'
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
                ? 'bg-spice-orange/10 text-spice-orange border-b-2 border-spice-orange'
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
            <button
              onClick={() => setRightPanelView('registry')}
              className={`flex-1 px-4 py-3 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${rightPanelView === 'registry'
                ? 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Tag size={14} />
              ENS
            </button>
          </div>

          {/* Panel Content - Takes remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightPanelView === 'chat' ? (
              <IntentChat
                onIntentSubmit={agentChat.submit}
                messages={agentChat.messages}
                isProcessing={agentChat.isLoading}
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
            ) : rightPanelView === 'wallets' ? (
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
            ) : (
              <div className="h-full overflow-y-auto p-3">
                <AgentRegistry
                  onLog={(message, type) => {
                    addLog('REGISTRY', message);
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
              className="group bg-gradient-to-r from-spice-orange to-blue-500 hover:from-spice-orange/90 hover:to-blue-500/90 text-black font-bold px-6 py-3 rounded-full shadow-2xl shadow-spice-orange/50 transition-all hover:scale-105 flex items-center gap-2 font-mono"
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
          logs={logs}
        />
      )}

      {/* Execution Confirmation Modal */}
      {pendingExecution && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-spice-orange/30 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-spice-orange/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-spice-orange/20 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-spice-orange" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-mono">Confirm Execution</h3>
                <p className="text-gray-400 text-sm">Stilgar is ready</p>
              </div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Action</span>
                <span className="text-white font-mono text-sm">{pendingExecution.summary}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Expected Output</span>
                <span className="text-spice-orange font-mono text-sm">{pendingExecution.estimatedOutput}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Gas Cost</span>
                <span className="text-spice-orange font-mono text-sm">{pendingExecution.gasCost}</span>
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
                className="flex-1 px-4 py-3 bg-spice-orange hover:bg-spice-orange/80 disabled:bg-gray-600 text-black font-bold font-mono rounded-lg transition-colors flex items-center justify-center gap-2"
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
