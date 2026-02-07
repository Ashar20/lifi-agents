import React from 'react';

interface GradientMeshCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    variant?: 'spice' | 'sand' | 'fremen';
}

const GradientMeshCard: React.FC<GradientMeshCardProps> = ({
    children,
    className = "",
    onClick,
    variant = 'spice'
}) => {
    const gradients = {
        spice: 'from-spice-orange/20 via-spice-orange/10 to-transparent',
        sand: 'from-desert-sand/20 via-desert-sand/10 to-transparent',
        fremen: 'from-fremen-blue/20 via-fremen-blue/10 to-transparent',
    };

    const borderColors = {
        spice: 'border-spice-orange/30',
        sand: 'border-desert-sand/30',
        fremen: 'border-fremen-blue/30',
    };

    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden rounded-xl border ${borderColors[variant]} bg-gradient-to-br ${gradients[variant]} backdrop-blur-sm transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${className}`}
        >
            {/* Animated desert gradient mesh overlay */}
            <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                    background: `
            radial-gradient(circle at 20% 50%, rgba(216, 67, 21, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(141, 110, 99, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, rgba(215, 204, 200, 0.2) 0%, transparent 50%)
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
