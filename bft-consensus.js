const Blockchain = require('./blockchain');
const Block = require('./blockchain').Block; // Import Block class
const EC = require('elliptic').ec;
const ec = new EC('secp256k1'); // Algorithm used in Bitcoin

class BFTNode {
    constructor (id, blockchain) {
        this.id = id;
        this.blockchain = blockchain;
        this.peers = [];
        this.pendingBlocks = [];
        this.receivedBlocks = new Set(); // Track received blocks to avoid re-processing
        this.keyPair = ec.genKeyPair(); // Generate a new key pair for this node
    }

    connectPeer(peer) {
        this.peers.push(peer);
    }

    proposeBlock(data) {
        const newBlock = new Block(
            this.blockchain.chain.length,
            new Date().toISOString(),
            data,
            this.blockchain.getLatestBlock().hash
        );

        this.signBlock(newBlock); // Sign the block

        this.pendingBlocks.push(newBlock);
        this.broadcastProposal(newBlock);
    }

    receiveProposal(block) {
        const blockHash = block.hash;
        if (this.receivedBlocks.has(blockHash)) {
            return; // Block already received and processed
        }
        this.receivedBlocks.add(blockHash);

        if (this.isValidBlock(block)) {
            this.pendingBlocks.push(block);
            this.broadcastProposal(block);
        }
    }

    isValidBlock(block) {
        const previousBlock = this.blockchain.getLatestBlock();
        if (block.previousHash !== previousBlock.hash) {
            return false;
        }
        if (block.hash !== block.calculateHash()) {
            return false;
        }
        return true;
    }

    signBlock(block) {
        const hash = block.calculateHash();
        const sig = this.keyPair.sign(hash);
        block.signature = sig.toDER('hex');
    }

    broadcastProposal(block) {
        this.peers.forEach(peer => {
            peer.receiveProposal(block);
        });
    }

    reachConsensus() {
        const validBlocks = this.pendingBlocks.filter(block => this.isValidBlock(block));
        if (validBlocks.length > (this.peers.length + 1) / 3) {
            const newBlock = validBlocks[0];
            this.blockchain.addBlock(newBlock);
            this.pendingBlocks = [];
            this.broadcastConsensus(newBlock);
        }
    }

    broadcastConsensus(block) {
        this.peers.forEach(peer => {
            peer.receiveConsensus(block);
        });
    }

    receiveConsensus(block) {
        const blockHash = block.hash;
        if (this.receivedBlocks.has(blockHash)) {
            return; // Block already received and processed
        }
        this.receivedBlocks.add(blockHash);

        if (this.isValidBlock(block)) {
            this.blockchain.addBlock(block);
        }
    }
}

module.exports = BFTNode;
