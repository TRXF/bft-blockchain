// types.js

class Coin {
    constructor (denom, amount) {
        this.denom = denom;
        this.amount = amount;
    }
}

class Coins {
    constructor (coins) {
        this.coins = coins || [];
    }

    add(coin) {
        const existingCoin = this.coins.find(c => c.denom === coin.denom);
        if (existingCoin) {
            existingCoin.amount += coin.amount;
        } else {
            this.coins.push(coin);
        }
    }

    subtract(coin) {
        const existingCoin = this.coins.find(c => c.denom === coin.denom);
        if (existingCoin) {
            if (existingCoin.amount >= coin.amount) {
                existingCoin.amount -= coin.amount;
                if (existingCoin.amount === 0) {
                    this.coins = this.coins.filter(c => c.denom !== coin.denom);
                }
            } else {
                throw new Error(`Insufficient balance for ${coin.denom}`);
            }
        } else {
            throw new Error(`No balance for ${coin.denom}`);
        }
    }
}

class BaseAccount {
    constructor (address, coins) {
        this.address = address;
        this.coins = new Coins(coins);
    }

    getBalance(denom) {
        const coin = this.coins.find(c => c.denom === denom);
        return coin ? coin.amount : 0;
    }
}

class ModuleAccount extends BaseAccount {
    constructor (name, address, coins) {
        super(address, coins);
        this.name = name;
        this.permissions = [];
    }

    addPermission(permission) {
        this.permissions.push(permission);
    }

    hasPermission(permission) {
        return this.permissions.includes(permission);
    }
}

class VestingAccount extends BaseAccount {
    constructor (address, coins, vestingSchedule) {
        super(address, coins);
        this.vestingSchedule = vestingSchedule;
    }
}

class Params {
    constructor (params) {
        this.defaultSendEnabled = params.defaultSendEnabled;
        this.sendEnabled = params.sendEnabled || [];
    }
}

class SendEnabled {
    constructor (denom, enabled) {
        this.denom = denom;
        this.enabled = enabled;
    }
}

module.exports = {
    Coin,
    Coins,
    BaseAccount,
    ModuleAccount,
    VestingAccount,
    Params,
    SendEnabled
};
