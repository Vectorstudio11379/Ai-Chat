import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { createSyncServer, hashPassphrase } from '../server/sync-server.js';
import { createStore } from '../server/db.js';

describe('Cross-Device Chat Sync API', () => {
  let server;
  let baseUrl;
  let port;

  beforeAll(async () => {
    const store = createStore(':memory:');
    const pwaDir = path.resolve(process.cwd(), 'pwa');
    server = createSyncServer({ store, pwaDir });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', service: 'freellmapi-sync' });
  });

  it('GET /api/sync/chats rejects request without X-Sync-Passphrase', async () => {
    const res = await fetch(`${baseUrl}/api/sync/chats`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized: Missing or invalid X-Sync-Passphrase header');
  });

  it('POST /api/sync/chats rejects request without valid body', async () => {
    const res = await fetch(`${baseUrl}/api/sync/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Passphrase': 'my-secret-passphrase',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Bad Request: Chat object must have id and messages array');
  });

  it('POST and GET /api/sync/chats successfully saves and retrieves sessions', async () => {
    const passphrase = 'user-device-passphrase-123';
    const chatSession = {
      id: 'session-abc-123',
      title: 'Python Binary Search Discussion',
      messages: [
        { role: 'user', content: 'Write binary search in Python', timestamp: 1700000000 },
        { role: 'assistant', content: 'def binary_search(arr, target): ...', timestamp: 1700000010 }
      ],
      updatedAt: Date.now(),
    };

    // Save session
    const saveRes = await fetch(`${baseUrl}/api/sync/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Passphrase': passphrase,
      },
      body: JSON.stringify(chatSession),
    });
    expect(saveRes.status).toBe(200);
    const saveBody = await saveRes.json();
    expect(saveBody.success).toBe(true);

    // Retrieve sessions with matching passphrase
    const getRes = await fetch(`${baseUrl}/api/sync/chats`, {
      headers: {
        'X-Sync-Passphrase': passphrase,
      },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(Array.isArray(getBody.chats)).toBe(true);
    expect(getBody.chats.length).toBe(1);
    expect(getBody.chats[0].id).toBe('session-abc-123');
    expect(getBody.chats[0].title).toBe('Python Binary Search Discussion');
    expect(getBody.chats[0].messages.length).toBe(2);

    // Retrieve with DIFFERENT passphrase returns empty array (strict isolation)
    const otherRes = await fetch(`${baseUrl}/api/sync/chats`, {
      headers: {
        'X-Sync-Passphrase': 'completely-different-passphrase',
      },
    });
    expect(otherRes.status).toBe(200);
    const otherBody = await otherRes.json();
    expect(otherBody.chats).toEqual([]);
  });

  it('DELETE /api/sync/chats/:id deletes the specified chat', async () => {
    const passphrase = 'user-device-passphrase-123';
    const delRes = await fetch(`${baseUrl}/api/sync/chats/session-abc-123`, {
      method: 'DELETE',
      headers: {
        'X-Sync-Passphrase': passphrase,
      },
    });
    expect(delRes.status).toBe(200);

    const getRes = await fetch(`${baseUrl}/api/sync/chats`, {
      headers: {
        'X-Sync-Passphrase': passphrase,
      },
    });
    const getBody = await getRes.json();
    expect(getBody.chats.find(c => c.id === 'session-abc-123')).toBeUndefined();
  });

  // Task 4: Static PWA Serving Tests
  it('GET / serves pwa/index.html with text/html', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('FreeLLM Code');
  });

  it('GET /manifest.webmanifest serves PWA manifest with application/manifest+json', async () => {
    const res = await fetch(`${baseUrl}/manifest.webmanifest`);
    expect(res.status).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBe('FreeLLM Code');
  });

  it('GET /sw.js serves service worker with application/javascript', async () => {
    const res = await fetch(`${baseUrl}/sw.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    const sw = await res.text();
    expect(sw).toContain('addEventListener');
  });
});
