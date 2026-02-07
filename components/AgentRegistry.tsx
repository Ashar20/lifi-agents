// Agent Registry Component
// Register, manage, and view your named agents with fee sharing

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  Tag,
  Plus,
  Check,
  X,
  Loader2,
  ExternalLink,
  Wallet,
  TrendingUp,
  Users,
  DollarSign,
  Settings,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Address } from 'viem';
import {
  agentRegistryService,
  agentVaultService,
  RegisteredAgent,
  DEFAULT_AGENT_NAMES,
} from '../services/agentRegistry';
import { AGENTS } from '../constants';

interface AgentRegistryProps {
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

type ViewMode = 'my-agents' | 'register' | 'browse' | 'fees';

export const AgentRegistry: React.FC<AgentRegistryProps> = ({ onLog }) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('my-agents');
  const [myAgents, setMyAgents] = useState<RegisteredAgent[]>([]);
  const [allAgents, setAllAgents] = useState<RegisteredAgent[]>([]);
  const [pendingFees, setPendingFees] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration form
  const [regName, setRegName] = useState('');
  const [regAgentId, setRegAgentId] = useState('a3'); // Default to Yield Seeker
  const [regFee, setRegFee] = useState(500); // 5%
  const [isNameAvailable, setIsNameAvailable] = useState<boolean | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);

  // Load my agents
  const loadMyAgents = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const names = await agentRegistryService.getAgentsByOwner(address);
      const agents: RegisteredAgent[] = [];
      for (const name of names) {
        const agent = await agentRegistryService.resolveAgent(name);
        if (agent) agents.push(agent);
      }
      setMyAgents(agents);

      // Load pending fees
      const fees = await agentVaultService.getPendingFees(address);
      setPendingFees(fees);

      onLog?.(`Loaded ${agents.length} registered agents`, 'info');
    } catch (err: any) {
      console.error('Error loading agents:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [address, onLog]);

  // Load all agents (browse)
  const loadAllAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const agents = await agentRegistryService.getAllAgents(50);
      setAllAgents(agents);
    } catch (err: any) {
      console.error('Error loading all agents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check name availability (debounced)
  useEffect(() => {
    if (!regName || regName.length < 3) {
      setIsNameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingName(true);
      const available = await agentRegistryService.isNameAvailable(regName);
      setIsNameAvailable(available);
      setIsCheckingName(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [regName]);

  // Initial load
  useEffect(() => {
    if (isConnected && address) {
      loadMyAgents();
    }
  }, [isConnected, address, loadMyAgents]);

  // Register agent
  const handleRegister = async () => {
    if (!walletClient || !regName || !isNameAvailable) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await agentRegistryService.registerAgent(
        walletClient,
        regName,
        regAgentId,
        regFee
      );

      if (result.success) {
        onLog?.(`Registered agent: ${regName}`, 'success');
        setRegName('');
        setIsNameAvailable(null);
        await loadMyAgents();
        setViewMode('my-agents');
      } else {
        setError(result.error || 'Registration failed');
        onLog?.(`Registration failed: ${result.error}`, 'error');
      }
    } catch (err: any) {
      setError(err.message);
      onLog?.(`Error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Claim fees
  const handleClaimFees = async () => {
    if (!walletClient) return;

    setIsLoading(true);
    try {
      const result = await agentVaultService.claimFees(walletClient);
      if (result.success) {
        onLog?.(`Claimed ${pendingFees} USDC in fees`, 'success');
        setPendingFees('0');
      } else {
        setError(result.error || 'Claim failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onLog?.(`Copied: ${text}`, 'info');
  };

  // Format address
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <Tag className="text-purple-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Agent Registry</h3>
            <p className="text-gray-400 text-sm">Register agent names, earn from yield</p>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
          <Wallet className="text-yellow-400" size={24} />
          <div>
            <p className="text-yellow-400 font-medium">Wallet Not Connected</p>
            <p className="text-yellow-400/70 text-sm">Connect to register and manage agents</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Tag className="text-purple-400" size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Agent Registry</h3>
              <p className="text-gray-400 text-sm font-mono">Arbitrum Mainnet</p>
            </div>
          </div>

          <button
            onClick={loadMyAgents}
            disabled={isLoading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw size={18} className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {(['my-agents', 'register', 'browse', 'fees'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === 'browse') loadAllAgents();
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'hover:bg-white/10 text-gray-400'
              }`}
            >
              {mode === 'my-agents' && 'My Agents'}
              {mode === 'register' && 'Register'}
              {mode === 'browse' && 'Browse'}
              {mode === 'fees' && 'Fees'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
            <X size={16} className="text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X size={14} />
            </button>
          </div>
        )}

        {/* My Agents View */}
        {viewMode === 'my-agents' && (
          <div className="space-y-4">
            {myAgents.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="mx-auto mb-4 text-gray-500" size={40} />
                <p className="text-gray-400 mb-4">No registered agents yet</p>
                <button
                  onClick={() => setViewMode('register')}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                >
                  <Plus size={18} />
                  Register Your First Agent
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myAgents.map((agent) => (
                  <div
                    key={agent.name}
                    className="bg-white/5 border border-white/10 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold font-mono">{agent.name}</span>
                        <button
                          onClick={() => copyToClipboard(agent.name)}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          <Copy size={14} />
                        </button>
                        {agent.active ? (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <span className="text-purple-400 font-mono">
                        {agent.performanceFeePercent}% fee
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Agent</p>
                        <p className="text-white">
                          {AGENTS.find((a) => a.id === agent.agentId)?.name || agent.agentId}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Yield Generated</p>
                        <p className="text-neon-green">${agent.totalYieldGeneratedFormatted}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Fees Earned</p>
                        <p className="text-purple-400">${agent.totalFeesEarnedFormatted}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-xs text-gray-500">
                      <span>{agent.usageCount} uses</span>
                      <span>Registered {new Date(agent.registeredAt * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Register View */}
        {viewMode === 'register' && (
          <div className="space-y-4">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <h4 className="text-purple-400 font-medium mb-2">Register an Agent Name</h4>
              <p className="text-gray-400 text-sm">
                Give your agent a unique name. When others use it, you earn a percentage of the yield.
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Agent Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value.toLowerCase())}
                  placeholder="myagent.lifi"
                  className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white font-mono focus:border-purple-500 focus:outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isCheckingName && <Loader2 size={18} className="animate-spin text-gray-400" />}
                  {!isCheckingName && isNameAvailable === true && (
                    <Check size={18} className="text-green-400" />
                  )}
                  {!isCheckingName && isNameAvailable === false && (
                    <X size={18} className="text-red-400" />
                  )}
                </div>
              </div>
              {isNameAvailable === false && (
                <p className="text-red-400 text-xs mt-1">Name already taken</p>
              )}
              {isNameAvailable === true && (
                <p className="text-green-400 text-xs mt-1">Name available!</p>
              )}
            </div>

            {/* Agent Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Agent</label>
              <div className="grid grid-cols-2 gap-2">
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setRegAgentId(agent.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      regAgentId === agent.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-white font-medium text-sm">{agent.name}</p>
                    <p className="text-gray-500 text-xs">{agent.role}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Slider */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Performance Fee: <span className="text-purple-400">{(regFee / 100).toFixed(1)}%</span>
              </label>
              <input
                type="range"
                value={regFee}
                onChange={(e) => setRegFee(Number(e.target.value))}
                min="100"
                max="2000"
                step="50"
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1%</span>
                <span>20% max</span>
              </div>
            </div>

            {/* Register Button */}
            <button
              onClick={handleRegister}
              disabled={!isNameAvailable || isLoading || !regName}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Plus size={20} />
                  Register Agent
                </>
              )}
            </button>
          </div>
        )}

        {/* Browse View */}
        {viewMode === 'browse' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin text-purple-400 mx-auto" size={32} />
                <p className="text-gray-400 mt-2">Loading agents...</p>
              </div>
            ) : allAgents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto mb-4 text-gray-500" size={40} />
                <p className="text-gray-400">No agents registered yet</p>
              </div>
            ) : (
              allAgents.map((agent) => (
                <div
                  key={agent.name}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-mono">{agent.name}</p>
                    <p className="text-gray-500 text-xs">
                      Owner: {formatAddress(agent.owner)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-mono">{agent.performanceFeePercent}%</p>
                    <p className="text-gray-500 text-xs">{agent.usageCount} uses</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Fees View */}
        {viewMode === 'fees' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-500/20 to-neon-green/20 border border-purple-500/30 rounded-lg p-6 text-center">
              <DollarSign className="mx-auto mb-2 text-neon-green" size={32} />
              <p className="text-3xl font-bold text-white">${pendingFees}</p>
              <p className="text-gray-400 text-sm">Pending Fees (USDC)</p>
            </div>

            <button
              onClick={handleClaimFees}
              disabled={isLoading || parseFloat(pendingFees) === 0}
              className="w-full bg-neon-green hover:bg-neon-green/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <DollarSign size={20} />
                  Claim Fees
                </>
              )}
            </button>

            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Fee Breakdown by Agent</h4>
              {myAgents.length === 0 ? (
                <p className="text-gray-500 text-sm">No agents registered</p>
              ) : (
                <div className="space-y-2">
                  {myAgents.map((agent) => (
                    <div key={agent.name} className="flex justify-between text-sm">
                      <span className="text-gray-400 font-mono">{agent.name}</span>
                      <span className="text-purple-400">${agent.totalFeesEarnedFormatted}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentRegistry;
