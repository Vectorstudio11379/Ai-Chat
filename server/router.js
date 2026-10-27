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
  openrouter: {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'deepseek/deepseek-r1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-coder-32b-instruct:free'
    ],
    defaultModel: 'deepseek/deepseek-r1:free',
    speed: 'Free Hub',
  },
  cohere: {
    name: 'Cohere',
    envKey: 'COHERE_API_KEY',
    url: 'https://api.cohere.com/v2/chat',
    models: ['command-r-plus-08-2024', 'command-r-08-2024', 'command-light'],
    defaultModel: 'command-r-plus-08-2024',
    speed: '250 t/s',
  },
  gemini: {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    defaultModel: 'gemini-3.8-flash',
    speed: '220 t/s',
  },
};

const MODEL_ALIASES = {
  'gemini-2.0-flash': 'gemini-3.8-flash',
  'gemini-2.0-flash-lite': 'gemini-3.8-flash',
  'gemini-2.0': 'gemini-3.8-flash',
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

  function getAvailableProviders(activeEnv = env) {
    return Object.entries(PROVIDER_CONFIGS)
      .filter(([_, cfg]) => Boolean(activeEnv[cfg.envKey] && activeEnv[cfg.envKey].trim().length > 0))
      .map(([key, cfg]) => ({ id: key, ...cfg }));
  }

  async function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-groq-key, x-cerebras-key, x-gemini-key, x-openrouter-key, x-cohere-key');

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

    // Dynamic key resolution from environment AND client request headers/body
    const activeEnv = { ...env };
    const headers = req.headers || {};
    if (headers['x-groq-key']) activeEnv.GROQ_API_KEY = headers['x-groq-key'];
    if (headers['x-cerebras-key']) activeEnv.CEREBRAS_API_KEY = headers['x-cerebras-key'];
    if (headers['x-gemini-key']) activeEnv.GEMINI_API_KEY = headers['x-gemini-key'];
    if (headers['x-openrouter-key']) activeEnv.OPENROUTER_API_KEY = headers['x-openrouter-key'];
    if (headers['x-cohere-key']) activeEnv.COHERE_API_KEY = headers['x-cohere-key'];

    const genericKey = (headers['x-api-key'] || (headers['authorization'] || '').replace(/^Bearer\s+/i, '') || (body.apiKey || '')).trim();
    if (genericKey) {
      if (genericKey.startsWith('gsk_')) activeEnv.GROQ_API_KEY = genericKey;
      else if (genericKey.startsWith('csk_')) activeEnv.CEREBRAS_API_KEY = genericKey;
      else if (genericKey.startsWith('AIzaSy')) activeEnv.GEMINI_API_KEY = genericKey;
      else if (genericKey.startsWith('sk-or-')) activeEnv.OPENROUTER_API_KEY = genericKey;
      else if (!activeEnv.OPENROUTER_API_KEY) activeEnv.OPENROUTER_API_KEY = genericKey;
    }

    let available = getAvailableProviders(activeEnv);

    // If zero API keys are configured, add free keyless AI provider so AI ALWAYS responds!
    if (available.length === 0) {
      available.push({
        id: 'pollinations',
        name: 'Free Tier AI (Keyless)',
        envKey: null,
        url: 'https://text.pollinations.ai/openai',
        models: ['openai', 'gpt-4o-mini', 'qwen-coder'],
        defaultModel: 'openai',
        speed: '180 t/s',
      });
    }

    let requestedModel = (body.model || '').toLowerCase();
    if (MODEL_ALIASES[requestedModel]) {
      requestedModel = MODEL_ALIASES[requestedModel];
    }

    // Prioritize providers based on requested model
    const prioritized = [...available].sort((a, b) => {
      const aHas = a.models.some(m => m.toLowerCase().includes(requestedModel));
      const bHas = b.models.some(m => m.toLowerCase().includes(requestedModel));
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });

    let lastError = null;

    for (const provider of prioritized) {
      const apiKey = provider.envKey ? activeEnv[provider.envKey] : null;
      const modelToUse = provider.models.includes(requestedModel) ? requestedModel : provider.defaultModel;

      const reqHeaders = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        reqHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      if (provider.id === 'openrouter') {
        reqHeaders['HTTP-Referer'] = 'https://freellmapi-studio.onrender.com';
        reqHeaders['X-Title'] = 'FreeLLM Studio';
      }

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
          headers: reqHeaders,
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
