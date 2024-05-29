const fs = require('fs');
const path = require('path');

class KVStore {
    constructor (dbPath) {
        this.dbPath = dbPath;
        this.store = this.loadStore();
    }

    loadStore() {
        if (fs.existsSync(this.dbPath)) {
            const data = fs.readFileSync(this.dbPath);
            return JSON.parse(data);
        }
        return {};
    }

    saveStore() {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.store, null, 4));
    }

    get(key) {
        return this.store[key] || null;
    }

    set(key, value) {
        this.store[key] = value;
        this.saveStore();
    }

    delete(key) {
        delete this.store[key];
        this.saveStore();
    }

    has(key) {
        return this.store.hasOwnProperty(key);
    }

    getAllKeys() {
        return Object.keys(this.store);
    }
}

class MultiStore {
    constructor (basePath) {
        this.basePath = basePath;
        this.stores = {};
    }

    mountStore(name) {
        if (!this.stores[name]) {
            const storePath = path.join(this.basePath, `${name}.json`);
            this.stores[name] = new KVStore(storePath);
        }
        return this.stores[name];
    }

    getStore(name) {
        return this.stores[name] || null;
    }

    getAllStores() {
        return Object.keys(this.stores);
    }
}

module.exports = {
    KVStore,
    MultiStore
};
