import {edictRune, getUTXOs, transferBTC} from "@midl-xyz/midl-js-core";
import {parseUnits} from "viem";
import {configFrom} from "./config";
import {WalletInfo} from "./utils";

/**
 * Transfers Bitcoin from configTo to multiple wallets
 * @param wallets - The wallets to send Bitcoin to
 * @param amount - The amount of Bitcoin to send to each wallet in satoshis
 * @returns Promise<any[]> - The results of the transfers
 */
export const transferBitcoinToMultipleWallets = async (wallets: WalletInfo[], amount: number) => {
    const results = [];
    const transfers: { receiver: string, amount: number }[] = [];

    for (let i = 0; i < wallets.length; i++) {
        transfers.push({
            receiver: wallets[i].address,
            amount: amount,
        });
    }

    const result = await transferBTC(configFrom, {
        transfers: transfers,
        publish: true,
        feeRate: 3,
    },);
    console.log("Transaction ID:", result.tx.id);
    results.push(result);
    return results;
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
 * Creates an edict for runes swap operation
 * @param receiverAddress - The address to send runes to
 * @param bitcoinAmount - The amount of Bitcoin to send
 * @param wallet - The wallet information
 * @param runeId - The rune ID to use
 * @param retry - Number of retry attempts if the operation fails
 * @returns Promise<any> - The result of the edict
 */
export const edictRunesForSwap = async (receiverAddress: string, bitcoinAmount: number, wallet: WalletInfo, runeId: string, retry: number): Promise<any> => {
    try {
        return await edictRune(wallet.config, {
            transfers: [
                {
                    runeId: runeId,
                    amount: 1000n,
                    receiver: receiverAddress,
                },
                {
                    receiver: receiverAddress,
                    amount: 20_000 + Number(parseUnits(bitcoinAmount.toString(), 8)),
                },
            ],
            publish: false,
        })
    } catch (error: any) {
        if (retry === 0) {
            throw new Error(`Failed to edict runes: ${error}`)
        }
        console.info(`Failed to edict runes: ${error}, try again later.`)
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await edictRunesForSwap(receiverAddress, bitcoinAmount, wallet, runeId, retry - 1)
    }
}

export const transferBitcoinForSwap = async (receiverAddress: string, bitcoinAmount: number, wallet: WalletInfo) => {
    return await transferBTC(wallet.config, {
        transfers: [
            {
                receiver: receiverAddress,
                amount: 10_000 + Number(parseUnits(bitcoinAmount.toString(), 8)),
            },
        ],
        publish: false,
    });
};