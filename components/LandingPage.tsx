import React, { useEffect, useRef } from 'react';
import { Zap, Shield, Network, ArrowRight, Activity, Hexagon, Eye, Map, Database, CircleDollarSign, Radio } from 'lucide-react';
import SpotlightCard from './ui/SpotlightCard';
import Magnet from './ui/Magnet';
import ShinyText from './ui/ShinyText';

// === Dune-Inspired Agents Data ===
const AGENTS = [
  {
    name: 'Paul Atreides',
    role: 'Commander',
    desc: 'Coordinates all agents, approves routes, strategic decisions',
    icon: Eye,
    color: 'text-cyan-400' // Fremen Eyes
  },
  {
    name: 'Chani',
    role: 'Navigator',
    desc: 'Detects arbitrage opportunities across chains',
    icon: Map,
    color: 'text-amber-600' // Desert Spring
  },
  {
    name: 'Irulan',
    role: 'Archivist',
    desc: 'Tracks positions, PnL, and historical performance',
    icon: Database,
    color: 'text-stone-300' // Imperial Records
  },
  {
    name: 'Liet-Kynes',
    role: 'Merchant',
    desc: 'Finds best yield opportunities (APY) across protocols',
    icon: CircleDollarSign,
    color: 'text-sky-600' // Water is Life (No Green)
  },
  {
    name: 'Duncan Idaho',
    role: 'Sentinel',
    desc: 'Validates route safety, slippage, and bridge security',
    icon: Shield,
    color: 'text-red-500' // Atreides Guard
  },
  {
    name: 'Thufir Hawat',
    role: 'Oracle',
    desc: 'Monitors allocations, detects drift, rebalances',
    icon: Activity,
    color: 'text-purple-400' // Mentat
  },
  {
    name: 'Stilgar',
    role: 'Glitch',
    desc: 'Executes LI.FI routes with minimal latency',
    icon: Zap,
    color: 'text-orange-500' // Tabr Sietch
  }
];

// === SandStorm Background Component ===
const SandStorm: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0, height = 0;
    let particles: { x: number; y: number; speed: number; size: number; color: string }[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const initParticles = () => {
      particles = [];
      const count = width < 768 ? 150 : 350; // Increased density
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: Math.random() * 1.5 + 0.2, // Slower, more floating
          size: Math.random() * 2.5,
          // Gold, Amber, and Deep Dust colors
          color: Math.random() > 0.6 ? 'rgba(217, 119, 6, 0.4)' : Math.random() > 0.5 ? 'rgba(146, 64, 14, 0.3)' : 'rgba(251, 191, 36, 0.2)'
        });
      }
    };

    const update = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.x += p.speed;
        p.y += Math.sin(p.x * 0.005) * 0.3; // Gentle wavy motion

        // Loop around
        if (p.x > width) p.x = 0;

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(update);
    };

    window.addEventListener('resize', resize);
    resize();
    initParticles();
    const animId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none -z-10 opacity-50 mix-blend-screen" />;
};

interface LandingPageProps {
  onLaunchApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  return (
    <div className="min-h-screen bg-[#0c0a08] text-amber-50 overflow-x-hidden relative selection:bg-amber-500/30 selection:text-amber-200">
      <SandStorm />

      {/* Atmospheric Glows - Deep Orange/Red/Gold */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-amber-900/10 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-orange-950/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      <div className="relative z-10 w-full flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-24 flex items-center px-6 md:px-12 justify-between sticky top-0 z-50 backdrop-blur-md border-b border-amber-900/40 bg-[#0c0a08]/80">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-600/20 rounded-full blur-md group-hover:blur-lg transition-all duration-300"></div>
              <Hexagon className="relative z-10 text-amber-600 animate-spin-slow" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-dune tracking-[0.2em] text-amber-100 group-hover:text-amber-400 transition-colors duration-300">
                LI.FI <span className="text-amber-700">AGENTS</span>
              </h1>
            </div>
          </div>
          <Magnet>
            <button
              onClick={onLaunchApp}
              className="group relative px-6 py-2 bg-transparent overflow-hidden rounded-sm border border-amber-500/40 hover:border-amber-400 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-amber-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative flex items-center gap-2 text-amber-400 font-mono font-bold tracking-wider text-xs uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Enter Terminal <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Magnet>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative">
          <div className="max-w-6xl mx-auto space-y-12 relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-950/30 border border-amber-500/20 backdrop-blur-md animate-fade-in shadow-[0_0_15px_rgba(217,119,6,0.1)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
              <span className="text-xs font-dune-tech text-amber-300/80 tracking-[0.3em] uppercase">Spice Flow: Optimal</span>
            </div>

            {/* Smaller Title as requested */}
            <h1 className="text-4xl md:text-6xl font-black font-dune-rise tracking-tight leading-snug relative uppercase">
              <div className="absolute -inset-1 text-transparent bg-clip-text bg-gradient-to-b from-amber-500/20 to-transparent blur-xl select-none pointer-events-none">
                <ShinyText speed={3}>Cross-Chain</ShinyText>
                <br />
                <ShinyText speed={4}>Intelligence</ShinyText>
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-amber-100 via-amber-200 to-amber-800 drop-shadow-2xl">
                <ShinyText speed={3}>Cross-Chain</ShinyText>
                <br />
                <ShinyText speed={4}>Intelligence</ShinyText>
              </span>
            </h1>

            <p className="max-w-3xl mx-auto text-lg md:text-xl text-stone-400 font-serif italic leading-relaxed tracking-wide">
              "The mystery of life isn't a problem to solve, but a reality to experience."
              <br />
              <span className="not-italic font-sans text-amber-200/80 mt-4 block text-base font-light">
                Deploy <span className="text-amber-500 font-bold border-b border-amber-500/50">The Seven Agents</span> to navigate the deep desert of decentralized finance.
              </span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-8">
              <Magnet strength={40}>
                <button
                  onClick={onLaunchApp}
                  className="group relative px-10 py-5 bg-amber-700/90 text-stone-950 font-dune font-bold tracking-[0.15em] text-base rounded-sm overflow-hidden hover:bg-amber-600 transition-all duration-500 shadow-[0_0_30px_rgba(180,83,9,0.4)]"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 skew-y-12"></div>
                  <span className="relative flex items-center gap-3">
                    <Eye size={20} className="text-stone-950" />
                    INITIALIZE SYSTEM
                  </span>
                </button>
              </Magnet>

              <Magnet strength={20}>
                <a
                  href="https://github.com/lifinance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 text-white font-mono font-bold tracking-wider text-lg rounded border border-white/20 hover:bg-white/5 transition-all duration-300 backdrop-blur-sm flex items-center gap-2"
                >
                  <Network size={20} />
                  VIEW SOURCE
                </a>
              </Magnet>
            </div>
          </div>
        </main>

        {/* HUD Stats */}
        <div className="border-y border-amber-900/30 bg-[#0c0a08]/60 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
          <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-12">
            <StatItem label="Active Agents" value="7" />
            <StatItem label="Systems" value="20+" />
            <StatItem label="Spice Flow" value="99.9%" />
            <StatItem label="Latency" value="<100ms" />
          </div>
        </div>

        {/* The 7 Agents Section */}
        <div className="px-6 py-32 max-w-[90rem] mx-auto w-full relative">
          {/* Ornamentation */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-amber-500/0 via-amber-500/50 to-amber-500/0"></div>

          <div className="flex flex-col items-center gap-6 mb-20">
            <h2 className="text-3xl md:text-4xl font-dune font-bold text-amber-500 tracking-[0.2em] text-center shadow-amber-500/20 drop-shadow-xl">THE COUNCIL OF SEVEN</h2>
            <div className="flex items-center gap-4 w-full max-w-md">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-900"></div>
              <div className="w-3 h-3 rotate-45 border border-amber-600 bg-amber-900/50"></div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-900"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {AGENTS.map((agent, index) => (
              <SpotlightCard
                key={agent.name}
                className="h-full border-amber-900/40 bg-stone-950/40 group hover:border-amber-500/50 transition-all duration-500 backdrop-blur-sm"
                spotlightColor="rgba(217, 119, 6, 0.15)"
              >
                <div className="p-8 flex flex-col h-full relative z-10">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-3 rounded-lg bg-stone-900/80 border border-white/5 ${agent.color} shadow-[0_0_15px_-3px_currentColor]`}>
                      <agent.icon size={28} />
                    </div>
                    <span className="font-dune-tech text-[10px] text-stone-600 uppercase tracking-widest border border-stone-800 px-2 py-1 rounded">
                      IV - 0{index + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-dune font-bold text-amber-100 mb-2 group-hover:text-amber-400 transition-colors">
                      {agent.name.toUpperCase()}
                    </h3>
                    <div className="text-xs font-dune-tech text-amber-700 uppercase tracking-widest mb-4">
                      {agent.role}
                    </div>
                    <p className="text-sm text-stone-500 font-sans leading-relaxed border-t border-white/5 pt-4">
                      {agent.desc}
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            ))}

            <SpotlightCard className="h-full border-dashed border-amber-900/20 bg-transparent flex flex-col items-center justify-center p-8 group hover:border-amber-700/40 transition-colors duration-500">
              <div className="w-16 h-16 rounded-full bg-amber-900/5 flex items-center justify-center mb-4 group-hover:bg-amber-900/10 transition-colors">
                <Radio className="text-stone-700 group-hover:text-amber-600 animate-pulse" />
              </div>
              <h3 className="text-stone-600 font-dune tracking-widest text-xs text-center">AWAITING SIGNAL</h3>
            </SpotlightCard>

          </div>
        </div>

        {/* Footer */}
        <footer className="py-12 text-center border-t border-amber-900/20 bg-[#050403] relative z-10">
          <p className="text-stone-700 text-xs font-mono tracking-[0.3em] hover:text-amber-800 transition-colors cursor-default">
            LI.FI AGENTS // SYSTEM VERSION v2.0.4
          </p>
        </footer>
      </div>
    </div>
  );
};

const StatItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center border-l border-amber-900/20 first:border-0 relative group">
    <div className="text-4xl md:text-5xl font-bold font-dune-tech text-amber-100 mb-2 tracking-tighter group-hover:text-amber-400 transition-colors shadow-none">{value}</div>
    <div className="text-[10px] text-amber-800 font-dune-tech uppercase tracking-[0.2em]">{label}</div>
  </div>
);

export default LandingPage;
