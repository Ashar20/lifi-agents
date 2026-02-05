// Display wallet addresses for adding funds
// Shows connected wallet address and watch-only addresses

import { getWalletAddress } from '../hooks/useWallet';

function showWalletAddresses() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     💰 Wallet Addresses for Adding Funds              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Get wallet address from localStorage or fallback
  const walletAddress = getWalletAddress();
  
  console.log('📍 YOUR WALLET ADDRESS (Works on ALL chains):\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   ${walletAddress}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🌐 This address works on:');
  console.log('   • Ethereum Mainnet');
  console.log('   • Base Mainnet');
  console.log('   • Arbitrum Mainnet');
  console.log('   • Optimism Mainnet');
  console.log('   • Polygon Mainnet');
  console.log('   • Avalanche Mainnet\n');

  console.log('📋 Explorer Links:\n');
  console.log(`   Ethereum:  https://etherscan.io/address/${walletAddress}`);
  console.log(`   Base:      https://basescan.org/address/${walletAddress}`);
  console.log(`   Arbitrum:  https://arbiscan.io/address/${walletAddress}`);
  console.log(`   Optimism:  https://optimistic.etherscan.io/address/${walletAddress}`);
  console.log(`   Polygon:   https://polygonscan.com/address/${walletAddress}\n`);

  console.log('💡 How to Add Funds:\n');
  console.log('   1. Copy the address above');
  console.log('   2. Send funds from an exchange or another wallet');
  console.log('   3. Make sure you\'re on the correct network:');
  console.log('      - For Base: Switch to Base network');
  console.log('      - For Arbitrum: Switch to Arbitrum network');
  console.log('   4. Funds will appear in your wallet\n');

  console.log('⚠️  IMPORTANT:\n');
  console.log('   • This is the SAME address on all chains');
  console.log('   • You only need ONE wallet address');
  console.log('   • Switch networks in MetaMask to see balances\n');

  // Check if there are watch-only wallets
  try {
    const multiWalletData = localStorage.getItem('multiWallet');
    if (multiWalletData) {
      const data = JSON.parse(multiWalletData);
      if (data.wallets && data.wallets.length > 0) {
        console.log('👀 Watch-Only Wallets:\n');
        data.wallets.forEach((wallet: any, index: number) => {
          if (wallet.isWatching) {
            console.log(`   ${index + 1}. ${wallet.address} (${wallet.label || 'Unnamed'})`);
          }
        });
        console.log('');
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return walletAddress;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  showWalletAddresses();
}

export { showWalletAddresses };
