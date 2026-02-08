// Real Route Executor Service
// Executes cross-chain swaps via LI.FI

import { lifiService } from './lifi';
import { analyzeRouteRisk } from './riskAnalyzer';

export interface ExecutionParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippageTolerance?: number; // Default 0.5%
}

export interface ExecutionPlan {
  quote: any;
  riskAnalysis: any;
  estimatedOutput: string;
  estimatedOutputUSD: number;
  gasCostUSD: number;
  totalCostUSD: number;
  netValueUSD: number;
  steps: ExecutionStep[];
  readyToExecute: boolean;
  warnings: string[];
}

export interface ExecutionStep {
  stepNumber: number;
  type: 'swap' | 'bridge' | 'approve';
  fromChain: string;
  toChain: string;
  tool: string;
  estimatedTime: number;
  gasCost: number;
}

export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  status: 'pending' | 'completed' | 'failed';
  fromAmount: string;
  toAmount?: string;
  error?: string;
  executionTime?: number;
  route?: string;
}

// Chain name mappings
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  43114: 'Avalanche',
};

// Token addresses for common tokens
const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  DAI: {
    1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    137: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  },
  WETH: {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    10: '0x4200000000000000000000000000000000000006',
    137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    8453: '0x4200000000000000000000000000000000000006',
  },
};

// Prepare execution plan (quote + risk analysis)
export async function prepareExecution(
  params: ExecutionParams
): Promise<ExecutionPlan> {
  const warnings: string[] = [];
  
  try {
    // Get quote from LI.FI
    let quote;
    try {
      quote = await lifiService.getQuote({
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress || params.fromAddress,
      });
    } catch (quoteError: any) {
      console.error('Quote request failed:', quoteError);
      return {
        quote: null,
        riskAnalysis: null,
        estimatedOutput: '0',
        estimatedOutputUSD: 0,
        gasCostUSD: 0,
        totalCostUSD: 0,
        netValueUSD: 0,
        steps: [],
        readyToExecute: false,
        warnings: [quoteError?.message || 'Failed to get quote from LI.FI'],
      };
    }

    if (!quote) {
      return {
        quote: null,
        riskAnalysis: null,
        estimatedOutput: '0',
        estimatedOutputUSD: 0,
        gasCostUSD: 0,
        totalCostUSD: 0,
        netValueUSD: 0,
        steps: [],
        readyToExecute: false,
        warnings: ['No route available for this swap'],
      };
    }

    // getQuote returns { quote: LifiStep, arcInfo, isArcRoute } — extract the raw step
    const rawQuote = quote.quote || quote;

    // Analyze risk
    const riskAnalysis = await analyzeRouteRisk({
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress,
    });
    
    // Extract quote details from the raw LI.FI step
    const estimate = rawQuote.estimate || {};
    const estimatedOutput = estimate.toAmount || '0';
    const estimatedOutputUSD = parseFloat(estimate.toAmountUSD || '0');
    const fromAmountUSD = parseFloat(estimate.fromAmountUSD || '0');

    // Calculate gas costs
    let gasCostUSD = 0;
    if (estimate.gasCosts && Array.isArray(estimate.gasCosts)) {
      gasCostUSD = estimate.gasCosts.reduce((sum: number, gas: any) => {
        return sum + parseFloat(gas.amountUSD || '0');
      }, 0);
    }

    const totalCostUSD = fromAmountUSD + gasCostUSD;
    const netValueUSD = estimatedOutputUSD - gasCostUSD;

    // Parse steps
    const steps: ExecutionStep[] = [];
    if (rawQuote.includedSteps) {
      rawQuote.includedSteps.forEach((step: any, index: number) => {
        steps.push({
          stepNumber: index + 1,
          type: step.type === 'cross' ? 'bridge' : 'swap',
          fromChain: CHAIN_NAMES[step.action?.fromChainId] || `Chain ${step.action?.fromChainId}`,
          toChain: CHAIN_NAMES[step.action?.toChainId] || `Chain ${step.action?.toChainId}`,
          tool: step.toolDetails?.name || 'Unknown',
          estimatedTime: parseInt(step.estimate?.executionDuration || '0'),
          gasCost: parseFloat(step.estimate?.gasCosts?.[0]?.amountUSD || '0'),
        });
      });
    }
    
    // Add warnings
    if (riskAnalysis.riskScore > 50) {
      warnings.push(`High risk route (score: ${riskAnalysis.riskScore})`);
    }
    if (gasCostUSD > fromAmountUSD * 0.05) {
      warnings.push(`Gas costs exceed 5% of swap amount`);
    }
    if (riskAnalysis.slippage > 1) {
      warnings.push(`Expected slippage: ${riskAnalysis.slippage.toFixed(2)}%`);
    }
    
    // Determine if ready to execute
    const readyToExecute = riskAnalysis.isValid && warnings.length < 3;
    
    return {
      quote: rawQuote,
      riskAnalysis,
      estimatedOutput,
      estimatedOutputUSD,
      gasCostUSD,
      totalCostUSD,
      netValueUSD,
      steps,
      readyToExecute,
      warnings,
    };
  } catch (error: any) {
    console.error('Execution preparation error:', error);
    return {
      quote: null,
      riskAnalysis: null,
      estimatedOutput: '0',
      estimatedOutputUSD: 0,
      gasCostUSD: 0,
      totalCostUSD: 0,
      netValueUSD: 0,
      steps: [],
      readyToExecute: false,
      warnings: [`Preparation failed: ${error.message}`],
    };
  }
}

// Execute a route (requires wallet signer)
export async function executeRoute(
  plan: ExecutionPlan,
  signer: any
): Promise<ExecutionResult> {
  if (!plan.readyToExecute || !plan.quote) {
    return {
      success: false,
      status: 'failed',
      fromAmount: '0',
      error: 'Route not ready for execution',
    };
  }
  
  const startTime = Date.now();
  
  try {
    // Execute via LI.FI
    const result = await lifiService.executeRoute(plan.quote, signer);
    
    return {
      success: true,
      transactionHash: result.transactionHash || result.hash,
      status: 'pending', // Will be confirmed async
      fromAmount: plan.quote.action?.fromAmount || '0',
      toAmount: plan.estimatedOutput,
      executionTime: Date.now() - startTime,
      route: `${CHAIN_NAMES[plan.quote.action?.fromChainId]} → ${CHAIN_NAMES[plan.quote.action?.toChainId]}`,
    };
  } catch (error: any) {
    console.error('Route execution error:', error);
    return {
      success: false,
      status: 'failed',
      fromAmount: plan.quote?.action?.fromAmount || '0',
      error: error.message,
      executionTime: Date.now() - startTime,
    };
  }
}

// Get execution summary for display
export function getExecutionSummary(plan: ExecutionPlan): {
  route: string;
  estimatedTime: string;
  gasCost: string;
  netValue: string;
  status: string;
  warnings: string[];
} {
  if (!plan.quote) {
    return {
      route: 'No route available',
      estimatedTime: 'N/A',
      gasCost: 'N/A',
      netValue: 'N/A',
      status: 'NOT_READY',
      warnings: plan.warnings,
    };
  }
  
  const fromChain = CHAIN_NAMES[plan.quote.action?.fromChainId] || 'Unknown';
  const toChain = CHAIN_NAMES[plan.quote.action?.toChainId] || 'Unknown';
  const totalTime = plan.steps.reduce((sum, s) => sum + s.estimatedTime, 0);
  
  return {
    route: `${fromChain} → ${toChain} via LI.FI`,
    estimatedTime: totalTime > 60 ? `${Math.round(totalTime / 60)} min` : `${totalTime} sec`,
    gasCost: `$${plan.gasCostUSD.toFixed(2)}`,
    netValue: `$${plan.netValueUSD.toFixed(2)}`,
    status: plan.readyToExecute ? 'READY' : 'NOT_READY',
    warnings: plan.warnings,
  };
}

// Helper to get token address
export function getTokenAddress(symbol: string, chainId: number): string | null {
  return TOKEN_ADDRESSES[symbol.toUpperCase()]?.[chainId] || null;
}
