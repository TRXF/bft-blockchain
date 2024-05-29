const fs = require('fs');
const path = require('path');
const { initUdpServer, initP2PServer, connectToPeer, broadcast, broadcastNodeAddressesMsg, handleBlockchainResponse, responseChainMsg, responseLatestMsg, queryAllMsg, queryChainLengthMsg, peers, localIp } = require('./networking');
const { generateGenesisBlock, addBlock, validateChain, addTransaction, multiStore, initializeDatabase } = require('./blockchain');
const { findAvailablePort } = require('./utils');
const { initializeBFT, startNewRound, handleBlockProposal, handleBlockVote } = require('./bft-consensus');
const { Wallet, Transaction } = require('./transaction');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const crypto = require('crypto');

const { chainName, p2pPort: initialP2pPort, udpPort: initialUdpPort, staticIp } = config;

let chain = [];

initializeDatabase().then(dbChain => {
    chain = dbChain;
    displayChain(chain);

    function displayChain(chain) {
        if (chain.length > 0) {
            console.log(`[${chainName}] Latest Block:`);
            console.log(JSON.stringify(chain[chain.length - 1], null, 4));
        } else {
            console.log("The chain is empty.");
        }
    }

    // Sample data to be used for each block
    const blockData = { blockData: crypto.randomBytes().toString('hex') };

    // Function to add new blocks at intervals
    function addBlockAtInterval(interval) {
        setInterval(async () => {
            chain = await addBlock(chain, blockData);
            displayChain(chain);
            console.log("Healthcheck", validateChain(chain));
            broadcast(responseLatestMsg(chain));
        }, interval);
    }

    // Start the P2P server and UDP server with available ports
    findAvailablePort(initialP2pPort, (err, p2pPort) => {
        if (err) {
            console.error('Error finding available P2P port:', err);
            return;
        }
        findAvailablePort(initialUdpPort, (err, udpPort) => {
            if (err) {
                console.error('Error finding available UDP port:', err);
                return;
            }
            initP2PServer(p2pPort, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound);
            initUdpServer(udpPort, p2pPort);
            addBlockAtInterval(10000); // Start adding blocks every 10 seconds
            initializeBFT(peers, localIp);
            startNewRound(chain, broadcast);

            // Start the API server
            require('./api'); // Import and start the REST server
        });
    });
}).catch(err => {
    console.error('Failed to initialize blockchain:', err);
});
