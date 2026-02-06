import React from 'react';
import { Layers, Zap, Shield, Network, ArrowRight, Activity, Cpu, Hexagon } from 'lucide-react';
import LottieAvatar from './LottieAvatar';
import StarField from './ui/StarField';
import HoloCard from './ui/HoloCard';

interface LandingPageProps {
  onLaunchApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans overflow-x-hidden relative selection:bg-neon-green/30 selection:text-neon-green">
      <StarField />

      {/* Animated Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-neon-green/5 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 flex items-center px-6 md:px-12 justify-between sticky top-0 z-50 backdrop-blur-sm border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-neon-green/20 rounded-full blur-md group-hover:blur-lg transition-all duration-300"></div>
              <Hexagon className="relative z-10 text-neon-green animate-pulse-glow" size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-wider text-white group-hover:text-neon-green transition-colors duration-300">
                LI.FI <span className="text-white/50">AGENTS</span>
              </h1>
            </div>
          </div>
          <button
            onClick={onLaunchApp}
            className="group relative px-6 py-2 bg-transparent overflow-hidden rounded border border-neon-green/30 hover:border-neon-green/80 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-neon-green/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative flex items-center gap-2 text-neon-green font-mono font-bold tracking-wider text-sm">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></span>
              LAUNCH TERMINAL <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative">
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></span>
              <span className="text-xs font-mono text-neon-green tracking-[0.2em] uppercase">System Operational v2.0</span>
            </div>

            <h1 className="text-6xl md:text-8xl font-black font-mono tracking-tighter leading-tight relative">
              <div className="absolute -inset-1 text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-transparent blur-xl select-none pointer-events-none">
                CROSS-CHAIN
                <br />
                INTELLIGENCE
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-gray-200 to-gray-500">
                CROSS-CHAIN
                <br />
                INTELLIGENCE
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 font-light leading-relaxed tracking-wide">
              Orchestrate decentralized finance across multiple blockchains.
              <br />
              Deploy <span className="text-neon-green font-mono font-bold">7 Autonomous Agents</span> to optimize yield, arbitrage, and routing in real-time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
              <button
                onClick={onLaunchApp}
                className="group relative px-8 py-4 bg-neon-green text-black font-mono font-bold tracking-wider text-lg rounded overflow-hidden hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(57,255,20,0.4)]"
              >
                <div className="absolute inset-0 bg-white/40 translate-y-full group-hover:translate-y-0 transition-transform duration-300 skew-y-12"></div>
                <span className="relative flex items-center gap-2">
                  <Zap size={20} className="fill-current" />
                  INITIALIZE SYSTEM
                </span>
              </button>

              <a
                href="https://github.com/lifinance"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 text-white font-mono font-bold tracking-wider text-lg rounded border border-white/20 hover:bg-white/5 transition-all duration-300 backdrop-blur-sm flex items-center gap-2"
              >
                <Network size={20} />
                VIEW SOURCE
              </a>
            </div>
          </div>

          {/* Floating Elements (Decorative) */}
          <div className="absolute top-1/2 left-10 md:left-20 w-32 h-32 border border-white/5 rounded-full animate-spin-slow opacity-20 hidden md:block"></div>
          <div className="absolute top-1/2 right-10 md:right-20 w-48 h-48 border border-white/10 rounded-full animate-spin-slow opacity-20 hidden md:block" style={{ animationDirection: 'reverse' }}></div>
        </main>

        {/* HUD Stats */}
        <div className="border-y border-white/5 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem label="Active Agents" value="7" />
            <StatItem label="Networks" value="20+" />
            <StatItem label="Uptime" value="99.9%" />
            <StatItem label="Route Latency" value="<100ms" />
          </div>
        </div>

        {/* Feature Grid */}
        <div className="px-6 py-24 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <h2 className="text-2xl font-mono font-bold text-neon-green tracking-[0.2em]">SYSTEM CAPABILITIES</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <HoloCard className="p-6 group">
              <Network className="text-neon-green mb-4 group-hover:scale-110 transition-transform duration-300" size={32} />
              <h3 className="text-lg font-bold font-mono text-white mb-2">Multi-Agent Swarm</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Coordinated team of 7 specialized AI agents working in sync.</p>
            </HoloCard>
            <HoloCard className="p-6 group">
              <Activity className="text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300" size={32} />
              <h3 className="text-lg font-bold font-mono text-white mb-2">Real-Time Arb</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Milliseconds latency arbitrage detection across chains.</p>
            </HoloCard>
            <HoloCard className="p-6 group">
              <Shield className="text-purple-400 mb-4 group-hover:scale-110 transition-transform duration-300" size={32} />
              <h3 className="text-lg font-bold font-mono text-white mb-2">Safety Sentinel</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Automated risk analysis and bridge security validation.</p>
            </HoloCard>
            <HoloCard className="p-6 group">
              <Cpu className="text-orange-400 mb-4 group-hover:scale-110 transition-transform duration-300" size={32} />
              <h3 className="text-lg font-bold font-mono text-white mb-2">AI Core</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Powered by Gemini for advanced reasoning and strategy.</p>
            </HoloCard>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 text-center text-gray-600 text-xs font-mono border-t border-white/5">
          <p>LI.FI AGENTS ORCHESTRATOR // SYSTEM VERSION 2.0.4</p>
        </footer>
      </div>
    </div>
  );
};

const StatItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center border-l border-white/5 first:border-0">
    <div className="text-3xl md:text-4xl font-bold font-mono text-white mb-1 tracking-tighter">{value}</div>
    <div className="text-xs text-neon-green font-mono uppercase tracking-widest">{label}</div>
  </div>
);

export default LandingPage;
