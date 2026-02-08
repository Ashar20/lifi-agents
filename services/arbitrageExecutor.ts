// Cross-Chain Arbitrage Executor - Real execution via LI.FI
// NO MOCKS - Real swaps and bridges on testnet/mainnet
// SDK v2: executeRoute(signer, route, settings) - https://docs.li.fi/sdk/execute-routes

import { convertQuoteToRoute } from '@lifi/sdk';
import { Web3Provider } from '@ethersproject/providers';
import { createPublicClient, http, formatUnits, parseUnits, Address, erc20Abi } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, sepolia, arbitrumSepolia, optimismSepolia, baseSepolia } from 'viem/chains';
import { ArbitrageOpportunity, detectArbitrageOpportunities } from './priceFetcher';
import { transactionHistory, getExplorerUrl } from './transactionHistory';
import { lifiService, lifi } from './lifi';

// Chain configurations
export const CHAINS = {
  mainnet: [
    { id: 1, name: 'Ethereum', chain: mainnet, rpc: 'https://rpc.ankr.com/eth', explorer: 'https://etherscan.io' },
    { id: 42161, name: 'Arbitrum', chain: arbitrum, rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
    { id: 10, name: 'Optimism', chain: optimism, rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io' },
    { id: 137, name: 'Polygon', chain: polygon, rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com' },
    { id: 8453, name: 'Base', chain: base, rpc: 'https://base.llamarpc.com', explorer: 'https://basescan.org' },
  ],
  testnet: [
    { id: 11155111, name: 'Sepolia', chain: sepolia, rpc: 'https://rpc.sepolia.org', explorer: 'https://sepolia.etherscan.io' },
    { id: 421614, name: 'Arbitrum Sepolia', chain: arbitrumSepolia, rpc: 'https://sepolia-rollup.arbitrum.io/rpc', explorer: 'https://sepolia.arbiscan.io' },
    { id: 11155420, name: 'Optimism Sepolia', chain: optimismSepolia, rpc: 'https://sepolia.optimism.io', explorer: 'https://sepolia-optimism.etherscan.io' },
    { id: 84532, name: 'Base Sepolia', chain: baseSepolia, rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org' },
  ],
};

// Token addresses for arbitrage
export const ARBITRAGE_TOKENS: Record<number, Record<string, { address: Address; decimals: number }>> = {
  // Mainnet
  1: {
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  },
  42161: {
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    'USDC.e': { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
  },
  10: {
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    'USDC.e': { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6 },
    USDT: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  },
  137: {
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    'USDC.e': { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  },
  8453: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  },
  // Testnet
  11155111: {
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  },
  421614: {
    USDC: { address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', decimals: 6 },
    WETH: { address: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73', decimals: 18 },
  },
  11155420: {
    USDC: { address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', decimals: 6 },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  },
  84532: {
    USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6 },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  },
};

export interface ArbitrageExecutionPlan {
  opportunity: ArbitrageOpportunity;
  inputToken: string;           // Token we start with (usually USDC)
  inputAmount: string;          // Amount in smallest unit
  inputAmountFormatted: string;
  expectedProfit: number;       // USD
  gasCostEstimate: number;      // USD
  netProfit: number;            // USD after gas
  route: any | null;            // LI.FI route
  steps: ArbitrageStep[];
}

export interface ArbitrageStep {
  step: number;
  action: 'buy' | 'bridge' | 'sell';
  chainId: number;
  chainName: string;
  fromToken: string;
  toToken: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  txHash?: string;
}

export interface ExecutionResult {
  success: boolean;
  plan: ArbitrageExecutionPlan;
  txHashes: string[];
  actualProfit?: number;
  error?: string;
  timestamp: number;
}

// Get public client for a chain
function getPublicClient(chainId: number) {
  const allChains = [...CHAINS.mainnet, ...CHAINS.testnet];
  const chainConfig = allChains.find(c => c.id === chainId);
  
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  
  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc),
  });
}

// Get token balance
export async function getTokenBalance(
  walletAddress: Address,
  chainId: number,
  tokenSymbol: string
): Promise<{ balance: bigint; formatted: string; decimals: number }> {
  const tokens = ARBITRAGE_TOKENS[chainId];
  if (!tokens || !tokens[tokenSymbol]) {
    throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}`);
  }
  
  const token = tokens[tokenSymbol];
  const client = getPublicClient(chainId);
  
  const balance = await client.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  
  return {
    balance,
    formatted: formatUnits(balance, token.decimals),
    decimals: token.decimals,
  };
}

// Scan for live arbitrage opportunities
export async function scanArbitrageOpportunities(
  tokenSymbol: 'USDC' | 'USDT' | 'WETH' = 'USDC',
  minProfitPercent: number = 0.3,
  tradeAmount: number = 1000
): Promise<ArbitrageOpportunity[]> {
  console.log(`[Arbitrage] Scanning ${tokenSymbol} across chains for >${minProfitPercent}% opportunities...`);
  
  const opportunities = await detectArbitrageOpportunities(
    tokenSymbol,
    minProfitPercent,
    tradeAmount
  );
  
  console.log(`[Arbitrage] Found ${opportunities.length} opportunities`);
  return opportunities;
}

// Create an execution plan for an arbitrage opportunity
export async function createArbitragePlan(
  opportunity: ArbitrageOpportunity,
  walletAddress: Address,
  inputAmount: string, // In USDC (or base token), smallest unit
  inputToken: string = 'USDC'
): Promise<ArbitrageExecutionPlan | null> {
  console.log(`[Arbitrage] Creating plan for ${opportunity.tokenSymbol} arb: ${opportunity.fromChainName} → ${opportunity.toChainName}`);
  
  const fromChainTokens = ARBITRAGE_TOKENS[opportunity.fromChain];
  const toChainTokens = ARBITRAGE_TOKENS[opportunity.toChain];
  
  if (!fromChainTokens || !toChainTokens) {
    console.error('[Arbitrage] Chain tokens not configured');
    return null;
  }
  
  const sourceToken = fromChainTokens[inputToken];
  const destToken = toChainTokens[inputToken];
  
  if (!sourceToken || !destToken) {
    console.error(`[Arbitrage] Token ${inputToken} not found on chains`);
    return null;
  }
  
  // The arbitrage flow:
  // 1. We have USDC on the "from" chain (where token is cheaper)
  // 2. Buy the arbitrage token on from chain
  // 3. Bridge token to "to" chain (where it's more expensive)
  // 4. Sell for USDC on to chain
  // 5. Result: More USDC than we started with
  
  // LI.FI can do this in a combined route!
  // From: USDC on fromChain
  // To: USDC on toChain
  // The route will automatically find the best path including swaps and bridges
  
  try {
    // Use lifiService (Arc/CCTP for USDC routes) instead of direct lifi.getQuote
    const quote = await lifiService.getQuote({
      fromChain: opportunity.fromChain,
      toChain: opportunity.toChain,
      fromToken: sourceToken.address,
      toToken: destToken.address,
      fromAmount: inputAmount,
      fromAddress: walletAddress,
      toAddress: walletAddress,
    });
    
    if (!quote) {
      console.error('[Arbitrage] No route found');
      return null;
    }
    
    // Calculate costs and profits
    const inputFormatted = formatUnits(BigInt(inputAmount), sourceToken.decimals);
    const outputAmount = quote.estimate?.toAmount || '0';
    const outputFormatted = formatUnits(BigInt(outputAmount), destToken.decimals);
    
    const inputUsd = parseFloat(inputFormatted);
    const outputUsd = parseFloat(outputFormatted);
    const grossProfit = outputUsd - inputUsd;
    
    // Gas costs
    let gasCostUsd = 0;
    if (quote.estimate?.gasCosts) {
      gasCostUsd = quote.estimate.gasCosts.reduce((sum: number, cost: any) => {
        return sum + parseFloat(cost.amountUSD || '0');
      }, 0);
    }
    
    const netProfit = grossProfit - gasCostUsd;
    
    // Build steps breakdown
    const steps: ArbitrageStep[] = [];
    let stepNum = 1;
    
    // Parse LI.FI route steps
    if (quote.includedSteps) {
      for (const step of quote.includedSteps) {
        const isSwap = step.type === 'swap';
        const isBridge = step.type === 'cross' || step.type === 'bridge';
        
        steps.push({
          step: stepNum++,
          action: isBridge ? 'bridge' : (stepNum === 2 ? 'buy' : 'sell'),
          chainId: step.action?.fromChainId || opportunity.fromChain,
          chainName: isBridge ? `${opportunity.fromChainName} → ${opportunity.toChainName}` : 
                    (stepNum === 2 ? opportunity.fromChainName : opportunity.toChainName),
          fromToken: step.action?.fromToken?.symbol || inputToken,
          toToken: step.action?.toToken?.symbol || inputToken,
          description: isBridge ? 
            `Bridge via ${step.toolDetails?.name || 'bridge'}` :
            `Swap on ${step.toolDetails?.name || 'DEX'}`,
          status: 'pending',
        });
      }
    }
    
    // If no steps parsed, create generic steps
    if (steps.length === 0) {
      steps.push(
        {
          step: 1,
          action: 'buy',
          chainId: opportunity.fromChain,
          chainName: opportunity.fromChainName,
          fromToken: inputToken,
          toToken: opportunity.tokenSymbol,
          description: `Swap ${inputToken} → ${opportunity.tokenSymbol}`,
          status: 'pending',
        },
        {
          step: 2,
          action: 'bridge',
          chainId: opportunity.fromChain,
          chainName: `${opportunity.fromChainName} → ${opportunity.toChainName}`,
          fromToken: opportunity.tokenSymbol,
          toToken: opportunity.tokenSymbol,
          description: `Bridge ${opportunity.tokenSymbol} cross-chain`,
          status: 'pending',
        },
        {
          step: 3,
          action: 'sell',
          chainId: opportunity.toChain,
          chainName: opportunity.toChainName,
          fromToken: opportunity.tokenSymbol,
          toToken: inputToken,
          description: `Swap ${opportunity.tokenSymbol} → ${inputToken}`,
          status: 'pending',
        }
      );
    }
    
    return {
      opportunity,
      inputToken,
      inputAmount,
      inputAmountFormatted: inputFormatted,
      expectedProfit: grossProfit,
      gasCostEstimate: gasCostUsd,
      netProfit,
      route: quote,
      steps,
    };
    
  } catch (error: any) {
    console.error('[Arbitrage] Quote error:', error);
    return null;
  }
}

// Execute the arbitrage plan
export async function executeArbitrage(
  plan: ArbitrageExecutionPlan,
  walletClient: any, // Wagmi wallet client
  onStatusUpdate?: (status: string, step?: ArbitrageStep) => void
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    success: false,
    plan,
    txHashes: [],
    timestamp: Date.now(),
  };
  
  // Create pending transaction record
  const tx = transactionHistory.addTransaction({
    walletAddress: plan.walletAddress as Address,
    type: 'arbitrage',
    status: 'pending',
    fromChainId: plan.opportunity.fromChain,
    fromChainName: plan.opportunity.fromChainName,
    toChainId: plan.opportunity.toChain,
    toChainName: plan.opportunity.toChainName,
    fromToken: plan.inputToken,
    fromAmount: plan.inputAmountFormatted,
    fromAmountUsd: parseFloat(plan.inputAmountFormatted) * (plan.opportunity.fromPrice || 1),
    toToken: plan.inputToken,
    gasCostUsd: plan.gasCostUsd,
    profitUsd: plan.netProfit,
    protocol: 'LI.FI',
    route: `${plan.opportunity.fromChainName} → ${plan.opportunity.toChainName}`,
    metadata: {
      priceDifference: plan.opportunity.priceDifference,
      fromPrice: plan.opportunity.fromPrice,
      toPrice: plan.opportunity.toPrice,
    },
  });
  
  if (!plan.route) {
    result.error = 'No route available';
    transactionHistory.updateTransaction(tx.id, {
      status: 'failed',
      error: 'No route available',
    });
    return result;
  }
  
  console.log('[Arbitrage] Starting execution...');
  onStatusUpdate?.('Starting arbitrage execution...', plan.steps[0]);
  
  try {
    // Update first step to executing
    if (plan.steps.length > 0) {
      plan.steps[0].status = 'executing';
    }
    
    transactionHistory.updateTransaction(tx.id, { status: 'confirming' });
    
    // Get ethers Signer (SDK v2 requires Signer, not walletClient)
    const ethereum = (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
    if (!ethereum) {
      throw new Error('No wallet found. Please connect MetaMask or another Web3 wallet.');
    }
    const provider = new Web3Provider(ethereum);
    let signer = provider.getSigner();
    
    // Convert quote (LifiStep) to Route - SDK v2 getQuote returns LifiStep
    const route = convertQuoteToRoute(plan.route);
    
    // Execute via LI.FI SDK - correct signature: executeRoute(signer, route, settings)
    const execution = await lifi.executeRoute(signer, route, {
      updateRouteHook(updatedRoute: any) {
        const currentStep = updatedRoute.steps?.findIndex((s: any) => 
          s.execution?.status === 'PENDING' || s.execution?.status === 'ACTION_REQUIRED'
        );
        
        if (currentStep !== undefined && currentStep >= 0 && plan.steps[currentStep]) {
          plan.steps[currentStep].status = 'executing';
          const stepExecution = updatedRoute.steps[currentStep]?.execution;
          if (stepExecution?.txHash) {
            plan.steps[currentStep].txHash = stepExecution.txHash;
          }
          onStatusUpdate?.(`Executing step ${currentStep + 1}...`, plan.steps[currentStep]);
        }
        
        updatedRoute.steps?.forEach((s: any, i: number) => {
          if (s.execution?.status === 'DONE' && plan.steps[i]) {
            plan.steps[i].status = 'completed';
            if (s.execution.txHash) {
              plan.steps[i].txHash = s.execution.txHash;
            }
          }
        });
      },
      switchChainHook: async (chainId: number) => {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + chainId.toString(16) }],
        });
        const newProvider = new Web3Provider(ethereum);
        signer = newProvider.getSigner();
        return signer as any;
      },
      acceptExchangeRateUpdateHook: async () => true,
    });
    
    // Mark all steps completed
    plan.steps.forEach(s => {
      if (s.status !== 'failed') {
        s.status = 'completed';
      }
    });
    
    // Get final tx hash
    const finalTxHash = execution.steps?.[execution.steps.length - 1]?.execution?.txHash;
    if (finalTxHash && !result.txHashes.includes(finalTxHash)) {
      result.txHashes.push(finalTxHash);
    }
    
    // Calculate actual profit
    if (execution.estimate?.toAmount) {
      const outputFormatted = formatUnits(
        BigInt(execution.estimate.toAmount),
        ARBITRAGE_TOKENS[plan.opportunity.toChain]?.[plan.inputToken]?.decimals || 6
      );
      result.actualProfit = parseFloat(outputFormatted) - parseFloat(plan.inputAmountFormatted);
    }
    
    result.success = true;
    
    // Update transaction as completed
    transactionHistory.updateTransaction(tx.id, {
      status: 'completed',
      txHash: finalTxHash,
      explorerUrl: finalTxHash ? getExplorerUrl(plan.opportunity.toChain, finalTxHash) : undefined,
      profitUsd: result.actualProfit || plan.netProfit,
    });
    
    onStatusUpdate?.(`✅ Arbitrage complete! Profit: $${(result.actualProfit || plan.netProfit).toFixed(2)}`);
    
  } catch (error: any) {
    console.error('[Arbitrage] Execution error:', error);
    
    // Update transaction as failed
    transactionHistory.updateTransaction(tx.id, {
      status: 'failed',
      error: error.message || 'Transaction failed',
    });
    result.error = error.message || 'Execution failed';
    
    // Mark current step as failed
    const executingStep = plan.steps.find(s => s.status === 'executing');
    if (executingStep) {
      executingStep.status = 'failed';
    }
    
    onStatusUpdate?.(`❌ Arbitrage failed: ${result.error}`);
  }
  
  return result;
}

// One-click arbitrage: scan + plan + execute
export async function oneClickArbitrage(
  walletAddress: Address,
  walletClient: any,
  options: {
    sourceChainId?: number;        // Chain where user has funds
    inputToken?: string;           // Token to use (default: USDC)
    inputAmount?: string;          // Amount in smallest unit
    minProfitPercent?: number;     // Minimum profit threshold
    maxGasCost?: number;           // Maximum gas cost in USD
    onStatusUpdate?: (status: string) => void;
  } = {}
): Promise<ExecutionResult | { success: false; error: string }> {
  const {
    sourceChainId,
    inputToken = 'USDC',
    inputAmount,
    minProfitPercent = 0.3,
    maxGasCost = 20,
    onStatusUpdate,
  } = options;
  
  try {
    onStatusUpdate?.('Scanning for arbitrage opportunities...');
    
    // Scan for opportunities
    const opportunities = await scanArbitrageOpportunities(
      inputToken as any,
      minProfitPercent,
      parseFloat(inputAmount || '1000000000') / 1e6 // Convert to USD
    );
    
    if (opportunities.length === 0) {
      return {
        success: false,
        error: `No arbitrage opportunities found with >${minProfitPercent}% profit`,
      };
    }
    
    // Filter by source chain if specified
    let bestOpportunity = opportunities[0];
    if (sourceChainId) {
      const filtered = opportunities.filter(o => o.fromChain === sourceChainId);
      if (filtered.length === 0) {
        return {
          success: false,
          error: `No opportunities found originating from your chain`,
        };
      }
      bestOpportunity = filtered[0];
    }
    
    onStatusUpdate?.(`Found opportunity: ${bestOpportunity.priceDifference.toFixed(2)}% on ${bestOpportunity.tokenSymbol}`);
    
    // Get user balance if amount not specified
    let tradeAmount = inputAmount;
    if (!tradeAmount) {
      const balance = await getTokenBalance(walletAddress, bestOpportunity.fromChain, inputToken);
      if (balance.balance === 0n) {
        return {
          success: false,
          error: `No ${inputToken} balance on ${bestOpportunity.fromChainName}`,
        };
      }
      tradeAmount = balance.balance.toString();
      onStatusUpdate?.(`Using balance: ${balance.formatted} ${inputToken}`);
    }
    
    // Create execution plan
    onStatusUpdate?.('Creating execution plan...');
    const plan = await createArbitragePlan(
      bestOpportunity,
      walletAddress,
      tradeAmount,
      inputToken
    );
    
    if (!plan) {
      return {
        success: false,
        error: 'Could not create execution plan - no route found',
      };
    }
    
    // Check gas cost
    if (plan.gasCostEstimate > maxGasCost) {
      return {
        success: false,
        error: `Gas cost ($${plan.gasCostEstimate.toFixed(2)}) exceeds limit ($${maxGasCost})`,
      };
    }
    
    // Check profitability
    if (plan.netProfit <= 0) {
      return {
        success: false,
        error: `Trade not profitable after gas costs`,
      };
    }
    
    onStatusUpdate?.(`Expected profit: $${plan.netProfit.toFixed(2)} (after $${plan.gasCostEstimate.toFixed(2)} gas)`);
    
    // Execute
    const result = await executeArbitrage(plan, walletClient, onStatusUpdate);
    return result;
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).arbitrageExecutor = {
    scanArbitrageOpportunities,
    createArbitragePlan,
    executeArbitrage,
    oneClickArbitrage,
    getTokenBalance,
    CHAINS,
    ARBITRAGE_TOKENS,
  };
  console.log('%c⚡ ARBITRAGE EXECUTOR', 'color: #00ffff; font-weight: bold; font-size: 14px;');
  console.log('  arbitrageExecutor.scanArbitrageOpportunities() - Find opportunities');
  console.log('  arbitrageExecutor.oneClickArbitrage(address, wallet) - Execute best arb');
}
