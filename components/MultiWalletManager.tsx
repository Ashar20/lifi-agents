// Multi-Wallet Manager Component
// Add, manage, and switch between multiple wallets

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { Address, isAddress } from 'viem';
import {
  Wallet,
  Plus,
  Eye,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  Copy,
  CheckCircle,
  Star,
  StarOff,
  RefreshCw,
  DollarSign,
} from 'lucide-react';
import { multiWallet, WalletProfile, MultiWalletState } from '../services/multiWallet';
import { transactionHistory } from '../services/transactionHistory';

interface MultiWalletManagerProps {
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const MultiWalletManager: React.FC<MultiWalletManagerProps> = ({ onLog }) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  // State
  const [walletState, setWalletState] = useState<MultiWalletState | null>(null);
  const [newWatchAddress, setNewWatchAddress] = useState('');
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isAddingWatch, setIsAddingWatch] = useState(false);

  // Load wallet state
  useEffect(() => {
    setWalletState(multiWallet.getState());

    const unsubscribe = multiWallet.subscribe((state) => {
      setWalletState(state);
    });

    return unsubscribe;
  }, []);

  // Auto-add connected wallet
  useEffect(() => {
    if (isConnected && connectedAddress) {
      multiWallet.addConnectedWallet(connectedAddress);
    }
  }, [isConnected, connectedAddress]);

  // Handle disconnect
  useEffect(() => {
    if (!isConnected && connectedAddress) {
      // Mark as disconnected when wallet disconnects
      multiWallet.disconnectWallet(connectedAddress);
    }
  }, [isConnected]);

  // Add watch wallet
  const handleAddWatch = useCallback(() => {
    if (!newWatchAddress) return;

    if (!isAddress(newWatchAddress)) {
      onLog?.('Invalid Ethereum address', 'error');
      return;
    }

    const existing = walletState?.wallets.find(
      w => w.address.toLowerCase() === newWatchAddress.toLowerCase()
    );

    if (existing) {
      onLog?.('Wallet already added', 'error');
      return;
    }

    multiWallet.addWatchWallet(newWatchAddress as Address);
    setNewWatchAddress('');
    setIsAddingWatch(false);
    onLog?.('Watch wallet added', 'success');
  }, [newWatchAddress, walletState, onLog]);

  // Remove wallet
  const handleRemove = useCallback((address: Address) => {
    if (confirm('Remove this wallet? Transaction history will be preserved.')) {
      multiWallet.removeWallet(address);
      onLog?.('Wallet removed', 'info');
    }
  }, [onLog]);

  // Start editing label
  const startEdit = (wallet: WalletProfile) => {
    setEditingWallet(wallet.address);
    setEditLabel(wallet.label);
  };

  // Save label
  const saveLabel = (address: Address) => {
    if (editLabel.trim()) {
      multiWallet.updateLabel(address, editLabel.trim());
    }
    setEditingWallet(null);
    setEditLabel('');
  };

  // Copy address
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Format helpers
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getExplorerUrl = (address: string) => {
    return `https://etherscan.io/address/${address}`;
  };

  // Get transaction count for wallet
  const getTxCount = (address: string) => {
    return transactionHistory.getByWallet(address as Address).length;
  };

  if (!walletState) return null;

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <Wallet className="text-purple-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Multi-Wallet</h3>
            <p className="text-gray-400 text-sm font-mono">
              {walletState.wallets.length} wallet{walletState.wallets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddingWatch(!isAddingWatch)}
          className={`p-2 rounded-lg transition-colors ${
            isAddingWatch ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-gray-400'
          }`}
          title="Add Watch Wallet"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Add Watch Wallet */}
      {isAddingWatch && (
        <div className="px-4 py-3 bg-white/5 border-b border-white/10">
          <p className="text-xs text-gray-400 mb-2 font-mono uppercase">Add Watch-Only Wallet</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newWatchAddress}
              onChange={(e) => setNewWatchAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm font-mono"
            />
            <button
              onClick={handleAddWatch}
              disabled={!newWatchAddress}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-500/80 disabled:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Watch-only wallets let you monitor any address without connecting it.
          </p>
        </div>
      )}

      {/* Wallet List */}
      <div className="max-h-96 overflow-y-auto">
        {walletState.wallets.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet className="text-gray-500 mx-auto mb-3" size={32} />
            <p className="text-gray-400">No wallets added</p>
            <p className="text-gray-500 text-sm mt-1">
              Connect a wallet or add a watch address
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {walletState.wallets.map((wallet) => {
              const isActive = walletState.activeWallet?.toLowerCase() === wallet.address.toLowerCase();
              const isCurrentlyConnected = connectedAddress?.toLowerCase() === wallet.address.toLowerCase();
              const txCount = getTxCount(wallet.address);

              return (
                <div
                  key={wallet.address}
                  className={`p-4 transition-colors ${
                    isActive ? 'bg-white/5' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Color indicator */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: wallet.color + '20' }}
                    >
                      {wallet.isWatching && !wallet.isConnected ? (
                        <Eye size={18} style={{ color: wallet.color }} />
                      ) : (
                        <Wallet size={18} style={{ color: wallet.color }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Label */}
                      {editingWallet === wallet.address ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="bg-black/30 border border-white/20 rounded px-2 py-1 text-white text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLabel(wallet.address);
                              if (e.key === 'Escape') setEditingWallet(null);
                            }}
                          />
                          <button
                            onClick={() => saveLabel(wallet.address)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <Check size={14} className="text-green-400" />
                          </button>
                          <button
                            onClick={() => setEditingWallet(null)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <X size={14} className="text-red-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{wallet.label}</span>
                          <button
                            onClick={() => startEdit(wallet)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded"
                          >
                            <Edit2 size={12} className="text-gray-400" />
                          </button>
                          {isActive && (
                            <span className="px-2 py-0.5 bg-neon-green/20 text-neon-green text-xs rounded font-mono">
                              ACTIVE
                            </span>
                          )}
                          {wallet.isWatching && !wallet.isConnected && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded font-mono">
                              WATCH
                            </span>
                          )}
                        </div>
                      )}

                      {/* Address */}
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-gray-400 text-sm">
                          {formatAddress(wallet.address)}
                        </code>
                        <button
                          onClick={() => copyAddress(wallet.address)}
                          className="p-1 hover:bg-white/10 rounded"
                          title="Copy address"
                        >
                          {copiedAddress === wallet.address ? (
                            <CheckCircle size={12} className="text-green-400" />
                          ) : (
                            <Copy size={12} className="text-gray-500" />
                          )}
                        </button>
                        <a
                          href={getExplorerUrl(wallet.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-white/10 rounded"
                          title="View on Etherscan"
                        >
                          <ExternalLink size={12} className="text-gray-500" />
                        </a>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {wallet.totalValueUsd !== undefined && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={10} />
                            {formatUsd(wallet.totalValueUsd)}
                          </span>
                        )}
                        <span>{txCount} transactions</span>
                        {wallet.chainCount && (
                          <span>{wallet.chainCount} chains</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => multiWallet.setActiveWallet(wallet.address)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Set as active"
                        >
                          <StarOff size={16} className="text-gray-400" />
                        </button>
                      )}
                      {isActive && (
                        <button
                          className="p-2 text-yellow-400"
                          title="Active wallet"
                        >
                          <Star size={16} fill="currentColor" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(wallet.address)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove wallet"
                      >
                        <Trash2 size={16} className="text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Connect New */}
      {!isConnected && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <button
            onClick={() => {
              const injected = connectors.find(c => c.id === 'injected');
              if (injected) connect({ connector: injected });
            }}
            className="w-full bg-neon-green hover:bg-neon-green/80 text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Wallet size={18} />
            Connect Wallet
          </button>
        </div>
      )}

      {/* Connected wallet indicator */}
      {isConnected && connectedAddress && (
        <div className="px-4 py-3 border-t border-white/10 bg-neon-green/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
            <span className="text-neon-green text-sm font-mono">
              Connected: {formatAddress(connectedAddress)}
            </span>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiWalletManager;
