// Transaction History Component
// Display all transactions across wallets with filtering and stats

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  History,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Download,
  Trash2,
  Filter,
  TrendingUp,
  ArrowRightLeft,
  Wallet,
  RefreshCw,
  ChevronDown,
  DollarSign,
  Fuel,
  Activity,
} from 'lucide-react';
import {
  transactionHistory,
  Transaction,
  TransactionType,
  TransactionStats,
  getExplorerUrl,
} from '../services/transactionHistory';
import { multiWallet, WalletProfile } from '../services/multiWallet';

interface TransactionHistoryProps {
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const TYPE_LABELS: Record<TransactionType, string> = {
  yield_rotation: 'Yield Rotation',
  arbitrage: 'Arbitrage',
  bridge: 'Bridge',
  swap: 'Swap',
  approval: 'Approval',
  deposit: 'Deposit',
  withdraw: 'Withdraw',
};

const TYPE_COLORS: Record<TransactionType, string> = {
  yield_rotation: 'text-neon-green',
  arbitrage: 'text-cyan-400',
  bridge: 'text-purple-400',
  swap: 'text-yellow-400',
  approval: 'text-gray-400',
  deposit: 'text-green-400',
  withdraw: 'text-spice-orange',
};

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onLog }) => {
  const { address: connectedAddress } = useAccount();
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [wallets, setWallets] = useState<WalletProfile[]>([]);
  
  // Filters
  const [filterWallet, setFilterWallet] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Load data
  useEffect(() => {
    const loadData = () => {
      const allTx = transactionHistory.getAll();
      setTransactions(allTx);
      setStats(transactionHistory.getStats());
      setWallets(multiWallet.getAll());
    };

    loadData();

    // Subscribe to changes
    const unsubTx = transactionHistory.subscribe(() => {
      setTransactions(transactionHistory.getAll());
      setStats(transactionHistory.getStats());
    });

    const unsubWallet = multiWallet.subscribe(() => {
      setWallets(multiWallet.getAll());
    });

    return () => {
      unsubTx();
      unsubWallet();
    };
  }, []);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filterWallet !== 'all' && tx.walletAddress.toLowerCase() !== filterWallet.toLowerCase()) {
        return false;
      }
      if (filterType !== 'all' && tx.type !== filterType) {
        return false;
      }
      if (filterStatus !== 'all' && tx.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [transactions, filterWallet, filterType, filterStatus]);

  // Format helpers
  const formatUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const mins = Math.floor(diff / (60 * 1000));
      return `${mins}m ago`;
    }
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    }
    // Otherwise show date
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} className="text-green-400" />;
      case 'failed':
        return <XCircle size={14} className="text-red-400" />;
      case 'pending':
        return <Clock size={14} className="text-yellow-400" />;
      case 'confirming':
        return <Loader2 size={14} className="text-blue-400 animate-spin" />;
    }
  };

  const getWalletLabel = (address: string) => {
    const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    return wallet?.label || `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getWalletColor = (address: string) => {
    const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    return wallet?.color || '#00ff88';
  };

  // Export CSV
  const handleExport = () => {
    const csv = transactionHistory.exportToCsv(
      filterWallet !== 'all' ? filterWallet as `0x${string}` : undefined
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifi-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onLog?.('Exported transactions to CSV', 'success');
  };

  // Clear history
  const handleClear = () => {
    if (confirm('Clear all transaction history? This cannot be undone.')) {
      transactionHistory.clearAll();
      onLog?.('Transaction history cleared', 'info');
    }
  };

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <History className="text-yellow-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Transaction History</h3>
            <p className="text-gray-400 text-sm font-mono">
              {transactions.length} transactions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-white/10 text-gray-400'
            }`}
            title="Filters"
          >
            <Filter size={18} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Export CSV"
          >
            <Download size={18} className="text-gray-400" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Clear History"
          >
            <Trash2 size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && stats.totalTransactions > 0 && (
        <div className="px-4 py-3 bg-white/5 border-b border-white/10 grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{stats.successfulTransactions}</p>
            <p className="text-xs text-gray-400">Successful</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{formatUsd(stats.totalVolumeUsd)}</p>
            <p className="text-xs text-gray-400">Volume</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${stats.totalProfitUsd >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
              {formatUsd(stats.totalProfitUsd)}
            </p>
            <p className="text-xs text-gray-400">Profit</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-spice-orange">{formatUsd(stats.totalGasCostUsd)}</p>
            <p className="text-xs text-gray-400">Gas</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex gap-3">
          {/* Wallet Filter */}
          <select
            value={filterWallet}
            onChange={(e) => setFilterWallet(e.target.value)}
            className="bg-black/30 border border-white/20 rounded px-3 py-1.5 text-white text-sm flex-1"
          >
            <option value="all">All Wallets</option>
            {wallets.map(w => (
              <option key={w.address} value={w.address}>
                {w.label}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-black/30 border border-white/20 rounded px-3 py-1.5 text-white text-sm flex-1"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-black/30 border border-white/20 rounded px-3 py-1.5 text-white text-sm flex-1"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* Transaction List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="text-gray-500 mx-auto mb-3" size={32} />
            <p className="text-gray-400">No transactions yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Transactions will appear here after you execute trades
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(tx.status)}
                      <span className={`font-medium ${TYPE_COLORS[tx.type]}`}>
                        {TYPE_LABELS[tx.type]}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {formatTime(tx.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white">{tx.fromAmount} {tx.fromToken}</span>
                      <ArrowRightLeft size={12} className="text-gray-500" />
                      <span className="text-white">{tx.toToken}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{tx.fromChainName}</span>
                      {tx.fromChainId !== tx.toChainId && (
                        <>
                          <span>→</span>
                          <span>{tx.toChainName}</span>
                        </>
                      )}
                      {tx.protocol && (
                        <span className="text-gray-500">via {tx.protocol}</span>
                      )}
                    </div>

                    {/* Wallet badge */}
                    <div className="flex items-center gap-1 mt-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getWalletColor(tx.walletAddress) }}
                      />
                      <span className="text-xs text-gray-500">
                        {getWalletLabel(tx.walletAddress)}
                      </span>
                    </div>

                    {/* Error message */}
                    {tx.error && (
                      <p className="text-xs text-red-400 mt-1">{tx.error}</p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="text-right shrink-0">
                    <p className="text-white font-mono">
                      {formatUsd(tx.fromAmountUsd)}
                    </p>
                    
                    {tx.profitUsd !== undefined && tx.status === 'completed' && (
                      <p className={`text-sm font-medium ${tx.profitUsd >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                        {tx.profitUsd >= 0 ? '+' : ''}{formatUsd(tx.profitUsd)}
                      </p>
                    )}

                    {tx.gasCostUsd && (
                      <p className="text-xs text-spice-orange/70">
                        <Fuel size={10} className="inline mr-1" />
                        {formatUsd(tx.gasCostUsd)}
                      </p>
                    )}

                    {tx.txHash && (
                      <a
                        href={tx.explorerUrl || getExplorerUrl(tx.fromChainId, tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-neon-green mt-1"
                      >
                        View <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
