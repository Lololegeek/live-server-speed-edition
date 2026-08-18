import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import selfsigned from 'selfsigned';
import { Request, Response, NextFunction } from 'express';

export type ServerLogLevel = 'info' | 'warn' | 'error';

export interface ServerStartOptions {
  host?: string;
  spaFallback?: boolean;
  usePolling?: boolean;
  ignoredPaths?: string[];
  reloadExtensions?: string[];
  logger?: (message: string, level?: ServerLogLevel) => void;
}

function normaliseExtension(extension: string): string {
  return extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}

export function startServer(
  root: string,
  port: number,
  onReady: (url: string) => void,
  debounceTime: number = 50,
  useHttps: boolean = false,
  certPath?: string,
  keyPath?: string,
  options: ServerStartOptions = {}
) {
  const logger = options.logger ?? ((message: string, level: ServerLogLevel = 'info') => {
    if (level === 'error') console.error(message);
    else if (level === 'warn') console.warn(message);
    else console.log(message);
  });
  const resolvedRoot = path.resolve(root);
  const host = options.host?.trim() || '0.0.0.0';
  const spaFallback = options.spaFallback ?? true;
  const reloadExtensions = new Set((options.reloadExtensions ?? []).map(normaliseExtension));
  const ignoredPaths = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/*.tmp',
    '**/*~',
    ...(options.ignoredPaths ?? [])
  ];

  const app = express();
  let server: http.Server | https.Server;

  if (useHttps) {
    let certificateOptions: { key: string | Buffer; cert: string | Buffer };
    if (certPath && keyPath) {
      certificateOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    } else {
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      const pems = selfsigned.generate(attrs, { days: 365 });
      certificateOptions = { key: pems.private, cert: pems.cert };
    }
    server = https.createServer(certificateOptions, app);
  } else {
    server = http.createServer(app);
  }

  const wss = new WebSocketServer({ server });
  const protocol = useHttps ? 'https' : 'http';

  wss.on('connection', (_socket, request) => {
    logger(`WebSocket connected: ${request.url || '/'}`);
  });

  const broadcast = (message: string) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  };

  const isInsideRoot = (candidate: string): boolean => {
    const relative = path.relative(resolvedRoot, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  };

  const injectReloadClient = (html: string): string => {
    const reloadClient = `<script>
      (() => {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(protocol + '//' + location.host + '/__live_reload');
        socket.onmessage = () => location.reload();
        socket.onclose = () => setTimeout(() => location.reload(), 1500);
      })();
    </script>`;
    return html.includes('</body>') ? html.replace('</body>', `${reloadClient}</body>`) : `${html}${reloadClient}`;
  };

  const sendHtml = (filePath: string, res: Response) => {
    try {
      const html = injectReloadClient(fs.readFileSync(filePath, 'utf8'));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
      logger(`GET ${path.relative(resolvedRoot, filePath) || 'index.html'}`);
    } catch (error) {
      logger(`Unable to read ${filePath}: ${String(error)}`, 'error');
      res.status(500).send('Unable to read the requested HTML file.');
    }
  };

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.url.startsWith('/__live_reload')) logger(`${req.method} ${req.url}`);
    next();
  });
  app.use(compression());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestPath = decodeURIComponent((req.originalUrl || '/').split('?')[0]);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^[/\\]+/, '');
    const filePath = path.resolve(resolvedRoot, relativePath);

    if (!isInsideRoot(filePath)) {
      logger(`Blocked path traversal attempt: ${requestPath}`, 'warn');
      res.status(403).send('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && filePath.toLowerCase().endsWith('.html')) {
      sendHtml(filePath, res);
      return;
    }
    next();
  });

  app.use(express.static(resolvedRoot, { etag: true, lastModified: true }));

  if (spaFallback) {
    const indexPath = path.join(resolvedRoot, 'index.html');
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      const requestPath = decodeURIComponent((req.originalUrl || '/').split('?')[0]);
      const acceptsHtml = String(req.headers.accept || '').includes('text/html');
      const looksLikeAsset = path.extname(requestPath) !== '';
      if (acceptsHtml && !looksLikeAsset && fs.existsSync(indexPath)) {
        sendHtml(indexPath, res);
        return;
      }
      next();
    });
  }

  const watcher = chokidar.watch(resolvedRoot, {
    ignoreInitial: true,
    ignored: ignoredPaths,
    awaitWriteFinish: {
      stabilityThreshold: Math.max(50, debounceTime),
      pollInterval: 25
    },
    usePolling: options.usePolling ?? false,
    interval: 100,
    binaryInterval: 100
  }).on('all', (event, changedPath) => {
    const extension = path.extname(changedPath).toLowerCase();
    if (reloadExtensions.size > 0 && !reloadExtensions.has(extension)) return;
    logger(`${event}: ${path.relative(resolvedRoot, changedPath)}`);
    broadcast('reload');
  });

  server.on('error', (error) => logger(`Server error: ${String(error)}`, 'error'));
  server.listen(port, host, () => {
    const url = `${protocol}://localhost:${port}`;
    logger(`Server running at ${url} (bound to ${host})`);
    onReady(url);
  });

  return () => {
    watcher.close();
    wss.close();
    server.close();
    logger('Server stopped.');
  };
}
