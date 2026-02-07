// LI.FI Service Layer for Cross-Chain Operations
// Integrates LI.FI SDK for route discovery and execution
// Uses Arc (Circle CCTP) as the liquidity hub for native USDC transfers
// Docs: https://docs.li.fi/sdk/overview

import { LiFi, Route, Chain, Token, convertQuoteToRoute } from '@lifi/sdk';
import { BrowserProvider } from 'ethers';
import type { LifiStep, TokenAmount } from '@lifi/types';
import { LIFI_INTEGRATOR } from '../constants';
import {
  getArcTransferInfo,
  arcStats,
  ArcTransferInfo,
  ARC_SUPPORTED_CHAINS,
} from './arcIntegration';

// RPC endpoints for balance queries (with fallbacks - more reliable endpoints first)
const RPC_URLS: Record<number, string[]> = {
  1: ['https://eth.drpc.org', 'https://1rpc.io/eth', 'https://cloudflare-eth.com', 'https://rpc.ankr.com/eth'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
  10: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
  137: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  8453: ['https://base.llamarpc.com', 'https://1rpc.io/base', 'https://mainnet.base.org'],
  43114: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'],
};

// ERC20 balanceOf ABI for direct RPC calls
const ERC20_BALANCE_ABI = [{
  "constant": true,
  "inputs": [{ "name": "_owner", "type": "address" }],
  "name": "balanceOf",
  "outputs": [{ "name": "balance", "type": "uint256" }],
  "type": "function"
}];

// Direct RPC call to get ERC20 balance with fallback URLs
async function getERC20BalanceDirect(
  rpcUrls: string[],
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  // Ensure addresses are lowercase and properly formatted
  const normalizedWallet = walletAddress.toLowerCase();
  const normalizedToken = tokenAddress.toLowerCase();

  // Encode balanceOf(address) call - address must be 0-padded to 32 bytes
  const data = '0x70a08231' + normalizedWallet.slice(2).padStart(64, '0');

  // Try each RPC URL until one works
  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`[RPC] Trying ${rpcUrl} for ${normalizedToken}`);

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

      if (result.error) {
        console.warn(`[RPC] Error from ${rpcUrl}:`, result.error);
        continue; // Try next URL
      }

      if (!result.result || result.result === '0x' || result.result === '0x0') {
        console.log(`[RPC] Zero balance from ${rpcUrl}`);
        return '0';
      }

      // Convert hex to decimal string
      const balance = BigInt(result.result).toString();
      console.log(`[RPC] ✅ Balance: ${balance} from ${rpcUrl}`);
      return balance;
    } catch (error) {
      console.warn(`[RPC] Failed with ${rpcUrl}:`, error);
      continue; // Try next URL
    }
  }

  console.warn(`[RPC] All RPC URLs failed for balance check`);
  return '0';
}

// LI.FI rate limits: Unauthenticated = 200 req/2hr (~36s between). Authenticated = 200 req/min.
// Use direct import.meta.env.VITE_* so Vite can replace at build time
const LIFI_API_KEY: string | undefined = import.meta.env.VITE_LIFI_API_KEY;
const MIN_QUOTE_INTERVAL_MS = LIFI_API_KEY ? 5000 : 40000; // 5s with key, 40s without (stay under 200/2hr)

// Startup log to verify API key is loaded (restart dev server after adding to .env)
if (typeof window !== 'undefined') {
  console.log('[LI.FI] API key:', LIFI_API_KEY ? 'configured (5s interval)' : 'not set (40s interval) — add VITE_LIFI_API_KEY to .env and restart');
}

// Initialize SDK with LiFi class (SDK v2.x API) and RPC config
// Note: integrator name must be max 23 characters (alphanumeric, -, _, .)
// SDK uses singleton ConfigService - import lifi.ts first in index.tsx to set integrator before any other module
const rpcs: Record<number, string[]> = {};
Object.entries(RPC_URLS).forEach(([chainId, urls]) => {
  rpcs[Number(chainId)] = [urls[0]];
});
export const lifi = new LiFi({
  integrator: LIFI_INTEGRATOR,
  rpcs,
  ...(LIFI_API_KEY ? { apiKey: LIFI_API_KEY } : {}),
});

// Global queue: only one quote request at a time to avoid 429
let quoteQueue: Promise<void> = Promise.resolve();
let lastQuoteTime = 0;

async function acquireQuoteSlot(): Promise<() => void> {
  const prev = quoteQueue;
  let release: () => void;
  quoteQueue = new Promise<void>((r) => { release = r; });
  await prev;
  const now = Date.now();
  const elapsed = now - lastQuoteTime;
  if (elapsed < MIN_QUOTE_INTERVAL_MS) {
    const wait = MIN_QUOTE_INTERVAL_MS - elapsed;
    console.log(`[LI.FI] Rate limit: waiting ${Math.round(wait / 1000)}s before next quote`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastQuoteTime = Date.now();
  return release!;
}

// Retry wrapper for API calls with exponential backoff + global queue
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 5000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const release = await acquireQuoteSlot();
      try {
        const result = await fn();
        return result;
      } finally {
        release();
      }
    } catch (error: any) {
      lastError = error;
      const errStr = JSON.stringify(error) + (error?.message || '') + (error?.name || '');
      const is429 = errStr.includes('429') ||
                    errStr.includes('Too Many Requests') ||
                    errStr.includes('Something went wrong') ||
                    errStr.includes('ServerError') ||
                    error?.response?.status === 429 ||
                    error?.status === 429;

      console.log(`[LI.FI] Request failed (attempt ${attempt}/${maxRetries}):`, error?.message || error?.name || 'Unknown error');

      if (is429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[LI.FI] Rate limited, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Adapter: Convert viem WalletClient to ethers-compatible signer for LI.FI SDK
// LI.FI SDK expects ethers-style signer with getAddress(), signMessage(), sendTransaction(), getChainId()
function createViemToEthersSigner(walletClient: any) {
  if (!walletClient?.account?.address) {
    throw new Error('WalletClient must have an account connected');
  }

  const address = walletClient.account.address;
  const chainId = walletClient.chain?.id || 1;

  return {
    // Required by LI.FI SDK
    getAddress: async () => address,

    // Get chain ID - required by LI.FI SDK for route execution
    getChainId: async () => chainId,

    // Sign a message (used for some bridges)
    signMessage: async (message: string | Uint8Array) => {
      return walletClient.signMessage({
        account: walletClient.account,
        message: typeof message === 'string' ? message : { raw: message },
      });
    },

    // Send transaction - this is what LI.FI uses for swaps/bridges
    sendTransaction: async (tx: any) => {
      console.log('[LI.FI Adapter] Sending transaction:', {
        to: tx.to,
        value: tx.value?.toString(),
        data: tx.data?.slice(0, 66) + '...',
        chainId: tx.chainId,
      });

      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : undefined,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
        maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
        chain: walletClient.chain,
      });

      console.log('[LI.FI Adapter] Transaction sent:', hash);

      // Return ethers-style TransactionResponse
      return {
        hash,
        wait: async () => {
          // LI.FI SDK may call wait() to get receipt
          // We return a minimal receipt - LI.FI will poll for actual status
          return { transactionHash: hash, status: 1 };
        },
      };
    },

    // Provider access (for chain ID, etc.)
    provider: {
      getNetwork: async () => ({
        chainId: chainId,
        name: walletClient.chain?.name || 'unknown',
      }),
      getChainId: async () => chainId,
    },

    // For type checking - indicates this is a signer
    _isSigner: true,
  };
}

export interface LifiQuoteParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress?: string;
  toAddress?: string;
}

export interface LifiRouteStatus {
  routeId: string;
  status: 'PENDING' | 'DONE' | 'FAILED';
  txHash?: string;
  steps?: any[];
}

// Extended quote result with Arc routing info
export interface LifiQuoteResult {
  quote: LifiStep;
  arcInfo: ArcTransferInfo;
  isArcRoute: boolean;
}

export interface WalletTokenBalance {
  chainId: number;
  chainName: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  balanceFormatted: number;
  decimals: number;
  priceUSD: number;
  valueUSD: number;
  logoURI?: string;
}

// Common token addresses by chain
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum (native USDC)
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism (native USDC)
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (native USDC)
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',  // Avalanche
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

// Fallback chain list when LI.FI API fails (CORS, network, etc.)
const FALLBACK_CHAINS: Partial<Chain>[] = [
  { id: 1, name: 'Ethereum', key: 'eth' },
  { id: 42161, name: 'Arbitrum', key: 'arb' },
  { id: 10, name: 'OP Mainnet', key: 'opt' },
  { id: 137, name: 'Polygon', key: 'pol' },
  { id: 8453, name: 'Base', key: 'bas' },
  { id: 43114, name: 'Avalanche', key: 'ava' },
];

export const lifiService = {
  // Get available chains (SDK first, direct API fallback, then static fallback)
  async getChains(): Promise<Chain[]> {
    try {
      const chains = await lifi.getChains();
      if (Array.isArray(chains) && chains.length > 0) {
        return chains;
      }
    } catch (error) {
      console.warn('[LI.FI] SDK getChains failed, trying direct API:', error);
    }

    // Fallback: fetch directly from LI.FI API (avoids SDK ChainsService init race)
    try {
      const res = await fetch('https://li.quest/v1/chains', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        const chains = data?.chains;
        if (Array.isArray(chains) && chains.length > 0) {
          console.log('[LI.FI] Chains loaded via direct API:', chains.length);
          return chains;
        }
      }
    } catch (fetchError) {
      console.warn('[LI.FI] Direct API fetch failed:', fetchError);
    }

    // Static fallback so app always has chains
    console.warn('[LI.FI] Using static chain fallback');
    return FALLBACK_CHAINS as Chain[];
  },

  // Get available tokens for a chain
  async getTokens(chainId: number): Promise<Token[]> {
    try {
      const response = await lifi.getTokens({ chains: [chainId] });
      return response.tokens?.[chainId] || [];
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return [];
    }
  },

  // Get a specific token by chain and address
  async getToken(chainId: number, tokenAddress: string): Promise<Token | null> {
    try {
      const token = await lifi.getToken(chainId, tokenAddress);
      return token;
    } catch (error) {
      console.error('Error fetching token:', error);
      return null;
    }
  },

  // Get token balance for a wallet using LI.FI SDK
  async getTokenBalance(walletAddress: string, chainId: number, tokenAddress: string): Promise<TokenAmount | null> {
    try {
      const token = await lifi.getToken(chainId, tokenAddress);
      if (!token) {
        console.warn(`Token not found: ${tokenAddress} on chain ${chainId}`);
        return null;
      }
      const balance = await lifi.getTokenBalance(walletAddress, token);
      return balance;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return null;
    }
  },

  // Get USDC balance across all supported chains
  async getUSDCBalances(walletAddress: string): Promise<WalletTokenBalance[]> {
    const balances: WalletTokenBalance[] = [];
    const chainIds = Object.keys(USDC_ADDRESSES).map(Number);

    // Normalize wallet address
    const normalizedWallet = walletAddress.toLowerCase();

    console.log(`[LI.FI] 🔍 Scanning USDC balances across ${chainIds.length} chains for wallet: ${walletAddress}`);
    console.log(`[LI.FI] Chains: ${chainIds.map(id => CHAIN_NAMES[id] || id).join(', ')}`);

    const balancePromises = chainIds.map(async (chainId) => {
      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      try {
        const tokenAddress = USDC_ADDRESSES[chainId];
        const rpcUrls = RPC_URLS[chainId];

        console.log(`[LI.FI] 📡 Querying ${chainName} (chain ${chainId})...`);

        // Try direct RPC call first (more reliable)
        let balanceRaw = '0';
        if (rpcUrls && rpcUrls.length > 0) {
          balanceRaw = await getERC20BalanceDirect(rpcUrls, tokenAddress, normalizedWallet);
        }

        // If direct RPC fails or returns 0, try LI.FI SDK as fallback
        if (balanceRaw === '0') {
          try {
            const token = await lifi.getToken(chainId, tokenAddress);
            if (token) {
              const sdkBalance = await lifi.getTokenBalance(normalizedWallet, token);
              if (sdkBalance && sdkBalance.amount && sdkBalance.amount !== '0') {
                balanceRaw = sdkBalance.amount;
                console.log(`[LI.FI] SDK fallback returned balance: ${balanceRaw}`);
              }
            }
          } catch (sdkError) {
            console.warn(`[LI.FI] SDK balance fallback failed for ${chainName}:`, sdkError);
          }
        }

        // Get token info from LI.FI for metadata
        const token = await lifi.getToken(chainId, tokenAddress);
        const decimals = token?.decimals || 6; // USDC is 6 decimals
        const balanceFormatted = parseFloat(balanceRaw) / Math.pow(10, decimals);

        // Skip if zero balance
        if (balanceFormatted === 0) {
          console.log(`[LI.FI] ⚪ ${chainName}: 0 USDC`);
          return null;
        }

        console.log(`[LI.FI] ✅ ${chainName}: ${balanceFormatted.toFixed(4)} USDC (raw: ${balanceRaw})`);

        return {
          chainId,
          chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
          tokenAddress: tokenAddress,
          tokenSymbol: token?.symbol || 'USDC',
          tokenName: token?.name || 'USD Coin',
          balance: balanceRaw,
          balanceFormatted,
          decimals,
          priceUSD: token?.priceUSD ? parseFloat(token.priceUSD) : 1,
          valueUSD: balanceFormatted * (token?.priceUSD ? parseFloat(token.priceUSD) : 1),
          logoURI: token?.logoURI,
        };
      } catch (error) {
        console.error(`[LI.FI] ❌ Failed to get USDC balance for ${chainName}:`, error);
        return null;
      }
    });

    const results = await Promise.all(balancePromises);
    results.forEach(result => {
      if (result && result.balanceFormatted > 0) {
        balances.push(result);
      }
    });

    console.log(`[LI.FI] 📊 Final USDC balances across all chains:`, balances.map(b => `${b.chainName}: ${b.balanceFormatted.toFixed(4)}`));
    return balances;
  },

  // Get native token (ETH, MATIC, etc.) balance for gas on a chain
  async getNativeBalance(walletAddress: string, chainId: number): Promise<{ balance: string; balanceFormatted: number }> {
    const rpcUrls = RPC_URLS[chainId] || ['https://rpc.ankr.com/eth', 'https://eth.drpc.org', 'https://1rpc.io/eth'];
    const normalizedWallet = walletAddress.toLowerCase();
    const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;

    console.log(`[LI.FI] Fetching native balance for ${chainName}...`);

    for (const rpcUrl of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'eth_getBalance',
            params: [normalizedWallet, 'latest']
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json();
        if (result.error) {
          console.warn(`[LI.FI] RPC error from ${rpcUrl}:`, result.error);
          continue;
        }
        if (!result.result || result.result === '0x0' || result.result === '0x') {
          console.log(`[LI.FI] Zero balance from ${rpcUrl} for ${chainName}`);
          return { balance: '0', balanceFormatted: 0 };
        }
        const balance = BigInt(result.result).toString();
        const balanceFormatted = parseFloat(balance) / 1e18;
        console.log(`[LI.FI] ✅ ${chainName} native: ${balanceFormatted} (from ${rpcUrl})`);
        return { balance, balanceFormatted };
      } catch (err: any) {
        console.warn(`[LI.FI] RPC failed (${rpcUrl}):`, err?.message || err);
        continue;
      }
    }
    console.error(`[LI.FI] All RPCs failed for ${chainName} native balance`);
    return { balance: '0', balanceFormatted: 0 };
  },

  // Get all token balances for a wallet on a specific chain
  async getWalletBalances(walletAddress: string, chainId: number): Promise<WalletTokenBalance[]> {
    try {
      const tokens = await this.getTokens(chainId);
      if (!tokens.length) return [];

      // Get balances for all tokens (limit to avoid rate limiting)
      const limitedTokens = tokens.slice(0, 20);
      const balances = await lifi.getTokenBalances(walletAddress, limitedTokens);

      return balances
        .filter(b => b && b.amount !== '0')
        .map(b => {
          const balanceFormatted = parseFloat(b.amount) / Math.pow(10, b.decimals);
          return {
            chainId,
            chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
            tokenAddress: b.address,
            tokenSymbol: b.symbol,
            tokenName: b.name,
            balance: b.amount,
            balanceFormatted,
            decimals: b.decimals,
            priceUSD: b.priceUSD ? parseFloat(b.priceUSD) : 0,
            valueUSD: balanceFormatted * (b.priceUSD ? parseFloat(b.priceUSD) : 0),
            logoURI: b.logoURI,
          };
        });
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
      return [];
    }
  },

  // Get quote for cross-chain contract call (bridge + destination call in one tx)
  // Used for: bridge USDC from any chain → deposit into Aave on Arbitrum
  // Docs: https://docs.li.fi/sdk/request-routes#request-contract-call-quote
  async getContractCallsQuote(request: {
    fromAddress: string;
    fromChain: number;
    fromToken: string;
    toChain: number;
    toToken: string;
    toAmount: string;
    contractCalls: Array<{
      fromAmount: string;
      fromTokenAddress: string;
      toContractAddress: string;
      toContractCallData: string;
      toContractGasLimit: string;
      toApprovalAddress?: string;
      contractOutputsToken?: string;
    }>;
  }): Promise<LifiStep | null> {
    try {
      const quote = await lifi.getContractCallsQuote(request as any);
      return quote || null;
    } catch (error: any) {
      console.error('[LI.FI] getContractCallsQuote error:', error);
      throw new Error(error?.message || 'Contract call quote failed');
    }
  },

  // Get quote for cross-chain swap (returns LifiStep - single best route with tx data)
  // For USDC transfers: ALWAYS prefer Circle CCTP (Arc's underlying protocol)
  async getQuote(params: LifiQuoteParams): Promise<LifiStep | null> {
    const result = await this.getQuoteWithArcInfo(params);
    return result?.quote || null;
  },

  // Get quote with Arc routing information
  // Returns both the quote and Arc metadata for UI display
  // Uses standard LI.FI routing only (1 request) - LI.FI picks best route including CCTP when available
  async getQuoteWithArcInfo(params: LifiQuoteParams): Promise<LifiQuoteResult | null> {
    try {
      console.log('[LI.FI] Requesting quote with params:', {
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
      });

      // Use standard LI.FI routing - single request, LI.FI picks best route (may include CCTP for USDC)
      const quote = await withRetry(() => lifi.getQuote({
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
      }));

      const bridgeUsed = quote ? ((quote as any).toolDetails?.name || (quote as any).tool) : undefined;

      if (!quote) {
        console.log('[LI.FI] No quote available');
        return null;
      }

      // Get Arc transfer info for this route
      const arcInfo = getArcTransferInfo(
        params.fromChain,
        params.toChain,
        params.fromToken,
        params.toToken,
        bridgeUsed
      );

      console.log('[LI.FI] Quote received:', {
        isArcRoute: arcInfo.isArcRoute,
        protocol: arcInfo.protocol,
        badge: arcInfo.arcBranding.badge,
      });

      return {
        quote,
        arcInfo,
        isArcRoute: arcInfo.isArcRoute,
      };
    } catch (error: any) {
      console.error('[LI.FI] Error getting quote:', error);
      console.error('[LI.FI] Error details:', error?.message, error?.response?.data || error?.cause);

      // Extract meaningful error message from various SDK/API error shapes
      let errMsg = error?.message || 'Unknown error';
      const data = error?.response?.data || error?.data || error?.body;
      if (typeof data === 'object') {
        errMsg = data?.message || data?.error || data?.msg || errMsg;
      }
      if (error?.cause?.message) errMsg = error.cause.message;

      // Context-aware hints for generic errors
      if (errMsg === 'Something went wrong' || errMsg === 'Unknown error') {
        const is429 = error?.status === 429 || error?.response?.status === 429 ||
          String(error).includes('429') || String(error?.cause).includes('429');
        if (is429 || !LIFI_API_KEY) {
          errMsg += ' — Likely rate limited (200 req/2hr without API key). Add VITE_LIFI_API_KEY to .env and restart dev server for 200 req/min.';
        } else {
          const amountNum = parseFloat(params.fromAmount) / 1e6; // USDC decimals
          const isSameChain = params.fromChain === params.toChain;
          if (isSameChain && amountNum < 5) {
            errMsg += ' — For same-chain swaps, try 5+ USDC. Small amounts can fail due to liquidity or routing.';
          } else if (!isSameChain && amountNum < 10) {
            errMsg += ' — Cross-chain bridges often need 10–25+ USDC. Try a larger amount.';
          } else {
            errMsg += ' — Try a different amount or verify wallet balance.';
          }
        }
      }
      throw new Error(`LI.FI quote failed: ${errMsg}`);
    }
  },

  // Record Arc transfer for stats tracking
  recordArcTransfer(fromChain: string, toChain: string, amountUsd: number): void {
    arcStats.recordTransfer(fromChain, toChain, amountUsd);
  },

  // Get Arc stats
  getArcStats() {
    return arcStats.getStats();
  },

  // Get Arc supported chains
  getArcSupportedChains() {
    return ARC_SUPPORTED_CHAINS;
  },

  // Execute a cross-chain route
  // SDK v2: executeRoute(signer, route, settings) - signer first, then route
  // Quote (LifiStep) is converted to Route via convertQuoteToRoute before execution
  // Note: Converts viem WalletClient to ethers-compatible signer for LI.FI SDK
  async executeRoute(quoteOrRoute: LifiStep | Route, walletClient: any, settings?: { updateRouteHook?: (route: Route) => void }): Promise<any> {
    try {
      // Convert quote to route if needed
      const route = 'steps' in quoteOrRoute && Array.isArray(quoteOrRoute.steps) && quoteOrRoute.steps.length > 0
        ? (quoteOrRoute as Route)
        : convertQuoteToRoute(quoteOrRoute as LifiStep);

      // Create ethers-compatible signer adapter from viem WalletClient
      // LI.FI SDK expects ethers-style signer with getAddress(), signMessage(), sendTransaction()
      // Cast to 'any' to bypass strict type checking - we implement only the methods LI.FI actually uses
      const signer = createViemToEthersSigner(walletClient) as any;

      // Get provider for chain switching - required when route starts on a different chain than wallet
      const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : undefined;

      const execSettings = {
        ...settings,
        switchChainHook: ethereum
          ? async (chainId: number) => {
              console.log('[LI.FI] Switching chain to', chainId);
              await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x' + chainId.toString(16) }],
              });
              const provider = new BrowserProvider(ethereum);
              const signer = await provider.getSigner();
              // SDK expects getChainId() - ensure it returns number (ethers v6 returns bigint)
              return Object.assign(signer, {
                getChainId: async () => Number(chainId),
              }) as any;
            }
          : undefined,
        acceptExchangeRateUpdateHook: async () => true,
      };

      console.log('[LI.FI] Executing route with adapted signer...');
      const result = await lifi.executeRoute(signer, route, execSettings);
      return result;
    } catch (error) {
      console.error('Error executing route:', error);
      throw error;
    }
  },

  // Get route status (for cross-chain: bridge param may be required)
  async getStatus(txHash: string, bridge?: string, fromChain?: number, toChain?: number): Promise<LifiRouteStatus | null> {
    try {
      const status = await lifi.getStatus({ txHash, bridge, fromChain, toChain } as any) as any;
      return {
        routeId: status.routeId || status.transactionId || '',
        status: status.status as 'PENDING' | 'DONE' | 'FAILED',
        txHash: status.txHash || status.sending?.txHash || txHash,
        steps: status.steps || [],
      };
    } catch (error) {
      console.error('Error getting status:', error);
      return null;
    }
  },

  // getRoute not available in SDK v2 - use getStatus for tracking
  async getRoute(_routeId: string): Promise<Route | null> {
    return null;
  },

  // Convert quote (LifiStep) to Route for execution
  convertQuoteToRoute,

  // Validate route safety
  async validateRoute(route: Route): Promise<{
    isValid: boolean;
    riskScore: number; // 0-100, lower is safer
    issues: string[];
  }> {
    const issues: string[] = [];
    let riskScore = 0;

    // Check slippage from fee costs
    const hasHighSlippage = route.steps.some(step => {
      const feeCost = step.estimate.feeCosts?.find(f => f.name === 'slippage');
      return feeCost && parseFloat(feeCost.percentage || '0') > 5;
    });
    if (hasHighSlippage) {
      issues.push('High slippage detected (>5%)');
      riskScore += 30;
    }

    // Check gas costs
    const totalGas = route.steps.reduce((sum, step) => {
      return sum + (parseFloat(step.estimate.gasCosts?.[0]?.amount || '0'));
    }, 0);
    if (totalGas > 0.1) {
      issues.push('High gas costs detected');
      riskScore += 20;
    }

    // Check number of steps (more steps = more risk)
    if (route.steps.length > 3) {
      issues.push('Complex route with many steps');
      riskScore += 15;
    }

    // Check bridge reliability (simplified - in production, check bridge reputation)
    const bridges = route.steps.map(step => step.toolDetails?.name || 'Unknown');
    const uniqueBridges = new Set(bridges);
    if (uniqueBridges.size > 2) {
      issues.push('Multiple bridges required');
      riskScore += 10;
    }

    return {
      isValid: riskScore < 50,
      riskScore: Math.min(100, riskScore),
      issues,
    };
  },
};

// Make service available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).lifiService = lifiService;
  console.log('%c🌐 LI.FI + ⚡ ARC', 'background: linear-gradient(90deg, #00d4ff, #0066FF); color: white; font-weight: bold; font-size: 14px; padding: 4px 8px; border-radius: 4px;');
  console.log('%cCross-chain infrastructure powered by Arc Liquidity Hub', 'color: #0066FF; font-style: italic;');
  console.log('%cUse these commands in console:', 'color: #00d4ff;');
  console.log('  lifiService.getChains() - Get available chains');
  console.log('  lifiService.getTokens(chainId) - Get tokens for a chain');
  console.log('  lifiService.getQuote(params) - Get cross-chain quote');
  console.log('  lifiService.getQuoteWithArcInfo(params) - Get quote with Arc routing info');
  console.log('  lifiService.getUSDCBalances(walletAddress) - Get USDC across all chains');
  console.log('  lifiService.getArcStats() - Get Arc transfer statistics');
  console.log('  lifiService.getArcSupportedChains() - Get Arc/CCTP supported chains');
}
