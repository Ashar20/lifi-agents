import React from 'react';
import { LogOut } from 'lucide-react';
import { authService } from '../services/auth';
import { WalletConnect } from './WalletConnect';

interface UserBarProps {
  onLogoClick?: () => void;
  onLogout: () => void;
}

const UserBar: React.FC<UserBarProps> = ({ onLogoClick, onLogout }) => {
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    onLogout();
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-neon-green rounded-full flex items-center justify-center">
            <span className="text-black font-bold text-lg">LI</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">LI.FI Agents</h1>
            <p className="text-gray-400 text-xs">Cross-Chain DeFi Orchestrator</p>
          </div>
        </button>

        {/* Right Side: Wallet + User */}
        <div className="flex items-center gap-4">
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
