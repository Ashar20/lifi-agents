import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import { AgentMetadata } from '../types';
import LottieAvatar from './LottieAvatar';

// --- Custom Agent Node Component ---
const AgentNode = React.memo(({ data }: NodeProps) => {
  const { agent, dialogue, onCloseDialogue } = data;
  const spriteUrl = agent.avatar;

  return (
    <div className={`
      relative w-32 flex flex-col items-center 
      ${data.isStreaming ? 'filter drop-shadow-[0_0_10px_#43FF4D]' : ''}
    `}>
      {/* Dialogue bubble */}
      {dialogue && (
        <div className="absolute left-[50%] bottom-full mb-2 z-50 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-[#39ff14] rounded-lg p-2 shadow-2xl w-[140px] backdrop-blur-sm" 
               style={{ 
                 boxShadow: '0 0 20px rgba(57, 255, 20, 0.4), 0 0 40px rgba(57, 255, 20, 0.2)',
                 animation: 'gentle-float 3s ease-in-out infinite'
               }}>
            {/* Speech bubble tail */}
            <div className="absolute left-3 bottom-0 transform translate-y-full w-0 h-0 border-t-[8px] border-r-[8px] border-t-gray-900 border-r-transparent"></div>
            <div className="absolute left-3 bottom-0 transform translate-y-[7px] w-0 h-0 border-t-[7px] border-r-[7px] border-t-[#39ff14] border-r-transparent"></div>
            
            <div className="flex items-start gap-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-white text-[10px] leading-relaxed font-medium">{dialogue}</p>
              </div>
              <button
                onClick={onCloseDialogue}
                className="text-gray-400 hover:text-[#39ff14] transition-all hover:scale-110 flex-shrink-0 mt-0.5"
                aria-label="Close dialogue"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Handle type="target" position={Position.Top} className="!bg-neon-green !w-3 !h-3 !border-none" />
      
      <div className="relative w-20 h-20 mb-2">
        <div className={`
          absolute inset-0 rounded-full border-2 border-dashed 
          ${data.isStreaming ? 'border-neon-green animate-spin-slow' : 'border-white/20'}
        `}></div>
        
        {agent.avatarType === 'lottie' ? (
          <div className="w-full h-full p-2">
            <LottieAvatar 
              animationPath={spriteUrl}
              width={64}
              height={64}
            />
          </div>
        ) : (
          <img 
            src={spriteUrl} 
            alt={agent.name}
            className="w-full h-full object-contain p-2"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>

      <div className="bg-black/80 backdrop-blur border border-neon-green/50 px-3 py-1 rounded-md text-center min-w-[120px]">
        <div className="text-[10px] text-neon-green font-mono uppercase font-bold truncate">{agent.name}</div>
        {data.currentAction && (
          <div className="text-[9px] text-white/70 truncate animate-pulse">{data.currentAction}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-neon-green !w-3 !h-3 !border-none" />
      
      {data.isStreaming && (
        <div className="absolute -right-4 top-0 bg-neon-green text-black text-[8px] font-bold px-1 rounded animate-bounce">
          LI.FI
        </div>
      )}
    </div>
  );
});

// Define outside component and memoize
const nodeTypes = { agentNode: AgentNode };
const edgeTypes = {};
const proOptions = { hideAttribution: true };

interface FlowCanvasProps {
  agents: AgentMetadata[];
  activeAgents: string[];
  selectedAgentId?: string | null;
  onAgentSelect?: (agentId: string) => void;
  streamingEdges: string[];
  onNodePositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
  activeDialogue?: { agentId: string; dialogue: string } | null;
  onCloseDialogue?: () => void;
  persistentEdges?: Array<{source: string, target: string}>;
  onEdgesChange?: (edges: Array<{source: string, target: string}>) => void;
  agentStatuses?: Record<string, 'idle' | 'negotiating' | 'streaming' | 'offline'>;
  randomDialogues?: Record<string, { dialogue: string; timestamp: number }>;
  isWalletConnected?: boolean;
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({ 
  agents, 
  activeAgents, 
  streamingEdges, 
  onNodePositionsChange, 
  activeDialogue, 
  onCloseDialogue,
  persistentEdges = [],
  onEdgesChange: onPersistentEdgesChange,
  randomDialogues = {},
  isWalletConnected = false
}) => {

  // Compute initial nodes once
  const initialNodes = useMemo(() => {
    const savedPos = localStorage.getItem('nodePositions');
    const positions = savedPos ? JSON.parse(savedPos) : {};
    
    return activeAgents.map((id, index) => {
      const agent = agents.find(a => a.id === id)!;
      const position = positions[id] || { x: 100 + (index * 250), y: 100 + (index % 2) * 150 };
      
      return {
        id: agent.id,
        type: 'agentNode',
        position,
        data: { 
          agent,
          isStreaming: false,
          currentAction: '',
          dialogue: null,
          onCloseDialogue: () => {}
        },
      };
    });
  }, []); // Empty deps - compute once only

  // Compute initial edges once
  const initialEdges = useMemo(() => {
    return persistentEdges
      .filter(conn => activeAgents.includes(conn.source) && activeAgents.includes(conn.target))
      .map(conn => ({
        id: `reactflow__edge-${conn.source}-${conn.target}`,
        source: conn.source,
        target: conn.target,
        animated: true,
        style: { stroke: '#43FF4D', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#43FF4D' },
      }));
  }, []); // Empty deps - compute once only

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Save node positions when they change
  React.useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      if (node.position) {
        positions[node.id] = { x: node.position.x, y: node.position.y };
      }
    });
    
    // Save to localStorage
    localStorage.setItem('nodePositions', JSON.stringify(positions));
    
    // Call callback if provided
    if (onNodePositionsChange) {
      onNodePositionsChange(positions);
    }
  }, [nodes, onNodePositionsChange]);

  // Update nodes when activeAgents changes (add/remove agents)
  React.useEffect(() => {
    const savedPos = localStorage.getItem('nodePositions');
    const positions = savedPos ? JSON.parse(savedPos) : {};
    
    const newNodes = activeAgents.map((id, index) => {
      const agent = agents.find(a => a.id === id)!;
      const existingNode = nodes.find(n => n.id === id);
      const position = existingNode?.position || positions[id] || { x: 100 + (index * 250), y: 100 + (index % 2) * 150 };
      
      return {
        id: agent.id,
        type: 'agentNode',
        position,
        data: { 
          agent,
          isStreaming: existingNode?.data?.isStreaming || false,
          currentAction: existingNode?.data?.currentAction || '',
          dialogue: existingNode?.data?.dialogue || null,
          onCloseDialogue: onCloseDialogue || (() => {})
        },
      };
    });
    
    // Only update if agent list actually changed
    if (nodes.length !== newNodes.length || nodes.some((n, i) => n.id !== newNodes[i]?.id)) {
      setNodes(newNodes);
    }
  }, [activeAgents, agents]);

  // Update dialogue when activeDialogue changes
  React.useEffect(() => {
    if (!activeDialogue) {
      // Clear all dialogues
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            dialogue: null
          }
        }))
      );
      return;
    }
    
    // Set dialogue for specific agent
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === activeDialogue.agentId) {
          return {
            ...node,
            data: {
              ...node.data,
              dialogue: activeDialogue.dialogue,
              onCloseDialogue: onCloseDialogue || (() => {})
            }
          };
        }
        return node;
      })
    );
  }, [activeDialogue, onCloseDialogue]);

  // Update nodes with random dialogues
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const randomDialogue = randomDialogues[node.id];
        
        // If there's a random dialogue for this agent and no active dialogue
        if (randomDialogue && !activeDialogue) {
          return {
            ...node,
            data: {
              ...node.data,
              dialogue: randomDialogue.dialogue,
              onCloseDialogue: () => {
                // This will be handled by the auto-hide timer in App.tsx
              }
            }
          };
        }
        
        // If there's an active dialogue, it takes priority
        if (activeDialogue && node.id === activeDialogue.agentId) {
          return node; // Keep existing dialogue
        }
        
        // Clear dialogue if no random dialogue exists
        if (!randomDialogue && !activeDialogue) {
          return {
            ...node,
            data: {
              ...node.data,
              dialogue: null
            }
          };
        }
        
        return node;
      })
    );
  }, [randomDialogues, activeDialogue]);

  // Update edges when activeAgents or persistentEdges change
  React.useEffect(() => {
    const newEdges = persistentEdges
      .filter(conn => activeAgents.includes(conn.source) && activeAgents.includes(conn.target))
      .map(conn => ({
        id: `reactflow__edge-${conn.source}-${conn.target}`,
        source: conn.source,
        target: conn.target,
        animated: true,
        style: { stroke: '#43FF4D', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#43FF4D' },
      }));
    
    setEdges(newEdges);
  }, [activeAgents, persistentEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      setEdges((eds) => addEdge({ 
        ...params,
        animated: true,
        style: { stroke: '#43FF4D', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#43FF4D' },
      }, eds));
      
      if (onPersistentEdgesChange) {
        const exists = persistentEdges.some(e => e.source === params.source && e.target === params.target);
        if (!exists) {
          onPersistentEdgesChange([...persistentEdges, { source: params.source, target: params.target }]);
        }
      }
    },
    [setEdges, onPersistentEdgesChange, persistentEdges]
  );

  return (
    <div className="w-full h-full bg-[#050505] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="bg-black"
        proOptions={proOptions}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1} 
          color="#1f2937" 
        />
        <Controls 
          className="!bg-gray-900 !border-neon-green/30 !rounded-lg !shadow-lg"
          style={{
            button: {
              backgroundColor: '#1a1a1a',
              borderColor: '#43FF4D40',
              color: '#43FF4D',
            }
          }}
        />
      </ReactFlow>
      
      {activeAgents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <h2 className="text-2xl font-mono text-white/30 font-bold">GRID OFFLINE</h2>
            <p className="text-neon-green/50 text-sm font-mono mt-2">Activate agents to begin cross-chain orchestration</p>
            {!isWalletConnected && (
              <p className="text-yellow-500/70 text-xs font-mono mt-3">Connect wallet in top bar for agents to use your address</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowCanvas;
