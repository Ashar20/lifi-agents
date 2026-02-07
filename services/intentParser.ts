// Intent Parser - Analyzes user intents and determines agent connections

export interface IntentAnalysis {
  intentType: 'yield_optimization' | 'arbitrage' | 'rebalancing' | 'monitoring' | 'portfolio_check' | 'execute' | 'swap' | 'swap_clarification' | 'vault_deposit' | 'hedge' | 'borrow' | 'staged_strategy' | 'general';
  requiredAgents: string[]; // Agent IDs
  connections: Array<{ source: string; target: string }>;
  description: string;
  needsClarification?: boolean; // When true, don't trigger workflow - ask for details
}

export const parseIntent = (intent: string): IntentAnalysis => {
  const lowerIntent = intent.toLowerCase();
  
  // Yield optimization patterns - including "best use of X USDC from my wallet" or "make best of 1 usd from ethereum"
  if (
    lowerIntent.includes('yield') ||
    lowerIntent.includes('apy') ||
    lowerIntent.includes('best use') ||
    lowerIntent.includes('make best') ||
    (lowerIntent.includes('put my') && (lowerIntent.includes('usdc') || lowerIntent.includes('usdt') || lowerIntent.includes('capital'))) ||
    lowerIntent.includes('earns the most') ||
    lowerIntent.includes('where it earns') ||
    (lowerIntent.includes('deploy') && (lowerIntent.includes('higher') || lowerIntent.includes('better') || lowerIntent.includes('highest'))) ||
    lowerIntent.includes('optimize yield') ||
    (lowerIntent.includes('use my') && (lowerIntent.includes('wallet') || lowerIntent.includes('usdc') || lowerIntent.includes('funds'))) ||
    (lowerIntent.includes('best') && (lowerIntent.includes('yield') || lowerIntent.includes('usdc'))) ||
    (lowerIntent.includes('from') && (lowerIntent.includes('ethereum') || lowerIntent.includes('eth')) && (lowerIntent.includes('usd') || lowerIntent.includes('usdc') || /\d+/.test(lowerIntent)))
  ) {
    return {
      intentType: 'yield_optimization',
      requiredAgents: ['a0', 'a3', 'a4', 'a6'], // Route Strategist, Yield Seeker, Risk Sentinel, Route Executor
      connections: [
        { source: 'a0', target: 'a3' }, // Strategist → Yield Seeker
        { source: 'a3', target: 'a4' }, // Yield Seeker → Risk Sentinel
        { source: 'a4', target: 'a6' }, // Risk Sentinel → Route Executor
        { source: 'a0', target: 'a6' }  // Strategist → Route Executor (direct approval)
      ],
      description: "Got it! I'll find the best place to put your funds so they earn more. Checking yields across chains now."
    };
  }
  
  // Arbitrage patterns
  if (
    lowerIntent.includes('arbitrage') ||
    lowerIntent.includes('price difference') ||
    lowerIntent.includes('profitable trade') ||
    lowerIntent.includes('price gap') ||
    lowerIntent.includes('find me arbitrage')
  ) {
    return {
      intentType: 'arbitrage',
      requiredAgents: ['a0', 'a1', 'a4', 'a6'],
      connections: [
        { source: 'a0', target: 'a1' },
        { source: 'a1', target: 'a4' },
        { source: 'a4', target: 'a6' },
        { source: 'a0', target: 'a6' }
      ],
      description: "On it! Scanning for price gaps across chains - I'll let you know when I find something worth trading."
    };
  }
  
  // Rebalancing patterns
  if (
    lowerIntent.includes('rebalance') ||
    lowerIntent.includes('minimum portfolio') ||
    lowerIntent.includes('allocation') ||
    lowerIntent.includes('balance') && lowerIntent.includes('portfolio') ||
    lowerIntent.includes('maintain target') ||
    lowerIntent.includes('match my targets')
  ) {
    return {
      intentType: 'rebalancing',
      requiredAgents: ['a0', 'a2', 'a5', 'a6'],
      connections: [
        { source: 'a0', target: 'a2' },
        { source: 'a2', target: 'a5' },
        { source: 'a5', target: 'a6' },
        { source: 'a0', target: 'a6' }
      ],
      description: "Checking your allocations now. I'll rebalance things to match your targets across chains."
    };
  }
  
  // Portfolio check - balance queries, fund checks, wallet status
  // This should match BEFORE yield optimization to avoid false positives
  if (
    // Direct balance questions
    lowerIntent.includes('how much') && (lowerIntent.includes('fund') || lowerIntent.includes('usdc') || lowerIntent.includes('balance') || lowerIntent.includes('have') || lowerIntent.includes('wallet') || lowerIntent.includes('money') || lowerIntent.includes('token')) ||
    // What do I have patterns
    lowerIntent.includes('what') && (lowerIntent.includes('do i have') || lowerIntent.includes('funds') || lowerIntent.includes('balance')) ||
    // Check patterns
    lowerIntent.includes('check') && (lowerIntent.includes('fund') || lowerIntent.includes('wallet') || lowerIntent.includes('balance') || lowerIntent.includes('portfolio')) ||
    // Show patterns
    lowerIntent.includes('show') && (lowerIntent.includes('wallet') || lowerIntent.includes('portfolio') || lowerIntent.includes('fund') || lowerIntent.includes('balance')) ||
    // My balance/funds patterns
    lowerIntent.includes('my balance') || lowerIntent.includes('my funds') || lowerIntent.includes('my wallet') ||
    // Direct questions
    lowerIntent.includes('funds i have') || lowerIntent.includes('in my wallet') ||
    lowerIntent.includes('wallet balance') || lowerIntent.includes('total balance') ||
    // USDC specific without action words
    (lowerIntent.includes('usdc') && !lowerIntent.includes('use') && !lowerIntent.includes('swap') && !lowerIntent.includes('send') && !lowerIntent.includes('best') && !lowerIntent.includes('yield') && !lowerIntent.includes('deploy'))
  ) {
    return {
      intentType: 'portfolio_check',
      requiredAgents: ['a2'], // Portfolio Guardian only
      connections: [],
      description: "Checking your wallet now."
    };
  }
  
  // Vague swap requests - ask for clarification with examples (check BEFORE specific swap)
  const hasSwapSpecifics = (
    /\d+/.test(intent) || // has a number (amount)
    lowerIntent.includes('usdc') || lowerIntent.includes('usdt') || lowerIntent.includes('eth') ||
    lowerIntent.includes('ethereum') || lowerIntent.includes('arbitrum') || lowerIntent.includes('polygon') ||
    lowerIntent.includes('optimism') || lowerIntent.includes('base') || lowerIntent.includes('avalanche') ||
    lowerIntent.includes('from') && lowerIntent.includes('to') // "from X to Y"
  );
  if (
    (lowerIntent.includes('swap') || lowerIntent.includes('bridge') || lowerIntent.includes('transfer')) &&
    !hasSwapSpecifics &&
    (
      lowerIntent.includes('can you') || lowerIntent.includes('could you') || lowerIntent.includes('perform') ||
      lowerIntent.includes('do a ') || lowerIntent.includes('help me') || lowerIntent.includes('i want to') ||
      lowerIntent.trim().split(/\s+/).length <= 4 // very short: "swap", "perform a swap", etc.
    )
  ) {
    return {
      intentType: 'swap_clarification',
      requiredAgents: ['a0'],
      connections: [],
      description: "What type of swap would you like? For example: 'Swap 100 USDC from Ethereum to Arbitrum' or 'Bridge my USDC to Polygon for higher yield'.",
      needsClarification: true,
    };
  }

  // Hedge ETH exposure - reduce volatility risk
  if (
    lowerIntent.includes('hedge') && (lowerIntent.includes('eth') || lowerIntent.includes('exposure')) ||
    lowerIntent.includes('reduce eth exposure') ||
    lowerIntent.includes('hedge my eth')
  ) {
    return {
      intentType: 'hedge',
      requiredAgents: ['a0', 'a4', 'a6'],
      connections: [
        { source: 'a0', target: 'a4' },
        { source: 'a4', target: 'a6' },
        { source: 'a0', target: 'a6' }
      ],
      description: "I'll help you hedge your ETH exposure by swapping to USDC."
    };
  }

  // Borrow / leverage
  if (
    lowerIntent.includes('borrow') ||
    lowerIntent.includes('leverage') ||
    (lowerIntent.includes('against') && lowerIntent.includes('collateral'))
  ) {
    return {
      intentType: 'borrow',
      requiredAgents: ['a0', 'a4', 'a6'],
      connections: [
        { source: 'a0', target: 'a4' },
        { source: 'a4', target: 'a6' },
        { source: 'a0', target: 'a6' }
      ],
      description: "I'll help you borrow against your Aave collateral on Arbitrum."
    };
  }

  // Staged strategy / DCA
  if (
    lowerIntent.includes('staged') ||
    lowerIntent.includes('dca') ||
    lowerIntent.includes('steps over') ||
    (lowerIntent.includes('deposit') && lowerIntent.includes('steps'))
  ) {
    return {
      intentType: 'staged_strategy',
      requiredAgents: ['a0', 'a6'],
      connections: [{ source: 'a0', target: 'a6' }],
      description: "I'll create a staged deposit plan for you."
    };
  }

  // Vault deposit - cross-chain deposit into Aave (bridge + supply in one tx)
  if (
    (lowerIntent.includes('deposit') && (lowerIntent.includes('aave') || lowerIntent.includes('vault'))) ||
    (lowerIntent.includes('aave') && (lowerIntent.includes('deposit') || lowerIntent.includes('supply'))) ||
    (lowerIntent.includes('put') && lowerIntent.includes('aave'))
  ) {
    return {
      intentType: 'vault_deposit',
      requiredAgents: ['a0', 'a4', 'a6'],
      connections: [
        { source: 'a0', target: 'a4' },
        { source: 'a4', target: 'a6' },
        { source: 'a0', target: 'a6' }
      ],
      description: "Got it! I'll bridge your USDC and deposit it into Aave V3 on Arbitrum in one transaction."
    };
  }

  // Swap / Bridge / Transfer patterns - IMMEDIATE EXECUTION (has specifics)
  if (
    lowerIntent.includes('swap') ||
    lowerIntent.includes('bridge') ||
    lowerIntent.includes('transfer') && (lowerIntent.includes('to') || lowerIntent.includes('from')) ||
    lowerIntent.includes('send') && (lowerIntent.includes('usdc') || lowerIntent.includes('eth') || lowerIntent.includes('token')) ||
    lowerIntent.includes('move') && (lowerIntent.includes('usdc') || lowerIntent.includes('chain') || lowerIntent.includes('arbitrum') || lowerIntent.includes('optimism') || lowerIntent.includes('polygon') || lowerIntent.includes('base'))
  ) {
    return {
      intentType: 'swap',
      requiredAgents: ['a0', 'a4', 'a6'], // Route Strategist, Risk Sentinel, Route Executor
      connections: [
        { source: 'a0', target: 'a4' },
        { source: 'a4', target: 'a6' },
        { source: 'a0', target: 'a6' }
      ],
      description: "Got it! Preparing your cross-chain swap now. I'll execute it as soon as the route is ready."
    };
  }

  // Execute / run it / go ahead
  if (
    lowerIntent === 'execute it' || lowerIntent === 'run it' || lowerIntent === 'go' ||
    lowerIntent.includes('execute') && lowerIntent.length < 20 ||
    lowerIntent.includes('go ahead') || lowerIntent.includes('do it')
  ) {
    return {
      intentType: 'execute',
      requiredAgents: ['a0', 'a6'], // Route Strategist + Route Executor
      connections: [{ source: 'a0', target: 'a6' }],
      description: "Running it now."
    };
  }
  
  // Monitoring patterns
  if (
    lowerIntent.includes('monitor') ||
    lowerIntent.includes('track') ||
    lowerIntent.includes('watch') ||
    lowerIntent.includes('keep an eye')
  ) {
    return {
      intentType: 'monitoring',
      requiredAgents: ['a0', 'a1', 'a2'],
      connections: [
        { source: 'a0', target: 'a1' },
        { source: 'a0', target: 'a2' }
      ],
      description: "Got you covered. I'll keep an eye on your positions and prices across all chains."
    };
  }
  
  // General/catch-all - full workflow
  return {
    intentType: 'general',
    requiredAgents: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    connections: [
      { source: 'a0', target: 'a1' },
      { source: 'a0', target: 'a2' },
      { source: 'a0', target: 'a3' },
      { source: 'a1', target: 'a4' },
      { source: 'a3', target: 'a4' },
      { source: 'a2', target: 'a5' },
      { source: 'a4', target: 'a6' },
      { source: 'a5', target: 'a6' },
      { source: 'a0', target: 'a6' }
    ],
    description: "Alright, I'm on it! Bringing everyone online to optimize your capital across chains. Give me a sec."
  };
};
