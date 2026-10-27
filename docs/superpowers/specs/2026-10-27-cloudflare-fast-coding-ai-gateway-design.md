# Cloudflare Fast Coding AI Gateway & PWA Design

## 1. Intent and the Why
The goal is to build an ultra-fast, zero-cost AI coding solution that can be:
1. Called directly by code editors, tools, and scripts using the **Anthropic Claude wire format** (`POST /v1/messages`).
2. Installed as a **Progressive Web App (PWA)** on any device (iOS, Android, Windows, Mac) with a **Claude Minimalist** interface for coding assistance on the go.

Cloudflare was selected over Render because Render's free tier sleeps after 15 minutes of inactivity (causing 30–50 second cold-start pauses), whereas Cloudflare runs globally on the edge with **0 ms cold starts**, instant response times, and generous free quotas (100,000 requests/day).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Zero Cold-Start:** Global edge execution on Cloudflare Workers with sub-30ms startup latency.
- **Claude API Compatibility:** Expose `POST /v1/messages` accepting Anthropic messages payloads and streaming Server-Sent Events (SSE) back in Claude's event format.
- **Ultra-Fast Free Inference:** Route coding requests to Groq's high-throughput LPU inference running state-of-the-art coding models (e.g., `qwen-2.5-coder-32b` or `llama-3.3-70b-versatile` at 300+ tokens/second).
- **Installable PWA (Option B - Claude Minimalist):**
  - Served directly from the root path (`/`) of the Worker.
  - Manifest (`manifest.webmanifest`) and Service Worker (`sw.js`) enabling native installation on phones and desktops.
  - Clean conversational UI with markdown formatting, syntax highlighting, and 1-click code copying.
  - Real-time token streaming with model selection indicator.
  - Client-side settings stored in `localStorage` (default endpoint, optional gateway protection key).
- **Single-Command Deploy:** Simple deployment to Cloudflare using Wrangler CLI (`npm run deploy`).
- **End-to-End Testing:** Unit tests for protocol transformation and a CLI test script.

### Non-Goals
- Hosting multi-gigabyte neural network weights directly in memory on Cloudflare (the Worker acts as an intelligent edge gateway).
- Paid tiers, complex authentication databases, or user billing systems.

### Anti-Goals
- Do not introduce cold-start latency (no sleeping containers).
- Do not clutter the interface; adhere to Claude's clean, minimalist layout.

---

## 3. Constraints
- **Cloudflare Workers Free Tier:** 100,000 requests/day, 128 MB RAM per execution, 10ms CPU time (streaming network I/O wait does not count against CPU time).
- **Groq Free Tier:** Standard free-tier rate limits for tokens and requests.
- **PWA Requirements:** Service Worker requires HTTPS (Cloudflare automatically provides free SSL certificates on `*.workers.dev` and custom domains).

---

## 4. Approaches Considered

1. **Cloudflare Workers + Embedded Minimalist PWA [SELECTED]**
   - *Why chosen:* Best-in-class speed (0ms cold start), edge-routed token streaming at 300+ tokens/sec, and a single deploy that serves both the Claude API and the installable PWA app at no cost.
2. **Render Web Service (Container) [REJECTED]**
   - *Why rejected:* Render's free tier puts instances to sleep after 15 minutes of inactivity, introducing a 30–50 second wake-up freeze on the first prompt.
3. **Hugging Face Spaces Free CPU (Self-Hosted Weights) [REJECTED]**
   - *Why rejected:* Generating code on free CPU runs at only 5–15 tokens per second, which is far too sluggish for interactive coding.

---

## 5. Architectural & Technical Decisions

### Edge Architecture
- **Runtime:** Cloudflare Workers (TypeScript / ESM).
- **Project Tooling:** Cloudflare Wrangler (`wrangler`).
- **Endpoints:**
  - `GET /`: Serves the installable Claude Minimalist PWA single-page application.
  - `GET /manifest.webmanifest` & `GET /sw.js`: PWA configuration and service worker.
  - `GET /health`: Health check and diagnostic status.
  - `POST /v1/messages`: Claude-compatible endpoint. Translates Anthropic messages format to Groq format, invokes Groq, and transforms SSE chunks into Anthropic events in real time.
  - `POST /v1/chat/completions`: Optional OpenAI-compatible pass-through.

### PWA UI (Option B - Claude Minimalist)
- **Design Philosophy:** Minimalist dark mode with subtle borders, generous typography, and code-first formatting.
- **Core Elements:**
  - Floating prompt input with multi-line auto-expand.
  - Code blocks with syntax highlighting, language badge, and 1-click "Copy" button.
  - Model selector pill (defaulting to `qwen-2.5-coder-32b`).
  - Slide-out Settings drawer for gateway keys or custom endpoints.
  - Native PWA "Install" button triggered when browser supports installation.

### Configuration & Security
- `GROQ_API_KEY`: Secret configured in Cloudflare environment.
- `GATEWAY_KEY`: Optional secret to protect the endpoint from unauthorized public use if shared.
- `DEFAULT_MODEL`: Configurable environment variable (default: `qwen-2.5-coder-32b`).

---

## 6. What's Left to the Builder
- Detailed TypeScript implementation for protocol translation and SSE stream transformation.
- PWA frontend HTML, CSS, JavaScript, manifest, and service worker.
- Unit tests with Vitest verifying message translation and SSE framing.
- Test script (`scripts/test-client.js`) and step-by-step `README.md`.
