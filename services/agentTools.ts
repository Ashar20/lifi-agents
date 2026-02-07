// AI Agent Tools for LI.FI / DeFi Orchestrator
// Used by Vercel AI SDK generateText with tool calling

import { tool } from 'ai';
import { z } from 'zod';
import { lifiService } from './lifi';
import {
  getBestYieldOpportunities,
  getYieldComparison,
  type YieldOpportunity,
} from './yieldFetcher';

// Chain name → chain ID
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  base: 8453,
  avalanche: 43114,
};

// Native USDC addresses per chain (Arc-compatible)
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

// Token addresses for swaps (USDC, ETH/WETH, USDT, DAI)
const TOKEN_ADDRESSES: Record<string, Record<number, { address: string; decimals: number }>> = {
  USDC: Object.fromEntries(
    Object.entries(USDC_ADDRESSES).map(([chainId, address]) => [chainId, { address, decimals: 6 }])
  ),
  ETH: {
    1: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    42161: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    10: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    137: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
    8453: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    43114: { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', decimals: 18 },
  },
  WETH: {
    1: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    42161: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    10: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    137: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
    8453: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    43114: { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', decimals: 18 },
  },
  USDT: {
    1: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    42161: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    10: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
    137: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  },
  DAI: {
    1: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    42161: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
    10: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
    137: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
    8453: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  },
};

function getTokenInfo(symbol: string, chainId: number): { address: string; decimals: number } | null {
  const upper = symbol.toUpperCase();
  const map = TOKEN_ADDRESSES[upper] ?? (upper === 'ETH' ? TOKEN_ADDRESSES.WETH : null);
  return map?.[chainId] ?? null;
}

function resolveChainId(chain: string | number): number {
  if (typeof chain === 'number') return chain;
  const lower = String(chain).toLowerCase().replace(/\s/g, '');
    return CHAIN_IDS[lower] ?? (parseInt(String(chain), 10) || 1);
}

export interface AgentContext {
  walletAddress: string;
}

export function createAgentTools(context: AgentContext) {
  const { walletAddress } = context;

  return {
    getUSDCBalances: tool({
      description:
        'Get USDC balance across all supported chains (Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche) for a wallet. Use this to check what the user has before suggesting swaps or yields.',
      inputSchema: z.object({
        address: z
          .string()
          .optional()
          .describe('Wallet address. If omitted, uses the tracked/connected wallet.'),
      }),
      execute: async ({ address }) => {
        const addr = (address || walletAddress || '').trim();
        if (!addr || !addr.startsWith('0x')) {
          return { error: 'No wallet address available. Connect a wallet or enter an address to check.' };
        }
        try {
          const balances = await lifiService.getUSDCBalances(addr);
          const total = balances.reduce((sum, b) => sum + b.balanceFormatted, 0);
          return {
            wallet: addr.slice(0, 6) + '...' + addr.slice(-4),
            totalUSDC: total.toFixed(2),
            byChain: balances.map((b) => ({
              chain: b.chainName,
              chainId: b.chainId,
              balance: b.balanceFormatted.toFixed(2),
              valueUSD: b.valueUSD.toFixed(2),
            })),
            hasBalance: balances.length > 0,
          };
        } catch (err: any) {
          const msg = err?.message || err?.cause?.message || 'Failed to fetch balances';
          return { error: `${msg}. RPC or API may be temporarily unavailable—try again.` };
        }
      },
    }),

    getSwapQuote: tool({
      description:
        'Get a cross-chain swap/bridge quote via LI.FI. USDC→USDC uses Arc (Circle CCTP). Other pairs (USDC→ETH, etc.) use LI.FI best route. Supports: USDC, ETH, WETH, USDT, DAI. Use when user wants to swap (e.g. "swap 100 USDC to ETH on Arbitrum" or "swap 50 USDC from Ethereum to Arbitrum"). Amount in human units.',
      inputSchema: z.object({
        fromChain: z
          .string()
          .describe('Source chain: Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche'),
        toChain: z
          .string()
          .describe('Destination chain (can be same as fromChain for same-chain swap)'),
        fromToken: z.string().describe('Source token: USDC, ETH, WETH, USDT, or DAI'),
        toToken: z.string().describe('Destination token: USDC, ETH, WETH, USDT, or DAI'),
        amount: z.string().describe('Amount in human units (e.g. 100 for 100 USDC, 0.5 for 0.5 ETH)'),
        toAddress: z.string().optional().describe('Recipient address. Defaults to sender.'),
      }),
      execute: async ({ fromChain, toChain, fromToken, toToken, amount, toAddress }) => {
        const fromChainId = resolveChainId(fromChain);
        const toChainId = resolveChainId(toChain);
        const fromInfo = getTokenInfo(fromToken, fromChainId);
        const toInfo = getTokenInfo(toToken, toChainId);
        if (!fromInfo || !toInfo) {
          const supported = 'USDC, ETH, WETH, USDT, DAI';
          return {
            error: `Unsupported token or chain. Supported tokens: ${supported}. Chains: Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche.`,
            routeFound: false,
          };
        }
        const amountNum = parseFloat(amount);
        const amountRaw = Math.floor(amountNum * Math.pow(10, fromInfo.decimals)).toString();
        if (amountRaw === '0') {
          return { error: 'Amount must be greater than 0.' };
        }
        if (fromToken.toUpperCase() === 'ETH' && amountNum < 0.001) {
          return {
            error: `Amount ${amount} ETH is too small. Try at least 0.001 ETH.`,
            routeFound: false,
          };
        }
        try {
          // getQuoteWithArcInfo: Arc for USDC→USDC, LI.FI best route for other pairs
          const result = await lifiService.getQuoteWithArcInfo({
            fromChain: fromChainId,
            toChain: toChainId,
            fromToken: fromInfo.address,
            toToken: toInfo.address,
            fromAmount: amountRaw,
            fromAddress: walletAddress,
            toAddress: toAddress || walletAddress,
          });
          const quote = result?.quote;
          if (!quote) {
            return { error: 'No route found for this swap.' };
          }
          const toAmountRaw = (quote as any).estimate?.toAmount;
          const toAmountFormatted = toAmountRaw
            ? (parseFloat(toAmountRaw) / Math.pow(10, toInfo.decimals)).toFixed(toInfo.decimals === 18 ? 6 : 2)
            : 'N/A';
          const arcNote = result?.isArcRoute
            ? ' (via Arc/CCTP - native USDC burn/mint)'
            : ' (LI.FI best route)';
          return {
            fromChain,
            toChain,
            fromAmount: amount,
            toAmountEstimate: toAmountFormatted,
            routeFound: true,
            usesArc: result?.isArcRoute ?? false,
            message: `Quote: ${amount} ${fromToken} on ${fromChain} → ~${toAmountFormatted} ${toToken} on ${toChain}${arcNote}`,
          };
        } catch (err: any) {
          const msg = err?.message || err?.cause?.message || 'Failed to get quote';
          const isUsdcToUsdc = fromToken.toUpperCase() === 'USDC' && toToken.toUpperCase() === 'USDC';
          const hint =
            isUsdcToUsdc && amountNum < 25
              ? ' USDC bridges (Arc/CCTP, Stargate) often need 10–25+ USDC. Try a larger amount.'
              : '';
          return {
            error: `${msg}${hint}`,
            routeFound: false,
          };
        }
      },
    }),

    getBestYields: tool({
      description:
        'Find the best yield opportunities (APY) for a token across DeFi protocols. Use when the user asks about yields, "put my USDC where it earns", or "best use of my funds".',
      inputSchema: z.object({
        token: z.string().default('USDC').describe('Token symbol to search yields for'),
        chainFilter: z
          .string()
          .optional()
          .describe('Optional chain name to filter (Ethereum, Arbitrum, etc.)'),
        minTvl: z.number().optional().default(1000000).describe('Minimum TVL in USD (default 1M)'),
        limit: z.number().optional().default(10).describe('Max number of opportunities to return'),
      }),
      execute: async ({ token, chainFilter, minTvl, limit }) => {
        const chainId = chainFilter ? resolveChainId(chainFilter) : undefined;
        const opportunities = await getBestYieldOpportunities(
          token,
          chainId,
          minTvl
        );
        const top = opportunities.slice(0, limit ?? 10);
        return {
          token,
          count: top.length,
          opportunities: top.map((o: YieldOpportunity) => ({
            protocol: o.protocol,
            chain: o.chainName,
            apy: (o.apy * 100).toFixed(2) + '%',
            tvl: `$${(o.tvl / 1e6).toFixed(2)}M`,
            type: o.type,
            risk: o.risk,
          })),
          bestApy: top[0]
            ? (top[0].apy * 100).toFixed(2) + '%'
            : null,
        };
      },
    }),

    getYieldComparison: tool({
      description:
        'Compare yields for a token across chains and protocols. Returns average APY and best opportunity. Use for "where should I put my USDC" type questions.',
      inputSchema: z.object({
        token: z.string().default('USDC').describe('Token symbol'),
      }),
      execute: async ({ token }) => {
        const result = await getYieldComparison(token);
        return {
          token: result.token,
          averageApy: (result.averageApy * 100).toFixed(2) + '%',
          bestOpportunity: result.bestOpportunity
            ? {
                protocol: result.bestOpportunity.protocol,
                chain: result.bestOpportunity.chainName,
                apy: (result.bestOpportunity.apy * 100).toFixed(2) + '%',
                tvl: `$${(result.bestOpportunity.tvl / 1e6).toFixed(2)}M`,
              }
            : null,
          yieldCount: result.yields.length,
        };
      },
    }),
  };
}
