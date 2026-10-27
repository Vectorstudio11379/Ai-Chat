# FreeLLMAPI Unified Developer Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a unified FreeLLMAPI Developer Studio web application and backend server that permanently eliminates HTTP 405 errors, prevents Render container resets from wiping provider credentials, replaces the chat UI with the FreeLLMAPI dark workbench design (Option A), and enables instant cross-device sync via a secret passphrase.

**Architecture:** A single Node.js HTTP service (`server/sync-server.js` + `server/router.js`) hosts both the Developer Studio PWA and the AI proxy router from the same origin on Render. Provider keys (Groq, Cerebras, Gemini) are injected from environment variables, eliminating account re-creations upon container spin-downs. The PWA delivers live provider health gauges, streaming token telemetry, and background chat synchronization.

**Tech Stack:** Node.js (v20+), Vanilla HTML5/CSS3/JavaScript (ES modules), Server-Sent Events (SSE), SQLite/JSON sync store, Render Web Service.

**Spec:** [docs/superpowers/specs/2026-10-27-freellmapi-unified-studio-design.md](file:///c:/Users/new/Downloads/Ai%20Model/docs/superpowers/specs/2026-10-27-freellmapi-unified-studio-design.md)

## Global Constraints
- Render Free Tier memory footprint must stay under 100 MB.
- Frontend must make same-origin requests (`window.location.origin`) to eliminate CORS preflight and 405 Method Not Allowed errors.
- Passphrase authentication requires SHA-256 hashing via `X-Sync-Passphrase` header.
- Streaming responses must support both Anthropic Claude wire format (`content_block_delta`) and OpenAI chunk format (`choices[0].delta.content`).
- Provider API keys must be loaded from `process.env` (`GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`) to persist across container restarts.

## Review Focus
1. `POST /v1/messages` with no body or malformed JSON returns 400 Bad Request with a clear JSON error rather than crashing the server.
2. Missing provider keys in `.env` fall back gracefully to remaining configured providers, logging a warning rather than failing silently.
3. Upstream HTTP 429 rate limit triggers immediate automatic retry on the next provider in the chain without dropping the user's connection.
4. Chat synchronization conflict resolution: when two devices write with the same passphrase, the newer `updatedAt` timestamp wins without data loss.
5. Mobile viewport (<768px): collapsible sidebar closes automatically on chat thread selection or overlay click, leaving the full workbench visible.

---

### Task 1: Upstream Router with Multi-Provider Failover & Env Key Seeding

**Files:**
- Create: `server/router.js`
- Test: `test/router.test.js`

**Interfaces:**
- Consumes: `process.env` (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`)
- Produces: `export function createRouter(options)` returning `{ handleRequest(req, res), getProviderStatus() }`

- [ ] **Step 1: Write the failing test**

```javascript
// test/router.test.js
import assert from 'node:assert';
import test from 'node:test';
import { createRouter } from '../server/router.js';

test('router initializes configured providers from environment', () => {
  const router = createRouter({
    env: {
      GROQ_API_KEY: 'gsk_test123',
      CEREBRAS_API_KEY: 'csk_test456',
    }
  });
  const status = router.getProviderStatus();
  assert.equal(status.groq.available, true);
  assert.equal(status.cerebras.available, true);
  assert.equal(status.gemini.available, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/router.test.js`
Expected: FAIL with "Cannot find module '../server/router.js'"

- [ ] **Step 3: Implement `server/router.js`**

Implement `createRouter`:
- Reads `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY` from config/env.
- Maps model requests (`qwen-2.5-coder-32b`, `llama-3.3-70b`, `gemini-2.0-flash`, `claude-3-5-sonnet`) to upstream endpoints.
- If an upstream returns HTTP 429, automatically fails over to the next configured provider in sequence.
- Streams SSE response back to `res` with chunk formatting.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/router.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/router.js test/router.test.js
git commit -m "feat(server): add multi-provider router with automatic failover and env key seeding"
```

---

### Task 2: Unified Server Integration (Static PWA + Sync API + AI Proxy)

**Files:**
- Modify: `server/sync-server.js`
- Test: `test/unified-server.test.js`

**Interfaces:**
- Consumes: `createRouter` from `server/router.js`, `createStore` from `server/db.js`
- Produces: `export function createSyncServer({ store, pwaDir, router })`

- [ ] **Step 1: Write the failing test**

```javascript
// test/unified-server.test.js
import assert from 'node:assert';
import test from 'node:test';
import http from 'node:http';
import { createSyncServer } from '../server/sync-server.js';
import { createStore } from '../server/db.js';

test('unified server responds to GET / with HTML and POST /v1/messages without 405', async () => {
  const server = createSyncServer({
    store: createStore(),
    router: {
      handleRequest: (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ routed: true }));
      }
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  const res = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.routed, true);
  server.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/unified-server.test.js`
Expected: FAIL (returns 404 or fails to route `/v1/messages`)

- [ ] **Step 3: Update `server/sync-server.js`**

Mount `/v1/messages`, `/v1/chat/completions`, and `/api/providers` to `router.handleRequest`, while keeping `/api/sync/chats` and static file serving on `/`. Add CORS and JSON parsing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/unified-server.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/sync-server.js test/unified-server.test.js
git commit -m "feat(server): integrate static PWA, sync API, and AI proxy into unified server"
```

---

### Task 3: Developer Studio DOM & Semantic Structure (Option A)

**Files:**
- Modify: `pwa/index.html`
- Test: `test/pwa-dom.test.js`

**Interfaces:**
- Consumes: Semantic HTML5 structure
- Produces: Complete DOM elements: `#sidebar`, `#providerQuotas`, `#passphraseStatus`, `#modelSelector`, `#chatContainer`, `#promptInput`, `#sendBtn`

- [ ] **Step 1: Write the failing test**

```javascript
// test/pwa-dom.test.js
import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';

test('pwa/index.html includes Developer Studio sidebar, quota meters, and telemetry chips', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf-8');
  assert.match(html, /id="sidebar"/, 'must have sidebar');
  assert.match(html, /id="providerQuotas"/, 'must have provider quota container');
  assert.match(html, /id="passphraseStatus"/, 'must have sync passphrase badge');
  assert.match(html, /id="modelSelector"/, 'must have model switcher');
  assert.match(html, /id="streamTelemetry"/, 'must have live token speed telemetry');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pwa-dom.test.js`
Expected: FAIL (missing Developer Studio DOM elements)

- [ ] **Step 3: Update `pwa/index.html`**

Rebuild `pwa/index.html` with Option A layout:
- Left sidebar with brand logo, passphrase sync badge (`● Synced`), live provider meters (`Groq 320 t/s`, `Cerebras 450 t/s`, `Gemini Active`), and conversation history list.
- Main chat workbench with header containing `#modelSelector`, failover status badge, and `#streamTelemetry`.
- Chat stream container `#chatContainer` with message bubbles and markdown formatting.
- Bottom floating prompt bar with textarea `#promptInput`, model quick-switch, and `#sendBtn`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pwa-dom.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pwa/index.html test/pwa-dom.test.js
git commit -m "feat(pwa): overhaul index.html to FreeLLMAPI Developer Studio layout"
```

---

### Task 4: FreeLLMAPI Developer Studio CSS & Responsive Theme

**Files:**
- Modify: `pwa/style.css`
- Test: Manual visual check + syntax validation

**Interfaces:**
- Consumes: Semantic DOM from Task 3
- Produces: FreeLLMAPI dark zinc styling (`#090a0f`, `#121319`, `#27272a`, `#3b82f6`, `#10b981`), monospace telemetry badges, mobile responsive media queries.

- [ ] **Step 1: Write test to verify CSS rules**

```javascript
// test/pwa-css.test.js
import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';

test('pwa/style.css defines dark developer theme and responsive drawer', () => {
  const css = fs.readFileSync('pwa/style.css', 'utf-8');
  assert.match(css, /--bg-dark:\s*#090a0f/, 'must define obsidian dark background');
  assert.match(css, /\.provider-pill/, 'must style provider status pills');
  assert.match(css, /\.telemetry-badge/, 'must style telemetry badge');
  assert.match(css, /@media\s*\(max-width:\s*768px\)/, 'must include mobile breakpoint');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pwa-css.test.js`
Expected: FAIL

- [ ] **Step 3: Update `pwa/style.css`**

Replace old Claude-minimalist styles with FreeLLMAPI Developer Studio CSS:
- Dark zinc palette, subtle 1px border glows, code block headers with copy buttons.
- Monospace font accents for model names, provider speeds, and token counters.
- Responsive styles: sidebar collapses into an off-canvas drawer on screens under 768px with a hamburger toggle button.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pwa-css.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pwa/style.css test/pwa-css.test.js
git commit -m "style(pwa): implement FreeLLMAPI dark developer studio theme"
```

---

### Task 5: Frontend Interactive State, Telemetry, and Cross-Device Sync

**Files:**
- Modify: `pwa/app.js`
- Test: `test/pwa-app.test.js`

**Interfaces:**
- Consumes: Same-origin API endpoints (`/v1/messages`, `/api/sync/chats`, `/api/providers`)
- Produces: Reactive chat state, streaming token calculations, cloud sync, model selector

- [ ] **Step 1: Write the failing test**

```javascript
// test/pwa-app.test.js
import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';

test('pwa/app.js defaults backendUrl to same-origin to prevent 405 error', () => {
  const js = fs.readFileSync('pwa/app.js', 'utf-8');
  assert.match(js, /window\.location\.origin/, 'must use same-origin default');
  assert.match(js, /tokensPerSec/, 'must calculate tokens per second telemetry');
  assert.match(js, /syncChatsFromCloud/, 'must maintain cloud sync handler');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pwa-app.test.js`
Expected: FAIL

- [ ] **Step 3: Update `pwa/app.js`**

Implement:
- Same-origin backend targeting: calls `/v1/messages` on current origin (`window.location.origin`), completely preventing 405 errors.
- Streaming telemetry: records first-token arrival timestamp (TTFT) and measures ongoing `tokens/sec`, updating the UI badge in real time.
- Provider health loader: fetches `/api/providers` and updates the sidebar quota pills.
- Unified passphrase sync: stores `passphrase` in `localStorage`, hashes with SHA-256, and executes bi-directional sync against `/api/sync/chats`.
- Sidebar toggle for mobile devices.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pwa-app.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pwa/app.js test/pwa-app.test.js
git commit -m "feat(pwa): add telemetry calculation, same-origin routing, and mobile drawer logic"
```

---

### Task 6: Verification, Deployment Config, and Keep-Warm Blueprint

**Files:**
- Modify: `render.yaml`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `scripts/test-claude-request.js`

**Interfaces:**
- Consumes: Complete unified application
- Produces: Production deployment configuration and end-to-end verification

- [ ] **Step 1: Update `render.yaml` and `.env.example`**

Configure `render.yaml` to deploy the unified Node.js service using `npm start` with environment variables:
- `PORT=3001`
- `NODE_ENV=production`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `CEREBRAS_API_KEY`
- `ENCRYPTION_KEY`

- [ ] **Step 2: Update `README.md`**

Document:
- How to deploy the unified single-URL service to Render.
- How to set provider keys in Render's environment so restarts never wipe data.
- How to install the PWA on phone and desktop.
- How to connect with a sync passphrase.

- [ ] **Step 3: Run comprehensive automated test suite**

Run: `npm test`
Expected: All tests pass (router, unified server, PWA DOM, CSS, sync).

- [ ] **Step 4: Commit**

```bash
git add render.yaml .env.example README.md
git commit -m "docs(deploy): update Render blueprint and setup guide for unified Developer Studio"
```
