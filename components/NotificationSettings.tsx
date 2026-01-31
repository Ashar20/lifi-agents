// Notification Settings Component
// Configure email and push notifications for background alerts

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  Bell,
  BellOff,
  Mail,
  Smartphone,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  Zap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  backgroundService,
  NotificationSettings as NotifSettings,
  ServerStatus,
} from '../services/backgroundService';

interface NotificationSettingsProps {
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onLog }) => {
  const { address, isConnected } = useAccount();
  
  // State
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [isServerOnline, setIsServerOnline] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  
  // Settings
  const [email, setEmail] = useState('');
  const [yieldAlerts, setYieldAlerts] = useState(true);
  const [arbitrageAlerts, setArbitrageAlerts] = useState(true);
  const [minApyImprovement, setMinApyImprovement] = useState(5);
  const [minArbProfit, setMinArbProfit] = useState(5);
  
  // Check server status on mount
  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Check push notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);
  
  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setEmail(settings.email || '');
        setYieldAlerts(settings.yieldAlerts ?? true);
        setArbitrageAlerts(settings.arbitrageAlerts ?? true);
        setMinApyImprovement(settings.minApyImprovement ?? 5);
        setMinArbProfit(settings.minArbProfit ?? 5);
        setIsEnabled(settings.isEnabled ?? false);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);
  
  // Save settings
  const saveSettings = useCallback(() => {
    localStorage.setItem('notificationSettings', JSON.stringify({
      email,
      yieldAlerts,
      arbitrageAlerts,
      minApyImprovement,
      minArbProfit,
      isEnabled,
    }));
  }, [email, yieldAlerts, arbitrageAlerts, minApyImprovement, minArbProfit, isEnabled]);
  
  useEffect(() => {
    saveSettings();
  }, [saveSettings]);
  
  // Check server status
  const checkServerStatus = async () => {
    const running = await backgroundService.isServerRunning();
    setIsServerOnline(running);
    
    if (running) {
      const status = await backgroundService.getStatus();
      setServerStatus(status);
    }
  };
  
  // Request push permission
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      onLog?.('Push notifications not supported', 'error');
      return;
    }
    
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    
    if (permission === 'granted') {
      onLog?.('Push notifications enabled', 'success');
    } else {
      onLog?.('Push notifications denied', 'error');
    }
  };
  
  // Enable/disable notifications
  const handleToggle = async () => {
    if (!address) {
      onLog?.('Please connect your wallet first', 'error');
      return;
    }
    
    if (!isServerOnline) {
      onLog?.('Background server is offline. Start it with: cd server && npm run dev', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (!isEnabled) {
        // Register
        const success = await backgroundService.register(address, {
          email,
          yieldAlerts,
          arbitrageAlerts,
          minApyImprovement,
          minArbProfit,
          autoExecute: false,
        });
        
        if (success) {
          setIsEnabled(true);
          onLog?.('✅ Background monitoring enabled!', 'success');
        } else {
          onLog?.('Failed to enable notifications', 'error');
        }
      } else {
        // Unregister
        await backgroundService.unregister(address);
        setIsEnabled(false);
        onLog?.('Notifications disabled', 'info');
      }
    } catch (error: any) {
      onLog?.(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update settings on server
  const handleUpdateSettings = async () => {
    if (!address || !isEnabled) return;
    
    setIsLoading(true);
    try {
      const success = await backgroundService.updateSettings(address, {
        email,
        yieldAlerts,
        arbitrageAlerts,
        minApyImprovement,
        minArbProfit,
      });
      
      if (success) {
        onLog?.('Settings updated', 'success');
      }
    } catch (error) {
      onLog?.('Failed to update settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isEnabled ? 'bg-orange-500/20' : 'bg-white/10'
          }`}>
            {isEnabled ? (
              <Bell className="text-orange-400" size={20} />
            ) : (
              <BellOff className="text-gray-400" size={20} />
            )}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Background Alerts</h3>
            <p className="text-gray-400 text-sm font-mono">
              {isEnabled ? '🟢 Active' : '⚪ Disabled'}
            </p>
          </div>
        </div>
        
        <button
          onClick={checkServerStatus}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Refresh status"
        >
          <RefreshCw size={16} className="text-gray-400" />
        </button>
      </div>
      
      {/* Server Status */}
      <div className={`px-4 py-3 flex items-center gap-3 ${
        isServerOnline ? 'bg-green-500/10' : 'bg-red-500/10'
      }`}>
        <Server size={16} className={isServerOnline ? 'text-green-400' : 'text-red-400'} />
        <div className="flex-1">
          <span className={`text-sm ${isServerOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isServerOnline ? 'Background Server Online' : 'Background Server Offline'}
          </span>
          {serverStatus && (
            <span className="text-gray-500 text-xs ml-2">
              • {serverStatus.registeredUsers} users • {serverStatus.monitorStats.notificationsSent} alerts sent
            </span>
          )}
        </div>
        {!isServerOnline && (
          <span className="text-xs text-gray-400 font-mono">
            cd server && npm run dev
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Info Box */}
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-gray-300 text-sm">
            Enable background monitoring to receive alerts even when your browser is closed. 
            The server will scan for opportunities 24/7 and notify you via:
          </p>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Mail size={14} className="text-orange-400" />
              Email
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Smartphone size={14} className="text-orange-400" />
              Push Notifications
            </div>
          </div>
        </div>
        
        {/* Email Input */}
        <div>
          <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
            Email Address (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
            disabled={!isConnected}
          />
        </div>
        
        {/* Push Notification Permission */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div className="flex items-center gap-3">
            <Smartphone size={18} className="text-gray-400" />
            <div>
              <p className="text-white text-sm">Push Notifications</p>
              <p className="text-gray-500 text-xs">
                {pushPermission === 'granted' ? 'Enabled' : 
                 pushPermission === 'denied' ? 'Blocked (check browser settings)' : 
                 'Not enabled'}
              </p>
            </div>
          </div>
          {pushPermission !== 'granted' && pushPermission !== 'denied' && (
            <button
              onClick={requestPushPermission}
              className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded text-sm hover:bg-orange-500/30 transition-colors"
            >
              Enable
            </button>
          )}
          {pushPermission === 'granted' && (
            <CheckCircle size={18} className="text-green-400" />
          )}
          {pushPermission === 'denied' && (
            <AlertCircle size={18} className="text-red-400" />
          )}
        </div>
        
        {/* Alert Types */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-mono uppercase">Alert Types</label>
          
          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-neon-green" />
              <div>
                <p className="text-white text-sm">Yield Alerts</p>
                <p className="text-gray-500 text-xs">Notify when high yields are found</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={yieldAlerts}
              onChange={(e) => setYieldAlerts(e.target.checked)}
              className="w-5 h-5 rounded bg-black/30 border-white/20 text-neon-green focus:ring-neon-green"
            />
          </label>
          
          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-cyan-400" />
              <div>
                <p className="text-white text-sm">Arbitrage Alerts</p>
                <p className="text-gray-500 text-xs">Notify when profitable arbs are found</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={arbitrageAlerts}
              onChange={(e) => setArbitrageAlerts(e.target.checked)}
              className="w-5 h-5 rounded bg-black/30 border-white/20 text-cyan-400 focus:ring-cyan-400"
            />
          </label>
        </div>
        
        {/* Thresholds */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
              Min APY Alert (%)
            </label>
            <input
              type="number"
              value={minApyImprovement}
              onChange={(e) => setMinApyImprovement(Number(e.target.value))}
              className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
              min="1"
              max="100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-mono uppercase mb-1 block">
              Min Arb Profit ($)
            </label>
            <input
              type="number"
              value={minArbProfit}
              onChange={(e) => setMinArbProfit(Number(e.target.value))}
              className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm"
              min="1"
              max="1000"
            />
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleToggle}
            disabled={isLoading || !isConnected}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
              isEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-orange-500 text-black hover:bg-orange-500/80'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : isEnabled ? (
              <>
                <BellOff size={20} />
                Disable
              </>
            ) : (
              <>
                <Bell size={20} />
                Enable Alerts
              </>
            )}
          </button>
          
          {isEnabled && (
            <button
              onClick={handleUpdateSettings}
              disabled={isLoading}
              className="px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <Settings size={20} />
            </button>
          )}
        </div>
        
        {!isConnected && (
          <p className="text-yellow-400 text-xs text-center">
            Connect your wallet to enable notifications
          </p>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
