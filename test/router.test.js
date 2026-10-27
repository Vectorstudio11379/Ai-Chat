import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '../server/router.js';

describe('Router Multi-Provider & Env Key Seeding', () => {
  it('initializes configured providers from environment', () => {
    const router = createRouter({
      env: {
        GROQ_API_KEY: 'gsk_test123',
        CEREBRAS_API_KEY: 'csk_test456',
      }
    });
    const status = router.getProviderStatus();
    expect(status.groq.available).toBe(true);
    expect(status.cerebras.available).toBe(true);
    expect(status.gemini.available).toBe(false);
  });

  it('reports provider models and default routing priority', () => {
    const router = createRouter({
      env: {
        GROQ_API_KEY: 'gsk_test123',
      }
    });
    const status = router.getProviderStatus();
    expect(status.groq.models).toContain('qwen-2.5-coder-32b');
  });

  it('returns 400 Bad Request when request body is missing or invalid', async () => {
    const router = createRouter({ env: { GROQ_API_KEY: 'gsk_test' } });
    let statusCode = 0;
    let endPayload = '';

    const req = {
      method: 'POST',
      url: '/v1/messages',
      body: null,
    };
    const res = {
      writeHead: (code, headers) => { statusCode = code; },
      end: (data) => { endPayload = data; },
      setHeader: () => {},
    };

    await router.handleRequest(req, res);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(endPayload);
    expect(parsed.error).toBeDefined();
  });

  it('fails over to next provider when primary returns HTTP 429', async () => {
    const fetchMock = vi.fn();
    // First call (Groq) returns 429
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    });
    // Second call (Cerebras) returns 200 with streaming body
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return {
                done: false,
                value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\\n\\n')
              };
            }
          };
        }
      }
    });

    const router = createRouter({
      env: {
        GROQ_API_KEY: 'gsk_test',
        CEREBRAS_API_KEY: 'csk_test',
      },
      fetchFn: fetchMock
    });

    let statusCode = 0;
    let writtenChunks = '';
    const req = {
      method: 'POST',
      url: '/v1/messages',
      body: {
        model: 'auto',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true
      }
    };
    const res = {
      writeHead: (code) => { statusCode = code; },
      write: (chunk) => { writtenChunks += chunk; },
      end: () => {},
      setHeader: () => {},
    };

    await router.handleRequest(req, res);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(statusCode).toBe(200);
  });
});
