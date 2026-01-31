import React from 'react';
import { DollarSign, TrendingDown, Loader2 } from 'lucide-react';
import { useX402WithdrawableBalance } from '../hooks/useX402Deposit';
import { formatUnits } from 'viem';

interface StreamWithdrawCardProps {
  streamId: string;
  onWithdraw: (streamId: string) => void;
  isWithdrawing: boolean;
}

export const StreamWithdrawCard: React.FC<StreamWithdrawCardProps> = ({
  streamId,
  onWithdraw,
  isWithdrawing
}) => {
  const streamIdNumber = Number(streamId);
  const { owedAmount, streamData, isLoading } = useX402WithdrawableBalance(streamIdNumber);

  const formatBalance = (balance: bigint | undefined, decimals: number = 6) => {
    if (!balance || balance === 0n) return '0';
    const formatted = formatUnits(balance, decimals);
    return parseFloat(formatted).toFixed(6);
  };

  // Parse stream data - viem returns tuple as array-like object
  // Stream structure: [senderAgentId, receiverAgentId, asset, ratePerSecond, spendingCap, amountPaid, startTime, lastPushTime, closed]
  
  let senderAgentId = '?';
  let receiverAgentId = '?';
  let assetAddress = '';
  let ratePerSecond = 0n;
  let spendingCap = 0n;
  let amountPaid = 0n;
  let isClosed = true;

  if (streamData && typeof streamData === 'object') {
    // Try both array access and property access
    try {
      senderAgentId = (streamData[0] !== undefined ? streamData[0] : (streamData as any).senderAgentId)?.toString() || '?';
      receiverAgentId = (streamData[1] !== undefined ? streamData[1] : (streamData as any).receiverAgentId)?.toString() || '?';
      assetAddress = (streamData[2] !== undefined ? streamData[2] : (streamData as any).asset) || '';
      ratePerSecond = streamData[3] !== undefined ? BigInt(streamData[3]) : ((streamData as any).ratePerSecond ? BigInt((streamData as any).ratePerSecond) : 0n);
      spendingCap = streamData[4] !== undefined ? BigInt(streamData[4]) : ((streamData as any).spendingCap ? BigInt((streamData as any).spendingCap) : 0n);
      amountPaid = streamData[5] !== undefined ? BigInt(streamData[5]) : ((streamData as any).amountPaid ? BigInt((streamData as any).amountPaid) : 0n);
      isClosed = streamData[8] !== undefined ? Boolean(streamData[8]) : Boolean((streamData as any).closed);
    } catch (err) {
      console.error('Error parsing stream data:', err);
    }
  }
  
  const hasBalance = owedAmount && typeof owedAmount === 'bigint' && owedAmount > 0n;
  const asset = 'USDC'; // Contract only accepts USDC (ERC20)
  const isActive = !isClosed;

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin text-neon-green" size={20} />
          <span className="ml-2 text-sm text-gray-400 font-mono">Loading Stream Details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 transition-all ${
      hasBalance 
        ? 'bg-gradient-to-r from-neon-green/10 to-green-500/10 border-neon-green/50 hover:border-neon-green' 
        : 'bg-gray-800/50 border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-bold text-sm">Stream #{streamId}</span>
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
            isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {isActive ? '• Active' : '• Closed'}
          </span>
        </div>
        
        <div className="text-right">
          <p className={`text-lg font-bold font-mono ${
            hasBalance ? 'text-neon-green' : 'text-gray-500'
          }`}>
            {typeof owedAmount === 'bigint' ? formatBalance(owedAmount, 6) : '0'}
          </p>
          <p className="text-xs text-gray-400">USDC</p>
        </div>
      </div>

      {/* Stream Details */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-gray-500 mb-0.5">From → To</p>
          <p className="text-white font-mono">🦁 #{senderAgentId} → 🎯 #{receiverAgentId}</p>
        </div>
        
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-gray-500 mb-0.5">Streaming Rate</p>
          <p className="text-neon-green font-mono">{formatBalance(ratePerSecond, 6)}/sec</p>
        </div>
        
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-gray-500 mb-0.5">Total Budget</p>
          <p className="text-white font-mono">{formatBalance(spendingCap, 6)} USDC</p>
        </div>
        
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-gray-500 mb-0.5">Already Paid</p>
          <p className="text-purple-400 font-mono">{formatBalance(amountPaid, 6)} USDC</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onWithdraw(streamId)}
        disabled={isWithdrawing || !hasBalance}
        className={`w-full py-2 rounded font-mono text-sm font-bold transition-all flex items-center justify-center gap-2 ${
          hasBalance && !isWithdrawing
            ? 'bg-neon-green text-black hover:bg-neon-green/80'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isWithdrawing ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Withdrawing...
          </>
        ) : hasBalance ? (
          <>
            <TrendingDown size={16} />
            Withdraw {formatBalance(owedAmount, 6)} USDC
          </>
        ) : (
          <>
            <DollarSign size={16} />
            {isActive ? 'No Balance Yet' : 'Stream Closed'}
          </>
        )}
      </button>
    </div>
  );
};
