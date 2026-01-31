import React from 'react';
import { Loader2 } from 'lucide-react';

interface AgentProgressBarProps {
  progress: number; // 0-100
  task: string;
  agentName: string;
}

export const AgentProgressBar: React.FC<AgentProgressBarProps> = ({ 
  progress, 
  task, 
  agentName 
}) => {
  return (
    <div className="bg-black/80 backdrop-blur-sm border border-neon-green/50 rounded-lg p-3 shadow-[0_0_15px_rgba(67,255,77,0.2)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-neon-green animate-spin" />
          <span className="text-sm font-mono text-neon-green font-bold">{agentName}</span>
        </div>
        <span className="text-xs font-mono text-gray-400">{progress}%</span>
      </div>
      
      <div className="text-xs text-gray-400 mb-2 truncate">{task}</div>
      
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-neon-green to-green-400 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="w-full h-full bg-white/20 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};
