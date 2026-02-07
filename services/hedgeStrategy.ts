// Hedge ETH Exposure - Reduce risk by swapping ETH to stablecoins
// "Hedge my ETH" = swap a portion of ETH to USDC to reduce volatility exposure

import { lifiService } from './lifi';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  base: 8453,
  avalanche: 43114,
};

const WETH_ADDRESSES: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  10: '0x4200000000000000000000000000000000000006',
  137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  8453: '0x4200000000000000000000000000000000000006',
  43114: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
};

const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

function resolveChain(chain: string): number {
  const lower = String(chain).toLowerCase().replace(/\s/g, '');
  return CHAIN_IDS[lower] ?? 1;
}

export interface HedgeQuote {
  fromChain: string;
  fromAmount: string;
  toAmountEstimate: string;
  message: string;
  routeFound: boolean;
}

export interface HedgeExecuteResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Get quote for hedging ETH → USDC (reduce volatility exposure).
 */
export async function getHedgeQuote(
  chain: string,
  ethAmount: string,
  walletAddress: string
): Promise<HedgeQuote | { error: string }> {
  const chainId = resolveChain(chain);
  const weth = WETH_ADDRESSES[chainId];
  const usdc = USDC_ADDRESSES[chainId];
  if (!weth || !usdc) {
    return { error: 'Chain not supported for hedging.' };
  }

  const amountNum = parseFloat(ethAmount);
  const amountRaw = Math.floor(amountNum * 1e18).toString();
  if (amountRaw === '0') {
    return { error: 'Amount must be greater than 0.' };
  }

  try {
    const result = await lifiService.getQuoteWithArcInfo({
      fromChain: chainId,
      toChain: chainId,
      fromToken: weth,
      toToken: usdc,
      fromAmount: amountRaw,
      fromAddress: walletAddress,
      toAddress: walletAddress,
    });

    const quote = result?.quote;
    if (!quote) return { error: 'No route found for this hedge.' };

    const toAmountRaw = (quote as any).estimate?.toAmount;
    const toAmountFormatted = toAmountRaw
      ? (parseFloat(toAmountRaw) / 1e6).toFixed(2)
      : 'N/A';

    return {
      fromChain: chain,
      fromAmount: ethAmount,
      toAmountEstimate: toAmountFormatted,
      message: `Hedge: swap ${ethAmount} ETH → ~${toAmountFormatted} USDC on ${chain}. Reduces ETH exposure.`,
      routeFound: true,
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to get hedge quote.' };
  }
}

/**
 * Execute hedge (ETH → USDC swap).
 */
export async function executeHedge(
  chain: string,
  ethAmount: string,
  walletAddress: string,
  walletClient: any
): Promise<HedgeExecuteResult> {
  if (!walletClient) {
    return { success: false, error: 'Wallet not connected.' };
  }

  const chainId = resolveChain(chain);
  const weth = WETH_ADDRESSES[chainId];
  const usdc = USDC_ADDRESSES[chainId];
  if (!weth || !usdc) {
    return { success: false, error: 'Chain not supported.' };
  }

  const amountRaw = Math.floor(parseFloat(ethAmount) * 1e18).toString();
  try {
    const quote = await lifiService.getQuote({
      fromChain: chainId,
      toChain: chainId,
      fromToken: weth,
      toToken: usdc,
      fromAmount: amountRaw,
      fromAddress: walletAddress,
      toAddress: walletAddress,
    });
    if (!quote) return { success: false, error: 'No route found.' };

    const result = await lifiService.executeRoute(quote, walletClient);
    const txHash = result?.transactionHash || result?.hash;
    return { success: true, txHash };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || err?.cause?.message || 'Hedge execution failed.',
    };
  }
}
