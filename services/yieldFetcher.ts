// Real Yield Fetcher for Cross-Chain DeFi Protocols
// Fetches actual APY data from major DeFi protocols

export interface YieldOpportunity {
  protocol: string;
  chainId: number;
  chainName: string;
  token: string;
  tokenSymbol: string;
  apy: number; // Annual Percentage Yield
  tvl: number; // Total Value Locked in USD
  type: 'lending' | 'staking' | 'liquidity' | 'vault';
  url: string;
  risk: 'low' | 'medium' | 'high';
  lastUpdated: number;
}

// Chain name mappings
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

// Fetch yields from DeFiLlama API (free, no auth required)
async function fetchDefiLlamaYields(): Promise<YieldOpportunity[]> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.status}`);
    }
    
    const data = await response.json();
    const pools = data.data || [];
    
    // Filter for major stablecoins and ETH on supported chains
    const supportedChains = ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Base', 'Avalanche'];
    const supportedTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'ETH', 'USDC.e', 'USDbC', 'AVAX'];
    
    const opportunities: YieldOpportunity[] = pools
      .filter((pool: any) => {
        const chain = pool.chain || '';
        const symbol = pool.symbol || '';
        const apy = pool.apy || 0;
        return (
          supportedChains.includes(chain) &&
          supportedTokens.some(token => symbol.toUpperCase().includes(token)) &&
          apy > 0.1 && // Filter out near-zero APYs
          apy <= 100 && // Filter bloated/inflationary APYs (>100% is usually unsustainable)
          pool.tvlUsd > 100000 // Filter out small pools - use all protocols
        );
      })
      .map((pool: any) => {
        const chainId = getChainId(pool.chain);
        return {
          protocol: pool.project || 'Unknown',
          chainId,
          chainName: pool.chain,
          token: pool.symbol,
          tokenSymbol: extractTokenSymbol(pool.symbol),
          apy: pool.apy || 0,
          tvl: pool.tvlUsd || 0,
          type: getPoolType(pool.project, pool.symbol),
          url: pool.poolMeta?.url || `https://defillama.com/yields/pool/${pool.pool}`,
          risk: getRiskLevel(pool.apy, pool.tvlUsd, pool.project),
          lastUpdated: Date.now(),
        };
      })
      .sort((a: YieldOpportunity, b: YieldOpportunity) => b.apy - a.apy) // Sort by highest APY
      .slice(0, 50); // Limit to top 50 opportunities
    
    return opportunities;
  } catch (error) {
    console.error('DeFiLlama yield fetch error:', error);
    return [];
  }
}

// Get chain ID from chain name
function getChainId(chainName: string): number {
  const chainMap: Record<string, number> = {
    'Ethereum': 1,
    'Arbitrum': 42161,
    'Optimism': 10,
    'Polygon': 137,
    'Base': 8453,
    'Avalanche': 43114,
  };
  return chainMap[chainName] || 1;
}

// Extract token symbol from pool symbol (e.g., "USDC-WETH" -> "USDC")
function extractTokenSymbol(symbol: string): string {
  const tokens = symbol.split('-');
  return tokens[0] || symbol;
}

// Determine pool type based on protocol and symbol - use all protocols
function getPoolType(protocol: string, symbol: string): 'lending' | 'staking' | 'liquidity' | 'vault' {
  const lendingProtocols = ['aave', 'compound', 'spark', 'benqi', 'radiant', 'morpho', 'euler'];
  const stakingProtocols = ['lido', 'rocket-pool', 'frax-ether', 'eigenlayer'];
  const vaultProtocols = ['yearn', 'beefy', 'convex', 'pendle'];
  
  const protocolLower = protocol.toLowerCase();
  
  if (lendingProtocols.some(p => protocolLower.includes(p))) return 'lending';
  if (stakingProtocols.some(p => protocolLower.includes(p))) return 'staking';
  if (vaultProtocols.some(p => protocolLower.includes(p))) return 'vault';
  if (symbol.includes('-') || protocolLower.includes('uniswap') || protocolLower.includes('curve') || protocolLower.includes('velodrome') || protocolLower.includes('aerodrome')) return 'liquidity';
  
  return 'lending';
}

// Determine risk level based on APY, TVL, and protocol - use all protocols
function getRiskLevel(apy: number, tvl: number, protocol: string): 'low' | 'medium' | 'high' {
  const safeProtocols = ['aave', 'compound', 'lido', 'maker', 'morpho', 'curve', 'uniswap', 'yearn'];
  const protocolLower = protocol.toLowerCase();
  
  // Very high APY = higher risk
  if (apy > 50) return 'high';
  if (apy > 20) return 'medium';
  
  // Low TVL = higher risk
  if (tvl < 1000000) return 'high';
  if (tvl < 10000000) return 'medium';
  
  // Safe protocols = lower risk
  if (safeProtocols.some(p => protocolLower.includes(p))) return 'low';
  
  return 'medium';
}

// Aave on Arbitrum - we have full bridge+deposit integration, so ensure it's discoverable for USDC
const ARBITRUM_CHAIN_ID = 42161;

/** Get Aave USDC yield on Arbitrum (used for cross-chain bridge+deposit flow) */
export async function getAaveUsdcArbitrumYield(): Promise<YieldOpportunity | null> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (!response.ok) return null;
    const data = await response.json();
    const pools = data.data || [];
    const pool = pools.find((p: any) =>
      (p.chain === 'Arbitrum' || p.chain === 'arbitrum') &&
      (p.project || '').toLowerCase().includes('aave') &&
      (p.symbol || '').toUpperCase().includes('USDC')
    );
    if (!pool || !pool.apy || pool.apy < 0.1) return null;
    return {
      protocol: pool.project || 'aave-v3',
      chainId: ARBITRUM_CHAIN_ID,
      chainName: 'Arbitrum',
      token: pool.symbol,
      tokenSymbol: 'USDC',
      apy: pool.apy,
      tvl: pool.tvlUsd || 0,
      type: 'lending',
      url: 'https://app.aave.com/',
      risk: 'low',
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// Main function to get best yield opportunities
export async function getBestYieldOpportunities(
  tokenFilter?: string,
  chainFilter?: number,
  minTvl: number = 1000000
): Promise<YieldOpportunity[]> {
  const allOpportunities = await fetchDefiLlamaYields();
  
  let filtered = allOpportunities.filter(opp => opp.tvl >= minTvl);
  
  if (tokenFilter) {
    filtered = filtered.filter(opp => 
      opp.tokenSymbol.toUpperCase().includes(tokenFilter.toUpperCase())
    );
  }
  
  if (chainFilter) {
    filtered = filtered.filter(opp => opp.chainId === chainFilter);
  }
  
  // For USDC: ensure Aave on Arbitrum is included (we have full bridge+deposit integration)
  if (tokenFilter?.toUpperCase().includes('USDC') && !chainFilter) {
    const aaveArb = await getAaveUsdcArbitrumYield();
    if (aaveArb && !filtered.some(o => o.chainId === ARBITRUM_CHAIN_ID && o.protocol.toLowerCase().includes('aave'))) {
      filtered = [aaveArb, ...filtered];
    }
  }
  
  return filtered;
}

// Get yield comparison across chains for a specific token
export async function getYieldComparison(
  tokenSymbol: string = 'USDC'
): Promise<{
  token: string;
  yields: Array<{
    chain: string;
    chainId: number;
    protocol: string;
    apy: number;
    tvl: number;
    risk: string;
  }>;
  bestOpportunity: YieldOpportunity | null;
  averageApy: number;
}> {
  const opportunities = await getBestYieldOpportunities(tokenSymbol);
  
  if (opportunities.length === 0) {
    return {
      token: tokenSymbol,
      yields: [],
      bestOpportunity: null,
      averageApy: 0,
    };
  }
  
  const yields = opportunities.map(opp => ({
    chain: opp.chainName,
    chainId: opp.chainId,
    protocol: opp.protocol,
    apy: opp.apy,
    tvl: opp.tvl,
    risk: opp.risk,
  }));
  
  const averageApy = yields.reduce((sum, y) => sum + y.apy, 0) / yields.length;
  
  return {
    token: tokenSymbol,
    yields,
    bestOpportunity: opportunities[0] || null,
    averageApy,
  };
}

// Find yield opportunities better than current position
export async function findBetterYieldOpportunities(
  currentApy: number,
  tokenSymbol: string = 'USDC',
  minImprovement: number = 2 // Minimum APY improvement percentage
): Promise<YieldOpportunity[]> {
  const opportunities = await getBestYieldOpportunities(tokenSymbol);
  
  return opportunities.filter(opp => opp.apy > currentApy + minImprovement);
}
