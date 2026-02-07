// Aave V3 Borrow - Leverage by borrowing against supplied collateral
// Same-chain only (Arbitrum). User must have supplied collateral to Aave first.

import { encodeFunctionData } from 'viem';
import { PROTOCOL_ADDRESSES } from './contracts/registry';
import { AAVE_V3_POOL_ABI } from './abis/aave';

const ARBITRUM_CHAIN_ID = 42161;

// Borrowable assets on Aave Arbitrum
const BORROWABLE_ASSETS: Record<string, string> = {
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
};

// interestRateMode: 1 = stable, 2 = variable (use variable for most assets)
const RATE_MODE_VARIABLE = 2;

export interface AaveBorrowParams {
  chainId: number;
  borrowAsset: string; // USDC, WETH, etc.
  amount: string; // raw units
  onBehalfOf: string;
}

export interface AaveBorrowResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Build encoded borrow calldata for Aave V3.
 * Does not execute - returns data for execution.
 */
export function buildAaveBorrowCalldata(params: AaveBorrowParams): string | null {
  const aave = PROTOCOL_ADDRESSES.aave?.[params.chainId];
  const assetAddr = BORROWABLE_ASSETS[params.borrowAsset.toUpperCase()];
  if (!aave?.pool || !assetAddr) return null;

  return encodeFunctionData({
    abi: AAVE_V3_POOL_ABI,
    functionName: 'borrow',
    args: [
      assetAddr as `0x${string}`,
      BigInt(params.amount),
      RATE_MODE_VARIABLE,
      0,
      params.onBehalfOf as `0x${string}`,
    ],
  });
}

/**
 * Execute Aave borrow - requires walletClient and user to be on correct chain.
 */
export async function executeAaveBorrow(
  params: AaveBorrowParams,
  walletClient: any
): Promise<AaveBorrowResult> {
  if (!walletClient?.account?.address) {
    return { success: false, error: 'Wallet not connected.' };
  }

  const chainId = walletClient.chain?.id;
  if (chainId !== params.chainId) {
    return {
      success: false,
      error: `Please switch to ${params.chainId === 42161 ? 'Arbitrum' : `chain ${params.chainId}`} to borrow.`,
    };
  }

  const aave = PROTOCOL_ADDRESSES.aave?.[params.chainId];
  const assetAddr = BORROWABLE_ASSETS[params.borrowAsset.toUpperCase()];
  if (!aave?.pool || !assetAddr) {
    return { success: false, error: 'Aave not configured for this chain.' };
  }

  const calldata = buildAaveBorrowCalldata(params);
  if (!calldata) return { success: false, error: 'Invalid borrow params.' };

  try {
    const { createPublicClient, createWalletClient, http } = await import('viem');
    const { arbitrum } = await import('viem/chains');

    const hash = await walletClient.sendTransaction({
      account: walletClient.account,
      to: aave.pool as `0x${string}`,
      data: calldata as `0x${string}`,
      chain: walletClient.chain || arbitrum,
    });

    return { success: true, txHash: hash };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || err?.cause?.message || 'Borrow failed. Check collateral and health factor.',
    };
  }
}
