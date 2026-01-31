import React, { useState } from 'react';
import { Wallet, Plus, Minus, ChevronDown } from 'lucide-react';

interface CaptainFundPanelProps {
  currentBalance: number;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}

export const CaptainFundPanel: React.FC<CaptainFundPanelProps> = ({ 
  currentBalance, 
  onDeposit, 
  onWithdraw 
}) => {
  const [amount, setAmount] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleDeposit = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0 && numAmount <= 1) {
      onDeposit(numAmount);
      setAmount('');
    }
  };

  const handleWithdraw = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0 && numAmount <= currentBalance) {
      onWithdraw(numAmount);
      setAmount('');
    }
  };

  const isLowFund = currentBalance < 0.05;

  return (
    <div className="relative">
      {/* Compact Fund Display Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded border transition-all font-mono text-xs
          ${
            isLowFund
              ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
              : 'bg-black/40 border-white/20 text-white hover:border-[#39ff14]/50'
          }
        `}
      >
        <Wallet size={14} />
        <span className={`font-bold ${isLowFund ? 'text-red-400' : 'text-[#39ff14]'}`}>
          {currentBalance.toFixed(3)}
        </span>
        <span className="text-white/50">USD</span>
        <ChevronDown size={12} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl z-50">
          <div className="p-3">
            {/* Balance Header */}
            <div className="mb-3 pb-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/50 uppercase tracking-wider font-mono">Fund Balance</span>
              <span className={`text-lg font-bold font-mono ${
                currentBalance < 0.05 ? 'text-red-400' : 
                currentBalance < 0.2 ? 'text-yellow-400' : 
                'text-[#39ff14]'
              }`}>
                {currentBalance.toFixed(4)}
              </span>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[0.05, 0.1, 0.25, 0.5].map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => setAmount(quickAmount.toString())}
                  className="px-2 py-1 text-xs font-mono font-bold bg-white/5 border border-white/20 rounded hover:border-[#39ff14] hover:bg-[#39ff14]/10 transition-all text-white/70 hover:text-white"
                >
                  {quickAmount}
                </button>
              ))}
            </div>
            
            {/* Amount Input */}
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Custom amount"
              step="0.01"
              min="0.01"
              max="1"
              className="w-full bg-white/5 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 focus:border-[#39ff14] focus:outline-none mb-3 font-mono"
            />

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleDeposit}
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > 1}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#39ff14] text-black font-bold rounded text-xs hover:bg-[#2dd10d] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-all"
              >
                <Plus size={14} />
                DEPOSIT
              </button>
              <button
                onClick={handleWithdraw}
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > currentBalance}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500 font-bold rounded text-xs hover:bg-red-500/30 disabled:bg-white/10 disabled:text-white/30 disabled:border-white/20 disabled:cursor-not-allowed transition-all"
              >
                <Minus size={14} />
                WITHDRAW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
