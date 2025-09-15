import {BitcoinNetwork, MempoolSpaceProvider, RunehookProvider} from "@midl-xyz/midl-js-core";
import {Chain, createPublicClient, createWalletClient, http} from "viem";
import {config} from "dotenv"

config();
const mempool = process.env.MEMPOOL_URL;
if (!mempool) {
    throw new Error("Mempool URL is missing");
}

const geth = process.env.GETH_URL;
if (!geth) {
    throw new Error("Geth URL is missing");
}

// Source address private keys
export const uniswapRouterAddress = "0xee7d81B234042AB58192E0Ef6a5004b08ca65a34";
export const WETH = "0xC726845d8b6f0586A12D31ec5075e47B28c8eC4A";
export const executorAddress = "0xEbF0Ece9A6cbDfd334Ce71f09fF450cd06D57753";
export const uniswapFactoryAddress = "0x5B3046102F11Ac37Eea74741949bc2aF83c926E5"
const localMempool = "http://localhost:80"
const localGeth = "http://localhost:8545"

export const bitcoinNetwork: BitcoinNetwork = {
    id: "regtest",
    network: "regtest",
    explorerUrl: process.env.MEMPOOL_URL ?? localMempool,
}

export const mempoolProvider = new MempoolSpaceProvider(
    {
        regtest: process.env.MEMPOOL_URL ?? localMempool,
        mainnet: "https://mempool.space",
        testnet: "https://mempool.space/testnet",
        testnet4: "https://mempool.space/testnet4",
        signet: "https://mempool.space/signet",
    }
)

export const runesProvider = new RunehookProvider(
    {
        regtest: process.env.MEMPOOL_URL ?? localMempool,
        mainnet: "https://mempool.space",
        testnet: "https://mempool.space/testnet",
        testnet4: "https://mempool.space/testnet4",
        signet: "https://mempool.space/signet",
    }
)


// Define MIDL regtest chain
export const midlRegtest: Chain = {
    id: 0x309,
    rpcUrls: {
        default: {
            http: [process.env.GETH_URL ?? localGeth],
        },
    },
    name: "midl-regtest",
    nativeCurrency: {
        name: "MIDL",
        symbol: "MIDL",
        decimals: 18,
    },
};

export const regtest: BitcoinNetwork = {
    id: "regtest",
    network: "regtest",
    explorerUrl: process.env.MEMPOOL_URL ?? localMempool,
}

// Create a public client for the MIDL regtest chain
export const midlRegtestClient = createPublicClient({
    chain: midlRegtest,
    transport: http(),
});

// Create a wallet client for the MIDL regtest chain
export const midlRegtestWalletClient = createWalletClient({
    chain: midlRegtest,
    transport: http(),
});