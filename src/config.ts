import {BitcoinNetwork, MaestroSymphonyProvider, MempoolSpaceProvider} from "@midl-xyz/midl-js-core";
import {Address, Chain, createPublicClient, createWalletClient, http} from "viem";
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

const maestro = process.env.MAESTRO_URL;
if (!maestro) {
    throw new Error("Mestro URL is missing");
}

export const uniswapRouterAddress = process.env.UNISWAP_ROUTER_ADDRESS as Address ?? "0xee7d81B234042AB58192E0Ef6a5004b08ca65a34";
export const WETH = process.env.WETH as Address ?? "0xC726845d8b6f0586A12D31ec5075e47B28c8eC4A";
export const executorAddress = process.env.EXECUTOR_ADDRESS as Address ?? "0xEbF0Ece9A6cbDfd334Ce71f09fF450cd06D57753";
export const uniswapFactoryAddress = process.env.UNISWAP_FACTORY_ADDRESS as Address ?? "0x5B3046102F11Ac37Eea74741949bc2aF83c926E5"

export const bitcoinNetwork: BitcoinNetwork = {
    id: "regtest",
    network: "regtest",
    explorerUrl: mempool,
}

export const mempoolProvider = new MempoolSpaceProvider(
    {
        regtest: mempool,
        mainnet: "https://mempool.space",
        testnet: "https://mempool.space/testnet",
        testnet4: "https://mempool.space/testnet4",
        signet: "https://mempool.space/signet",
    }
)

export const maestroProvider = new MaestroSymphonyProvider(
    {
        regtest: maestro,
    }
)


// Define MIDL regtest chain
export const midlRegtest: Chain = {
    id: 0x309,
    rpcUrls: {
        default: {
            http: [geth],
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
    explorerUrl: geth,
}

export const midlRegtestClient = createPublicClient({
    chain: midlRegtest,
    transport: http(),
});

export const midlRegtestWalletClient = createWalletClient({
    chain: midlRegtest,
    transport: http(),
});