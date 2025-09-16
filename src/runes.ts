import {broadcastTransaction, etchRune, getRunes, waitForTransaction} from "@midl-xyz/midl-js-core";
import {WalletInfo} from "./utils";

export const createRuneForWallet = async (wallet: WalletInfo, name: string, premine: number): Promise<string> => {
    console.log(`Creating new rune for wallet with address: ${wallet.address}`);

    const etching = await etchRune(wallet.config, {
        name: name,
        receiver: wallet.address,
        premine: premine,
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

