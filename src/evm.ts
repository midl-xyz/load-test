import {Address, encodeFunctionData} from "viem";
import {
    addCompleteTxIntention,
    addTxIntention,
    runeIdToBytes32,
    satoshisToWei,
    TransactionIntention,
    Withdrawal,
} from "@midl-xyz/midl-js-executor";
import {executorAddress, midlRegtestClient, uniswapFactoryAddress, uniswapRouterAddress, WETH} from "./config";
import {executorAbi, uniswapV2Router02Abi} from "@/abi";
import {WalletInfo} from "./utils";
import {abi as IUniswapV2Factory} from '@uniswap/v2-core/build/IUniswapV2Factory.json';


/**
 * Gets the asset address for a given rune ID
 * @param runeId - The rune ID to look up
 * @returns Promise<string> - The asset address corresponding to the rune ID
 */
export const getAssetAddressByRuneId = async (runeId: string): Promise<string> => {
    // Convert the rune ID to bytes32 format
    const bytes32RuneId = runeIdToBytes32(runeId);
    // Call the contract function
    const assetAddress = await midlRegtestClient.readContract({
        address: executorAddress,
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

export const addLiquidity = async (
    assetAddress: string,
    runeAmount: bigint,
    bitcoinAmount: number,
    wallet: WalletInfo,
    runeId: string,
): Promise<TransactionIntention> => {
    return addTxIntention(wallet.config, {
        evmTransaction: {
            to: uniswapRouterAddress,
            value: satoshisToWei(bitcoinAmount),
            data: encodeFunctionData({
                abi: uniswapV2Router02Abi,
                functionName: "addLiquidityETH",
                args: [
                    assetAddress as `0x${string}`,
                    runeAmount,
                    0n,
                    0n,
                    wallet.evmAddress,
                    BigInt(
                        Number.parseInt(
                            ((new Date().getTime() + 1000 * 60 * 15) / 1000).toString(),
                        ),
                    ),
                ],
            })
        },
        deposit: {
            satoshis: bitcoinAmount,
            runes: [
                {
                    id: runeId,
                    amount: runeAmount,
                    address: assetAddress as `0x${string}`,
                }
            ]
        }
    });
};


export const addLiquidityTokenToToken = async (
    tokenA: Address,
    tokenB: Address,
    amountA: bigint,
    amountB: bigint,
    wallet: WalletInfo,
    runeIdA: string,
    runeIdB: string,
): Promise<TransactionIntention> => {
    return addTxIntention(wallet.config, {
        evmTransaction: {
            to: uniswapRouterAddress,
            value: 0n, // Не отправляем ETH для токен-токен пула
            data: encodeFunctionData({
                abi: uniswapV2Router02Abi,
                functionName: "addLiquidity",
                args: [
                    tokenA,
                    tokenB,
                    amountA,
                    amountB,
                    0n,
                    0n,
                    wallet.evmAddress,
                    BigInt(
                        Number.parseInt(
                            ((new Date().getTime() + 1000 * 60 * 15) / 1000).toString(),
                        ),
                    ),
                ],
            })
        },
        deposit: {
            runes: [
                {
                    id: runeIdA,
                    amount: amountA,
                    address: tokenA,
                },
                {
                    id: runeIdB,
                    amount: amountB,
                    address: tokenB,
                }
            ]
        }
    });
};

export const completeTx = async (
    wallet: WalletInfo,
    withdrawal?: Withdrawal,
): Promise<TransactionIntention> => {
    return await addCompleteTxIntention(
        wallet.config,
        withdrawal
    )
}

export async function transferRuneToMIDL(
    wallet: WalletInfo,
    runeAmount: bigint,
    runeId: string,
    runeAddress: `0x${string}`
): Promise<TransactionIntention> {
    const randomAddress = ("0x" + (await import("crypto")).randomBytes(20).toString("hex")) as `0x${string}`;
    return await addTxIntention(
        wallet.config,
        {
            evmTransaction: {
                to: randomAddress,
                value: 0n,
                gas: 21000n
            },
            deposit: {
                runes: [
                    {
                        id: runeId,
                        amount: runeAmount,
                        address: runeAddress
                    }
                ]
            }
        },
    )
}

export const getERC20Balance = async (
    tokenAddress: string,
    holderAddress: string
): Promise<bigint> => {
    const balance = await midlRegtestClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
            {
                type: "function",
                name: "balanceOf",
                inputs: [{name: "account", type: "address"}],
                outputs: [{name: "", type: "uint256"}],
                stateMutability: "view"
            }
        ],
        functionName: 'balanceOf',
        args: [holderAddress as `0x${string}`],
    });
    return balance as bigint;
};


export const getPair = async (tokenA: string, tokenB: string): Promise<string> => {
    const pairAddress = await midlRegtestClient.readContract({
        address: uniswapFactoryAddress, // Uniswap V2 Factory
        abi: IUniswapV2Factory,
        functionName: 'getPair',
        args: [tokenA, tokenB],
    });

    return pairAddress as string;
};

export const swapBTCForTokens = async (
    wallet: WalletInfo,
    assetAddress: string,
    bitcoinAmount: number
): Promise<TransactionIntention> => {
    return await addTxIntention(
        wallet.config,
        {
            evmTransaction: {
                to: uniswapRouterAddress,
                value: satoshisToWei(bitcoinAmount),
                data: encodeFunctionData({
                    abi: uniswapV2Router02Abi,
                    functionName: "swapExactETHForTokens",
                    args: [
                        0n,
                        [WETH, assetAddress as Address],
                        wallet.evmAddress,
                        BigInt(
                            Number.parseInt(
                                ((new Date().getTime() + 1000 * 60 * 120) / 1000).toString(),
                            ),
                        ),
                    ],
                }),
            },
            deposit: {
                satoshis: bitcoinAmount,
            }
        },
    )
};

export const swapTokensForBTC = async (
    wallet: WalletInfo,
    assetAddress: string,
    tokenAmount: bigint,
    runeId: string,
): Promise<TransactionIntention> => {
    return await addTxIntention(
        wallet.config,
        {
            evmTransaction: {
                to: uniswapRouterAddress,
                value: 0n,
                data: encodeFunctionData({
                    abi: uniswapV2Router02Abi,
                    functionName: "swapExactTokensForETH",
                    args: [
                        tokenAmount,
                        0n,
                        [assetAddress as Address, WETH],
                        wallet.evmAddress,
                        BigInt(
                            Number.parseInt(
                                ((new Date().getTime() + 1000 * 60 * 120) / 1000).toString(),
                            ),
                        ),
                    ],
                }),
            },
            deposit: {
                runes: [
                    {
                        id: runeId,
                        amount: tokenAmount,
                        address: assetAddress as Address,
                    }
                ]
            }
        },
    )
};

export const swapTokenAForTokenB = async (
    tokenA: string,
    tokenB: string,
    tokenAmount: bigint,
    wallet: WalletInfo,
    runeIdA: string,
): Promise<TransactionIntention> => {
    return await addTxIntention(
        wallet.config,
        {
            evmTransaction: {
                to: uniswapRouterAddress,
                value: 0n,
                data: encodeFunctionData({
                    abi: uniswapV2Router02Abi,
                    functionName: "swapExactTokensForTokens",
                    args: [
                        tokenAmount,
                        0n,
                        [tokenA as Address, tokenB as Address],
                        wallet.evmAddress,
                        BigInt(
                            Number.parseInt(
                                ((new Date().getTime() + 1000 * 60 * 120) / 1000).toString(),
                            ),
                        ),
                    ],
                }),
            },
            deposit: {
                runes: [
                    {
                        id: runeIdA,
                        amount: tokenAmount,
                        address: tokenA as `0x${string}`,
                    }
                ]
            }
        },
    )
};


export const calculateTokensOut = async (
    tokenAddresses: Address[],
    amount: bigint
): Promise<bigint> => {
    try {
        const amounts = await midlRegtestClient.readContract({
            address: uniswapRouterAddress,
            abi: uniswapV2Router02Abi,
            functionName: 'getAmountsOut',
            args: [
                amount,
                tokenAddresses
            ],
        });
        return (amounts as bigint[])[1];
    } catch (error) {
        console.error('Error calculating tokens out:', error);
        throw error;
    }
};
