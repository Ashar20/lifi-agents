// LI.FI Service Layer for Cross-Chain Operations
// Integrates LI.FI SDK for route discovery and execution

import { LiFi, Route, Quote, Chain, Token } from '@lifi/sdk';

const lifi = new LiFi({
  integrator: 'lifi-agents-orchestrator'
});

export interface LifiQuoteParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress?: string;
  toAddress?: string;
}

export interface LifiRouteStatus {
  routeId: string;
  status: 'PENDING' | 'DONE' | 'FAILED';
  txHash?: string;
  steps?: any[];
}

export const lifiService = {
  // Get available chains
  async getChains(): Promise<Chain[]> {
    try {
      const chains = await lifi.getChains();
      return chains;
    } catch (error) {
      console.error('Error fetching chains:', error);
      return [];
    }
  },

  // Get available tokens for a chain
  async getTokens(chainId: number): Promise<Token[]> {
    try {
      const tokens = await lifi.getTokens({ chainId });
      return tokens;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return [];
    }
  },

  // Get quote for cross-chain swap
  async getQuote(params: LifiQuoteParams): Promise<Quote | null> {
    try {
      const quote = await lifi.getQuote({
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
      });
      return quote;
    } catch (error) {
      console.error('Error getting quote:', error);
      return null;
    }
  },

  // Execute a cross-chain route
  async executeRoute(route: Route, signer: any): Promise<any> {
    try {
      const result = await lifi.executeRoute(route, signer);
      return result;
    } catch (error) {
      console.error('Error executing route:', error);
      throw error;
    }
  },

  // Get route status
  async getStatus(txHash: string): Promise<LifiRouteStatus | null> {
    try {
      const status = await lifi.getStatus({ txHash });
      return {
        routeId: status.routeId || '',
        status: status.status as 'PENDING' | 'DONE' | 'FAILED',
        txHash: status.txHash,
        steps: status.steps,
      };
    } catch (error) {
      console.error('Error getting status:', error);
      return null;
    }
  },

  // Get route by ID
  async getRoute(routeId: string): Promise<Route | null> {
    try {
      const route = await lifi.getRoute({ routeId });
      return route;
    } catch (error) {
      console.error('Error getting route:', error);
      return null;
    }
  },

  // Validate route safety
  async validateRoute(route: Route): Promise<{
    isValid: boolean;
    riskScore: number; // 0-100, lower is safer
    issues: string[];
  }> {
    const issues: string[] = [];
    let riskScore = 0;

    // Check slippage
    if (route.steps.some(step => step.estimate.slippage > 0.05)) {
      issues.push('High slippage detected (>5%)');
      riskScore += 30;
    }

    // Check gas costs
    const totalGas = route.steps.reduce((sum, step) => {
      return sum + (parseFloat(step.estimate.gasCosts?.[0]?.amount || '0'));
    }, 0);
    if (totalGas > 0.1) {
      issues.push('High gas costs detected');
      riskScore += 20;
    }

    // Check number of steps (more steps = more risk)
    if (route.steps.length > 3) {
      issues.push('Complex route with many steps');
      riskScore += 15;
    }

    // Check bridge reliability (simplified - in production, check bridge reputation)
    const bridges = route.steps.map(step => step.toolDetails?.name || 'Unknown');
    const uniqueBridges = new Set(bridges);
    if (uniqueBridges.size > 2) {
      issues.push('Multiple bridges required');
      riskScore += 10;
    }

    return {
      isValid: riskScore < 50,
      riskScore: Math.min(100, riskScore),
      issues,
    };
  },
};

// Make service available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).lifiService = lifiService;
  console.log('%c🌐 LI.FI SERVICE', 'color: #00d4ff; font-weight: bold; font-size: 14px;');
  console.log('%cUse these commands in console:', 'color: #00d4ff;');
  console.log('  lifiService.getChains() - Get available chains');
  console.log('  lifiService.getTokens(chainId) - Get tokens for a chain');
  console.log('  lifiService.getQuote(params) - Get cross-chain quote');
}
