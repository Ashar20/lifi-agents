import React from 'react';
import { User, LogOut } from 'lucide-react';
import { authService } from '../services/auth';

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

        {/* User Info */}
        {user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded border border-white/10">
              <User size={16} className="text-neon-green" />
              <span className="text-white font-medium text-sm">{user.username}</span>
              {user.isGuest && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                  Guest
                </span>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded border border-red-500/30 transition-colors"
            >
              <LogOut size={16} className="text-red-400" />
              <span className="text-red-400 font-medium text-sm">Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserBar;
