// transaction.js
const EC = require('elliptic').ec;
const SHA256 = require('crypto-js/sha256');
const RIPEMD160 = require('crypto-js/ripemd160');
const { addressPrefix } = require('./config');

const ec = new EC('secp256k1');

class Transaction {
    constructor (fromAddress, toAddress, amount, sequence, publicKey) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.sequence = sequence;
        this.timestamp = Date.now();
        this.publicKey = publicKey; // Store the public key
    }

    calculateHash() {
        return SHA256(`${this.fromAddress}${this.toAddress}${this.amount}${this.sequence}${this.timestamp}`).toString();
    }

    signTransaction(signingKey) {
        const publicKey = signingKey.getPublic('hex');
        const hash = SHA256(publicKey);
        const address = RIPEMD160(hash).toString();
        const expectedAddress = `${addressPrefix}${address}`;

        console.log("Expected Address:", expectedAddress);
        console.log("From Address:", this.fromAddress);

        if (expectedAddress !== this.fromAddress) {
            throw new Error(`You cannot sign transactions for other wallets! Expected address: ${expectedAddress}, got: ${this.fromAddress}`);
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

        const key = ec.keyFromPublic(this.publicKey, 'hex');
        return key.verify(this.calculateHash(), this.signature);
    }
}

module.exports = { Transaction };
