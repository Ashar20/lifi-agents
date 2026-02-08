// Direct Aave V3 withdrawal
// Withdraw underlying asset (e.g. USDC) from Aave by burning aTokens

import { PROTOCOL_ADDRESSES } from './contracts/registry';
import { AAVE_V3_POOL_ABI } from './abis/aave';

export interface AaveWithdrawParams {
  chainId: number;
  assetAddress: string; // underlying asset (e.g. USDC address)
  amountRaw: string; // raw amount in asset decimals, or "max" for full withdrawal
  toAddress: string;
}

export interface AaveWithdrawResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Withdraw from Aave V3 Pool.
 * Calls pool.withdraw(asset, amount, to) — burns aTokens and returns underlying.
 * No approval needed (pool already holds the aTokens).
 */
export async function executeAaveWithdraw(
  params: AaveWithdrawParams,
  walletClient: any
): Promise<AaveWithdrawResult> {
  if (!walletClient?.account?.address) {
    return { success: false, error: 'Wallet not connected.' };
  }

  const { chainId, assetAddress, amountRaw, toAddress } = params;
  const amountBigInt = amountRaw === 'max'
    ? BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') // type(uint256).max
    : BigInt(amountRaw);

  const aave = PROTOCOL_ADDRESSES.aave?.[chainId];
  if (!aave?.pool) {
    return { success: false, error: `Aave not supported on chain ${chainId}.` };
  }

  try {
    const { createPublicClient, createWalletClient, custom, http } = await import('viem');
    const chains = await import('viem/chains');
    const chain = [chains.arbitrum, chains.mainnet, chains.optimism, chains.polygon, chains.base].find(
      (c) => c.id === chainId
    );
    if (!chain) {
      return { success: false, error: `Unsupported chain ${chainId}.` };
    }

    // Switch wallet to the target chain if needed
    const currentChainId = walletClient.chain?.id;
    let activeWalletClient = walletClient;
    if (currentChainId !== chainId) {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const hexChainId = '0x' + chainId.toString(16);
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
        activeWalletClient = createWalletClient({
          account: walletClient.account,
          chain,
          transport: custom((window as any).ethereum),
        });
      } else if (walletClient.switchChain) {
        await walletClient.switchChain({ id: chainId });
      } else {
        return {
          success: false,
          error: `Please switch to ${chainId === 42161 ? 'Arbitrum' : chainId === 1 ? 'Ethereum' : `chain ${chainId}`} to withdraw.`,
        };
      }
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    // Withdraw from Aave — no approval needed, pool burns aTokens directly
    const withdrawHash = await activeWalletClient.writeContract({
      address: aave.pool as `0x${string}`,
      abi: AAVE_V3_POOL_ABI,
      functionName: 'withdraw',
      args: [
        assetAddress as `0x${string}`,
        amountBigInt,
        toAddress as `0x${string}`,
      ],
      account: activeWalletClient.account,
      chain: chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

    return { success: true, txHash: withdrawHash };
  } catch (err: any) {
    const msg = err?.message || err?.cause?.message || 'Withdrawal failed.';
    return { success: false, error: msg };
  }
}
