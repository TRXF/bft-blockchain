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

module.exports = KVStore;
