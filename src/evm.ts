import {Address, encodeFunctionData, parseUnits} from "viem";
import {getChainId} from "viem/actions";
import {executorAbi, getEVMAddress, runeIdToBytes32, signTransaction} from "@midl-xyz/midl-js-executor";
import {configTo, midlRegtestClient, midlRegtestWalletClient, uniswapRouterAddress, WETH} from "./config";
import {uniswapV2Router02Abi} from "@/abi";
import {getNonce, WalletInfo} from "./utils";

/**
 * Gets the asset address for a given rune ID
 * @param runeId - The rune ID to look up
 * @returns Promise<string> - The asset address corresponding to the rune ID
 */
export const getAssetAddressByRuneId = async (runeId: string): Promise<string> => {
    // Convert the rune ID to bytes32 format
    const bytes32RuneId = runeIdToBytes32(runeId);

    // Contract address
    const contractAddress = '0x3B335fD04C51e3f5b55c881b9B45e4052Fa120eB';

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
 * Approves tokens for spending by the Uniswap router
 * @param assetAddress - The address of the token to approve
 * @param runeAmount - The amount of tokens to approve
 * @param btcTxHash - The Bitcoin transaction hash
 * @param publicKey - The public key
 * @param wallet - The wallet information
 * @returns Promise<string> - The transaction hash
 */
export const approveTokens = async (
    assetAddress: string,
    runeAmount: bigint,
    btcTxHash: string,
    publicKey: string,
    wallet: WalletInfo
): Promise<string> => {
    const chainId = await getChainId(midlRegtestWalletClient);
    const nonce = await getNonce(wallet);

    return await signTransaction(
        wallet.config,
        {
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
                args: [uniswapRouterAddress, runeAmount],
            }),
            btcTxHash: `0x${btcTxHash}`,
            publicKey: publicKey as `0x${string}`,
            gas: 50_000n,
            gasPrice: 1000n,
            chainId: chainId,
            nonce: nonce,
        },
        midlRegtestWalletClient,
    );
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
    btcTxHash: string,
    publicKey: string,
    wallet: WalletInfo
): Promise<string> => {
    const chainId = await getChainId(midlRegtestWalletClient);
    const nonce = await getNonce(wallet);
    const evmAddress = getEVMAddress(publicKey as `0x${string}`);

    return await signTransaction(
        wallet.config,
        {
            to: uniswapRouterAddress,
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
            }),
            btcTxHash: `0x${btcTxHash}`,
            publicKey: publicKey as `0x${string}`,
            chainId,
            gas: 2_500_000n,
            gasPrice: 1000n,
            nonce: nonce,
            value: parseUnits(bitcoinAmount.toString(), 18),
        },
        midlRegtestWalletClient
    );
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
    btcTxHash: string,
    publicKey: string,
    wallet: WalletInfo
): Promise<string> => {
    const chainId = await getChainId(midlRegtestWalletClient);
    const evmAddress = getEVMAddress(publicKey as `0x${string}`);
    const nonce = await getNonce(wallet);

    const swapTx = await signTransaction(
        wallet.config,
        {
            to: uniswapRouterAddress,
            data: encodeFunctionData({
                abi: uniswapV2Router02Abi,
                functionName: "swapExactETHForTokens",
                args: [
                    0n,
                    [WETH, assetAddress as Address],
                    evmAddress,
                    BigInt(
                        Number.parseInt(
                            ((new Date().getTime() + 1000 * 60 * 15) / 1000).toString(),
                        ),
                    ),
                ],
            }),
            btcTxHash: `0x${btcTxHash}`,
            publicKey: publicKey as `0x${string}`,
            chainId,
            gas: 500_000n,
            gasPrice: 1000n,
            nonce: nonce,
            value: parseUnits(bitcoinAmount.toString(), 18),
        },
        midlRegtestWalletClient,
    );

    console.log("Tx id swap:", swapTx);

    return swapTx;
};
