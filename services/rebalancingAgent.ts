// Cross-Chain Rebalancing Agent
// Automatically maintains target allocations across chains using LI.FI routes

import { lifiService } from './lifi';
import { fetchWalletPortfolio, TokenBalance } from './portfolioTracker';
import { prepareExecution, ExecutionPlan } from './routeExecutor';

export interface TargetAllocation {
  token: string; // Token symbol (ETH, USDC, etc.)
  percentage: number; // Target percentage (0-100)
  preferredChains?: number[]; // Optional: preferred chains for this token
}

export interface RebalanceConfig {
  targetAllocations: TargetAllocation[];
  rebalanceThreshold: number; // Minimum drift % to trigger rebalance (e.g., 5 = 5%)
  minTradeValueUSD: number; // Minimum trade value to execute (avoid dust trades)
  maxSlippagePercent: number; // Max acceptable slippage
  dryRun: boolean; // If true, only simulate without executing
}

export interface PortfolioState {
  positions: TokenBalance[];
  totalValueUSD: number;
  allocations: Map<string, { valueUSD: number; percentage: number; chains: number[] }>;
}

export interface RebalanceAction {
  type: 'sell' | 'buy';
  token: string;
  fromChain: number;
  toChain: number;
  amountUSD: number;
  amountToken: number;
  fromToken: string;
  toToken: string;
  reason: string;
  executionPlan?: ExecutionPlan;
}

export interface RebalanceResult {
  portfolioBefore: PortfolioState;
  portfolioAfter?: PortfolioState;
  actions: RebalanceAction[];
  totalRebalanceValueUSD: number;
  estimatedGasCostUSD: number;
  executed: boolean;
  errors: string[];
}

// Default rebalance config
const DEFAULT_CONFIG: RebalanceConfig = {
  targetAllocations: [
    { token: 'USDC', percentage: 40 },
    { token: 'ETH', percentage: 40 },
    { token: 'WETH', percentage: 20 },
  ],
  rebalanceThreshold: 5, // 5% drift triggers rebalance
  minTradeValueUSD: 10, // Don't trade less than $10
  maxSlippagePercent: 1,
  dryRun: true,
};

// Chain and token configurations
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
  WETH: {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    10: '0x4200000000000000000000000000000000000006',
    137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    8453: '0x4200000000000000000000000000000000000006',
    43114: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  },
};

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Get current portfolio state with allocations
export async function getPortfolioState(walletAddress: string): Promise<PortfolioState> {
  const positions = await fetchWalletPortfolio(walletAddress);
  const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);

  // Group by token symbol
  const allocations = new Map<string, { valueUSD: number; percentage: number; chains: number[] }>();

  for (const position of positions) {
    const symbol = position.tokenSymbol.toUpperCase();
    const existing = allocations.get(symbol) || { valueUSD: 0, percentage: 0, chains: [] };
    existing.valueUSD += position.valueUSD;
    existing.percentage = totalValueUSD > 0 ? (existing.valueUSD / totalValueUSD) * 100 : 0;
    if (!existing.chains.includes(position.chainId)) {
      existing.chains.push(position.chainId);
    }
    allocations.set(symbol, existing);
  }

  // Combine ETH and WETH for allocation purposes
  const ethAlloc = allocations.get('ETH');
  const wethAlloc = allocations.get('WETH');
  if (ethAlloc && wethAlloc) {
    const combined = {
      valueUSD: ethAlloc.valueUSD + wethAlloc.valueUSD,
      percentage: ethAlloc.percentage + wethAlloc.percentage,
      chains: [...new Set([...ethAlloc.chains, ...wethAlloc.chains])],
    };
    allocations.set('ETH', combined);
  }

  return { positions, totalValueUSD, allocations };
}

// Calculate required rebalance actions
export function calculateRebalanceActions(
  state: PortfolioState,
  config: RebalanceConfig
): RebalanceAction[] {
  const actions: RebalanceAction[] = [];
  const { totalValueUSD, allocations, positions } = state;

  if (totalValueUSD < config.minTradeValueUSD) {
    console.log('[Rebalance] Portfolio too small to rebalance');
    return actions;
  }

  // Calculate target values for each allocation
  const targetValues = new Map<string, number>();
  for (const target of config.targetAllocations) {
    const targetValueUSD = (target.percentage / 100) * totalValueUSD;
    targetValues.set(target.token.toUpperCase(), targetValueUSD);
  }

  // Find tokens that need selling (over-allocated)
  const sellActions: RebalanceAction[] = [];
  const buyActions: RebalanceAction[] = [];

  for (const target of config.targetAllocations) {
    const token = target.token.toUpperCase();
    const currentAlloc = allocations.get(token);
    const currentValueUSD = currentAlloc?.valueUSD || 0;
    const targetValueUSD = targetValues.get(token) || 0;
    const currentPercentage = currentAlloc?.percentage || 0;
    const drift = currentPercentage - target.percentage;

    console.log(`[Rebalance] ${token}: current ${currentPercentage.toFixed(1)}% ($${currentValueUSD.toFixed(2)}) vs target ${target.percentage}% ($${targetValueUSD.toFixed(2)}), drift: ${drift.toFixed(1)}%`);

    // Check if drift exceeds threshold
    if (Math.abs(drift) < config.rebalanceThreshold) {
      continue;
    }

    const diffUSD = currentValueUSD - targetValueUSD;

    if (diffUSD > config.minTradeValueUSD) {
      // Over-allocated - need to sell
      // Find the position with the most value to sell from
      const tokenPositions = positions.filter(p =>
        p.tokenSymbol.toUpperCase() === token ||
        (token === 'ETH' && p.tokenSymbol.toUpperCase() === 'WETH')
      );

      if (tokenPositions.length > 0) {
        const largestPosition = tokenPositions.sort((a, b) => b.valueUSD - a.valueUSD)[0];
        const amountToken = diffUSD / largestPosition.priceUSD;

        sellActions.push({
          type: 'sell',
          token,
          fromChain: largestPosition.chainId,
          toChain: largestPosition.chainId, // Same chain initially
          amountUSD: diffUSD,
          amountToken,
          fromToken: largestPosition.tokenAddress,
          toToken: TOKEN_ADDRESSES['USDC']?.[largestPosition.chainId] || '',
          reason: `Reduce ${token} allocation from ${currentPercentage.toFixed(1)}% to ${target.percentage}%`,
        });
      }
    } else if (diffUSD < -config.minTradeValueUSD) {
      // Under-allocated - need to buy
      const buyAmountUSD = Math.abs(diffUSD);
      const preferredChain = target.preferredChains?.[0] || 42161; // Default to Arbitrum

      buyActions.push({
        type: 'buy',
        token,
        fromChain: preferredChain,
        toChain: preferredChain,
        amountUSD: buyAmountUSD,
        amountToken: 0, // Will be calculated from quote
        fromToken: TOKEN_ADDRESSES['USDC']?.[preferredChain] || '',
        toToken: token === 'ETH' ? NATIVE_TOKEN_ADDRESS : (TOKEN_ADDRESSES[token]?.[preferredChain] || ''),
        reason: `Increase ${token} allocation from ${currentPercentage.toFixed(1)}% to ${target.percentage}%`,
      });
    }
  }

  // Match sells with buys to minimize transactions
  // For each sell, route proceeds to a buy
  for (const sell of sellActions) {
    // Find a matching buy action
    const matchingBuy = buyActions.find(b => b.amountUSD > 0);
    if (matchingBuy) {
      // Route the sell directly to the buy token
      sell.toToken = matchingBuy.toToken;
      sell.toChain = matchingBuy.toChain;

      // Reduce the buy amount
      const amountToRoute = Math.min(sell.amountUSD, matchingBuy.amountUSD);
      matchingBuy.amountUSD -= amountToRoute;

      actions.push(sell);
    } else {
      // No matching buy - sell to USDC
      actions.push(sell);
    }
  }

  // Add remaining buys (need to source from USDC)
  for (const buy of buyActions) {
    if (buy.amountUSD >= config.minTradeValueUSD) {
      actions.push(buy);
    }
  }

  return actions;
}

// Get execution plans for rebalance actions
export async function prepareRebalanceExecution(
  actions: RebalanceAction[],
  walletAddress: string
): Promise<RebalanceAction[]> {
  const preparedActions: RebalanceAction[] = [];

  for (const action of actions) {
    try {
      // Calculate raw amount based on token decimals
      const decimals = action.token === 'USDC' || action.token === 'USDT' ? 6 : 18;
      const rawAmount = BigInt(Math.floor(action.amountToken * Math.pow(10, decimals))).toString();

      const plan = await prepareExecution({
        fromChain: action.fromChain,
        toChain: action.toChain,
        fromToken: action.fromToken,
        toToken: action.toToken,
        fromAmount: rawAmount,
        fromAddress: walletAddress,
      });

      preparedActions.push({
        ...action,
        executionPlan: plan,
      });
    } catch (error: any) {
      console.warn(`[Rebalance] Failed to prepare execution for ${action.type} ${action.token}:`, error?.message);
      preparedActions.push(action);
    }
  }

  return preparedActions;
}

// Main rebalancing function
export async function executeRebalance(
  walletAddress: string,
  config: RebalanceConfig = DEFAULT_CONFIG,
  signer?: any
): Promise<RebalanceResult> {
  console.log('[Rebalance] Starting portfolio rebalance analysis...');

  const errors: string[] = [];

  // Get current portfolio state
  const portfolioBefore = await getPortfolioState(walletAddress);

  console.log(`[Rebalance] Current portfolio: $${portfolioBefore.totalValueUSD.toFixed(2)}`);
  portfolioBefore.allocations.forEach((alloc, token) => {
    console.log(`  ${token}: ${alloc.percentage.toFixed(1)}% ($${alloc.valueUSD.toFixed(2)})`);
  });

  // Calculate required actions
  const actions = calculateRebalanceActions(portfolioBefore, config);

  if (actions.length === 0) {
    console.log('[Rebalance] Portfolio is balanced within threshold');
    return {
      portfolioBefore,
      actions: [],
      totalRebalanceValueUSD: 0,
      estimatedGasCostUSD: 0,
      executed: false,
      errors: [],
    };
  }

  console.log(`[Rebalance] ${actions.length} rebalance actions needed`);

  // Prepare execution plans
  const preparedActions = await prepareRebalanceExecution(actions, walletAddress);

  // Calculate totals
  const totalRebalanceValueUSD = preparedActions.reduce((sum, a) => sum + a.amountUSD, 0);
  const estimatedGasCostUSD = preparedActions.reduce((sum, a) => sum + (a.executionPlan?.gasCostUSD || 0), 0);

  console.log(`[Rebalance] Total rebalance value: $${totalRebalanceValueUSD.toFixed(2)}`);
  console.log(`[Rebalance] Estimated gas cost: $${estimatedGasCostUSD.toFixed(2)}`);

  // Execute if not dry run
  let executed = false;
  if (!config.dryRun && signer) {
    console.log('[Rebalance] Executing rebalance transactions...');

    for (const action of preparedActions) {
      if (action.executionPlan?.readyToExecute) {
        try {
          const { executeRoute } = await import('./routeExecutor');
          const result = await executeRoute(action.executionPlan, signer);

          if (result.success) {
            console.log(`[Rebalance] ✅ ${action.type} ${action.token}: ${result.transactionHash}`);
            executed = true;
          } else {
            errors.push(`Failed to ${action.type} ${action.token}: ${result.error}`);
          }
        } catch (error: any) {
          errors.push(`Error executing ${action.type} ${action.token}: ${error?.message}`);
        }
      }
    }
  }

  return {
    portfolioBefore,
    actions: preparedActions,
    totalRebalanceValueUSD,
    estimatedGasCostUSD,
    executed,
    errors,
  };
}

// Get rebalance summary for display
export function getRebalanceSummary(result: RebalanceResult): string {
  const lines: string[] = [];

  lines.push('📊 Portfolio Rebalance Analysis');
  lines.push(`Total Value: $${result.portfolioBefore.totalValueUSD.toFixed(2)}`);
  lines.push('');

  lines.push('Current Allocations:');
  result.portfolioBefore.allocations.forEach((alloc, token) => {
    lines.push(`  ${token}: ${alloc.percentage.toFixed(1)}% ($${alloc.valueUSD.toFixed(2)})`);
  });
  lines.push('');

  if (result.actions.length === 0) {
    lines.push('✅ Portfolio is balanced - no actions needed');
  } else {
    lines.push(`Actions Required (${result.actions.length}):`);
    for (const action of result.actions) {
      const chainName = CHAIN_NAMES[action.fromChain] || `Chain ${action.fromChain}`;
      lines.push(`  ${action.type === 'sell' ? '📉' : '📈'} ${action.type.toUpperCase()} $${action.amountUSD.toFixed(2)} of ${action.token} on ${chainName}`);
      lines.push(`     Reason: ${action.reason}`);
      if (action.executionPlan?.readyToExecute) {
        lines.push(`     Status: Ready to execute (gas: $${action.executionPlan.gasCostUSD.toFixed(2)})`);
      }
    }
    lines.push('');
    lines.push(`Total Rebalance: $${result.totalRebalanceValueUSD.toFixed(2)}`);
    lines.push(`Estimated Gas: $${result.estimatedGasCostUSD.toFixed(2)}`);
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('⚠️ Errors:');
    result.errors.forEach(e => lines.push(`  - ${e}`));
  }

  return lines.join('\n');
}
