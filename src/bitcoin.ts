

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

