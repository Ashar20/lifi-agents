import React from 'react';
import { Zap, Hand, RotateCcw } from 'lucide-react';

interface CaptainControlPanelProps {
  mode: 'auto' | 'manual';
  onModeChange: (mode: 'auto' | 'manual') => void;
  onReset?: () => void;
}

export const CaptainControlPanel: React.FC<CaptainControlPanelProps> = ({
  mode,
  onModeChange,
  onReset
}) => {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-neon-green/30 rounded-lg shadow-[0_0_15px_rgba(67,255,77,0.1)] p-2 space-y-2">
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-black/50 rounded-lg p-0.5 border border-white/10">
        <button
          onClick={() => onModeChange('manual')}
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold font-mono transition-all flex-1 justify-center
            ${mode === 'manual'
              ? 'bg-neon-green text-black shadow-sm'
              : 'text-white/50 hover:text-white/80'
            }
          `}
          title="Manual Control - Direct agent command"
        >
          <Hand size={14} />
          MANUAL
        </button>
        <button
          onClick={() => onModeChange('auto')}
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold font-mono transition-all flex-1 justify-center
            ${mode === 'auto'
              ? 'bg-neon-green text-black shadow-sm'
              : 'text-white/50 hover:text-white/80'
            }
          `}
          title="Auto Mode - Route Strategist orchestrates team"
        >
          <Zap size={14} />
          AUTO
        </button>
      </div>
      {/* Workflow Reset */}
      {onReset && (
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-mono transition-all bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400"
          title="Reset workflow - deactivate all agents, clear connections and tasks"
        >
          <RotateCcw size={14} />
          RESET
        </button>
      )}
    </div>
  );
};
