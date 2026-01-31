import React from 'react';
import { AgentMetadata } from '../types';

interface AgentDialogueProps {
  agent: AgentMetadata;
  dialogue: string;
  onClose: () => void;
  position?: { x: number; y: number };
}

export const AgentDialogue: React.FC<AgentDialogueProps> = ({ 
  agent, 
  dialogue, 
  onClose,
  position = { x: 50, y: 50 }
}) => {
  return (
    <div
      className="fixed z-[9999] animate-fade-in pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Speech bubble content */}
      <div className="relative bg-gray-800/95 border border-[#39ff14] rounded-lg p-2.5 shadow-lg max-w-[220px] animate-bounce-in" style={{ boxShadow: '0 0 15px rgba(57, 255, 20, 0.4)' }}>
        {/* Speech bubble arrow - pointing left to agent */}
        <div className="absolute left-0 top-1/2 transform -translate-x-full -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-r-[12px] border-t-transparent border-b-transparent border-r-gray-800" style={{ filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.3))' }}></div>
        <div className="absolute left-0 top-1/2 transform -translate-x-[11px] -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[10px] border-t-transparent border-b-transparent border-r-[#39ff14]"></div>
        
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                agent.status === 'idle' ? 'bg-gray-400' :
                agent.status === 'negotiating' ? 'bg-yellow-400' :
                agent.status === 'streaming' ? 'bg-[#39ff14]' :
                'bg-red-400'
              }`}></div>
              <span className="text-[#39ff14] font-bold text-xs truncate">{agent.name}</span>
            </div>
            <p className="text-white text-xs leading-relaxed">{dialogue}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#39ff14] transition-colors flex-shrink-0 ml-1"
            aria-label="Close dialogue"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
