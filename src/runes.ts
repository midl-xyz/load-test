import { broadcastTransaction, etchRune, getRune, waitForTransaction } from "@midl/core";
import { WalletInfo } from "./utils";

export const createRuneForWallet = async (wallet: WalletInfo, name: string, premine: number): Promise<string> => {
    console.log(`Creating new rune for wallet with address: ${wallet.ordinalsAccount.address}`);

    try {
        const existingRunesData = await getRune(wallet.config, name);

        if (existingRunesData) {
            console.log("Rune already exists with ID:", existingRunesData.id);
            return existingRunesData.id;
        }
    } catch (error) {
    }


    const etching = await etchRune(wallet.config, {
        name: name,
        premine: premine,
        divisibility: 18,
    });

    const fundingTxHash = await broadcastTransaction(wallet.config, etching.fundingTx);
    await waitForTransaction(wallet.config, fundingTxHash, 1, {
        intervalMs: 1000
    });

    const etchingTxHash = await broadcastTransaction(wallet.config, etching.etchingTx);
    await waitForTransaction(wallet.config, etchingTxHash, 1, {
        intervalMs: 1000
    });

    const revealTxHash = await broadcastTransaction(wallet.config, etching.revealTx);
    console.log("Rune creation transactions:", fundingTxHash, etchingTxHash, revealTxHash);

    await waitForTransaction(wallet.config, revealTxHash, 7, {
        intervalMs: 1000
    });

    const newRunesData = await getRune(wallet.config, name)

    if (newRunesData) {
        console.log("New rune ID:", newRunesData.id);
        return newRunesData.id;
    } else {
        throw new Error("Failed to get rune ID");
    }
};

