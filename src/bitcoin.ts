import {getUTXOs} from "@midl/core";

export const getWalletBTCBalance = async (config: any, address: string): Promise<number> => {
    const utxos = await getUTXOs(config, address);

    if (!utxos || utxos.length === 0) {
        return 0;
    }

    // Sum up the values of all UTXOs
    return utxos.reduce((total, utxo) => total + utxo.value, 0);
};

export async function txIsUsed(txId: string, timeoutMs: number = 300000): Promise<string> {
    const mempoolUrl = process.env.MEMPOOL_URL;
    if (!mempoolUrl) {
        throw new Error('Missing mempool URL');
    }
    const startTime = new Date().getTime();
    while (true) {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error(`Timeout exceeded: transaction ${txId} was not used within ${timeoutMs}ms`);
        }
        try {
            let response = await fetch(
                `${mempoolUrl}/api/tx/${txId}/outspend/0`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            )
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let data = await response.json();
            const {txid: nextTxId} = data;
            if (!nextTxId) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue
            }

            response = await fetch(
                `${mempoolUrl}/api/tx/${nextTxId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            )
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
            const {status} = data
            if (!status) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue
            }
            const {confirmed} = status
            if (confirmed) {
                return nextTxId
            }
        } catch (error) {
            console.error('Error check tx used status:', error);
            throw error;
        }
    }
}

interface TxStatusResponse {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
}

export async function getRuneId(txId: string): Promise<string> {
    try {
        const mempoolUrl = process.env.MEMPOOL_URL;
        if (!process.env.MEMPOOL_URL) {
            throw new Error('Missing mempool URL');
        }
        const response = await fetch(
            `${mempoolUrl}/api/tx/${txId}/status`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: TxStatusResponse = await response.json();

        const blockResponse = await fetch(
            `${mempoolUrl}/api/block/${data.block_hash}/txs`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        const blockTxs = await blockResponse.json();
        const txIndex = blockTxs.findIndex((tx: any) => tx.txid === txId);
        return `${data.block_height}:${txIndex}`;
    } catch (error) {
        console.error('Error check tx used status:', error);
        throw error;
    }
}