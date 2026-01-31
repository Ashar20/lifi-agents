Core Idea

Build an intent-based cross-chain arbitrage and yield router that treats all EVM chains as one pool of capital.

Users do not choose chains, bridges, or swaps.
They only express what they want to achieve.

Everything else is automated using LI.FI.

The Mental Model (Very Important)

Today:

“I have USDC on Arbitrum → bridge to Optimism → swap → deposit into protocol.”

Your product:

“I have capital → make it work better → move it automatically if needed.”

Chains become an implementation detail.

The One-Sentence Idea (Judge Friendly)

An intent-driven cross-chain engine that automatically moves capital across EVM chains to capture better yield or arbitrage opportunities using LI.FI as the execution layer.

What Makes This Interesting (Skeptical View)

Most hackathon projects:

Do one cross-chain swap

Or wrap LI.FI into a UI

This idea:

Uses LI.FI repeatedly as a decision executor

Shows why cross-chain matters

Proves value beyond “one swap”

The Simplest Working Version (MVP Idea)
User says:

“Use my USDC from anywhere and always deploy it where yield is higher.”

System does:

Checks yield on Protocol A (Chain X)

Checks yield on Protocol B (Chain Y)

If delta > threshold:

Swap

Bridge

Deposit
using one LI.FI Composer flow

Concrete Use Cases (Pick 1–2 Only)
1️⃣ Cross-Chain Yield Rotation (Strongest)

User deposits USDC on any chain

System periodically:

Compares APY across chains

Moves capital to the best one

Fully automated

Why judges like it:

Real DeFi pain

Clear ROI

Clear LI.FI usage

2️⃣ Cross-Chain Arbitrage Executor

Monitor price / funding rate differences

When profitable:

Buy on Chain A

Bridge

Sell or hedge on Chain B

Profit routed back automatically

Why judges like it:

Shows intent → execution

Uses LI.FI as infrastructure, not a feature