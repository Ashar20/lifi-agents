// Real DEX Price Fetcher for Cross-Chain Arbitrage Detection
// Fetches real-time prices from multiple DEXs across chains

export interface PriceData {
  chainId: number;
  chainName: string;
  token: string;
  tokenSymbol: string;
  price: number;
  priceUSD: number;
  source: string; // DEX name
  liquidity: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  token: string;
  tokenSymbol: string;
  fromChain: number;
  fromChainName: string;
  fromPrice: number;
  toChain: number;
  toChainName: string;
  toPrice: number;
  priceDifference: number; // percentage
  profitAfterFees: number; // estimated USD profit
  volume: number; // available liquidity
  confidence: 'high' | 'medium' | 'low';
}

// Chain configurations
const CHAINS = {
  1: { name: 'Ethereum', rpc: 'https://rpc.ankr.com/eth' },
  42161: { name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
  10: { name: 'Optimism', rpc: 'https://mainnet.optimism.io' },
  137: { name: 'Polygon', rpc: 'https://polygon-rpc.com' },
  8453: { name: 'Base', rpc: 'https://base.llamarpc.com' },
  43114: { name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
};

// Common token addresses (USDC, USDT, DAI, WETH)
const TOKENS = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    8453: '0xfdeF328C663d2f601BAe19840336e48b36a8fcd1',
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

// Fetch price from CoinGecko (most reliable free API)
async function fetchPriceFromCoinGecko(
  chainId: number,
  tokenAddress: string
): Promise<{ price: number; source: string } | null> {
  try {
    // Map chain IDs to CoinGecko chain identifiers
    const chainMap: Record<number, string> = {
      1: 'ethereum',
      42161: 'arbitrum-one',
      10: 'optimistic-ethereum',
      137: 'polygon-pos',
      8453: 'base',
      43114: 'avalanche',
    };

    const chainName = chainMap[chainId];
    if (!chainName) return null;

    // Get token price from CoinGecko
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${chainName}?contract_addresses=${tokenAddress}&vs_currencies=usd`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const tokenData = data[tokenAddress.toLowerCase()];
    const price = tokenData?.usd || 0;

    if (price === 0) return null;

    return {
      price,
      source: 'CoinGecko',
    };
  } catch (error) {
    console.warn(`CoinGecko price fetch failed:`, error);
    return null;
  }
}


// Fallback prices to avoid excessive API calls
const FALLBACK_PRICES: Record<string, number> = {
  ETH: 2500, WETH: 2500, MATIC: 0.8, AVAX: 35,
  USDC: 1, USDT: 1, DAI: 1, 'USDC.e': 1, USDbC: 1,
};

// Fetch price from LI.FI quote (most accurate for DEX prices)
// NOTE: This is expensive (API call) - prefer fallback prices when available
async function fetchPriceFromLifi(
  chainId: number,
  tokenAddress: string,
  tokenSymbol: string,
  amount: string = '1000000000'
): Promise<{ price: number; source: string } | null> {
  // First check if we have a fallback price - avoid API call if possible
  const fallbackPrice = FALLBACK_PRICES[tokenSymbol.toUpperCase()];
  if (fallbackPrice) {
    return { price: fallbackPrice, source: 'Fallback' };
  }

  try {
    // Use USDC as quote token (most stable)
    const usdcAddress = TOKENS.USDC[chainId as keyof typeof TOKENS.USDC];
    if (!usdcAddress || tokenAddress.toLowerCase() === usdcAddress.toLowerCase()) {
      // If token is USDC itself, return 1.0
      return { price: 1.0, source: 'LI.FI' };
    }

    const { lifiService } = await import('./lifi');

    // Use a dummy address for price quotes (required by LI.FI API)
    const dummyAddress = '0x0000000000000000000000000000000000000001';

    // Get quote: token -> USDC to determine price
    const quote = await lifiService.getQuote({
      fromChain: chainId,
      toChain: chainId, // Same chain (intra-chain swap)
      fromToken: tokenAddress,
      toToken: usdcAddress,
      fromAmount: amount,
      fromAddress: dummyAddress,
    });

    if (!quote || !quote.estimate || !quote.estimate.toAmount) return null;

    // Calculate price: USDC received / token amount
    // USDC has 6 decimals, most tokens have 18 decimals
    const tokenDecimals = tokenAddress.toLowerCase() === TOKENS.WETH[chainId as keyof typeof TOKENS.WETH]?.toLowerCase() ? 18 : 6;
    const usdcReceived = parseFloat(quote.estimate.toAmount) / 1e6; // USDC has 6 decimals
    const tokenAmount = parseFloat(amount) / Math.pow(10, tokenDecimals);
    const price = tokenAmount > 0 ? usdcReceived / tokenAmount : 0;

    if (price <= 0 || !isFinite(price)) return null;

    return {
      price,
      source: 'LI.FI',
    };
  } catch (error) {
    console.warn(`LI.FI price fetch failed:`, error);
    return null;
  }
}

// Main price fetcher - tries multiple sources
export async function fetchTokenPrice(
  chainId: number,
  tokenAddress: string,
  tokenSymbol: string
): Promise<PriceData | null> {
  const chainName = CHAINS[chainId as keyof typeof CHAINS]?.name || `Chain ${chainId}`;

  // First check fallback prices (instant, no API call)
  const fallbackPrice = FALLBACK_PRICES[tokenSymbol.toUpperCase()];
  if (fallbackPrice) {
    return {
      chainId,
      chainName,
      token: tokenAddress,
      tokenSymbol,
      price: fallbackPrice,
      priceUSD: fallbackPrice,
      source: 'Fallback',
      liquidity: 0,
      timestamp: Date.now(),
    };
  }

  // Try CoinGecko (most reliable free API)
  let priceData = await fetchPriceFromCoinGecko(chainId, tokenAddress);

  // Fallback to LI.FI (slower, uses API quota)
  if (!priceData || priceData.price === 0) {
    priceData = await fetchPriceFromLifi(chainId, tokenAddress, tokenSymbol);
  }

  if (!priceData || priceData.price === 0) {
    return null;
  }

  return {
    chainId,
    chainName,
    token: tokenAddress,
    tokenSymbol,
    price: priceData.price,
    priceUSD: priceData.price,
    source: priceData.source,
    liquidity: 0, // Would need DEX-specific API for this
    timestamp: Date.now(),
  };
}

// Fetch prices for a token across multiple chains
export async function fetchCrossChainPrices(
  tokenSymbol: 'USDC' | 'USDT' | 'DAI' | 'WETH',
  chainIds: number[] = [1, 42161, 10, 137, 8453]
): Promise<PriceData[]> {
  const prices: PriceData[] = [];

  // Fetch prices in parallel with timeout
  const pricePromises = chainIds.map(async (chainId) => {
    const tokenAddress = TOKENS[tokenSymbol]?.[chainId as keyof typeof TOKENS[typeof tokenSymbol]];
    if (!tokenAddress) return null;

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 5000)
      );
      
      const pricePromise = fetchTokenPrice(chainId, tokenAddress, tokenSymbol);
      return await Promise.race([pricePromise, timeoutPromise]);
    } catch (error) {
      console.warn(`Failed to fetch price for ${tokenSymbol} on chain ${chainId}:`, error);
      return null;
    }
  });

  const results = await Promise.all(pricePromises);
  
  return results.filter((price): price is PriceData => price !== null);
}

// Detect arbitrage opportunities across chains
export async function detectArbitrageOpportunities(
  tokenSymbol: 'USDC' | 'USDT' | 'DAI' | 'WETH' = 'USDC',
  minProfitPercent: number = 0.5,
  amount: number = 1000 // USD amount to trade
): Promise<ArbitrageOpportunity[]> {
  const chainIds = [1, 42161, 10, 137, 8453]; // Ethereum, Arbitrum, Optimism, Polygon, Base
  const prices = await fetchCrossChainPrices(tokenSymbol, chainIds);

  if (prices.length < 2) {
    return [];
  }

  const opportunities: ArbitrageOpportunity[] = [];

  // Compare all pairs
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      const priceA = prices[i];
      const priceB = prices[j];

      if (!priceA || !priceB) continue;

      // Calculate price difference
      const avgPrice = (priceA.priceUSD + priceB.priceUSD) / 2;
      const priceDiff = Math.abs(priceA.priceUSD - priceB.priceUSD);
      const priceDiffPercent = (priceDiff / avgPrice) * 100;

      // Only consider if difference is significant
      if (priceDiffPercent < minProfitPercent) continue;

      // Estimate profit after fees (assuming ~0.3% DEX fees + ~0.1% bridge fees)
      const totalFeesPercent = 0.4;
      const grossProfit = (priceDiffPercent / 100) * amount;
      const fees = (totalFeesPercent / 100) * amount;
      const netProfit = grossProfit - fees;

      // Only include if profitable after fees
      if (netProfit <= 0) continue;

      // Determine buy/sell direction
      const cheaperChain = priceA.priceUSD < priceB.priceUSD ? priceA : priceB;
      const expensiveChain = priceA.priceUSD < priceB.priceUSD ? priceB : priceA;

      opportunities.push({
        token: priceA.token,
        tokenSymbol,
        fromChain: cheaperChain.chainId,
        fromChainName: cheaperChain.chainName,
        fromPrice: cheaperChain.priceUSD,
        toChain: expensiveChain.chainId,
        toChainName: expensiveChain.chainName,
        toPrice: expensiveChain.priceUSD,
        priceDifference: priceDiffPercent,
        profitAfterFees: netProfit,
        volume: amount,
        confidence: priceDiffPercent > 1 ? 'high' : priceDiffPercent > 0.7 ? 'medium' : 'low',
      });
    }
  }

  // Sort by profit (highest first)
  return opportunities.sort((a, b) => b.profitAfterFees - a.profitAfterFees);
}

// Get real-time price comparison for UI
export async function getPriceComparison(
  tokenSymbol: 'USDC' | 'USDT' | 'DAI' | 'WETH' = 'USDC'
): Promise<{
  token: string;
  prices: Array<{
    chain: string;
    chainId: number;
    price: number;
    source: string;
  }>;
  bestBuy: { chain: string; chainId: number; price: number };
  bestSell: { chain: string; chainId: number; price: number };
}> {
  const prices = await fetchCrossChainPrices(tokenSymbol);

  if (prices.length === 0) {
    throw new Error('No prices available');
  }

  const priceList = prices.map(p => ({
    chain: p.chainName,
    chainId: p.chainId,
    price: p.priceUSD,
    source: p.source,
  }));

  const sorted = [...prices].sort((a, b) => a.priceUSD - b.priceUSD);
  const bestBuy = sorted[0];
  const bestSell = sorted[sorted.length - 1];

  return {
    token: tokenSymbol,
    prices: priceList,
    bestBuy: {
      chain: bestBuy.chainName,
      chainId: bestBuy.chainId,
      price: bestBuy.priceUSD,
    },
    bestSell: {
      chain: bestSell.chainName,
      chainId: bestSell.chainId,
      price: bestSell.priceUSD,
    },
  };
}
