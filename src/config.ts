import ecc from "@bitcoinerlab/secp256k1";
import {BitcoinNetwork, createConfig, MempoolSpaceProvider} from "@midl-xyz/midl-js-core";
import {initEccLib, Network, networks} from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import Bip32Factory from "bip32";
import {mnemonicToSeedSync} from "bip39";
import {Chain, createPublicClient, createWalletClient, http} from "viem";
import {keyPairConnector} from "@midl-xyz/midl-js-node";

// Initialize libraries
initEccLib(ecc);
export const ECPair = ECPairFactory(ecc);
export const bip32 = Bip32Factory(ecc);

// Define MIDL regtest chain
export const midlRegtest: Chain = {
    id: 0x309,
    rpcUrls: {
        default: {
            http: ["https://rpc.etna.midl.xyz/"],
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
    explorerUrl: "https://mempool.etna.midl.xyz",
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

// Source address private keys
export const sourcePrivateKeyFrom = "d6253db0047fcd99323946c6c535d227279881c5329d1de5006247a3689a6b11";
export const sourcePrivateKeyTo = "7b503a78d68b281e1693b5f9ac7a5cfce5119e2ca9553167508e773424956b27";
export const multisigAddress = "bcrt1q65a572l6n7vqqpqpvnrcxps8205fuzcfr0gmew";
export const uniswapRouterAddress = "0xee7d81B234042AB58192E0Ef6a5004b08ca65a34";
export const WETH = "0xC726845d8b6f0586A12D31ec5075e47B28c8eC4A";
export const executorAddress = "0xEbF0Ece9A6cbDfd334Ce71f09fF450cd06D57753";


export const getKeyPair = (network: Network = networks.regtest) => {
    const mnemonic =
        "face spike layer label health knee cry taste carpet found elegant october";
    const seed = mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, network);
    const child = root.derivePath("m/86'/1'/0'/0/0");

    // biome-ignore lint/style/noNonNullAssertion: Private key is always defined
    return ECPair.fromWIF(child.toWIF()!, network);
};

const derivedKeyPair = getKeyPair();

// Create key pair from private key
export const keyPairFrom = ECPair.fromPrivateKey(
    derivedKeyPair.privateKey!,
    {network: networks.regtest},
);

// Create key pair from private key
export const keyPairTo = ECPair.fromPrivateKey(
    Buffer.from(sourcePrivateKeyTo, "hex"),
    {network: networks.regtest}
);

export enum AddressPurpose {
    Payment = "payment",
    Ordinals = "ordinals",
}


export const mempoolProvider = new MempoolSpaceProvider({
    regtest: "https://mempool.etna.midl.xyz",
    mainnet: "https://mempool.space",
    testnet: "https://mempool.space/testnet",
    testnet4: "https://mempool.space/testnet4",
});

// Create configuration
export const configFrom = createConfig({
    networks: [regtest],
    connectors: [
        keyPairConnector(
            {
                keyPair: keyPairFrom,
            }
        )
    ],
    provider: mempoolProvider,
});

export const configTo = createConfig({
    networks: [regtest],
    connectors: [
        keyPairConnector(
            {
                keyPair: keyPairFrom,
            }
        )],
    provider: mempoolProvider,
});
