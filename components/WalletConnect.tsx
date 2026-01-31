// Wallet Connection Component
import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink } from 'lucide-react';
import { chainInfo, supportedChains } from '../config/wagmi';
import { formatUnits } from 'viem';

export const WalletConnect: React.FC = () => {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const currentChain = chainInfo[chainId] || { name: 'Unknown', color: '#888', icon: '?' };

  // Not connected - show connect buttons
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 bg-neon-green hover:bg-neon-green/80 text-black font-bold px-4 py-2 rounded-lg transition-all"
        >
          <Wallet size={18} />
          Connect Wallet
          <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-black border border-neon-green/30 rounded-lg shadow-2xl overflow-hidden" style={{ zIndex: 9999 }}>
            <div className="p-3 border-b border-white/10 bg-neon-green/5">
              <p className="text-xs text-neon-green font-mono uppercase">Select Wallet</p>
            </div>
            <div className="p-2">
              {connectors.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => {
                    connect({ connector: conn });
                    setShowDropdown(false);
                  }}
                  disabled={isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-neon-green/20 rounded-full flex items-center justify-center">
                    <Wallet size={16} className="text-neon-green" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{conn.name}</p>
                    <p className="text-gray-500 text-xs">
                      {conn.id === 'injected' ? 'Browser Wallet' : 'Connect'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Connected - show wallet info
  return (
    <div className="flex items-center gap-2">
      {/* Chain Selector */}
      <div className="relative">
        <button
          onClick={() => setShowChainSelector(!showChainSelector)}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 px-3 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg">{currentChain.icon}</span>
          <span className="text-white text-sm font-medium hidden sm:block">{currentChain.name}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${showChainSelector ? 'rotate-180' : ''}`} />
        </button>

        {showChainSelector && (
          <div className="absolute right-0 mt-2 w-48 bg-black/95 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-white/10">
              <p className="text-xs text-gray-400 font-mono uppercase px-2">Switch Chain</p>
            </div>
            <div className="p-1 max-h-64 overflow-y-auto">
              {supportedChains.map((chain) => {
                const info = chainInfo[chain.id];
                const isActive = chain.id === chainId;
                return (
                  <button
                    key={chain.id}
                    onClick={() => {
                      switchChain({ chainId: chain.id });
                      setShowChainSelector(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isActive ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-white/10 text-white'
                    }`}
                  >
                    <span className="text-lg">{info?.icon}</span>
                    <span className="text-sm font-medium">{info?.name || chain.name}</span>
                    {isActive && <Check size={14} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Wallet Info */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 px-3 py-2 rounded-lg transition-colors"
        >
          <div className="w-6 h-6 bg-neon-green/30 rounded-full flex items-center justify-center">
            <Wallet size={14} className="text-neon-green" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-white text-sm font-mono">{formatAddress(address!)}</p>
            {balance && (
              <p className="text-gray-400 text-xs">
                {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} {balance.symbol}
              </p>
            )}
          </div>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-black/95 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <p className="text-xs text-gray-400 mb-1">Connected with {connector?.name}</p>
              <p className="text-white font-mono text-sm">{formatAddress(address!)}</p>
              {balance && (
                <p className="text-neon-green font-mono text-lg mt-1">
                  {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} {balance.symbol}
                </p>
              )}
            </div>
            
            <div className="p-2">
              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                {copied ? <Check size={16} className="text-neon-green" /> : <Copy size={16} className="text-gray-400" />}
                <span className="text-white text-sm">{copied ? 'Copied!' : 'Copy Address'}</span>
              </button>
              
              <a
                href={`https://etherscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <ExternalLink size={16} className="text-gray-400" />
                <span className="text-white text-sm">View on Explorer</span>
              </a>
              
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 rounded-lg transition-colors text-left text-red-400"
              >
                <LogOut size={16} />
                <span className="text-sm">Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletConnect;
