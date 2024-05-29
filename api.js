const express = require('express');
const bodyParser = require('body-parser');
const { Wallet, Transaction } = require('./wallet');
const { initializeDatabase, addTransaction, addBlockToDatabase, addBlock } = require('./blockchain');
const { auth } = require('./auth');
const { broadcast, receive } = require('./networking');
const { MessageType } = require('./constants');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const app = express();
app.use(bodyParser.json());

initializeDatabase()
    .then(chain => {
        console.log('Blockchain initialized successfully');

        // Create a new wallet
        app.post('/wallet', (req, res) => {
            const wallet = new Wallet();
            const account = auth.createAccount(wallet.keys.publicKey);
            res.json({
                publicKey: wallet.keys.publicKey,
                privateKey: wallet.keys.privateKey,
                address: account.address,
            });
        });

        // Create and send a transaction
        app.post('/transaction', (req, res) => {
            const { toAddress, amount, privateKey } = req.body;
            const decodedPrivateKey = Buffer.from(privateKey, 'base64').toString('hex');
            const fromAddress = ec.keyFromPrivate(decodedPrivateKey).getPublic('hex');

            const account = auth.getAccount(fromAddress);
            if (!account) {
                return res.status(400).send('Account not found');
            }

            const wallet = new Wallet();
            wallet.keys = {
                publicKey: fromAddress,
                privateKey: privateKey,
            };

            try {
                const transaction = wallet.createTransaction(toAddress, amount, account.sequence, privateKey);
                if (!transaction.isValid()) {
                    return res.status(400).send('Invalid transaction');
                }

                addTransaction(chain, transaction);
                broadcastTransaction(transaction);
                res.send('Transaction created and broadcast successfully');
            } catch (error) {
                return res.status(400).send(error.message);
            }
        });

        function broadcastTransaction(transaction) {
            broadcast({
                type: MessageType.NEW_TRANSACTION,
                data: JSON.stringify(transaction),
            });
        }

        // Get the blockchain
        app.get('/chain', (req, res) => {
            res.json(chain);
        });

        app.get('/blocks', (req, res) => {
            res.json(chain);
        });

        app.post('/mineBlock', (req, res) => {
            const newBlockData = req.body.data;
            chain = addBlock(chain, newBlockData);
            addBlockToDatabase(chain[chain.length - 1]);
            res.json(chain);
        });

        app.post('/addTransaction', (req, res) => {
            const { fromAddress, toAddress, amount } = req.body;
            const newTransaction = new Transaction(fromAddress, toAddress, amount);
            addTransaction(chain, newTransaction);
            res.json(chain);
        });

        // Get account by address
        app.get('/account/:address', (req, res) => {
            const account = auth.getAccount(req.params.address);
            if (!account) {
                return res.status(404).send('Account not found');
            }
            res.json(account);
        });

        // Get all accounts
        app.get('/accounts', (req, res) => {
            const accounts = auth.getAllAccounts();
            res.json(accounts);
        });

        // Store API
        app.get('/store/:name/:key', (req, res) => {
            const { name, key } = req.params;
            const store = multiStore.getStore(name);
            if (!store) {
                return res.status(404).send('Store not found');
            }
            const value = store.get(key);
            if (!value) {
                return res.status(404).send('Key not found');
            }
            res.json({ key, value });
        });

        app.post('/store/:name', (req, res) => {
            const { name } = req.params;
            const { key, value } = req.body;
            const store = multiStore.mountStore(name);
            store.set(key, value);
            res.send('Key-value pair set successfully');
        });

        app.delete('/store/:name/:key', (req, res) => {
            const { name, key } = req.params;
            const store = multiStore.getStore(name);
            if (!store) {
                return res.status(404).send('Store not found');
            }
            store.delete(key);
            res.send('Key-value pair deleted successfully');
        });

        // Start the server
        const PORT = 1317;
        app.listen(PORT, () => {
            console.log(`REST server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to initialize blockchain:', err);
    });

// Handle received messages
receive(message => {
    switch (message.type) {
        case MessageType.CURRENT_HEIGHT:
            const { height } = message.data;
            // Update the validator's state to avoid creating existing blocks
            // Implement logic to handle current height update
            console.log(`Received current block height: ${height}`);
            break;
        // Handle other message types as needed
        default:
            console.log(`Unknown message type: ${message.type}`);
            break;
    }
});
