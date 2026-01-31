// Custom hook for wallet integration with the agents system
import { useAccount, useChainId, useBalance, useWalletClient } from 'wagmi';
import { useEffect } from 'react';

export interface WalletState {
  isConnected: boolean;
  address: string | undefined;
  chainId: number | undefined;
  balance: string;
  balanceSymbol: string;
  walletClient: any;
}

export function useWallet(): WalletState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({ address });
  const { data: walletClient } = useWalletClient();

  // Auto-save connected wallet address to localStorage for agents
  useEffect(() => {
    if (isConnected && address) {
      localStorage.setItem('trackedWalletAddress', address);
    }
  }, [isConnected, address]);

  return {
    isConnected,
    address,
    chainId,
    balance: balanceData ? (Number(balanceData.value) / 10 ** balanceData.decimals).toFixed(4) : '0',
    balanceSymbol: balanceData?.symbol || 'ETH',
    walletClient,
  };
}

// Get current wallet address (connected or from localStorage)
export function getWalletAddress(): string {
  // Try localStorage first (set by wagmi connection)
  const stored = localStorage.getItem('trackedWalletAddress');
  if (stored && stored.startsWith('0x')) {
    return stored;
  }
  
  // Demo address fallback
  return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
}

export default useWallet;
