// LI.FI Service Layer for Cross-Chain Operations
// Integrates LI.FI SDK for route discovery and execution
// Uses Arc (Circle CCTP) as the liquidity hub for native USDC transfers
// Docs: https://docs.li.fi/sdk/overview

import { LiFi, Route, Chain, Token, convertQuoteToRoute } from '@lifi/sdk';
import type { LifiStep, TokenAmount } from '@lifi/types';
import {
  canUseArcRoute,
  getArcTransferInfo,
  formatArcLog,
  arcStats,
  ArcTransferInfo,
  ARC_SUPPORTED_CHAINS,
} from './arcIntegration';

// RPC endpoints for balance queries
const RPC_URLS: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  137: 'https://polygon-rpc.com',
  8453: 'https://mainnet.base.org',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
};

// ERC20 balanceOf ABI for direct RPC calls
const ERC20_BALANCE_ABI = [{
  "constant": true,
  "inputs": [{ "name": "_owner", "type": "address" }],
  "name": "balanceOf",
  "outputs": [{ "name": "balance", "type": "uint256" }],
  "type": "function"
}];

// Direct RPC call to get ERC20 balance (fallback)
async function getERC20BalanceDirect(
  rpcUrl: string,
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  try {
    // Encode balanceOf(address) call
    const data = '0x70a08231' + walletAddress.slice(2).padStart(64, '0');

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest']
      })
    });

    const result = await response.json();
    if (result.error) {
      console.warn(`RPC error:`, result.error);
      return '0';
    }

    // Convert hex to decimal string
    const balance = BigInt(result.result || '0x0').toString();
    return balance;
  } catch (error) {
    console.warn(`Direct RPC balance check failed:`, error);
    return '0';
  }
}

// Initialize SDK with LiFi class (SDK v2.x API) and RPC config
// Note: integrator name must be max 23 characters
const lifi = new LiFi({
  integrator: 'lifi-agents-orch',
  rpcUrls: RPC_URLS,
});

// Adapter: Convert viem WalletClient to ethers-compatible signer for LI.FI SDK
// LI.FI SDK expects ethers-style signer with getAddress(), signMessage(), sendTransaction()
function createViemToEthersSigner(walletClient: any) {
  if (!walletClient?.account?.address) {
    throw new Error('WalletClient must have an account connected');
  }

  const address = walletClient.account.address;

  return {
    // Required by LI.FI SDK
    getAddress: async () => address,

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
        chainId: walletClient.chain?.id || 1,
        name: walletClient.chain?.name || 'unknown',
      }),
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

export const lifiService = {
  // Get available chains
  async getChains(): Promise<Chain[]> {
    try {
      const chains = await lifi.getChains();
      return chains;
    } catch (error) {
      console.error('Error fetching chains:', error);
      return [];
    }
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

    console.log(`[LI.FI] Fetching USDC balances for wallet: ${walletAddress}`);

    const balancePromises = chainIds.map(async (chainId) => {
      try {
        const tokenAddress = USDC_ADDRESSES[chainId];
        const rpcUrl = RPC_URLS[chainId];

        // Try direct RPC call first (more reliable)
        let balanceRaw = '0';
        if (rpcUrl) {
          console.log(`[LI.FI] Direct RPC balance check for chain ${chainId}...`);
          balanceRaw = await getERC20BalanceDirect(rpcUrl, tokenAddress, walletAddress);
          console.log(`[LI.FI] Direct RPC result for chain ${chainId}: ${balanceRaw}`);
        }

        // Get token info from LI.FI for metadata
        const token = await lifi.getToken(chainId, tokenAddress);
        const decimals = token?.decimals || 6; // USDC is 6 decimals
        const balanceFormatted = parseFloat(balanceRaw) / Math.pow(10, decimals);

        // Skip if zero balance
        if (balanceFormatted === 0) {
          console.log(`[LI.FI] Zero balance on chain ${chainId}, skipping`);
          return null;
        }

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
        console.error(`[LI.FI] Failed to get USDC balance for chain ${chainId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(balancePromises);
    results.forEach(result => {
      if (result && result.balanceFormatted > 0) {
        balances.push(result);
      }
    });

    console.log(`[LI.FI] Final USDC balances:`, balances);
    return balances;
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

  // Get quote for cross-chain swap (returns LifiStep - single best route with tx data)
  // For USDC transfers: ALWAYS prefer Circle CCTP (Arc's underlying protocol)
  async getQuote(params: LifiQuoteParams): Promise<LifiStep | null> {
    const result = await this.getQuoteWithArcInfo(params);
    return result?.quote || null;
  },

  // Get quote with Arc routing information
  // Returns both the quote and Arc metadata for UI display
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

      // Check if this route can use Arc (CCTP for native USDC)
      const canUseArc = canUseArcRoute(
        params.fromChain,
        params.toChain,
        params.fromToken,
        params.toToken
      );

      let quote: LifiStep | null = null;
      let bridgeUsed: string | undefined;

      // For Arc-eligible routes, force Circle CCTP
      if (canUseArc) {
        console.log('[LI.FI] ⚡ Arc-eligible route detected - using Circle CCTP for native USDC');
        console.log(formatArcLog(getArcTransferInfo(
          params.fromChain,
          params.toChain,
          params.fromToken,
          params.toToken,
          'circlecctp'
        )));

        try {
          // Try Circle CCTP first (Arc's underlying protocol)
          quote = await lifi.getQuote({
            fromChain: params.fromChain,
            toChain: params.toChain,
            fromToken: params.fromToken,
            toToken: params.toToken,
            fromAmount: params.fromAmount,
            fromAddress: params.fromAddress,
            toAddress: params.toAddress,
            // Force Circle CCTP bridge for USDC - this uses Arc's burn/mint mechanism
            allowBridges: ['circlecctp', 'circle'],
          });

          if (quote) {
            bridgeUsed = 'circlecctp';
            console.log('[LI.FI] ✅ Arc/CCTP quote received - native USDC burn/mint route');
          }
        } catch (cctpError) {
          console.warn('[LI.FI] ⚠️ Arc/CCTP not available for this route, falling back to best route');
        }
      }

      // Fallback: use standard LI.FI routing (for non-USDC or if CCTP unavailable)
      if (!quote) {
        quote = await lifi.getQuote({
          fromChain: params.fromChain,
          toChain: params.toChain,
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.fromAmount,
          fromAddress: params.fromAddress,
          toAddress: params.toAddress,
        });

        // Try to extract bridge used from quote
        if (quote) {
          bridgeUsed = (quote as any).toolDetails?.name || (quote as any).tool;
        }
      }

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
      // Re-throw with more context so callers can see what went wrong
      throw new Error(`LI.FI quote failed: ${error?.message || 'Unknown error'}`);
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
      const signer = createViemToEthersSigner(walletClient);

      console.log('[LI.FI] Executing route with adapted signer...');
      const result = await lifi.executeRoute(signer, route, settings);
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
