const { MessageType } = require('./constants');

let currentRound = 0;
let currentProposer = null;
let votes = {};
let peers = [];
let localIp = '';

function initializeBFT(initialPeers, ip) {
    peers = initialPeers;
    localIp = ip;
    currentRound = 0;
    currentProposer = peers[0];
    votes = {};
}

function getNextProposer() {
    const index = peers.indexOf(currentProposer);
    return peers[(index + 1) % peers.length];
}

function startNewRound(chain, broadcast) {
    currentRound++;
    currentProposer = getNextProposer();
    votes = {};

    if (currentProposer === localIp) {
        proposeBlock(chain[chain.length - 1], broadcast);
    }
}

function proposeBlock(lastBlock, broadcast) {
    const blockProposal = { ...lastBlock, round: currentRound };
    broadcast({ type: MessageType.BLOCK_PROPOSAL, data: JSON.stringify(blockProposal) });
}

function handleBlockProposal(message, chain, addBlock, validateChain, broadcast) {
    const blockProposal = JSON.parse(message.data);

    if (blockProposal.round === currentRound) {
        if (validateChain([...chain, blockProposal])) {
            votes[blockProposal.hash] = (votes[blockProposal.hash] || 0) + 1;

            if (votes[blockProposal.hash] > Math.floor(peers.length / 2)) {
                chain = addBlock(chain, blockProposal.data);
                startNewRound(chain, broadcast);
            } else {
                broadcast({ type: MessageType.BLOCK_VOTE, data: blockProposal.hash });
            }
        }
    }
}

function handleBlockVote(message, startNewRound) {
    const blockHash = message.data;
    votes[blockHash] = (votes[blockHash] || 0) + 1;

    if (votes[blockHash] > Math.floor(peers.length / 2)) {
        startNewRound();
    }
}

module.exports = {
    initializeBFT,
    startNewRound,
    handleBlockProposal,
    handleBlockVote,
};
