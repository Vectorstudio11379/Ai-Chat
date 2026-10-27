import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { createSyncServer } from '../server/sync-server.js';
import { createStore } from '../server/db.js';

describe('Unified Server Integration', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const mockRouter = {
      getProviderStatus: () => ({
        groq: { available: true, speed: '320 t/s', models: ['qwen-2.5-coder-32b'] },
        cerebras: { available: true, speed: '450 t/s', models: ['llama-3.3-70b'] },
        gemini: { available: false },
      }),
      handleRequest: async (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ routed: true, path: req.url }));
      }
    };

    server = createSyncServer({
      store: createStore(),
      pwaDir: path.resolve(process.cwd(), 'pwa'),
      router: mockRouter,
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('serves static PWA on GET / with 200 OK and text/html', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('exposes GET /api/providers returning live quota status', async () => {
    const res = await fetch(`${baseUrl}/api/providers`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.providers).toBeDefined();
    expect(data.providers.groq.available).toBe(true);
  });

  it('routes POST /v1/messages without HTTP 405 error', async () => {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.routed).toBe(true);
  });

  it('routes POST /v1/chat/completions without HTTP 405 error', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.routed).toBe(true);
  });

  it('maintains chat sync endpoints on /api/sync/chats', async () => {
    const saveRes = await fetch(`${baseUrl}/api/sync/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Passphrase': 'my-secret-passphrase',
      },
      body: JSON.stringify({
        id: 'chat-test-1',
        title: 'Unified Test Chat',
        messages: [{ role: 'user', content: 'Hello unified world' }]
      })
    });
    expect(saveRes.status).toBe(200);

    const listRes = await fetch(`${baseUrl}/api/sync/chats`, {
      headers: {
        'X-Sync-Passphrase': 'my-secret-passphrase',
      }
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.chats.length).toBeGreaterThan(0);
    expect(listData.chats[0].id).toBe('chat-test-1');
  });
});
