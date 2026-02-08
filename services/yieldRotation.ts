// Yield Rotation Service - Real Cross-Chain Yield Optimization
// NO MOCKS - Real LI.FI execution on testnet/mainnet
// SDK v2: executeRoute(signer, route, settings) - https://docs.li.fi/sdk/execute-routes

import { ChainId, convertQuoteToRoute } from '@lifi/sdk';
import { Web3Provider } from '@ethersproject/providers';
import { createPublicClient, http, formatUnits, parseUnits, Address, erc20Abi } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche, sepolia, arbitrumSepolia, optimismSepolia, baseSepolia } from 'viem/chains';
import { transactionHistory, getExplorerUrl } from './transactionHistory';
import { lifiService, lifi } from './lifi';

// Supported chains configuration with fallback RPCs
export const SUPPORTED_CHAINS = {
  // Mainnet - with fallback RPC endpoints (Ethereum first with multiple reliable options)
  mainnet: [
    { id: 1, name: 'Ethereum', chain: mainnet, rpcs: ['https://eth.drpc.org', 'https://1rpc.io/eth', 'https://cloudflare-eth.com', 'https://rpc.ankr.com/eth'] },
    { id: 42161, name: 'Arbitrum', chain: arbitrum, rpcs: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'] },
    { id: 10, name: 'Optimism', chain: optimism, rpcs: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'] },
    { id: 137, name: 'Polygon', chain: polygon, rpcs: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'] },
    { id: 8453, name: 'Base', chain: base, rpcs: ['https://base.llamarpc.com', 'https://1rpc.io/base', 'https://mainnet.base.org'] },
    { id: 43114, name: 'Avalanche', chain: avalanche, rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'] },
  ],
  // Testnet
  testnet: [
    { id: 11155111, name: 'Sepolia', chain: sepolia, rpcs: ['https://rpc.sepolia.org', 'https://rpc.ankr.com/eth_sepolia'] },
    { id: 421614, name: 'Arbitrum Sepolia', chain: arbitrumSepolia, rpcs: ['https://sepolia-rollup.arbitrum.io/rpc'] },
    { id: 11155420, name: 'Optimism Sepolia', chain: optimismSepolia, rpcs: ['https://sepolia.optimism.io'] },
    { id: 84532, name: 'Base Sepolia', chain: baseSepolia, rpcs: ['https://sepolia.base.org'] },
  ],
};

// Common token addresses (testnet)
export const TESTNET_TOKENS: Record<number, Record<string, Address>> = {
  // Sepolia
  11155111: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle USDC on Sepolia
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Wrapped ETH
  },
  // Arbitrum Sepolia
  421614: {
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    WETH: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
  },
  // Optimism Sepolia
  11155420: {
    USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  // Base Sepolia
  84532: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    WETH: '0x4200000000000000000000000000000000000006',
  },
};

// Mainnet token addresses
export const MAINNET_TOKENS: Record<number, Record<string, Address>> = {
  1: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  42161: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDC.e': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  10: {
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    'USDC.e': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  137: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    'USDC.e': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  43114: {
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    'USDC.e': '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    WETH: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  },
};

export interface Position {
  chainId: number;
  chainName: string;
  token: string;
  tokenAddress: Address;
  balance: bigint;
  balanceFormatted: string;
  decimals: number;
  valueUsd: number;
  currentApy: number;
  protocol?: string;
}

export interface YieldOpportunity {
  chainId: number;
  chainName: string;
  protocol: string;
  token: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  depositAddress?: string;
}

export interface RotationPlan {
  fromPosition: Position;
  toOpportunity: YieldOpportunity;
  apyImprovement: number;
  estimatedAnnualGain: number;
  route: any | null;
  gasCostUsd: number;
  netBenefit: number;
  breakEvenDays: number;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  route?: any;
}

// Create public clients for each chain with fallback RPCs
function getPublicClient(chainId: number, isTestnet: boolean = false, rpcIndex: number = 0) {
  const chains = isTestnet ? SUPPORTED_CHAINS.testnet : SUPPORTED_CHAINS.mainnet;
  const chainConfig = chains.find(c => c.id === chainId);

  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  // Use the specified RPC index, default to first
  const rpcUrl = chainConfig.rpcs[rpcIndex] || chainConfig.rpcs[0];

  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  });
}

// Try RPC call with fallbacks
async function tryWithFallbackRpcs<T>(
  chainId: number,
  isTestnet: boolean,
  operation: (client: ReturnType<typeof createPublicClient>) => Promise<T>
): Promise<T | null> {
  const chains = isTestnet ? SUPPORTED_CHAINS.testnet : SUPPORTED_CHAINS.mainnet;
  const chainConfig = chains.find(c => c.id === chainId);

  if (!chainConfig) return null;

  for (let i = 0; i < chainConfig.rpcs.length; i++) {
    try {
      const client = getPublicClient(chainId, isTestnet, i);
      return await operation(client);
    } catch (error) {
      console.warn(`[Yield] RPC ${chainConfig.rpcs[i]} failed, trying next...`);
      if (i === chainConfig.rpcs.length - 1) {
        console.error(`[Yield] All RPCs failed for chain ${chainId}`);
        throw error;
      }
    }
  }
  return null;
}

// Get token balances for a wallet across chains
export async function getWalletPositions(
  walletAddress: Address,
  isTestnet: boolean = false
): Promise<Position[]> {
  const positions: Position[] = [];
  const chains = isTestnet ? SUPPORTED_CHAINS.testnet : SUPPORTED_CHAINS.mainnet;
  const tokenAddresses = isTestnet ? TESTNET_TOKENS : MAINNET_TOKENS;

  console.log(`[Yield] 🔍 Scanning ${chains.length} chains for wallet positions...`);
  console.log(`[Yield] Chains: ${chains.map(c => c.name).join(', ')}`);
  console.log(`[Yield] Wallet address: ${walletAddress}`);

  // Scan all chains in parallel for better performance
  const chainPromises = chains.map(async (chain) => {
    const chainPositions: Position[] = [];
    const startTime = Date.now();
    console.log(`[Yield] 📡 Starting scan for ${chain.name} (chain ID: ${chain.id}, ${chain.rpcs.length} RPC endpoints)...`);

    const tokens = tokenAddresses[chain.id];

    if (!tokens) {
      console.log(`[Yield] ⚠️ No token addresses configured for ${chain.name}`);
      return chainPositions;
    }

    console.log(`[Yield] Tokens to check on ${chain.name}:`, Object.keys(tokens).join(', '));

    // Try each RPC until one works
    let successfulClient: ReturnType<typeof createPublicClient> | null = null;
    let usedRpc = '';
    for (let rpcIdx = 0; rpcIdx < chain.rpcs.length; rpcIdx++) {
      try {
        console.log(`[Yield] Trying RPC ${rpcIdx + 1}/${chain.rpcs.length} for ${chain.name}: ${chain.rpcs[rpcIdx]}`);
        const client = getPublicClient(chain.id, isTestnet, rpcIdx);
        // Test the RPC with a simple call
        const blockNumber = await client.getBlockNumber();
        successfulClient = client;
        usedRpc = chain.rpcs[rpcIdx];
        console.log(`[Yield] ✓ Connected to ${chain.name} via ${usedRpc} (block: ${blockNumber})`);
        break;
      } catch (error: any) {
        console.warn(`[Yield] RPC ${chain.rpcs[rpcIdx]} failed for ${chain.name}:`, error?.message || 'Unknown error');
      }
    }

    if (!successfulClient) {
      console.error(`[Yield] ❌ All ${chain.rpcs.length} RPCs failed for ${chain.name}`);
      return chainPositions;
    }

    for (const [symbol, address] of Object.entries(tokens)) {
      try {
        console.log(`[Yield] Checking ${symbol} (${address}) on ${chain.name}...`);

        // Get token balance
        const balance = await successfulClient.readContract({
          address: address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [walletAddress],
        });

        console.log(`[Yield] Raw balance for ${symbol} on ${chain.name}: ${balance.toString()}`);

        // Get token decimals
        const decimals = await successfulClient.readContract({
          address: address as Address,
          abi: erc20Abi,
          functionName: 'decimals',
        });

        if (balance > 0n) {
          const balanceFormatted = formatUnits(balance, decimals);
          console.log(`[Yield] ✅ Found ${balanceFormatted} ${symbol} on ${chain.name} (decimals: ${decimals})`);

          chainPositions.push({
            chainId: chain.id,
            chainName: chain.name,
            token: symbol,
            tokenAddress: address as Address,
            balance,
            balanceFormatted,
            decimals,
            valueUsd: parseFloat(balanceFormatted) * (symbol.includes('USD') ? 1 : 2500), // Rough USD estimate
            currentApy: 0, // Will be enriched by yield data
          });
        } else {
          console.log(`[Yield] ⚪ ${symbol} on ${chain.name}: 0`);
        }
      } catch (error: any) {
        console.error(`[Yield] ❌ Error fetching ${symbol} on ${chain.name}:`, error?.message || error);
        console.error(`[Yield] Token address was: ${address}`);
      }
    }

    // Also check native ETH balance
    try {
      const ethBalance = await successfulClient.getBalance({ address: walletAddress });
      if (ethBalance > 0n) {
        const formatted = formatUnits(ethBalance, 18);
        console.log(`[Yield] ✅ Found ${formatted} ETH on ${chain.name}`);
        chainPositions.push({
          chainId: chain.id,
          chainName: chain.name,
          token: 'ETH',
          tokenAddress: '0x0000000000000000000000000000000000000000' as Address,
          balance: ethBalance,
          balanceFormatted: formatted,
          decimals: 18,
          valueUsd: parseFloat(formatted) * 2500,
          currentApy: 0,
        });
      }
    } catch (error: any) {
      console.warn(`[Yield] ⚠️ Error fetching ETH on ${chain.name}:`, error?.message || error);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Yield] ✓ Finished scanning ${chain.name} in ${elapsed}ms - found ${chainPositions.length} positions`);
    return chainPositions;
  });

  // Wait for all chains to complete
  const results = await Promise.all(chainPromises);
  results.forEach(chainPositions => positions.push(...chainPositions));

  // Fallback: if RPC scan returned 0 positions, try portfolio tracker (has fallback RPCs)
  if (positions.length === 0 && !isTestnet) {
    console.log('[Yield] ⚠️ RPC scan found no positions, trying portfolio tracker fallback...');
    try {
      const { getPortfolioSummary } = await import('./portfolioTracker');
      const portfolio = await getPortfolioSummary(walletAddress);
      for (const p of portfolio.positions) {
        const tokens = MAINNET_TOKENS[p.chainId];
        if (!tokens) continue;
        const tokenKey = p.tokenSymbol === 'USDC.e' ? 'USDC.e' : p.tokenSymbol === 'USDbC' ? 'USDbC' : p.tokenSymbol;
        const tokenAddr = tokens[tokenKey] || tokens['USDC'] || tokens['WETH'];
        if (!tokenAddr) continue;
        const decimals = p.tokenSymbol.includes('USD') ? 6 : 18;
        const balanceRaw = BigInt(Math.floor(p.balance * Math.pow(10, decimals)));
        if (balanceRaw === 0n) continue;
        positions.push({
          chainId: p.chainId,
          chainName: p.chainName,
          token: p.tokenSymbol,
          tokenAddress: tokenAddr as Address,
          balance: balanceRaw,
          balanceFormatted: p.balance.toString(),
          decimals,
          valueUsd: p.valueUSD,
          currentApy: 0,
        });
      }
      console.log(`[Yield] 📊 Portfolio fallback: ${positions.length} positions`);
    } catch (err) {
      console.warn('[Yield] Portfolio fallback failed:', err);
    }
  }

  console.log(`[Yield] 📊 Total positions found: ${positions.length}`);
  positions.forEach(p => {
    console.log(`[Yield]    • ${p.token} on ${p.chainName}: ${parseFloat(p.balanceFormatted).toFixed(4)}`);
  });

  return positions;
}

// Trusted protocols with established track records - expanded to use all protocols
const TRUSTED_PROTOCOLS = new Set([
  'aave-v3', 'aave-v2', 'aave', 'compound-v3', 'compound-v2', 'compound',
  'maker', 'makerdao', 'sky',
  'lido', 'rocket-pool', 'frax-ether',
  'curve-dex', 'curve', 'convex-finance',
  'uniswap-v3', 'uniswap-v2', 'uniswap',
  'yearn-finance', 'yearn',
  'morpho', 'morpho-blue', 'morpho-aave',
  'spark', 'spark-lend',
  'fluid', 'fluid-dex', 'instadapp',
  'pendle', 'eigenlayer',
  'gearbox', 'euler',
  'merkl', 'velodrome', 'aerodrome', 'camelot', 'ramses', 'thena',
  'pancakeswap', 'sushiswap', 'trader-joe', 'quickswap',
  'benqi', 'radiant', 'gmx', 'gains-network',
  'beefy', 'convex',
]);

// Protocols known for volatile/incentivized yields - require extra scrutiny
const HIGH_VOLATILITY_PROTOCOLS = new Set([
  'aerodrome', 'velodrome', 'camelot', 'ramses', 'thena',
  'pancakeswap', 'sushiswap', 'trader-joe',
]);

// Calculate risk-adjusted score for yield opportunities
function calculateYieldScore(pool: any): { score: number; risk: 'low' | 'medium' | 'high'; flags: string[] } {
  const flags: string[] = [];
  let riskMultiplier = 1.0;

  const apy = pool.apy || 0;
  const tvl = pool.tvlUsd || 0;
  const protocol = (pool.project || '').toLowerCase();
  const apyBase = pool.apyBase || 0;
  const apyReward = pool.apyReward || 0;
  const ilRisk = pool.ilRisk === 'yes';
  const stablecoin = pool.stablecoin === true;

  // Flag: Unrealistic APY (>100% is almost always unsustainable)
  if (apy > 100) {
    flags.push('unrealistic_apy');
    riskMultiplier *= 0.1; // Heavy penalty
  } else if (apy > 50) {
    flags.push('high_apy');
    riskMultiplier *= 0.5;
  }

  // Flag: Mostly reward-based APY (unsustainable, depends on token emissions)
  if (apyReward > 0 && apyBase > 0) {
    const rewardRatio = apyReward / (apyBase + apyReward);
    if (rewardRatio > 0.8) {
      flags.push('emission_dependent');
      riskMultiplier *= 0.6;
    } else if (rewardRatio > 0.5) {
      flags.push('partially_emission');
      riskMultiplier *= 0.85;
    }
  }

  // Flag: Low TVL relative to APY (potential manipulation or low liquidity)
  if (tvl < 1000000 && apy > 20) {
    flags.push('low_tvl_high_apy');
    riskMultiplier *= 0.7;
  }

  // Flag: Impermanent loss risk
  if (ilRisk) {
    flags.push('il_risk');
    riskMultiplier *= 0.9;
  }

  // Bonus: Trusted protocol
  if (TRUSTED_PROTOCOLS.has(protocol)) {
    riskMultiplier *= 1.3;
  }

  // Penalty: High volatility protocol without high TVL backing
  if (HIGH_VOLATILITY_PROTOCOLS.has(protocol.split('-')[0])) {
    if (tvl < 5000000) {
      flags.push('volatile_protocol');
      riskMultiplier *= 0.7;
    }
  }

  // Bonus: Stablecoin pool (lower risk)
  if (stablecoin) {
    riskMultiplier *= 1.1;
  }

  // Bonus: High TVL (more battle-tested)
  if (tvl > 50000000) {
    riskMultiplier *= 1.2;
  } else if (tvl > 10000000) {
    riskMultiplier *= 1.1;
  }

  // Calculate final score: APY adjusted by risk
  // Use log scale for APY to prevent extreme values from dominating
  const normalizedApy = Math.min(apy, 50); // Cap at 50% for scoring
  const score = normalizedApy * riskMultiplier * Math.log10(tvl / 100000 + 1);

  // Determine risk level
  let risk: 'low' | 'medium' | 'high' = 'medium';
  if (flags.includes('unrealistic_apy') || flags.includes('low_tvl_high_apy')) {
    risk = 'high';
  } else if (TRUSTED_PROTOCOLS.has(protocol) && apy < 20 && tvl > 10000000) {
    risk = 'low';
  } else if (apy > 30 || flags.length >= 2) {
    risk = 'high';
  }

  return { score, risk, flags };
}

// Fetch real yield opportunities from DeFiLlama with intelligent filtering
export async function fetchYieldOpportunities(
  tokenFilter?: string
): Promise<YieldOpportunity[]> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.status}`);
    }

    const data = await response.json();
    const pools = data.data || [];

    const chainNameToId: Record<string, number> = {
      'Ethereum': 1,
      'Arbitrum': 42161,
      'Optimism': 10,
      'Polygon': 137,
      'Base': 8453,
      'Avalanche': 43114,
    };

    const supportedChainNames = Object.keys(chainNameToId);
    const supportedTokens = tokenFilter
      ? [tokenFilter.toUpperCase()]
      : ['USDC', 'USDT', 'DAI', 'WETH', 'USDC.E', 'USDbC', 'ETH'];

    // First pass: filter by basic criteria - use all protocols
    const filtered = pools.filter((pool: any) => {
      const chain = pool.chain || '';
      const symbol = (pool.symbol || '').toUpperCase();
      const apy = pool.apy || 0;
      const tvl = pool.tvlUsd || 0;

      // Basic filters
      if (!supportedChainNames.includes(chain)) return false;
      if (!supportedTokens.some(t => symbol.includes(t))) return false;
      if (apy < 0.5) return false; // Filter out < 0.5%; include bloated yields for visibility
      if (tvl < 300000) return false; // Min $300k TVL to include more protocols

      return true;
    });

    // Second pass: score and rank
    const scored = filtered.map((pool: any) => {
      const { score, risk, flags } = calculateYieldScore(pool);
      return {
        chainId: chainNameToId[pool.chain] || 1,
        chainName: pool.chain,
        protocol: pool.project,
        token: pool.symbol,
        apy: pool.apy,
        apyBase: pool.apyBase || 0,
        apyReward: pool.apyReward || 0,
        tvl: pool.tvlUsd,
        risk,
        score,
        flags,
      };
    });

    // Sort by risk-adjusted score (not raw APY)
    scored.sort((a, b) => b.score - a.score);

    // Log top opportunities for debugging
    console.log('[Yield] 🎯 Top opportunities by risk-adjusted score:');
    scored.slice(0, 5).forEach((opp, i) => {
      console.log(`[Yield]   ${i + 1}. ${opp.protocol} on ${opp.chainName}: ${opp.apy.toFixed(2)}% APY (base: ${opp.apyBase.toFixed(2)}%, reward: ${opp.apyReward.toFixed(2)}%) - Risk: ${opp.risk}, Score: ${opp.score.toFixed(2)}${opp.flags.length ? ` [${opp.flags.join(', ')}]` : ''}`);
    });

    // Return top 50 by score - use all protocols
    return scored.slice(0, 50).map(({ score, flags, apyBase, apyReward, ...opp }) => opp);
  } catch (error) {
    console.error('Error fetching yields:', error);
    return [];
  }
}

// Calculate rotation plan
export async function calculateRotationPlan(
  position: Position,
  targetOpportunity: YieldOpportunity,
  walletAddress: Address
): Promise<RotationPlan | null> {
  try {
    const isCrossChain = position.chainId !== targetOpportunity.chainId;

    // Get LI.FI quote for the transfer
    const tokenAddresses = position.chainId > 100000 ? TESTNET_TOKENS : MAINNET_TOKENS;
    const targetTokens = tokenAddresses[targetOpportunity.chainId];
    
    if (!targetTokens) {
      console.error('Target chain tokens not found');
      return null;
    }
    
    // Find matching token on target chain
    const targetToken = targetTokens[position.token] || targetTokens['USDC'];
    
    if (!targetToken) {
      console.error('Target token not found');
      return null;
    }
    
    // Get quote from LI.FI
    let route = null;
    let gasCostUsd = 0;
    
    // Only get route if cross-chain transfer is needed
    if (isCrossChain) {
      try {
        // Use lifiService (Arc/CCTP for USDC routes) instead of direct lifi.getQuote
        const quote = await lifiService.getQuote({
          fromChain: position.chainId,
          toChain: targetOpportunity.chainId,
          fromToken: position.tokenAddress,
          toToken: targetToken,
          fromAmount: position.balance.toString(),
          fromAddress: walletAddress,
          toAddress: walletAddress,
        });
        
        route = quote;
        
        // Calculate gas costs
        if (quote.estimate?.gasCosts) {
          gasCostUsd = quote.estimate.gasCosts.reduce((sum: number, cost: any) => {
            return sum + parseFloat(cost.amountUSD || '0');
          }, 0);
        }
      } catch (error) {
        console.error('LI.FI quote error:', error);
        // Continue without route for same-chain operations
      }
    }
    
    const apyImprovement = targetOpportunity.apy - position.currentApy;
    const estimatedAnnualGain = (position.valueUsd * apyImprovement) / 100;
    const netBenefit = estimatedAnnualGain - gasCostUsd;
    const breakEvenDays = gasCostUsd > 0 ? (gasCostUsd / (estimatedAnnualGain / 365)) : 0;
    
    return {
      fromPosition: position,
      toOpportunity: targetOpportunity,
      apyImprovement,
      estimatedAnnualGain,
      route,
      gasCostUsd,
      netBenefit,
      breakEvenDays,
    };
  } catch (error) {
    console.error('Error calculating rotation plan:', error);
    return null;
  }
}

// Execute yield rotation using LI.FI
export async function executeYieldRotation(
  plan: RotationPlan,
  walletClient: any, // Wagmi wallet client
  onStatusUpdate?: (status: string) => void
): Promise<ExecutionResult> {
  const walletAddress = walletClient?.account?.address as Address;
  if (!walletClient || !walletAddress) {
    const errMsg = 'Wallet not connected. Please connect your wallet (e.g. MetaMask) to sign the transaction.';
    return { success: false, error: errMsg };
  }

  // Create pending transaction record
  const tx = transactionHistory.addTransaction({
    walletAddress: walletAddress,
    type: 'yield_rotation',
    status: 'pending',
    fromChainId: plan.fromPosition.chainId,
    fromChainName: plan.fromPosition.chainName,
    toChainId: plan.toOpportunity.chainId,
    toChainName: plan.toOpportunity.chainName,
    fromToken: plan.fromPosition.token,
    fromAmount: plan.fromPosition.balanceFormatted,
    fromAmountUsd: plan.fromPosition.valueUsd,
    toToken: plan.toOpportunity.token,
    apyImprovement: plan.apyImprovement,
    gasCostUsd: plan.gasCostUsd,
    protocol: plan.toOpportunity.protocol,
    metadata: {
      fromApy: plan.fromPosition.currentApy,
      toApy: plan.toOpportunity.apy,
      estimatedAnnualGain: plan.estimatedAnnualGain,
    },
  });

  try {
    onStatusUpdate?.('Preparing transaction...');
    
    if (!plan.route) {
      const errMsg = 'Same-chain rotation not supported. Use cross-chain moves via LI.FI.';
      onStatusUpdate?.(errMsg);
      transactionHistory.updateTransaction(tx.id, { status: 'failed', error: errMsg });
      return { success: false, error: errMsg };
    }
    
    onStatusUpdate?.('Requesting wallet signature...');
    transactionHistory.updateTransaction(tx.id, { status: 'confirming' });
    
    // Get ethers Signer (SDK v2 requires Signer)
    const ethereum = (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
    if (!ethereum) {
      throw new Error('No wallet found. Please connect MetaMask or another Web3 wallet.');
    }
    const provider = new Web3Provider(ethereum);
    let signer = provider.getSigner();
    
    // Convert quote (LifiStep) to Route
    const route = convertQuoteToRoute(plan.route);
    
    // Execute via LI.FI SDK - correct signature: executeRoute(signer, route, settings)
    const execution = await lifi.executeRoute(signer, route, {
      updateRouteHook(updatedRoute: any) {
        const step = updatedRoute.steps?.[0];
        if (step?.execution?.status) {
          onStatusUpdate?.(`Step: ${step.execution.status}`);
        }
      },
      switchChainHook: async (chainId: number) => {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + chainId.toString(16) }],
        });
        const newProvider = new Web3Provider(ethereum);
        signer = newProvider.getSigner();
        return signer as any;
      },
      acceptExchangeRateUpdateHook: async () => true,
    });
    
    onStatusUpdate?.('Transaction submitted!');
    
    const txHash = execution.steps?.[0]?.execution?.txHash;
    
    // Update transaction as completed
    transactionHistory.updateTransaction(tx.id, {
      status: 'completed',
      txHash,
      explorerUrl: txHash ? getExplorerUrl(plan.toOpportunity.chainId, txHash) : undefined,
      profitUsd: plan.estimatedAnnualGain / 12, // Rough monthly estimate
    });
    
    return {
      success: true,
      txHash,
      route: execution,
    };
  } catch (error: any) {
    console.error('Execution error:', error);
    
    // Update transaction as failed
    transactionHistory.updateTransaction(tx.id, {
      status: 'failed',
      error: error.message || 'Transaction failed',
    });
    
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
}

// Find the best yield rotation opportunity
export async function findBestRotation(
  walletAddress: Address,
  minApyImprovement: number = 2,
  isTestnet: boolean = false,
  onProgress?: (message: string) => void
): Promise<{
  positions: Position[];
  opportunities: YieldOpportunity[];
  bestPlan: RotationPlan | null;
  allPlans: RotationPlan[];
}> {
  console.log(`[Yield] 🚀 Finding best yield rotation for wallet ${walletAddress.slice(0, 8)}...`);
  onProgress?.('Scanning wallet positions across chains...');

  // Get wallet positions
  const positions = await getWalletPositions(walletAddress, isTestnet);

  console.log(`[Yield] 📊 Found ${positions.length} positions across chains:`);
  positions.forEach(p => {
    console.log(`[Yield]    • ${p.token} on ${p.chainName}: ${parseFloat(p.balanceFormatted).toFixed(4)}`);
  });

  if (positions.length === 0) {
    console.log('[Yield] ⚠️ No positions found in wallet');
    return {
      positions: [],
      opportunities: [],
      bestPlan: null,
      allPlans: [],
    };
  }

  // Get yield opportunities (mainnet only for now - DeFiLlama doesn't track testnet)
  onProgress?.('Fetching yield opportunities from DeFiLlama...');
  console.log('[Yield] 🔍 Fetching yield opportunities from DeFiLlama...');
  const opportunities = await fetchYieldOpportunities();

  // Log unique chains in opportunities
  const uniqueChains = [...new Set(opportunities.map(o => o.chainName))];
  console.log(`[Yield] 📈 Found ${opportunities.length} yield opportunities across ${uniqueChains.length} chains:`);
  console.log(`[Yield]    Chains: ${uniqueChains.join(', ')}`);

  // Calculate rotation plans for each position
  const allPlans: RotationPlan[] = [];
  let planIdx = 0;

  for (const position of positions) {
    onProgress?.(`Checking ${position.chainName} ($${position.valueUsd.toFixed(2)} ${position.token})...`);
    for (const opportunity of opportunities) {
      planIdx++;
      if (planIdx % 30 === 0) onProgress?.(`Checking routes... ${planIdx} combinations`);
      // Skip if same chain and same position type
      if (position.chainId === opportunity.chainId &&
          position.token.includes(opportunity.token.split('-')[0])) {
        continue;
      }

      // Only consider opportunities with significant APY improvement
      if (opportunity.apy - position.currentApy < minApyImprovement) {
        continue;
      }

      const plan = await calculateRotationPlan(position, opportunity, walletAddress);
      if (plan && plan.netBenefit > 0) {
        allPlans.push(plan);
      }
    }
  }

  // Sort by net benefit
  allPlans.sort((a, b) => b.netBenefit - a.netBenefit);

  // Only executable: cross-chain with LI.FI route
  const executablePlans = allPlans.filter(p => p.route !== null);
  const bestPlan = executablePlans.length > 0 ? executablePlans[0] : null;

  console.log(`[Yield] ✅ Generated ${allPlans.length} profitable rotation plans (${executablePlans.length} executable)`);
  if (bestPlan) {
    console.log(`[Yield] 🏆 Best plan: ${bestPlan.fromPosition.chainName} → ${bestPlan.toOpportunity.chainName} (${bestPlan.toOpportunity.protocol}) +${bestPlan.apyImprovement.toFixed(2)}% APY`);
  }

  return {
    positions,
    opportunities,
    bestPlan,
    allPlans,
  };
}

// One-click yield rotation entry point
export async function oneClickYieldRotation(
  walletAddress: Address,
  walletClient: any,
  options: {
    isTestnet?: boolean;
    minApyImprovement?: number;
    maxGasCost?: number;
    onStatusUpdate?: (status: string) => void;
  } = {}
): Promise<{
  success: boolean;
  plan?: RotationPlan;
  result?: ExecutionResult;
  error?: string;
}> {
  const {
    isTestnet = false,
    minApyImprovement = 2,
    maxGasCost = 50,
    onStatusUpdate,
  } = options;
  
  try {
    onStatusUpdate?.('Scanning wallet positions...');
    
    const { positions, bestPlan } = await findBestRotation(
      walletAddress,
      minApyImprovement,
      isTestnet,
      onStatusUpdate
    );
    
    if (positions.length === 0) {
      return {
        success: false,
        error: 'No tokens found in wallet. Ensure you have USDC, USDT, DAI, or WETH on Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche.',
      };
    }
    
    if (!bestPlan) {
      const hasPlans = positions.length > 0;
      const hint = hasPlans
        ? ` Try lowering "Min APY Improvement" in settings, or ensure you have 10+ USDC—cross-chain bridges often need minimum amounts.`
        : '';
      return {
        success: false,
        error: `No opportunities found with >${minApyImprovement}% APY improvement.${hint}`,
      };
    }
    
    if (bestPlan.gasCostUsd > maxGasCost) {
      return {
        success: false,
        error: `Gas cost ($${bestPlan.gasCostUsd.toFixed(2)}) exceeds limit ($${maxGasCost})`,
        plan: bestPlan,
      };
    }
    
    onStatusUpdate?.(`Found opportunity: ${bestPlan.toOpportunity.protocol} on ${bestPlan.toOpportunity.chainName} (${bestPlan.apyImprovement.toFixed(2)}% APY improvement)`);
    
    // Execute the rotation
    const result = await executeYieldRotation(bestPlan, walletClient, onStatusUpdate);
    
    return {
      success: result.success,
      plan: bestPlan,
      result,
      error: result.error,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

// Export for global debugging
if (typeof window !== 'undefined') {
  (window as any).yieldRotation = {
    getWalletPositions,
    fetchYieldOpportunities,
    findBestRotation,
    oneClickYieldRotation,
    calculateRotationPlan,
    executeYieldRotation,
    SUPPORTED_CHAINS,
    TESTNET_TOKENS,
    MAINNET_TOKENS,
  };
  console.log('%c💰 YIELD ROTATION SERVICE', 'color: #00ff88; font-weight: bold; font-size: 14px;');
}
