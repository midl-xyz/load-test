import "@midl/hardhat-deploy";
import {config as dotenvConfig} from "dotenv";
import "hardhat-deploy";
import type {HardhatUserConfig} from "hardhat/config";
import {resolve} from "path";
import {MaestroSymphonyProvider, MempoolSpaceProvider} from "@midl-xyz/midl-js-core";

dotenvConfig({path: resolve(__dirname, "./.env")});

const config: HardhatUserConfig = {
    networks: {
        default: {
            url: "http://localhost:8545",
            chainId: 777,
        },
    },
    midl: {
        networks: {
            default: {
                mnemonic:
                  process.env.MNEMONIC ?? "wolf figure stamp truly enter raise correct twice agree shadow subway dad",
                confirmationsRequired: 1,
                btcConfirmationsRequired: 1,
                hardhatNetwork: "default",
                network: {
                    explorerUrl: "http://localhost:8083",
                    id: "regtest",
                    network: "regtest",
                },
                runesProvider: new MaestroSymphonyProvider({
                    regtest: "http://localhost:8080",
                }),
                provider: new MempoolSpaceProvider({
                    regtest: "http://localhost:8083",
                    mainnet: "",
                    testnet: "",
                    testnet4: "",
                    signet: "",
                }),
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
