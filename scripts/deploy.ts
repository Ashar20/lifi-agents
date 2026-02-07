// Deploy script for AgentRegistry and AgentVault
// Run: npx hardhat run scripts/deploy.ts --network arbitrum

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy AgentRegistry
  console.log("\n1. Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   AgentRegistry deployed to:", registryAddress);

  // Deploy AgentVault
  console.log("\n2. Deploying AgentVault...");
  const AgentVault = await ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(registryAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   AgentVault deployed to:", vaultAddress);

  // Authorize vault in registry
  console.log("\n3. Authorizing AgentVault in AgentRegistry...");
  const tx = await registry.addAuthorizedCaller(vaultAddress);
  await tx.wait();
  console.log("   AgentVault authorized!");

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Network: Arbitrum Mainnet");
  console.log("AgentRegistry:", registryAddress);
  console.log("AgentVault:", vaultAddress);
  console.log("========================================");

  console.log("\nUpdate these addresses in services/agentRegistry.ts:");
  console.log(`export const AGENT_REGISTRY_ADDRESS = '${registryAddress}' as Address;`);
  console.log(`export const AGENT_VAULT_ADDRESS = '${vaultAddress}' as Address;`);

  // Verify contracts
  console.log("\nTo verify contracts on Arbiscan:");
  console.log(`npx hardhat verify --network arbitrum ${registryAddress}`);
  console.log(`npx hardhat verify --network arbitrum ${vaultAddress} ${registryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
