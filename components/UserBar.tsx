import React from 'react';
import { LogOut, RotateCcw, Activity } from 'lucide-react';
import { authService } from '../services/auth';
import { WalletConnect } from './WalletConnect';

interface UserBarProps {
  onLogoClick?: () => void;
  onLogout: () => void;
  onReset?: () => void;
  taskResultsCount?: number;
  onShowDashboard?: () => void;
}

const UserBar: React.FC<UserBarProps> = ({ onLogoClick, onLogout, onReset, taskResultsCount = 0, onShowDashboard }) => {
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    onLogout();
  };

  return (
    <div className="relative z-[100] bg-transparent backdrop-blur-[2px] border-b border-white/5 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-neon-green/10 border border-neon-green/50 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(57,255,20,0.2)]">
            <span className="text-neon-green font-bold text-lg font-mono">LI</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">LI.FI Agents</h1>
            <p className="text-gray-400 text-xs">Cross-Chain DeFi Orchestrator</p>
          </div>
        </button>

        {/* Right Side: Reset + Dashboard + Wallet + User */}
        <div className="flex items-center gap-4">
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono transition-all bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400"
              title="Reset workflow - deactivate all agents, clear connections and tasks"
            >
              <RotateCcw size={14} />
              RESET
            </button>
          )}
          {taskResultsCount > 0 && onShowDashboard && (
            <button
              onClick={onShowDashboard}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono bg-neural-purple/10 hover:bg-neural-purple/20 border border-neural-purple/30 text-neural-purple transition-all"
            >
              <Activity size={14} />
              DASHBOARD ({taskResultsCount})
            </button>
          )}
          {/* Wallet Connection */}
          <WalletConnect />

          {/* User Info & Logout */}
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded border border-red-500/30 transition-colors"
              title={`Logged in as ${user.username}`}
            >
              <LogOut size={16} className="text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserBar;
