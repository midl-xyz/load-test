import ecc from "@bitcoinerlab/secp256k1";
import {BitcoinNetwork, createConfig, KeyPairConnector} from "@midl-xyz/midl-js-core";
import {initEccLib, Network, networks} from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import Bip32Factory from "bip32";
import {mnemonicToSeedSync} from "bip39";
import {Chain, createPublicClient, createWalletClient, http} from "viem";

// Initialize libraries
initEccLib(ecc);
export const ECPair = ECPairFactory(ecc);
export const bip32 = Bip32Factory(ecc);

// Define MIDL regtest chain
export const midlRegtest: Chain = {
    id: 0x309,
    rpcUrls: {
        default: {
            http: ["http://localhost:8545"],
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
    rpcUrl: "http://localhost:80/api",
    runesUrl: "http://localhost:80",
    explorerUrl: "http://localhost:80",
    runesUTXOUrl: "http://localhost:80",
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
export const multisigAddress = "bcrt1qsjcsryftgwyh3e0z0mvc6vdjx9pl8cx8006q3j";
export const uniswapRouterAddress = "0x77E1Ba36FfaB4e17A303717Cc174d87AD0E963F7";
export const WETH = "0x76818770D192A506F90e79D5cB844E708be0D7A0";

// Create key pair from private key
export const keyPairFrom = ECPair.fromPrivateKey(
    Buffer.from(sourcePrivateKeyFrom, "hex"),
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

export const getKeyPair = (network: Network = networks.regtest) => {
    const mnemonic =
        "cheap sick genuine tenant beyond reveal inmate more lift impact slam hurt";
    const seed = mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, network);
    const child = root.derivePath("m/86'/1'/0'/0/0");

    // biome-ignore lint/style/noNonNullAssertion: Private key is always defined
    return ECPair.fromWIF(child.toWIF()!, network);
};

// Create configuration
export const configFrom = createConfig({
    networks: [regtest],
    connectors: [new KeyPairConnector(keyPairFrom)],
});

export const configTo = createConfig({
    networks: [regtest],
    connectors: [new KeyPairConnector(keyPairTo)],
});