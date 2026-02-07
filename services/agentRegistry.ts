// Agent Registry Service
// Interacts with AgentRegistry and AgentVault contracts on Arbitrum
// Provides ENS-style agent naming with fee sharing

import { createPublicClient, createWalletClient, http, Address, parseAbi, formatUnits } from 'viem';
import { arbitrum } from 'viem/chains';

// Contract addresses (to be updated after deployment)
export const AGENT_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
export const AGENT_VAULT_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

// ABIs
const REGISTRY_ABI = parseAbi([
  // Read functions
  'function resolveAgent(string name) view returns ((string name, string agentId, address owner, uint256 performanceFee, uint256 totalYieldGenerated, uint256 totalFeesEarned, uint256 usageCount, bool active, uint256 registeredAt))',
  'function isNameAvailable(string name) view returns (bool)',
  'function getAgentsByOwner(address owner) view returns (string[])',
  'function totalAgents() view returns (uint256)',
  'function getAgentAtIndex(uint256 index) view returns ((string name, string agentId, address owner, uint256 performanceFee, uint256 totalYieldGenerated, uint256 totalFeesEarned, uint256 usageCount, bool active, uint256 registeredAt))',
  // Write functions
  'function registerAgent(string name, string agentId, uint256 performanceFee)',
  'function updateFee(string name, uint256 newFee)',
  'function transferAgentOwnership(string name, address newOwner)',
  'function setAgentActive(string name, bool active)',
]);

const VAULT_ABI = parseAbi([
  // Read functions
  'function getUserDeposit(address user, string agentName) view returns ((uint256 principal, uint256 depositTime, uint256 lastHarvestTime, uint256 totalYieldClaimed, uint256 totalFeesPaid))',
  'function getAgentDeposits(string agentName) view returns (uint256)',
  'function getPendingFees(address owner) view returns (uint256)',
  // Write functions
  'function depositViaAgent(string agentName, uint256 amount)',
  'function harvestYield(string agentName, uint256 yieldAmount)',
  'function withdraw(string agentName, uint256 amount)',
  'function claimFees()',
]);

// Types
export interface RegisteredAgent {
  name: string;
  agentId: string;
  owner: Address;
  performanceFee: number; // Basis points
  performanceFeePercent: number; // Percentage (e.g., 5.0 for 5%)
  totalYieldGenerated: bigint;
  totalYieldGeneratedFormatted: string;
  totalFeesEarned: bigint;
  totalFeesEarnedFormatted: string;
  usageCount: number;
  active: boolean;
  registeredAt: number;
}

export interface UserDeposit {
  principal: bigint;
  principalFormatted: string;
  depositTime: number;
  lastHarvestTime: number;
  totalYieldClaimed: bigint;
  totalYieldClaimedFormatted: string;
  totalFeesPaid: bigint;
  totalFeesPaidFormatted: string;
}

// Default agent names for the 7 agents
export const DEFAULT_AGENT_NAMES: Record<string, string> = {
  'a0': 'strategist.lifi',
  'a1': 'arbitrage.lifi',
  'a2': 'guardian.lifi',
  'a3': 'yieldseeker.lifi',
  'a4': 'sentinel.lifi',
  'a5': 'rebalancer.lifi',
  'a6': 'executor.lifi',
};

// Create public client for reads
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http('https://arb1.arbitrum.io/rpc'),
});

// Helper to format USDC (6 decimals)
function formatUSDC(amount: bigint): string {
  return formatUnits(amount, 6);
}

// Registry Service
export const agentRegistryService = {
  /**
   * Check if a name is available for registration
   */
  async isNameAvailable(name: string): Promise<boolean> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'isNameAvailable',
        args: [name],
      });
      return result as boolean;
    } catch (error) {
      console.error('[AgentRegistry] Error checking name availability:', error);
      return false;
    }
  },

  /**
   * Resolve an agent name to its data
   */
  async resolveAgent(name: string): Promise<RegisteredAgent | null> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'resolveAgent',
        args: [name],
      }) as any;

      return {
        name: result.name,
        agentId: result.agentId,
        owner: result.owner,
        performanceFee: Number(result.performanceFee),
        performanceFeePercent: Number(result.performanceFee) / 100,
        totalYieldGenerated: result.totalYieldGenerated,
        totalYieldGeneratedFormatted: formatUSDC(result.totalYieldGenerated),
        totalFeesEarned: result.totalFeesEarned,
        totalFeesEarnedFormatted: formatUSDC(result.totalFeesEarned),
        usageCount: Number(result.usageCount),
        active: result.active,
        registeredAt: Number(result.registeredAt),
      };
    } catch (error) {
      console.error('[AgentRegistry] Error resolving agent:', error);
      return null;
    }
  },

  /**
   * Get all agents owned by an address
   */
  async getAgentsByOwner(owner: Address): Promise<string[]> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'getAgentsByOwner',
        args: [owner],
      });
      return result as string[];
    } catch (error) {
      console.error('[AgentRegistry] Error getting agents by owner:', error);
      return [];
    }
  },

  /**
   * Get total number of registered agents
   */
  async getTotalAgents(): Promise<number> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'totalAgents',
      });
      return Number(result);
    } catch (error) {
      console.error('[AgentRegistry] Error getting total agents:', error);
      return 0;
    }
  },

  /**
   * Get all registered agents (paginated)
   */
  async getAllAgents(limit: number = 50): Promise<RegisteredAgent[]> {
    try {
      const total = await this.getTotalAgents();
      const agents: RegisteredAgent[] = [];

      for (let i = 0; i < Math.min(total, limit); i++) {
        const result = await publicClient.readContract({
          address: AGENT_REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'getAgentAtIndex',
          args: [BigInt(i)],
        }) as any;

        agents.push({
          name: result.name,
          agentId: result.agentId,
          owner: result.owner,
          performanceFee: Number(result.performanceFee),
          performanceFeePercent: Number(result.performanceFee) / 100,
          totalYieldGenerated: result.totalYieldGenerated,
          totalYieldGeneratedFormatted: formatUSDC(result.totalYieldGenerated),
          totalFeesEarned: result.totalFeesEarned,
          totalFeesEarnedFormatted: formatUSDC(result.totalFeesEarned),
          usageCount: Number(result.usageCount),
          active: result.active,
          registeredAt: Number(result.registeredAt),
        });
      }

      return agents;
    } catch (error) {
      console.error('[AgentRegistry] Error getting all agents:', error);
      return [];
    }
  },

  /**
   * Register a new agent (requires wallet client)
   */
  async registerAgent(
    walletClient: any,
    name: string,
    agentId: string,
    performanceFeeBps: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerAgent',
        args: [name, agentId, BigInt(performanceFeeBps)],
      });

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[AgentRegistry] Error registering agent:', error);
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  /**
   * Update agent fee (requires wallet client, must be owner)
   */
  async updateFee(
    walletClient: any,
    name: string,
    newFeeBps: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'updateFee',
        args: [name, BigInt(newFeeBps)],
      });

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[AgentRegistry] Error updating fee:', error);
      return { success: false, error: error.message || 'Update failed' };
    }
  },

  /**
   * Transfer agent ownership (requires wallet client, must be owner)
   */
  async transferOwnership(
    walletClient: any,
    name: string,
    newOwner: Address
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'transferAgentOwnership',
        args: [name, newOwner],
      });

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[AgentRegistry] Error transferring ownership:', error);
      return { success: false, error: error.message || 'Transfer failed' };
    }
  },
};

// Vault Service
export const agentVaultService = {
  /**
   * Get user deposit for an agent
   */
  async getUserDeposit(user: Address, agentName: string): Promise<UserDeposit | null> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'getUserDeposit',
        args: [user, agentName],
      }) as any;

      return {
        principal: result.principal,
        principalFormatted: formatUSDC(result.principal),
        depositTime: Number(result.depositTime),
        lastHarvestTime: Number(result.lastHarvestTime),
        totalYieldClaimed: result.totalYieldClaimed,
        totalYieldClaimedFormatted: formatUSDC(result.totalYieldClaimed),
        totalFeesPaid: result.totalFeesPaid,
        totalFeesPaidFormatted: formatUSDC(result.totalFeesPaid),
      };
    } catch (error) {
      console.error('[AgentVault] Error getting user deposit:', error);
      return null;
    }
  },

  /**
   * Get total deposits for an agent
   */
  async getAgentDeposits(agentName: string): Promise<string> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'getAgentDeposits',
        args: [agentName],
      });
      return formatUSDC(result as bigint);
    } catch (error) {
      console.error('[AgentVault] Error getting agent deposits:', error);
      return '0';
    }
  },

  /**
   * Get pending fees for an owner
   */
  async getPendingFees(owner: Address): Promise<string> {
    try {
      const result = await publicClient.readContract({
        address: AGENT_VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'getPendingFees',
        args: [owner],
      });
      return formatUSDC(result as bigint);
    } catch (error) {
      console.error('[AgentVault] Error getting pending fees:', error);
      return '0';
    }
  },

  /**
   * Deposit via agent (requires wallet client)
   */
  async depositViaAgent(
    walletClient: any,
    agentName: string,
    amount: bigint
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'depositViaAgent',
        args: [agentName, amount],
      });

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[AgentVault] Error depositing:', error);
      return { success: false, error: error.message || 'Deposit failed' };
    }
  },

  /**
   * Claim accumulated fees (requires wallet client, for agent owners)
   */
  async claimFees(
    walletClient: any
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'claimFees',
        args: [],
      });

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[AgentVault] Error claiming fees:', error);
      return { success: false, error: error.message || 'Claim failed' };
    }
  },

  /**
   * Withdraw principal (requires wallet client)
   */
  async withdraw(
    walletClient: any,
    agentName: string,
    amount: bigint
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: AGENT_VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [agentName, amount],
      });

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[AgentVault] Error withdrawing:', error);
      return { success: false, error: error.message || 'Withdrawal failed' };
    }
  },
};

// Export combined service
export const agentRegistry = {
  registry: agentRegistryService,
  vault: agentVaultService,
  defaultNames: DEFAULT_AGENT_NAMES,

  /**
   * Get agent by ID using default naming
   */
  getDefaultName(agentId: string): string {
    return DEFAULT_AGENT_NAMES[agentId] || `agent-${agentId}.lifi`;
  },

  /**
   * Validate agent name format
   */
  isValidName(name: string): boolean {
    if (name.length < 3 || name.length > 32) return false;
    // Only lowercase letters, numbers, hyphens, and dots
    return /^[a-z0-9\-.]+$/.test(name);
  },
};

// Debug export
if (typeof window !== 'undefined') {
  (window as any).agentRegistry = agentRegistry;
  console.log('%c🏷️ AGENT REGISTRY', 'color: #9945FF; font-weight: bold; font-size: 14px;');
  console.log('  agentRegistry.registry.resolveAgent("yieldseeker.lifi")');
  console.log('  agentRegistry.registry.isNameAvailable("myagent.lifi")');
  console.log('  agentRegistry.vault.getPendingFees(address)');
}
