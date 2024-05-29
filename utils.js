const os = require('os');
const net = require('net');

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function findAvailablePort(startPort, callback) {
    const port = startPort;
    const server = net.createServer();

    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            findAvailablePort(port + 1, callback);
        } else {
            callback(err, null);
        }
    });

    server.once('listening', () => {
        server.close(() => {
            callback(null, port);
        });
    });

    server.listen(port);
}

module.exports = {
    getLocalIpAddress,
    findAvailablePort,
};
