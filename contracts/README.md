# Agent Registry Smart Contracts

On-chain agent registry with ENS-style naming and automatic fee splitting for LI.FI agents.

## Contracts

### AgentRegistry.sol
- Register agent names (e.g., `yieldseeker.lifi`)
- Link names to agent IDs (a0-a6)
- Set performance fees (up to 20%)
- Track yield generated and fees earned

### AgentVault.sol
- Accept deposits via named agents
- Track user deposits per agent
- Split fees on yield harvest
- Allow agent owners to claim accumulated fees

## Deployment (Arbitrum Mainnet)

### Prerequisites
1. Node.js 22.x LTS (Hardhat requires LTS version)
2. ETH on Arbitrum for gas
3. Private key for deployer wallet

### Setup
```bash
# Install dependencies
npm install

# Add to .env:
DEPLOYER_PRIVATE_KEY=your_private_key
ARBISCAN_API_KEY=your_arbiscan_api_key
```

### Compile
```bash
npx hardhat compile
```

### Deploy
```bash
npx hardhat run scripts/deploy.ts --network arbitrum
```

### Verify
```bash
npx hardhat verify --network arbitrum <REGISTRY_ADDRESS>
npx hardhat verify --network arbitrum <VAULT_ADDRESS> <REGISTRY_ADDRESS>
```

## Contract Addresses (After Deployment)

Update `services/agentRegistry.ts` with deployed addresses:

```typescript
export const AGENT_REGISTRY_ADDRESS = '0x...' as Address;
export const AGENT_VAULT_ADDRESS = '0x...' as Address;
```

## Default Agent Names

| Agent ID | Suggested Name | Role |
|----------|----------------|------|
| a0 | strategist.lifi | Paul Atreides |
| a1 | arbitrage.lifi | Chani |
| a2 | guardian.lifi | Irulan |
| a3 | yieldseeker.lifi | Liet-Kynes |
| a4 | sentinel.lifi | Duncan Idaho |
| a5 | rebalancer.lifi | Thufir Hawat |
| a6 | executor.lifi | Stilgar |

## Fee Structure

- Performance fee: 1-20% (set by agent owner)
- Fee calculated on yield only, not principal
- Fees accumulate in vault, claimable anytime

## Security

- Only agent owner can modify settings
- Vault authorized by registry for yield recording
- Admin can add/remove authorized callers
