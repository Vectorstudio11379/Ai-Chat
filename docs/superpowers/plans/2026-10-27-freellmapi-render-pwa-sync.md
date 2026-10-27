# FreeLLMAPI on Render with Claude Minimalist PWA & Cross-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy FreeLLMAPI on Render's free tier, accompanied by an installable Claude Minimalist PWA frontend and a passphrase-protected cross-device sync layer that preserves coding chat sessions across phones and PCs.

**Architecture:** FreeLLMAPI runs on Render as a containerized web service providing multi-provider routing across 34 free AI providers and speaking the Anthropic Messages wire format (`/v1/messages`). A lightweight companion service handles cross-device chat sync and serves the installable Claude Minimalist PWA (`pwa/`), which connects to the router via streaming SSE, auto-saves chats, and synchronizes history across devices using a private passphrase.

**Tech Stack:** Node.js (v20+), Docker, SQLite, Vanilla CSS/HTML/JS (PWA, Service Worker, Manifest), Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-27-freellmapi-render-pwa-sync-design.md`](file:///c:/Users/new/Downloads/Ai%20Model/docs/superpowers/specs/2026-10-27-freellmapi-render-pwa-sync-design.md)

## Global Constraints

- **Backend Platform:** Render Free Tier Web Service (Docker container based on `ghcr.io/tashfeenahmed/freellmapi:latest` or custom companion).
- **Wire Format:** Claude Messages API format (`POST /v1/messages`) with Server-Sent Events (SSE) streaming tokens.
- **PWA Standards:** Full Progressive Web App with `manifest.webmanifest`, `sw.js` offline cache, and standalone window display.
- **Cross-Device Sync:** Passphrase-protected with client-side SHA-256 hashing; zero email/password sign-up friction.
- **Zero-Cost:** Must run 100% within free tiers of Render and FreeLLMAPI supported providers (Groq, Gemini, etc.).

## Review Focus

1. **Passphrase Mismatch / Unauthorized Sync:** Client requests `/api/sync/chats` with missing or incorrect passphrase header. Expected: Return 401 Unauthorized with clean JSON error. Tested in Task 2.
2. **Offline Mode in PWA:** PWA is loaded without internet connection. Expected: Service Worker serves cached application shell; local conversations remain accessible in `localStorage`. Tested in Task 3.
3. **Empty / Malformed Sync Payload:** Client sends invalid JSON or missing `id`/`messages` array to `POST /api/sync/chats`. Expected: Return 400 Bad Request with validation error. Tested in Task 2.
4. **Claude API Stream Failure / Rate Limit (429):** Backend FreeLLMAPI returns upstream rate limit or error. Expected: PWA catches the error, displays an error banner in the chat stream, and preserves the user prompt in the input box. Tested in Task 3.
5. **Render Wake-Up / Connection Delay:** PWA connects to a waking Render instance. Expected: UI detects pending connection (>3s) and displays a "Connecting to server / waking up..." indicator. Tested in Task 3.

---

### Task 1: Render Deployment Configuration & Key Generation

**Files:**
- Create: `render.yaml`
- Create: `docker-compose.yml`
- Create: `scripts/generate-env.js`
- Create: `package.json`

**Interfaces:**
- Consumes: None
- Produces: Runnable key generation script and 1-click Render blueprint specification

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "freellmapi-render-pwa",
  "version": "1.0.0",
  "description": "FreeLLMAPI on Render with Claude Minimalist PWA and Cross-Device Sync",
  "type": "module",
  "scripts": {
    "start": "node server/sync-server.js",
    "generate-key": "node scripts/generate-env.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {},
  "devDependencies": {
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: Dependencies installed cleanly with exit code 0.

- [ ] **Step 3: Implement `scripts/generate-env.js`**

Generate a 64-character cryptographically secure hex string (`crypto.randomBytes(32).toString('hex')`) and output `.env` configuration for Render:
```javascript
import crypto from 'crypto';
import fs from 'fs';

const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('Generated 64-character ENCRYPTION_KEY:', encryptionKey);
```

- [ ] **Step 4: Create `render.yaml`**

Configure Render Web Service specification:
```yaml
services:
  - type: web
    name: freellmapi-gateway
    runtime: image
    image:
      url: ghcr.io/tashfeenahmed/freellmapi:latest
    plan: free
    region: oregon
    envVars:
      - key: PORT
        value: "3001"
      - key: HOST_BIND
        value: "0.0.0.0"
      - key: ENCRYPTION_KEY
        generateValue: true
```

- [ ] **Step 5: Verify key generation script runs**

Run: `node scripts/generate-env.js`
Expected: Outputs a valid 64-character hexadecimal string.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json render.yaml scripts/generate-env.js
git commit -m "chore: scaffold project, Render blueprint, and encryption key generator"
```

---

### Task 2: Cross-Device Chat Sync Backend & API

**Files:**
- Create: `server/sync-server.js`
- Create: `server/db.js`
- Test: `test/sync.test.js`

**Interfaces:**
- Consumes: HTTP requests with `X-Sync-Passphrase` header
- Produces:
  - `GET /api/sync/chats`: Array of user conversation summaries & message threads
  - `POST /api/sync/chats`: Upserts a conversation thread `{ id, title, messages, updatedAt }`
  - `DELETE /api/sync/chats/:id`: Deletes a conversation thread
  - `GET /health`: Health check indicator

- [ ] **Step 1: Write failing unit test in `test/sync.test.js`**

Test:
- `GET /health` returns HTTP 200 `{ status: "ok" }`.
- `GET /api/sync/chats` without `X-Sync-Passphrase` header returns HTTP 401 Unauthorized.
- `POST /api/sync/chats` with valid passphrase saves a session and returns HTTP 200 `{ success: true }`.
- `GET /api/sync/chats` with matching passphrase retrieves the saved session.
- `GET /api/sync/chats` with a different passphrase returns empty list (strict isolation).
- `DELETE /api/sync/chats/:id` deletes the specified thread.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sync.test.js`
Expected: FAIL with "Cannot find module '../server/sync-server.js'".

- [ ] **Step 3: Implement `server/db.js` and `server/sync-server.js`**

Implement lightweight in-memory/JSON/SQLite storage using Node native modules (or file storage) for session persistence, with SHA-256 passphrase hashing and CORS support.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sync.test.js`
Expected: PASS on all sync tests.

- [ ] **Step 5: Commit**

```bash
git add server/sync-server.js server/db.js test/sync.test.js
git commit -m "feat: implement cross-device chat sync API and database storage"
```

---

### Task 3: Claude Minimalist PWA Frontend (Option B)

**Files:**
- Create: `pwa/index.html`
- Create: `pwa/style.css`
- Create: `pwa/app.js`
- Create: `pwa/manifest.webmanifest`
- Create: `pwa/sw.js`
- Create: `pwa/icons/icon-192.svg`
- Create: `pwa/icons/icon-512.svg`
- Test: `test/pwa.test.js`

**Interfaces:**
- Consumes: FreeLLMAPI `/v1/messages` and Sync API `/api/sync/chats`
- Produces: Installable Progressive Web App with conversation drawer, markdown code rendering, and live token streaming

- [ ] **Step 1: Create `pwa/manifest.webmanifest` and `pwa/sw.js`**

Configure PWA manifest (`name: "FreeLLM Code"`, `display: "standalone"`, `start_url: "/"`, `theme_color: "#18181b"`). Implement service worker in `sw.js` caching app shell assets with a network-first strategy for API calls and cache-first for static assets.

- [ ] **Step 2: Implement `pwa/index.html` and `pwa/style.css`**

Build the Option B (Claude Minimalist) interface:
- Sidebar with conversation history, "New Chat" button, and search.
- Clean central message stream with Claude-inspired typography.
- Floating bottom prompt bar with auto-expanding textarea, "Send" button, and model badge.
- Settings modal to enter:
  - Backend FreeLLMAPI URL
  - FreeLLMAPI Unified API Key
  - Cross-Device Sync Passphrase
- Install PWA trigger button in header.

- [ ] **Step 3: Implement `pwa/app.js`**

Implement client logic:
- Streaming fetch against `/v1/messages` handling SSE frames (`content_block_delta` or OpenAI chunk format).
- Markdown formatting for code fences (` ```language ... ``` `) with 1-click "Copy Code" button.
- Local conversation persistence in `localStorage`.
- Automatic synchronization with `/api/sync/chats` using the user's passphrase.
- Connection status indicator (detects if Render container is waking up).

- [ ] **Step 4: Write verification test in `test/pwa.test.js`**

Verify that `pwa/index.html` references `manifest.webmanifest`, `sw.js`, and that the service worker syntax and manifest JSON are valid.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/pwa.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pwa/ test/pwa.test.js
git commit -m "feat: implement Claude Minimalist installable PWA with code highlighting and sync"
```

---

### Task 4: Static Asset Serving & Integration in Sync Server

**Files:**
- Modify: `server/sync-server.js`
- Modify: `test/sync.test.js`

**Interfaces:**
- Consumes: `pwa/` static files
- Produces: Integrated server that hosts both the PWA and the Sync API on a single port

- [ ] **Step 1: Write failing test in `test/sync.test.js`**

Add tests verifying:
- `GET /` returns HTTP 200 with `text/html` serving `pwa/index.html`.
- `GET /manifest.webmanifest` returns HTTP 200 with `application/manifest+json`.
- `GET /sw.js` returns HTTP 200 with `application/javascript`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sync.test.js`
Expected: FAIL on static file routes.

- [ ] **Step 3: Update `server/sync-server.js` to serve `pwa/` directory**

Add static file serving logic for `GET /`, `/style.css`, `/app.js`, `/sw.js`, `/manifest.webmanifest`, and `/icons/*`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sync.test.js`
Expected: PASS on all tests.

- [ ] **Step 5: Commit**

```bash
git add server/sync-server.js test/sync.test.js
git commit -m "feat: serve PWA frontend directly from sync server"
```

---

### Task 5: End-to-End Test Scripts, Keep-Warm Guide, and Documentation

**Files:**
- Create: `scripts/test-claude-request.js`
- Create: `scripts/keep-warm.js`
- Create: `README.md`

**Interfaces:**
- Consumes: Deployed FreeLLMAPI URL and Sync server URL
- Produces: Automated CLI verification tools and complete deployment guide

- [ ] **Step 1: Implement `scripts/test-claude-request.js`**

A CLI verification script using native `fetch` that:
- Sends a Claude-formatted prompt (`POST /v1/messages` with `messages: [{ role: "user", content: "Write a quicksort in Python" }]`).
- Streams tokens to `stdout` in real time, calculating token velocity.

- [ ] **Step 2: Implement `scripts/keep-warm.js`**

A lightweight script that pings the Render service URL every 10 minutes to prevent the 15-minute idle sleep.

- [ ] **Step 3: Write comprehensive `README.md`**

Document:
1. **1-Click Render Deployment:** How to deploy FreeLLMAPI on Render using `render.yaml` or Docker image.
2. **Obtaining Free Provider Keys:** Free keys for Groq, Google Gemini, OpenRouter, and adding them in the FreeLLMAPI dashboard.
3. **PWA Installation:** How to open the web app on iPhone/Android and click "Add to Home Screen" or install on Windows/Mac.
4. **Cross-Device Sync Setup:** Entering your personal Sync Passphrase on multiple devices to keep chats synchronized.
5. **Keep-Warm Setup:** Setting up a free keep-alive ping on cron-job.org or GitHub Actions so Render never sleeps.
6. **Connecting IDEs:** How to configure Claude Code, Cursor, and Continue.dev with your Render endpoint.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass with zero failures.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-claude-request.js scripts/keep-warm.js README.md
git commit -m "docs: add test scripts, keep-warm tool, and full deployment guide"
```
