const { Wallet } = require('./wallet');
const { Account, auth } = require('./auth');
const path = require('path');
const KVStore = require('./store');

class BankModule {
    constructor () {
        this.store = new KVStore('./data/bank.json'); // Use KVStore instead of multiStore
    }

    initGenesis(genesisState) {
        this.totalSupply = genesisState.totalSupply;
        this.params = genesisState.params;
        this.sendEnabled = genesisState.sendEnabled;

        for (const [address, account] of Object.entries(genesisState.accounts)) {
            const accountObject = auth.createAccount(account.publicKey);
            auth.setAccount(new Account(account.address, account.publicKey, accountObject.accountNumber, account.sequence));
            this.store.set(address, account.coins);
        }
    }

    createAdminAccount() {
        const adminWallet = new Wallet();
        const account = auth.createAccount(adminWallet.keys.publicKey);
        return account;
    }

    getSupply(denom) {
        return this.totalSupply[denom] || 0;
    }

    send(fromAddress, toAddress, { denom, amount }) {
        const fromAccount = auth.getAccount(fromAddress);
        const toAccount = auth.getAccount(toAddress);

        if (!fromAccount || !toAccount) {
            throw new Error('Account not found');
        }

        const fromBalance = fromAccount.coins.find(c => c.denom === denom)?.amount || 0;

        if (fromBalance < amount) {
            throw new Error('Insufficient balance');
        }

        // Deduct from sender
        fromAccount.coins = fromAccount.coins.map(c => {
            if (c.denom === denom) {
                return { denom, amount: c.amount - amount };
            }
            return c;
        });

        // Add to receiver
        toAccount.coins = toAccount.coins.map(c => {
            if (c.denom === denom) {
                return { denom, amount: c.amount + amount };
            }
            return c;
        });

        auth.setAccount(fromAccount);
        auth.setAccount(toAccount);
    }

    mint(moduleName, { denom, amount }) {
        this.totalSupply[denom] = (this.totalSupply[denom] || 0) + amount;

        const moduleAccount = auth.getAccount(moduleName);
        if (!moduleAccount) {
            throw new Error('Module account not found');
        }

        moduleAccount.coins = moduleAccount.coins.map(c => {
            if (c.denom === denom) {
                return { denom, amount: c.amount + amount };
            }
            return c;
        });

        auth.setAccount(moduleAccount);
    }

    burn(moduleName, { denom, amount }) {
        this.totalSupply[denom] = (this.totalSupply[denom] || 0) - amount;

        const moduleAccount = auth.getAccount(moduleName);
        if (!moduleAccount) {
            throw new Error('Module account not found');
        }

        moduleAccount.coins = moduleAccount.coins.map(c => {
            if (c.denom === denom) {
                return { denom, amount: c.amount - amount };
            }
            return c;
        });

        auth.setAccount(moduleAccount);
    }

    getSendEnabledStatuses() {
        return this.sendEnabled;
    }

    setSendEnabled(denom, enabled) {
        this.sendEnabled[denom] = enabled;
    }
}

const storePath = path.join(__dirname, 'data', 'bank.json');
const bankStore = new KVStore(storePath); // Correctly instantiate KVStore
const bank = new BankModule(bankStore);

module.exports = BankModule;
