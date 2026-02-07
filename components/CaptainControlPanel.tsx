import React from 'react';
import { RotateCcw } from 'lucide-react';

interface CaptainControlPanelProps {
  onReset?: () => void;
}

export const CaptainControlPanel: React.FC<CaptainControlPanelProps> = ({
  onReset
}) => {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-neon-green/30 rounded-lg shadow-[0_0_15px_rgba(67,255,77,0.1)] p-2">
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
