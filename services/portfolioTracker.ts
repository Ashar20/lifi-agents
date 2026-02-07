// Real Portfolio Position Tracker
// Queries wallet balances across multiple chains and tracks positions

import { createPublicClient, http, fallback, formatUnits, getAddress, type PublicClient } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'viem/chains';

// Fallback RPC URLs per chain (primary first) - improves reliability when one RPC fails
const RPC_URLS: Record<number, string[]> = {
  1: ['https://eth.drpc.org', 'https://1rpc.io/eth', 'https://cloudflare-eth.com', 'https://rpc.ankr.com/eth'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
  10: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
  137: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  8453: ['https://base.llamarpc.com', 'https://1rpc.io/base', 'https://mainnet.base.org'],
  43114: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'],
};

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
  1: { ...mainnet, name: 'Ethereum', rpc: RPC_URLS[1][0] },
  42161: { ...arbitrum, name: 'Arbitrum', rpc: RPC_URLS[42161][0] },
  10: { ...optimism, name: 'Optimism', rpc: RPC_URLS[10][0] },
  137: { ...polygon, name: 'Polygon', rpc: RPC_URLS[137][0] },
  8453: { ...base, name: 'Base', rpc: RPC_URLS[8453][0] },
  43114: { ...avalanche, name: 'Avalanche', rpc: RPC_URLS[43114][0] },
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
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18 },
  ],
  10: [
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6 },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  137: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6 },
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

// Fallback prices for native tokens and stablecoins (used when API fails)
const FALLBACK_PRICES: Record<string, number> = {
  ETH: 2500,
  WETH: 2500,
  MATIC: 0.8,
  AVAX: 35,
  USDC: 1,
  USDT: 1,
  DAI: 1,
};

// Get token price from price fetcher
async function getTokenPrice(chainId: number, tokenAddress: string, tokenSymbol: string): Promise<number> {
  // Use fallback price immediately for known tokens to avoid API delays
  const fallback = FALLBACK_PRICES[tokenSymbol.toUpperCase()];

  try {
    const { fetchTokenPrice } = await import('./priceFetcher');
    const priceData = await fetchTokenPrice(chainId, tokenAddress, tokenSymbol);
    if (priceData?.priceUSD && priceData.priceUSD > 0) {
      return priceData.priceUSD;
    }
  } catch (error) {
    console.warn(`[Portfolio] Price fetch failed for ${tokenSymbol}, using fallback:`, error);
  }

  // Return fallback price if API fails
  return fallback || 0;
}

// Get native token balance (ETH, MATIC, AVAX)
async function getNativeBalance(
  client: PublicClient,
  address: string,
  chainId: number
): Promise<TokenBalance | null> {
  const chainName = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]?.name || `Chain ${chainId}`;
  const nativeToken = NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS];
  if (!nativeToken) return null;

  // Try viem client first
  try {
    const balance = await client.getBalance({ address: address as `0x${string}` });
    const balanceFormatted = parseFloat(formatUnits(balance, nativeToken.decimals));

    console.log(`[Portfolio] ${chainName} native balance via viem: ${balanceFormatted} ${nativeToken.symbol}`);

    // Get price
    const priceUSD = await getTokenPrice(chainId, nativeToken.address, nativeToken.symbol);

    return {
      chainId,
      chainName,
      tokenAddress: nativeToken.address,
      tokenSymbol: nativeToken.symbol,
      tokenName: nativeToken.symbol,
      balance: balance.toString(),
      balanceFormatted,
      decimals: nativeToken.decimals,
      priceUSD,
      valueUSD: balanceFormatted * priceUSD,
    };
  } catch (viemError) {
    console.warn(`[Portfolio] Viem failed for ${chainName}, trying direct RPC:`, viemError);
  }

  // Fallback: direct RPC call with multiple endpoints
  const rpcUrls = RPC_URLS[chainId] || [];
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_getBalance',
          params: [address.toLowerCase(), 'latest']
        })
      });
      const result = await response.json();
      if (result.error || !result.result) continue;

      const balance = BigInt(result.result);
      const balanceFormatted = parseFloat(formatUnits(balance, nativeToken.decimals));

      console.log(`[Portfolio] ${chainName} native balance via RPC (${rpcUrl}): ${balanceFormatted} ${nativeToken.symbol}`);

      const priceUSD = await getTokenPrice(chainId, nativeToken.address, nativeToken.symbol);

      return {
        chainId,
        chainName,
        tokenAddress: nativeToken.address,
        tokenSymbol: nativeToken.symbol,
        tokenName: nativeToken.symbol,
        balance: balance.toString(),
        balanceFormatted,
        decimals: nativeToken.decimals,
        priceUSD,
        valueUSD: balanceFormatted * priceUSD,
      };
    } catch (rpcError) {
      console.warn(`[Portfolio] RPC ${rpcUrl} failed for ${chainName}:`, rpcError);
    }
  }

  console.error(`[Portfolio] All methods failed to get native balance for ${chainName}`);
  return null;
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
  const chainName = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]?.name || `Chain ${chainId}`;
  let balanceRaw: bigint | null = null;

  // Try viem client first
  try {
    balanceRaw = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    }) as bigint;
  } catch (viemError) {
    console.warn(`[Portfolio] Viem failed for ${tokenSymbol} on ${chainName}, trying direct RPC`);
  }

  // Fallback: direct RPC call
  if (balanceRaw === null) {
    const rpcUrls = RPC_URLS[chainId] || [];
    const normalizedWallet = address.toLowerCase();
    const normalizedToken = tokenAddress.toLowerCase();
    const data = '0x70a08231' + normalizedWallet.slice(2).padStart(64, '0');

    for (const rpcUrl of rpcUrls) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'eth_call',
            params: [{ to: normalizedToken, data }, 'latest']
          })
        });
        const result = await response.json();
        if (result.error || !result.result || result.result === '0x' || result.result === '0x0') continue;
        balanceRaw = BigInt(result.result);
        break;
      } catch {
        continue;
      }
    }
  }

  if (balanceRaw === null) {
    console.warn(`[Portfolio] All methods failed for ${tokenSymbol} on ${chainName}`);
    return null;
  }

  const balanceFormatted = parseFloat(formatUnits(balanceRaw, decimals));

  // Skip if balance is effectively 0
  if (balanceFormatted < 0.000001) return null;

  console.log(`[Portfolio] ${chainName} ${tokenSymbol}: ${balanceFormatted}`);

  // Get price
  const priceUSD = await getTokenPrice(chainId, tokenAddress, tokenSymbol);

  return {
    chainId,
    chainName,
    tokenAddress,
    tokenSymbol,
    tokenName: tokenSymbol,
    balance: balanceRaw.toString(),
    balanceFormatted,
    decimals,
    priceUSD,
    valueUSD: balanceFormatted * priceUSD,
  };
}

// Fetch all balances for a wallet address across chains
export async function fetchWalletPortfolio(
  walletAddress: string,
  chainIds: number[] = [1, 42161, 10, 137, 8453, 43114]
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
      const rpcUrls = RPC_URLS[chainId] || [chainConfig.rpc];
      const transport = rpcUrls.length > 1
        ? fallback(rpcUrls.map((url) => http(url)))
        : http(chainConfig.rpc);
      const client = createPublicClient({
        chain: chainConfig,
        transport,
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
  chainIds: number[] = [1, 42161, 10, 137, 8453, 43114]
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
