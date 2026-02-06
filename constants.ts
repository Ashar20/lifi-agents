import { AgentRole, AgentMetadata } from './types';

export const AGENTS: AgentMetadata[] = [
  {
    id: 'a0',
    name: 'Route Strategist',
    role: AgentRole.COMMANDER,
    description: 'The strategic mastermind coordinating all cross-chain operations and making critical routing decisions',
    capabilities: ['Strategic Coordination', 'Route Approval', 'Team Management', 'Market Analysis'],
    tokenId: 800400,
    trustScore: 100,
    walletAddress: '0xFF...AAAA',
    spriteSeed: 'lion-king-crown-golden-majestic',
    avatar: '/images/greek1.jpg',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Strategic', 'Decisive', 'Coordinating', 'Analytical'],
      dialogues: [
        'All agents report status. Cross-chain network operational.',
        'Arbitrage Hunter, what opportunities are you seeing?',
        'Excellent execution! Team coordination is solid.',
        'Route Executor, execute this route NOW! Time is critical!',
        'Risk Sentinel, analyze this route before approval.',
        'Portfolio Guardian, drop everything and check allocations!',
        'Yield Seeker, scan for best opportunities across chains.',
        'Rebalancer, maintain target allocations.',
        'Team, maintain formation. We\'re optimizing returns!',
        'Beautiful teamwork! Cross-chain operations running smoothly.'
      ]
    }
  },
  {
    id: 'a1',
    name: 'Arbitrage Hunter',
    role: AgentRole.NAVIGATOR,
    description: 'Sharp-eyed scanner detecting price differences across chains for profitable arbitrage opportunities',
    capabilities: ['Price Monitoring', 'Arbitrage Detection', 'Profit Calculation', 'Route Discovery'],
    tokenId: 800401,
    trustScore: 98,
    walletAddress: '0x71...A9f2',
    spriteSeed: 'eagle-bird-scout-teal-wings',
    avatar: '/images/greek2.jpeg',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Alert', 'Fast', 'Profit-focused', 'Opportunistic'],
      dialogues: [
        '🚨 Route Strategist! New arbitrage opportunity - 0.5% profit on USDC!',
        'Price gap detected: ETH 0.8% cheaper on Arbitrum! Route ready via LI.FI',
        'Triangular arb found: ETH→USDC→DAI→ETH = 1.2% profit',
        'Found 847 price discrepancies! Route Executor, ready to execute?',
        'Opportunity closing fast! Route Strategist, approve NOW!',
        'Profit after fees: $450. Route approved for execution.',
        'Yield Seeker, this arbitrage can fund your yield strategy!',
        'Portfolio Guardian, logging this profit to your tracker.',
        'All clear on my radar... for now. Staying vigilant!',
        'Opportunity level rising! Team, prepare for rapid execution!'
      ]
    }
  },
  {
    id: 'a2',
    name: 'Portfolio Guardian',
    role: AgentRole.ARCHIVIST,
    description: 'The knowledge vault tracking all cross-chain positions, PnL, and historical performance',
    capabilities: ['Position Tracking', 'PnL Analysis', 'Performance Metrics', 'Historical Data'],
    tokenId: 800402,
    trustScore: 99,
    walletAddress: '0x3B...22c1',
    spriteSeed: 'owl-wise-indigo-scholar',
    avatar: '/images/greek3.jpg',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Methodical', 'Data-driven', 'Detailed', 'Analytical'],
      dialogues: [
        'Portfolio status: 60% ETH (target 50%), 40% USDC (target 50%) - drift detected',
        'PnL this week: +$2,450 across 12 cross-chain operations',
        'Route Strategist, analyzed 8 similar routes. Recommend high confidence.',
        'Historical data: Arbitrage Hunter has 87% success rate',
        'Position updated: 0.5 ETH bridged to Arbitrum successfully',
        'Rebalancer, your correction matches 2024 pattern perfectly!',
        'Cross-referencing... Yield Seeker, your APY matches historical average',
        'Database updated with new positions. Team, you\'re doing great!',
        'Historical data suggests this route peaks on weekends. Stay alert!',
        'Fascinating pattern... Arbitrage Hunter, check Polygon next!'
      ]
    }
  },
  {
    id: 'a3',
    name: 'Yield Seeker',
    role: AgentRole.MERCHANT,
    description: 'Your optimistic AI companion finding the best yield opportunities across all chains',
    capabilities: ['Yield Scanning', 'APY Comparison', 'Protocol Analysis', 'Deposit Strategy'],
    tokenId: 800403,
    trustScore: 85,
    walletAddress: '0x9A...B612',
    spriteSeed: 'fox-trader-purple-clever',
    avatar: '/images/greek4.jpg',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Optimistic', 'Analytical', 'Yield-focused', 'Opportunistic'],
      dialogues: [
        'Hello! 😊 Found 12% APY on Arbitrum vs 8% on Ethereum!',
        'This yield opportunity is REAL! Portfolio Guardian confirms it!',
        '⚠️ Aave on Polygon offering 15% USDC yield - moving funds via LI.FI!',
        'Great find! Route Strategist says real yields NEVER ask for upfront fees!',
        'Stop! ✋ That protocol has high risk. Let me verify first!',
        'Don\'t deposit yet! Checking with Risk Sentinel first...',
        'Route Strategist, another yield found! Education is working!',
        'Rebalancer, can you help move funds to this high-yield chain?',
        'You\'re optimized now! 🛡️ Yield Seeker has your back!',
        'Portfolio Guardian helped me track 500% returns already this month!'
      ]
    }
  },
  {
    id: 'a4',
    name: 'Risk Sentinel',
    role: AgentRole.SENTINEL,
    description: 'Cautious analyst validating route safety, slippage tolerance, and bridge security',
    capabilities: ['Route Validation', 'Slippage Analysis', 'Bridge Security', 'Risk Scoring'],
    tokenId: 800404,
    trustScore: 100,
    walletAddress: '0x6C...EE43',
    spriteSeed: 'bear-guardian-black-strong',
    avatar: '/images/greek5.jpeg',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Cautious', 'Thorough', 'Protective', 'Analytical'],
      dialogues: [
        'Route analysis time! 🎯 Risk Sentinel, can I use your safety metrics?',
        'Just validated a route! Route Executor, safe to proceed!',
        'Yield Seeker, this protocol passed my security check!',
        'Creating risk report from Arbitrage Hunter\'s data - it\'s PERFECT!',
        'Route Strategist, analysis complete! Based on real bridge data!',
        'Success! 🎉 Routes now have 95% safety score!',
        'Rebalancer, your route makes AMAZING risk profile!',
        'Interactive validation launching! Arbitrage Hunter\'s routes made this safe!',
        'Team, risk management is working! Failed routes down 40%!',
        'Portfolio Guardian logged my risk scores to 10K routes! Amazing!'
      ]
    }
  },
  {
    id: 'a5',
    name: 'Rebalancer',
    role: AgentRole.ORACLE,
    description: 'Systematic agent maintaining target portfolio allocations across all chains',
    capabilities: ['Allocation Monitoring', 'Drift Detection', 'Rebalancing Execution', 'Target Maintenance'],
    tokenId: 800405,
    trustScore: 96,
    walletAddress: '0xCC...881b',
    spriteSeed: 'wolf-mystic-violet-prophecy',
    avatar: '/images/greek6.png',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Systematic', 'Balanced', 'Disciplined', 'Methodical'],
      dialogues: [
        '🚨 Allocation drift! Portfolio is 60% ETH, 40% USDC (target: 50/50)!',
        'Rebalancing needed! Route Strategist, approve LI.FI route?',
        'Target allocation restored - $2M rebalanced! Route Strategist, this was coordinated!',
        'Validation done: 3 allocation issues! Portfolio Guardian, update tracker!',
        'Drift 15% higher than normal! Route Executor, emergency rebalance!',
        'STOP that trade! Let me check target allocation first!',
        'Risk Sentinel, rebalancing routes NEED validation!',
        'Route Strategist, saved another portfolio today! That\'s 47 this month!',
        'Cross-checked with Portfolio Guardian - allocation matches historical pattern!',
        'Team effort! Arbitrage Hunter spotted it, I rebalanced it, crisis averted!'
      ]
    }
  },
  {
    id: 'a6',
    name: 'Route Executor',
    role: AgentRole.GLITCH,
    description: 'Ultra-fast execution engine running LI.FI routes with minimal latency',
    capabilities: ['Route Execution', 'Transaction Monitoring', 'Status Tracking', 'Failure Handling'],
    tokenId: 800406,
    trustScore: 42,
    walletAddress: '0x00...0000',
    spriteSeed: 'raven-messenger-black-alert',
    avatar: '/images/greek7.jpeg',
    avatarType: 'image' as const,
    status: 'idle',
    personality: {
      traits: ['Fast', 'Reliable', 'Execution-focused', 'Precise'],
      dialogues: [
        '⚡ EXECUTING NOW! Arbitrage Hunter\'s route going via LI.FI!',
        'Sent route in 0.6 seconds! Portfolio Guardian, log this!',
        '🚨 URGENT EXECUTION! Rebalancer\'s route - ALL CHAINS!',
        'Route Strategist, route deployed! Ethereum, Arbitrum, Polygon - all green!',
        'Yield Seeker, your deposit reached 15K users instantly!',
        'Speed record! 0.4 seconds execution! Risk Sentinel, use this stat!',
        'Route execution complete! Arbitrage Hunter, what\'s next?',
        'Portfolio Guardian\'s position updated across all chains! Perfect teamwork!',
        'ALL ROUTES LIVE! Team, your strategies are executing RIGHT NOW!',
        'Lightning fast! ⚡ Route Strategist, awaiting next mission!'
      ]
    }
  }
];

// Detailed agent abilities and LI.FI configurations
export const AGENT_ABILITIES = {
  'a0': { // Route Strategist - Command Center
    primary: 'Strategic Cross-Chain Coordination',
    apis: ['Gemini AI', 'LI.FI SDK'],
    operations: ['Team orchestration', 'Route approval', 'Strategy planning', 'Resource allocation'],
    canExecute: ['coordinate_team', 'approve_routes', 'strategic_planning', 'team_management'],
    apiEndpoints: {
      'Gemini AI': 'https://generativelanguage.googleapis.com/v1beta',
      'LI.FI': 'https://li.quest/v1'
    }
  },
  'a1': { // Arbitrage Hunter - Opportunity Scout
    primary: 'Cross-Chain Arbitrage Detection',
    apis: ['Gemini AI', 'LI.FI SDK', 'DEX APIs'],
    operations: ['Price monitoring', 'Arbitrage detection', 'Profit calculation', 'Route discovery'],
    canExecute: ['detect_arbitrage', 'calculate_profit', 'propose_routes', 'monitor_prices'],
    taskType: 'arbitrage_detection',
    dataSource: 'Multi-chain DEX price feeds',
    apiEndpoints: {
      'Gemini AI': 'https://generativelanguage.googleapis.com/v1beta',
      'LI.FI': 'https://li.quest/v1'
    }
  },
  'a2': { // Portfolio Guardian - Position Tracker
    primary: 'Cross-Chain Position Tracking',
    apis: ['Gemini AI', 'LI.FI SDK', 'Chain APIs'],
    operations: ['Position tracking', 'PnL analysis', 'Performance metrics', 'Historical data'],
    canExecute: ['track_positions', 'calculate_pnl', 'analyze_performance', 'historical_search'],
    taskType: 'position_monitoring',
    dataSource: 'Multi-chain position data',
    apiEndpoints: {
      'Gemini AI': 'https://generativelanguage.googleapis.com/v1beta',
      'LI.FI': 'https://li.quest/v1'
    }
  },
  'a3': { // Yield Seeker - Yield Optimizer
    primary: 'Cross-Chain Yield Optimization',
    apis: ['Gemini AI', 'LI.FI SDK', 'Yield Protocol APIs'],
    operations: ['Yield scanning', 'APY comparison', 'Protocol analysis', 'Deposit strategy'],
    canExecute: ['scan_yields', 'compare_apy', 'analyze_protocols', 'suggest_deposits'],
    taskType: 'yield_optimization',
    dataSource: 'Multi-chain yield protocol data',
    apiEndpoints: {
      'Gemini AI': 'https://generativelanguage.googleapis.com/v1beta',
      'LI.FI': 'https://li.quest/v1'
    }
  },
  'a4': { // Risk Sentinel - Route Validator
    primary: 'Cross-Chain Route Risk Analysis',
    apis: ['Gemini AI', 'LI.FI SDK'],
    operations: ['Route validation', 'Slippage analysis', 'Bridge security', 'Risk scoring'],
    canExecute: ['validate_routes', 'analyze_slippage', 'check_bridges', 'score_risk'],
    taskType: 'risk_analysis',
    dataSource: 'LI.FI route data and bridge metrics',
    apiEndpoints: {
      'Gemini AI': 'https://generativelanguage.googleapis.com/v1beta',
      'LI.FI': 'https://li.quest/v1'
    }
  },
  'a5': { // Rebalancer - Allocation Manager
    primary: 'Cross-Chain Portfolio Rebalancing',
    apis: ['Gemini AI', 'LI.FI SDK'],
    operations: ['Allocation monitoring', 'Drift detection', 'Rebalancing execution', 'Target maintenance'],
    canExecute: ['monitor_allocations', 'detect_drift', 'execute_rebalance', 'maintain_targets'],
    taskType: 'rebalancing',
    dataSource: 'Portfolio position data',
    apiEndpoints: {
      'Gemini AI': 'https://generativelanguage.googleapis.com/v1beta',
      'LI.FI': 'https://li.quest/v1'
    }
  },
  'a6': { // Route Executor - Execution Engine
    primary: 'LI.FI Route Execution',
    apis: ['LI.FI SDK', 'Wallet APIs'],
    operations: ['Route execution', 'Transaction monitoring', 'Status tracking', 'Failure handling'],
    canExecute: ['execute_routes', 'monitor_txs', 'track_status', 'handle_failures'],
    taskType: 'cross_chain_swap',
    responseTime: '< 1 second',
    apiEndpoints: {
      'LI.FI': 'https://li.quest/v1'
    }
  }
};

export const INITIAL_LOGS: any[] = [
  { id: 'sys-1', timestamp: '10:00:00', type: 'SYSTEM', content: '🌐 LI.FI Agents Cross-Chain Orchestrator: ONLINE' },
  { id: 'sys-2', timestamp: '10:00:01', type: 'SYSTEM', content: '🤖 AI Strategy Engine: READY' },
  { id: 'sys-3', timestamp: '10:00:02', type: 'SYSTEM', content: '📡 Multi-Chain Monitoring Grid: ACTIVE' },
  { id: 'sys-4', timestamp: '10:00:03', type: 'SYSTEM', content: '⚡ LI.FI Route Execution System: STANDBY' },
  { id: 'sys-5', timestamp: '10:00:04', type: 'SYSTEM', content: '📚 Cross-Chain Position Database: Ready' },
  { id: 'sys-6', timestamp: '10:00:05', type: 'SYSTEM', content: '✅ All 7 specialized agents awaiting activation...' },
];
