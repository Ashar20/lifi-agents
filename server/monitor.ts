// Background Monitor - Scans for opportunities and triggers notifications
// Runs server-side, independent of browser

import { Server as SocketServer } from 'socket.io';
import { NotificationService } from './notifications';

// Types
interface RegisteredUser {
  walletAddress: string;
  email?: string;
  pushSubscription?: PushSubscription;
  settings: {
    yieldAlerts: boolean;
    arbitrageAlerts: boolean;
    minApyImprovement: number;
    minArbProfit: number;
    autoExecute: boolean;
  };
  lastNotified: number;
}

interface YieldOpportunity {
  chainId: number;
  chainName: string;
  protocol: string;
  token: string;
  apy: number;
  tvl: number;
}

interface ArbitrageOpportunity {
  tokenSymbol: string;
  fromChain: string;
  toChain: string;
  priceDifference: number;
  profitAfterFees: number;
}

interface MonitorStats {
  isRunning: boolean;
  lastYieldScan: number | null;
  lastArbScan: number | null;
  yieldScans: number;
  arbScans: number;
  notificationsSent: number;
}

export class BackgroundMonitor {
  private users: Map<string, RegisteredUser>;
  private notifications: NotificationService;
  private io: SocketServer;
  private yieldInterval: NodeJS.Timeout | null = null;
  private arbInterval: NodeJS.Timeout | null = null;
  private stats: MonitorStats = {
    isRunning: false,
    lastYieldScan: null,
    lastArbScan: null,
    yieldScans: 0,
    arbScans: 0,
    notificationsSent: 0,
  };
  
  // Cache for opportunities
  private currentYields: YieldOpportunity[] = [];
  private currentArbs: ArbitrageOpportunity[] = [];
  
  constructor(
    users: Map<string, RegisteredUser>,
    notifications: NotificationService,
    io: SocketServer
  ) {
    this.users = users;
    this.notifications = notifications;
    this.io = io;
  }
  
  start() {
    console.log('[Monitor] Starting background monitoring...');
    this.stats.isRunning = true;
    
    // Scan yields every 5 minutes
    this.yieldInterval = setInterval(() => {
      this.scanYields();
    }, 5 * 60 * 1000);
    
    // Scan arbitrage every 30 seconds
    this.arbInterval = setInterval(() => {
      this.scanArbitrage();
    }, 30 * 1000);
    
    // Initial scans
    this.scanYields();
    setTimeout(() => this.scanArbitrage(), 5000);
    
    console.log('[Monitor] ✅ Background monitoring started');
    console.log('[Monitor]    - Yield scan: every 5 minutes');
    console.log('[Monitor]    - Arbitrage scan: every 30 seconds');
  }
  
  stop() {
    console.log('[Monitor] Stopping...');
    this.stats.isRunning = false;
    
    if (this.yieldInterval) {
      clearInterval(this.yieldInterval);
      this.yieldInterval = null;
    }
    if (this.arbInterval) {
      clearInterval(this.arbInterval);
      this.arbInterval = null;
    }
  }
  
  getStats(): MonitorStats {
    return { ...this.stats };
  }
  
  getCurrentOpportunities() {
    return {
      yields: this.currentYields,
      arbitrage: this.currentArbs,
    };
  }
  
  // Fetch real yield data from DeFiLlama
  private async scanYields() {
    console.log('[Monitor] Scanning yields...');
    this.stats.yieldScans++;
    this.stats.lastYieldScan = Date.now();
    
    try {
      const response = await fetch('https://yields.llama.fi/pools');
      if (!response.ok) {
        throw new Error(`DeFiLlama API error: ${response.status}`);
      }
      
      const data = await response.json();
      const pools = data.data || [];
      
      const chainNameToId: Record<string, number> = {
        'Ethereum': 1,
        'Arbitrum': 42161,
        'Optimism': 10,
        'Polygon': 137,
        'Base': 8453,
      };
      
      const supportedChains = Object.keys(chainNameToId);
      const supportedTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'ETH'];
      
      this.currentYields = pools
        .filter((pool: any) => {
          const chain = pool.chain || '';
          const symbol = (pool.symbol || '').toUpperCase();
          return (
            supportedChains.includes(chain) &&
            supportedTokens.some(t => symbol.includes(t)) &&
            pool.apy > 1 &&
            pool.tvlUsd > 1000000
          );
        })
        .map((pool: any) => ({
          chainId: chainNameToId[pool.chain] || 1,
          chainName: pool.chain,
          protocol: pool.project,
          token: pool.symbol,
          apy: pool.apy,
          tvl: pool.tvlUsd,
        }))
        .sort((a: YieldOpportunity, b: YieldOpportunity) => b.apy - a.apy)
        .slice(0, 50);
      
      console.log(`[Monitor] Found ${this.currentYields.length} yield opportunities`);
      
      // Check for notification-worthy yields
      await this.checkYieldAlerts();
      
      // Emit to connected clients
      this.io.emit('yields:update', this.currentYields);
      
    } catch (error: any) {
      console.error('[Monitor] Yield scan error:', error.message);
    }
  }
  
  // Fetch real price data for arbitrage
  private async scanArbitrage() {
    console.log('[Monitor] Scanning arbitrage...');
    this.stats.arbScans++;
    this.stats.lastArbScan = Date.now();
    
    try {
      // Fetch prices from CoinGecko for major tokens
      const tokens = ['usd-coin', 'tether', 'dai', 'weth'];
      const chains = ['ethereum', 'arbitrum-one', 'optimistic-ethereum', 'polygon-pos', 'base'];
      
      const opportunities: ArbitrageOpportunity[] = [];
      
      // For each token, compare prices across chains
      for (const token of tokens) {
        const prices: { chain: string; price: number }[] = [];
        
        for (const chain of chains) {
          try {
            // Use CoinGecko simple price API
            const response = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`,
              { headers: { 'Accept': 'application/json' } }
            );
            
            if (response.ok) {
              const data = await response.json();
              const price = data[token]?.usd || 0;
              if (price > 0) {
                prices.push({ chain, price });
              }
            }
          } catch (e) {
            // Skip failed fetches
          }
        }
        
        // Find price differences
        if (prices.length >= 2) {
          const sorted = [...prices].sort((a, b) => a.price - b.price);
          const cheapest = sorted[0];
          const expensive = sorted[sorted.length - 1];
          
          const priceDiff = ((expensive.price - cheapest.price) / cheapest.price) * 100;
          
          // Only report if > 0.3% difference
          if (priceDiff > 0.3) {
            const grossProfit = (priceDiff / 100) * 1000; // On $1000
            const fees = 4; // ~$4 in fees
            const netProfit = grossProfit - fees;
            
            if (netProfit > 0) {
              opportunities.push({
                tokenSymbol: token.toUpperCase(),
                fromChain: cheapest.chain,
                toChain: expensive.chain,
                priceDifference: priceDiff,
                profitAfterFees: netProfit,
              });
            }
          }
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 250));
      }
      
      this.currentArbs = opportunities.sort((a, b) => b.profitAfterFees - a.profitAfterFees);
      
      console.log(`[Monitor] Found ${this.currentArbs.length} arbitrage opportunities`);
      
      // Check for notification-worthy arbitrage
      await this.checkArbAlerts();
      
      // Emit to connected clients
      this.io.emit('arbitrage:update', this.currentArbs);
      
    } catch (error: any) {
      console.error('[Monitor] Arbitrage scan error:', error.message);
    }
  }
  
  // Check if any yields warrant notification
  private async checkYieldAlerts() {
    if (this.currentYields.length === 0) return;
    
    const topYield = this.currentYields[0];
    const now = Date.now();
    const COOLDOWN = 30 * 60 * 1000; // 30 minutes between notifications
    
    for (const [address, user] of this.users) {
      if (!user.settings.yieldAlerts) continue;
      if (now - user.lastNotified < COOLDOWN) continue;
      
      // Check if yield meets threshold
      if (topYield.apy >= user.settings.minApyImprovement + 5) { // +5% above baseline
        await this.notifyUser(user, 'yield', {
          title: `🌟 High Yield Alert: ${topYield.apy.toFixed(2)}% APY`,
          body: `${topYield.protocol} on ${topYield.chainName} is offering ${topYield.apy.toFixed(2)}% APY on ${topYield.token}`,
          data: topYield,
        });
        user.lastNotified = now;
        this.stats.notificationsSent++;
      }
    }
  }
  
  // Check if any arbitrage warrants notification
  private async checkArbAlerts() {
    if (this.currentArbs.length === 0) return;
    
    const topArb = this.currentArbs[0];
    const now = Date.now();
    const COOLDOWN = 5 * 60 * 1000; // 5 minutes for arb alerts (more time-sensitive)
    
    for (const [address, user] of this.users) {
      if (!user.settings.arbitrageAlerts) continue;
      if (now - user.lastNotified < COOLDOWN) continue;
      
      // Check if arb meets threshold
      if (topArb.profitAfterFees >= user.settings.minArbProfit) {
        await this.notifyUser(user, 'arbitrage', {
          title: `⚡ Arbitrage Alert: $${topArb.profitAfterFees.toFixed(2)} profit`,
          body: `${topArb.tokenSymbol}: ${topArb.priceDifference.toFixed(2)}% spread between ${topArb.fromChain} → ${topArb.toChain}`,
          data: topArb,
        });
        user.lastNotified = now;
        this.stats.notificationsSent++;
      }
    }
  }
  
  // Send notification to user
  private async notifyUser(
    user: RegisteredUser,
    type: 'yield' | 'arbitrage',
    notification: { title: string; body: string; data: any }
  ) {
    console.log(`[Monitor] Notifying ${user.walletAddress.slice(0, 8)}... - ${type}`);
    
    // Send via all available channels
    const promises: Promise<void>[] = [];
    
    // Email notification
    if (user.email) {
      promises.push(
        this.notifications.sendEmail(user.email, notification.title, notification.body, notification.data)
      );
    }
    
    // Push notification
    if (user.pushSubscription) {
      promises.push(
        this.notifications.sendPush(user.pushSubscription, notification.title, notification.body)
      );
    }
    
    // WebSocket (real-time to any connected clients)
    this.io.to(user.walletAddress).emit('notification', {
      type,
      ...notification,
      timestamp: Date.now(),
    });
    
    await Promise.allSettled(promises);
  }
}
