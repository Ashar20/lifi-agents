// Strategy Loop: Monitor → Decide → Act
// Implements the core pattern required for LI.FI track

import { AgentMetadata } from '../types';
import { lifiService, LifiQuoteParams } from './lifi';
import { geminiService } from './api';

export interface StrategyState {
  agentId: string;
  timestamp: number;
  data: any;
}

export interface StrategyDecision {
  shouldAct: boolean;
  params?: LifiQuoteParams;
  route?: any;
  confidence: number;
  reasoning: string;
}

export class StrategyLoop {
  // Main execution: Monitor → Decide → Act
  async execute(agentId: string, agent: AgentMetadata): Promise<any> {
    try {
      // 1. MONITOR: Gather current state
      const state = await this.monitorState(agentId, agent);
      
      // 2. DECIDE: AI analyzes and decides action
      const decision = await this.decideAction(agentId, agent, state);
      
      // 3. ACT: Execute via LI.FI if decision is positive
      if (decision.shouldAct && decision.params) {
        const quote = await lifiService.getQuote(decision.params);
        if (quote) {
          return {
            success: true,
            quote,
            decision,
            state,
          };
        }
      }
      
      return {
        success: false,
        decision,
        state,
        message: decision.reasoning,
      };
    } catch (error) {
      console.error(`Strategy loop error for ${agentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Monitor state based on agent role
  private async monitorState(agentId: string, agent: AgentMetadata): Promise<StrategyState> {
    const state: StrategyState = {
      agentId,
      timestamp: Date.now(),
      data: {},
    };

    switch (agentId) {
      case 'a1': // Arbitrage Hunter
        state.data = await this.monitorPrices();
        break;
      case 'a2': // Portfolio Guardian
        state.data = await this.monitorPortfolio();
        break;
      case 'a3': // Yield Seeker
        state.data = await this.monitorYields();
        break;
      case 'a5': // Rebalancer
        state.data = await this.monitorAllocations();
        break;
      default:
        state.data = { status: 'monitoring' };
    }

    return state;
  }

  // AI-powered decision making
  private async decideAction(
    agentId: string,
    agent: AgentMetadata,
    state: StrategyState
  ): Promise<StrategyDecision> {
    const prompt = this.buildDecisionPrompt(agentId, agent, state);
    
    try {
      const aiResponse = await geminiService.chat({ prompt });
      return this.parseDecision(aiResponse.text, agentId, state);
    } catch (error) {
      console.error('AI decision error:', error);
      return {
        shouldAct: false,
        confidence: 0,
        reasoning: 'AI analysis unavailable',
      };
    }
  }

  // Build agent-specific decision prompts
  private buildDecisionPrompt(
    agentId: string,
    agent: AgentMetadata,
    state: StrategyState
  ): string {
    const basePrompt = `You are ${agent.name}, a ${agent.role} agent in a cross-chain DeFi orchestrator.
Current state: ${JSON.stringify(state.data)}

Analyze this state and decide if we should execute a cross-chain action via LI.FI.
Respond in JSON format:
{
  "shouldAct": true/false,
  "fromChain": chainId (number),
  "toChain": chainId (number),
  "fromToken": token address,
  "toToken": token address,
  "fromAmount": amount in wei (string),
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

    switch (agentId) {
      case 'a1': // Arbitrage Hunter
        return `${basePrompt}
Focus: Detect arbitrage opportunities. Only act if profit after fees > 0.5%.`;
      
      case 'a3': // Yield Seeker
        return `${basePrompt}
Focus: Find best yield opportunities. Only act if APY difference > 2%.`;
      
      case 'a5': // Rebalancer
        return `${basePrompt}
Focus: Maintain target allocations. Only act if drift > 5%.`;
      
      default:
        return basePrompt;
    }
  }

  // Parse AI response into decision
  private parseDecision(
    aiText: string,
    agentId: string,
    state: StrategyState
  ): StrategyDecision {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          shouldAct: parsed.shouldAct || false,
          params: parsed.shouldAct ? {
            fromChain: parsed.fromChain || 1,
            toChain: parsed.toChain || 42161,
            fromToken: parsed.fromToken || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            toToken: parsed.toToken || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            fromAmount: parsed.fromAmount || '1000000000', // 1000 USDC
          } : undefined,
          confidence: parsed.confidence || 50,
          reasoning: parsed.reasoning || 'AI analysis',
        };
      }
    } catch (error) {
      console.error('Failed to parse AI decision:', error);
    }

    // Fallback decision
    return {
      shouldAct: false,
      confidence: 0,
      reasoning: 'Could not parse AI response',
    };
  }

  // Real price monitoring - fetches actual DEX prices
  private async monitorPrices(): Promise<any> {
    try {
      const { detectArbitrageOpportunities, fetchCrossChainPrices } = await import('./priceFetcher');
      
      // Fetch real prices for USDC across chains
      const usdcPrices = await fetchCrossChainPrices('USDC');
      
      // Detect real arbitrage opportunities
      const opportunities = await detectArbitrageOpportunities('USDC', 0.3, 1000);
      
      // Format price data
      const priceMap: Record<string, number> = {};
      usdcPrices.forEach(p => {
        priceMap[p.chainName.toLowerCase()] = p.priceUSD;
      });
      
      return {
        prices: priceMap,
        opportunities: opportunities.map(opp => ({
          fromChain: opp.fromChain,
          fromChainName: opp.fromChainName,
          toChain: opp.toChain,
          toChainName: opp.toChainName,
          token: opp.tokenSymbol,
          profit: opp.profitAfterFees,
          priceDiff: opp.priceDifference,
          confidence: opp.confidence,
        })),
        timestamp: Date.now(),
        source: 'Real DEX prices',
      };
    } catch (error) {
      console.error('Price monitoring error:', error);
      // Fallback to empty data if API fails
      return {
        prices: {},
        opportunities: [],
        error: 'Price fetch failed',
      };
    }
  }

  private async monitorPortfolio(): Promise<any> {
    try {
      // Get wallet address from localStorage or use demo address
      const walletAddress = localStorage.getItem('trackedWalletAddress') || 
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Demo address
      
      const { getPortfolioSummary } = await import('./portfolioTracker');
      const portfolio = await getPortfolioSummary(walletAddress);
      
      return {
        positions: portfolio.positions.map(p => ({
          chainId: p.chainId,
          token: p.tokenSymbol,
          balance: p.balance.toString(),
          valueUSD: p.valueUSD,
        })),
        totalValue: portfolio.totalValueUSD,
        pnl: portfolio.pnl24h || 0,
        pnlPercent: portfolio.pnlPercent || 0,
        chains: portfolio.chains,
        tokenCount: portfolio.tokenCount,
        timestamp: portfolio.lastUpdated,
        source: 'Real blockchain data',
      };
    } catch (error) {
      console.error('Portfolio monitoring error:', error);
      return {
        positions: [],
        totalValue: 0,
        pnl: 0,
        error: 'Portfolio fetch failed',
      };
    }
  }

  private async monitorYields(): Promise<any> {
    try {
      const { getBestYieldOpportunities, getYieldComparison } = await import('./yieldFetcher');
      const opportunities = await getBestYieldOpportunities('USDC', undefined, 500000);
      const comparison = await getYieldComparison('USDC');
      
      return {
        opportunities: opportunities.slice(0, 10).map(opp => ({
          chainId: opp.chainId,
          chainName: opp.chainName,
          protocol: opp.protocol,
          token: opp.tokenSymbol,
          apy: opp.apy,
          tvl: opp.tvl,
          risk: opp.risk,
        })),
        bestOpportunity: comparison.bestOpportunity,
        averageApy: comparison.averageApy,
        timestamp: Date.now(),
        source: 'DeFiLlama real yield data',
      };
    } catch (error) {
      console.error('Yield monitoring error:', error);
      return {
        opportunities: [],
        error: 'Yield fetch failed',
      };
    }
  }

  private async monitorAllocations(): Promise<any> {
    try {
      const walletAddress = localStorage.getItem('trackedWalletAddress') || 
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      
      const { analyzePortfolioDrift } = await import('./rebalancer');
      const analysis = await analyzePortfolioDrift(walletAddress);
      
      const current: Record<string, number> = {};
      const target: Record<string, number> = {};
      
      analysis.allocations.forEach(a => {
        current[a.tokenSymbol] = Math.round(a.currentPercent);
        target[a.tokenSymbol] = a.targetPercent;
      });
      
      return {
        current,
        target,
        drift: analysis.totalDrift,
        needsRebalancing: analysis.needsRebalancing,
        actions: analysis.actions,
        totalValue: analysis.totalValueUSD,
        timestamp: analysis.timestamp,
        source: 'Real portfolio allocation data',
      };
    } catch (error) {
      console.error('Allocation monitoring error:', error);
      return {
        current: {},
        target: {},
        drift: 0,
        error: 'Allocation fetch failed',
      };
    }
  }
}

export const strategyLoop = new StrategyLoop();
