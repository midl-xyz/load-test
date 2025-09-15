import {Account} from "@midl-xyz/midl-js-core";
import {midlRegtestWalletClient} from "./config";
import {getAssetAddressByRuneId} from "@/evm";
import {zeroAddress} from "viem";
import {finalizeBTCTransaction, signIntention, TransactionIntention} from "@midl-xyz/midl-js-executor";
import {waitForTransactionReceipt} from "viem/actions";

/**
 * Interface for wallet information
 */
export interface WalletInfo {
    config: any;
    address: string;
    publicKey: string;
    accounts: Account[];
    evmAddress: `0x${string}`;
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

export async function executeBTCTransactionWithIntentions(
    wallet: WalletInfo,
    intentions: TransactionIntention[],
    skipEstimateGasMulti?: boolean
): Promise<{ btcTxId: string }> {
    const transferBtcResp = await finalizeBTCTransaction(
        wallet.config,
        intentions,
        midlRegtestWalletClient,
        {
            skipEstimateGas: skipEstimateGasMulti,
        }
    );

    const signedTxs: `0x07${string}`[] = [];
    for (const intention of intentions) {
        const signedTx = await signIntention(wallet.config, midlRegtestWalletClient, intention, intentions, {
            txId: transferBtcResp.tx.id
        });
        signedTxs.push(signedTx);
    }

    const txs = await midlRegtestWalletClient.sendBTCTransactions({
        serializedTransactions: signedTxs,
        btcTransaction: transferBtcResp.tx.hex,
    });
    console.log(`Transactions hashes: `, txs);

    for (const txHash of txs) {
        console.log(`waitForTransactionReceipt tx ${txHash}`);
        const receipt = await waitForTransactionReceipt(midlRegtestWalletClient, {
            hash: txHash
        });
        if (receipt.status === "reverted") {
            throw new Error(`tx was reverted, txHash: ${txHash}`);
        }
    }
    return {btcTxId: transferBtcResp.tx.id};
}

export function generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}