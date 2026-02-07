// Compound V3 (Comet) Protocol ABIs
// Docs: https://docs.compound.finance/

export const COMPOUND_V3_COMET_ABI = [
  // Supply base asset (e.g., USDC)
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Supply to another account
  {
    inputs: [
      { name: 'dst', type: 'address' },
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'supplyTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Withdraw base asset
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get balance of base asset (including interest)
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get borrow balance
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'borrowBalanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get collateral balance
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'asset', type: 'address' },
    ],
    name: 'collateralBalanceOf',
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get supply rate (per second)
  {
    inputs: [{ name: 'utilization', type: 'uint256' }],
    name: 'getSupplyRate',
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get current utilization
  {
    inputs: [],
    name: 'getUtilization',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get base token address
  {
    inputs: [],
    name: 'baseToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Claim rewards
  {
    inputs: [
      { name: 'comet', type: 'address' },
      { name: 'src', type: 'address' },
      { name: 'shouldAccrue', type: 'bool' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Compound Rewards contract ABI
export const COMPOUND_REWARDS_ABI = [
  {
    inputs: [
      { name: 'comet', type: 'address' },
      { name: 'account', type: 'address' },
    ],
    name: 'getRewardOwed',
    outputs: [
      {
        components: [
          { name: 'token', type: 'address' },
          { name: 'owed', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'comet', type: 'address' },
      { name: 'src', type: 'address' },
      { name: 'shouldAccrue', type: 'bool' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
