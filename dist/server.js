"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const chokidar_1 = __importDefault(require("chokidar"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const compression_1 = __importDefault(require("compression"));
function startServer(root, port, onReady) {
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const wss = new ws_1.WebSocketServer({ server });
    // Compression for faster delivery
    app.use((0, compression_1.default)());
    // Broadcast reload message to all connected clients
    const broadcast = (msg) => {
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN)
                client.send(msg);
        });
    };
    // Inject reload script into HTML files
    app.use((req, res, next) => {
        const filePath = path_1.default.join(root, req.url === '/' ? '/index.html' : req.url);
        if (fs_1.default.existsSync(filePath) && filePath.endsWith('.html')) {
            let html = fs_1.default.readFileSync(filePath, 'utf-8');
            html = html.replace('</body>', `<script>
          const ws = new WebSocket('ws://localhost:${port}');
          ws.onmessage = () => {
            console.log('🔄 Reload triggered');
            location.reload();
          };
        </script></body>`);
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-store');
            res.send(html);
        }
        else {
            next();
        }
    });
    // Serve static assets
    app.use(express_1.default.static(root));
    // Watch for file changes and trigger reload
    chokidar_1.default.watch(root, {
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 20,
            pollInterval: 1
        },
        usePolling: true,
        interval: 100,
        binaryInterval: 100
    }).on('all', (event, path) => {
        // Ignore temporary files and node_modules
        if (path.includes('node_modules') || path.startsWith('.') || path.includes('~') || path.endsWith('.tmp')) {
            return;
        }
        broadcast('reload');
    });
    // Start server
    server.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`🚀 Server running at ${url}`);
        onReady(url);
    });
    return () => server.close();
}
