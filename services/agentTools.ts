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

// Native USDC addresses per chain (matches lifi.ts)
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

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
        const addr = address || walletAddress;
        if (!addr) {
          return { error: 'No wallet address available. Connect a wallet first.' };
        }
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
      },
    }),

    getSwapQuote: tool({
      description:
        'Get a cross-chain swap/bridge quote via LI.FI. Use when the user wants to swap or bridge tokens (e.g. USDC from Ethereum to Arbitrum). Amount is in human units (e.g. 100 for 100 USDC).',
      inputSchema: z.object({
        fromChain: z
          .string()
          .describe('Source chain: Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche'),
        toChain: z
          .string()
          .describe('Destination chain: Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche'),
        fromToken: z.string().default('USDC').describe('Source token symbol (default USDC)'),
        toToken: z.string().default('USDC').describe('Destination token symbol (default USDC)'),
        amount: z.string().describe('Amount in human units, e.g. "100" for 100 USDC'),
        toAddress: z.string().optional().describe('Recipient address. Defaults to sender.'),
      }),
      execute: async ({ fromChain, toChain, fromToken, toToken, amount, toAddress }) => {
        const fromChainId = resolveChainId(fromChain);
        const toChainId = resolveChainId(toChain);
        const fromAddr = USDC_ADDRESSES[fromChainId];
        const toAddr = USDC_ADDRESSES[toChainId];
        if (!fromAddr || !toAddr) {
          return {
            error: `Unsupported chain. Supported: Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche.`,
          };
        }
        // USDC has 6 decimals
        const amountRaw = Math.floor(parseFloat(amount) * 1e6).toString();
        if (amountRaw === '0') {
          return { error: 'Amount must be greater than 0.' };
        }
        try {
          const quote = await lifiService.getQuote({
            fromChain: fromChainId,
            toChain: toChainId,
            fromToken: fromAddr,
            toToken: toAddr,
            fromAmount: amountRaw,
            fromAddress: walletAddress,
            toAddress: toAddress || walletAddress,
          });
          if (!quote) {
            return { error: 'No route found for this swap.' };
          }
          const toAmount = (quote as any).estimate?.toAmount;
          const toAmountFormatted = toAmount
            ? (parseFloat(toAmount) / 1e6).toFixed(2)
            : 'N/A';
          return {
            fromChain,
            toChain,
            fromAmount: amount,
            toAmountEstimate: toAmountFormatted,
            routeFound: true,
            message: `Quote: ${amount} ${fromToken} on ${fromChain} → ~${toAmountFormatted} ${toToken} on ${toChain}`,
          };
        } catch (err: any) {
          return {
            error: err?.message || 'Failed to get quote.',
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
