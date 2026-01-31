import React from 'react';
import { Zap, Hand } from 'lucide-react';

interface CaptainControlPanelProps {
  mode: 'auto' | 'manual';
  onModeChange: (mode: 'auto' | 'manual') => void;
}

export const CaptainControlPanel: React.FC<CaptainControlPanelProps> = ({
  mode,
  onModeChange
}) => {
  return (
    <div className="bg-black/90 backdrop-blur-md border border-neon-green/30 rounded-lg shadow-lg shadow-neon-green/10 p-2">
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
    </div>
  );
};
