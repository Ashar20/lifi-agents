// AI Agent Tools for LI.FI / DeFi Orchestrator
// Used by Vercel AI SDK generateText with tool calling

import { tool } from 'ai';
import { z } from 'zod';
import { lifiService } from './lifi';
import { getPortfolioSummary } from './portfolioTracker';
import {
  getBestYieldOpportunities,
  getYieldComparison,
  type YieldOpportunity,
} from './yieldFetcher';
import { oneClickYieldRotation } from './yieldRotation';
import { getCrossChainVaultDepositQuote } from './crossChainVaultDeposit';
import { executeAaveBorrow } from './aaveBorrow';
import { getHedgeQuote, executeHedge } from './hedgeStrategy';
import {
  createStagedDepositPlan,
  getStagedStrategy,
  getNextPendingStep,
  completeStagedStep,
} from './stagedStrategy';

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
  walletClient?: any;
  onDeployAgents?: () => void;
  onRunAgentPipeline?: (intentType: string, userMessage?: string) => Promise<{ success: boolean; summary: string; agentOutputs: Record<string, string> }>;
  onSwapExecuted?: (txHash: string, summary: string) => void;
}

export function createAgentTools(context: AgentContext) {
  const { walletAddress, walletClient, onDeployAgents, onRunAgentPipeline, onSwapExecuted } = context;

  return {
    getWalletBalances: tool({
      description:
        'Get ALL token balances across chains: ETH, MATIC, AVAX (native), USDC, USDT, DAI, WETH. Use this FIRST when user asks about balance, funds, wallet, or before suggesting swaps/yields. Prefer over getUSDCBalances—execution fails if we only report USDC when user has other tokens.',
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
          let portfolio = await getPortfolioSummary(addr, [1, 42161, 10, 137, 8453, 43114]);
          // Supplement: if Ethereum missing from portfolio, add from LI.FI (more reliable RPC fallbacks)
          const hasEthereum = portfolio.positions.some((p) => p.chainName === 'Ethereum' || (p as any).chainId === 1);
          if (!hasEthereum) {
            const [usdcBalances, ethNative] = await Promise.all([
              lifiService.getUSDCBalances(addr),
              lifiService.getNativeBalance(addr, 1),
            ]);
            const ethUsdc = usdcBalances.find((b) => b.chainId === 1);
            const newPositions = [...portfolio.positions];
            if (ethUsdc && ethUsdc.balanceFormatted > 0) {
              newPositions.push({ chainName: 'Ethereum', tokenSymbol: 'USDC', balance: ethUsdc.balanceFormatted, valueUSD: ethUsdc.valueUSD } as any);
            }
            if (ethNative.balanceFormatted > 0) {
              newPositions.push({ chainName: 'Ethereum', tokenSymbol: 'ETH', balance: ethNative.balanceFormatted, valueUSD: ethNative.balanceFormatted * 2500 } as any);
            }
            if (newPositions.length > portfolio.positions.length) {
              portfolio = {
                ...portfolio,
                positions: newPositions,
                totalValueUSD: newPositions.reduce((s, p) => s + p.valueUSD, 0),
                tokenCount: newPositions.length,
                chains: [...new Set([...portfolio.chains, 'Ethereum'])],
              };
            }
          }
          // Fallback: if portfolio still empty, use LI.FI USDC + native balance for all chains
          if (portfolio.positions.length === 0) {
            console.log('[AgentTools] Primary portfolio empty, using LI.FI fallback...');
            const chainNames: Record<number, string> = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon', 8453: 'Base', 43114: 'Avalanche' };
            const chainIds = [1, 42161, 10, 137, 8453, 43114];
            const positions: { chainName: string; tokenSymbol: string; balance: number; valueUSD: number }[] = [];
            let totalValueUSD = 0;

            // Fetch USDC and native balances in parallel for speed
            const [usdcBalances, ...nativeResults] = await Promise.all([
              lifiService.getUSDCBalances(addr),
              ...chainIds.map((chainId) => lifiService.getNativeBalance(addr, chainId).then((r) => ({ chainId, ...r }))),
            ]);

            for (const b of usdcBalances) {
              positions.push({ chainName: b.chainName, tokenSymbol: 'USDC', balance: b.balanceFormatted, valueUSD: b.valueUSD });
              totalValueUSD += b.valueUSD;
            }

            for (const native of nativeResults) {
              if (native.balanceFormatted > 0) {
                const chainName = chainNames[native.chainId] || `Chain ${native.chainId}`;
                const symbol = native.chainId === 137 ? 'MATIC' : native.chainId === 43114 ? 'AVAX' : 'ETH';
                const priceUSD = symbol === 'ETH' ? 2500 : symbol === 'MATIC' ? 0.8 : 35;
                const valueUSD = native.balanceFormatted * priceUSD;
                positions.push({ chainName, tokenSymbol: symbol, balance: native.balanceFormatted, valueUSD });
                totalValueUSD += valueUSD;
              }
            }

            console.log(`[AgentTools] LI.FI fallback found ${positions.length} positions, total $${totalValueUSD.toFixed(2)}`);
            portfolio = { totalValueUSD, positions, chains: [...new Set(positions.map((p) => p.chainName))], tokenCount: positions.length, lastUpdated: Date.now() };
          }
          const byChain: Record<string, string> = {};
          portfolio.positions.forEach((p) => {
            const key = `${p.chainName}`;
            if (!byChain[key]) byChain[key] = '';
            byChain[key] += (byChain[key] ? '; ' : '') + `${p.balance.toFixed(4)} ${p.tokenSymbol}`;
          });
          return {
            wallet: addr.slice(0, 6) + '...' + addr.slice(-4),
            totalValueUSD: portfolio.totalValueUSD.toFixed(2),
            byChain: Object.entries(byChain).map(([chain, tokens]) => ({ chain, tokens })),
            byToken: Object.entries(
              portfolio.positions.reduce((acc, p) => {
                acc[p.tokenSymbol] = (acc[p.tokenSymbol] || 0) + p.balance;
                return acc;
              }, {} as Record<string, number>)
            ).map(([token, bal]) => ({ token, balance: bal.toFixed(4) })),
            positions: portfolio.positions.map((p) => ({
              chain: p.chainName,
              token: p.tokenSymbol,
              balance: p.balance.toFixed(4),
              valueUSD: p.valueUSD.toFixed(2),
            })),
            hasBalance: portfolio.positions.length > 0,
          };
        } catch (err: any) {
          const msg = err?.message || err?.cause?.message || 'Failed to fetch balances';
          return { error: `${msg}. RPC or API may be temporarily unavailable—try again.` };
        }
      },
    }),

    getUSDCBalances: tool({
      description:
        'Get USDC balance only across chains. Use getWalletBalances instead when user asks about balance/funds—that returns all tokens (ETH, USDC, USDT, DAI, WETH) and prevents execution failures.',
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
          return {
            error: err?.message || err?.cause?.message || 'Failed to get quote',
            routeFound: false,
          };
        }
      },
    }),

    executeSwap: tool({
      description:
        'EXECUTE a swap/bridge when the user has CONFIRMED (e.g. "yes", "proceed", "do it", "execute"). Use the SAME params you used in getSwapQuote. Requires wallet to be connected. Call this immediately when user says yes to a swap—do not ask again.',
      inputSchema: z.object({
        fromChain: z.string().describe('Source chain (e.g. Ethereum, Polygon)'),
        toChain: z.string().describe('Destination chain'),
        fromToken: z.string().describe('Source token: USDC, ETH, WETH, USDT, or DAI'),
        toToken: z.string().describe('Destination token'),
        amount: z.string().describe('Amount in human units (e.g. 1.57 for 1.57 USDC)'),
        toAddress: z.string().optional().describe('Recipient address. Defaults to sender.'),
      }),
      execute: async ({ fromChain, toChain, fromToken, toToken, amount, toAddress }) => {
        if (!walletClient) {
          return { success: false, error: 'Wallet not connected. Connect MetaMask to execute the swap.' };
        }
        const fromChainId = resolveChainId(fromChain);
        const toChainId = resolveChainId(toChain);
        const fromInfo = getTokenInfo(fromToken, fromChainId);
        const toInfo = getTokenInfo(toToken, toChainId);
        if (!fromInfo || !toInfo) {
          return { success: false, error: 'Unsupported token or chain.' };
        }
        const amountNum = parseFloat(amount);
        const amountRaw = Math.floor(amountNum * Math.pow(10, fromInfo.decimals)).toString();
        if (amountRaw === '0') {
          return { success: false, error: 'Amount must be greater than 0.' };
        }
        try {
          const quote = await lifiService.getQuote({
            fromChain: fromChainId,
            toChain: toChainId,
            fromToken: fromInfo.address,
            toToken: toInfo.address,
            fromAmount: amountRaw,
            fromAddress: walletAddress,
            toAddress: toAddress || walletAddress,
          });
          if (!quote) {
            return { success: false, error: 'No route found. The quote may have expired.' };
          }
          const result = await lifiService.executeRoute(quote, walletClient);
          const txHash = result?.transactionHash || result?.hash || 'pending';
          const summary = `Swapped ${amount} ${fromToken} on ${fromChain} → ${toToken} on ${toChain}`;
          onSwapExecuted?.(txHash, summary);
          return {
            success: true,
            txHash,
            summary,
            message: `✅ Swap executed! TX: ${String(txHash).slice(0, 10)}...`,
          };
        } catch (err: any) {
          const msg = err?.message || err?.cause?.message || 'Execution failed';
          return { success: false, error: msg };
        }
      },
    }),

    getBestYields: tool({
      description:
        'Low-level yield data. Do NOT use for "best yield" or "where to put funds" questions—use runAgentPipeline instead so the agent orchestration decides. Only use getBestYields when user explicitly asks for raw API data or a quick check.',
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
            apy: o.apy.toFixed(2) + '%',
            tvl: `$${(o.tvl / 1e6).toFixed(2)}M`,
            type: o.type,
            risk: o.risk,
          })),
          bestApy: top[0] ? top[0].apy.toFixed(2) + '%' : null,
        };
      },
    }),

    getCrossChainVaultDepositQuote: tool({
      description:
        'Get a quote for cross-chain deposit into Aave V3 on Arbitrum. Bridge USDC from any chain + supply to Aave in one transaction. Use when user wants to "deposit into Aave", "put USDC in Aave", or similar.',
      inputSchema: z.object({
        fromChain: z
          .string()
          .describe('Source chain: Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche'),
        amount: z.string().describe('Amount in human units (e.g. 100 for 100 USDC)'),
      }),
      execute: async ({ fromChain, amount }) => {
        const fromChainId = resolveChainId(fromChain);
        const amountNum = parseFloat(amount);
        const amountRaw = Math.floor(amountNum * 1e6).toString();
        if (amountRaw === '0') {
          return { error: 'Amount must be greater than 0.' };
        }
        // Cross-chain bridge + Aave deposit need ~10+ USDC minimum (bridge limits)
        if (amountNum < 10) {
          return {
            error: `Cross-chain deposit into Aave needs at least 10 USDC. Bridges and the deposit flow have minimum requirements—${amountNum} USDC is too small. Try 10 or more USDC.`,
            routeFound: false,
          };
        }
        const addr = (walletAddress || '').trim();
        if (!addr || !addr.startsWith('0x')) {
          return { error: 'No wallet address. Connect a wallet to get a vault deposit quote.' };
        }
        try {
          const result = await getCrossChainVaultDepositQuote({
            fromChainId,
            fromAmount: amountRaw,
            fromAddress: addr,
          });
          if (!result) {
            return {
              error: 'No quote available for cross-chain Aave deposit. Try a different chain or amount (e.g. 10+ USDC).',
              routeFound: false,
            };
          }
          return {
            summary: result.summary,
            routeFound: true,
            message: result.summary,
          };
        } catch (err: any) {
          return {
            error: err?.message || 'Failed to get vault deposit quote',
            routeFound: false,
          };
        }
      },
    }),

    aaveBorrow: tool({
      description:
        'Borrow against Aave collateral for leverage. User must have supplied collateral (e.g. USDC) to Aave on Arbitrum first. Use when user says "borrow", "leverage", "borrow against my collateral".',
      inputSchema: z.object({
        chain: z.string().default('Arbitrum').describe('Chain (Arbitrum supported)'),
        borrowAsset: z.string().describe('Asset to borrow: USDC, WETH, USDT, or DAI'),
        amount: z.string().describe('Amount in human units (e.g. 100 for 100 USDC)'),
      }),
      execute: async ({ chain, borrowAsset, amount }) => {
        const chainId = resolveChainId(chain);
        if (chainId !== 42161) {
          return { error: 'Aave borrow only supported on Arbitrum. User must be on Arbitrum.' };
        }
        const decimals = borrowAsset.toUpperCase() === 'WETH' || borrowAsset.toUpperCase() === 'ETH' ? 18 : 6;
        const amountRaw = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
        if (!walletClient) {
          return { error: 'Connect wallet to borrow. User must be on Arbitrum.' };
        }
        const result = await executeAaveBorrow(
          { chainId, borrowAsset, amount: amountRaw, onBehalfOf: walletAddress },
          walletClient
        );
        if (result.success) {
          return { success: true, txHash: result.txHash, message: `Borrowed ${amount} ${borrowAsset} on Arbitrum. TX: ${result.txHash?.slice(0, 10)}...` };
        }
        return { error: result.error };
      },
    }),

    hedgeEthExposure: tool({
      description:
        'Hedge ETH exposure by swapping ETH to USDC—reduces volatility risk. Use when user says "hedge my ETH", "reduce ETH exposure", "hedge against ETH drop". Get quote first, then execute when user confirms.',
      inputSchema: z.object({
        action: z.enum(['quote', 'execute']).describe('quote = get estimate, execute = perform swap'),
        chain: z.string().describe('Chain: Ethereum, Arbitrum, Optimism, Polygon, Base, or Avalanche'),
        ethAmount: z.string().describe('ETH amount to hedge (e.g. 0.5 for half an ETH)'),
      }),
      execute: async ({ action, chain, ethAmount }) => {
        const chainId = resolveChainId(chain);
        if (action === 'quote') {
          const result = await getHedgeQuote(chain, ethAmount, walletAddress);
          if ('error' in result) return { error: result.error };
          return result;
        }
        if (!walletClient) return { error: 'Connect wallet to execute hedge.' };
        const result = await executeHedge(chain, ethAmount, walletAddress, walletClient);
        if (result.success) {
          onSwapExecuted?.(result.txHash || '', `Hedged ${ethAmount} ETH → USDC on ${chain}`);
          return { success: true, txHash: result.txHash, message: `Hedge executed. TX: ${result.txHash?.slice(0, 10)}...` };
        }
        return { error: result.error };
      },
    }),

    createStagedStrategy: tool({
      description:
        'Create a staged deposit plan (DCA). e.g. "deposit 100 USDC in 3 steps over 2 weeks". Returns a plan; user executes each step when ready.',
      inputSchema: z.object({
        totalAmount: z.string().describe('Total amount (e.g. 100 for 100 USDC)'),
        stepsCount: z.number().describe('Number of steps (e.g. 3)'),
        totalDays: z.number().describe('Span in days (e.g. 14 for 2 weeks)'),
        token: z.string().default('USDC').describe('Token symbol'),
      }),
      execute: async ({ totalAmount, stepsCount, totalDays, token }) => {
        const strategy = createStagedDepositPlan(totalAmount, stepsCount, totalDays, token);
        const stepsDesc = strategy.steps.map(s => `Step ${s.stepNumber}: ${s.amountFormatted} ${token} (${s.dueDate})`).join('\n');
        return {
          success: true,
          strategyId: strategy.id,
          message: `Created ${stepsCount}-step plan: ${totalAmount} ${token} over ${totalDays} days.\n${stepsDesc}\n\nSay "execute step 1" when ready to run the first deposit.`,
          steps: strategy.steps,
        };
      },
    }),

    executeStagedStep: tool({
      description:
        'Execute the next pending step of a staged strategy. Use when user says "execute step 1", "do the next step", "run step 2".',
      inputSchema: z.object({
        stepNumber: z.number().optional().describe('Step to execute (1-based). If omitted, executes next pending.'),
      }),
      execute: async ({ stepNumber }) => {
        const strategy = getStagedStrategy();
        if (!strategy) return { error: 'No staged strategy. Create one first with createStagedStrategy.' };
        const step = stepNumber
          ? strategy.steps.find(s => s.stepNumber === stepNumber)
          : getNextPendingStep();
        if (!step || step.status !== 'pending') {
          return { error: stepNumber ? `Step ${stepNumber} not found or already done.` : 'No pending steps.' };
        }
        if (!walletClient) return { error: 'Connect wallet to execute.' };
        const chainId = 42161;
        const { getCrossChainVaultDepositQuote } = await import('./crossChainVaultDeposit');
        const fromChainId = walletClient.chain?.id || 1;
        const result = await getCrossChainVaultDepositQuote({
          fromChainId,
          fromAmount: step.amount,
          fromAddress: walletAddress,
        });
        if (!result) {
          return { error: `No route for step ${step.stepNumber}. Try deposit into Aave directly.` };
        }
        const execResult = await lifiService.executeRoute(result.quote, walletClient);
        const txHash = execResult?.transactionHash || execResult?.hash;
        completeStagedStep(step.stepNumber, txHash);
        return {
          success: true,
          txHash,
          message: `Step ${step.stepNumber} done: ${step.amountFormatted} ${strategy.token}. TX: ${txHash?.slice(0, 10)}...`,
        };
      },
    }),

    getPerpsInfo: tool({
      description:
        'Get info about perpetuals/shorting for hedging. Use when user asks about "shorting", "perps", "perpetuals", "hedge with short". Returns guidance—actual perps trading requires Hyperliquid app.',
      inputSchema: z.object({
        asset: z.string().optional().default('ETH').describe('Asset user wants to short or hedge'),
      }),
      execute: async ({ asset }) => {
        return {
          message: `To short or hedge ${asset} with perpetuals: Use Hyperliquid (app.hyperliquid.xyz) or GMX. Connect your wallet there to open short positions. This app handles swaps, yield, and Aave—for perps you'll need to use a dedicated perps platform. I can help you hedge by swapping ${asset} to USDC instead—say "hedge my ETH" to reduce exposure.`,
          alternatives: ['hedgeEthExposure: Swap ETH to USDC to reduce volatility risk', 'Aave borrow: Borrow against collateral for leverage'],
        };
      },
    }),

    getYieldComparison: tool({
      description:
        'Low-level yield comparison. Do NOT use for yield questions—use runAgentPipeline with intentType yield_optimization so the agent orchestration decides. Only use when user explicitly asks for raw yield comparison data.',
      inputSchema: z.object({
        token: z.string().default('USDC').describe('Token symbol'),
      }),
      execute: async ({ token }) => {
        const result = await getYieldComparison(token);
        return {
          token: result.token,
          averageApy: result.averageApy.toFixed(2) + '%',
          bestOpportunity: result.bestOpportunity
            ? {
                protocol: result.bestOpportunity.protocol,
                chain: result.bestOpportunity.chainName,
                apy: result.bestOpportunity.apy.toFixed(2) + '%',
                tvl: `$${(result.bestOpportunity.tvl / 1e6).toFixed(2)}M`,
              }
            : null,
          yieldCount: result.yields.length,
        };
      },
    }),

    deployAgents: tool({
      description:
        'Deploy/activate all agents in the orchestration window. Use when user says "make best use of", "optimize my funds", "put my USDC to work", or similar—to show the agent team (Paul Atreides, Chani, Irulan, Liet-Kynes, Duncan Idaho, Thufir Hawat, Stilgar) on the Flow Canvas before executing.',
      inputSchema: z.object({}),
      execute: async () => {
        if (onDeployAgents) {
          onDeployAgents();
          return { success: true, message: 'Agents deployed to orchestration window.' };
        }
        return { success: false, error: 'Deploy not available.' };
      },
    }),

    runAgentPipeline: tool({
      description:
        'Run the 7 agents directly on the user request. Each agent (Chani, Irulan, Liet-Kynes, Duncan Idaho, Thufir Hawat, Stilgar) performs their job (arbitrage, portfolio, yield, risk, rebalancing, execution). Use when user asks for yield, arbitrage, portfolio check, rebalancing, or "make best use of" - AFTER deployAgents. Pass the user message to determine intent.',
      inputSchema: z.object({
        intentType: z
          .enum(['yield_optimization', 'arbitrage', 'rebalancing', 'portfolio_check', 'swap', 'vault_deposit', 'hedge', 'borrow', 'staged_strategy', 'monitoring', 'general'])
          .describe('Intent: yield_optimization, arbitrage, rebalancing, portfolio_check, swap, vault_deposit, hedge, borrow, staged_strategy, monitoring, or general'),
        userMessage: z.string().optional().describe('The user message (e.g. "find best yield for my USDC") to parse intent from'),
      }),
      execute: async ({ intentType, userMessage }) => {
        if (!onRunAgentPipeline) {
          return { success: false, error: 'Agent pipeline not available.' };
        }
        try {
          const result = await onRunAgentPipeline(intentType, userMessage);
          return {
            success: result.success,
            summary: result.summary,
            agentOutputs: result.agentOutputs,
            message: result.summary ? `Agents completed:\n${result.summary}` : 'No agent output.',
          };
        } catch (err: any) {
          return { success: false, error: err?.message || 'Pipeline failed.' };
        }
      },
    }),

    executeYieldWorkflow: tool({
      description:
        'Execute the yield workflow: find best opportunity and move USDC to the highest-yielding protocol. Use when user says "do the workflow", "execute", "deposit to best yield", "run it", "put my USDC there", or "implement it". Requires connected wallet for signing.',
      inputSchema: z.object({
        maxGasCost: z
          .number()
          .optional()
          .default(50)
          .describe('Max gas cost in USD (default 50)'),
        minApyImprovement: z
          .number()
          .optional()
          .default(2)
          .describe('Min APY improvement % over current position (default 2)'),
      }),
      execute: async ({ maxGasCost, minApyImprovement }) => {
        if (!walletClient?.account?.address) {
          return {
            success: false,
            error: 'Connect your wallet to execute. Click Connect Wallet in the app, then try again.',
          };
        }
        const addr = (walletAddress || walletClient.account.address || '').trim();
        if (!addr || !addr.startsWith('0x')) {
          return { success: false, error: 'No wallet address. Connect a wallet first.' };
        }
        try {
          const statuses: string[] = [];
          const result = await oneClickYieldRotation(addr as `0x${string}`, walletClient, {
            minApyImprovement,
            maxGasCost,
            onStatusUpdate: (s) => statuses.push(s),
          });
          if (result.success) {
            const txHash = result.result?.txHash;
            return {
              success: true,
              message: `Yield rotation executed! ${result.plan?.toOpportunity.protocol} on ${result.plan?.toOpportunity.chainName} (+${result.plan?.apyImprovement.toFixed(2)}% APY).`,
              txHash: txHash || null,
              plan: result.plan
                ? {
                    protocol: result.plan.toOpportunity.protocol,
                    chain: result.plan.toOpportunity.chainName,
                    apyImprovement: result.plan.apyImprovement.toFixed(2) + '%',
                  }
                : null,
            };
          }
          return {
            success: false,
            error: result.error || 'Execution failed',
          };
        } catch (err: any) {
          const msg = err?.message || err?.cause?.message || 'Execution failed';
          return { success: false, error: msg };
        }
      },
    }),
  };
}
