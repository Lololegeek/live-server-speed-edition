import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import http from 'http';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';


export function startServer(
  root: string,
  port: number,
  onReady: (url: string) => void,
  debounceTime: number = 200
) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(compression());

  const broadcast = (msg: string) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  };

  app.use((req: Request, res: Response, next: NextFunction) => {
    const filePath = path.join(root, req.url === '/' ? '/index.html' : req.url);
    if (fs.existsSync(filePath) && filePath.endsWith('.html')) {
      let html = fs.readFileSync(filePath, 'utf-8');
      html = html.replace(
        '</body>',
        `<script>
          const ws = new WebSocket('ws://localhost:${port}');
          ws.onmessage = () => {
            console.log('🔄 Reload triggered');
            location.reload();
          };
        </script></body>`
      );
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
    } else {
      next();
    }
  });

  app.use(express.static(root));

  chokidar.watch(root, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: debounceTime,
      pollInterval: 1
    },
    usePolling: true,
    interval: 100,
    binaryInterval: 100
  }).on('all', (event, path) => {
    if (path.includes('node_modules') || path.startsWith('.') || path.includes('~') || path.endsWith('.tmp')) {
      return;
    }
    broadcast('reload');
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`🚀 Server running at ${url}`);
    onReady(url);
  });

  return () => server.close();
}
