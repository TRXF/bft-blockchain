const EC = require('elliptic').ec;
const SHA256 = require('crypto-js/sha256');

const ec = new EC('secp256k1');

class Transaction {
    constructor (fromAddress, toAddress, amount, sequence) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.sequence = sequence;
        this.timestamp = Date.now();
    }

    calculateHash() {
        // Use template literals for string concatenation
        return SHA256(`${this.fromAddress}${this.toAddress}${this.amount}${this.sequence}${this.timestamp}`).toString();
    }

    signTransaction(signingKey) {
        if (signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('You cannot sign transactions for other wallets!');
        }

        const hashTx = this.calculateHash();
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    isValid() {
        if (this.fromAddress === null) return true;

        if (!this.signature || this.signature.length === 0) {
            throw new Error('No signature in this transaction');
        }

        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(), this.signature);
    }
}

class Wallet {
    constructor () {
        this.keys = this.generateKeys();
        this.address = this.keys.publicKey;
    }

    generateKeys() {
        const keyPair = ec.genKeyPair();
        return {
            privateKey: keyPair.getPrivate('hex'),
            publicKey: keyPair.getPublic('hex'),
        };
    }

    createTransaction(to, amount, sequence) {
        const tx = new Transaction(this.address, to, amount, sequence);
        // Destructure keys object
        const { privateKey } = this.keys;
        const signingKey = ec.keyFromPrivate(privateKey, 'hex');
        tx.signTransaction(signingKey);
        return tx;
    }
}

module.exports = { Wallet, Transaction };
