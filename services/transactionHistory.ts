// Transaction History Service
// Tracks all transactions executed by LI.FI agents across all wallets

import { Address } from 'viem';

export type TransactionType = 
  | 'yield_rotation'
  | 'arbitrage'
  | 'bridge'
  | 'swap'
  | 'approval'
  | 'deposit'
  | 'withdraw';

export type TransactionStatus = 
  | 'pending'
  | 'confirming'
  | 'completed'
  | 'failed';

export interface Transaction {
  id: string;
  walletAddress: Address;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: number;
  
  // Chain info
  fromChainId: number;
  fromChainName: string;
  toChainId: number;
  toChainName: string;
  
  // Token info
  fromToken: string;
  fromAmount: string;
  fromAmountUsd: number;
  toToken: string;
  toAmount?: string;
  toAmountUsd?: number;
  
  // Transaction details
  txHash?: string;
  explorerUrl?: string;
  gasCostUsd?: number;
  
  // Profit/Loss (for arb/yield)
  profitUsd?: number;
  apyImprovement?: number;
  
  // Protocol info
  protocol?: string;
  route?: string; // e.g., "Uniswap → Stargate → SushiSwap"
  
  // Error info
  error?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

export interface TransactionStats {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolumeUsd: number;
  totalProfitUsd: number;
  totalGasCostUsd: number;
  netProfitUsd: number;
  byType: Record<TransactionType, number>;
  byChain: Record<number, number>;
  byWallet: Record<string, number>;
}

const STORAGE_KEY = 'lifi_transaction_history';
const MAX_TRANSACTIONS = 500;

class TransactionHistoryService {
  private transactions: Transaction[] = [];
  private listeners: ((transactions: Transaction[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.transactions = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[TxHistory] Failed to load:', error);
      this.transactions = [];
    }
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      // Keep only the latest MAX_TRANSACTIONS
      const toSave = this.transactions.slice(-MAX_TRANSACTIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('[TxHistory] Failed to save:', error);
    }
  }

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.transactions));
  }

  // Add a new transaction
  addTransaction(tx: Omit<Transaction, 'id' | 'timestamp'>): Transaction {
    const transaction: Transaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.transactions.push(transaction);
    this.saveToStorage();
    this.notifyListeners();

    console.log(`[TxHistory] Added: ${transaction.type} - ${transaction.id}`);
    return transaction;
  }

  // Update an existing transaction
  updateTransaction(id: string, updates: Partial<Transaction>): Transaction | null {
    const index = this.transactions.findIndex(tx => tx.id === id);
    if (index === -1) return null;

    this.transactions[index] = {
      ...this.transactions[index],
      ...updates,
    };

    this.saveToStorage();
    this.notifyListeners();

    console.log(`[TxHistory] Updated: ${id}`);
    return this.transactions[index];
  }

  // Get all transactions
  getAll(): Transaction[] {
    return [...this.transactions].reverse(); // Newest first
  }

  // Get transactions for a specific wallet
  getByWallet(walletAddress: Address): Transaction[] {
    return this.transactions
      .filter(tx => tx.walletAddress.toLowerCase() === walletAddress.toLowerCase())
      .reverse();
  }

  // Get transactions by type
  getByType(type: TransactionType): Transaction[] {
    return this.transactions
      .filter(tx => tx.type === type)
      .reverse();
  }

  // Get transactions by chain
  getByChain(chainId: number): Transaction[] {
    return this.transactions
      .filter(tx => tx.fromChainId === chainId || tx.toChainId === chainId)
      .reverse();
  }

  // Get recent transactions
  getRecent(count: number = 10): Transaction[] {
    return this.transactions.slice(-count).reverse();
  }

  // Get pending transactions
  getPending(): Transaction[] {
    return this.transactions
      .filter(tx => tx.status === 'pending' || tx.status === 'confirming')
      .reverse();
  }

  // Get transaction by ID
  getById(id: string): Transaction | null {
    return this.transactions.find(tx => tx.id === id) || null;
  }

  // Get transaction by hash
  getByHash(txHash: string): Transaction | null {
    return this.transactions.find(tx => tx.txHash === txHash) || null;
  }

  // Calculate stats
  getStats(walletAddress?: Address): TransactionStats {
    let txs = this.transactions;
    
    if (walletAddress) {
      txs = txs.filter(tx => 
        tx.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
    }

    const stats: TransactionStats = {
      totalTransactions: txs.length,
      successfulTransactions: txs.filter(tx => tx.status === 'completed').length,
      failedTransactions: txs.filter(tx => tx.status === 'failed').length,
      totalVolumeUsd: 0,
      totalProfitUsd: 0,
      totalGasCostUsd: 0,
      netProfitUsd: 0,
      byType: {} as Record<TransactionType, number>,
      byChain: {},
      byWallet: {},
    };

    for (const tx of txs) {
      // Volume
      stats.totalVolumeUsd += tx.fromAmountUsd || 0;
      
      // Profit (only for completed)
      if (tx.status === 'completed' && tx.profitUsd) {
        stats.totalProfitUsd += tx.profitUsd;
      }
      
      // Gas
      stats.totalGasCostUsd += tx.gasCostUsd || 0;
      
      // By type
      stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1;
      
      // By chain
      stats.byChain[tx.fromChainId] = (stats.byChain[tx.fromChainId] || 0) + 1;
      if (tx.toChainId !== tx.fromChainId) {
        stats.byChain[tx.toChainId] = (stats.byChain[tx.toChainId] || 0) + 1;
      }
      
      // By wallet
      const wallet = tx.walletAddress.toLowerCase();
      stats.byWallet[wallet] = (stats.byWallet[wallet] || 0) + 1;
    }

    stats.netProfitUsd = stats.totalProfitUsd - stats.totalGasCostUsd;

    return stats;
  }

  // Clear all transactions
  clearAll(): void {
    this.transactions = [];
    this.saveToStorage();
    this.notifyListeners();
    console.log('[TxHistory] Cleared all transactions');
  }

  // Clear transactions for a specific wallet
  clearByWallet(walletAddress: Address): void {
    this.transactions = this.transactions.filter(
      tx => tx.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );
    this.saveToStorage();
    this.notifyListeners();
  }

  // Subscribe to changes
  subscribe(listener: (transactions: Transaction[]) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Export to CSV
  exportToCsv(walletAddress?: Address): string {
    let txs = walletAddress ? this.getByWallet(walletAddress) : this.getAll();
    
    const headers = [
      'ID', 'Date', 'Wallet', 'Type', 'Status',
      'From Chain', 'To Chain', 'From Token', 'To Token',
      'From Amount', 'To Amount', 'Profit USD', 'Gas USD',
      'TX Hash', 'Protocol', 'Error'
    ];

    const rows = txs.map(tx => [
      tx.id,
      new Date(tx.timestamp).toISOString(),
      tx.walletAddress,
      tx.type,
      tx.status,
      tx.fromChainName,
      tx.toChainName,
      tx.fromToken,
      tx.toToken || '',
      tx.fromAmount,
      tx.toAmount || '',
      tx.profitUsd?.toFixed(2) || '',
      tx.gasCostUsd?.toFixed(2) || '',
      tx.txHash || '',
      tx.protocol || '',
      tx.error || ''
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// Singleton instance
export const transactionHistory = new TransactionHistoryService();

// Helper to get explorer URL
export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    137: 'https://polygonscan.com/tx/',
    8453: 'https://basescan.org/tx/',
    43114: 'https://snowtrace.io/tx/',
    11155111: 'https://sepolia.etherscan.io/tx/',
    421614: 'https://sepolia.arbiscan.io/tx/',
    11155420: 'https://sepolia-optimism.etherscan.io/tx/',
    84532: 'https://sepolia.basescan.org/tx/',
  };
  return (explorers[chainId] || 'https://etherscan.io/tx/') + txHash;
}

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).transactionHistory = transactionHistory;
  console.log('%c📜 TRANSACTION HISTORY', 'color: #ffd700; font-weight: bold; font-size: 14px;');
  console.log('  transactionHistory.getAll() - Get all transactions');
  console.log('  transactionHistory.getStats() - Get statistics');
  console.log('  transactionHistory.exportToCsv() - Export to CSV');
}
