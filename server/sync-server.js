import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createStore } from './db.js';
import { createRouter } from './router.js';

export function hashPassphrase(passphrase) {
  if (!passphrase) return '';
  return crypto.createHash('sha256').update(passphrase.trim()).digest('hex');
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Passphrase, Authorization, x-api-key');
}

export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data || !data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function tryServeStatic(pathname, pwaDir, res) {
  if (!pwaDir) return false;

  let relativePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(pwaDir, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    return true;
  }

  return false;
}

export function createSyncServer({ store = createStore(), pwaDir = null, router = null } = {}) {
  // Default pwaDir to ./pwa if not passed
  const resolvedPwaDir = pwaDir || path.resolve(process.cwd(), 'pwa');
  const activeRouter = router || createRouter();

  const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Health check
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'freellmapi-unified-studio' }));
      return;
    }

    // Provider status endpoint for Developer Studio telemetry
    if (pathname === '/api/providers' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ providers: activeRouter.getProviderStatus() }));
      return;
    }

    // AI Proxy Endpoints: /v1/messages and /v1/chat/completions
    if ((pathname === '/v1/messages' || pathname === '/v1/chat/completions') && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        req.body = body;
        await activeRouter.handleRequest(req, res);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Invalid JSON body' }));
      }
      return;
    }

    // Sync API endpoints: Require X-Sync-Passphrase
    if (pathname.startsWith('/api/sync/chats')) {
      const rawPassphrase = req.headers['x-sync-passphrase'];
      if (!rawPassphrase || typeof rawPassphrase !== 'string' || !rawPassphrase.trim()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid X-Sync-Passphrase header' }));
        return;
      }

      const passphraseHash = hashPassphrase(rawPassphrase);

      // GET /api/sync/chats
      if (pathname === '/api/sync/chats' && req.method === 'GET') {
        const chats = store.list(passphraseHash);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ chats }));
        return;
      }

      // POST /api/sync/chats
      if (pathname === '/api/sync/chats' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          if (!body || !body.id || !Array.isArray(body.messages)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Request: Chat object must have id and messages array' }));
            return;
          }

          const saved = store.upsert(passphraseHash, {
            id: body.id,
            title: body.title || 'Untitled Chat',
            messages: body.messages,
            updatedAt: body.updatedAt || Date.now(),
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, chat: saved }));
          return;
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Invalid request body' }));
          return;
        }
      }

      // DELETE /api/sync/chats/:id
      const matchDelete = pathname.match(/^\/api\/sync\/chats\/([^/]+)$/);
      if (matchDelete && req.method === 'DELETE') {
        const chatId = decodeURIComponent(matchDelete[1]);
        const deleted = store.delete(passphraseHash, chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deleted }));
        return;
      }
    }

    // Serve PWA Static Assets on GET
    if (req.method === 'GET' && tryServeStatic(pathname, resolvedPwaDir, res)) {
      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

// When run directly as standalone service
if (process.argv[1] && process.argv[1].endsWith('sync-server.js')) {
  const port = process.env.PORT || 3001;
  const storagePath = process.env.DATA_PATH || path.resolve(process.cwd(), 'data/chats.json');
  const store = createStore(storagePath);
  const server = createSyncServer({ store });

  server.listen(port, '0.0.0.0', () => {
    console.log(`FreeLLMAPI Unified Developer Studio Server running on port ${port}`);
    console.log(`Data stored at: ${storagePath}`);
    console.log(`Providers loaded from environment.`);
  });
}
