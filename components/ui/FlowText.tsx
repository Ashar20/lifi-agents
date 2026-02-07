import React from 'react';

interface FlowTextProps {
    children: React.ReactNode;
    className?: string;
    speed?: number;
}

const FlowText: React.FC<FlowTextProps> = ({ children, className = '', speed = 3 }) => {
    return (
        <span
            className={`inline-block bg-gradient-to-r from-spice-orange via-desert-sand to-spice-orange bg-clip-text text-transparent ${className}`}
            style={{
                backgroundSize: '200% auto',
                animation: `gradient-flow ${speed}s linear infinite`,
            }}
        >
            {children}
        </span>
    );
};

export default FlowText;
