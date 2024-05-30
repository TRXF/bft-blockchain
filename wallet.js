// wallet.js
const EC = require('elliptic').ec;
const SHA256 = require('crypto-js/sha256');
const RIPEMD160 = require('crypto-js/ripemd160');
const { addressPrefix } = require('./config');
const { Transaction } = require('./transaction');

const ec = new EC('secp256k1');

class Wallet {
    constructor () {
        this.keys = this.generateKeys();
        this.address = Wallet.generateAddress(this.keys.publicKey);
    }

    generateKeys() {
        const keyPair = ec.genKeyPair();
        return {
            privateKey: keyPair.getPrivate('hex'),
            publicKey: keyPair.getPublic('hex'),
        };
    }

    static generateAddress(publicKey) {
        const hash = SHA256(publicKey);
        const address = RIPEMD160(hash).toString();
        return `${addressPrefix}${address}`;
    }

    createTransaction(to, amount, sequence) {
        const fromAddress = Wallet.generateAddress(this.keys.publicKey);
        const tx = new Transaction(fromAddress, to, amount, sequence, this.keys.publicKey); // Pass the public key
        const signingKey = ec.keyFromPrivate(this.keys.privateKey, 'hex');

        tx.signTransaction(signingKey);
        return tx;
    }
}

module.exports = { Wallet };
