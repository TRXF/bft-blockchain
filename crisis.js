const { Coin } = require('./types');
const { addressPrefix } = require('./config');

class CrisisModule {
    constructor () {
        this.params = {
            constantFee: new Coin('uatom', 1000) // Example value, adjust as needed
        };
        this.invariants = new Map();
    }

    registerInvariant(moduleName, route, invariantFunction) {
        if (!this.invariants.has(moduleName)) {
            this.invariants.set(moduleName, new Map());
        }
        this.invariants.get(moduleName).set(route, invariantFunction);
    }

    verifyInvariant(sender, moduleName, route) {
        if (!this.invariants.has(moduleName) || !this.invariants.get(moduleName).has(route)) {
            throw new Error('Invariant route not registered');
        }

        const invariantFunction = this.invariants.get(moduleName).get(route);
        const isBroken = invariantFunction();

        if (isBroken) {
            throw new Error('Invariant is broken, halting the blockchain');
        }

        // Deduct the constant fee
        const account = auth.getAccount(sender);
        if (!account) {
            throw new Error('Account not found');
        }

        const fee = this.params.constantFee;
        if (!account.coins.has(fee.denom) || account.coins.get(fee.denom) < fee.amount) {
            throw new Error('Insufficient funds for constant fee');
        }

        account.coins.subtract(fee);
        auth.setAccount(account);

        return isBroken;
    }

    updateConstantFee(denom, amount) {
        this.params.constantFee = new Coin(denom, amount);
    }
}

module.exports = CrisisModule;
