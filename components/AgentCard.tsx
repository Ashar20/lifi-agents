import React, { useState, useEffect } from 'react';
import { AgentMetadata } from '../types';
import NeuralNode from './ui/NeuralNode';

interface AgentCardProps {
  agent: AgentMetadata;
  isActive: boolean;
  status: string;
  onClick: () => void;
  onToggle: () => void;
  isAutoMode?: boolean;
  customOrder?: string;
  onCustomOrderChange?: (order: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isActive,
  status,
  onClick,
  onToggle,
  isAutoMode,
  customOrder,
  onCustomOrderChange,
}) => {
  return (
    <NeuralNode
      agent={agent}
      isActive={isActive}
      status={status}
      onClick={onClick}
      onToggle={onToggle}
      isAutoMode={isAutoMode}
      customOrder={customOrder}
      onCustomOrderChange={onCustomOrderChange}
    />
  );
};

export default AgentCard;