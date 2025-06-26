import {connect, waitForTransaction} from "@midl-xyz/midl-js-core";
import {getPublicKey} from "@midl-xyz/midl-js-executor";

import {AddressPurpose, configFrom, midlRegtestWalletClient, multisigAddress, regtest} from "@/config";
import {getWalletBalance, transferBitcoinForSwap, transferBitcoinToMultipleWallets} from "@/bitcoin";
import {createEdictForWallet, createRunesAndEdictsForWallets} from "@/runes";
import {addLiquidity, approveTokens, completeTx, swapETHForTokens} from "@/evm";
import {createMultipleWallets, waitRuneAddress, WalletInfo} from "@/utils";


// Interface for load test statistics
interface LoadTestStats {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    avgTimeMs: number;
    tps: number;           // Transactions Per Second
    operationTimes: number[];
    errors: Error[];
}

/**
 * Prepares transactions for a wallet
 * @param wallet - The wallet to prepare transactions for
 * @param assetAddress - The asset address for the swap
 * @param bitcoinAmount - The amount of Bitcoin to swap
 * @param runeId - The rune ID
 * @returns Promise<{txs: `0x${string}`[], txHex: string}> - The prepared transactions
 */
const prepareTransactionsForWallet = async (
    wallet: WalletInfo,
    assetAddress: string,
    bitcoinAmount: number,
    runeId: string,
): Promise<{ txs: `0x${string}`[], txHex: string, txId: string }> => {
    const publicKey = getPublicKey(wallet.config, wallet.publicKey);

    let txId: string
    let txHex: string
    const btcTransferForCompleteTx = await transferBitcoinForSwap(multisigAddress, bitcoinAmount, wallet);
    // const btcTransferForCompleteTx = await edictRunesForSwap(multisigAddress, bitcoinAmount, wallet, runeId, 100);
    txId = btcTransferForCompleteTx.tx.id
    txHex = btcTransferForCompleteTx.tx.hex
    const txs: `0x${string}`[] = []

    for (let i = 0; i < 4; i++) {
        const swapTx = await swapETHForTokens(
            assetAddress,
            bitcoinAmount,
            txId,
            publicKey as `0x${string}`,
            wallet,
        );
        txs.push(swapTx as `0x${string}`)
    }

    const cTx = await completeTx(
        assetAddress,
        txId,
        publicKey as `0x${string}`,
        wallet,
    )
    txs.push(cTx as `0x${string}`)

    return {
        txs,
        txHex,
        txId
    };
};

/**
 * Performs a single swap operation using a specific wallet and returns the result
 * @param wallet - The wallet to use for the swap
 * @param preparedTransactions - The prepared transactions
 * @returns Promise<{success: boolean, timeMs: number, error?: Error}> - The result of the operation
 */
const performOperationWithWallet = async (
    wallet: WalletInfo,
    preparedTransactions: { txs: `0x${string}`[], txHex: string, txId: string }
): Promise<{ success: boolean, error?: Error }> => {
    try {
        await midlRegtestWalletClient.sendBTCTransactions({
            serializedTransactions: preparedTransactions.txs,
            btcTransaction: preparedTransactions.txHex,
        });
        return {
            success: true,
        };
    } catch (error: any) {
        console.error(`Failed swap operation with wallet address: ${wallet.address} with error: ${error}`);
        return {
            success: false,
            error
        };
    }
};

/**
 * Runs a load test for swap operations with multiple wallets
 * @param assetAddress - The asset address for the swap
 * @param bitcoinAmount - The amount of Bitcoin to swap
 * @param wallets - The wallets to use for the swap operations
 * @param runeId
 * @returns Promise<LoadTestStats> - The statistics from the load test
 */
const runMultiWalletSwapLoadTest = async (
    assetAddress: string,
    bitcoinAmount: number,
    wallets: WalletInfo[],
    runeId: string,
): Promise<LoadTestStats> => {
    const stats: LoadTestStats = {
        totalOperations: wallets.length,
        successfulOperations: 0,
        failedOperations: 0,
        totalTimeMs: 0,
        minTimeMs: Number.MAX_SAFE_INTEGER,
        maxTimeMs: 0,
        avgTimeMs: 0,
        tps: 0,
        operationTimes: [],
        errors: []
    };

    const operations = [];

    let batch = 0
    let transactionPromises = []
    for (const [i, wallet] of wallets.entries()) {
        if (batch >= 20) {
            const resolvedBatch = await Promise.all(transactionPromises)
            operations.push(resolvedBatch)
            batch = 0
            transactionPromises = []
        }

        console.log(`Creating operations for wallet ${i + 1}/${wallets.length}`);

        const promise = (async () => {
            const preparedTxs = await prepareTransactionsForWallet(
                wallet,
                assetAddress,
                bitcoinAmount,
                runeId
            );
            return {
                wallet: wallet,
                preparedTransactions: preparedTxs
            };
        })();

        transactionPromises.push(promise);

        batch = batch + 1
    }

    if (batch !== 0) {
        const resolvedBatch = await Promise.all(transactionPromises)
        operations.push(resolvedBatch)
    }

    const startTime = Date.now();
    let totalOperationsTime = 0
    console.log(`Created ${operations.length} batches of operations`);

    let totalResults = []
    for (let i = 0; i < operations.length; i++) {
        const batch = operations[i];

        console.log(`\nIteration ${i + 1}/${operations.length}:`);
        const operationStartTime = Date.now();
        const results = await Promise.all(
            batch.map(op =>
                performOperationWithWallet(
                    op.wallet,
                    op.preparedTransactions,
                )
            )
        );
        const operationEndTime = Date.now();
        const timeDiff = operationEndTime - operationStartTime;
        totalOperationsTime += timeDiff;
        console.log(`Batch ${i + 1} process time is ${(timeDiff / 1000).toFixed(2)}s`);
        totalResults.push(results)
    }

    const endTime = Date.now();
    const totalTestTimeMs = endTime - startTime;

    // Process results
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const batchResults of totalResults) {
        let batchSuccessful = 0;
        let batchFailed = 0;

        for (const result of batchResults) {
            if (result.success) {
                stats.successfulOperations++;
                batchSuccessful++;
                totalSuccessful++;
            } else {
                stats.failedOperations++;
                batchFailed++;
                totalFailed++;
                if (result.error) {
                    stats.errors.push(result.error);
                }
            }
        }
        console.log(`Batch results: ${batchSuccessful} successful, ${batchFailed} failed`);
    }

    console.log(`Overall: ${totalSuccessful} successful, ${totalFailed} failed operations`);

    // Calculate TPS (Transactions Per Second)
    stats.tps = (stats.totalOperations / totalOperationsTime) * 1000;

    // Print statistics
    console.log("\n=== Multi-Wallet Swap Load Test Statistics ===");
    console.log(`Total operations: ${stats.totalOperations}`);
    console.log(`Successful operations: ${stats.successfulOperations}`);
    console.log(`Failed operations: ${stats.failedOperations}`);
    console.log(`Success rate: ${((stats.successfulOperations / stats.totalOperations) * 100).toFixed(2)}%`);
    console.log(`Total test time: ${totalTestTimeMs}ms`);
    console.log(`TPS (Transactions Per Second): ${stats.tps.toFixed(2)}`);
    console.log(`Wallets used: ${wallets.length}`);

    return stats;
};

interface Config {
    txCount: number;
}

async function main() {
    const defaultConfig: Config = {
        txCount: 10,
    }

    // Parse command line arguments
    const args = process.argv.slice(2);
    let txCountArg: number | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--txCount' && i + 1 < args.length) {
            const value = parseInt(args[i + 1]);
            if (!isNaN(value)) {
                txCountArg = value;
            }
        }
    }

    // Override default config with command line arguments if provided
    const config: Config = {
        ...defaultConfig,
        ...(txCountArg !== undefined && {txCount: txCountArg})
    }

    console.log(`Running test with txCount: ${config.txCount}`);
    await runTest(config)
}

async function runTest(config: Config) {
    try {
        const accounts = await connect(configFrom, {
            purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment],
            network: regtest
        });
        console.log(`Base wallet ${accounts[0].address} to which BTC should be transferred`);

        const walletBalance = await getWalletBalance({
            keyPair: "",
            config: configFrom,
            publicKey: "",
            address: accounts[0].address,
            privateKey: ""
        })
        if (walletBalance === 0) {
            console.error("Base wallet balance is 0, please transfer some BTC to the base wallet");
            return
        }

        // Step 1: Create wallets
        const numberOfWallets = config.txCount;
        console.log(`Creating ${numberOfWallets} wallets...`);
        const wallets = await createMultipleWallets(numberOfWallets);
        console.log(`Created ${wallets.length} wallets successfully`);

        // Step 2: Transfer BTC from configTo to each wallet, with more to the first wallet
        console.log(`Checking and transferring BTC to each of the ${wallets.length} wallets...`);
        const regularTransferAmount = 1000000; // 0.01 BTC in satoshis
        const firstWalletTransferAmount = 110000000; // 1.1 BTC in satoshis
        // Check and transfer regular amount to the remaining wallets
        if (wallets.length > 1) {
            const walletsToFund = [];
            const transferAmounts = [];

            // Check each wallet's balance
            for (let i = 0; i < wallets.length; i++) {
                const walletBalance = await getWalletBalance(wallets[i]);
                console.log(`Wallet ${i} balance: ${walletBalance / 100000000} BTC`);

                // Use different transfer amount for the first wallet
                const requiredAmount = i === 0 ? firstWalletTransferAmount : regularTransferAmount;

                if (walletBalance < requiredAmount / 2) {
                    const transferAmount = requiredAmount - walletBalance;
                    console.log(`Wallet ${i} balance (${walletBalance / 100000000} BTC) is less than half of required amount (${requiredAmount / 2 / 100000000} BTC)`);
                    console.log(`Will transfer ${transferAmount / 100000000} BTC to wallet with address: ${wallets[i].address}`);
                    walletsToFund.push(wallets[i]);
                    transferAmounts.push(transferAmount);
                } else {
                    console.log(`Wallet ${i} has sufficient balance (${walletBalance / 100000000} BTC), skipping transfer`);
                }
            }

            // Transfer BTC to wallets that need funding
            if (walletsToFund.length > 0) {
                console.log(`Transferring BTC to ${walletsToFund.length} wallets that need funding...`);
                for (let i = 0; i < walletsToFund.length; i++) {
                    await transferBitcoinToMultipleWallets([walletsToFund[i]], transferAmounts[i]);
                }
            } else {
                console.log(`All wallets have sufficient balance, no transfers needed`);
            }
        }

        console.log(`Successfully transferred Bitcoin to all ${wallets.length} wallets`);

        // Step 3: Create an etchRune for one wallet and edicts for the others
        console.log("Creating runes and edicts for wallets...");
        const btcPool = 1;
        const runePool = 50_000_000n;

        const runeResults = await createRunesAndEdictsForWallets(wallets);
        console.log(`Created rune with ID ${runeResults.runeId} and asset address ${runeResults.assetAddress}`);


        // Only approve tokens and add liquidity for the first wallet and only if the rune doesn't already exist
        if (!runeResults.runeExists) {
            console.log("Broadcast btc tx to multisig address and waiting erc20 creation");
            await createEdictForWallet(wallets[0], runeResults.runeId, 0.0001, 50_000n, multisigAddress, true);
            const runeAddress = await waitRuneAddress(runeResults.runeId);
            runeResults.assetAddress = runeAddress;
            console.log(`Erc20 created, address: ${runeAddress}`);
            console.log("Rune is newly created, approving tokens and adding liquidity for the first wallet");

            const btcTx1 = await createEdictForWallet(wallets[0], runeResults.runeId, btcPool, runePool, multisigAddress, false);

            // Get public key for the first wallet
            const pk = getPublicKey(wallets[0].config, wallets[0].publicKey);

            // Approve tokens for spending by the Uniswap router
            console.log("Approving tokens for the first wallet");
            const approvalTxHash = await approveTokens(
                runeResults.assetAddress,
                runePool,
                btcTx1.tx.id,
                pk as `0x${string}`,
                wallets[0]
            );

            // Add liquidity to Uniswap
            console.log("Adding liquidity for the first wallet");
            const addLiquidityTxHash = await addLiquidity(
                runeResults.assetAddress,
                runePool,
                btcPool,
                btcTx1.tx.id,
                pk as `0x${string}`,
                wallets[0]
            );

            const txs = await midlRegtestWalletClient.sendBTCTransactions({
                serializedTransactions: [approvalTxHash as `0x${string}`, addLiquidityTxHash as `0x${string}`],
                btcTransaction: btcTx1.tx.hex,
            })
            console.log("Approve and addLiquidityTx sent: ", txs);
            await waitForTransaction(wallets[0].config, btcTx1.tx.id, 1);
        } else {
            console.log("Rune already exists, skipping token approval and liquidity addition");
        }

        // Check rune balance for each wallet and create edicts in pairs
        // if (wallets.length > 1) {
        //     console.log(`Checking rune balance for ${wallets.length - 1} remaining wallets`);
        //
        //     // Filter wallets that need runes (balance < runeAmount/2)
        //     const walletsNeedingRunes = [];
        //     const walletsWithRunes = [];
        //     for (let i = 0; i < wallets.length; i++) {
        //         try {
        //             const runeBalanceResponse = await getRuneBalance(wallets[i].config, {
        //                 address: wallets[i].address,
        //                 runeId: runeResults.runeId
        //             });
        //             const balance = BigInt(runeBalanceResponse.balance || "0");
        //             console.log(`Wallet ${i} rune balance: ${balance}`);
        //             walletsWithRunes.push(wallets[i]);
        //         } catch (error) {
        //             console.log(`Error checking rune balance for wallet ${i}, wallet need runes`);
        //             walletsNeedingRunes.push(wallets[i]);
        //         }
        //     }
        //
        //     console.log(`${walletsNeedingRunes.length} wallets need runes`);
        //
        //     if (walletsNeedingRunes.length > 0) {
        //         await distributeRunesToWallets(walletsWithRunes, runeResults.runeId, walletsNeedingRunes)
        //     }
        // }

        // Step 4: Perform swap operations concurrently using all wallets
        console.log("Starting multi-wallet swap operations load test");
        // Run the multi-wallet load test
        await runMultiWalletSwapLoadTest(
            runeResults.assetAddress,
            0.0001,
            wallets,
            runeResults.runeId,
        );
        console.log("All operations completed successfully");
    } catch (e: any) {
        console.error("Error during combined operations:");

        if ("response" in e) {
            console.error("Response error:", e.response);
        }

        if ("request" in e) {
            console.error("Request error:", e.request);
        }

        console.error(e);
        throw e;
    }
}

// Execute the combined operations
main()
    .then(() => {
        console.log("Script completed successfully");
    })
    .catch((error) => {
        console.error("Script failed:", error);
    });
