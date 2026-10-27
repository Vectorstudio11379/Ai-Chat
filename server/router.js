const PROVIDER_CONFIGS = {
  groq: {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['qwen-2.5-coder-32b', 'llama-3.3-70b-versatile', 'llama3-70b-8192'],
    defaultModel: 'qwen-2.5-coder-32b',
    speed: '320 t/s',
  },
  cerebras: {
    name: 'Cerebras',
    envKey: 'CEREBRAS_API_KEY',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    models: ['llama-3.3-70b', 'llama3.1-70b'],
    defaultModel: 'llama-3.3-70b',
    speed: '450 t/s',
  },
  gemini: {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-lite'],
    defaultModel: 'gemini-2.0-flash',
    speed: '220 t/s',
  },
};

export function createRouter({ env = process.env, fetchFn = globalThis.fetch } = {}) {
  function getProviderStatus() {
    const status = {};
    for (const [key, cfg] of Object.entries(PROVIDER_CONFIGS)) {
      const apiKey = env[cfg.envKey];
      status[key] = {
        name: cfg.name,
        available: Boolean(apiKey && apiKey.trim().length > 0),
        models: cfg.models,
        defaultModel: cfg.defaultModel,
        speed: cfg.speed,
      };
    }
    return status;
  }

  function getAvailableProviders() {
    return Object.entries(PROVIDER_CONFIGS)
      .filter(([_, cfg]) => Boolean(env[cfg.envKey] && env[cfg.envKey].trim().length > 0))
      .map(([key, cfg]) => ({ id: key, ...cfg }));
  }

  async function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const body = req.body;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request: Missing or empty messages array' }));
      return;
    }

    const available = getAvailableProviders();
    if (available.length === 0) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'No active AI providers found. Please configure GROQ_API_KEY, CEREBRAS_API_KEY, or GEMINI_API_KEY in environment variables.'
      }));
      return;
    }

    const requestedModel = (body.model || '').toLowerCase();
    // Sort providers so if a requested model matches a specific provider, that provider goes first
    const prioritized = [...available].sort((a, b) => {
      const aHas = a.models.some(m => m.toLowerCase().includes(requestedModel));
      const bHas = b.models.some(m => m.toLowerCase().includes(requestedModel));
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });

    let lastError = null;

    for (const provider of prioritized) {
      const apiKey = env[provider.envKey];
      const modelToUse = provider.models.includes(requestedModel) ? requestedModel : provider.defaultModel;

      const payload = {
        model: modelToUse,
        messages: body.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        })),
        max_tokens: body.max_tokens || 4096,
        stream: true,
      };

      try {
        const upstreamRes = await fetchFn(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify(payload),
        });

        // Failover on rate limit (429) or temporary server error (500, 502, 503)
        if (upstreamRes.status === 429 || upstreamRes.status >= 500) {
          const errText = await upstreamRes.text().catch(() => '');
          lastError = new Error(`Provider ${provider.name} returned ${upstreamRes.status}: ${errText}`);
          console.warn(`[Failover Router] ${provider.name} failed (${upstreamRes.status}). Trying next in chain...`);
          continue;
        }

        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text().catch(() => '');
          lastError = new Error(`Provider ${provider.name} returned ${upstreamRes.status}: ${errText}`);
          continue;
        }

        // Successfully connected to upstream provider! Stream response.
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Provider-Used': provider.name,
          'X-Model-Used': modelToUse,
        });

        if (upstreamRes.body && typeof upstreamRes.body.getReader === 'function') {
          const reader = upstreamRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } else if (upstreamRes.body && typeof upstreamRes.body.on === 'function') {
          await new Promise((resolve, reject) => {
            upstreamRes.body.on('data', chunk => res.write(chunk));
            upstreamRes.body.on('end', resolve);
            upstreamRes.body.on('error', reject);
          });
        }

        res.end();
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[Failover Router] Exception reaching ${provider.name}:`, err.message);
      }
    }

    // If all providers failed
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'All configured AI providers failed or were rate-limited.',
      details: lastError ? lastError.message : 'Unknown error'
    }));
  }

  return {
    getProviderStatus,
    getAvailableProviders,
    handleRequest,
  };
}
