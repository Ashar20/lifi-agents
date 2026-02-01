// Testnet Swap Script
// Creates a wallet, gets testnet USDC, and performs a swap using LI.FI

// Load environment variables
import { config } from 'dotenv';
config();

import { LiFi } from '@lifi/sdk';
import { createWalletClient, http, parseUnits, formatUnits, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';

// Testnet configuration
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // Circle USDC on Sepolia
const SEPOLIA_WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'; // Wrapped ETH on Sepolia

// Initialize LI.FI SDK
const lifi = new LiFi({
  integrator: 'lifi-agents-testnet-swap',
});

// RPC endpoint for Sepolia
// Using multiple fallback RPCs for reliability
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 
  'https://ethereum-sepolia-rpc.publicnode.com' ||
  'https://rpc.sepolia.org';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     🧪 LI.FI Testnet Swap Demo                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Step 1: Generate or use existing private key
  let privateKey: `0x${string}`;
  const savedKey = process.env.TESTNET_PRIVATE_KEY;
  
  if (savedKey) {
    console.log('📝 Using existing private key from env...');
    privateKey = savedKey as `0x${string}`;
  } else {
    console.log('🔑 Generating new testnet wallet...');
    privateKey = generatePrivateKey();
    console.log('⚠️  IMPORTANT: Save this private key for future use:');
    console.log(`   ${privateKey}`);
    console.log('   Add to .env: TESTNET_PRIVATE_KEY=' + privateKey);
  }

  // Create account and wallet client
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC, {
      timeout: 30000,
      retryCount: 3,
    }),
  });

  const walletAddress = account.address;
  console.log(`\n✅ Wallet created: ${walletAddress}`);

  // Step 2: Check balance
  console.log('\n📊 Checking wallet balance...');
  const { createPublicClient } = await import('viem');
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC, {
      timeout: 30000, // 30 second timeout
      retryCount: 3,
    }),
  });
  
  let balance;
  try {
    balance = await publicClient.getBalance({ address: walletAddress });
  } catch (error: any) {
    if (error.message?.includes('timeout') || error.message?.includes('404')) {
      console.log('⚠️  RPC endpoint is slow or unavailable.');
      console.log('   Try setting a custom RPC in .env:');
      console.log('   SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY');
      console.log('   Or use Alchemy: https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY');
      process.exit(1);
    }
    throw error;
  }
  
  const balanceEth = formatUnits(balance, 18);
  console.log(`   ETH Balance: ${balanceEth} ETH`);

  if (parseFloat(balanceEth) < 0.001) {
    console.log('\n⚠️  WARNING: Insufficient ETH for gas!');
    console.log('   You need at least 0.001 ETH on Sepolia for gas.');
    console.log('   Get testnet ETH from: https://sepoliafaucet.com/');
    console.log('   Or use: https://faucet.quicknode.com/ethereum/sepolia');
    process.exit(1);
  }

  // Check USDC balance

  const usdcAbi = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function',
    },
  ] as const;

  const usdcBalance = await publicClient.readContract({
    address: SEPOLIA_USDC,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [walletAddress],
  });

  const decimals = await publicClient.readContract({
    address: SEPOLIA_USDC,
    abi: usdcAbi,
    functionName: 'decimals',
  });

  const usdcBalanceFormatted = formatUnits(usdcBalance, decimals);
  console.log(`   USDC Balance: ${usdcBalanceFormatted} USDC`);

  if (parseFloat(usdcBalanceFormatted) < 1) {
    console.log('\n⚠️  WARNING: Insufficient USDC for swap!');
    console.log('   You need at least 1 USDC on Sepolia.');
    console.log('   Get testnet USDC from: https://faucet.circle.com/');
    console.log('   Select "Sepolia" network and connect your wallet.');
    console.log(`   Wallet address: ${walletAddress}`);
    process.exit(1);
  }

  // Step 3: Check if LI.FI supports Sepolia
  console.log('\n🔍 Checking LI.FI supported chains...');
  const chains = await lifi.getChains();
  const sepoliaChain = chains.find(c => c.id === SEPOLIA_CHAIN_ID);
  
  if (!sepoliaChain) {
    console.log('⚠️  Sepolia is not supported by LI.FI for swaps.');
    console.log('   LI.FI primarily supports mainnet chains.');
    console.log('\n💡 Performing direct Uniswap swap on Sepolia instead...');
    console.log('   (This demonstrates real on-chain execution without LI.FI)');
    
    // Perform direct Uniswap swap
    await performDirectUniswapSwap(
      publicClient,
      walletClient,
      walletAddress,
      SEPOLIA_USDC,
      SEPOLIA_WETH,
      parseUnits('1', decimals),
      decimals
    );
    return;
  }

  // Step 4: Get LI.FI quote (USDC -> WETH on same chain)
  console.log('\n🔍 Getting LI.FI quote for USDC -> WETH swap...');
  const swapAmount = parseUnits('1', decimals); // Swap 1 USDC

  try {
    const quote = await lifi.getQuote({
      fromChain: SEPOLIA_CHAIN_ID as any,
      toChain: SEPOLIA_CHAIN_ID as any, // Same chain swap
      fromToken: SEPOLIA_USDC,
      toToken: SEPOLIA_WETH,
      fromAmount: swapAmount.toString(),
      fromAddress: walletAddress,
      toAddress: walletAddress,
    });

    if (!quote) {
      console.log('❌ No quote available. This might be a liquidity issue on testnet.');
      console.log('   Try a smaller amount or different token pair.');
      process.exit(1);
    }

    console.log('\n✅ Quote received!');
    console.log(`   From: ${formatUnits(swapAmount, decimals)} USDC`);
    console.log(`   To: ~${formatUnits(BigInt(quote.estimate.toAmount), 18)} WETH`);
    console.log(`   Gas Cost: ~$${quote.estimate.gasCosts?.[0]?.amountUSD || '0'}`);
    console.log(`   Steps: ${quote.steps.length}`);

    // Step 4: Execute the swap
    console.log('\n🚀 Executing swap via LI.FI...');
    console.log('   This will require wallet signature...\n');

    const execution = await lifi.executeRoute(quote, {
      async sendTransaction(txRequest: any) {
        console.log('   📝 Sending transaction...');
        const hash = await walletClient.sendTransaction({
          to: txRequest.to as Address,
          data: txRequest.data as `0x${string}`,
          value: txRequest.value ? BigInt(txRequest.value) : undefined,
          gas: txRequest.gasLimit ? BigInt(txRequest.gasLimit) : undefined,
        });
        console.log(`   ✅ Transaction sent: ${hash}`);
        return { hash };
      },
      updateRouteHook(route: any) {
        const step = route.steps?.[0];
        if (step?.execution?.status) {
          console.log(`   📍 Status: ${step.execution.status}`);
        }
      },
    });

    console.log('\n🎉 Swap completed successfully!');
    console.log(`   Transaction Hash: ${execution.steps?.[0]?.execution?.txHash}`);
    console.log(`   View on Etherscan: https://sepolia.etherscan.io/tx/${execution.steps?.[0]?.execution?.txHash}`);

    // Check final balance
    console.log('\n📊 Checking final balances...');
    const finalUsdcBalance = await publicClient.readContract({
      address: SEPOLIA_USDC,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    const finalWethBalance = await publicClient.getBalance({ address: walletAddress });
    
    console.log(`   USDC: ${formatUnits(finalUsdcBalance, decimals)} USDC`);
    console.log(`   WETH: ${formatUnits(finalWethBalance, 18)} ETH`);

    console.log('\n✅ Testnet swap demo completed!\n');

  } catch (error: any) {
    console.error('\n❌ Swap failed:', error.message);
    if (error.message?.includes('insufficient funds')) {
      console.log('   You need more ETH for gas or USDC for the swap.');
    }
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
