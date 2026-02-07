// Protocol Contract Registry
// Centralized contract addresses for all supported DeFi protocols across chains

import { Address } from 'viem';

export type SupportedProtocol = 'aave' | 'compound' | 'lido' | 'curve' | 'morpho';

export interface ProtocolContracts {
  pool?: Address;
  rewards?: Address;
  // Aave specific
  aTokens?: Record<string, Address>;
  // Lido specific
  steth?: Address;
  wsteth?: Address;
  withdrawalQueue?: Address;
  // Curve specific
  pools?: Record<string, Address>;
  gauges?: Record<string, Address>;
  // Morpho specific
  blue?: Address;
}

// Multi-chain protocol contract addresses
export const PROTOCOL_ADDRESSES: Record<SupportedProtocol, Record<number, ProtocolContracts>> = {
  // Aave V3 - https://docs.aave.com/developers/deployed-contracts/v3-mainnet
  aave: {
    // Ethereum Mainnet
    1: {
      pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      aTokens: {
        USDC: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
        USDT: '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a',
        DAI: '0x018008bfb33d285247A21d44E50697654f754e63',
        WETH: '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8',
      },
    },
    // Arbitrum
    42161: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      aTokens: {
        USDC: '0x724dc807b04555b71ed48a6896b6F41593b8C637',
        'USDC.e': '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
        USDT: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
        WETH: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
      },
    },
    // Optimism
    10: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      aTokens: {
        USDC: '0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5',
        USDT: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
        DAI: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE',
        WETH: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
      },
    },
    // Polygon
    137: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      aTokens: {
        USDC: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
        'USDC.e': '0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD',
        USDT: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
        DAI: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE',
        WETH: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
      },
    },
    // Base
    8453: {
      pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
      aTokens: {
        USDC: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
        WETH: '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7',
      },
    },
  },

  // Compound V3 (Comet) - https://docs.compound.finance/
  compound: {
    // Ethereum Mainnet
    1: {
      pool: '0xc3d688B66703497DAA19211EEdff47f25384cdc3', // USDC Comet
      rewards: '0x1B0e765F6224C21223AeA2af16c1C46E38885a40',
    },
    // Arbitrum
    42161: {
      pool: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf', // USDC Comet
      rewards: '0x88730d254A2f7e6AC8388c3198aFd694bA9f7fae',
    },
    // Polygon
    137: {
      pool: '0xF25212E676D1F7F89Cd72fFEe66158f541246445', // USDC Comet
      rewards: '0x45939657d1CA34A8FA39A924B71D28Fe8431e581',
    },
    // Base
    8453: {
      pool: '0xb125E6687d4313864e53df431d5425969c15Eb2F', // USDC Comet
      rewards: '0x123964802e6ABabBE1Bc9547D72A78A5D7B74D50',
    },
  },

  // Lido - https://docs.lido.fi/deployed-contracts/
  lido: {
    // Ethereum Mainnet only (Lido is ETH-only)
    1: {
      steth: '0xae7ab96520DE3A18E5e111B5EaAB4E699C0CE7E94',
      wsteth: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      withdrawalQueue: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
    },
  },

  // Curve Finance - https://curve.readthedocs.io/
  curve: {
    // Ethereum Mainnet
    1: {
      pools: {
        '3pool': '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', // DAI/USDC/USDT
        'steth': '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022', // ETH/stETH
        'frax': '0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B', // FRAX/3CRV
        'tricrypto2': '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', // USDT/WBTC/WETH
      },
      gauges: {
        '3pool': '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A',
        'steth': '0x182B723a58739a9c974cFDB385ceaDb237453c28',
      },
    },
    // Arbitrum
    42161: {
      pools: {
        '2pool': '0x7f90122BF0700F9E7e1F688fe926940E8839F353', // USDC/USDT
        'tricrypto': '0x960ea3e3C7FB317332d990873d354E18d7645590', // USDT/WBTC/WETH
      },
    },
  },

  // Morpho Blue - https://docs.morpho.org/
  morpho: {
    // Ethereum Mainnet
    1: {
      blue: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    },
    // Base
    8453: {
      blue: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    },
  },
};

// Token addresses by chain (commonly used tokens)
export const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  // Ethereum Mainnet
  1: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    stETH: '0xae7ab96520DE3A18E5e111B5EaAB4E699C0CE7E94',
    wstETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  },
  // Arbitrum
  42161: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDC.e': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  // Optimism
  10: {
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    'USDC.e': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  // Polygon
  137: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    'USDC.e': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  // Base
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    WETH: '0x4200000000000000000000000000000000000006',
  },
};

// Helper functions
export function getProtocolAddress(
  protocol: SupportedProtocol,
  chainId: number
): ProtocolContracts | null {
  return PROTOCOL_ADDRESSES[protocol]?.[chainId] || null;
}

export function getTokenAddress(chainId: number, symbol: string): Address | null {
  return TOKEN_ADDRESSES[chainId]?.[symbol] || null;
}

export function isProtocolSupportedOnChain(protocol: SupportedProtocol, chainId: number): boolean {
  return !!PROTOCOL_ADDRESSES[protocol]?.[chainId];
}

export function getSupportedChainsForProtocol(protocol: SupportedProtocol): number[] {
  return Object.keys(PROTOCOL_ADDRESSES[protocol] || {}).map(Number);
}

// Chain names for display
export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
};
