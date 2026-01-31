// Real Rebalancer Service
// Calculates portfolio drift and generates rebalancing recommendations

import { getPortfolioSummary, Position } from './portfolioTracker';

export interface AllocationTarget {
  tokenSymbol: string;
  targetPercent: number; // Target allocation percentage (0-100)
}

export interface AllocationStatus {
  tokenSymbol: string;
  currentPercent: number;
  targetPercent: number;
  driftPercent: number; // Positive = overweight, negative = underweight
  currentValueUSD: number;
  targetValueUSD: number;
  adjustmentNeeded: number; // USD amount to buy (positive) or sell (negative)
}

export interface RebalanceAnalysis {
  totalValueUSD: number;
  totalDrift: number; // Average absolute drift
  needsRebalancing: boolean;
  allocations: AllocationStatus[];
  recommendations: string[];
  actions: RebalanceAction[];
  timestamp: number;
}

export interface RebalanceAction {
  type: 'buy' | 'sell';
  tokenSymbol: string;
  amount: number; // USD amount
  fromChain?: number;
  toChain?: number;
  priority: 'high' | 'medium' | 'low';
}

// Default target allocations
const DEFAULT_TARGETS: AllocationTarget[] = [
  { tokenSymbol: 'ETH', targetPercent: 50 },
  { tokenSymbol: 'USDC', targetPercent: 30 },
  { tokenSymbol: 'DAI', targetPercent: 10 },
  { tokenSymbol: 'USDT', targetPercent: 10 },
];

// Calculate current allocations from portfolio positions
export function calculateAllocations(
  positions: Position[],
  totalValue: number
): Record<string, number> {
  const allocations: Record<string, number> = {};
  
  positions.forEach(pos => {
    // Aggregate by token symbol (across all chains)
    if (!allocations[pos.tokenSymbol]) {
      allocations[pos.tokenSymbol] = 0;
    }
    allocations[pos.tokenSymbol] += pos.valueUSD;
  });
  
  // Convert to percentages
  const percentages: Record<string, number> = {};
  Object.entries(allocations).forEach(([symbol, value]) => {
    percentages[symbol] = totalValue > 0 ? (value / totalValue) * 100 : 0;
  });
  
  return percentages;
}

// Analyze portfolio drift from target allocations
export async function analyzePortfolioDrift(
  walletAddress: string,
  targets: AllocationTarget[] = DEFAULT_TARGETS,
  driftThreshold: number = 5 // Percentage threshold to trigger rebalancing
): Promise<RebalanceAnalysis> {
  try {
    // Get real portfolio data
    const portfolio = await getPortfolioSummary(walletAddress);
    const totalValue = portfolio.totalValueUSD;
    
    if (totalValue === 0) {
      return {
        totalValueUSD: 0,
        totalDrift: 0,
        needsRebalancing: false,
        allocations: [],
        recommendations: ['No portfolio value to rebalance'],
        actions: [],
        timestamp: Date.now(),
      };
    }
    
    // Calculate current allocations
    const currentAllocations = calculateAllocations(portfolio.positions, totalValue);
    
    // Calculate drift for each target
    const allocations: AllocationStatus[] = targets.map(target => {
      const currentPercent = currentAllocations[target.tokenSymbol] || 0;
      const driftPercent = currentPercent - target.targetPercent;
      const currentValueUSD = (currentPercent / 100) * totalValue;
      const targetValueUSD = (target.targetPercent / 100) * totalValue;
      const adjustmentNeeded = targetValueUSD - currentValueUSD;
      
      return {
        tokenSymbol: target.tokenSymbol,
        currentPercent,
        targetPercent: target.targetPercent,
        driftPercent,
        currentValueUSD,
        targetValueUSD,
        adjustmentNeeded,
      };
    });
    
    // Add any tokens not in targets (to track unexpected holdings)
    Object.entries(currentAllocations).forEach(([symbol, percent]) => {
      if (!targets.find(t => t.tokenSymbol === symbol)) {
        const valueUSD = (percent / 100) * totalValue;
        allocations.push({
          tokenSymbol: symbol,
          currentPercent: percent,
          targetPercent: 0, // No target = should be 0%
          driftPercent: percent,
          currentValueUSD: valueUSD,
          targetValueUSD: 0,
          adjustmentNeeded: -valueUSD, // Sell all
        });
      }
    });
    
    // Calculate total drift (average absolute drift)
    const totalDrift = allocations.reduce((sum, a) => sum + Math.abs(a.driftPercent), 0) / allocations.length;
    
    // Determine if rebalancing is needed
    const needsRebalancing = allocations.some(a => Math.abs(a.driftPercent) > driftThreshold);
    
    // Generate recommendations
    const recommendations: string[] = [];
    const actions: RebalanceAction[] = [];
    
    allocations.forEach(alloc => {
      if (Math.abs(alloc.driftPercent) > driftThreshold) {
        if (alloc.driftPercent > 0) {
          // Overweight - need to sell
          recommendations.push(
            `${alloc.tokenSymbol}: Overweight by ${alloc.driftPercent.toFixed(1)}% - Sell $${Math.abs(alloc.adjustmentNeeded).toFixed(2)}`
          );
          actions.push({
            type: 'sell',
            tokenSymbol: alloc.tokenSymbol,
            amount: Math.abs(alloc.adjustmentNeeded),
            priority: Math.abs(alloc.driftPercent) > 10 ? 'high' : 'medium',
          });
        } else {
          // Underweight - need to buy
          recommendations.push(
            `${alloc.tokenSymbol}: Underweight by ${Math.abs(alloc.driftPercent).toFixed(1)}% - Buy $${Math.abs(alloc.adjustmentNeeded).toFixed(2)}`
          );
          actions.push({
            type: 'buy',
            tokenSymbol: alloc.tokenSymbol,
            amount: Math.abs(alloc.adjustmentNeeded),
            priority: Math.abs(alloc.driftPercent) > 10 ? 'high' : 'medium',
          });
        }
      }
    });
    
    if (!needsRebalancing) {
      recommendations.push('Portfolio is well-balanced. No rebalancing needed.');
    }
    
    // Sort actions by priority
    actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    return {
      totalValueUSD: totalValue,
      totalDrift,
      needsRebalancing,
      allocations,
      recommendations,
      actions,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.error('Portfolio drift analysis error:', error);
    return {
      totalValueUSD: 0,
      totalDrift: 0,
      needsRebalancing: false,
      allocations: [],
      recommendations: [`Analysis failed: ${error.message}`],
      actions: [],
      timestamp: Date.now(),
    };
  }
}

// Get current vs target allocation summary
export async function getAllocationSummary(
  walletAddress: string,
  targets: AllocationTarget[] = DEFAULT_TARGETS
): Promise<{
  current: Record<string, number>;
  target: Record<string, number>;
  drift: number;
}> {
  const analysis = await analyzePortfolioDrift(walletAddress, targets);
  
  const current: Record<string, number> = {};
  const target: Record<string, number> = {};
  
  analysis.allocations.forEach(alloc => {
    current[alloc.tokenSymbol] = Math.round(alloc.currentPercent);
    target[alloc.tokenSymbol] = alloc.targetPercent;
  });
  
  return {
    current,
    target,
    drift: analysis.totalDrift,
  };
}
