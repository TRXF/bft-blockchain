const express = require('express');
const bodyParser = require('body-parser');
const { Wallet } = require('./wallet');
const { Transaction } = require('./transaction');
const { initializeDatabase, addTransaction, addBlockToDatabase, addBlock } = require('./blockchain');
const { auth } = require('./auth');
const { broadcast, receive } = require('./networking');
const { MessageType } = require('./constants');
const BankModule = require('./bank'); // Correct import
const CrisisModule = require('./crisis');
const fs = require('fs');
const { addressPrefix } = require('./config');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const app = express();
app.use(bodyParser.json());

const genesisState = JSON.parse(fs.readFileSync('./data/genesisState.json', 'utf-8'));
const bank = new BankModule(); // Correct instantiation
bank.initGenesis(genesisState);

const crisis = new CrisisModule();

initializeDatabase()
    .then(chain => {
        console.log('Blockchain initialized successfully');

        app.post('/wallet', (req, res) => {
            const wallet = new Wallet();
            const account = auth.createAccount(wallet.keys.publicKey);
            res.json({
                publicKey: wallet.keys.publicKey,
                privateKey: wallet.keys.privateKey,
                address: wallet.address, // Use the prefixed address
            });
        });

        app.post('/transaction', (req, res) => {
            const { toAddress, amount, privateKey } = req.body;
            const signingKey = ec.keyFromPrivate(privateKey, 'hex');
            const publicKey = signingKey.getPublic('hex');
            const fromAddress = Wallet.generateAddress(publicKey);

            console.log(`Private Key: ${privateKey}`);
            console.log(`Public Key: ${publicKey}`);
            console.log(`Derived Address: ${fromAddress}`);

            const account = auth.getAccount(fromAddress);
            if (!account) {
                return res.status(400).send('Account not found');
            }

            const wallet = new Wallet();
            wallet.keys = {
                publicKey: publicKey,
                privateKey: privateKey,
            };

            try {
                const transaction = wallet.createTransaction(toAddress, amount, account.sequence);
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

        app.get('/account/:address', (req, res) => {
            const account = auth.getAccount(req.params.address);
            if (!account) {
                return res.status(404).send('Account not found');
            }
            res.json(account);
        });

        app.get('/accounts', (req, res) => {
            const accounts = auth.getAllAccounts();
            res.json(accounts);
        });

        app.get('/store/:name/:key', (req, res) => {
            const { name, key } = req.params;
            const store = new KVStore(`./data/${name}.json`); // Use KVStore
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
            const store = new KVStore(`./data/${name}.json`); // Use KVStore
            store.set(key, value);
            res.send('Key-value pair set successfully');
        });

        app.delete('/store/:name/:key', (req, res) => {
            const { name, key } = req.params;
            const store = new KVStore(`./data/${name}.json`); // Use KVStore
            if (!store) {
                return res.status(404).send('Store not found');
            }
            store.delete(key);
            res.send('Key-value pair deleted successfully');
        });

        // Bank Module Endpoints
        app.get('/supply/:denom', (req, res) => {
            const denom = req.params.denom;
            const supply = bank.getSupply(denom);
            res.json({ denom, supply });
        });

        app.post('/send', (req, res) => {
            const { fromAddress, toAddress, amount } = req.body;
            try {
                bank.send(fromAddress, toAddress, amount);
                res.send('Transaction successful');
            } catch (error) {
                res.status(400).send(error.message);
            }
        });

        app.post('/mint', (req, res) => {
            const { moduleName, amount } = req.body;
            try {
                bank.mint(moduleName, amount);
                res.send('Minting successful');
            } catch (error) {
                res.status(400).send(error.message);
            }
        });

        app.post('/burn', (req, res) => {
            const { moduleName, amount } = req.body;
            try {
                bank.burn(moduleName, amount);
                res.send('Burning successful');
            } catch (error) {
                res.status(400).send(error.message);
            }
        });

        app.get('/sendEnabled', (req, res) => {
            const sendEnabledStatuses = bank.getSendEnabledStatuses();
            res.json(sendEnabledStatuses);
        });

        app.post('/sendEnabled', (req, res) => {
            const { denom, enabled } = req.body;
            try {
                bank.setSendEnabled(denom, enabled);
                res.send('Send enabled status updated');
            } catch (error) {
                res.status(400).send(error.message);
            }
        });

        app.get('/params', (req, res) => {
            res.json(bank.params);
        });

        app.post('/params', (req, res) => {
            const { defaultSendEnabled } = req.body;
            bank.params.defaultSendEnabled = defaultSendEnabled;
            res.send('Bank params updated');
        });

        // Crisis Module Endpoints
        app.post('/crisis/verifyInvariant', (req, res) => {
            const { sender, invariantModuleName, invariantRoute } = req.body;
            try {
                const result = crisis.verifyInvariant(sender, invariantModuleName, invariantRoute);
                res.json({ result, message: 'Invariant verified successfully' });
            } catch (error) {
                res.status(400).send(error.message);
            }
        });

        app.post('/crisis/constantFee', (req, res) => {
            const { denom, amount } = req.body;
            try {
                crisis.updateConstantFee(denom, amount);
                res.send('Constant fee updated successfully');
            } catch (error) {
                res.status(400).send(error.message);
            }
        });

        const PORT = 1317;
        app.listen(PORT, () => {
            console.log(`REST server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to initialize blockchain:', err);
    });

receive(message => {
    switch (message.type) {
        case MessageType.CURRENT_HEIGHT:
            const { height } = message.data;
            console.log(`Received current block height: ${height}`);
            break;
        default:
            console.log(`Unknown message type: ${message.type}`);
            break;
    }
});
