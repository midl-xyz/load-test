"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressPurpose = void 0;
const secp256k1_1 = __importDefault(require("@bitcoinerlab/secp256k1"));
const midl_js_core_1 = require("@midl-xyz/midl-js-core");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ecpair_1 = __importDefault(require("ecpair"));
const bip32_1 = __importDefault(require("bip32"));
const bip39 = __importStar(require("bip39"));
// Initialize libraries
bitcoin.initEccLib(secp256k1_1.default);
const ECPair = (0, ecpair_1.default)(secp256k1_1.default);
const bip32 = (0, bip32_1.default)(secp256k1_1.default);
// Source address private key (from the task description)
const sourcePrivateKey = "5cbca60027846ac2bd050293d08865294dadaa29edd21fe801813a93e909e5be";
var AddressPurpose;
(function (AddressPurpose) {
    AddressPurpose["Payment"] = "payment";
    AddressPurpose["Ordinals"] = "ordinals";
})(AddressPurpose || (exports.AddressPurpose = AddressPurpose = {}));
// Create key pair from private key
const keyPair = ECPair.fromPrivateKey(Buffer.from(sourcePrivateKey, "hex"), {
    network: bitcoin.networks.regtest,
});
// Create configuration
const config = (0, midl_js_core_1.createConfig)({
    networks: [midl_js_core_1.regtest],
    connectors: [new midl_js_core_1.KeyPairConnector(keyPair)],
});
// Generate a random 24-word mnemonic
const generateMnemonic = () => {
    return bip39.generateMnemonic(256); // 256 bits = 24 words
};
// Create a taproot address from a mnemonic
const createTaprootAddressFromMnemonic = (mnemonic) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, bitcoin.networks.regtest);
    // Use BIP-86 derivation path for taproot
    const child = root.derivePath("m/86'/1'/0'/0/0");
    // Create taproot address
    const p2tr = bitcoin.payments.p2tr({
        pubkey: Buffer.from((0, midl_js_core_1.extractXCoordinate)(child.publicKey.toString()), "hex"),
        network: bitcoin.networks.regtest,
    });
    return p2tr.address;
};
// Main function to transfer Bitcoin
const transferBitcoin = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to the account
        const { connection, network: currentNetwork } = config.getState();
        if (!connection) {
            throw new Error("No connection");
        }
        if (!currentNetwork) {
            throw new Error("No network");
        }
        const { accounts } = config.getState();
        const ordinalsAccount = accounts === null || accounts === void 0 ? void 0 : accounts.find((account) => account.purpose === AddressPurpose.Ordinals);
        console.log("Source address:", ordinalsAccount === null || ordinalsAccount === void 0 ? void 0 : ordinalsAccount.address);
        // Generate mnemonic and create destination address
        const mnemonic = generateMnemonic();
        const destinationAddress = createTaprootAddressFromMnemonic(mnemonic);
        console.log("Generated 24-word mnemonic:", mnemonic);
        console.log("Destination address (taproot):", destinationAddress);
        // Verify the address is correct
        if (!(0, midl_js_core_1.isCorrectAddress)(destinationAddress, midl_js_core_1.regtest)) {
            console.error("Generated address is not valid for the regtest network");
            return;
        }
        // Amount to transfer: 10 BTC = 1,000,000,000 satoshis (1 BTC = 100,000,000 satoshis)
        const amount = 1000000000;
        console.log(`Transferring ${amount / 100000000} BTC to ${destinationAddress}`);
        // Execute the transfer
        const result = yield (0, midl_js_core_1.transferBTC)(config, {
            transfers: [
                {
                    receiver: destinationAddress,
                    amount,
                },
            ],
            publish: true,
        });
        console.log("Transfer successful!");
        console.log("Transaction ID:", result.tx.id);
        console.log("Transaction Hex:", result.tx.hex);
        console.log("\nIMPORTANT: Save this information for future reference:");
        console.log("Mnemonic:", mnemonic);
        console.log("Destination address:", destinationAddress);
        return result;
    }
    catch (e) {
        console.error("Error during transfer:");
        if ("response" in e) {
            console.error("Response error:", e.response);
        }
        if ("request" in e) {
            console.error("Request error:", e.request);
        }
        console.error(e);
        throw e;
    }
});
// Execute the transfer
transferBitcoin()
    .then(() => {
    console.log("Script completed successfully");
})
    .catch((error) => {
    console.error("Script failed:", error);
});
