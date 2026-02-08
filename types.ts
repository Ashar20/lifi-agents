export enum AgentRole {
  COMMANDER = 'Kwisatz Haderach',
  NAVIGATOR = 'Fremen Scout',
  ARCHIVIST = 'Bene Gesserit',
  MERCHANT = 'Planetologist',
  SENTINEL = 'Swordmaster',
  ORACLE = 'Mentat',
  GLITCH = 'Naib',
}

export interface AgentPersonality {
  traits: string[];
  dialogues: string[];
}

export interface AgentMetadata {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
  tokenId: number; // EIP-8004
  trustScore: number;
  walletAddress: string;
  spriteSeed: string;
  avatar: string; // Path to local animated sprite (GIF or Lottie JSON)
  avatarType?: 'gif' | 'lottie' | 'image'; // Animation type
  status: 'idle' | 'negotiating' | 'streaming' | 'offline';
  personality?: AgentPersonality;
}

export type TaskType = 
  | 'arbitrage_detection'      // Find price differences
  | 'yield_optimization'       // Find best yields
  | 'rebalancing'              // Maintain allocations
  | 'cross_chain_swap'         // Execute LI.FI route (bridge only)
  | 'yield_deposit'            // Bridge + deposit to yield protocol (Aave etc.)
  | 'position_monitoring'      // Track positions
  | 'risk_analysis'             // Analyze route safety
  | 'strategy_coordination';    // Orchestrate team

export interface AgentTaskResult {
  agentId: string;
  agentName: string;
  taskType: TaskType;
  timestamp: number;
  status: 'success' | 'failed' | 'pending' | 'error';
  data?: any;
  summary: string;
  txHash?: string; // For on-chain transaction
  txUrl?: string; // Link to explorer
  routeId?: string; // LI.FI route ID
}

export interface LogMessage {
  id: string;
  timestamp: string;
  type: 'A2A' | 'x402' | 'SYSTEM' | 'COMMANDER';
  content: string;
  agentId?: string;
}

export interface StreamState {
  id: string;
  source: string;
  target: string;
  rate: number; // wei per second
  totalStreamed: number;
  active: boolean;
}

export enum MessageType {
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  SERVICE_OFFER = 'SERVICE_OFFER',
  STREAM_OPEN = 'STREAM_OPEN',
  STREAM_CLOSE = 'STREAM_CLOSE',
}

// LI.FI specific types
export interface CrossChainRoute {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedTime: number;
  gasCost: string;
  bridgeFee: string;
  slippage: number;
  routeId?: string;
}

export interface PortfolioPosition {
  chainId: number;
  token: string;
  balance: string;
  valueUSD: number;
  allocation: number; // percentage
  targetAllocation: number;
}

export interface ArbitrageOpportunity {
  fromChain: number;
  toChain: number;
  token: string;
  priceDifference: number; // percentage
  profitAfterFees: number; // USD
  route: CrossChainRoute;
}

export interface YieldOpportunity {
  chainId: number;
  protocol: string;
  token: string;
  apy: number;
  riskScore: number;
  tvl: number;
}
