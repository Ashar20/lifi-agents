import React, { useState, useEffect, useCallback } from 'react';
import { Layers, TrendingUp } from 'lucide-react';
import { WalletConnect } from './WalletConnect';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useX402WithdrawableBalance } from '../hooks/useX402Deposit';

interface WalletBarProps {
  onLogoClick?: () => void;
}

// Component to track a single stream's accumulated balance (from withdraw modal data)
const StreamBalanceTracker: React.FC<{
  streamId: number;
  onBalanceUpdate: (id: number, balance: bigint, closed: boolean) => void;
}> = ({ streamId, onBalanceUpdate }) => {
  const { owedAmount, streamData } = useX402WithdrawableBalance(streamId);

  useEffect(() => {
    // Only process if owedAmount is defined and is a valid value
    if (owedAmount !== undefined && owedAmount !== null) {
      try {
        const balance = typeof owedAmount === 'bigint' ? owedAmount : BigInt(String(owedAmount));
        // Check if stream is closed (if streamData available)
        const isClosed = (streamData && Array.isArray(streamData) && streamData[8]) ? Boolean(streamData[8]) : false;
        onBalanceUpdate(streamId, balance, isClosed);
      } catch (error) {
        console.error(`[WalletBar] Error processing stream ${streamId}:`, error);
      }
    }
  }, [owedAmount, streamData, streamId, onBalanceUpdate]);

  return null;
};

const WalletBar: React.FC<WalletBarProps> = ({ onLogoClick }) => {
  const { isConnected } = useAccount();
  const [totalBalance, setTotalBalance] = useState('0.00');
  const [streamIds, setStreamIds] = useState<number[]>([]);
  const [streamBalances, setStreamBalances] = useState<Map<number, { balance: bigint, closed: boolean }>>(new Map());
  const [isUpdating, setIsUpdating] = useState(false);

  // Load stream IDs from localStorage
  useEffect(() => {
    const loadStreams = () => {
      const stored = localStorage.getItem('userStreams');
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Filter to only valid, reasonable stream IDs (< 1 million)
          const ids = Array.isArray(parsed) 
            ? parsed
                .map((id: string) => Number(id))
                .filter((id: number) => !isNaN(id) && id > 0 && id < 1000000 && Number.isFinite(id))
            : [];
          
          // Clean up localStorage if we found invalid IDs
          if (ids.length !== parsed.length) {
            localStorage.setItem('userStreams', JSON.stringify(ids.map(String)));
          }
          
          if (ids.length > 0) {
            setStreamIds(ids);
          }
        } catch (err) {
          console.error('[WalletBar] Error loading streams:', err);
        }
      }
    };

    loadStreams();
    const interval = setInterval(loadStreams, 3000);
    return () => clearInterval(interval);
  }, []);

  // Callback to update individual stream balances (memoized to prevent re-renders)
  const handleBalanceUpdate = useCallback((id: number, balance: bigint, closed: boolean) => {
    setStreamBalances(prev => {
      const newMap = new Map(prev);
      newMap.set(id, { balance, closed });
      return newMap;
    });
  }, []);

  // Calculate total accumulated balance from all streams (same as withdraw modal)
  useEffect(() => {
    let total = 0n;
    
    streamBalances.forEach(({ balance, closed }) => {
      if (!closed) {
        total += balance;
      }
    });

    const formatted = formatUnits(total, 6);
    const display = parseFloat(formatted).toFixed(6);
    const oldBalance = totalBalance;
    
    // Trigger blink effect when balance updates
    if (display !== oldBalance && parseFloat(display) > 0) {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 600);
    }
    
    setTotalBalance(display);
  }, [streamBalances, totalBalance]);
  return (
    <div className="h-12 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center px-6 justify-between z-50 sticky top-0">
        <div className="flex items-center gap-4">
            <h1 
              className={`text-neon-green font-bold font-mono tracking-wider flex items-center gap-2 ${onLogoClick ? 'cursor-pointer hover:text-neon-green/80 transition-colors' : ''}`}
              onClick={onLogoClick}
            >
                <Layers size={18} /> GALAXY AGENTS <span className="text-white/40 text-xs font-normal">v2.0.0</span>
            </h1>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
            {/* Invisible stream balance trackers */}
            {streamIds.map(id => (
              <StreamBalanceTracker key={id} streamId={id} onBalanceUpdate={handleBalanceUpdate} />
            ))}
            
            <div className={`flex items-center gap-2 px-3 py-1 rounded border transition-all duration-300 ${
              parseFloat(totalBalance) > 0
                ? isUpdating
                  ? 'bg-neon-green/30 border-neon-green/60 shadow-[0_0_20px_rgba(67,255,77,0.4)]'
                  : 'bg-neon-green/10 border-neon-green/30 shadow-[0_0_10px_rgba(67,255,77,0.2)]'
                : 'bg-gray-500/10 border-gray-500/30'
            }`}>
                <TrendingUp 
                  size={12} 
                  className={`transition-all duration-300 ${
                    parseFloat(totalBalance) > 0 
                      ? isUpdating 
                        ? 'text-neon-green scale-110' 
                        : 'text-neon-green' 
                      : 'text-gray-500'
                  }`} 
                />
                <span className={`transition-all duration-300 ${
                  parseFloat(totalBalance) > 0 ? 'text-neon-green/70' : 'text-gray-500/70'
                }`}>x402 STREAMING:</span>
                <span className={`font-bold transition-all duration-300 ${
                  parseFloat(totalBalance) > 0 
                    ? isUpdating 
                      ? 'text-neon-green scale-105' 
                      : 'text-neon-green' 
                    : 'text-gray-500'
                }`}>{totalBalance} USDC</span>
            </div>

            <WalletConnect />
        </div>
    </div>
  );
};

export default WalletBar;