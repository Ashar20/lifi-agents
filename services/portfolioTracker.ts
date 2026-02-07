// Real Portfolio Position Tracker
// Queries wallet balances across multiple chains and tracks positions

import { createPublicClient, http, formatUnits, getAddress, type PublicClient } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';

export interface TokenBalance {
  chainId: number;
  chainName: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string; // Raw balance in wei/smallest unit
  balanceFormatted: number; // Human-readable balance
  decimals: number;
  priceUSD: number;
  valueUSD: number;
  logoURI?: string;
}

export interface Position {
  chainId: number;
  chainName: string;
  token: string;
  tokenSymbol: string;
  balance: number;
  valueUSD: number;
  priceUSD: number;
}

export interface PortfolioSummary {
  totalValueUSD: number;
  positions: Position[];
  chains: string[];
  tokenCount: number;
  pnl24h?: number;
  pnlPercent?: number;
  lastUpdated: number;
}

// Chain configurations with RPC endpoints
const CHAIN_CONFIGS = {
  1: { ...mainnet, name: 'Ethereum', rpc: 'https://rpc.ankr.com/eth' },
  42161: { ...arbitrum, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
  10: { ...optimism, name: 'Optimism', rpc: 'https://mainnet.optimism.io' },
  137: { ...polygon, name: 'Polygon', rpc: 'https://polygon-rpc.com' },
  8453: { ...base, name: 'Base', rpc: 'https://mainnet.base.org' },
  43114: { ...avalanche, name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
};

// Common ERC20 token ABIs
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const;

// Native token addresses
const NATIVE_TOKENS = {
  1: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee', symbol: 'ETH', decimals: 18 },
  42161: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee', symbol: 'ETH', decimals: 18 },
  10: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee', symbol: 'ETH', decimals: 18 },
  137: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee', symbol: 'MATIC', decimals: 18 },
  8453: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee', symbol: 'ETH', decimals: 18 },
  43114: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee', symbol: 'AVAX', decimals: 18 },
};

// Common tokens to track (USDC, USDT, DAI, WETH)
const TRACKED_TOKENS: Record<number, Array<{ address: string; symbol: string; decimals: number }>> = {
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
  ],
  42161: [
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', decimals: 6 },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18 },
  ],
  10: [
    { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', decimals: 6 },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6 },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  137: [
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', decimals: 6 },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', decimals: 18 },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18 },
  ],
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    { address: '0xfdeF328C663d2f601BAe19840336e48b36a8fcd1', symbol: 'USDT', decimals: 6 },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  43114: [
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 },
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6 },
    { address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', symbol: 'DAI', decimals: 18 },
    { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', symbol: 'WETH', decimals: 18 },
  ],
};

// Get token price from price fetcher
async function getTokenPrice(chainId: number, tokenAddress: string, tokenSymbol: string): Promise<number> {
  try {
    const { fetchTokenPrice } = await import('./priceFetcher');
    const priceData = await fetchTokenPrice(chainId, tokenAddress, tokenSymbol);
    return priceData?.priceUSD || 0;
  } catch (error) {
    console.warn(`Failed to get price for ${tokenSymbol} on chain ${chainId}:`, error);
    return 0;
  }
}

// Get native token balance (ETH, MATIC, AVAX)
async function getNativeBalance(
  client: PublicClient,
  address: string,
  chainId: number
): Promise<TokenBalance | null> {
  try {
    const balance = await client.getBalance({ address: address as `0x${string}` });
    const nativeToken = NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS];
    if (!nativeToken) return null;

    const balanceFormatted = parseFloat(formatUnits(balance, nativeToken.decimals));
    
    // Get price
    const priceUSD = await getTokenPrice(chainId, nativeToken.address, nativeToken.symbol);
    
    return {
      chainId,
      chainName: CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]?.name || `Chain ${chainId}`,
      tokenAddress: nativeToken.address,
      tokenSymbol: nativeToken.symbol,
      tokenName: nativeToken.symbol,
      balance: balance.toString(),
      balanceFormatted,
      decimals: nativeToken.decimals,
      priceUSD,
      valueUSD: balanceFormatted * priceUSD,
    };
  } catch (error) {
    console.warn(`Failed to get native balance for chain ${chainId}:`, error);
    return null;
  }
}

// Get ERC20 token balance
async function getTokenBalance(
  client: PublicClient,
  address: string,
  tokenAddress: string,
  chainId: number,
  tokenSymbol: string,
  decimals: number
): Promise<TokenBalance | null> {
  try {
    const balance = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    const balanceFormatted = parseFloat(formatUnits(balance as bigint, decimals));
    
    // Skip if balance is 0
    if (balanceFormatted < 0.000001) return null;

    // Get token name
    let tokenName = tokenSymbol;
    try {
      tokenName = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name',
      }) as string;
    } catch {
      // Use symbol if name fetch fails
    }

    // Get price
    const priceUSD = await getTokenPrice(chainId, tokenAddress, tokenSymbol);
    
    return {
      chainId,
      chainName: CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]?.name || `Chain ${chainId}`,
      tokenAddress,
      tokenSymbol,
      tokenName,
      balance: balance.toString(),
      balanceFormatted,
      decimals,
      priceUSD,
      valueUSD: balanceFormatted * priceUSD,
    };
  } catch (error) {
    console.warn(`Failed to get token balance for ${tokenSymbol} on chain ${chainId}:`, error);
    return null;
  }
}

// Fetch all balances for a wallet address across chains
export async function fetchWalletPortfolio(
  walletAddress: string,
  chainIds: number[] = [1, 42161, 10, 137, 8453]
): Promise<TokenBalance[]> {
  if (!walletAddress || !walletAddress.startsWith('0x')) {
    throw new Error('Invalid wallet address. Must be a valid Ethereum address starting with 0x');
  }

  let normalizedAddress: string;
  try {
    normalizedAddress = getAddress(walletAddress);
  } catch (error) {
    throw new Error('Invalid wallet address format');
  }
  const allBalances: TokenBalance[] = [];

  // Fetch balances in parallel for all chains
  const balancePromises = chainIds.map(async (chainId) => {
    const chainConfig = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
    if (!chainConfig) return [];

    try {
      // Create public client for this chain
      const client = createPublicClient({
        chain: chainConfig,
        transport: http(chainConfig.rpc),
      });

      const chainBalances: TokenBalance[] = [];

      // Get native token balance
      const nativeBalance = await getNativeBalance(client, normalizedAddress, chainId);
      if (nativeBalance && nativeBalance.balanceFormatted > 0) {
        chainBalances.push(nativeBalance);
      }

      // Get tracked token balances
      const trackedTokens = TRACKED_TOKENS[chainId] || [];
      const tokenPromises = trackedTokens.map(async (token) => {
        const balance = await getTokenBalance(
          client,
          normalizedAddress,
          token.address,
          chainId,
          token.symbol,
          token.decimals
        );
        return balance;
      });

      const tokenBalances = await Promise.all(tokenPromises);
      chainBalances.push(...tokenBalances.filter((b): b is TokenBalance => b !== null));

      return chainBalances;
    } catch (error) {
      console.error(`Error fetching balances for chain ${chainId}:`, error);
      return [];
    }
  });

  const results = await Promise.all(balancePromises);
  allBalances.push(...results.flat());

  return allBalances;
}

// Get portfolio summary
export async function getPortfolioSummary(
  walletAddress: string,
  chainIds: number[] = [1, 42161, 10, 137, 8453]
): Promise<PortfolioSummary> {
  const balances = await fetchWalletPortfolio(walletAddress, chainIds);
  
  // Convert to positions
  const positions: Position[] = balances.map(b => ({
    chainId: b.chainId,
    chainName: b.chainName,
    token: b.tokenAddress,
    tokenSymbol: b.tokenSymbol,
    balance: b.balanceFormatted,
    valueUSD: b.valueUSD,
    priceUSD: b.priceUSD,
  }));

  // Calculate totals
  const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);
  const chains = [...new Set(positions.map(p => p.chainName))];
  const tokenCount = positions.length;

  // Try to get historical PnL from localStorage
  const historyKey = `portfolio_history_${walletAddress}`;
  const history = localStorage.getItem(historyKey);
  let pnl24h = undefined;
  let pnlPercent = undefined;

  if (history) {
    try {
      const historical = JSON.parse(history);
      const lastValue = historical.totalValueUSD || 0;
      if (lastValue > 0) {
        pnl24h = totalValueUSD - lastValue;
        pnlPercent = (pnl24h / lastValue) * 100;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Save current state for next PnL calculation
  localStorage.setItem(historyKey, JSON.stringify({
    totalValueUSD,
    timestamp: Date.now(),
  }));

  return {
    totalValueUSD,
    positions,
    chains,
    tokenCount,
    pnl24h,
    pnlPercent,
    lastUpdated: Date.now(),
  };
}

// Get positions by chain
export function getPositionsByChain(positions: Position[]): Record<string, Position[]> {
  const byChain: Record<string, Position[]> = {};
  
  positions.forEach(position => {
    if (!byChain[position.chainName]) {
      byChain[position.chainName] = [];
    }
    byChain[position.chainName].push(position);
  });

  return byChain;
}

// Get positions by token
export function getPositionsByToken(positions: Position[]): Record<string, Position[]> {
  const byToken: Record<string, Position[]> = {};
  
  positions.forEach(position => {
    if (!byToken[position.tokenSymbol]) {
      byToken[position.tokenSymbol] = [];
    }
    byToken[position.tokenSymbol].push(position);
  });

  return byToken;
}
