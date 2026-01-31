import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Zap, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'system' | 'agent';
  content: string;
  timestamp: number;
  agentName?: string;
}

interface IntentChatProps {
  onIntentSubmit: (intent: string) => void;
  messages: Message[];
  isProcessing?: boolean;
}

export const IntentChat: React.FC<IntentChatProps> = ({ 
  onIntentSubmit, 
  messages, 
  isProcessing = false 
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    onIntentSubmit(input.trim());
    setInput('');
  };

  const exampleIntents = [
    "Use my USDC and always deploy it where yield is higher",
    "Find arbitrage opportunities across all chains",
    "Move my capital to the best yield automatically",
    "Monitor prices and execute profitable trades"
  ];

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm border-l border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-neon-green/5">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-neon-green" />
          <h2 className="text-neon-green font-bold font-mono text-sm uppercase tracking-wider">
            Intent Chat
          </h2>
        </div>
        <p className="text-gray-400 text-xs font-mono">
          Express your intent. Agents will connect automatically.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-neon-green/50 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-mono mb-4">
                Tell me what you want to achieve
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">
                Example Intents:
              </p>
              {exampleIntents.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(example)}
                  className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-green/30 rounded-lg transition-all text-xs text-gray-300 font-mono"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.type !== 'user' && (
                  <div className="w-6 h-6 rounded-full bg-neon-green/20 flex items-center justify-center flex-shrink-0 mt-1">
                    {msg.type === 'agent' ? (
                      <Zap className="w-3 h-3 text-neon-green" />
                    ) : (
                      <Bot className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.type === 'user'
                      ? 'bg-neon-green/20 border border-neon-green/30 text-white'
                      : msg.type === 'agent'
                      ? 'bg-blue-500/20 border border-blue-500/30 text-blue-200'
                      : 'bg-white/5 border border-white/10 text-gray-300'
                  }`}
                >
                  {msg.type === 'agent' && msg.agentName && (
                    <div className="text-[10px] font-mono text-blue-400 mb-1 uppercase tracking-wider">
                      {msg.agentName}
                    </div>
                  )}
                  <p className="text-sm font-mono leading-relaxed">{msg.content}</p>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                {msg.type === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-neon-green/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-3 h-3 text-neon-green" />
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-neon-green/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-neon-green animate-pulse" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Express your intent..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-neon-green focus:outline-none font-mono text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 bg-neon-green hover:bg-neon-green/80 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition-all font-mono disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 font-mono">
          Agents will automatically connect and execute your intent
        </p>
      </form>
    </div>
  );
};
