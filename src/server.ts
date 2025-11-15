import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import os from 'os';
import compression from 'compression';
import selfsigned from 'selfsigned';
import { Request, Response, NextFunction } from 'express';


export function startServer(
  root: string,
  port: number,
  onReady: (url: string | { localhost: string; network: string }) => void,
  debounceTime: number = 5,
  useHttps: boolean = false,
  certPath?: string,
  keyPath?: string
) {
  const app = express();
  let server: http.Server | https.Server;

  // Get local IP address
  const getLocalIP = (): string => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  };

  if (useHttps) {
    let options: { key: string | Buffer; cert: string | Buffer };
    // If user provided existing cert/key files, try to use them
    try {
      if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        options = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        };
        console.log('Using TLS certificate from provided paths.');
      } else {
        // Generate self-signed certificate (includes localhost and local IP as SAN)
        const attrs = [{ name: 'commonName', value: 'localhost' }];
        const localIP = (() => {
          const interfaces = os.networkInterfaces();
          for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]!) {
              if (iface.family === 'IPv4' && !iface.internal) return iface.address;
            }
          }
          return '127.0.0.1';
        })();
        const altNames: any[] = [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' }
        ];
        try {
          // add local IP as IP altName if available
          if (localIP && localIP !== '127.0.0.1') altNames.push({ type: 7, ip: localIP });
        } catch (e) {}

        const pems = selfsigned.generate(attrs, { days: 365, extensions: [{ name: 'subjectAltName', altNames }] });
        options = { key: pems.private, cert: pems.cert };

        // If paths provided but files missing, attempt to write generated certs for user convenience
        try {
          if (certPath && keyPath) {
            const certDir = path.dirname(certPath);
            if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
            fs.writeFileSync(certPath, pems.cert);
            fs.writeFileSync(keyPath, pems.private);
            console.log('Generated self-signed certificate and saved to provided paths.');
          }
        } catch (e) {
          console.warn('Failed to save generated certificates to disk:', e);
        }
      }
    } catch (e) {
      console.warn('Error while preparing TLS certificates, falling back to generated self-signed.', e);
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      const pems = selfsigned.generate(attrs, { days: 365 });
      options = { key: pems.private, cert: pems.cert };
    }

    server = https.createServer(options, app);
  } else {
    server = http.createServer(app);
  }

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
      const protocol = useHttps ? 'wss' : 'ws';
      html = html.replace(
        '</body>',
        `<script>
          const ws = new WebSocket('${protocol}://localhost:${port}');
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
    interval: 10,
    binaryInterval: 10
  }).on('all', (event, path) => {
    if (path.includes('node_modules') || path.startsWith('.') || path.includes('~') || path.endsWith('.tmp')) {
      return;
    }
    broadcast('reload');
  });

  server.listen(port, '0.0.0.0', () => {
    const protocol = useHttps ? 'https' : 'http';
    const localIP = getLocalIP();
    const localhostUrl = `${protocol}://localhost:${port}`;
    const networkUrl = `${protocol}://${localIP}:${port}`;
    console.log(`🚀 Server running at:`);
    console.log(`   Local: ${localhostUrl}`);
    console.log(`   Network: ${networkUrl}`);
    onReady({ localhost: localhostUrl, network: networkUrl });
  });

  return () => server.close();
}
