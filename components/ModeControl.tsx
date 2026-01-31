import React, { useState } from 'react';
import { Zap, Hand, DollarSign } from 'lucide-react';

interface ModeControlProps {
  mode: 'auto' | 'manual';
  budget: number;
  onModeChange: (mode: 'auto' | 'manual') => void;
  onBudgetChange: (budget: number) => void;
}

export const ModeControl: React.FC<ModeControlProps> = ({ 
  mode, 
  budget, 
  onModeChange, 
  onBudgetChange 
}) => {
  const [budgetInput, setBudgetInput] = useState(budget.toString());

  const handleBudgetSubmit = () => {
    const value = parseFloat(budgetInput);
    if (!isNaN(value) && value >= 0) {
      onBudgetChange(value);
    }
  };

  return (
    <div className="bg-black/80 backdrop-blur border border-[#39ff14]/30 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#39ff14] font-bold font-mono text-sm flex items-center gap-2">
          <Zap size={16} />
          OPERATION MODE
        </h3>
        <div className="flex items-center gap-2 bg-black/50 rounded-lg p-1">
          <button
            onClick={() => onModeChange('manual')}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs transition-all
              ${mode === 'manual' 
                ? 'bg-[#39ff14] text-black font-bold' 
                : 'text-white/50 hover:text-white/80'
              }
            `}
          >
            <Hand size={14} />
            MANUAL
          </button>
          <button
            onClick={() => onModeChange('auto')}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs transition-all
              ${mode === 'auto' 
                ? 'bg-[#39ff14] text-black font-bold' 
                : 'text-white/50 hover:text-white/80'
              }
            `}
          >
            <Zap size={14} />
            AUTO
          </button>
        </div>
      </div>

      {mode === 'auto' && (
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-[#39ff14]" />
            <span className="text-white/70 font-mono text-xs">COMMANDER BUDGET (USDC)</span>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={handleBudgetSubmit}
              onKeyPress={(e) => e.key === 'Enter' && handleBudgetSubmit()}
              min="0"
              step="0.01"
              className="flex-1 bg-black/50 border border-[#39ff14]/30 rounded px-3 py-2 text-[#39ff14] font-mono text-sm focus:outline-none focus:border-[#39ff14] transition-colors"
              placeholder="Enter budget amount"
            />
            <button
              onClick={handleBudgetSubmit}
              className="px-4 py-2 bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/30 rounded text-[#39ff14] font-mono text-xs font-bold transition-colors"
            >
              SET
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white/50">Current Budget:</span>
            <span className="text-[#39ff14] font-bold">{budget.toFixed(2)} USDC</span>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-yellow-500/80 text-xs font-mono">
            ⚡ Auto mode: Commander will activate agents and execute x402 streams within budget limit
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="border-t border-white/10 pt-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 text-blue-500/80 text-xs font-mono">
            ✋ Manual mode: Click agents to activate. Full control over operations.
          </div>
        </div>
      )}
    </div>
  );
};
