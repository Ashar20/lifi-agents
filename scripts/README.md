# 🧪 Testnet Swap Script

This script demonstrates a real LI.FI swap on Sepolia testnet.

## What it does:

1. **Creates a testnet wallet** (or uses existing one from env)
2. **Checks balances** (ETH for gas, USDC for swap)
3. **Gets LI.FI quote** for USDC → WETH swap
4. **Executes the swap** via LI.FI SDK

## Prerequisites:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get testnet ETH:**
   - Visit: https://sepoliafaucet.com/
   - Or: https://faucet.quicknode.com/ethereum/sepolia
   - Send to your wallet address

3. **Get testnet USDC:**
   - Visit: https://faucet.circle.com/
   - Select "Sepolia" network
   - Connect your wallet
   - Request USDC (minimum 1 USDC needed)

## Usage:

### Option 1: Auto-generate wallet (first time)
```bash
npm run testnet-swap
```

The script will:
- Generate a new wallet
- Show you the private key (SAVE IT!)
- Check balances
- Execute swap if you have funds

### Option 2: Use existing wallet
1. Add your private key to `.env`:
   ```env
   TESTNET_PRIVATE_KEY=0x...
   ```

2. Run the script:
   ```bash
   npm run testnet-swap
   ```

## Expected Output:

```
╔════════════════════════════════════════════════════════╗
║     🧪 LI.FI Testnet Swap Demo                         ║
╚════════════════════════════════════════════════════════╝

🔑 Generating new testnet wallet...
⚠️  IMPORTANT: Save this private key for future use:
   0x...
   Add to .env: TESTNET_PRIVATE_KEY=0x...

✅ Wallet created: 0x...

📊 Checking wallet balance...
   ETH Balance: 0.1 ETH
   USDC Balance: 10.0 USDC

🔍 Getting LI.FI quote for USDC -> WETH swap...

✅ Quote received!
   From: 1.0 USDC
   To: ~0.0005 WETH
   Gas Cost: ~$0.01
   Steps: 1

🚀 Executing swap via LI.FI...
   📝 Sending transaction...
   ✅ Transaction sent: 0x...
   📍 Status: DONE

🎉 Swap completed successfully!
   Transaction Hash: 0x...
   View on Etherscan: https://sepolia.etherscan.io/tx/0x...

📊 Checking final balances...
   USDC: 9.0 USDC
   WETH: 0.0005 ETH

✅ Testnet swap demo completed!
```

## Troubleshooting:

### "Insufficient ETH for gas"
- Get more testnet ETH from faucets above
- Need at least 0.001 ETH

### "Insufficient USDC for swap"
- Get testnet USDC from https://faucet.circle.com/
- Need at least 1 USDC

### "No quote available"
- Testnet liquidity can be low
- Try a smaller amount or different token pair
- Wait a few minutes and try again

## Security Notes:

⚠️ **NEVER share your private key!**
- The generated private key is for TESTNET ONLY
- Never use testnet keys on mainnet
- Never commit private keys to git

## Next Steps:

Once the swap works, you can:
1. Try cross-chain swaps (Sepolia → Arbitrum Sepolia)
2. Try different token pairs
3. Integrate into the main app UI
