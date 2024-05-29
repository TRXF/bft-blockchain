const WebSocket = require('ws');
const dgram = require('dgram');
const fs = require('fs');
const { MessageType } = require('./constants');
const { getLocalIpAddress, findAvailablePort } = require('./utils');
const config = require('./config.json');

let sockets = [];
let peers = config.peers;
const localIp = getLocalIpAddress();
const staticIp = config.staticIp;

function initUdpServer(udpPort, p2pPort) {
    const udpServer = dgram.createSocket('udp4');

    udpServer.on('listening', () => {
        udpServer.setBroadcast(true);
        console.log(`UDP server listening on port ${udpPort}`);
    });

    udpServer.on('message', (message, remote) => {
        const { address } = remote;
        const data = JSON.parse(message);
        if (data.type === MessageType.BROADCAST && address !== localIp) {
            const peerAddress = `ws://${address}:${data.p2pPort}`;
            if (!peers.includes(peerAddress)) {
                peers.push(peerAddress);
                updateConfigPeers(peers);
                connectToPeer(peerAddress);
            }
        }
    });

    udpServer.bind(udpPort);

    function broadcastPresence() {
        const message = JSON.stringify({ type: MessageType.BROADCAST, p2pPort });
        udpServer.send(message, udpPort, staticIp); // Use the static IP address
    }

    setInterval(broadcastPresence, 5000); // Broadcast presence every 5 seconds
}

function initP2PServer(p2pPort, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound) {
    const server = new WebSocket.Server({ port: p2pPort });
    server.on('connection', ws => initConnection(ws, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound));
    console.log(`Listening for peer-to-peer connections on: ${p2pPort}`);
}

function initConnection(ws, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound) {
    sockets.push(ws);
    initMessageHandler(ws, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
    write(ws, broadcastNodeAddressesMsg());
}

function initMessageHandler(ws, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound) {
    ws.on('message', (data) => {
        const message = JSON.parse(data);
        console.log('Received message', message);
        switch (message.type) {
            case MessageType.QUERY_LATEST:
                write(ws, responseLatestMsg(chain));
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg(chain));
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message, chain, validateChain, addBlock, broadcast);
                break;
            case MessageType.NODE_ADDRESSES:
                handleNodeAddressesResponse(message);
                break;
            case MessageType.BLOCK_PROPOSAL:
                handleBlockProposal(message, chain, addBlock, validateChain, broadcast);
                break;
            case MessageType.BLOCK_VOTE:
                handleBlockVote(message, startNewRound);
                break;
            case MessageType.NEW_TRANSACTION:
                handleNewTransaction(message);
                break;
        }
    });
}

function write(ws, message) {
    ws.send(JSON.stringify(message));
}

function queryChainLengthMsg() {
    return { type: MessageType.QUERY_LATEST };
}

function queryAllMsg() {
    return { type: MessageType.QUERY_ALL };
}

function responseChainMsg(chain) {
    return {
        type: MessageType.RESPONSE_BLOCKCHAIN,
        data: JSON.stringify(chain)
    };
}

function responseLatestMsg(chain) {
    return {
        type: MessageType.RESPONSE_BLOCKCHAIN,
        data: JSON.stringify([chain[chain.length - 1]])
    };
}

function initErrorHandler(ws) {
    const closeConnection = (ws) => {
        console.log('Connection failed to peer: ', ws.url);
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
}

function handleBlockchainResponse(message, chain, validateChain, addBlock, broadcast) {
    const receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.height - b2.height));
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    const latestBlockHeld = chain[chain.length - 1];

    if (latestBlockReceived.height > latestBlockHeld.height) {
        console.log('Blockchain possibly behind. We got: ' + latestBlockHeld.height + ' Peer got: ' + latestBlockReceived.height);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            console.log("Appending the received block to our chain");
            chain.push(latestBlockReceived);
            broadcast(responseLatestMsg(chain));
        } else if (receivedBlocks.length === 1) {
            console.log("We have to query the chain from our peer");
            broadcast(queryAllMsg());
        } else {
            console.log("Received blockchain is longer than current blockchain");
            replaceChain(receivedBlocks, chain, validateChain, broadcast);
        }
    } else {
        console.log('Received blockchain is not longer than current blockchain. Do nothing.');
    }
}

function handleNodeAddressesResponse(message) {
    const receivedAddresses = JSON.parse(message.data);
    receivedAddresses.forEach(address => {
        if (!peers.includes(address) && address !== `ws://${localIp}:${p2pPort}`) {
            peers.push(address);
            updateConfigPeers(peers);
            connectToPeer(address);
        }
    });
}

function broadcast(message) {
    sockets.forEach(socket => write(socket, message));
}

function broadcastNodeAddressesMsg() {
    return {
        type: MessageType.NODE_ADDRESSES,
        data: JSON.stringify(peers)
    };
}

function replaceChain(newBlocks, chain, validateChain, broadcast) {
    if (validateChain(newBlocks) && newBlocks.length > chain.length) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        chain = newBlocks;
        broadcast(responseLatestMsg(chain));
    } else {
        console.log('Received blockchain invalid');
    }
}

function connectToPeer(peer) {
    const ws = new WebSocket(peer);
    ws.on('open', () => initConnection(ws, handleBlockProposal, handleBlockVote, chain, addBlock, validateChain, broadcast, startNewRound));
    ws.on('error', () => {
        console.log('Connection failed to peer: ', peer);
    });
}

function updateConfigPeers(peers) {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    config.peers = peers;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
}

function receive(callback) {
    sockets.forEach(ws => ws.on('message', callback));
}

function handleNewTransaction(message) {
    // Implement your logic for handling new transactions
    console.log("New transaction received: ", message.data);
}

module.exports = {
    initUdpServer,
    initP2PServer,
    connectToPeer,
    broadcast,
    broadcastNodeAddressesMsg,
    handleBlockchainResponse,
    responseChainMsg,
    responseLatestMsg,
    queryAllMsg,
    queryChainLengthMsg,
    peers, // Export peers to be used by other modules
    localIp, // Export localIp to be used by other modules
    receive, // Export receive to be used by other modules
};
