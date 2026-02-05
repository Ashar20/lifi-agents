// Generate watch-only wallet addresses for Base and Arbitrum
// NOTE: These are for WATCH-ONLY purposes. To create actual wallets with private keys,
// use MetaMask or other wallet software.

import { createWalletClient, http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, arbitrum } from 'viem/chains';

// Generate random private keys (for demonstration - in production, use secure random generation)
function generateRandomPrivateKey(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

async function generateWatchWallets() {
  console.log('🔐 Generating watch-only wallet addresses...\n');
  console.log('⚠️  WARNING: These addresses are for WATCH-ONLY purposes.');
  console.log('⚠️  To create actual wallets, use MetaMask or other wallet software.\n');

  // Generate Base wallet
  const basePrivateKey = generateRandomPrivateKey();
  const baseAccount = privateKeyToAccount(basePrivateKey);
  const baseClient = createWalletClient({
    account: baseAccount,
    chain: base,
    transport: http(),
  });

  // Generate Arbitrum wallet
  const arbitrumPrivateKey = generateRandomPrivateKey();
  const arbitrumAccount = privateKeyToAccount(arbitrumPrivateKey);
  const arbitrumClient = createWalletClient({
    account: arbitrumAccount,
    chain: arbitrum,
    transport: http(),
  });

  const baseAddress = baseAccount.address;
  const arbitrumAddress = arbitrumAccount.address;

  console.log('✅ Generated Wallet Addresses:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 BASE MAINNET:');
  console.log(`   Address: ${baseAddress}`);
  console.log(`   Explorer: https://basescan.org/address/${baseAddress}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 ARBITRUM MAINNET:');
  console.log(`   Address: ${arbitrumAddress}`);
  console.log(`   Explorer: https://arbiscan.io/address/${arbitrumAddress}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📋 To add these as watch-only wallets in the app:');
  console.log('   1. Open the Multi-Wallet Manager (👛 tab)');
  console.log('   2. Click the "+" button');
  console.log('   3. Paste the address and click "Add"\n');

  console.log('💡 To create actual wallets with private keys:');
  console.log('   - Use MetaMask: https://metamask.io/');
  console.log('   - Use WalletConnect compatible wallets\n');

  return {
    base: baseAddress,
    arbitrum: arbitrumAddress,
  };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateWatchWallets()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { generateWatchWallets };
