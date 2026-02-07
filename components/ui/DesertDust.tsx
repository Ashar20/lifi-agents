import React, { useEffect, useRef } from 'react';

interface DustParticle {
    x: number;
    y: number;
    size: number;
    speedY: number;
    speedX: number;
    opacity: number;
}

const DesertDust: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;
        let particles: DustParticle[] = [];
        const particleCount = 60; // Fewer particles for desert dust

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 3 + 1, // Larger dust particles
                    speedY: Math.random() * 0.3 + 0.1, // Slow floating
                    speedX: Math.random() * 0.2 - 0.1, // Slight horizontal drift
                    opacity: Math.random() * 0.4 + 0.2,
                });
            }
        };

        const update = () => {
            // Desert gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#1A1410'); // stillsuit-black
            gradient.addColorStop(1, '#4E342E'); // arrakis-brown
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Update and draw particles
            particles.forEach(particle => {
                particle.y += particle.speedY;
                particle.x += particle.speedX;

                // Reset particle if it goes off screen
                if (particle.y > height) {
                    particle.y = -10;
                    particle.x = Math.random() * width;
                }
                if (particle.x < 0 || particle.x > width) {
                    particle.x = Math.random() * width;
                }

                // Draw dust particle with spice orange tint
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(216, 67, 21, ${particle.opacity})`; // spice-orange
                ctx.fill();

                // Add slight glow
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(215, 204, 200, ${particle.opacity * 0.2})`; // desert-sand glow
                ctx.fill();
            });

            requestAnimationFrame(update);
        };

        window.addEventListener('resize', resize);
        resize();
        initParticles();
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
            style={{ opacity: 0.5 }}
        />
    );
};

export default DesertDust;
