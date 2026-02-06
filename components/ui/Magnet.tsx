import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

interface MagnetProps {
    children: React.ReactNode;
    strength?: number;
    active?: boolean;
    className?: string;
    onClick?: () => void;
}

const Magnet: React.FC<MagnetProps> = ({
    children,
    strength = 50,
    active = true,
    className = "",
    onClick
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!active || !ref.current) return;

        const { clientX, clientY } = e;
        const { height, width, left, top } = ref.current.getBoundingClientRect();

        const middleX = clientX - (left + width / 2);
        const middleY = clientY - (top + height / 2);

        setPosition({ x: middleX * 0.5, y: middleY * 0.5 }); // Dampening factor
    };

    const reset = () => {
        setPosition({ x: 0, y: 0 });
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={reset}
            animate={active ? { x: position.x, y: position.y } : { x: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
            className={`inline-block ${className}`}
            onClick={onClick}
        >
            {children}
        </motion.div>
    );
};

export default Magnet;
