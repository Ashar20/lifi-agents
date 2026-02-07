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
- Getting swap/bridge quotes for ANY token pair: USDC→USDC, USDC→ETH, ETH→USDC, etc. (USDC→USDC uses Arc/CCTP; other pairs use LI.FI best route)
- Finding the best yield opportunities (APY) for stablecoins
- Comparing yields across protocols and chains

Use the tools to fetch real data before answering. Be concise and human. When the user asks about their balance, yields, or swaps, call the appropriate tool first, then summarize the results in a friendly way.

AGENT PIPELINE (7 agents work directly): When the user asks for yield, arbitrage, portfolio check, rebalancing, or "make best use of" funds—call deployAgents FIRST, then runAgentPipeline with intentType matching the request (yield_optimization, arbitrage, portfolio_check, rebalancing, swap, monitoring, or general) and userMessage set to the user's exact message. The 7 agents (Paul Atreides, Chani, Irulan, Liet-Kynes, Duncan Idaho, Thufir Hawat, Stilgar) will run their tasks and return real results. Summarize the agent outputs for the user.

Deploy agents: When the user says "make best use of X from my wallet", "optimize my funds", "put my USDC to work", or similar—call deployAgents FIRST to activate the agent team on the Flow Canvas, then runAgentPipeline (not getBestYields alone) so the agents do the work.

Workflow execution: When the user says "do the workflow", "execute", "run it", "implement it", "deposit to best yield", or similar—call executeYieldWorkflow. Yields shown are capped at 100% APY (we filter bloated/inflationary data).

Swap rules:
- USDC→USDC (chain to chain): Uses Arc (Circle CCTP). Any amount.
- USDC→ETH, ETH→USDC, etc.: Uses LI.FI to find best route. Always use getSwapQuote - we support USDC, ETH, WETH, USDT, DAI.
- For "swap USDC to ETH" without chain: assume same chain (e.g. USDC on Ethereum → ETH on Ethereum) or ask which chain.
- When a quote fails, share the error reason with the user. For USDC under ~$10, bridges often need 10–25+ USDC—suggest trying a larger amount.

If the user's request is vague (e.g. "can you swap?"), ask for clarification with examples based on their actual balance if you have it.

Supported chains: Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche.
Token amounts in tools are in human units (e.g. 100 = 100 USDC).`;

const google = createGoogleGenerativeAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

const DEMO_WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

export function useAgentChat(
  walletAddress: string | undefined,
  walletClient?: any,
  onDeployAgents?: () => void,
  onRunAgentPipeline?: (intentType: string, userMessage?: string) => Promise<{ success: boolean; summary: string; agentOutputs: Record<string, string> }>
) {
  const effectiveAddress = walletAddress || DEMO_WALLET;
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
        const tools = createAgentTools({
          walletAddress: effectiveAddress,
          walletClient,
          onDeployAgents,
          onRunAgentPipeline,
        });

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
          stopWhen: stepCountIs(7),
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
    [effectiveAddress, walletClient, onDeployAgents, onRunAgentPipeline, messages, isLoading]
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
