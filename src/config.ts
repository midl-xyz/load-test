import { BitcoinNetwork, MaestroSymphonyProvider, MempoolSpaceProvider } from "@midl/core";
import { Address, Chain, createPublicClient, createWalletClient, http, zeroAddress } from "viem";
import "dotenv/config"
import path from "node:path";

const getDeploymentAddress = (filename: string, fallback: string): Address => {
    try {
        const data = require(path.join(__dirname, "..", "deployments", `${filename}.json`));
        
        if (data && data.address) {
            return data.address as Address;
        }
    } catch (e) {
        console.warn(`Could not load deployment address from ${filename}, using fallback ${fallback}`);
    }

    if(!fallback || fallback === zeroAddress) {
        throw new Error(`Deployment address for ${filename} is missing and no valid fallback provided`);    
    }

    return fallback as Address;
}

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

export const uniswapRouterAddress = getDeploymentAddress("UniswapV2Router02", process.env.UNISWAP_ROUTER_ADDRESS as Address ?? "0xee7d81B234042AB58192E0Ef6a5004b08ca65a34");
export const WETH = getDeploymentAddress("WETH9", process.env.WETH as Address ?? "0xC726845d8b6f0586A12D31ec5075e47B28c8eC4A");
export const uniswapFactoryAddress = getDeploymentAddress("UniswapV2Factory", process.env.UNISWAP_FACTORY_ADDRESS as Address ?? "0x5B3046102F11Ac37Eea74741949bc2aF83c926E5");
export const goldERC20Address = getDeploymentAddress("GoldERC20", process.env.GOLD_ERC20_ADDRESS as Address);


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