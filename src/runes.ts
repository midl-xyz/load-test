import {broadcastTransaction, edictRune, etchRune, getRunes, waitForTransaction} from "@midl-xyz/midl-js-core";
import {parseUnits} from "viem";
import {configTo, multisigAddress} from "./config";
import {WalletInfo} from "./utils";
import {getAssetAddressByRuneId} from "./evm";

/**
 * Checks if a rune exists for a given address
 * @param address - The address to check
 * @param config - The config to use for the check (defaults to configTo)
 * @returns Promise<string | null> - The rune ID if it exists, null otherwise
 */
export const checkRuneExists = async (address: string, config = configTo): Promise<string | null> => {
    try {
        const runesData = await getRunes(config, {address, limit: 20});
        if (runesData && runesData.results && runesData.results.length > 0) {
            console.log("Rune already exists:", runesData.total);
            return runesData.results[0].rune.id;
        }
        return null;
    } catch (e) {
        console.error("Error checking rune:", e);
        throw e;
    }
};

/**
 * Creates a new rune
 * @param receiverAddress - The address to receive the rune
 * @returns Promise<string> - The rune ID
 */
export const createRune = async (receiverAddress: string): Promise<string> => {
    console.log("Creating new rune");

    const etching = await etchRune(configTo, {
        name: "RUNE•LOAD•TEST•SECOND",
        receiver: receiverAddress,
        amount: 10000000,
        premine: 10000000,
    });

    const fundingTxHash = await broadcastTransaction(configTo, etching.fundingTx);
    const etchingTxHash = await broadcastTransaction(configTo, etching.etchingTx);
    const revealTxHash = await broadcastTransaction(configTo, etching.revealTx);
    console.log("Rune creation transactions:", fundingTxHash, etchingTxHash, revealTxHash);

    await waitForTransaction(configTo, revealTxHash, 1);

    // Get the newly created rune ID
    const newRunesData = await getRunes(configTo, {address: receiverAddress, limit: 20});
    if (newRunesData && newRunesData.results && newRunesData.results.length > 0) {
        console.log("New rune ID:", newRunesData.results[0].rune.id);
        return newRunesData.results[0].rune.id;
    } else {
        throw new Error("Failed to get rune ID");
    }
};

/**
 * Sends runes to a multisig address
 * @param runeId - The rune ID to send
 * @param bitcoinAmount - The amount of Bitcoin to send
 * @param runeAmount - The amount of runes to send
 * @returns Promise<any> - The result of the edict
 */
export const sendRunesToMultisig = async (
    runeId: string,
    bitcoinAmount: number,
    runeAmount: bigint
): Promise<any> => {
    console.log("Sending runes to multisig address");

    const btcTx = await edictRune(configTo, {
        transfers: [
            {
                receiver: multisigAddress,
                amount: 300_000 + Number(parseUnits(bitcoinAmount.toString(), 8)),
            },
            {
                receiver: multisigAddress,
                runeId: runeId,
                amount: runeAmount,
            },
        ],
        publish: false,
    });

    console.log("Successfully created edict transaction");

    return btcTx;
};

/**
 * Creates a rune for a wallet
 * @param wallet - The wallet to create the rune for
 * @returns Promise<string> - The rune ID
 */
export const createRuneForWallet = async (wallet: WalletInfo): Promise<string> => {
    console.log(`Creating new rune for wallet with address: ${wallet.address}`);

    const etching = await etchRune(wallet.config, {
        name: `RUNE•LOAD•TEST•${wallet.address.substring(0, 8).toUpperCase().replace(/[^A-Z]/g, '')}`,
        receiver: wallet.address,
        amount: 100000000,
        premine: 100000000,
    });

    const fundingTxHash = await broadcastTransaction(wallet.config, etching.fundingTx);
    const etchingTxHash = await broadcastTransaction(wallet.config, etching.etchingTx);
    const revealTxHash = await broadcastTransaction(wallet.config, etching.revealTx);
    console.log("Rune creation transactions:", fundingTxHash, etchingTxHash, revealTxHash);

    await waitForTransaction(wallet.config, revealTxHash, 6);

    // Get the newly created rune ID
    const newRunesData = await getRunes(wallet.config, {address: wallet.address, limit: 20});
    if (newRunesData && newRunesData.results && newRunesData.results.length > 0) {
        console.log("New rune ID:", newRunesData.results[0].rune.id);
        return newRunesData.results[0].rune.id;
    } else {
        throw new Error("Failed to get rune ID");
    }
};

/**
 * Creates an edict for a wallet
 * @param wallet - The wallet to create the edict for
 * @param runeId - The rune ID to use
 * @param bitcoinAmount - The amount of Bitcoin to send
 * @param runeAmount - The amount of runes to send
 * @param receiver
 * @param publish
 * @returns Promise<any> - The result of the edict
 */
export const createEdictForWallet = async (
    wallet: WalletInfo,
    runeId: string,
    bitcoinAmount: number,
    runeAmount: bigint,
    receiver: string,
    publish: boolean
): Promise<any> => {
    console.log(`Creating edict for wallet with address: ${wallet.address}`);

    const btcTx = await edictRune(wallet.config, {
        transfers: [
            {
                receiver: receiver,
                amount: 30_000 + Number(parseUnits(bitcoinAmount.toString(), 8)),
            },
            {
                receiver: receiver,
                runeId: runeId,
                amount: runeAmount,
            },
        ],
        publish: publish,
    });

    console.log(`Successfully created edict transaction for wallet with address: ${wallet.address}`);

    return btcTx;
};

/**
 * Creates an edict for multiple wallets in a single transaction
 * @param sourceWallet - The wallet to create the edict from
 * @param runeId - The rune ID to use
 * @param bitcoinAmount - The amount of Bitcoin to send
 * @param runeAmount - The amount of runes to send
 * @param receiverAddresses - Array of receiver addresses
 * @param publish - Whether to publish the transaction
 * @returns Promise<any> - The result of the edict
 */
export const createEdictForMultipleWallets = async (
    sourceWallet: WalletInfo,
    runeId: string,
    bitcoinAmount: number,
    runeAmount: bigint,
    receiverAddresses: string[],
    publish: boolean
): Promise<any> => {
    console.log(`Creating edict for multiple wallets from wallet with address: ${sourceWallet.address}`);

    // Limit to processing only two addresses at a time
    const addressesToProcess = receiverAddresses.slice(0, 2);
    console.log(`Processing ${addressesToProcess.length} addresses in this batch`);

    // Create transfers array with two entries for each receiver (one for BTC, one for rune)
    const transfers = addressesToProcess.flatMap(receiver => [
        {
            receiver: receiver,
            amount: 30_000 + Number(parseUnits(bitcoinAmount.toString(), 8)),
        },
        {
            receiver: receiver,
            runeId: runeId,
            amount: runeAmount,
        }
    ]);

    const btcTx = await edictRune(sourceWallet.config, {
        transfers: transfers,
        publish: publish,
    });

    console.log(`Successfully created edict transaction for ${addressesToProcess.length} wallets from wallet with address: ${sourceWallet.address}`);

    return btcTx;
};

/**
 * Creates runes and edicts for multiple wallets
 * @param wallets - The wallets to create runes and edicts for
 * @param bitcoinAmount - The amount of Bitcoin to send
 * @param runeAmount - The amount of runes to send
 * @returns Promise<{runeId: string, assetAddress: string, runeExists: boolean, walletResults: {wallet: WalletInfo, btcTx: any}[]}> - The results
 */
export const createRunesAndEdictsForWallets = async (
    wallets: WalletInfo[],
    bitcoinAmount: number,
    runeAmount: bigint
): Promise<{
    runeId: string,
    assetAddress: string,
    runeExists: boolean,
    walletResults: { wallet: WalletInfo, btcTx: any }[]
}> => {
    if (wallets.length === 0) {
        throw new Error("No wallets provided");
    }

    console.log(`Creating runes and edicts for ${wallets.length} wallets`);

    // Check if rune already exists for the first wallet
    let runeId = await checkRuneExists(wallets[0].address, wallets[0].config);
    let runeExists = false;

    if (runeId) {
        console.log(`Rune already exists with ID ${runeId} for wallet with address: ${wallets[0].address}`);
        runeExists = true;
    } else {
        // Create a rune for the first wallet
        runeId = await createRuneForWallet(wallets[0]);
        console.log(`Created rune with ID ${runeId} for wallet with address: ${wallets[0].address}`);
    }

    // Get asset address for the rune ID
    console.log("Getting asset address for rune ID:", runeId);
    const assetAddress = await getAssetAddressByRuneId(runeId);
    console.log("Asset address for rune ID:", assetAddress);

    const walletResults = [];

    if (!runeExists) {
        console.log(`Creating edict for wallet 1/${wallets.length} with address: ${wallets[0].address}`);
        const btcTx1 = await createEdictForWallet(wallets[0], runeId, bitcoinAmount, runeAmount, multisigAddress, false);
        walletResults.push({wallet: wallets[0], btcTx: btcTx1});
    }

    return {runeId, assetAddress, runeExists, walletResults};
};
