const { Blockchain } = require('./blockchain'); // Corrected import statement
const BFTNode = require('./bft-consensus');

const blockchain = new Blockchain();
const node1 = new BFTNode(1, blockchain);
const node2 = new BFTNode(2, blockchain);
const node3 = new BFTNode(3, blockchain);

node1.connectPeer(node2);
node1.connectPeer(node3);
node2.connectPeer(node1);
node2.connectPeer(node3);
node3.connectPeer(node1);
node3.connectPeer(node2);

// Function to propose a new block with random data
function proposeNewBlock(node) {
    const data = {
        from: `User${Math.floor(Math.random() * 100)}`,
        to: `User${Math.floor(Math.random() * 100)}`,
        amount: Math.floor(Math.random() * 100)
    };
    node.proposeBlock(data);
}

// Set interval to propose a new block every 5 seconds
setInterval(() => {
    proposeNewBlock(node1);
    node1.reachConsensus();
    node2.reachConsensus();
    node3.reachConsensus();
    console.log('Blockchain valid:', blockchain.isChainValid());
    console.log(JSON.stringify(blockchain, null, 2));
}, 5000);
