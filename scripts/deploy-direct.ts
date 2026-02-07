// Direct deployment script using ethers (no Hardhat required)
// Run: npx tsx scripts/deploy-direct.ts

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Contract bytecode and ABI (compiled with solc)
// These will be filled after compilation

const ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';

// Simplified ABI for deployment
const REGISTRY_ABI = [
  'constructor()',
  'function addAuthorizedCaller(address caller)',
  'function admin() view returns (address)',
];

const VAULT_ABI = [
  'constructor(address _registry)',
];

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey || privateKey === '') {
    console.error('❌ DEPLOYER_PRIVATE_KEY not set in .env');
    console.log('\nPlease add your deployment wallet private key to .env:');
    console.log('DEPLOYER_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  console.log('🚀 Deploying Agent Registry to Arbitrum Mainnet...\n');

  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Deployer address:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.error('❌ No ETH balance. Please fund your wallet with ARB ETH for gas.');
    process.exit(1);
  }

  // Check if compiled contracts exist
  const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts');

  if (!fs.existsSync(artifactsPath)) {
    console.log('\n⚠️  Contracts not compiled yet.');
    console.log('To compile, you need Node.js 22 LTS and run:');
    console.log('  npx hardhat compile\n');
    console.log('Alternatively, use Remix IDE (https://remix.ethereum.org):');
    console.log('1. Copy contracts/*.sol to Remix');
    console.log('2. Compile with Solidity 0.8.20');
    console.log('3. Deploy to Arbitrum using Injected Provider\n');

    console.log('Or use Foundry (https://getfoundry.sh):');
    console.log('  forge create contracts/AgentRegistry.sol:AgentRegistry --rpc-url https://arb1.arbitrum.io/rpc --private-key $DEPLOYER_PRIVATE_KEY');
    process.exit(1);
  }

  // Load compiled artifacts
  const registryArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsPath, 'AgentRegistry.sol', 'AgentRegistry.json'), 'utf8')
  );
  const vaultArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsPath, 'AgentVault.sol', 'AgentVault.json'), 'utf8')
  );

  // Deploy Registry
  console.log('\n1. Deploying AgentRegistry...');
  const RegistryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    wallet
  );
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log('   ✅ AgentRegistry:', registryAddress);

  // Deploy Vault
  console.log('\n2. Deploying AgentVault...');
  const VaultFactory = new ethers.ContractFactory(
    vaultArtifact.abi,
    vaultArtifact.bytecode,
    wallet
  );
  const vault = await VaultFactory.deploy(registryAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log('   ✅ AgentVault:', vaultAddress);

  // Authorize vault
  console.log('\n3. Authorizing AgentVault in Registry...');
  const registryContract = new ethers.Contract(registryAddress, REGISTRY_ABI, wallet);
  const tx = await registryContract.addAuthorizedCaller(vaultAddress);
  await tx.wait();
  console.log('   ✅ Authorized!');

  // Summary
  console.log('\n========================================');
  console.log('🎉 DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('Network: Arbitrum Mainnet (42161)');
  console.log('AgentRegistry:', registryAddress);
  console.log('AgentVault:', vaultAddress);
  console.log('========================================\n');

  console.log('Update services/agentRegistry.ts with:');
  console.log(`export const AGENT_REGISTRY_ADDRESS = '${registryAddress}' as Address;`);
  console.log(`export const AGENT_VAULT_ADDRESS = '${vaultAddress}' as Address;`);

  console.log('\nVerify on Arbiscan:');
  console.log(`https://arbiscan.io/address/${registryAddress}`);
  console.log(`https://arbiscan.io/address/${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
