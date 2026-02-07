import React from 'react';
import { AgentMetadata } from '../../types';

interface NeuralNodeProps {
    agent: AgentMetadata;
    isActive: boolean;
    status: string;
    onClick: () => void;
    onToggle: () => void;
    isAutoMode?: boolean;
    customOrder?: string;
    onCustomOrderChange?: (order: string) => void;
}

const NeuralNode: React.FC<NeuralNodeProps> = ({
    agent,
    isActive,
    status,
    onClick,
    onToggle,
    isAutoMode,
    customOrder,
    onCustomOrderChange,
}) => {
    const statusColors = {
        idle: 'border-deep-sand/50',
        working: 'border-spice-orange/80 shadow-spice-orange/50',
        success: 'border-green-500/80',
        error: 'border-red-500/80',
        offline: 'border-gray-600/30',
    };

    const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.idle;

    return (
        <div
            className={`relative group transition-all duration-300 ${isActive ? 'scale-100' : 'scale-95 opacity-70'}`}
        >
            {/* Desert-themed card */}
            <div
                onClick={onClick}
                className={`relative overflow-hidden rounded-lg border-2 ${statusColor} bg-gradient-to-br from-arrakis-brown/90 to-stillsuit-black/90 backdrop-blur-md p-4 cursor-pointer transition-all duration-300 hover:shadow-lg ${isActive ? 'shadow-lg' : ''}`}
                style={{
                    boxShadow: isActive ? `0 0 20px rgba(216, 67, 21, 0.3)` : 'none',
                }}
            >
                {/* Pulsing border animation for active agents - spice glow */}
                {isActive && status === 'working' && (
                    <div className="absolute inset-0 rounded-lg border-2 border-spice-orange animate-pulse-slow pointer-events-none" />
                )}

                {/* Avatar */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-spice-orange/20 flex items-center justify-center">
                        <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm truncate">{agent.name}</h3>
                        <p className="text-gray-400 text-xs truncate">{agent.role}</p>
                    </div>
                </div>

                {/* Trust Score */}
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-mono">TRUST</span>
                    <div className="flex items-center gap-1">
                        <div className="h-1 w-16 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-spice-orange to-desert-sand"
                                style={{ width: `${agent.trustScore}%` }}
                            />
                        </div>
                        <span className="text-xs text-spice-orange font-mono">{agent.trustScore}%</span>
                    </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono uppercase">{status}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                        className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${isActive
                            ? 'bg-spice-orange/20 text-spice-orange border border-spice-orange/50'
                            : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
                            }`}
                    >
                        {isActive ? 'ACTIVE' : 'OFFLINE'}
                    </button>
                </div>

                {/* Custom order input for Commander */}
                {agent.id === 'a0' && isActive && onCustomOrderChange && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <input
                            type="text"
                            value={customOrder || ''}
                            onChange={(e) => onCustomOrderChange(e.target.value)}
                            placeholder="Custom order..."
                            className="w-full bg-black/30 border border-spice-orange/30 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-spice-orange"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeuralNode;
