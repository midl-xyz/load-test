import * as fs from 'fs';
import * as path from 'path';
import {bitcoinNetwork, maestroProvider, mempoolProvider} from '@/config';
import {AddressPurpose, connect, createConfig, edictRune, EdictRuneParams, waitForTransaction} from "@midl/core";
import {keyPairConnector} from "@midl/node";
import {randomSwapValue, WalletInfo} from "@/utils";
import * as bip39 from 'bip39';
import {getEVMAddress} from "@midl/executor";

interface StoredMnemonics {
    mnemonics: string[];
}

const MNEMONIC_FILE = path.join(process.cwd(), 'mnemonic.json');

function readStoredMnemonics(): string[] {
    try {
        if (!fs.existsSync(MNEMONIC_FILE)) {
            console.log('Private keys file does not exist, will create new one');
            return [];
        }

        const fileContent = fs.readFileSync(MNEMONIC_FILE, 'utf-8');
        const data: StoredMnemonics = JSON.parse(fileContent);

        console.log(`Loaded ${data.mnemonics.length} mnemonics from file`);
        return data.mnemonics;
    } catch (error) {
        console.error('Error reading mnemonic file:', error);
        return [];
    }
}

function saveMnemonics(mnemonics: string[]): void {
    try {
        const data: StoredMnemonics = {
            mnemonics: mnemonics,
        };

        fs.writeFileSync(MNEMONIC_FILE, JSON.stringify(data, null, 2));
        console.log(`Saved ${mnemonics.length} mnemonics to file`);
    } catch (error) {
        console.error('Error saving mnemonic file:', error);
        throw error;
    }
}

async function createWalletFromMnemonic(mnemonic: string): Promise<WalletInfo> {
    // Create config for the wallet
    const config = createConfig({
        networks: [bitcoinNetwork],
        connectors: [
            keyPairConnector({
                mnemonic: mnemonic
            })
        ],
        provider: mempoolProvider,
        runesProvider: maestroProvider,
    });

    // Connect the config
    const [paymentAccount, ordinalsAccount] = await connect(config, {
        purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
        network: bitcoinNetwork
    });


    if (!ordinalsAccount) {
        throw new Error('No ordinals account found for wallet');
    }

    const address = ordinalsAccount.address;
    const publicKey = ordinalsAccount.publicKey;
    const evmAddress = getEVMAddress(paymentAccount, bitcoinNetwork);

    return {
        config,
        paymentAccount,
        ordinalsAccount,
        publicKey,
        accounts: [paymentAccount, ordinalsAccount],
        evmAddress
    };
}

export async function createWalletsWithMnemonics(count: number): Promise<WalletInfo[]> {
    console.log(`Creating ${count} wallets...`);

    let storedMnemonics = readStoredMnemonics();
    const originalMnemonicCount = storedMnemonics.length;

    console.log(`Found ${originalMnemonicCount} existing mnemonics`);

    while (storedMnemonics.length < count) {
        const mnemonic = bip39.generateMnemonic();
        storedMnemonics.push(mnemonic);
        console.log(`Generated new mnemonic ${storedMnemonics.length}/${count}`);
    }

    if (storedMnemonics.length > originalMnemonicCount) {
        saveMnemonics(storedMnemonics);
        console.log(`Added ${storedMnemonics.length - originalMnemonicCount} new mnemonics`);
    }

    const wallets: WalletInfo[] = [];

    for (let i = 0; i < count; i++) {
        try {
            const mnemonic = storedMnemonics[i];
            const wallet = await createWalletFromMnemonic(mnemonic);

            wallets.push(wallet);

            const isNewWallet = i >= originalMnemonicCount;
            console.log(`Created wallet ${i + 1}/${count} with address: ${wallet.paymentAccount.address} (${isNewWallet ? 'new' : 'existing'})`);
        } catch (error) {
            console.error(`Error creating wallet ${i + 1}:`, error);
            throw error;
        }
    }

    console.log(`Successfully created ${wallets.length} wallets`);
    return wallets;
}

export async function setupTestWallets(baseWallet: WalletInfo, runeId: string, syntheticRuneId: string, depositValues: randomSwapValue[]): Promise<WalletInfo[]> {
    const amountOfTestWallets = Number(process.env.TEST_WALLETS ?? "1");
    const testWallets = await createWalletsWithMnemonics(amountOfTestWallets)
    const potentialFee = 3000 * 3
    const edictRuneParams: EdictRuneParams = {
        publish: true,
        transfers: []
    }
    for (const [i, testWallet] of testWallets.entries()) {
        edictRuneParams.transfers.push(
            {
                receiver: testWallet.paymentAccount.address,
                amount: depositValues[i].BTCTokenA + depositValues[i].BTCSynthetic + potentialFee
            },
            {
                runeId: runeId,
                amount: depositValues[i].TokenABTC + depositValues[i].TokenATokenB,
                receiver: testWallet.ordinalsAccount.address,
            },
            {
                runeId: syntheticRuneId,
                amount: depositValues[i].SyntheticBTC,
                receiver: testWallet.ordinalsAccount.address,
            }
        )
    }
    const edictRuneResponse = await edictRune(baseWallet.config, edictRuneParams)
    await waitForTransaction(baseWallet.config, edictRuneResponse.tx.id, 1)
    console.log("Send deposit to test wallets in tx: ", edictRuneResponse.tx.id)
    return testWallets;
}