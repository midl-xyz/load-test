import "@midl/hardhat-deploy";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const walletsPaths = {
  default: "m/86'/1'/0'/0/0",
};

const accounts = [process.env.MNEMONIC as string];


const config: HardhatUserConfig = {
  networks: {
    default: {
      url: "https://rpc.regtest.midl.xyz",
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
        path: walletsPaths.default,
        initialIndex: 0,
        count: 1,
      },
      chainId: 777,
    },
  },
  midl: {
    path: "deployments",
    networks: {
      default: {
        mnemonic: accounts[0],
        confirmationsRequired: 1,
        btcConfirmationsRequired: 1,
        hardhatNetwork: "default",
        network: {
          explorerUrl: "https://mempool.regtest.midl.xyz",
          id: "regtest",
          network: "regtest",
        },
      },
    },
  },
  solidity: {
	compilers: [
			{
				version: "0.8.20",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: "0.8.12",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: "0.4.18",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: "0.8.24",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: "0.5.16",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: "0.6.6",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		],
		overrides: {
			"@uniswap/lib/contracts/libraries/TransferHelper.sol": {
				version: "0.6.6",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			"@uniswap/lib/contracts/libraries/Babylonian.sol": {
				version: "0.6.6",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			"@uniswap/lib/contracts/libraries/BitMath.sol": {
				version: "0.6.6",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			"@uniswap/lib/contracts/libraries/FixedPoint.sol": {
				version: "0.6.6",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			"@uniswap/lib/contracts/libraries/FullMath.sol": {
				version: "0.6.6",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		},
  },
};

export default config;
