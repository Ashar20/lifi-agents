// Real Risk Analyzer for LI.FI Routes
// Validates routes for slippage, gas costs, bridge safety, etc.

import { lifiService } from './lifi';

export interface RiskAnalysis {
  isValid: boolean;
  riskScore: number; // 0-100, lower is safer
  status: 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGEROUS';
  slippage: number; // Expected slippage percentage
  gasCostUSD: number;
  estimatedTime: number; // In seconds
  bridgesUsed: string[];
  stepsCount: number;
  issues: string[];
  recommendations: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface RouteValidationParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress?: string;
}

// Validate a LI.FI route and return risk analysis
export async function analyzeRouteRisk(
  params: RouteValidationParams
): Promise<RiskAnalysis> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;
  
  try {
    // Get quote from LI.FI
    const quote = await lifiService.getQuote({
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress,
    });
    
    if (!quote) {
      return {
        isValid: false,
        riskScore: 100,
        status: 'DANGEROUS',
        slippage: 0,
        gasCostUSD: 0,
        estimatedTime: 0,
        bridgesUsed: [],
        stepsCount: 0,
        issues: ['No route available for this swap'],
        recommendations: ['Try a different token pair or amount'],
        confidence: 'low',
      };
    }
    
    // Extract route details
    const estimate = quote.estimate || {};
    const action = quote.action || {};
    
    // Calculate slippage
    const slippage = parseFloat(estimate.slippage || '0') * 100;
    if (slippage > 5) {
      issues.push(`High slippage: ${slippage.toFixed(2)}%`);
      riskScore += 30;
    } else if (slippage > 2) {
      issues.push(`Moderate slippage: ${slippage.toFixed(2)}%`);
      riskScore += 15;
    }
    
    // Calculate gas costs
    let gasCostUSD = 0;
    if (estimate.gasCosts && Array.isArray(estimate.gasCosts)) {
      gasCostUSD = estimate.gasCosts.reduce((sum: number, gas: any) => {
        return sum + parseFloat(gas.amountUSD || '0');
      }, 0);
    }
    
    if (gasCostUSD > 50) {
      issues.push(`High gas costs: $${gasCostUSD.toFixed(2)}`);
      riskScore += 20;
    } else if (gasCostUSD > 20) {
      issues.push(`Moderate gas costs: $${gasCostUSD.toFixed(2)}`);
      riskScore += 10;
    }
    
    // Check execution time
    const estimatedTime = parseInt(estimate.executionDuration || '0');
    if (estimatedTime > 1800) { // > 30 minutes
      issues.push(`Long execution time: ${Math.round(estimatedTime / 60)} minutes`);
      riskScore += 15;
      recommendations.push('Consider waiting for lower network congestion');
    }
    
    // Analyze bridges used
    const bridgesUsed: string[] = [];
    const stepsCount = quote.includedSteps?.length || 1;
    
    if (quote.includedSteps) {
      quote.includedSteps.forEach((step: any) => {
        if (step.toolDetails?.name) {
          bridgesUsed.push(step.toolDetails.name);
        }
      });
    }
    
    // Risk based on number of steps
    if (stepsCount > 4) {
      issues.push(`Complex route with ${stepsCount} steps`);
      riskScore += 20;
      recommendations.push('Consider a simpler route with fewer steps');
    } else if (stepsCount > 2) {
      issues.push(`Multi-step route: ${stepsCount} steps`);
      riskScore += 10;
    }
    
    // Risk based on bridges
    const uniqueBridges = new Set(bridgesUsed);
    if (uniqueBridges.size > 2) {
      issues.push(`Multiple bridges: ${Array.from(uniqueBridges).join(', ')}`);
      riskScore += 15;
    }
    
    // Cross-chain specific risks
    if (params.fromChain !== params.toChain) {
      riskScore += 10; // Base risk for cross-chain
      recommendations.push('Cross-chain swaps have inherent bridge risks');
    }
    
    // Amount-based risk
    const amountUSD = parseFloat(estimate.fromAmountUSD || '0');
    if (amountUSD > 100000) {
      issues.push('Large transaction amount increases risk');
      riskScore += 10;
      recommendations.push('Consider splitting into smaller transactions');
    }
    
    // Determine status and confidence
    let status: RiskAnalysis['status'];
    let confidence: RiskAnalysis['confidence'];
    
    if (riskScore <= 20) {
      status = 'SAFE';
      confidence = 'high';
    } else if (riskScore <= 40) {
      status = 'CAUTION';
      confidence = 'medium';
    } else if (riskScore <= 60) {
      status = 'RISKY';
      confidence = 'medium';
    } else {
      status = 'DANGEROUS';
      confidence = 'low';
    }
    
    // Add positive notes if applicable
    if (issues.length === 0) {
      recommendations.push('Route appears optimal for this swap');
    }
    
    if (slippage < 0.5) {
      recommendations.push('Low slippage - good execution price expected');
    }
    
    return {
      isValid: riskScore < 70,
      riskScore: Math.min(100, riskScore),
      status,
      slippage,
      gasCostUSD,
      estimatedTime,
      bridgesUsed: Array.from(uniqueBridges),
      stepsCount,
      issues,
      recommendations,
      confidence,
    };
  } catch (error: any) {
    console.error('Route risk analysis error:', error);
    return {
      isValid: false,
      riskScore: 100,
      status: 'DANGEROUS',
      slippage: 0,
      gasCostUSD: 0,
      estimatedTime: 0,
      bridgesUsed: [],
      stepsCount: 0,
      issues: [`Analysis failed: ${error.message}`],
      recommendations: ['Try again or check network connectivity'],
      confidence: 'low',
    };
  }
}

// Quick risk check for a route
export async function quickRiskCheck(
  fromChain: number,
  toChain: number,
  amount: string
): Promise<{
  safe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  message: string;
}> {
  // USDC addresses for common chains
  const usdcAddresses: Record<number, string> = {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  };
  
  const fromToken = usdcAddresses[fromChain];
  const toToken = usdcAddresses[toChain];
  
  if (!fromToken || !toToken) {
    return {
      safe: false,
      riskLevel: 'high',
      message: 'Unsupported chain for quick check',
    };
  }
  
  const analysis = await analyzeRouteRisk({
    fromChain,
    toChain,
    fromToken,
    toToken,
    fromAmount: amount,
  });
  
  return {
    safe: analysis.isValid,
    riskLevel: analysis.riskScore <= 30 ? 'low' : analysis.riskScore <= 60 ? 'medium' : 'high',
    message: analysis.issues.length > 0 ? analysis.issues[0] : 'Route is safe',
  };
}
