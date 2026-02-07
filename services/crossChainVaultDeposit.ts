// Cross-chain vault deposit via LI.FI contract calls
// Bridge USDC from any chain → deposit into Aave V3 on Arbitrum in one sign

import { encodeFunctionData } from 'viem';
import { lifiService } from './lifi';
import { PROTOCOL_ADDRESSES } from './contracts/registry';
import { AAVE_V3_POOL_ABI } from './abis/aave';
import type { LifiStep } from '@lifi/types';

// Arbitrum chain ID (destination for Aave)
const ARBITRUM_CHAIN_ID = 42161;

// Native USDC per chain (LI.FI / Arc compatible)
const USDC_BY_CHAIN: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

export interface CrossChainVaultDepositParams {
  fromChainId: number;
  fromAmount: string; // raw units (6 decimals for USDC)
  fromAddress: string;
}

export interface CrossChainVaultDepositResult {
  quote: LifiStep;
  summary: string;
}

const GAS_LIMIT_AAVE_SUPPLY = '350000';

/**
 * Get a quote for cross-chain USDC deposit into Aave V3 on Arbitrum.
 * One sign: bridge + Aave supply.
 */
export async function getCrossChainVaultDepositQuote(
  params: CrossChainVaultDepositParams
): Promise<CrossChainVaultDepositResult | null> {
  const { fromChainId, fromAmount, fromAddress } = params;

  const amountNum = parseFloat(fromAmount) / 1e6;
  if (amountNum < 10) {
    console.warn('[VaultDeposit] Amount below minimum:', amountNum, 'USDC');
    return null;
  }

  const usdcSrc = USDC_BY_CHAIN[fromChainId];
  if (!usdcSrc) {
    console.warn('[VaultDeposit] Unsupported source chain:', fromChainId);
    return null;
  }

  const aave = PROTOCOL_ADDRESSES.aave?.[ARBITRUM_CHAIN_ID];
  if (!aave?.pool || !aave.aTokens?.USDC) {
    console.warn('[VaultDeposit] Aave Arbitrum contracts not configured');
    return null;
  }

  const usdcArb = USDC_BY_CHAIN[ARBITRUM_CHAIN_ID];
  if (!usdcArb) return null;

  // Aave supply(asset, amount, onBehalfOf, referralCode)
  const callData = encodeFunctionData({
    abi: AAVE_V3_POOL_ABI,
    functionName: 'supply',
    args: [
      usdcArb as `0x${string}`,
      BigInt(fromAmount),
      fromAddress as `0x${string}`,
      0,
    ],
  });

  const request = {
    fromAddress,
    fromChain: fromChainId,
    fromToken: usdcSrc,
    toChain: ARBITRUM_CHAIN_ID,
    toToken: usdcArb,
    toAmount: fromAmount,
    contractCalls: [
      {
        fromAmount,
        fromTokenAddress: usdcArb,
        toContractAddress: aave.pool,
        toContractCallData: callData,
        toContractGasLimit: GAS_LIMIT_AAVE_SUPPLY,
        toApprovalAddress: aave.pool,
        contractOutputsToken: aave.aTokens.USDC,
      },
    ],
  };

  try {
    const quote = await lifiService.getContractCallsQuote(request);
    if (!quote) return null;

    const amountFormatted = (parseFloat(fromAmount) / 1e6).toFixed(2);
    const summary = `Bridge ${amountFormatted} USDC from chain ${fromChainId} → deposit into Aave V3 on Arbitrum. One transaction.`;

    return { quote, summary };
  } catch (err) {
    console.error('[VaultDeposit] Quote failed:', err);
    return null;
  }
}

/**
 * Execute the cross-chain vault deposit (same as bridge execution).
 */
export async function executeCrossChainVaultDeposit(
  quote: LifiStep,
  walletClient: any
): Promise<any> {
  return lifiService.executeRoute(quote, walletClient);
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

/** Build ExecutionPlan-compatible object from vault deposit result for App.tsx pipeline */
export function vaultDepositToExecutionPlan(
  result: CrossChainVaultDepositResult,
  fromAmountUSD: number
): {
  quote: LifiStep;
  steps: Array<{ stepNumber: number; type: string; fromChain: string; toChain: string; tool: string; estimatedTime: number; gasCost: number }>;
  estimatedOutputUSD: number;
  gasCostUSD: number;
  readyToExecute: boolean;
  warnings: string[];
} {
  const quote = result.quote as any;
  let gasCostUSD = 0;
  const estimate = quote?.estimate || {};
  if (estimate.gasCosts && Array.isArray(estimate.gasCosts)) {
    gasCostUSD = estimate.gasCosts.reduce((sum: number, g: any) => sum + parseFloat(g.amountUSD || '0'), 0);
  }
  const steps: Array<{ stepNumber: number; type: string; fromChain: string; toChain: string; tool: string; estimatedTime: number; gasCost: number }> = [];
  if (quote?.includedSteps) {
    quote.includedSteps.forEach((step: any, i: number) => {
      steps.push({
        stepNumber: i + 1,
        type: step.type === 'cross' ? 'bridge' : 'swap',
        fromChain: CHAIN_NAMES[step.action?.fromChainId] || `Chain ${step.action?.fromChainId}`,
        toChain: CHAIN_NAMES[step.action?.toChainId] || `Chain ${step.action?.toChainId}`,
        tool: step.toolDetails?.name || 'LI.FI',
        estimatedTime: parseInt(step.estimate?.executionDuration || '0'),
        gasCost: parseFloat(step.estimate?.gasCosts?.[0]?.amountUSD || '0'),
      });
    });
  }
  if (steps.length === 0) {
    steps.push({
      stepNumber: 1,
      type: 'bridge',
      fromChain: 'Source',
      toChain: 'Arbitrum',
      tool: 'LI.FI + Aave',
      estimatedTime: 300,
      gasCost: gasCostUSD,
    });
  }
  return {
    quote: result.quote,
    steps,
    estimatedOutputUSD: fromAmountUSD,
    gasCostUSD,
    readyToExecute: true,
    warnings: [],
  };
}
