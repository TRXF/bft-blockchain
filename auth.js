const EC = require('elliptic').ec;
const SHA256 = require('crypto-js/sha256');
const RIPEMD160 = require('crypto-js/ripemd160');
const { addressPrefix } = require('./config');
const KVStore = require('./store'); // Ensure KVStore is imported correctly
const { Wallet } = require('./wallet');

const ec = new EC('secp256k1');

class Account {
    constructor (address, publicKey, accountNumber, sequence) {
        this.address = address;
        this.publicKey = publicKey;
        this.accountNumber = accountNumber;
        this.sequence = sequence;
    }

    static fromJSON(json) {
        return new Account(json.address, json.publicKey, json.accountNumber, json.sequence);
    }

    toJSON() {
        return {
            address: this.address,
            publicKey: this.publicKey,
            accountNumber: this.accountNumber,
            sequence: this.sequence,
        };
    }
}

class Auth {
    constructor (store) {
        this.store = store;
    }

    createAccount(publicKey) {
        const address = Wallet.generateAddress(publicKey);
        const accountNumber = this.store.getAllKeys().length + 1;
        const account = new Account(address, publicKey, accountNumber, 0);
        console.log(`Creating account with address: ${address}`); // Debugging log
        this.store.set(address, account.toJSON()); // Store using the address
        return account;
    }

    getAccount(address) {
        console.log(`Getting account with address: ${address}`); // Debugging log
        const accountData = this.store.get(address);
        console.log(`Account data: ${JSON.stringify(accountData)}`); // Debugging log
        if (accountData) {
            return Account.fromJSON(accountData);
        }
        return null;
    }

    getPublicKeyFromPrivateKey(privateKey) {
        const keyPair = ec.keyFromPrivate(privateKey, 'hex');
        return keyPair.getPublic('hex');
    }

    setAccount(account) {
        this.store.set(account.address, account.toJSON());
    }

    getAllAccounts() {
        return this.store.getAllKeys().map(key => Account.fromJSON(this.store.get(key)));
    }

    validateTransaction(transaction) {
        const account = this.getAccount(transaction.fromAddress);
        if (!account) throw new Error('Account not found');
        if (account.sequence !== transaction.sequence) throw new Error('Invalid sequence number');
        if (!transaction.isValid()) throw new Error('Invalid transaction');
        return true;
    }

    processTransaction(transaction) {
        if (this.validateTransaction(transaction)) {
            const account = this.getAccount(transaction.fromAddress);
            account.sequence += 1;
            this.setAccount(account);
        }
    }
}

const authStore = new KVStore('./data/auth.json'); // Initialize authStore
const auth = new Auth(authStore);

module.exports = { Account, Auth, auth };
