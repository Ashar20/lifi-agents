// Agent chat hook using Vercel AI SDK
// Client-side generateText with tools for LI.FI / DeFi orchestration

import { useState, useCallback } from 'react';
import { generateText, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAgentTools } from '../services/agentTools';

export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'agent';
  content: string;
  timestamp: number;
  agentName?: string;
}

const SYSTEM_PROMPT = `You are a DeFi assistant for the LI.FI Agents Orchestrator. You help users with:
- Checking USDC balances across chains (Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche)
- Getting swap/bridge quotes for cross-chain transfers
- Finding the best yield opportunities (APY) for stablecoins
- Comparing yields across protocols and chains

Use the tools to fetch real data before answering. Be concise and human. When the user asks about their balance, yields, or swaps, call the appropriate tool first, then summarize the results in a friendly way.

If the user's request is vague (e.g. "can you swap?"), ask for clarification with examples based on their actual balance if you have it.

Supported chains: Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche.
Token amounts in tools are in human units (e.g. 100 = 100 USDC).`;

const google = createGoogleGenerativeAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export function useAgentChat(walletAddress: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        type: 'user',
        content: userInput.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const tools = createAgentTools({ walletAddress });

        const apiMessages = [
          ...messages
            .filter((m) => m.type === 'user' || m.type === 'agent')
            .map((m) =>
              m.type === 'user'
                ? { role: 'user' as const, content: m.content }
                : { role: 'assistant' as const, content: m.content }
            ),
          { role: 'user' as const, content: userInput.trim() },
        ];

        const { text } = await generateText({
          model: google('gemini-2.0-flash'),
          system: SYSTEM_PROMPT,
          messages: apiMessages,
          tools,
          stopWhen: stepCountIs(5),
        });

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_agent`,
          type: 'agent',
          content: text || 'I couldn\'t generate a response. Please try again.',
          timestamp: Date.now(),
          agentName: 'DeFi Agent',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        setError(err?.message || 'Something went wrong.');
        const errMsg: ChatMessage = {
          id: `msg_${Date.now()}_system`,
          type: 'system',
          content: `Error: ${err?.message || 'Something went wrong.'}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress, messages, isLoading]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const appendMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: `msg_${Date.now()}_append`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  return { messages, submit, isLoading, error, clearMessages, appendMessage };
}
