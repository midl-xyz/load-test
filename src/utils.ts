import {Account, waitForTransaction} from "@midl/core";
import {executorAddress, goldERC20Address, midlRegtestClient, midlRegtestWalletClient, WETH} from "./config";
import {approveTokens, getAssetAddressByRuneId, getRuneIdByAssetAddress, Reserve} from "@/evm";
import {erc20Abi, zeroAddress} from "viem";
import {
    addCompleteTxIntention,
    addRequestAddAssetIntention,
    finalizeBTCTransaction,
    signIntention,
    SystemContracts,
    TransactionIntention,
    weiToSatoshis
} from "@midl/executor";
import {getCode, waitForTransactionReceipt} from "viem/actions";
import {createRuneForWallet} from "@/runes";
import assert from "node:assert";

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
    BTCSynthetic: number,
    SyntheticBTC: bigint,
}

export async function getRandomSwapValues(reserves: Reserve[], tokenAAddress: string): Promise<randomSwapValue[]> {
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
    const [BTCReserves, TokenAFromBTCPool] = reserves[0].tokenAAddress === WETH
        ? [reserves[0].tokenA, reserves[0].tokenB]
        : [reserves[0].tokenB, reserves[0].tokenA]

    const TokenAFromTokenPool = reserves[1].tokenAAddress === tokenAAddress
        ? reserves[1].tokenA
        : reserves[1].tokenB

    const [BTCSyntheticReserves, SyntheticReserves] = reserves[2].tokenAAddress === WETH
        ? [reserves[2].tokenA, reserves[2].tokenB]
        : [reserves[2].tokenB, reserves[2].tokenA]

    for (let i = 0; i < amountOfTestWallets; i++) {
        res.push({
            BTCTokenA: weiToSatoshis(getRandomBigInt(BTCReserves)),
            TokenABTC: getRandomBigInt(TokenAFromBTCPool),
            TokenATokenB: getRandomBigInt(TokenAFromTokenPool),
            BTCSynthetic: weiToSatoshis(getRandomBigInt(BTCSyntheticReserves)),
            SyntheticBTC: getRandomBigInt(SyntheticReserves)
        })
    }
    return res
}

export async function checkSystemContracts() {
    const systemContracts = [
        SystemContracts.ValidatorRegistry,
        SystemContracts.Staking,
        SystemContracts.MidlToken,
        SystemContracts.Executor,
        SystemContracts.SynthReservoir,
        SystemContracts.GlobalParams,
        SystemContracts.FeesDistributor,
        SystemContracts.RuneImplementation,
        SystemContracts.Treasury,
        SystemContracts.Multicall3,
    ]
    for (const systemContract of systemContracts) {
        const v = await getCode(midlRegtestClient, {address: systemContract})
        assert(v !== undefined, `System contract is undefined: ${systemContract}`)
    }
}

export async function createSyntheticAsset(baseWallet: WalletInfo) {
    console.log("Test ERC20 Synthetic Rune mapping");

    let runeId = await getRuneIdByAssetAddress(goldERC20Address);
    if (runeId === '0:0') {
        const runeName = "END•TO•END•RUNE•" + generateRandomString(4)
        const amount = BigInt(100_000_000_000) * (10n ** 18n);

        runeId = await createRuneForWallet(baseWallet, runeName, String(amount) as unknown as number)
        const intention = await addRequestAddAssetIntention(baseWallet.config, {
            runeId: runeId,
            address: goldERC20Address,
            amount,
        })

        let btcTransactionResult = await executeBTCTransactionWithIntentions(baseWallet, [intention])
        await waitForTransaction(baseWallet.config, btcTransactionResult.btcTxId, 1);
        assert(await getAssetAddressByRuneId(runeId) === goldERC20Address, "Synthetic rune mapping failed");
        console.log(`Synthetic runeId successfully created with runeId: ${runeId} at address: ${goldERC20Address}`);
        const completeTxAmount = amount / 10000n
        console.log(`Sending MIDL pack with completeTx to fill the reservoir with amount: ${completeTxAmount}`)
        const approveIntention = await approveTokens(goldERC20Address, executorAddress, completeTxAmount, baseWallet)
        const completeTxIntention = await addCompleteTxIntention(baseWallet.config, {
            runes: [
                {
                    id: runeId,
                    address: goldERC20Address,
                    amount: completeTxAmount,
                }
            ]
        })
        btcTransactionResult = await executeBTCTransactionWithIntentions(baseWallet, [approveIntention, completeTxIntention])
        await waitForTransaction(baseWallet.config, btcTransactionResult.btcTxId, 1);
    } else {
        console.log(`Synthetic rune mapping already exists for rune ID ${runeId} at address ${goldERC20Address}`);
    }

    const synthAddress = await getAssetAddressByRuneId(runeId)
    assert(synthAddress === goldERC20Address, "Synthetic rune mapping failed");

    const balance = await midlRegtestClient.readContract({
        address: synthAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [SystemContracts.SynthReservoir]
    })
    assert(balance !== 0n, "Balance of SynthReservoir should not be zero");

    return runeId
}