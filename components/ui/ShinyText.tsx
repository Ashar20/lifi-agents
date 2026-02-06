import React from 'react';

interface ShinyTextProps {
    children: React.ReactNode;
    disabled?: boolean;
    speed?: number;
    className?: string;
}

const ShinyText: React.FC<ShinyTextProps> = ({ children, disabled = false, speed = 5, className = '' }) => {
    const animationDuration = `${speed}s`;

    return (
        <div
            className={`relative inline-block overflow-hidden ${className}`}
            style={{
                backgroundImage: 'linear-gradient(120deg, transparent 40%, rgba(255, 255, 255, 0.8) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                animation: disabled ? 'none' : `shine ${animationDuration} linear infinite`,
            }}
        >
            <style>{`
        @keyframes shine {
          0% {
            background-position: 100%;
          }
          100% {
            background-position: -100%;
          }
        }
      `}</style>
            {children}
        </div>
    );
};

export default ShinyText;
