import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createStore } from './db.js';

export function hashPassphrase(passphrase) {
  if (!passphrase) return '';
  return crypto.createHash('sha256').update(passphrase.trim()).digest('hex');
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Passphrase, Authorization');
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
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function createSyncServer({ store = createStore(), pwaDir = null } = {}) {
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
      res.end(JSON.stringify({ status: 'ok', service: 'freellmapi-sync' }));
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

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

// When run directly as standalone service
if (process.argv[1] && process.argv[1].endsWith('sync-server.js')) {
  const port = process.env.SYNC_PORT || process.env.PORT || 3002;
  const storagePath = process.env.DATA_PATH || path.resolve(process.cwd(), 'data/chats.json');
  const store = createStore(storagePath);
  const server = createSyncServer({ store });

  server.listen(port, '0.0.0.0', () => {
    console.log(`FreeLLMAPI Chat Sync Server running on port ${port}`);
    console.log(`Data stored at: ${storagePath}`);
  });
}
