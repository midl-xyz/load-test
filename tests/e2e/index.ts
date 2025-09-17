import {address, networks} from "bitcoinjs-lib";
import {
    AddressPurpose,
    connect,
    createConfig,
    getRuneBalance,
    getUTXOs,
    RuneBalanceResponse
} from "@midl-xyz/midl-js-core";
import {keyPairConnector} from "@midl-xyz/midl-js-node";
import {bitcoinNetwork, mempoolProvider, midlRegtestClient, runesProvider, uniswapRouterAddress, WETH} from "@/config";
import {getWalletBTCBalance, txIsUsed} from "@/bitcoin";
import {
    executeBTCTransactionWithIntentions,
    generateRandomString,
    getRandomSwapValues,
    isWithinTolerance,
    waitRuneAddress,
    WalletInfo
} from "@/utils";
import {createRuneForWallet} from "@/runes";
import {
    addLiquidity,
    addLiquidityTokenToToken,
    approveTokens,
    calculateTokensOut,
    completeTx,
    getAssetAddressByRuneId,
    getERC20Balance,
    getPair,
    getReserves,
    swapBTCForTokens,
    swapTokenAForTokenB,
    swapTokensForBTC,
    transferRuneToMIDL
} from "@/evm";
import {
    getEVMAddress,
    RUNES_MAGIC_VALUE,
    satoshisToWei,
    TransactionIntention,
    weiToSatoshis
} from "@midl-xyz/midl-js-executor";
import {zeroAddress} from "viem";
import {setupTestWallets} from "./wallet";


export async function runE2ETests() {
    console.log('Running E2E Tests');

    const mnemonic = process.env.MNEMOMIC;
    if (!mnemonic) {
        throw new Error("Mnemonic for base wallet is missing");
    }

    const connectionConfig = createConfig(
        {
            networks: [bitcoinNetwork],
            connectors: [
                keyPairConnector(
                    {
                        mnemonic: mnemonic
                    }
                )
            ],
            provider: mempoolProvider,
            persist: false,
            runesProvider: runesProvider,
        }
    )

    const accounts = await connect(connectionConfig, {
        purposes: [AddressPurpose.Ordinals],
        network: bitcoinNetwork,
    })

    if (!accounts || accounts.length === 0) {
        throw new Error("Accounts not found");
    }

    const baseWallet: WalletInfo = {
        address: accounts[0].address,
        config: connectionConfig,
        publicKey: "",
        accounts: accounts,
        evmAddress: getEVMAddress(accounts[0], bitcoinNetwork),
    }

    const walletBalance = await getWalletBTCBalance(connectionConfig, accounts[0].address)
    console.log(`Base wallet balance is ${walletBalance}`);
    if (walletBalance < 1e8) {
        throw new Error("Base wallet balance is lower than 1 BTC");
    }

    console.log("Check runes and tokens")
    const assetA = await getAsset(baseWallet, process.env.RUNE_A_ID, process.env.TOKEN_A_ERC20);
    const tokenA = assetA.tokenAddress
    const runeAId = assetA.runeId
    const assetB = await getAsset(baseWallet, process.env.RUNE_B_ID, process.env.TOKEN_B_ERC20);
    const tokenB = assetB.tokenAddress
    const runeBId = assetB.runeId


    console.log("Check liquidity tokenA -> BTC")
    let pairAddress = await getPair(tokenA, WETH)
    if (!pairAddress || pairAddress === zeroAddress) {
        console.log("Pool is not created, try to create pool tokenA -> BTC");
        await createBTCPool(baseWallet, {
            tokenAddress: tokenA,
            satoshiAmount: 1000000,
            tokensForSatoshi: 2n,
            runeId: runeAId
        })
        pairAddress = await getPair(tokenA, WETH)
        console.log("TokenA -> BTC pool is created with address: ", pairAddress);
    }
    const reserves = await getReserves(pairAddress)
    console.log("Reserves for tokenA -> BTC", reserves)

    console.log("Check liquidity tokenA -> tokenB")
    let tokenToTokenPair = await getPair(tokenA, tokenB)
    if (!tokenToTokenPair || tokenToTokenPair === zeroAddress) {
        console.log("Pool is not created, try to create pool tokenA -> tokenB");
        await createTokensPool(baseWallet, {
            tokenAAddress: tokenA as `0x${string}`,
            tokenBAddress: tokenB as `0x${string}`,
            tokenAAmount: 10000n,
            tokenBAmount: 10000n,
            runeAId: runeAId,
            runeBId: runeBId,
        })
        tokenToTokenPair = await getPair(tokenA, tokenB)
        console.log("TokenA -> TokenB pool is created with address: ", tokenToTokenPair);
    }
    const tokenToTokenReserves = await getReserves(tokenToTokenPair)
    console.log("Reserves for tokenA -> tokenB", tokenToTokenReserves)

    const randomValues = await getRandomSwapValues(reserves, tokenToTokenReserves, tokenA)
    console.log("Random swap values", randomValues)

    console.log("Setup test wallets")
    const testWallets = await setupTestWallets(baseWallet, runeAId, randomValues)

    console.log("Create swap BTC -> tokenA")
    for (const [i, testWallet] of testWallets.entries()) {
        await swapBTCToTokens(testWallet, {tokenAddress: tokenA, btcAmount: randomValues[i].BTCTokenA, runeId: runeAId})
    }

    console.log("Create swap tokenA -> BTC")
    for (const [i, testWallet] of testWallets.entries()) {
        await swapTokensToBTC(testWallet, {
            tokenAddress: tokenA,
            tokensAmount: randomValues[i].TokenABTC,
            runeId: runeAId
        })
    }

    console.log("Create swap tokenA -> tokenB")
    for (const [i, testWallet] of testWallets.entries()) {
        await swapTokensToTokens(testWallet, {
            tokenAAddress: tokenA as `0x${string}`,
            tokenBAddress: tokenB as `0x${string}`,
            tokenAAmount: randomValues[i].TokenATokenB,
            runeAId: runeAId,
            runeBId: runeBId,
        })
    }
}

async function getAsset(wallet: WalletInfo, runeId?: string, tokenAddress?: string): Promise<{
    runeId: string,
    tokenAddress: string
}> {
    if (!runeId) {
        const runeName = "END•TO•END•RUNE•" + generateRandomString(4)
        runeId = await createRuneForWallet(wallet, runeName, Number.MAX_SAFE_INTEGER)
    } else {
        try {
            const res = await getRuneBalance(wallet.config, {address: wallet.address, runeId: runeId});
            console.log("Rune exist: ", res);
        } catch (error) {
            throw new Error(`Error getting rune ${runeId}: ${error}`);
        }
    }

    if (!tokenAddress) {
        console.log(`Token address is undefined, create intention to add rune to MIDL`);
        const intentions: TransactionIntention[] = [await transferRuneToMIDL(wallet, 1n, runeId, `0x`)]
        await executeBTCTransactionWithIntentions(wallet, intentions, true)
        tokenAddress = await waitRuneAddress(runeId)
        console.log(`Successful add rune to MIDL, new address for runeId ${runeId} is ${tokenAddress}`);
    } else {
        console.log(`Try to get token address for ${runeId}`);
        const assetAddress = await getAssetAddressByRuneId(runeId)
        if (assetAddress !== tokenAddress) {
            throw new Error(`Error getting token address for ${runeId}, received ${assetAddress}, your ${tokenAddress}`);
        }
    }

    return {runeId: runeId, tokenAddress: tokenAddress}
}

async function createBTCPool(wallet: WalletInfo, poolDescription: {
    tokenAddress: string,
    satoshiAmount: number,
    tokensForSatoshi: bigint,
    runeId: string,
}): Promise<void> {
    const tokenAmount = BigInt(poolDescription.satoshiAmount) * poolDescription.tokensForSatoshi
    const approvalTxHash = await approveTokens(
        poolDescription.tokenAddress,
        uniswapRouterAddress,
        tokenAmount,
        wallet,
    );

    const addLiquidityTxHash = await addLiquidity(
        poolDescription.tokenAddress,
        tokenAmount,
        poolDescription.satoshiAmount,
        wallet,
        poolDescription.runeId,
    );

    const intentions = [approvalTxHash, addLiquidityTxHash];
    await executeBTCTransactionWithIntentions(wallet, intentions)
}

async function createTokensPool(wallet: WalletInfo, poolDescription: {
    tokenAAddress: `0x${string}`,
    tokenBAddress: `0x${string}`,
    tokenAAmount: bigint,
    tokenBAmount: bigint,
    runeAId: string,
    runeBId: string,
}) {
    const approvalATxHash = await approveTokens(
        poolDescription.tokenAAddress,
        uniswapRouterAddress,
        poolDescription.tokenAAmount,
        wallet,
    );
    const approvalBTxHash = await approveTokens(
        poolDescription.tokenBAddress,
        uniswapRouterAddress,
        poolDescription.tokenBAmount,
        wallet,
    );
    const addLiquidityTx = await addLiquidityTokenToToken(
        poolDescription.tokenAAddress,
        poolDescription.tokenBAddress,
        poolDescription.tokenAAmount,
        poolDescription.tokenBAmount,
        wallet,
        poolDescription.runeAId,
        poolDescription.runeBId,
    )
    const intentions = [approvalATxHash, approvalBTxHash, addLiquidityTx];
    await executeBTCTransactionWithIntentions(wallet, intentions)
}

async function swapBTCToTokens(wallet: WalletInfo, swapBTCOptions: {
    btcAmount: number,
    tokenAddress: string,
    runeId: string
}): Promise<string> {
    const tokensBeforeSwap = await getERC20Balance(swapBTCOptions.tokenAddress, wallet.evmAddress)
    const predictedTokens = await calculateTokensOut([WETH, swapBTCOptions.tokenAddress as `0x${string}`], satoshisToWei(swapBTCOptions.btcAmount))
    const runesBeforeSwap = await getRuneBalance(wallet.config, {
        address: wallet.address,
        runeId: swapBTCOptions.runeId
    })
    console.log(`EVM ${wallet.evmAddress} asset balance before swap: `, tokensBeforeSwap)
    console.log("Runes balance before swap: ", runesBeforeSwap)
    console.log("Predicted result of swap: ", predictedTokens)

    const intentions: TransactionIntention[] = [
        await swapBTCForTokens(wallet, swapBTCOptions.tokenAddress, swapBTCOptions.btcAmount),
        await completeTx(wallet, {
            runes: [
                {
                    id: swapBTCOptions.runeId,
                    amount: predictedTokens,
                    address: swapBTCOptions.tokenAddress as `0x${string}`
                }
            ]
        })
    ];
    const res = await executeBTCTransactionWithIntentions(wallet, intentions)
    const btcResultTxHash = await txIsUsed(res.btcTxId)
    console.log("btcResultTxHash", btcResultTxHash)

    const tokensAfterSwap = await getERC20Balance(swapBTCOptions.tokenAddress, wallet.evmAddress)
    const runesAfterSwap = await getRuneBalance(wallet.config, {address: wallet.address, runeId: swapBTCOptions.runeId})
    console.log(`EVM asset balance after swap: ${tokensAfterSwap}`)
    console.log("Runes balance after swap: ", runesAfterSwap)
    console.log("Runes profit: ", runesAfterSwap.balance - runesBeforeSwap.balance)

    if (tokensAfterSwap !== tokensBeforeSwap || predictedTokens !== (runesAfterSwap.balance - runesBeforeSwap.balance)) {
        throw new Error("Incorrect amount of runes for withdrawal")
    }
    return res.btcTxId
}

async function swapTokensToBTC(wallet: WalletInfo, swapTokensOptions: {
    tokensAmount: bigint,
    tokenAddress: string,
    runeId: string
}): Promise<string> {
    const beforeEvmBalance = await midlRegtestClient.getBalance({address: wallet.evmAddress})
    const beforeBTCBalance = await getWalletBTCBalance(wallet.config, wallet.address)
    const predictedTokens = await calculateTokensOut([swapTokensOptions.tokenAddress as `0x${string}`, WETH], swapTokensOptions.tokensAmount)
    console.log(`Before evm balance: ${beforeEvmBalance} wei, ${weiToSatoshis(beforeEvmBalance)} sat `,);
    console.log(`Before btc balance: ${beforeBTCBalance}`);
    console.log(`Predicate result of swap: ${weiToSatoshis(predictedTokens)} sat`);

    const intentions: TransactionIntention[] = [
        await approveTokens(swapTokensOptions.tokenAddress, uniswapRouterAddress, swapTokensOptions.tokensAmount, wallet),
        await swapTokensForBTC(wallet, swapTokensOptions.tokenAddress, swapTokensOptions.tokensAmount, swapTokensOptions.runeId),
        await completeTx(wallet, {satoshis: 0})
    ];
    const res = await executeBTCTransactionWithIntentions(wallet, intentions)
    const btcResultTxId = await txIsUsed(res.btcTxId)
    console.log("btcResultTxId", btcResultTxId)

    const afterEvmBalance = await midlRegtestClient.getBalance({address: wallet.evmAddress})
    const afterBTCBalance = await getWalletBTCBalance(wallet.config, wallet.address)
    console.log(`After evm balance: ${afterEvmBalance} wei, ${weiToSatoshis(afterEvmBalance)} sat`);
    console.log(`After btc balance: ${afterBTCBalance}`);
    console.log(`Profit: `, afterBTCBalance - beforeBTCBalance);

    const utxos = await getUTXOs(wallet.config, wallet.address)
    const reqOutput = utxos.find(value => {
        return value.txid === btcResultTxId && value.value !== Number(RUNES_MAGIC_VALUE)
    })
    if (!reqOutput) {
        throw new Error("Incorrect amount of runes for withdrawal")
    }
    if (!isWithinTolerance(reqOutput.value, weiToSatoshis(predictedTokens), 10)) {
        throw new Error(`Values do not match the 5% tolerance. Expected: ${weiToSatoshis(predictedTokens)}, received: ${reqOutput.value}`);
    }
    return res.btcTxId
}

async function swapTokensToTokens(wallet: WalletInfo, swapTokensOptions: {
    tokenAAddress: `0x${string}`,
    tokenBAddress: `0x${string}`,
    tokenAAmount: bigint,
    runeAId: string,
    runeBId: string,
}) {
    const tokensABeforeSwap = await getERC20Balance(swapTokensOptions.tokenAAddress, wallet.evmAddress)
    console.log("TokenA balance before swap: ", tokensABeforeSwap)
    const tokensBBeforeSwap = await getERC20Balance(swapTokensOptions.tokenBAddress, wallet.evmAddress)
    console.log("TokenB balance before swap: ", tokensBBeforeSwap)
    const predictedTokens = await calculateTokensOut([swapTokensOptions.tokenAAddress, swapTokensOptions.tokenBAddress], swapTokensOptions.tokenAAmount)
    console.log("Predicate result of swap: ", predictedTokens);


    let runesBBeforeSwap: RuneBalanceResponse
    try {
        runesBBeforeSwap = await getRuneBalance(wallet.config, {
            address: wallet.address,
            runeId: swapTokensOptions.runeBId
        })
        console.log("Runes balance before swap: ", runesBBeforeSwap)
    } catch (error) {
        if (error instanceof Error && error.message.includes("Failed to fetch rune balance")) {
            console.log("Runes balance before swap: ", 0)
            runesBBeforeSwap = {balance: BigInt(0)}
        } else {
            console.error("Unexpected error fetching rune balance:", error);
            throw error;

        }
    }

    const intentions: TransactionIntention[] = [
        await approveTokens(swapTokensOptions.tokenAAddress, uniswapRouterAddress, swapTokensOptions.tokenAAmount, wallet),
        await swapTokenAForTokenB(swapTokensOptions.tokenAAddress, swapTokensOptions.tokenBAddress, swapTokensOptions.tokenAAmount, wallet, swapTokensOptions.runeAId),
        await completeTx(wallet, {
            runes: [
                {
                    id: swapTokensOptions.runeBId,
                    amount: predictedTokens,
                    address: swapTokensOptions.tokenBAddress
                }
            ]
        })
    ]
    const res = await executeBTCTransactionWithIntentions(wallet, intentions)
    const btcResultTxHash = await txIsUsed(res.btcTxId)
    console.log("btcResultTxHash", btcResultTxHash)

    const tokensAfterSwap = await getERC20Balance(swapTokensOptions.tokenAAddress, wallet.evmAddress)
    console.log("TokenA balance after swap: ", tokensAfterSwap)
    const tokensBAfterSwap = await getERC20Balance(swapTokensOptions.tokenBAddress, wallet.evmAddress)
    console.log("TokenB balance after swap: ", tokensBAfterSwap)
    const runesBAfterSwap = await getRuneBalance(wallet.config, {
        address: wallet.address,
        runeId: swapTokensOptions.runeBId
    })
    console.log("Runes balance after swap: ", runesBAfterSwap)
    console.log("Profit for tokenB: ", runesBAfterSwap.balance - runesBBeforeSwap.balance)

    if (tokensAfterSwap !== tokensABeforeSwap ||
        tokensBAfterSwap !== tokensBBeforeSwap ||
        predictedTokens !== (runesBAfterSwap.balance - runesBBeforeSwap.balance)) {
        throw new Error("Incorrect amount of runes for withdrawal")
    }
    return res.btcTxId
}


runE2ETests().then(() => {
    console.log('Tests complete');
}).catch((error) => {
    console.error('Test failed:', error);
})