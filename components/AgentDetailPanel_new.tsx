import React from 'react';
import { AgentMetadata } from '../types';
import { X, Play, Square, Zap } from 'lucide-react';
import { AGENT_ABILITIES } from '../constants';
import LottieAvatar from './LottieAvatar';

interface AgentDetailPanelProps {
  agent: AgentMetadata | null;
  onClose: () => void;
  onActivate?: (agentId: string) => void;
  onDeactivate?: (agentId: string) => void;
  onExecuteTask?: (agentId: string, task?: string) => void;
  isActive?: boolean;
}

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({ 
  agent, 
  onClose, 
  onActivate,
  onDeactivate,
  onExecuteTask,
  isActive = false
}) => {
  
  if (!agent) return null;

  return (
    <div className="absolute right-0 top-10 bottom-0 w-96 bg-black/95 border-l border-neon-green/30 backdrop-blur-xl shadow-2xl z-[60] transform transition-transform duration-300 flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neon-green/5">
        <h2 className="text-neon-green font-bold font-mono">AGENT DETAILS</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Avatar Header */}
        <div className="flex flex-col items-center mb-6">
           <div className="w-32 h-32 border border-white/20 rounded-lg p-2 bg-black relative overflow-hidden group">
             <div className="absolute inset-0 bg-neon-green/20 blur-xl opacity-50"></div>
             {agent.avatarType === 'lottie' ? (
               <LottieAvatar 
                 animationPath={agent.avatar}
                 width={112}
                 height={112}
                 className="relative z-10 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]"
               />
             ) : (
               <img 
                  src={agent.avatar} 
                  className="w-full h-full object-contain relative z-10 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]"
                  style={{ imageRendering: 'pixelated' }}
                  alt={agent.name}
               />
             )}
             <div className="absolute bottom-0 left-0 right-0 bg-neon-green/20 h-1/3 blur-xl"></div>
           </div>
           <h1 className="text-2xl font-bold text-white mt-4 font-mono">{agent.name}</h1>
           <span className="text-neon-green text-sm font-mono tracking-wider">{agent.role}</span>
        </div>

        {/* Identity Data */}
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase">Description</label>
                <p className="text-sm text-gray-300 leading-relaxed">{agent.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded border border-white/10">
                    <label className="text-[10px] text-gray-500 font-mono uppercase block mb-1">Agent ID</label>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-mono text-white">#{agent.tokenId}</span>
                    </div>
                </div>
                <div className="bg-white/5 p-3 rounded border border-white/10">
                    <label className="text-[10px] text-gray-500 font-mono uppercase block mb-1">Trust Score</label>
                    <span className="text-lg font-mono text-neon-green">{agent.trustScore}/100</span>
                </div>
            </div>

            {/* Agent Status */}
            <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase">Agent Status</label>
                <div className="bg-black p-3 rounded border border-white/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <span className="text-sm font-mono text-gray-300">
                      {isActive ? 'Online & Ready' : 'Offline'}
                    </span>
                  </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                {isActive ? (
                  <>
                    <button
                      onClick={() => onExecuteTask?.(agent.id)}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold py-3 px-4 rounded transition-all flex items-center justify-center gap-2"
                    >
                      <Play size={16} />
                      Execute Task
                    </button>
                    <button
                      onClick={() => onDeactivate?.(agent.id)}
                      className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-2 px-4 rounded transition-all flex items-center justify-center gap-2"
                    >
                      <Square size={16} />
                      Deactivate Agent
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onActivate?.(agent.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-4 rounded transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={16} />
                    Activate Agent
                  </button>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase">Capabilities</label>
                <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map(cap => (
                        <span key={cap} className="px-2 py-1 bg-white/5 border border-white/20 rounded text-xs text-gray-300 hover:border-neon-green/50 transition-colors cursor-help">
                            {cap}
                        </span>
                    ))}
                </div>
            </div>

            {/* API Integrations */}
            {AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES]?.apis && AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES].apis.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase flex items-center gap-2">
                  <Zap size={12} className="text-neon-green" />
                  API Integrations
                </label>
                <div className="flex flex-wrap gap-2">
                  {AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES].apis.map((api: string) => (
                    <span 
                      key={api} 
                      className="px-2 py-1 bg-neon-green/10 border border-neon-green/30 rounded text-xs text-neon-green font-mono hover:bg-neon-green/20 transition-colors cursor-help"
                      title={AGENT_ABILITIES[agent.id as keyof typeof AGENT_ABILITIES].apiEndpoints?.[api] || api}
                    >
                      ⚡ {api}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AgentDetailPanel;
