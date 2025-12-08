import {Account} from "@midl/core";
import {midlRegtestWalletClient, WETH} from "./config";
import {getAssetAddressByRuneId, Reserve} from "@/evm";
import {zeroAddress} from "viem";
import {finalizeBTCTransaction, signIntention, TransactionIntention, weiToSatoshis} from "@midl/executor";
import {waitForTransactionReceipt} from "viem/actions";

/**
 * Interface for wallet information
 */
export interface WalletInfo {
    config: any;
    paymentAccount: Account;
    ordinalsAccount: Account;
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
    console.log(`MIDL transactions: ${txs}, BTC transaction: ${transferBtcResp.tx.id}`);

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

export function isWithinTolerance(actual: number, expected: number, tolerancePercent: number = 5): boolean {
    const tolerance = Math.abs(expected * tolerancePercent / 100);
    const difference = Math.abs(actual - expected);
    return difference <= tolerance;
}

export interface randomSwapValue {
    BTCTokenA: number,
    TokenABTC: bigint,
    TokenATokenB: bigint
}

export async function getRandomSwapValues(BTCTokenReserves: Reserve, TokenToTokenReserves: Reserve, tokenAAddress: string): Promise<randomSwapValue[]> {
    const amountOfTestWallets = Number(process.env.TEST_WALLETS ?? "1");
    const res: randomSwapValue[] = []
    const getRandomBigInt = (max: bigint, percentage: number = 0.01): bigint => {
        const maxValue = max * BigInt(Math.floor(percentage * 100)) / 100n
        if (maxValue <= BigInt(Number.MAX_SAFE_INTEGER)) {
            return BigInt(Math.floor(Math.random() * Number(maxValue)))
        } else {
            return maxValue / BigInt(Math.floor(Math.random() * 10) + 1)
        }
    }
    const [BTCReserves, TokenAFromBTCPool] = BTCTokenReserves.tokenAAddress === WETH
        ? [BTCTokenReserves.tokenA, BTCTokenReserves.tokenB]
        : [BTCTokenReserves.tokenB, BTCTokenReserves.tokenA]

    const TokenAFromTokenPool = TokenToTokenReserves.tokenAAddress === tokenAAddress
        ? TokenToTokenReserves.tokenA
        : TokenToTokenReserves.tokenB
    for (let i = 0; i < amountOfTestWallets; i++) {
        res.push({
            BTCTokenA: weiToSatoshis(getRandomBigInt(BTCReserves)),
            TokenABTC: getRandomBigInt(TokenAFromBTCPool),
            TokenATokenB: getRandomBigInt(TokenAFromTokenPool),
        })
    }
    return res
}