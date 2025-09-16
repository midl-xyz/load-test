import {getUTXOs} from "@midl-xyz/midl-js-core";

export const getWalletBTCBalance = async (config: any, address: string): Promise<number> => {
    const utxos = await getUTXOs(config, address);

    if (!utxos || utxos.length === 0) {
        return 0;
    }

    // Sum up the values of all UTXOs
    return utxos.reduce((total, utxo) => total + utxo.value, 0);
};

export async function txIsUsed(txId: string): Promise<string> {
    while (true) {
        try {
            let response = await fetch(`${process.env.MEMPOOL_URL!}/api/tx/${txId}/outspend/0`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let data = await response.json();
            const {txid: nextTxId} = data;
            if (!nextTxId) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue
            }

            response = await fetch(`${process.env.MEMPOOL_URL!}/api/tx/${nextTxId}`)
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