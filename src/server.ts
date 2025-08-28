import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import http from 'http';

export function startServer(root: string, port: number, onReady: (url: string) => void) {
  const app = express();
  const server = http.createServer(app);

  const wss = new WebSocketServer({ server });
  const broadcast = (msg: string) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  };

  app.use(express.static(root));

  app.use((req: Request, res: Response, next) => {
    const send = res.send;
    res.send = function (body: any) {
      if (typeof body === 'string' && body.includes('</body>')) {
        body = body.replace(
          '</body>',
          `<script>
            const ws = new WebSocket('ws://localhost:${port}');
            ws.onmessage = () => location.reload();
          </script></body>`
        );
      }
      return send.call(this, body);
    };
    next();
  });

  chokidar.watch(root, { ignoreInitial: true }).on('all', () => {
    broadcast('reload');
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Server running at ${url}`);
    onReady(url);
  });

  return () => server.close();
}
