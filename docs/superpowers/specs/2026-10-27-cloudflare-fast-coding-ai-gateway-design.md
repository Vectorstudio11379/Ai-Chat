# Cloudflare Fast Coding AI Gateway Design

## 1. Intent and the Why
The goal is to provide a very fast, zero-cost cloud API for AI-assisted coding that can be called just like Claude AI (e.g. from code editors, tools like Continue/Cursor, or custom scripts).

Free-tier container platforms like Render have severe compute limits (512 MB RAM, no GPU) and go to sleep after 15 minutes of inactivity, causing 30–50 second cold-start pauses on subsequent requests. To achieve blazing-fast responses and 100% free hosting without cold-start lag, we build an edge gateway on Cloudflare Workers backed by Groq's free ultra-fast LPU inference (streaming coding models at 300+ tokens/second).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Claude-Compatible API:** Expose `POST /v1/messages` compatible with Claude's message payload format and Server-Sent Events (SSE) streaming output.
- **Zero Cost:** Run entirely on free-tier services (Cloudflare Workers free tier: 100,000 requests/day; Groq free tier).
- **Blazing Speed:** Start streaming code completions in under 300ms, outputting code at 300+ tokens per second.
- **Zero Cold-Start:** Global edge execution on Cloudflare without sleep/wake-up delays.
- **Easy Deployment:** Single-command setup using Cloudflare Wrangler CLI.
- **Verification Support:** Include a lightweight local test runner and curl verification instructions.

### Non-Goals
- Hosting or executing model weights on the worker itself (Cloudflare Workers has a 128 MB RAM limit per execution, not intended for local weight execution).
- User authentication, user billing, or multi-tenant user accounts.
- Fine-tuning or retraining model weights.

### Anti-Goals
- Do not introduce cold-start latency (no sleeping container hosts).
- Do not require paid credit cards or paid cloud instances.

---

## 3. Constraints
- **Cloudflare Workers Free Limits:** 100,000 requests per day, 10ms CPU time per request (network I/O wait during streaming does not count against CPU time limits).
- **Groq Free Tier:** Rate limits according to Groq's free tier quotas (e.g., generous tokens-per-minute and requests-per-minute suitable for single-user or small team coding assistance).
- **Schema Compatibility:** Request body must accept Anthropic Claude format (`messages`, `model`, `max_tokens`, `system`, `stream`, `temperature`) and translate seamlessly to the underlying provider.

---

## 4. Approaches Considered

1. **Cloudflare Workers (Edge Gateway) + Groq [SELECTED]**
   - *Why chosen:* Provides global edge routing with 0ms cold starts, generous 100k free requests daily, and taps into Groq's 300+ token/s coding models (e.g., Qwen 2.5 Coder 32B). Completely eliminates Render's idle freeze.

2. **Render / Koyeb Container + Groq [REJECTED]**
   - *Why rejected:* Render's free tier container sleeps after 15 minutes of inactivity and takes 30–50 seconds to boot on subsequent calls, breaking the requirement for a "very fast" coding assistant.

3. **Hugging Face Spaces Free CPU (Self-Hosted Weights) [REJECTED]**
   - *Why rejected:* Running quantized models on free CPU yields only 5–15 tokens per second and requires complex environment setups, which is far too slow for real-time coding flow.

---

## 5. Architectural & Technical Decisions

- **Runtime / Language:** TypeScript on Cloudflare Workers runtime.
- **Project Tooling:** Cloudflare Wrangler (`wrangler`).
- **Core Endpoints:**
  - `GET /` & `GET /health`: Health check and status indicator.
  - `POST /v1/messages`: Claude-compatible endpoint translating Anthropic request payloads into Groq chat completion format and proxying/translating SSE streams back in Claude SSE event format (`message_start`, `content_block_start`, `content_block_delta`, `message_delta`, `message_stop`).
  - `POST /v1/chat/completions`: Optional OpenAI-compatible pass-through for editors/extensions that prefer OpenAI format.
- **Default Coding Model:** `qwen-2.5-coder-32b` or `llama-3.3-70b-versatile` (configurable via environment variable `DEFAULT_MODEL`).
- **Secrets & Configuration:**
  - `GROQ_API_KEY`: Cloudflare secret or environment variable.
  - Optional `API_KEY_PROTECTION`: Simple Bearer token header check so unauthorized users cannot spam your personal Groq quota.

---

## 6. What's Left to the Builder
- Detailed translation logic between Anthropic SSE event frames and OpenAI/Groq SSE frames.
- Implementation of `src/index.ts` and `wrangler.toml`.
- Local test script (`scripts/test-request.sh` or a node test script).
- Step-by-step README explaining how to obtain a free Groq API key and deploy with `wrangler deploy`.
