# Wallet Creation Guide

## ⚠️ Important Security Note
**I cannot create actual wallets with private keys for you.** This is a security best practice. You should create wallets yourself using trusted wallet software.

## Option 1: Create Wallets Using MetaMask (Recommended)

### For Base Mainnet:
1. Install MetaMask: https://metamask.io/
2. Create a new wallet or use an existing one
3. Add Base network:
   - Network Name: Base
   - RPC URL: https://mainnet.base.org
   - Chain ID: 8453
   - Currency Symbol: ETH
   - Block Explorer: https://basescan.org
4. Your wallet address will work on Base mainnet

### For Arbitrum Mainnet:
1. Use the same MetaMask wallet (one wallet works on all EVM chains)
2. Add Arbitrum network:
   - Network Name: Arbitrum One
   - RPC URL: https://arb1.arbitrum.io/rpc
   - Chain ID: 42161
   - Currency Symbol: ETH
   - Block Explorer: https://arbiscan.io
3. Your wallet address will work on Arbitrum mainnet

## Option 2: Add Watch-Only Addresses

If you want to monitor existing addresses (that you don't control):

1. Open the LI.FI Agents Orchestrator app
2. Click the **👛 (Wallet)** tab in the right panel
3. Click the **+** button
4. Paste the wallet address you want to watch
5. Click **Add**

This allows you to monitor balances and transactions without connecting the wallet.

## Adding Wallets to the App

Once you have wallet addresses:

### Method 1: Connect Your Wallet
1. Click **Connect Wallet** in the app
2. Select MetaMask or your wallet provider
3. Approve the connection
4. The wallet will automatically be added to Multi-Wallet Manager

### Method 2: Add as Watch-Only
1. Go to **Multi-Wallet Manager** (👛 tab)
2. Click the **+** button
3. Enter the wallet address
4. Click **Add**

## Example Wallet Addresses (For Testing Watch-Only Feature)

You can test the watch-only feature with these public addresses:

- **Base Mainnet**: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (Vitalik's address)
- **Arbitrum Mainnet**: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (same address, works on all chains)

## Security Best Practices

1. **Never share your private keys** with anyone
2. **Never enter private keys** into websites or apps
3. **Use hardware wallets** for large amounts
4. **Backup your seed phrase** securely
5. **Verify addresses** before sending funds

## Need Help?

- MetaMask Support: https://support.metamask.io/
- LI.FI Docs: https://docs.li.fi/
