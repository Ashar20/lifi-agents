// API Service Layer for LI.FI Agents Orchestrator
// Integrates: Gemini AI for intelligent DeFi strategy analysis

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize Gemini AI
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ===========================
// SMART CACHING LAYER
// ===========================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class SmartCache {
  private prefix = 'lifi_cache_';

  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttlSeconds * 1000)
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);
      
      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (e) {
      console.warn('Cache read failed:', e);
      return null;
    }
  }

  delete(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.warn('Cache delete failed:', e);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Cache clear failed:', e);
    }
  }
}

const cache = new SmartCache();

// ===========================
// API RATE LIMITER
// ===========================

class RateLimiter {
  private calls: Record<string, number[]> = {};
  private limits: Record<string, { maxCalls: number; windowMs: number }> = {
    gemini: { maxCalls: 10, windowMs: 60000 } // 10 calls per minute
  };

  canMakeCall(service: string): boolean {
    const now = Date.now();
    const limit = this.limits[service];
    
    if (!limit) return true;

    if (!this.calls[service]) {
      this.calls[service] = [];
    }

    this.calls[service] = this.calls[service].filter(
      timestamp => now - timestamp < limit.windowMs
    );

    return this.calls[service].length < limit.maxCalls;
  }

  recordCall(service: string): void {
    const now = Date.now();
    if (!this.calls[service]) {
      this.calls[service] = [];
    }
    this.calls[service].push(now);
  }

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
}

const rateLimiter = new RateLimiter();

// ===========================
// GEMINI AI SERVICE
// ===========================

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

  // Generate agent dialogue for DeFi context
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
