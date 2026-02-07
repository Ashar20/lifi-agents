// Lido Liquid Staking Protocol ABIs
// Docs: https://docs.lido.fi/

// stETH contract - main Lido staking contract
export const LIDO_STETH_ABI = [
  // Submit ETH to get stETH (payable function)
  {
    inputs: [{ name: '_referral', type: 'address' }],
    name: 'submit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // Get stETH balance
  {
    inputs: [{ name: '_account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get shares (internal accounting unit)
  {
    inputs: [{ name: '_account', type: 'address' }],
    name: 'sharesOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Convert shares to stETH
  {
    inputs: [{ name: '_sharesAmount', type: 'uint256' }],
    name: 'getPooledEthByShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Convert stETH to shares
  {
    inputs: [{ name: '_ethAmount', type: 'uint256' }],
    name: 'getSharesByPooledEth',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Total pooled ETH
  {
    inputs: [],
    name: 'getTotalPooledEther',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ERC20 transfer
  {
    inputs: [
      { name: '_recipient', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // ERC20 approve
  {
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// wstETH contract - wrapped stETH (non-rebasing)
export const LIDO_WSTETH_ABI = [
  // Wrap stETH to wstETH
  {
    inputs: [{ name: '_stETHAmount', type: 'uint256' }],
    name: 'wrap',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Unwrap wstETH to stETH
  {
    inputs: [{ name: '_wstETHAmount', type: 'uint256' }],
    name: 'unwrap',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get wstETH balance
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get stETH per wstETH (exchange rate)
  {
    inputs: [{ name: '_wstETHAmount', type: 'uint256' }],
    name: 'getStETHByWstETH',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get wstETH per stETH
  {
    inputs: [{ name: '_stETHAmount', type: 'uint256' }],
    name: 'getWstETHByStETH',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Tokens per stETH (1 wstETH = X stETH)
  {
    inputs: [],
    name: 'stEthPerToken',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ERC20 approve
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Lido Withdrawal Queue (for unstaking)
export const LIDO_WITHDRAWAL_QUEUE_ABI = [
  // Request withdrawal
  {
    inputs: [
      { name: '_amounts', type: 'uint256[]' },
      { name: '_owner', type: 'address' },
    ],
    name: 'requestWithdrawals',
    outputs: [{ name: 'requestIds', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Claim withdrawals
  {
    inputs: [{ name: '_requestIds', type: 'uint256[]' }],
    name: 'claimWithdrawals',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get withdrawal status
  {
    inputs: [{ name: '_requestIds', type: 'uint256[]' }],
    name: 'getWithdrawalStatus',
    outputs: [
      {
        components: [
          { name: 'amountOfStETH', type: 'uint256' },
          { name: 'amountOfShares', type: 'uint256' },
          { name: 'owner', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'isFinalized', type: 'bool' },
          { name: 'isClaimed', type: 'bool' },
        ],
        name: 'statuses',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
