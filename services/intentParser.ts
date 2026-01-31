// Intent Parser - Analyzes user intents and determines agent connections

export interface IntentAnalysis {
  intentType: 'yield_optimization' | 'arbitrage' | 'rebalancing' | 'monitoring' | 'general';
  requiredAgents: string[]; // Agent IDs
  connections: Array<{ source: string; target: string }>;
  description: string;
}

export const parseIntent = (intent: string): IntentAnalysis => {
  const lowerIntent = intent.toLowerCase();
  
  // Yield optimization patterns
  if (
    lowerIntent.includes('yield') ||
    lowerIntent.includes('apy') ||
    lowerIntent.includes('deploy') && (lowerIntent.includes('higher') || lowerIntent.includes('better')) ||
    lowerIntent.includes('best yield') ||
    lowerIntent.includes('optimize yield')
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
      description: 'Setting up cross-chain yield optimization workflow. Agents will monitor yields across chains and automatically move capital to highest APY opportunities.'
    };
  }
  
  // Arbitrage patterns
  if (
    lowerIntent.includes('arbitrage') ||
    lowerIntent.includes('price difference') ||
    lowerIntent.includes('profitable trade') ||
    lowerIntent.includes('price gap')
  ) {
    return {
      intentType: 'arbitrage',
      requiredAgents: ['a0', 'a1', 'a4', 'a6'], // Route Strategist, Arbitrage Hunter, Risk Sentinel, Route Executor
      connections: [
        { source: 'a0', target: 'a1' }, // Strategist → Arbitrage Hunter
        { source: 'a1', target: 'a4' }, // Arbitrage Hunter → Risk Sentinel
        { source: 'a4', target: 'a6' }, // Risk Sentinel → Route Executor
        { source: 'a0', target: 'a6' }  // Strategist → Route Executor
      ],
      description: 'Configuring arbitrage detection system. Agents will scan for price differences across chains and execute profitable trades automatically.'
    };
  }
  
  // Rebalancing patterns
  if (
    lowerIntent.includes('rebalance') ||
    lowerIntent.includes('allocation') ||
    lowerIntent.includes('balance') ||
    lowerIntent.includes('maintain target')
  ) {
    return {
      intentType: 'rebalancing',
      requiredAgents: ['a0', 'a2', 'a5', 'a6'], // Route Strategist, Portfolio Guardian, Rebalancer, Route Executor
      connections: [
        { source: 'a0', target: 'a2' }, // Strategist → Portfolio Guardian
        { source: 'a2', target: 'a5' }, // Portfolio Guardian → Rebalancer
        { source: 'a5', target: 'a6' }, // Rebalancer → Route Executor
        { source: 'a0', target: 'a6' }  // Strategist → Route Executor
      ],
      description: 'Initializing portfolio rebalancing workflow. Agents will monitor allocations and automatically rebalance across chains to maintain target ratios.'
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
      requiredAgents: ['a0', 'a1', 'a2'], // Route Strategist, Arbitrage Hunter, Portfolio Guardian
      connections: [
        { source: 'a0', target: 'a1' }, // Strategist → Arbitrage Hunter
        { source: 'a0', target: 'a2' }  // Strategist → Portfolio Guardian
      ],
      description: 'Setting up monitoring system. Agents will track positions, prices, and opportunities across all chains.'
    };
  }
  
  // General/catch-all - full workflow
  return {
    intentType: 'general',
    requiredAgents: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'], // All agents
    connections: [
      { source: 'a0', target: 'a1' }, // Strategist → Arbitrage Hunter
      { source: 'a0', target: 'a2' }, // Strategist → Portfolio Guardian
      { source: 'a0', target: 'a3' }, // Strategist → Yield Seeker
      { source: 'a1', target: 'a4' }, // Arbitrage Hunter → Risk Sentinel
      { source: 'a3', target: 'a4' }, // Yield Seeker → Risk Sentinel
      { source: 'a2', target: 'a5' }, // Portfolio Guardian → Rebalancer
      { source: 'a4', target: 'a6' }, // Risk Sentinel → Route Executor
      { source: 'a5', target: 'a6' }, // Rebalancer → Route Executor
      { source: 'a0', target: 'a6' }  // Strategist → Route Executor
    ],
    description: 'Activating full cross-chain orchestration system. All agents will work together to optimize your capital across all EVM chains.'
  };
};
