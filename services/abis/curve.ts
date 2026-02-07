// Curve Finance Protocol ABIs
// Docs: https://docs.curve.fi/

// Curve StableSwap Pool ABI (3pool, etc.)
export const CURVE_POOL_ABI = [
  // Add liquidity (for 3-token pools like 3pool)
  {
    inputs: [
      { name: '_amounts', type: 'uint256[3]' },
      { name: '_min_mint_amount', type: 'uint256' },
    ],
    name: 'add_liquidity',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Remove liquidity (balanced)
  {
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_min_amounts', type: 'uint256[3]' },
    ],
    name: 'remove_liquidity',
    outputs: [{ name: '', type: 'uint256[3]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Remove liquidity single coin
  {
    inputs: [
      { name: '_token_amount', type: 'uint256' },
      { name: 'i', type: 'int128' },
      { name: '_min_amount', type: 'uint256' },
    ],
    name: 'remove_liquidity_one_coin',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Exchange (swap)
  {
    inputs: [
      { name: 'i', type: 'int128' },
      { name: 'j', type: 'int128' },
      { name: '_dx', type: 'uint256' },
      { name: '_min_dy', type: 'uint256' },
    ],
    name: 'exchange',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get exchange amount (quote)
  {
    inputs: [
      { name: 'i', type: 'int128' },
      { name: 'j', type: 'int128' },
      { name: '_dx', type: 'uint256' },
    ],
    name: 'get_dy',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get virtual price (for LP token valuation)
  {
    inputs: [],
    name: 'get_virtual_price',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get balances of pool tokens
  {
    inputs: [{ name: 'i', type: 'uint256' }],
    name: 'balances',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get coin address by index
  {
    inputs: [{ name: 'i', type: 'uint256' }],
    name: 'coins',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Calculate LP tokens for deposit
  {
    inputs: [
      { name: '_amounts', type: 'uint256[3]' },
      { name: '_is_deposit', type: 'bool' },
    ],
    name: 'calc_token_amount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Curve 2-token pool variant (for pools like stETH/ETH)
export const CURVE_POOL_2_ABI = [
  {
    inputs: [
      { name: '_amounts', type: 'uint256[2]' },
      { name: '_min_mint_amount', type: 'uint256' },
    ],
    name: 'add_liquidity',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable', // For ETH pools
    type: 'function',
  },
  {
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_min_amounts', type: 'uint256[2]' },
    ],
    name: 'remove_liquidity',
    outputs: [{ name: '', type: 'uint256[2]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'i', type: 'int128' },
      { name: 'j', type: 'int128' },
      { name: '_dx', type: 'uint256' },
      { name: '_min_dy', type: 'uint256' },
    ],
    name: 'exchange',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// Curve Gauge ABI (for staking LP tokens and earning CRV)
export const CURVE_GAUGE_ABI = [
  // Deposit LP tokens
  {
    inputs: [{ name: '_value', type: 'uint256' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Deposit for another address
  {
    inputs: [
      { name: '_value', type: 'uint256' },
      { name: '_addr', type: 'address' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Withdraw LP tokens
  {
    inputs: [{ name: '_value', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Claim CRV rewards
  {
    inputs: [],
    name: 'claim_rewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Claim rewards for address
  {
    inputs: [{ name: '_addr', type: 'address' }],
    name: 'claim_rewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get staked balance
  {
    inputs: [{ name: 'arg0', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get claimable CRV
  {
    inputs: [{ name: '_addr', type: 'address' }],
    name: 'claimable_tokens',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get claimable reward token
  {
    inputs: [
      { name: '_addr', type: 'address' },
      { name: '_token', type: 'address' },
    ],
    name: 'claimable_reward',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
