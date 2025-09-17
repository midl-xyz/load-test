import {broadcastTransaction, etchRune, getRune, waitForTransaction} from "@midl-xyz/midl-js-core";
import {WalletInfo} from "./utils";
import {getRuneId} from "@/bitcoin";

export const createRuneForWallet = async (wallet: WalletInfo, name: string, premine: number): Promise<string> => {
    console.log(`Creating new rune for wallet with address: ${wallet.address}`);

    const etching = await etchRune(wallet.config, {
        name: name,
        receiver: wallet.address,
        premine: premine,
        divisibility: 18,
    });

    const fundingTxHash = await broadcastTransaction(wallet.config, etching.fundingTx);
    const etchingTxHash = await broadcastTransaction(wallet.config, etching.etchingTx);
    const revealTxHash = await broadcastTransaction(wallet.config, etching.revealTx);
    console.log("Rune creation transactions:", fundingTxHash, etchingTxHash, revealTxHash);

    await waitForTransaction(wallet.config, revealTxHash, 6);
    const runeId = await getRuneId(revealTxHash)

    // Get the newly created rune ID
    const newRunesData = await getRune(wallet.config, runeId)
    if (newRunesData) {
        console.log("New rune ID:", newRunesData.id);
        return newRunesData.id;
    } else {
        throw new Error("Failed to get rune ID");
    }
};

