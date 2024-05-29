const SHA256 = require('crypto-js/sha256');
const sqlite3 = require('sqlite3').verbose();
const { MultiStore } = require('./store');
const path = require('path');
const { broadcast } = require('./networking');
const { MessageType } = require('./constants');

const baseStorePath = path.join(__dirname, 'data'); // Define the base path for store data
const multiStore = new MultiStore(baseStorePath);
const dbPath = path.join(baseStorePath, 'blockchain.db');
let db = new sqlite3.Database(dbPath);

let transactionQueue = [];

function calculateHash({ previousHash, timestamp, data, nonce = 1, height }) {
    return SHA256(previousHash + timestamp + JSON.stringify(data) + nonce + height).toString();
}

function generateGenesisBlock() {
    const block = {
        height: 0,
        timestamp: +new Date(),
        data: "Genesis Block",
        previousHash: "0".repeat(64),
        nonce: 0,
        transactions: []
    };

    return {
        ...block,
        hash: calculateHash(block)
    }
}

function checkDifficulty(difficulty, hash) {
    return hash.substr(0, difficulty) === "0".repeat(difficulty);
}

function nextNonce(block) {
    return updateHash({ ...block, nonce: block.nonce + 1 });
}

function updateHash(block) {
    return { ...block, hash: calculateHash(block) };
}

function trampoline(func) {
    let result = func.apply(func, Array.prototype.slice.call(arguments, 1));
    while (result && typeof result === "function") {
        result = result();
    }
    return result;
}

function mineBlock(difficulty, block) {
    function mine(block) {
        const newBlock = nextNonce(block);
        return checkDifficulty(difficulty, newBlock.hash)
            ? newBlock
            : () => mine(nextNonce(block));
    }
    return trampoline(mine, nextNonce(block));
}

async function addBlock(chain, data) {
    const { hash: previousHash, height: previousHeight } = chain[chain.length - 1];
    const block = {
        height: previousHeight + 1,
        timestamp: +new Date(),
        data,
        previousHash,
        nonce: 0,
        transactions: transactionQueue // Add queued transactions to the new block
    };
    const newBlock = mineBlock(4, block);

    try {
        const existingBlock = await getBlockByHeight(newBlock.height);
        if (!existingBlock) {
            await addBlockToDatabase(newBlock); // Save the new block to the database
            chain.push(newBlock);
            transactionQueue = []; // Clear the transaction queue after adding them to the block
            broadcast({ type: MessageType.CURRENT_HEIGHT, data: { height: newBlock.height } });
        } else {
            console.log(`Block with height ${newBlock.height} already exists. Skipping...`);
        }
    } catch (error) {
        console.error('Error checking or adding block:', error);
    }

    return chain;
}

function getBlockByHeight(height) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM blocks WHERE height = ?', [height], (err, row) => {
            if (err) {
                console.error('Could not retrieve block from database', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function validateChain(chain) {
    function tce(chain, index) {
        if (index === 0) return true;
        if (!chain[index]) return false; // Check if the block exists
        const { hash, ...currentBlockWithoutHash } = chain[index];
        const currentBlock = chain[index];
        const previousBlock = chain[index - 1];
        const isValidHash = (hash === calculateHash(currentBlockWithoutHash));
        const isPreviousHashValid = (currentBlock.previousHash === previousBlock.hash);
        const isValidChain = (isValidHash && isPreviousHashValid);

        if (!isValidChain) return false;
        else return tce(chain, index - 1);
    }
    return tce(chain, chain.length - 1);
}

async function addTransaction(chain, transaction) {
    if (!transaction.isValid()) {
        console.log("Invalid transaction");
        return;
    }

    transactionQueue.push(transaction); // Add transaction to the queue
    console.log("Transaction added to queue");
}

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Could not connect to database', err);
                reject(err);
            } else {
                console.log('Connected to database');
                db.run(`CREATE TABLE IF NOT EXISTS blocks (
                    height INTEGER PRIMARY KEY,
                    timestamp INTEGER,
                    data TEXT,
                    previousHash TEXT,
                    nonce INTEGER,
                    hash TEXT,
                    transactions TEXT
                )`, async (err) => {
                    if (err) {
                        console.error('Could not create table', err);
                        reject(err);
                    } else {
                        try {
                            await checkAndAlterTable();
                            db.all('SELECT * FROM blocks ORDER BY height', (err, rows) => {
                                if (err) {
                                    console.error('Could not retrieve blocks from database', err);
                                    reject(err);
                                } else {
                                    const chain = rows.map(row => ({
                                        height: row.height,
                                        timestamp: row.timestamp,
                                        data: JSON.parse(row.data),
                                        previousHash: row.previousHash,
                                        nonce: row.nonce,
                                        hash: row.hash,
                                        transactions: JSON.parse(row.transactions || '[]') // Add transactions if needed
                                    }));
                                    resolve(chain.length > 0 ? chain : [generateGenesisBlock()]);
                                }
                            });
                        } catch (err) {
                            reject(err);
                        }
                    }
                });
            }
        });
    });
}

function checkAndAlterTable() {
    return new Promise((resolve, reject) => {
        db.all('PRAGMA table_info(blocks)', (err, columns) => {
            if (err) {
                console.error('Could not retrieve table info', err);
                reject(err);
            } else {
                const columnNames = columns.map(column => column.name);
                if (!columnNames.includes('transactions')) {
                    db.run('ALTER TABLE blocks ADD COLUMN transactions TEXT', (err) => {
                        if (err) {
                            console.error('Could not add transactions column to blocks table', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            }
        });
    });
}

function addBlockToDatabase(block) {
    return new Promise((resolve, reject) => {
        const { height, timestamp, data, previousHash, nonce, hash, transactions } = block;
        db.run(`INSERT INTO blocks (height, timestamp, data, previousHash, nonce, hash, transactions) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [height, timestamp, JSON.stringify(data), previousHash, nonce, hash, JSON.stringify(transactions)], (err) => {
                if (err) {
                    console.error('Could not insert block into database', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
    });
}

module.exports = {
    calculateHash,
    generateGenesisBlock,
    checkDifficulty,
    nextNonce,
    updateHash,
    trampoline,
    mineBlock,
    addBlock,
    validateChain,
    multiStore,
    addTransaction,
    initializeDatabase,
    addBlockToDatabase,
    getBlockByHeight
};
