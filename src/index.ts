import {connect, getRuneBalance, waitForTransaction} from "@midl-xyz/midl-js-core";
import {getPublicKey} from "@midl-xyz/midl-js-executor";

import {AddressPurpose, configFrom, midlRegtestWalletClient, multisigAddress, regtest} from "./config";
import {getWalletBalance, transferBitcoinForSwap, transferBitcoinToMultipleWallets} from "./bitcoin";
import {createEdictForMultipleWallets, createRunesAndEdictsForWallets} from "./runes";
import {addLiquidity, approveTokens, swapETHForTokens} from "./evm";
import {createMultipleWallets, WalletInfo} from "./utils";

// Interface for load test parameters
interface LoadTestParams {
    iterations: number;     // Number of swap operations to perform
    concurrency: number;    // Number of concurrent operations
    bitcoinAmount: number;  // Amount of Bitcoin to use for each swap
}

// Interface for load test statistics
interface LoadTestStats {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    avgTimeMs: number;
    operationTimes: number[];
    errors: Error[];
}

/**
 * Performs a single swap operation using a specific wallet and returns the result
 * @param wallet - The wallet to use for the swap
 * @param assetAddress - The asset address for the swap
 * @param bitcoinAmount - The amount of Bitcoin to swap
 * @param index - The index of the operation (for logging)
 * @returns Promise<{success: boolean, timeMs: number, error?: Error}> - The result of the operation
 */
const performSwapOperationWithWallet = async (
    wallet: WalletInfo,
    assetAddress: string,
    bitcoinAmount: number,
    index: number,
): Promise<{ success: boolean, timeMs: number, error?: Error }> => {
    const startTime = Date.now();
    try {
        // Transfer Bitcoin for swap
        const btcTransferForSwap = await transferBitcoinForSwap(multisigAddress, bitcoinAmount, wallet);

        // Get public key
        const publicKey = getPublicKey(wallet.config, wallet.publicKey);

        // Swap ETH for tokens
        const swapTx = await swapETHForTokens(
            assetAddress,
            bitcoinAmount,
            btcTransferForSwap.tx.id,
            publicKey as `0x${string}`,
            wallet,
        );

        const txs = await midlRegtestWalletClient.sendBTCTransactions({
            serializedTransactions: [swapTx as `0x${string}`],
            btcTransaction: btcTransferForSwap.tx.hex,
        });

        const endTime = Date.now();
        const timeMs = endTime - startTime;

        console.log(`Completed swap operation ${index + 1} with wallet address: ${wallet.address} in ${timeMs}ms`);
        if (txs.length !== 0) {
            console.log(`Swap tx id: ${txs[0]}`);
        }

        return {
            success: true,
            timeMs
        };
    } catch (error: any) {
        const endTime = Date.now();
        const timeMs = endTime - startTime;

        console.error(`Failed swap operation ${index + 1} with wallet address: ${wallet.address} after ${timeMs}ms:`, error);

        return {
            success: false,
            timeMs,
            error
        };
    }
};

/**
 * Creates a delay for the specified number of milliseconds
 * @param ms - The number of milliseconds to delay
 * @returns Promise<void> - A promise that resolves after the delay
 */
const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Runs a load test for swap operations with multiple wallets
 * @param assetAddress - The asset address for the swap
 * @param bitcoinAmount - The amount of Bitcoin to swap
 * @param wallets - The wallets to use for the swap operations
 * @param params - The load test parameters
 * @returns Promise<LoadTestStats> - The statistics from the load test
 */
const runMultiWalletSwapLoadTest = async (
    assetAddress: string,
    bitcoinAmount: number,
    wallets: WalletInfo[],
    params: LoadTestParams
): Promise<LoadTestStats> => {
    console.log(`Starting multi-wallet swap load test with ${params.iterations} iterations using ${wallets.length} wallets`);

    const stats: LoadTestStats = {
        totalOperations: params.iterations * wallets.length,
        successfulOperations: 0,
        failedOperations: 0,
        totalTimeMs: 0,
        minTimeMs: Number.MAX_SAFE_INTEGER,
        maxTimeMs: 0,
        avgTimeMs: 0,
        operationTimes: [],
        errors: []
    };

    const startTime = Date.now();


    const operations = Array.from({length: params.iterations}, () =>
        Array.from({length: wallets.length}, (_, i) => ({
            index: i,
            wallet: wallets[i % wallets.length]
        }))
    );


    let totalResults = []
    for (const batch of operations) {
        const results = await Promise.all(
            batch.map(op =>
                performSwapOperationWithWallet(
                    op.wallet,
                    assetAddress,
                    bitcoinAmount,
                    op.index
                )
            )
        );
        totalResults.push(results)

        // Add a small delay after each iteration (1 second)
        console.log("Adding delay between iterations...");
        await delay(1000);
    }

    // Process results
    for (const batchResults of totalResults) {
        for (const result of batchResults) {
            if (result.success) {
                stats.successfulOperations++;
            } else {
                stats.failedOperations++;
                if (result.error) {
                    stats.errors.push(result.error);
                }
            }

            stats.operationTimes.push(result.timeMs);
            stats.totalTimeMs += result.timeMs;
            stats.minTimeMs = Math.min(stats.minTimeMs, result.timeMs);
            stats.maxTimeMs = Math.max(stats.maxTimeMs, result.timeMs);
        }
    }

    const endTime = Date.now();
    const totalTestTimeMs = endTime - startTime;

    // Calculate average time
    stats.avgTimeMs = stats.totalTimeMs / stats.totalOperations;

    // Print statistics
    console.log("\n=== Multi-Wallet Swap Load Test Statistics ===");
    console.log(`Total operations: ${stats.totalOperations}`);
    console.log(`Successful operations: ${stats.successfulOperations}`);
    console.log(`Failed operations: ${stats.failedOperations}`);
    console.log(`Success rate: ${((stats.successfulOperations / stats.totalOperations) * 100).toFixed(2)}%`);
    console.log(`Total test time: ${totalTestTimeMs}ms`);
    console.log(`Average operation time: ${stats.avgTimeMs.toFixed(2)}ms`);
    console.log(`Minimum operation time: ${stats.minTimeMs}ms`);
    console.log(`Maximum operation time: ${stats.maxTimeMs}ms`);
    console.log(`Operations per second: ${((stats.totalOperations / totalTestTimeMs) * 1000).toFixed(2)}`);
    console.log(`Wallets used: ${wallets.length}`);

    if (stats.failedOperations > 0) {
        console.log("\nErrors:");
        stats.errors.forEach((error, index) => {
            console.log(`Error ${index + 1}: ${error.message}`);
        });
    }

    return stats;
};

/**
 * Performs a sequence of operations for rune creation and transfer using multiple wallets:
 * 1. Creates 20 wallets
 * 2. Transfers 0.1 BTC from configTo to each wallet
 * 3. Creates an etchRune for one wallet and edicts for the others
 * 4. Performs swap operations concurrently using all wallets
 *
 * @returns {Promise<void>} A promise that resolves when all operations are complete
 */
const runeCombinedOperations = async () => {
    try {
        // Connect config
        // await connect(configTo, {purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment], network: regtest});
        await connect(configFrom, {purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment], network: regtest});

        console.log("Connected to configTo and configFrom");

        // Step 1: Create 20 wallets
        const numberOfWallets = 20;
        console.log(`Creating ${numberOfWallets} wallets...`);
        const wallets = await createMultipleWallets(numberOfWallets);
        console.log(`Created ${wallets.length} wallets successfully`);

        // Step 2: Transfer BTC from configTo to each wallet, with more to the first wallet
        console.log(`Checking and transferring BTC to each of the ${wallets.length} wallets...`);
        const regularTransferAmount = 10000000; // 0.1 BTC in satoshis
        const firstWalletTransferAmount = 20000000; // 0.2 BTC in satoshis for the first wallet (more transactions)

        // Check and transfer BTC to the first wallet
        const firstWalletBalance = await getWalletBalance(wallets[0]);
        console.log(`First wallet balance: ${firstWalletBalance / 100000000} BTC`);

        if (firstWalletBalance < firstWalletTransferAmount / 2) {
            const transferAmount = firstWalletTransferAmount - firstWalletBalance;
            console.log(`First wallet balance (${firstWalletBalance / 100000000} BTC) is less than half of required amount (${firstWalletTransferAmount / 2 / 100000000} BTC)`);
            console.log(`Transferring ${transferAmount / 100000000} BTC to the first wallet with address: ${wallets[0].address}`);
            await transferBitcoinToMultipleWallets([wallets[0]], transferAmount);
        } else {
            console.log(`First wallet has sufficient balance (${firstWalletBalance / 100000000} BTC), skipping transfer`);
        }

        // Check and transfer regular amount to the remaining wallets
        if (wallets.length > 1) {
            const walletsToFund = [];
            const transferAmounts = [];

            // Check each wallet's balance
            for (let i = 1; i < wallets.length; i++) {
                const walletBalance = await getWalletBalance(wallets[i]);
                console.log(`Wallet ${i} balance: ${walletBalance / 100000000} BTC`);

                if (walletBalance < regularTransferAmount / 2) {
                    const transferAmount = regularTransferAmount - walletBalance;
                    console.log(`Wallet ${i} balance (${walletBalance / 100000000} BTC) is less than half of required amount (${regularTransferAmount / 2 / 100000000} BTC)`);
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
        const bitcoinAmount = 0.0001;
        const runeAmount = 50_000n;

        const runeResults = await createRunesAndEdictsForWallets(wallets, bitcoinAmount, runeAmount);
        console.log(`Created rune with ID ${runeResults.runeId} and asset address ${runeResults.assetAddress}`);


        // Only approve tokens and add liquidity for the first wallet and only if the rune doesn't already exist
        if (!runeResults.runeExists) {
            console.log("Rune is newly created, approving tokens and adding liquidity for the first wallet");

            // Get the first wallet result
            const firstWalletResult = runeResults.walletResults[0];

            // Get public key for the first wallet
            const pk = getPublicKey(firstWalletResult.wallet.config, firstWalletResult.wallet.publicKey);

            // Approve tokens for spending by the Uniswap router
            console.log("Approving tokens for the first wallet");
            const approvalTxHash = await approveTokens(
                runeResults.assetAddress,
                runeAmount,
                firstWalletResult.btcTx.tx.id,
                pk as `0x${string}`,
                firstWalletResult.wallet
            );

            // Add liquidity to Uniswap
            console.log("Adding liquidity for the first wallet");
            const addLiquidityTxHash = await addLiquidity(
                runeResults.assetAddress,
                runeAmount,
                bitcoinAmount,
                firstWalletResult.btcTx.tx.id,
                pk as `0x${string}`,
                firstWalletResult.wallet
            );

            await midlRegtestWalletClient.sendBTCTransactions({
                serializedTransactions: [approvalTxHash as `0x${string}`, addLiquidityTxHash as `0x${string}`],
                btcTransaction: firstWalletResult.btcTx.tx.hex,
            })
        } else {
            console.log("Rune already exists, skipping token approval and liquidity addition");
        }

        // Check rune balance for each wallet and create edicts in pairs
        if (wallets.length > 1) {
            console.log(`Checking rune balance for ${wallets.length - 1} remaining wallets`);

            // Filter wallets that need runes (balance < runeAmount/2)
            const walletsNeedingRunes = [];
            for (let i = 1; i < wallets.length; i++) {
                try {
                    const runeBalanceResponse = await getRuneBalance(wallets[i].config, {
                        address: wallets[i].address,
                        runeId: runeResults.runeId
                    });

                    const balance = BigInt(runeBalanceResponse.balance || "0");
                    console.log(`Wallet ${i} rune balance: ${balance}`);

                    if (balance < runeAmount / 2n) {
                        console.log(`Wallet ${i} needs runes (balance ${balance} < ${runeAmount / 2n})`);
                        walletsNeedingRunes.push(wallets[i]);
                    } else {
                        console.log(`Wallet ${i} has sufficient rune balance (${balance}), skipping`);
                    }
                } catch (error) {
                    console.log(`Error checking rune balance for wallet ${i}, assuming zero balance:`, error);
                    walletsNeedingRunes.push(wallets[i]);
                }
            }

            console.log(`${walletsNeedingRunes.length} wallets need runes`);

            // Process wallets in pairs
            for (let i = 0; i < walletsNeedingRunes.length; i += 2) {
                const currentBatch = walletsNeedingRunes.slice(i, i + 2);
                const receiverAddresses = currentBatch.map(wallet => wallet.address);

                if (receiverAddresses.length > 0) {
                    console.log(`Creating edict for batch ${Math.floor(i / 2) + 1} with ${receiverAddresses.length} wallets`);
                    const {tx} = await createEdictForMultipleWallets(wallets[0], runeResults.runeId, bitcoinAmount, runeAmount, receiverAddresses, true);
                    await waitForTransaction(wallets[0].config, tx.id, 1);
                }
            }
        }

        // Step 4: Perform swap operations concurrently using all wallets
        console.log("Starting multi-wallet swap operations load test");
        const bitcoinAmountSwap = 0.000001;

        // Load test parameters
        const loadTestParams = {
            iterations: 5,         // Number of swap operations to perform
            concurrency: 1,         // Number of concurrent operations (using all wallets)
            bitcoinAmount: bitcoinAmountSwap
        };

        // Run the multi-wallet load test
        await runMultiWalletSwapLoadTest(
            runeResults.assetAddress,
            bitcoinAmount,
            wallets,
            loadTestParams
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
};

// Execute the combined operations
runeCombinedOperations()
    .then(() => {
        console.log("Script completed successfully");
    })
    .catch((error) => {
        console.error("Script failed:", error);
    });
