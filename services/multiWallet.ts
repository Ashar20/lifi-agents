// Multi-Wallet Management Service
// Track and manage multiple wallet addresses for monitoring

import { Address } from 'viem';

export interface WalletProfile {
  address: Address;
  label: string;
  addedAt: number;
  lastActive: number;
  isConnected: boolean;  // True if this is the currently connected wallet
  isWatching: boolean;   // True if watching-only (not connected)
  color: string;         // For UI distinction
  
  // Cached stats
  totalValueUsd?: number;
  chainCount?: number;
  tokenCount?: number;
}

export interface MultiWalletState {
  activeWallet: Address | null;
  wallets: WalletProfile[];
  watchlist: Address[];  // Wallets being watched but not owned
}

const STORAGE_KEY = 'lifi_multi_wallet';
const COLORS = [
  '#00ff88', // neon green
  '#00d4ff', // cyan
  '#ff6b6b', // coral
  '#ffd93d', // yellow
  '#c9b1ff', // lavender
  '#ff9f43', // orange
  '#54a0ff', // blue
  '#ff6b81', // pink
];

class MultiWalletService {
  private state: MultiWalletState;
  private listeners: ((state: MultiWalletState) => void)[] = [];

  constructor() {
    this.state = this.loadFromStorage();
  }

  // Load from localStorage
  private loadFromStorage(): MultiWalletState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[MultiWallet] Failed to load:', error);
    }
    return {
      activeWallet: null,
      wallets: [],
      watchlist: [],
    };
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('[MultiWallet] Failed to save:', error);
    }
  }

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Get next color for new wallet
  private getNextColor(): string {
    const usedColors = this.state.wallets.map(w => w.color);
    const available = COLORS.filter(c => !usedColors.includes(c));
    return available.length > 0 ? available[0] : COLORS[this.state.wallets.length % COLORS.length];
  }

  // Add a connected wallet
  addConnectedWallet(address: Address, label?: string): WalletProfile {
    const existing = this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    );

    if (existing) {
      // Update existing wallet
      existing.isConnected = true;
      existing.lastActive = Date.now();
      this.state.activeWallet = address;
      this.saveToStorage();
      this.notifyListeners();
      return existing;
    }

    // Add new wallet
    const wallet: WalletProfile = {
      address: address as Address,
      label: label || `Wallet ${this.state.wallets.length + 1}`,
      addedAt: Date.now(),
      lastActive: Date.now(),
      isConnected: true,
      isWatching: false,
      color: this.getNextColor(),
    };

    this.state.wallets.push(wallet);
    this.state.activeWallet = address;
    
    // Remove from watchlist if it was there
    this.state.watchlist = this.state.watchlist.filter(
      w => w.toLowerCase() !== address.toLowerCase()
    );

    this.saveToStorage();
    this.notifyListeners();

    console.log(`[MultiWallet] Added connected wallet: ${address.slice(0, 8)}...`);
    return wallet;
  }

  // Add a watch-only wallet
  addWatchWallet(address: Address, label?: string): WalletProfile {
    const existing = this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    const wallet: WalletProfile = {
      address: address as Address,
      label: label || `Watch ${this.state.watchlist.length + 1}`,
      addedAt: Date.now(),
      lastActive: Date.now(),
      isConnected: false,
      isWatching: true,
      color: this.getNextColor(),
    };

    this.state.wallets.push(wallet);
    this.state.watchlist.push(address);

    this.saveToStorage();
    this.notifyListeners();

    console.log(`[MultiWallet] Added watch wallet: ${address.slice(0, 8)}...`);
    return wallet;
  }

  // Remove a wallet
  removeWallet(address: Address): void {
    this.state.wallets = this.state.wallets.filter(
      w => w.address.toLowerCase() !== address.toLowerCase()
    );
    this.state.watchlist = this.state.watchlist.filter(
      w => w.toLowerCase() !== address.toLowerCase()
    );

    if (this.state.activeWallet?.toLowerCase() === address.toLowerCase()) {
      this.state.activeWallet = this.state.wallets[0]?.address || null;
    }

    this.saveToStorage();
    this.notifyListeners();

    console.log(`[MultiWallet] Removed wallet: ${address.slice(0, 8)}...`);
  }

  // Set active wallet
  setActiveWallet(address: Address): void {
    const wallet = this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    );

    if (wallet) {
      this.state.activeWallet = address;
      wallet.lastActive = Date.now();
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Update wallet label
  updateLabel(address: Address, label: string): void {
    const wallet = this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    );

    if (wallet) {
      wallet.label = label;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Update wallet stats
  updateStats(address: Address, stats: Partial<Pick<WalletProfile, 'totalValueUsd' | 'chainCount' | 'tokenCount'>>): void {
    const wallet = this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    );

    if (wallet) {
      Object.assign(wallet, stats);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Mark wallet as disconnected
  disconnectWallet(address: Address): void {
    const wallet = this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    );

    if (wallet) {
      wallet.isConnected = false;
      if (!wallet.isWatching) {
        // Convert to watch-only
        wallet.isWatching = true;
        this.state.watchlist.push(address);
      }
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Get all wallets
  getAll(): WalletProfile[] {
    return [...this.state.wallets];
  }

  // Get connected wallets only
  getConnected(): WalletProfile[] {
    return this.state.wallets.filter(w => w.isConnected);
  }

  // Get watch-only wallets
  getWatching(): WalletProfile[] {
    return this.state.wallets.filter(w => w.isWatching && !w.isConnected);
  }

  // Get active wallet
  getActiveWallet(): WalletProfile | null {
    if (!this.state.activeWallet) return null;
    return this.state.wallets.find(
      w => w.address.toLowerCase() === this.state.activeWallet?.toLowerCase()
    ) || null;
  }

  // Get wallet by address
  getByAddress(address: Address): WalletProfile | null {
    return this.state.wallets.find(
      w => w.address.toLowerCase() === address.toLowerCase()
    ) || null;
  }

  // Get state
  getState(): MultiWalletState {
    return { ...this.state };
  }

  // Get all addresses (for multi-wallet operations)
  getAllAddresses(): Address[] {
    return this.state.wallets.map(w => w.address);
  }

  // Subscribe to changes
  subscribe(listener: (state: MultiWalletState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Clear all wallets
  clearAll(): void {
    this.state = {
      activeWallet: null,
      wallets: [],
      watchlist: [],
    };
    this.saveToStorage();
    this.notifyListeners();
  }
}

// Singleton instance
export const multiWallet = new MultiWalletService();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).multiWallet = multiWallet;
  console.log('%c👛 MULTI-WALLET SERVICE', 'color: #c9b1ff; font-weight: bold; font-size: 14px;');
  console.log('  multiWallet.getAll() - Get all wallets');
  console.log('  multiWallet.addWatchWallet(address) - Add watch-only wallet');
  console.log('  multiWallet.getState() - Get full state');
}
