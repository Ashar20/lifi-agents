// API Service Layer for LI.FI Agents Orchestrator
// Integrates: Gemini AI for intelligent DeFi strategy analysis

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize Gemini AI
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ===========================
// LI.FI CACHING LAYER
// ===========================
// Caches DeFi quotes, route analysis, and AI responses to reduce API calls
// and improve cross-chain routing performance.

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class LifiCache {
  private prefix = 'lifi_cache_';

  /**
   * Cache DeFi data with TTL (default 5 minutes for quotes, 3 minutes for AI responses)
   * @param key Cache key (e.g., 'quote_eth_arb_usdc_1000')
   * @param data Data to cache (quotes, routes, AI responses)
   * @param ttlSeconds Time-to-live in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttlSeconds * 1000)
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch (e) {
      console.warn('[LifiCache] Write failed (quota exceeded?):', e);
    }
  }

  /**
   * Retrieve cached DeFi data if still valid
   * @param key Cache key
   * @returns Cached data or null if expired/missing
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);

      // Check expiration
      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (e) {
      console.warn('[LifiCache] Read failed:', e);
      return null;
    }
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.warn('[LifiCache] Delete failed:', e);
    }
  }

  /**
   * Clear all LI.FI cache entries (useful for debugging or reset)
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('[LifiCache] Clear failed:', e);
    }
  }
}

const cache = new LifiCache();

// ===========================
// API RATE LIMITER FOR LI.FI & GEMINI
// ===========================
// Prevents API quota exhaustion by limiting calls per time window.
// Critical for Gemini AI (free tier: 15 RPM) and LI.FI API usage.

class DeFiRateLimiter {
  private calls: Record<string, number[]> = {};
  private limits: Record<string, { maxCalls: number; windowMs: number }> = {
    gemini: { maxCalls: 10, windowMs: 60000 }, // 10 calls per minute (conservative for free tier)
    lifi: { maxCalls: 30, windowMs: 60000 },   // 30 LI.FI quotes per minute
  };

  /**
   * Check if we can make an API call without exceeding rate limits
   * @param service Service name ('gemini' or 'lifi')
   * @returns true if call is allowed
   */
  canMakeCall(service: string): boolean {
    const now = Date.now();
    const limit = this.limits[service];

    if (!limit) return true; // No limit defined

    if (!this.calls[service]) {
      this.calls[service] = [];
    }

    // Remove calls outside the time window
    this.calls[service] = this.calls[service].filter(
      timestamp => now - timestamp < limit.windowMs
    );

    return this.calls[service].length < limit.maxCalls;
  }

  /**
   * Record an API call (call this after successful API request)
   */
  recordCall(service: string): void {
    const now = Date.now();
    if (!this.calls[service]) {
      this.calls[service] = [];
    }
    this.calls[service].push(now);
  }

  /**
   * Get remaining calls in current window
   */
  getRemainingCalls(service: string): number {
    const limit = this.limits[service];
    if (!limit) return Infinity;

    const now = Date.now();
    if (!this.calls[service]) return limit.maxCalls;

    const recentCalls = this.calls[service].filter(
      timestamp => now - timestamp < limit.windowMs
    );

    return Math.max(0, limit.maxCalls - recentCalls.length);
  }

  /**
   * Get time until rate limit resets (ms)
   */
  getTimeUntilReset(service: string): number {
    const limit = this.limits[service];
    if (!limit || !this.calls[service] || this.calls[service].length === 0) {
      return 0;
    }

    const now = Date.now();
    const oldestCall = Math.min(...this.calls[service]);
    const resetTime = oldestCall + limit.windowMs;

    return Math.max(0, resetTime - now);
  }
}

const rateLimiter = new DeFiRateLimiter();

// ===========================
// GEMINI AI SERVICE FOR LI.FI AGENTS
// ===========================
// Powers intelligent DeFi strategy analysis, route decision-making,
// and dynamic agent responses for cross-chain operations.

export interface GeminiRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  text: string;
  candidates?: any[];
  error?: string;
}

export const geminiService = {
  /**
   * Chat with Gemini AI for DeFi strategy analysis
   * Used by agents to analyze routes, arbitrage opportunities, and yield strategies
   */
  async chat(request: GeminiRequest): Promise<GeminiResponse> {
    if (!GEMINI_API_KEY) {
      console.warn('Gemini API key not configured');
      return { text: 'API key not configured', error: 'MISSING_API_KEY' };
    }

    if (!rateLimiter.canMakeCall('gemini')) {
      const waitTime = Math.ceil(rateLimiter.getTimeUntilReset('gemini') / 1000);
      console.warn(`⏳ Gemini rate limit reached. Wait ${waitTime}s.`);
      return {
        text: `Rate limit: ${rateLimiter.getRemainingCalls('gemini')} calls remaining`,
        error: 'RATE_LIMITED'
      };
    }

    try {
      rateLimiter.recordCall('gemini');

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: request.prompt,
      });

      const text = response.text || 'No response';

      return { text };
    } catch (error: any) {
      let errorMessage = 'AI service temporarily unavailable';

      if (error?.message?.includes('overloaded')) {
        errorMessage = 'AI service is busy, please try again';
      } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        errorMessage = 'Daily quota exceeded - AI disabled until reset';
      }

      console.error('Gemini API error:', error);

      return {
        text: errorMessage,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  },

  /**
   * Generate dynamic agent dialogue for cross-chain DeFi operations
   * Creates contextual responses based on agent role and current DeFi state
   */
  async generateAgentDialogue(agentName: string, agentRole: string, context: string = ''): Promise<string> {
    if (!ai || !GEMINI_API_KEY) {
      // Fallback dialogues
      const ruleBased: Record<string, string[]> = {
        'Route Strategist': [
          'All units report status. Cross-chain network operational.',
          'Analyzing market conditions across all chains.',
          'Coordinating team response. Stay vigilant.',
        ],
        'Arbitrage Hunter': [
          'Scanning for price differences... Systems online.',
          'Opportunity radar active. Monitoring DEX prices.',
          'Price analysis in progress. No major opportunities detected.',
        ],
        'Portfolio Guardian': [
          'Cross-referencing positions... Match probability: calculating.',
          'Position analysis complete. PnL updated.',
          'Portfolio vault updated with new positions.',
        ],
        'Yield Seeker': [
          'Yield scanning active. How can I optimize your returns today?',
          'Standing by to find best yields. Your returns are my priority.',
          'Monitoring for yield opportunities across chains.',
        ],
        'Risk Sentinel': [
          'Route validation ready. Lets analyze route safety together.',
          'Creating new risk analysis for current routes.',
          'Interactive validation drills available. Stay safe!',
        ],
        'Rebalancer': [
          'Allocation monitoring active.',
          'Rebalancing systems running smoothly.',
          'Target allocation protocols engaged. Your portfolio is balanced.',
        ],
        'Route Executor': [
          'Execution system armed. Ready for rapid deployment.',
          'LI.FI route execution systems tested and ready.',
          'Cross-chain execution network: OPERATIONAL',
        ],
      };

      const dialogues = ruleBased[agentName] || ['Agent ready and operational.'];
      return dialogues[Math.floor(Math.random() * dialogues.length)];
    }

    const cacheKey = `dialogue_${agentName}_${context.substring(0, 20)}`;
    const cached = cache.get<string>(cacheKey);
    if (cached) return cached;

    if (!rateLimiter.canMakeCall('gemini')) {
      return `${agentName}: Systems monitoring. Standing by.`;
    }

    const roleContext: Record<string, string> = {
      'Route Strategist': 'strategic commander coordinating cross-chain DeFi operations',
      'Arbitrage Hunter': 'vigilant scanner detecting arbitrage opportunities',
      'Portfolio Guardian': 'knowledge keeper of cross-chain positions',
      'Yield Seeker': 'optimistic optimizer finding best yields',
      'Risk Sentinel': 'cautious analyst validating route safety',
      'Rebalancer': 'systematic agent maintaining portfolio allocations',
      'Route Executor': 'rapid executor of LI.FI routes',
    };

    const prompt = `You are ${agentName}, a ${roleContext[agentName] || agentRole} AI agent in a cross-chain DeFi orchestrator.

Context: ${context || 'normal operations'}

Generate a brief, professional status update (1-2 sentences max) about cross-chain DeFi operations. Be concise and focused on DeFi strategies.`;

    try {
      rateLimiter.recordCall('gemini');
      const response = await this.chat({ prompt, temperature: 0.7 });

      if (response.text && !response.error) {
        cache.set(cacheKey, response.text, 180);
        return response.text;
      }

      return `${agentName}: Systems operational. Cross-chain protocols active.`;
    } catch (error) {
      console.warn('Dialogue generation error:', error);
      return `${agentName}: Ready and monitoring.`;
    }
  },

  /**
   * Generate dynamic, contextual responses for intent chat.
   * Avoids robotic predefined phrases - responds naturally to what the user actually said.
   */
  async generateIntentResponses(
    userIntent: string,
    intentType: string,
    agentNames: string[]
  ): Promise<{ systemMessage: string; agentMessages: Record<string, string> }> {
    const fallback: { systemMessage: string; agentMessages: Record<string, string> } = {
      systemMessage: "Got it! We're on it.",
      agentMessages: {}
    };

    if (!ai || !GEMINI_API_KEY || !rateLimiter.canMakeCall('gemini')) {
      return fallback;
    }

    const agentList = agentNames.join(', ');
    const prompt = `You're writing responses for a DeFi agent chat. The user just said: "${userIntent}"

Intent type: ${intentType}
Agents responding: ${agentList}

Generate natural, human responses - NOT robotic or scripted. Match the user's tone and wording. Be brief (1 short sentence each).

Respond with ONLY valid JSON in this exact format, no other text:
{"systemMessage":"one short sentence acknowledging what they asked","agentMessages":{"Agent Name":"their brief reply","Agent Name 2":"their brief reply"}}

Each agent message should feel like a real person responding to THIS specific request - not a generic status update. Vary the phrasing.`;

    try {
      rateLimiter.recordCall('gemini');
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = (response.text || '').trim();
      // Strip markdown code blocks if present
      const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.systemMessage && typeof parsed.agentMessages === 'object') {
        return {
          systemMessage: String(parsed.systemMessage).slice(0, 200),
          agentMessages: parsed.agentMessages
        };
      }
    } catch (e) {
      console.warn('generateIntentResponses parse error:', e);
    }
    return fallback;
  }
};

// Make utilities available globally
if (typeof window !== 'undefined') {
  (window as any).geminiService = geminiService;
  console.log('%c🌐 LI.FI AGENTS ORCHESTRATOR', 'color: #00d4ff; font-weight: bold; font-size: 14px;');
}

// Mock services to satisfy App.tsx imports
export const orchestrator = {
  startMode: (mode: 'auto' | 'manual') => console.log('Orchestrator started:', mode),
  stop: () => console.log('Orchestrator stopped'),
};

export const agentStatusManager = {
  updateStatus: (agentId: string, status: string) => console.log('Status updated:', agentId, status),
  getStatuses: () => ({}),
};
