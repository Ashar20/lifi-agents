// Arc Badge Component
// Shows Arc/CCTP branding when native USDC transfers are routed through Arc

import React from 'react';
import { Zap, Shield, Clock, ExternalLink } from 'lucide-react';

interface ArcBadgeProps {
  isArcRoute: boolean;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  sourceChain?: string;
  destinationChain?: string;
  estimatedTime?: string;
}

export const ArcBadge: React.FC<ArcBadgeProps> = ({
  isArcRoute,
  size = 'md',
  showDetails = false,
  sourceChain,
  destinationChain,
  estimatedTime,
}) => {
  if (!isArcRoute) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18,
  };

  return (
    <div className="inline-flex flex-col gap-1">
      {/* Main Badge */}
      <div
        className={`
          inline-flex items-center gap-1.5
          bg-gradient-to-r from-blue-600 to-cyan-500
          text-white font-semibold rounded-full
          ${sizeClasses[size]}
          shadow-lg shadow-blue-500/25
          animate-pulse
        `}
      >
        <Zap size={iconSizes[size]} className="text-yellow-300" />
        <span>Arc Powered</span>
      </div>

      {/* Details Panel */}
      {showDetails && (
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mt-2">
          <div className="flex items-center gap-2 text-blue-300 text-xs mb-2">
            <Shield size={12} />
            <span>Native USDC via Circle CCTP</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {sourceChain && destinationChain && (
              <div className="flex items-center gap-2 text-white">
                <span className="text-gray-400">Route:</span>
                <span className="font-mono">
                  {sourceChain} → {destinationChain}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-white">
              <span className="text-gray-400">Mechanism:</span>
              <span className="text-green-400">Burn & Mint</span>
            </div>

            {estimatedTime && (
              <div className="flex items-center gap-2 text-white">
                <Clock size={10} className="text-gray-400" />
                <span className="text-gray-400">Est. Time:</span>
                <span>{estimatedTime}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-green-400 mt-2">
              <Shield size={10} />
              <span>No wrapped tokens - Native USDC only</span>
            </div>
          </div>

          <a
            href="https://www.circle.com/en/cross-chain-transfer-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs mt-2"
          >
            Learn about CCTP <ExternalLink size={10} />
          </a>
        </div>
      )}
    </div>
  );
};

// Arc Stats Display Component
interface ArcStatsDisplayProps {
  stats: {
    totalTransfers: number;
    totalVolumeUsd: number;
    chainBreakdown: Record<string, { count: number; volumeUsd: number }>;
  };
}

export const ArcStatsDisplay: React.FC<ArcStatsDisplayProps> = ({ stats }) => {
  const formatUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (stats.totalTransfers === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border border-blue-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
          <Zap className="text-blue-400" size={16} />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Arc Liquidity Hub</h3>
          <p className="text-blue-300 text-xs">Native USDC Transfer Stats</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalTransfers}</p>
          <p className="text-xs text-gray-400">Transfers</p>
        </div>
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{formatUsd(stats.totalVolumeUsd)}</p>
          <p className="text-xs text-gray-400">Volume</p>
        </div>
      </div>

      {Object.keys(stats.chainBreakdown).length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">Routes Used</p>
          <div className="space-y-1">
            {Object.entries(stats.chainBreakdown)
              .sort((a, b) => b[1].volumeUsd - a[1].volumeUsd)
              .slice(0, 3)
              .map(([route, data]) => (
                <div key={route} className="flex justify-between text-xs">
                  <span className="text-gray-300 font-mono">{route}</span>
                  <span className="text-blue-300">{data.count}x • {formatUsd(data.volumeUsd)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Arc Route Indicator for transaction lists
interface ArcRouteIndicatorProps {
  isArcRoute: boolean;
}

export const ArcRouteIndicator: React.FC<ArcRouteIndicatorProps> = ({ isArcRoute }) => {
  if (!isArcRoute) {
    return <span className="text-xs text-gray-500">Standard Bridge</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-400 font-medium">
      <Zap size={10} className="text-yellow-400" />
      Arc/CCTP
    </span>
  );
};

export default ArcBadge;
