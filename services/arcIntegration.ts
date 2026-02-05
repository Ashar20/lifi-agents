// Arc Integration Service
// Circle's Arc is the liquidity hub for native USDC cross-chain transfers
// Arc uses CCTP (Cross-Chain Transfer Protocol) for burn/mint mechanism
// LI.FI routes USDC transfers through Arc/CCTP for optimal native USDC experience

export interface ArcTransferInfo {
  isArcRoute: boolean;
  protocol: 'CCTP' | 'BRIDGE' | 'SWAP';
  mechanism: 'burn-mint' | 'lock-unlock' | 'swap';
  sourceChain: string;
  destinationChain: string;
  estimatedTime: string;
  arcBranding: {
    badge: string;
    description: string;
    color: string;
  };
}

export interface ArcSupportedChain {
  chainId: number;
  name: string;
  usdcAddress: string;
  cctpDomain: number;
  isTestnet: boolean;
  explorerUrl: string;
}

// Arc/CCTP supported chains with their USDC addresses and CCTP domains
// Reference: https://developers.circle.com/stablecoins/docs/cctp-getting-started
export const ARC_SUPPORTED_CHAINS: ArcSupportedChain[] = [
  // Mainnet chains
  {
    chainId: 1,
    name: 'Ethereum',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    cctpDomain: 0,
    isTestnet: false,
    explorerUrl: 'https://etherscan.io',
  },
  {
    chainId: 42161,
    name: 'Arbitrum',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    cctpDomain: 3,
    isTestnet: false,
    explorerUrl: 'https://arbiscan.io',
  },
  {
    chainId: 10,
    name: 'Optimism',
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    cctpDomain: 2,
    isTestnet: false,
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  {
    chainId: 137,
    name: 'Polygon',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    cctpDomain: 7,
    isTestnet: false,
    explorerUrl: 'https://polygonscan.com',
  },
  {
    chainId: 8453,
    name: 'Base',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    cctpDomain: 6,
    isTestnet: false,
    explorerUrl: 'https://basescan.org',
  },
  {
    chainId: 43114,
    name: 'Avalanche',
    usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    cctpDomain: 1,
    isTestnet: false,
    explorerUrl: 'https://snowtrace.io',
  },
  // Arc Testnet (Circle's dedicated testnet)
  {
    chainId: 400017,
    name: 'Arc Testnet',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Testnet USDC
    cctpDomain: 9, // Arc testnet domain
    isTestnet: true,
    explorerUrl: 'https://testnet.arcscan.io',
  },
];

// Check if a chain is supported by Arc/CCTP
export function isArcSupported(chainId: number): boolean {
  return ARC_SUPPORTED_CHAINS.some(chain => chain.chainId === chainId);
}

// Get Arc chain info
export function getArcChainInfo(chainId: number): ArcSupportedChain | null {
  return ARC_SUPPORTED_CHAINS.find(chain => chain.chainId === chainId) || null;
}

// Get native USDC address for a chain (Arc-supported)
export function getArcUsdcAddress(chainId: number): string | null {
  const chain = getArcChainInfo(chainId);
  return chain?.usdcAddress || null;
}

// Check if a token is Arc-native USDC
export function isArcNativeUsdc(tokenAddress: string, chainId: number): boolean {
  const arcUsdc = getArcUsdcAddress(chainId);
  if (!arcUsdc) return false;
  return tokenAddress.toLowerCase() === arcUsdc.toLowerCase();
}

// Check if a transfer can use Arc/CCTP
export function canUseArcRoute(
  fromChainId: number,
  toChainId: number,
  fromToken: string,
  toToken: string
): boolean {
  // Both chains must be Arc-supported
  if (!isArcSupported(fromChainId) || !isArcSupported(toChainId)) {
    return false;
  }

  // Both tokens must be Arc-native USDC
  if (!isArcNativeUsdc(fromToken, fromChainId) || !isArcNativeUsdc(toToken, toChainId)) {
    return false;
  }

  // Same chain transfers don't need Arc
  if (fromChainId === toChainId) {
    return false;
  }

  return true;
}

// Get Arc transfer information for display
export function getArcTransferInfo(
  fromChainId: number,
  toChainId: number,
  fromToken: string,
  toToken: string,
  bridgeUsed?: string
): ArcTransferInfo {
  const fromChain = getArcChainInfo(fromChainId);
  const toChain = getArcChainInfo(toChainId);

  const isArcRoute = canUseArcRoute(fromChainId, toChainId, fromToken, toToken) &&
    (bridgeUsed?.toLowerCase().includes('cctp') || bridgeUsed?.toLowerCase().includes('circle'));

  if (isArcRoute) {
    return {
      isArcRoute: true,
      protocol: 'CCTP',
      mechanism: 'burn-mint',
      sourceChain: fromChain?.name || `Chain ${fromChainId}`,
      destinationChain: toChain?.name || `Chain ${toChainId}`,
      estimatedTime: '~15 minutes', // CCTP typical attestation time
      arcBranding: {
        badge: '⚡ Arc Powered',
        description: 'Native USDC transfer via Circle CCTP - burn on source, mint on destination',
        color: '#0066FF', // Circle blue
      },
    };
  }

  return {
    isArcRoute: false,
    protocol: fromChainId !== toChainId ? 'BRIDGE' : 'SWAP',
    mechanism: fromChainId !== toChainId ? 'lock-unlock' : 'swap',
    sourceChain: fromChain?.name || `Chain ${fromChainId}`,
    destinationChain: toChain?.name || `Chain ${toChainId}`,
    estimatedTime: fromChainId !== toChainId ? '10-30 minutes' : '< 1 minute',
    arcBranding: {
      badge: 'Standard Route',
      description: 'Standard bridge/swap route',
      color: '#888888',
    },
  };
}

// Format Arc transfer for logging
export function formatArcLog(info: ArcTransferInfo): string {
  if (info.isArcRoute) {
    return `
╔══════════════════════════════════════════════════════════════╗
║  ⚡ ARC LIQUIDITY HUB - NATIVE USDC TRANSFER                 ║
╠══════════════════════════════════════════════════════════════╣
║  Protocol: Circle CCTP (Cross-Chain Transfer Protocol)       ║
║  Mechanism: Burn on ${info.sourceChain.padEnd(12)} → Mint on ${info.destinationChain.padEnd(12)}  ║
║  Status: Native USDC - No wrapped tokens!                    ║
║  Est. Time: ${info.estimatedTime.padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝`;
  }

  return `[Standard Route] ${info.sourceChain} → ${info.destinationChain} via ${info.protocol}`;
}

// Arc transfer statistics tracker
export interface ArcStats {
  totalTransfers: number;
  totalVolumeUsd: number;
  chainBreakdown: Record<string, { count: number; volumeUsd: number }>;
  lastTransfer?: {
    timestamp: number;
    fromChain: string;
    toChain: string;
    amountUsd: number;
  };
}

class ArcStatsTracker {
  private storageKey = 'arc_transfer_stats';
  private stats: ArcStats;
  private listeners: ((stats: ArcStats) => void)[] = [];

  constructor() {
    this.stats = this.load();
  }

  private load(): ArcStats {
    if (typeof window === 'undefined') {
      return this.getDefaultStats();
    }
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : this.getDefaultStats();
    } catch {
      return this.getDefaultStats();
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Failed to save Arc stats:', e);
    }
  }

  private getDefaultStats(): ArcStats {
    return {
      totalTransfers: 0,
      totalVolumeUsd: 0,
      chainBreakdown: {},
    };
  }

  recordTransfer(fromChain: string, toChain: string, amountUsd: number): void {
    this.stats.totalTransfers++;
    this.stats.totalVolumeUsd += amountUsd;

    // Update chain breakdown
    const routeKey = `${fromChain}->${toChain}`;
    if (!this.stats.chainBreakdown[routeKey]) {
      this.stats.chainBreakdown[routeKey] = { count: 0, volumeUsd: 0 };
    }
    this.stats.chainBreakdown[routeKey].count++;
    this.stats.chainBreakdown[routeKey].volumeUsd += amountUsd;

    // Update last transfer
    this.stats.lastTransfer = {
      timestamp: Date.now(),
      fromChain,
      toChain,
      amountUsd,
    };

    this.save();
    this.notifyListeners();
  }

  getStats(): ArcStats {
    return { ...this.stats };
  }

  subscribe(listener: (stats: ArcStats) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.getStats()));
  }

  reset(): void {
    this.stats = this.getDefaultStats();
    this.save();
    this.notifyListeners();
  }
}

// Export singleton instance
export const arcStats = new ArcStatsTracker();

// Console branding for Arc
export function logArcBranding(): void {
  if (typeof window === 'undefined') return;

  console.log('%c', 'font-size: 1px;');
  console.log(
    '%c  ⚡ ARC LIQUIDITY HUB  ',
    'background: linear-gradient(90deg, #0066FF, #00AAFF); color: white; font-size: 16px; font-weight: bold; padding: 8px 16px; border-radius: 4px;'
  );
  console.log(
    '%cPowered by Circle CCTP - Native USDC Cross-Chain Transfers',
    'color: #0066FF; font-size: 12px; padding: 4px;'
  );
  console.log('%c', 'font-size: 1px;');
}

// Initialize Arc branding on load
if (typeof window !== 'undefined') {
  logArcBranding();
  (window as any).arcIntegration = {
    isArcSupported,
    getArcChainInfo,
    canUseArcRoute,
    getArcTransferInfo,
    arcStats,
    ARC_SUPPORTED_CHAINS,
  };
}
