import {broadcastTransaction, getUTXOs, transferBTC} from "@midl-xyz/midl-js-core";
import {parseUnits} from "viem";
import {configFrom, configTo} from "./config";
import {WalletInfo} from "./utils";

/**
 * Transfers Bitcoin from one address to another
 * @param receiverAddress - The address to send Bitcoin to
 * @param amount - The amount of Bitcoin to send in satoshis
 * @returns Promise<any> - The result of the transfer
 */
export const transferBitcoin = async (receiverAddress: string, amount: number) => {
    console.log(`Transferring ${amount / 100000000} BTC to ${receiverAddress}`);

    // Execute the transfer
    const result = await transferBTC(configFrom, {
        transfers: [
            {
                receiver: receiverAddress,
                amount,
            },
        ],
        publish: true,
    });

    console.log("Transfer successful!");
    console.log("Transaction ID:", result.tx.id);

    return result;
};

/**
 * Transfers Bitcoin from configTo to multiple wallets
 * @param wallets - The wallets to send Bitcoin to
 * @param amount - The amount of Bitcoin to send to each wallet in satoshis
 * @returns Promise<any[]> - The results of the transfers
 */
export const transferBitcoinToMultipleWallets = async (wallets: WalletInfo[], amount: number) => {
    console.log(`Transferring ${amount / 100000000} BTC to ${wallets.length} wallets`);

    const results = [];

    for (let i = 0; i < wallets.length; i++) {
        console.log(`Transferring to wallet ${i + 1}/${wallets.length} with address: ${wallets[i].address}`);

        // Execute the transfer
        const result = await transferBTC(configFrom, {
            transfers: [
                {
                    receiver: wallets[i].address,
                    amount,
                },
            ],
            publish: true,
        });

        console.log(`Transfer to wallet ${i + 1} successful!`);
        console.log("Transaction ID:", result.tx.id);

        results.push(result);
    }

    return results;
};

/**
 * Checks if an address has any UTXOs
 * @param address - The address to check
 * @returns Promise<boolean> - True if the address has UTXOs, false otherwise
 */
export const hasUTXOs = async (address: string): Promise<boolean> => {
    const utxos = await getUTXOs(configTo, address);
    return utxos && utxos.length > 0;
};

/**
 * Gets the total BTC balance from UTXOs for a wallet
 * @param wallet - The wallet to check
 * @returns Promise<number> - The total BTC balance in satoshis
 */
export const getWalletBalance = async (wallet: WalletInfo): Promise<number> => {
    const utxos = await getUTXOs(wallet.config, wallet.address);

    if (!utxos || utxos.length === 0) {
        return 0;
    }

    // Sum up the values of all UTXOs
    return utxos.reduce((total, utxo) => total + utxo.value, 0);
};

/**
 * Transfers Bitcoin for a swap operation
 * @param receiverAddress - The address to send Bitcoin to
 * @param bitcoinAmount - The amount of Bitcoin to send
 * @param wallet - The wallet information
 * @returns Promise<any> - The result of the transfer
 */
export const transferBitcoinForSwap = async (receiverAddress: string, bitcoinAmount: number, wallet: WalletInfo) => {
    return await transferBTC(wallet.config, {
        transfers: [
            {
                receiver: receiverAddress,
                amount: 10_000 + Number(parseUnits(bitcoinAmount.toString(), 8)),
            },
        ],
        publish: true,
    });
};

/**
 * Broadcasts a Bitcoin transaction
 * @param txHex - The transaction hex to broadcast
 * @returns Promise<string> - The transaction hash
 */
export const broadcastBitcoinTransaction = async (txHex: string): Promise<string> => {
    return await broadcastTransaction(configTo, txHex);
};
