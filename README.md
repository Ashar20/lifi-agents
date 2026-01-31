# 🌐 LI.FI Agents Orchestrator

> **AI-Powered Multi-Agent Cross-Chain DeFi Orchestrator**  
> Built for HackMoney 2026 - LI.FI Track

A professional cross-chain DeFi orchestrator featuring 7 specialized AI agents working in coordination to optimize cross-chain operations, detect arbitrage opportunities, manage portfolios, and execute routes via LI.FI. Built with React, TypeScript, and powered by Google Gemini AI.

## 🎯 Track: AI x LI.FI Smart App

This project competes in the **"Best AI x LI.FI Smart App"** category, implementing:
- ✅ **Multi-Agent Orchestration**: 7 specialized agents working together
- ✅ **LI.FI Integration**: All cross-chain actions via LI.FI SDK/API
- ✅ **AI-Powered Decisions**: Gemini AI analyzes and decides when to act
- ✅ **Strategy Loop**: Clear monitor → decide → act pattern
- ✅ **Multi-Chain Support**: Ethereum, Arbitrum, Polygon, Optimism, and more

## 🤖 7 Specialized AI Agents

### 1. **Route Strategist** (Commander)
Strategic mastermind coordinating all cross-chain operations and making critical routing decisions.

### 2. **Arbitrage Hunter** (Navigator)
Sharp-eyed scanner detecting price differences across chains for profitable arbitrage opportunities.

### 3. **Portfolio Guardian** (Archivist)
Knowledge vault tracking all cross-chain positions, PnL, and historical performance.

### 4. **Yield Seeker** (Merchant)
Optimistic AI companion finding the best yield opportunities across all chains.

### 5. **Risk Sentinel** (Sentinel)
Cautious analyst validating route safety, slippage tolerance, and bridge security.

### 6. **Rebalancer** (Oracle)
Systematic agent maintaining target portfolio allocations across all chains.

### 7. **Route Executor** (Glitch)
Ultra-fast execution engine running LI.FI routes with minimal latency.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **npm** or **yarn**
- **Google Gemini API Key** ([Get it here](https://makersuite.google.com/app/apikey))
- **Wallet Connect Project ID** (optional, for wallet integration)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lifi-agents-orchestrator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the project root:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_id (optional)
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000`

## 🏗️ Project Structure

```
lifi-agents-orchestrator/
├── components/              # React UI components
│   ├── AgentCard.tsx       # Agent display cards
│   ├── AgentDetailPanel.tsx # Agent task execution interface
│   └── ...
├── services/               # Service layer
│   ├── api.ts             # Gemini AI integration
│   ├── lifi.ts            # LI.FI SDK integration
│   └── strategyLoop.ts    # Monitor → Decide → Act pattern
├── constants.ts           # Agent definitions and configurations
├── types.ts              # TypeScript type definitions
├── App.tsx               # Main application logic
├── index.tsx             # Application entry point
└── package.json          # Project dependencies
```

## 🔧 Technology Stack

### Frontend
- **React 19.2** - Modern UI with concurrent rendering
- **TypeScript 5.8** - Type-safe development
- **Vite 6.2** - Lightning-fast build tool

### DeFi & Cross-Chain
- **LI.FI SDK** - Cross-chain routing and execution
- **Ethers.js** - Ethereum interaction
- **Wagmi** - React hooks for Ethereum
- **Viem** - TypeScript Ethereum library

### AI
- **Google Gemini AI** - Strategy analysis and decision-making
  - Cost: $0.002 per analysis
  - Rate limiting: Smart throttling to prevent quota exhaustion

## 📊 Strategy Loop Implementation

Each agent follows the **Monitor → Decide → Act** pattern:

1. **MONITOR**: Agent gathers current state (prices, positions, yields, etc.)
2. **DECIDE**: Gemini AI analyzes state and decides if action is needed
3. **ACT**: If approved, execute cross-chain route via LI.FI SDK

### Example: Arbitrage Hunter Workflow

```
1. Monitor: Check USDC price on Ethereum vs Arbitrum
2. Detect: 0.5% price difference after fees
3. Decide: AI confirms profitable opportunity
4. Act: Execute LI.FI route: ETH USDC → ARB USDC
5. Report: Track execution and profit
```

## 🎮 Usage

### Basic Operations

1. **Activate Agents** - Select agents from the main interface to activate them
2. **Execute Tasks** - Click on an agent to assign cross-chain tasks
3. **View Results** - Monitor task execution and AI analysis in the console
4. **Auto Mode** - Route Strategist orchestrates coordinated multi-agent operations

### Agent Capabilities

- **Arbitrage Detection**: Automatically finds and executes profitable arbitrage
- **Yield Optimization**: Scans for best yield opportunities across chains
- **Portfolio Rebalancing**: Maintains target allocations automatically
- **Risk Analysis**: Validates route safety before execution
- **Position Tracking**: Monitors all cross-chain positions in real-time

## 🔐 Security & Privacy

- **API Key Security** - Environment variables, never committed to repo
- **Client-side Processing** - All AI analysis happens in browser
- **LocalStorage** - User data stored locally, no external transmission
- **Rate Limiting** - Prevents API quota exhaustion
- **Error Handling** - Graceful fallbacks for API failures

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard:
- `VITE_GEMINI_API_KEY` - Your Google Gemini API key
- `VITE_WALLET_CONNECT_PROJECT_ID` - Your WalletConnect project ID

### Build for Production

```bash
npm run build
```

Deploy the `dist/` folder to your hosting platform.

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- **LI.FI** - Cross-chain liquidity and execution layer
- **Google Gemini AI** - Powering all strategy intelligence
- **React Team** - Modern UI framework
- **Vite** - Next-generation build tool

---

**Built with ❤️ for cross-chain DeFi optimization**
