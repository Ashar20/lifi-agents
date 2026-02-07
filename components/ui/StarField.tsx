import React, { useEffect, useRef } from 'react';

interface Star {
    x: number;
    y: number;
    z: number;
    pz: number;
}

const StarField: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;
        let stars: Star[] = [];
        const starCount = 800;
        const speed = 0.5; // Reduced speed

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        const initStars = () => {
            stars = [];
            for (let i = 0; i < starCount; i++) {
                stars.push({
                    x: Math.random() * width - width / 2,
                    y: Math.random() * height - height / 2,
                    z: Math.random() * width,
                    pz: 0
                });
                stars[i].pz = stars[i].z;
            }
        };

        const update = () => {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, width, height);

            const cx = width / 2;
            const cy = height / 2;

            for (let i = 0; i < stars.length; i++) {
                let star = stars[i];

                star.z -= speed;

                if (star.z <= 0) {
                    star.x = Math.random() * width - width / 2;
                    star.y = Math.random() * height - height / 2;
                    star.z = width;
                    star.pz = width;
                }

                const x = (star.x / star.z) * width + cx;
                const y = (star.y / star.z) * height + cy;

                const size = Math.max(0.5, (1 - star.z / width) * 2); // Smaller size, min 0.5 so radius is never negative
                const px = (star.x / star.pz) * width + cx;
                const py = (star.y / star.pz) * height + cy;

                star.pz = star.z;

                if (x >= 0 && x <= width && y >= 0 && y <= height) {
                    const alpha = (1 - star.z / width);
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();

                    // Slight trail
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                    ctx.lineWidth = size;
                    ctx.moveTo(px, py);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            }
            requestAnimationFrame(update);
        };

        window.addEventListener('resize', resize);
        resize();
        initStars();
        const animationId = requestAnimationFrame(update);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-0 pointer-events-none"
            style={{ opacity: 0.6 }}
        />
    );
};

export default StarField;
