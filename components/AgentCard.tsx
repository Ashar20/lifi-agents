import React, { useState, useEffect } from 'react';
import { AgentMetadata } from '../types';
import { Activity, Shield, Cpu, Hash, ExternalLink, Lock, Loader2 } from 'lucide-react';
import LottieAvatar from './LottieAvatar';

interface AgentCardProps {
  agent: AgentMetadata;
  isActive: boolean;
  onToggle: () => void;
  onClick: () => void;
  status?: 'idle' | 'negotiating' | 'streaming' | 'offline';
  isAutoMode?: boolean;
  isMinting?: boolean;
  isDeactivating?: boolean;
  isOnChain?: boolean;
  onChainTokenId?: number;
  customOrder?: string;
  onCustomOrderChange?: (order: string) => void;
  generatedSprite?: string;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, isActive, onToggle, onClick, status, isAutoMode, isMinting, isDeactivating, isOnChain, onChainTokenId, customOrder, onCustomOrderChange, generatedSprite }) => {
  const isLocked = isAutoMode && agent.id !== 'a0'; // Lock all except Commander in auto mode
  const isCommander = agent.id === 'a0';
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  
  // Use local animated avatar
  const spriteUrl = agent.avatar;
  const currentStatus = status || agent.status;
  
  // Determine button text
  let buttonText = '';
  if (isLocked) {
    buttonText = 'AUTO';
  } else if (isMinting) {
    buttonText = 'Minting...';
  } else if (isDeactivating) {
    buttonText = 'Deactivating...';
  } else if (isOnChain) {
    buttonText = isActive ? 'Deactivate' : 'Activate';
  } else {
    buttonText = isActive ? 'Deactivate' : 'Register';
  }
  
  const getStatusColor = () => {
    if (!isActive) return 'bg-gray-500';
    switch (currentStatus) {
      case 'streaming': return 'bg-neon-green animate-pulse';
      case 'negotiating': return 'bg-yellow-500 animate-pulse';
      case 'offline': return 'bg-red-500';
      default: return 'bg-neon-green animate-pulse';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative group cursor-pointer transition-all duration-300
        rounded-xl border backdrop-blur-md overflow-hidden
        ${isActive 
          ? 'border-neon-green bg-neon-green/10 shadow-[0_0_15px_rgba(67,255,77,0.3)]' 
          : 'border-white/10 bg-white/5 hover:border-neon-green/50'}
      `}
    >
      {/* Status Indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">
          {isActive ? currentStatus : 'offline'}
        </span>
      </div>
      
      {/* On-Chain Badge */}
      {isOnChain && (
        <div className="absolute top-3 left-3 bg-neon-green/20 border border-neon-green/50 rounded px-1.5 py-0.5 flex items-center gap-1">
          <span className="text-neon-green text-[8px] font-mono font-bold">⛓️ ON-CHAIN</span>
        </div>
      )}

      <div className="p-4 flex flex-col items-center text-center">
        {/* Sprite Avatar Container */}
        <div className="w-20 h-20 mb-4 relative">
            <div className="absolute inset-0 bg-neon-green/20 rounded-full blur-xl opacity-50"></div>
            {agent.avatarType === 'lottie' ? (
              <LottieAvatar 
                animationPath={spriteUrl}
                width={80}
                height={80}
                className="relative z-10 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] transition-all group-hover:scale-110 duration-300"
              />
            ) : (
              <img 
                src={spriteUrl} 
                alt={agent.name} 
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] transition-all group-hover:scale-110 duration-300"
                style={{ imageRendering: 'pixelated' }}
                onLoad={() => setSpriteLoaded(true)}
              />
            )}
        </div>

        <h3 className="text-white font-bold font-mono tracking-tight">{agent.name}</h3>
        <p className="text-neon-green text-xs mb-3">{agent.role}</p>
        
        <div className="w-full grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono mb-4">
          <div className="flex items-center gap-1 bg-black/30 p-1 rounded justify-center">
            <Shield size={10} className="text-neon-green" />
            <span>TS: {agent.trustScore}</span>
          </div>
          {onChainTokenId ? (
            <div className="flex items-center gap-1 bg-neon-green/20 border border-neon-green/40 p-1 rounded justify-center">
              <Hash size={10} className="text-neon-green" />
              <span className="text-neon-green font-bold">ID: {onChainTokenId}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded justify-center">
              <Hash size={10} />
              <span>#{agent.tokenId}</span>
            </div>
          )}
        </div>

        {/* Custom Order Input for Commander */}
        {isCommander && onCustomOrderChange && (
          <div className="w-full mb-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={customOrder || ''}
              onChange={(e) => onCustomOrderChange(e.target.value)}
              placeholder="Custom order (optional)..."
              className="w-full px-2 py-1.5 text-xs bg-black/40 border border-white/20 rounded text-white placeholder-white/40 focus:border-[#39ff14] focus:outline-none font-mono"
            />
            <div className="text-[9px] text-white/40 mt-1 text-left">
              {customOrder ? '📋 Will execute custom order' : '🤖 Default: portfolio & market analysis'}
            </div>
          </div>
        )}

        <div className="flex gap-2 w-full mt-auto">
           <button 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            disabled={isLocked || isMinting || isDeactivating}
            className={`
              flex-1 py-1 px-2 rounded text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
              ${isLocked 
                ? 'border-gray-600 bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                : isMinting
                  ? 'border-yellow-500 bg-yellow-500/20 text-yellow-500 cursor-wait animate-pulse'
                : isDeactivating
                  ? 'border-red-500 bg-red-500/20 text-red-500 cursor-wait animate-pulse'
                : isActive 
                  ? 'border-neon-green bg-neon-green text-black hover:bg-white hover:border-white' 
                  : 'border-white/20 text-white/60 hover:border-white hover:text-white'}
            `}
           >
             {isLocked ? (
               <><Lock size={10} className="inline mr-1" />{buttonText}</>
             ) : isMinting ? (
               <>⏳ {buttonText}</>
             ) : isDeactivating ? (
               <>⏳ {buttonText}</>
             ) : isOnChain ? (
               buttonText
             ) : (
               <>🔗 {buttonText}</>
             )}
           </button>
        </div>
      </div>
      
      {/* Auto Mode Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded px-2 py-1 flex items-center gap-1">
            <Lock size={12} className="text-yellow-500" />
            <span className="text-yellow-500 text-xs font-mono font-bold">AUTO</span>
          </div>
        </div>
      )}
      
      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neon-green opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neon-green opacity-50"></div>
    </div>
  );
};

export default AgentCard;