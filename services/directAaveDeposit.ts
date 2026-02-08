// Direct same-chain Aave V3 supply (no bridge)
// Execute approve + supply when user has USDC on same chain as Aave

import { PROTOCOL_ADDRESSES } from './contracts/registry';
import { AAVE_V3_POOL_ABI } from './abis/aave';

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface DirectAaveDepositParams {
  chainId: number;
  usdcAddress: string;
  amountRaw: string;
  fromAddress: string;
}

export interface DirectAaveDepositResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Execute direct Aave supply on same chain.
 * 1. Approve USDC to Aave Pool (if needed)
 * 2. Call Aave Pool supply(asset, amount, onBehalfOf, 0)
 */
export async function executeDirectAaveDeposit(
  params: DirectAaveDepositParams,
  walletClient: any
): Promise<DirectAaveDepositResult> {
  if (!walletClient?.account?.address) {
    return { success: false, error: 'Wallet not connected.' };
  }

  const { chainId, usdcAddress, amountRaw, fromAddress } = params;
  const amountBigInt = BigInt(amountRaw);

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
        // Re-create walletClient bound to the correct chain after provider switch
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
          error: `Please switch to ${chainId === 42161 ? 'Arbitrum' : chainId === 1 ? 'Ethereum' : `chain ${chainId}`} to deposit.`,
        };
      }
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    // Check current allowance
    const allowance = await publicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [fromAddress as `0x${string}`, aave.pool as `0x${string}`],
    });

    if (allowance < amountBigInt) {
      // Approve max (Aave recommends type(uint256).max for supply)
      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const approveHash = await activeWalletClient.writeContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aave.pool as `0x${string}`, maxApproval],
        account: activeWalletClient.account,
        chain: chain,
      });
      // Wait for approval to be mined before supply
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Supply to Aave
    const supplyHash = await activeWalletClient.writeContract({
      address: aave.pool as `0x${string}`,
      abi: AAVE_V3_POOL_ABI,
      functionName: 'supply',
      args: [
        usdcAddress as `0x${string}`,
        amountBigInt,
        fromAddress as `0x${string}`,
        0,
      ],
      account: activeWalletClient.account,
      chain: chain,
    });

    return { success: true, txHash: supplyHash };
  } catch (err: any) {
    const msg = err?.message || err?.cause?.message || 'Deposit failed.';
    return { success: false, error: msg };
  }
}
