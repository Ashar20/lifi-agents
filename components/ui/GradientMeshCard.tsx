import React from 'react';

interface GradientMeshCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    variant?: 'purple' | 'cyan' | 'amber';
}

const GradientMeshCard: React.FC<GradientMeshCardProps> = ({
    children,
    className = "",
    onClick,
    variant = 'purple'
}) => {
    const gradients = {
        purple: 'from-neural-purple/20 via-neural-purple/10 to-transparent',
        cyan: 'from-neural-cyan/20 via-neural-cyan/10 to-transparent',
        amber: 'from-neural-amber/20 via-neural-amber/10 to-transparent',
    };

    const borderColors = {
        purple: 'border-neural-purple/30',
        cyan: 'border-neural-cyan/30',
        amber: 'border-neural-amber/30',
    };

    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden rounded-xl border ${borderColors[variant]} bg-gradient-to-br ${gradients[variant]} backdrop-blur-sm transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${className}`}
        >
            {/* Animated gradient mesh overlay */}
            <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                    background: `
            radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, rgba(245, 158, 11, 0.2) 0%, transparent 50%)
          `,
                    backgroundSize: '200% 200%',
                    animation: 'gradient-flow 8s ease infinite',
                }}
            />

            {/* Content */}
            <div className="relative h-full">
                {children}
            </div>
        </div>
    );
};

export default GradientMeshCard;
