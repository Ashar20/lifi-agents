import React from 'react';

interface HoloCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverEffect?: boolean;
}

const HoloCard: React.FC<HoloCardProps> = ({ children, className = '', onClick, hoverEffect = true }) => {
    return (
        <div
            onClick={onClick}
            className={`
        relative overflow-hidden
        bg-black/40 backdrop-blur-md 
        border border-white/10
        rounded-xl
        transition-all duration-300
        ${hoverEffect ? 'hover:border-neon-green/50 hover:shadow-[0_0_15px_rgba(57,255,20,0.15)] hover:-translate-y-1' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
        >
            {/* Internal shine effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 rounded-tl-sm"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 rounded-tr-sm"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 rounded-bl-sm"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 rounded-br-sm"></div>

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default HoloCard;
