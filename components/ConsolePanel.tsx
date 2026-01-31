import React, { useEffect, useRef } from 'react';
import { LogMessage } from '../types';
import { Terminal, DollarSign, MessageSquare } from 'lucide-react';

interface ConsolePanelProps {
  logs: LogMessage[];
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getIcon = (type: string) => {
    switch(type) {
      case 'A2A': return <MessageSquare size={12} className="text-blue-400" />;
      case 'x402': return <DollarSign size={12} className="text-neon-green" />;
      case 'COMMANDER': return <span className="text-[#39ff14] font-bold">📋</span>;
      default: return <Terminal size={12} className="text-gray-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#080808] border-t border-white/10 font-mono text-xs">
      <div className="flex items-center px-4 py-2 bg-black/50 border-b border-white/10">
        <Terminal size={14} className="text-neon-green mr-2" />
        <span className="text-neon-green font-bold font-mono">SYSTEM LOGS</span>
        <div className="flex-1"></div>
        <div className="flex gap-2">
           <span className="flex items-center gap-1.5 text-gray-500 text-xs">
             <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse"/> 
             LIVE
           </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 group hover:bg-white/5 p-1 rounded transition-colors">
            <span className="text-gray-500 min-w-[60px]">{log.timestamp}</span>
            <div className="mt-0.5">{getIcon(log.type)}</div>
            <span className={`
              ${log.type === 'x402' ? 'text-neon-green' : ''}
              ${log.type === 'A2A' ? 'text-blue-300' : ''}
              ${log.type === 'COMMANDER' ? 'text-[#39ff14] font-bold' : ''}
              ${log.type === 'SYSTEM' ? 'text-gray-300' : ''}
              break-all
            `}>
              {log.content}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ConsolePanel;