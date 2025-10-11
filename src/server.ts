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
  onReady: (url: string) => void
) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Compression for faster delivery
  app.use(compression());

  // Broadcast reload message to all connected clients
  const broadcast = (msg: string) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  };

  // Inject reload script into HTML files
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

  // Serve static assets
  app.use(express.static(root));

  // Watch for file changes and trigger reload
  chokidar.watch(root, {
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
