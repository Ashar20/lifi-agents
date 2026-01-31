import React from 'react';
import { Layers, Zap, Shield, Network, ArrowRight, Activity, Cpu } from 'lucide-react';
import LottieAvatar from './LottieAvatar';

interface LandingPageProps {
  onLaunchApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  return (
    <div className="h-screen bg-[#050505] text-gray-200 font-mono overflow-y-auto overflow-x-hidden">
      {/* Animated Background - neon green glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-neon-green/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-neon-green/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-neon-green/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full">
        {/* Header - matches WalletBar */}
        <header className="h-12 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center px-6 justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <h1 className="text-neon-green font-bold font-mono tracking-wider flex items-center gap-2">
              <Layers size={18} /> LI.FI AGENTS <span className="text-white/40 text-xs font-normal">v2.0</span>
            </h1>
          </div>
          <button
            onClick={onLaunchApp}
            className="px-4 py-1.5 bg-neon-green/10 hover:bg-neon-green/20 rounded border border-neon-green/50 transition-all duration-300 flex items-center gap-2 text-neon-green text-sm font-mono font-bold uppercase tracking-wider"
          >
            Launch App <ArrowRight size={14} />
          </button>
        </header>

        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 my-20 px-6 max-w-7xl mx-auto">
          {/* Left Content */}
          <div className="flex-1 space-y-6">
            <div className="inline-block px-3 py-1.5 bg-neon-green/10 rounded border border-neon-green/30 backdrop-blur-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-neon-green">
                ⚡ Cross-Chain DeFi Orchestration Platform
              </span>
            </div>

            <h2 className="text-4xl lg:text-6xl font-bold leading-tight font-mono">
              <span className="text-neon-green">LI.FI</span>
              <br />
              <span className="text-white/90">AGENTS</span>
              <br />
              <span className="text-white/60">Orchestrator</span>
            </h2>

            <p className="text-base text-gray-400 max-w-2xl leading-relaxed font-mono">
              Deploy intelligent AI agents that <span className="text-neon-green font-bold">optimize cross-chain DeFi operations</span> in real-time. 
              Automate arbitrage detection, yield optimization, portfolio rebalancing, and route execution across multiple blockchains using LI.FI SDK.
              Built for seamless multi-chain DeFi management.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={onLaunchApp}
                className="px-6 py-3 bg-neon-green text-black rounded font-bold text-sm font-mono uppercase tracking-wider hover:shadow-[0_0_20px_rgba(67,255,77,0.5)] transition-all duration-300 flex items-center gap-2"
              >
                <Zap size={16} /> Launch App
              </button>
              <a
                href="https://github.com/lifinance"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded font-bold text-sm font-mono uppercase tracking-wider backdrop-blur-sm border border-white/10 hover:border-neon-green/50 transition-all duration-300"
              >
                View on GitHub
              </a>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-6 font-mono">
              <div>
                <div className="text-2xl font-bold text-neon-green">7</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Agents</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-neon-green">∞</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Tasks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-neon-green">24/7</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Active</div>
              </div>
            </div>
          </div>

          {/* Right - Lion Lottie */}
          <div className="flex-1 flex justify-center items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-neon-green/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="relative bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-neon-green/20">
                <LottieAvatar 
                  animationPath="/lottie/Lion - Breath.json" 
                  width={350} 
                  height={350}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20 px-6 max-w-7xl mx-auto">
          <FeatureCard
            icon={<Network className="text-neon-green" size={24} />}
            title="Multi-Agent System"
            description="7 specialized agents optimizing cross-chain operations"
          />
          <FeatureCard
            icon={<Shield className="text-neon-green" size={24} />}
            title="Route Intelligence"
            description="Real-time arbitrage detection & yield analysis"
          />
          <FeatureCard
            icon={<Zap className="text-neon-green" size={24} />}
            title="Fast Execution"
            description="LI.FI powered cross-chain route execution"
          />
          <FeatureCard
            icon={<Cpu className="text-neon-green" size={24} />}
            title="AI-Powered"
            description="Gemini AI driven strategy optimization"
          />
        </div>

        {/* Agent Showcase */}
        <div className="text-center mb-8 px-6 max-w-7xl mx-auto">
          <h3 className="text-2xl font-bold mb-2 font-mono text-neon-green uppercase tracking-wider">Agent Team</h3>
          <p className="text-gray-500 text-sm font-mono uppercase tracking-wider">7 AI Cross-Chain DeFi Agents</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-6 mb-20 max-w-7xl mx-auto">
          <AgentPreview 
            name="Route Strategist" 
            role="Commander" 
            avatar="/lottie/Lion - Breath.json"
            ability="Command Center coordinating all agents and managing cross-chain strategy"
          />
          <AgentPreview 
            name="Arbitrage Hunter" 
            role="Navigator" 
            avatar="/lottie/running pigeon.json"
            ability="Detecting price differences across chains and identifying profitable arbitrage opportunities"
          />
          <AgentPreview 
            name="Portfolio Guardian" 
            role="Archivist" 
            avatar="/lottie/Duo Attack.json"
            ability="Tracking all cross-chain positions, PnL, and historical performance data"
          />
          <AgentPreview 
            name="Yield Seeker" 
            role="Merchant" 
            avatar="/lottie/Happy Unicorn Dog.json"
            ability="Finding the best yield opportunities across all chains and protocols"
          />
          <AgentPreview 
            name="Risk Sentinel" 
            role="Sentinel" 
            avatar="/lottie/Cute bear dancing.json"
            ability="Validating route safety, analyzing slippage, and ensuring bridge security"
          />
          <AgentPreview 
            name="Rebalancer" 
            role="Oracle" 
            avatar="/lottie/happy fox.json"
            ability="Maintaining target portfolio allocations across all chains automatically"
          />
          <AgentPreview 
            name="Route Executor" 
            role="Glitch" 
            avatar="/lottie/Dragon.json"
            ability="Ultra-fast execution engine running LI.FI routes with minimal latency"
          />
        </div>

        {/* Footer CTA */}
        <div className="my-16 text-center px-6 pb-20 max-w-7xl mx-auto">
          <div className="inline-block p-8 bg-black/40 rounded-xl backdrop-blur-sm border border-neon-green/20">
            <h3 className="text-2xl font-bold mb-3 font-mono text-neon-green uppercase tracking-wider">Ready to Deploy?</h3>
            <p className="text-gray-400 mb-6 max-w-2xl mx-auto font-mono text-sm">
              Experience AI-powered cross-chain DeFi orchestration
            </p>
            <button
              onClick={onLaunchApp}
              className="px-8 py-3 bg-neon-green text-black rounded font-bold text-sm font-mono uppercase tracking-wider hover:shadow-[0_0_20px_rgba(67,255,77,0.5)] transition-all duration-300 flex items-center gap-2 mx-auto"
            >
              <Zap size={16} /> Launch App Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => {
  return (
    <div className="p-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 hover:border-neon-green/50 transition-all duration-300">
      <div className="mb-3">{icon}</div>
      <h4 className="text-sm font-bold mb-1 font-mono uppercase tracking-wider text-white/90">{title}</h4>
      <p className="text-xs text-gray-500 font-mono">{description}</p>
    </div>
  );
};

const AgentPreview: React.FC<{ 
  name: string; 
  role: string; 
  avatar: string;
  ability: string;
}> = ({ name, role, avatar, ability }) => {
  return (
    <div className="p-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 hover:border-neon-green/50 transition-all duration-300 group cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-neon-green animate-pulse"></div>
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10">
            <LottieAvatar 
              animationPath={avatar}
              width={64}
              height={64}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm font-mono text-white/90 mb-0.5">{name}</div>
          <div className="text-[10px] text-neon-green font-mono uppercase tracking-wider">{role}</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 font-mono leading-relaxed">{ability}</p>
    </div>
  );
};

export default LandingPage;
