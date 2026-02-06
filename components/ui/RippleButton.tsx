import React, { useState } from 'react';

interface RippleButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: 'purple' | 'cyan' | 'amber';
    disabled?: boolean;
}

const RippleButton: React.FC<RippleButtonProps> = ({
    children,
    onClick,
    className = "",
    variant = 'purple',
    disabled = false
}) => {
    const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple = { x, y, id: Date.now() };
        setRipples(prev => [...prev, newRipple]);

        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600);

        onClick?.();
    };

    const colors = {
        purple: 'bg-neural-purple hover:bg-neural-purple/90',
        cyan: 'bg-neural-cyan hover:bg-neural-cyan/90',
        amber: 'bg-neural-amber hover:bg-neural-amber/90',
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            className={`relative overflow-hidden ${colors[variant]} disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${className}`}
        >
            {/* Ripple effects */}
            {ripples.map(ripple => (
                <span
                    key={ripple.id}
                    className="absolute bg-white/30 rounded-full animate-ripple"
                    style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: 20,
                        height: 20,
                        transform: 'translate(-50%, -50%)',
                    }}
                />
            ))}

            {/* Content */}
            <span className="relative z-10">{children}</span>
        </button>
    );
};

export default RippleButton;
