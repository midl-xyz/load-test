import {connect, getDefaultAccount, getRuneBalance, waitForTransaction} from "@midl-xyz/midl-js-core";
import {
    convertBTCtoETH,
    finalizeBTCTransaction,
    getEVMAddress,
    signIntention,
    TransactionIntention
} from "@midl-xyz/midl-js-executor";
import {
    AddressPurpose,
    configFrom,
    midlRegtestWalletClient,
    multisigAddress,
    regtest,
    uniswapRouterAddress
} from "@/config";
import {getWalletBalance, transferBitcoinToMultipleWallets} from "@/bitcoin";
import {createEdictForWallet, createRunesAndEdictsForWallets, distributeRunesToWallets} from "@/runes";
import {addLiquidity, approveTokens, completeTx, swapETHForTokens} from "@/evm";
import {createMultipleWallets, waitRuneAddress, WalletInfo} from "@/utils";
import path from "path";
import * as fs from "node:fs";
import {encodeAbiParameters, keccak256, toHex} from "viem";

const PAYLOAD_FILE_PATH = path.join(__dirname, 'payloads.json');

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
 * @returns The prepared transactions
 */
const prepareTransactionsForWallet = async (
    wallet: WalletInfo,
    assetAddress: string,
    bitcoinAmount: number,
    runeId: string,
): Promise<{ txs: `0x07${string}`[], txHex: string, txId: string }> => {
    const txs: TransactionIntention[] = []

    for (let i = 0; i < 4; i++) {
        const swapTx = await swapETHForTokens(
            assetAddress,
            bitcoinAmount,
            wallet,
        );
        txs.push(swapTx)
    }

    const cTx = await completeTx(
        assetAddress,
        wallet,
    )
    txs.push(cTx)


    const transferBTCResp = await finalizeBTCTransaction(wallet.config, txs, midlRegtestWalletClient, {
        stateOverride: [{
            address: getEVMAddress(wallet.config, getDefaultAccount((wallet.config))),
            balance: txs.reduce((acc, it) => acc + (convertBTCtoETH(it.satoshis ?? 0)), 0n),
        }]
    })
    const midlTxs: `0x07${string}`[] = []
    for (const tx of txs) {
        const midlTx = await signIntention(wallet.config, midlRegtestWalletClient, tx, txs, {txId: transferBTCResp.tx.id})
        midlTxs.push(midlTx)
    }

    return {
        txs: midlTxs,
        txHex: transferBTCResp.tx.hex,
        txId: transferBTCResp.tx.id,
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
): Promise<void> => {
    const operations = [];

    let batch = 0
    let transactionPromises = []
    for (const [i, wallet] of wallets.entries()) {
        if (batch >= 20) {
            const resolvedBatch = await Promise.all(transactionPromises)
            operations.push(...resolvedBatch)
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
        operations.push(...resolvedBatch)
    }

    const jsonRpcPayloads = []
    for (const [i, operation] of operations.entries()) {
        const jsonRpcPayload = {
            jsonrpc: "2.0",
            method: "eth_sendBTCTransactions",
            params: [
                operation.preparedTransactions.txs,
                operation.preparedTransactions.txHex,
            ],
            id: i + 1
        };
        jsonRpcPayloads.push(jsonRpcPayload);
    }

    const jsonData = JSON.stringify(jsonRpcPayloads, null, 2);
    fs.writeFile(PAYLOAD_FILE_PATH, jsonData, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Successful store data to file');
        }
    })

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
            privateKey: "",
            account: accounts[0],
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
                const batchSize = 100;
                for (let i = 0; i < walletsToFund.length; i += batchSize) {
                    const batch = walletsToFund.slice(i, i + batchSize);
                    const btcAmounts = transferAmounts.slice(i, i + batchSize);
                    await transferBitcoinToMultipleWallets(batch, btcAmounts);
                }
            } else {
                console.log(`All wallets have sufficient balance, no transfers needed`);
            }
        }

        console.log(`Successfully transferred Bitcoin to all ${wallets.length} wallets`);

        // Step 3: Create an etchRune for one wallet and edicts for the others
        console.log("Creating runes and edicts for wallets...");
        const btcPool = 100000000;
        const runePool = 50_000_000n;

        const runeResults = await createRunesAndEdictsForWallets(wallets);
        console.log(`Created rune with ID ${runeResults.runeId} and asset address ${runeResults.assetAddress}`);


        // Only approve tokens and add liquidity for the first wallet and only if the rune doesn't already exist
        if (!runeResults.runeExists) {
            console.log("Broadcast btc tx to multisig address and waiting erc20 creation");
            const runeAmount = 50_000n;
            await createEdictForWallet(wallets[0], runeResults.runeId, 0.0001, runeAmount, multisigAddress, true);
            const runeAddress = await waitRuneAddress(runeResults.runeId);
            runeResults.assetAddress = runeAddress;
            console.log(`Erc20 created, address: ${runeAddress}`);
            console.log("Rune is newly created, approving tokens and adding liquidity for the first wallet");

            // Approve tokens for spending by the Uniswap router
            const approvalTxHash = await approveTokens(
                runeResults.assetAddress,
                uniswapRouterAddress,
                runePool,
                wallets[0]
            );

            // Add liquidity to Uniswap
            console.log("Adding liquidity for the first wallet");
            const addLiquidityTxHash = await addLiquidity(
                runeResults.assetAddress,
                runePool,
                btcPool,
                wallets[0],
                runeResults.runeId,
            );

            const intentions = [approvalTxHash, addLiquidityTxHash];
            const evmAddress = getEVMAddress(wallets[0].config, getDefaultAccount((wallets[0].config)));

            const slot = keccak256(
                encodeAbiParameters(
                    [
                        {
                            type: 'address',
                        },
                        {type: 'uint256'},
                    ],
                    [evmAddress, 0n],
                ),
            );

            const transferBtcResp = await finalizeBTCTransaction(wallets[0].config, intentions, midlRegtestWalletClient, {
                stateOverride: [{
                    address: evmAddress,
                    balance: intentions.reduce((acc, it) => acc + (convertBTCtoETH(it.satoshis ?? 0) ?? 0n), 0n)
                }, {
                    address: runeResults.assetAddress as `0x${string}`,
                    stateDiff: [{
                        slot,
                        value: toHex(50_000_000n, {size: 32})
                    }]

                }]
            })

            const signedTxs: `0x07${string}`[] = [];

            for (const intention of intentions) {
                const signedTx = await signIntention(wallets[0].config, midlRegtestWalletClient, intention, intentions, {
                    txId: transferBtcResp.tx.id
                })

                signedTxs.push(signedTx);
            }

            const txs = await midlRegtestWalletClient.sendBTCTransactions({
                serializedTransactions: signedTxs,
                btcTransaction: transferBtcResp.tx.hex,
            })
            console.log("Approve and addLiquidityTx sent: ", txs);
            await waitForTransaction(wallets[0].config, transferBtcResp.tx.id, 1);
        } else {
            console.log("Rune already exists, skipping token approval and liquidity addition");
        }

        // Check rune balance for each wallet and create edicts in pairs
        if (wallets.length > 1) {
            console.log(`Checking rune balance for ${wallets.length - 1} remaining wallets`);

            // Filter wallets that need runes (balance < runeAmount/2)
            const walletsNeedingRunes = [];
            const walletsWithRunes = [];
            for (let i = 0; i < wallets.length; i++) {
                try {
                    const runeBalanceResponse = await getRuneBalance(wallets[i].config, {
                        address: wallets[i].address,
                        runeId: runeResults.runeId
                    });
                    const balance = BigInt(runeBalanceResponse.balance || "0");
                    console.log(`Wallet ${i} rune balance: ${balance}`);
                    walletsWithRunes.push(wallets[i]);
                } catch (error) {
                    console.log(`Error checking rune balance for wallet ${i}, wallet need runes`);
                    walletsNeedingRunes.push(wallets[i]);
                }
            }

            console.log(`${walletsNeedingRunes.length} wallets need runes`);

            if (walletsNeedingRunes.length > 0) {
                await distributeRunesToWallets(walletsWithRunes, runeResults.runeId, walletsNeedingRunes)
            }
        }

        // Step 4: Perform swap operations concurrently using all wallets
        console.log("Starting multi-wallet swap operations load test");
        // Run the multi-wallet load test
        await runMultiWalletSwapLoadTest(
            runeResults.assetAddress,
            10000,
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
