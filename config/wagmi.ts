// Wagmi Configuration for Multi-Chain Wallet Connection
import { createConfig, http } from 'wagmi';
import { mainnet, arbitrum, optimism, polygon, base, avalanche } from 'wagmi/chains';
import { mantleTestnet } from 'viem/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect Project ID (optional - for WalletConnect modal)
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

// Supported chains for LI.FI cross-chain operations
export const supportedChains = [mainnet, arbitrum, optimism, polygon, base, avalanche, mantleTestnet] as const;

// Create wagmi config
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    // Generic injected (MetaMask)
    injected({
      shimDisconnect: true,
    }),
    ...(projectId ? [
      walletConnect({
        projectId,
        showQrModal: true,
        metadata: {
          name: 'LI.FI Agents Orchestrator',
          description: 'Cross-Chain DeFi Orchestration Platform',
          url: 'https://li.fi',
          icons: ['https://li.fi/logo.png'],
        },
      }),
      coinbaseWallet({
        appName: 'LI.FI Agents Orchestrator',
      }),
    ] : []),
  ],
  transports: {
    [mainnet.id]: http('https://rpc.ankr.com/eth'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [base.id]: http('https://mainnet.base.org'),
    [avalanche.id]: http('https://api.avax.network/ext/bc/C/rpc'),
    [mantleTestnet.id]: http('https://rpc.testnet.mantle.xyz'),
  },
});

// Chain metadata for display
export const chainInfo: Record<number, { name: string; color: string; icon: string }> = {
  [mainnet.id]: { name: 'Ethereum', color: '#627EEA', icon: '⟠' },
  [arbitrum.id]: { name: 'Arbitrum', color: '#28A0F0', icon: '🔷' },
  [optimism.id]: { name: 'Optimism', color: '#FF0420', icon: '🔴' },
  [polygon.id]: { name: 'Polygon', color: '#8247E5', icon: '🟣' },
  [base.id]: { name: 'Base', color: '#0052FF', icon: '🔵' },
  [avalanche.id]: { name: 'Avalanche', color: '#E84142', icon: '🔺' },
  [mantleTestnet.id]: { name: 'Mantle Testnet', color: '#00D4FF', icon: '🧪' },
};

export type SupportedChainId = typeof supportedChains[number]['id'];
