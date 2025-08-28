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
function startServer(root, port, onReady) {
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const wss = new ws_1.WebSocketServer({ server });
    const broadcast = (msg) => {
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN)
                client.send(msg);
        });
    };
    app.use(express_1.default.static(root));
    app.use((req, res, next) => {
        const send = res.send;
        res.send = function (body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', `<script>
            const ws = new WebSocket('ws://localhost:${port}');
            ws.onmessage = () => location.reload();
          </script></body>`);
            }
            return send.call(this, body);
        };
        next();
    });
    chokidar_1.default.watch(root, { ignoreInitial: true }).on('all', () => {
        broadcast('reload');
    });
    server.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`Server running at ${url}`);
        onReady(url);
    });
    return () => server.close();
}
//# sourceMappingURL=server.js.map