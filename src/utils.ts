import {networks} from "bitcoinjs-lib";
import {connect, createConfig, KeyPairConnector} from "@midl-xyz/midl-js-core";
import {mnemonicToSeedSync} from "bip39";
import {AddressPurpose, bip32, ECPair, mempoolProvider, midlRegtestClient, regtest} from "./config";
import {getEVMAddress, getPublicKey} from "@midl-xyz/midl-js-executor";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {Mutex} from "async-mutex";
import {getAssetAddressByRuneId} from "@/evm";
import {zeroAddress} from "viem";

// Path to store wallet mnemonics
const MNEMONICS_FILE_PATH = path.join(__dirname, '..', 'wallet_mnemonics.json');

/**
 * Reads stored mnemonics from file
 * @returns string[] - Array of stored mnemonics
 */
export function readStoredMnemonics(): string[] {
    try {
        if (fs.existsSync(MNEMONICS_FILE_PATH)) {
            const data = fs.readFileSync(MNEMONICS_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading stored mnemonics:', error);
    }
    return [];
}

/**
 * Writes mnemonics to file
 * @param mnemonics - Array of mnemonics to store
 */
export function storeMnemonics(mnemonics: string[]): void {
    try {
        fs.writeFileSync(MNEMONICS_FILE_PATH, JSON.stringify(mnemonics, null, 2), 'utf8');
        console.log(`Stored ${mnemonics.length} mnemonics to ${MNEMONICS_FILE_PATH}`);
    } catch (error) {
        console.error('Error storing mnemonics:', error);
    }
}

/**
 * Interface for wallet information
 */
export interface WalletInfo {
    keyPair: any;
    config: any;
    address: string;
    publicKey: string;
    privateKey: string;
}

const nonceMutex = new Mutex();
const noncesByAddress: { [address: string]: number } = {};
const pendingNoncesByAddress: { [address: string]: number } = {};

/**
 * Gets the nonce for a transaction
 * @param wallet - The wallet information
 * @returns Promise<number> - The nonce for the transaction
 */
export async function getNonce(wallet: WalletInfo): Promise<number> {
    try {
        // Get the public key from the wallet
        const publicKeyHex = wallet.publicKey;
        // Format the public key using getPublicKey
        const formattedPublicKey = getPublicKey(wallet.config, publicKeyHex);
        // Get the EVM address from the public key
        const evmAddress = getEVMAddress(formattedPublicKey as `0x${string}`);

        const release = await nonceMutex.acquire();
        try {
            // Always get the current transaction count from the blockchain
            const transactionCount = await midlRegtestClient.getTransactionCount({
                address: evmAddress
            });

            // Initialize or update the stored nonce
            if (noncesByAddress[evmAddress] === undefined) {
                noncesByAddress[evmAddress] = transactionCount;
            } else {
                // Use the maximum of the stored nonce and the blockchain nonce
                noncesByAddress[evmAddress] = Math.max(noncesByAddress[evmAddress], transactionCount);
            }

            // Initialize pending nonce if needed
            if (pendingNoncesByAddress[evmAddress] === undefined) {
                pendingNoncesByAddress[evmAddress] = noncesByAddress[evmAddress];
            }

            // Get the next nonce (current pending nonce)
            const nonce = pendingNoncesByAddress[evmAddress];

            // Increment the pending nonce for the next transaction
            pendingNoncesByAddress[evmAddress] = nonce + 1;
            return nonce;
        } finally {
            release();
        }
    } catch (error) {
        console.error("Error getting nonce:", error);
        throw new Error(`Failed to get nonce: ${error}`);
    }
}

/**
 * Generates a random mnemonic
 * @returns string - A random mnemonic
 */
export function generateRandomMnemonic(): string {
    // Generate 16 random bytes (128 bits)
    const randomBytes = crypto.randomBytes(16);

    // Convert to a hex string
    const hexString = randomBytes.toString('hex');

    // This is a simplified version - in a real app, you'd use a proper BIP39 library
    // to generate a valid mnemonic with checksum
    return hexString;
}

/**
 * Creates multiple wallets
 * @param count - The number of wallets to create
 * @returns Promise<WalletInfo[]> - An array of wallet information
 */
export async function createMultipleWallets(count: number): Promise<WalletInfo[]> {
    const wallets: WalletInfo[] = [];

    // Read stored mnemonics
    let storedMnemonics = readStoredMnemonics();

    // If first wallet mnemonic doesn't exist, use the fixed one
    if (storedMnemonics.length === 0) {
        storedMnemonics.push("fixed deterministic mnemonic for first wallet always the samq");
    }

    // Keep track of how many mnemonics we had before adding new ones
    const originalMnemonicCount = storedMnemonics.length;
    console.log(`Found ${originalMnemonicCount} existing wallet mnemonics`);

    // Generate new mnemonics if needed
    while (storedMnemonics.length < count) {
        storedMnemonics.push(generateRandomMnemonic());
        console.log(`Generated new mnemonic for wallet ${storedMnemonics.length}`);
    }

    // Store all mnemonics (even if unchanged)
    storeMnemonics(storedMnemonics);

    // Create wallets using the mnemonics (up to the requested count)
    for (let i = 0; i < count; i++) {
        const mnemonic = storedMnemonics[i];

        // Create a key pair from the mnemonic
        const seed = mnemonicToSeedSync(mnemonic);
        const root = bip32.fromSeed(seed, networks.regtest);
        const child = root.derivePath("m/86'/1'/0'/0/0");
        const keyPair = ECPair.fromWIF(child.toWIF()!, networks.regtest);

        // Create a config for the wallet
        const config = createConfig({
            networks: [regtest],
            connectors: [new KeyPairConnector(keyPair)],
            provider: mempoolProvider,
        });

        // Connect the config
        await connect(config, {purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment], network: regtest});

        // Get the address
        const configState = config.getState();
        const ordinalsAccount = configState?.accounts?.find(
            (account) => account.purpose === AddressPurpose.Ordinals,
        );

        if (!ordinalsAccount) {
            throw new Error(`No ordinals account found for wallet ${i}`);
        }

        const address = ordinalsAccount.address;
        const publicKey = ordinalsAccount.publicKey;
        const privateKey = keyPair.privateKey?.toString('hex') || '';

        wallets.push({
            keyPair,
            config,
            address,
            publicKey,
            privateKey
        });

        const isNewWallet = i >= originalMnemonicCount;
        console.log(`Created wallet ${i + 1}/${count} with address: ${address} (${isNewWallet ? 'new' : 'existing'})`);
    }

    return wallets;
}

export async function waitRuneAddress(runeId: string): Promise<string> {
    const runeAddress = await getAssetAddressByRuneId(runeId);

    if (runeAddress === zeroAddress) {
        console.error(`Rune address for ID ${runeId} is zero address, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
        return waitRuneAddress(runeId); // Retry
    }
    return runeAddress;
}