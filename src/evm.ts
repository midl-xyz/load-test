import {Address, encodeFunctionData} from "viem";
import {
    addCompleteTxIntention,
    addTxIntention,
    convertBTCtoETH,
    getEVMAddress,
    runeIdToBytes32,
    TransactionIntention
} from "@midl-xyz/midl-js-executor";
import {midlRegtestClient, uniswapRouterAddress, WETH} from "./config";
import {executorAbi, uniswapV2Router02Abi} from "@/abi";
import {WalletInfo} from "./utils";


/**
 * Gets the asset address for a given rune ID
 * @param runeId - The rune ID to look up
 * @returns Promise<string> - The asset address corresponding to the rune ID
 */
export const getAssetAddressByRuneId = async (runeId: string): Promise<string> => {
    // Convert the rune ID to bytes32 format
    const bytes32RuneId = runeIdToBytes32(runeId);

    // Contract address
    const contractAddress = '0xEbF0Ece9A6cbDfd334Ce71f09fF450cd06D57753';

    // Call the contract function
    const assetAddress = await midlRegtestClient.readContract({
        address: contractAddress,
        abi: executorAbi,
        functionName: 'getAssetAddressByRuneId',
        args: [bytes32RuneId],
    });

    return assetAddress as string;
};

/**
 * Approves tokens for spending by target
 * @param assetAddress - The address of the token to approve
 * @param targetAddress
 * @param runeAmount - The amount of tokens to approve
 * @param btcTxHash - The Bitcoin transaction hash
 * @param publicKey - The public key
 * @param wallet - The wallet information
 * @returns Promise<string> - The transaction hash
 */
export const approveTokens = async (
    assetAddress: string,
    targetAddress: `0x${string}`,
    runeAmount: bigint,
    wallet: WalletInfo
): Promise<TransactionIntention> => {
    return await addTxIntention(wallet.config, {
        evmTransaction: {
            to: assetAddress as `0x${string}`,
            data: encodeFunctionData({
                abi: [
                    {
                        type: "function",
                        name: "approve",
                        inputs: [
                            {name: "spender", type: "address"},
                            {name: "amount", type: "uint256"}
                        ],
                        outputs: [{name: "", type: "bool"}],
                        stateMutability: "nonpayable"
                    }
                ],
                functionName: "approve",
                args: [targetAddress, runeAmount],
            }),
        }
    })
};

/**
 * Adds liquidity to Uniswap
 * @param assetAddress - The address of the token
 * @param runeAmount - The amount of tokens to add
 * @param bitcoinAmount - The amount of Bitcoin to add
 * @param btcTxHash - The Bitcoin transaction hash
 * @param publicKey - The public key
 * @param wallet - The wallet information
 * @returns Promise<string> - The transaction hash
 */
export const addLiquidity = async (
    assetAddress: string,
    runeAmount: bigint,
    bitcoinAmount: number,
    wallet: WalletInfo,
    runeId: string,
): Promise<TransactionIntention> => {

    const evmAddress = getEVMAddress(wallet.config, wallet.account);

    return addTxIntention(wallet.config, {
        hasRunesDeposit: true,
        rune: {
            id: runeId,
            value: runeAmount,
        },
        satoshis: bitcoinAmount,
        evmTransaction: {
            to: uniswapRouterAddress,
            value: convertBTCtoETH(bitcoinAmount),

            data: encodeFunctionData({
                abi: uniswapV2Router02Abi,
                functionName: "addLiquidityETH",
                args: [
                    assetAddress as `0x${string}`,
                    runeAmount,
                    0n,
                    0n,
                    evmAddress,
                    BigInt(
                        Number.parseInt(
                            ((new Date().getTime() + 1000 * 60 * 15) / 1000).toString(),
                        ),
                    ),
                ],
            })
        }
    });


};

/**
 * Swaps ETH for tokens
 * @param assetAddress - The address of the token to receive
 * @param bitcoinAmount - The amount of Bitcoin to swap
 * @param btcTxHash - The Bitcoin transaction hash
 * @param publicKey - The public key
 * @param wallet - The wallet information
 * @returns Promise<string> - The transaction hash
 */
export const swapETHForTokens = async (
    assetAddress: string,
    bitcoinAmount: number,
    wallet: WalletInfo
): Promise<TransactionIntention> => {
    const evmAddress = getEVMAddress(wallet.config, wallet.account);

    return await addTxIntention(
        wallet.config,
        {
            satoshis: bitcoinAmount,
            evmTransaction: {
                to: uniswapRouterAddress,
                value: convertBTCtoETH(bitcoinAmount / 5),
                data: encodeFunctionData({
                    abi: uniswapV2Router02Abi,
                    functionName: "swapExactETHForTokens",
                    args: [
                        0n,
                        [WETH, assetAddress as Address],
                        evmAddress,
                        BigInt(
                            Number.parseInt(
                                ((new Date().getTime() + 1000 * 60 * 120) / 1000).toString(),
                            ),
                        ),
                    ],

                }),
            },
        },
    )
};

/**
 * Completes a transaction on the executor contract
 * @param assetAddress - The address of the asset
 * @param btcTxHash - The Bitcoin transaction hash
 * @param publicKey - The public key
 * @param wallet - The wallet information
 * @returns Promise<string> - The transaction hash
 */
export const completeTx = async (
    assetAddress: string,
    wallet: WalletInfo): Promise<TransactionIntention> => {
    return await addCompleteTxIntention(
        wallet.config,
        [assetAddress as Address],
    )
}
