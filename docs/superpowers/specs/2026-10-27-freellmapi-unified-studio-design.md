# FreeLLMAPI Unified Developer Studio & Cross-Device Sync Design

## 1. Intent and the Why
The goal of this project is to fix the core operational failures of the current setup and deliver a unified, premium developer experience across desktop and mobile devices:

1. **Fix HTTP 405 (Method Not Allowed):** Eliminate the request failure caused by the chat UI making `POST /v1/messages` requests to static hosting origins (e.g. Cloudflare Pages) instead of the active API router.
2. **Fix Render Session Wipe & Account Reset:** Prevent the container from wiping its SQLite database and logging the user out on container sleep or restart by externalizing provider keys directly into persistent environment variables.
3. **FreeLLMAPI Developer Studio UI (Option A):** Replace the current simplistic chat interface with a modern developer workbench modeled after FreeLLMAPI: dark zinc theme, collapsible left sidebar with live provider quotas (Groq, Cerebras, Gemini, Mistral), real-time streaming telemetry (tokens/sec, TTFT, model fallback logs), and syntax-highlighted code blocks with 1-click copying.
4. **Unified Cross-Device Sync:** Enable seamless, zero-registration chat and preference synchronization between PC and mobile via a single secret passphrase.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **All-in-One Unified Server:** Deploy a single unified service on Render that serves the Developer Studio PWA from `/`, routes `/v1/messages` and `/v1/chat/completions` with streaming SSE, and manages `/api/sync/chats`.
- **Zero 405 Errors & Zero CORS Friction:** Because the web app and API live on the exact same origin (`https://your-service.onrender.com`), requests always reach the live POST handler.
- **Permanent Configuration (No Re-Login):** Seed upstream provider keys directly through environment variables (`GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`, etc.) so the service boots ready-to-use after any Render spin-down.
- **Developer Studio Interface (Option A):**
  - Collapsible sidebar with chat threads, live provider quota gauges, and sync status.
  - Active model indicator with automatic rate-limit failover badge.
  - Live token speed meter (`tokens/sec`, `TTFT`).
  - Dark mode with syntax highlighting, markdown rendering, and 1-click code copying.
  - Fully responsive across Windows, Mac, iOS, and Android.
- **Passphrase-Protected Sync:** Entering the same secret passphrase on any device seamlessly pulls and synchronizes chat threads.

### Non-Goals
- Complex multi-tenant auth (passwords, emails, OAuth, Firebase).
- Modifying upstream provider quota limits.
- Paid hosting infrastructure.

### Anti-Goals
- Do not store unencrypted API keys.
- Do not require the user to configure backend URLs on each device.
- Do not lose conversations or require account setup when Render sleeps.

---

## 3. Constraints
- **Render Free Tier:** 512 MB RAM, shared CPU, sleeps after 15 minutes of idle time. The unified server must have a light footprint (<100 MB).
- **HTTPS & PWA Requirements:** Service workers and cross-device installation require HTTPS, provided by Render's `*.onrender.com`.
- **Single Origin Simplicity:** Everything must operate out of one unified port and URL so the user only needs one address for both desktop and mobile.

---

## 4. Approaches Considered

1. **Unified All-in-One Server [SELECTED]**
   - *Description:* Package the Developer Studio PWA static assets, the FreeLLMAPI routing proxy, and the chat sync storage into one Node.js service running on Render.
   - *Why chosen:* Provides a single URL for phone and desktop, eliminates CORS issues, permanently resolves the 405 static-origin error, and ensures provider keys are automatically loaded from environment variables without database resets.
2. **Decoupled Architecture (Cloudflare Pages Frontend + Render Backend) [REJECTED]**
   - *Why rejected:* Requires manually typing backend URLs into each device; if left empty or pointed to the frontend URL, it triggers the HTTP 405 error. Double the deployment overhead.

---

## 5. Architectural & Technical Decisions

### 5.1 Backend Architecture (`server/sync-server.js`)
The unified server listens on `PORT` (default 3001 or Render's port) and handles:
1. **Static UI Serving (`GET /` and assets):** Serves `pwa/index.html`, `style.css`, `app.js`, icons, and manifest with appropriate MIME types.
2. **Chat Sync API (`/api/sync/chats`):**
   - `GET /api/sync/chats`: Authenticated with `X-Sync-Passphrase`. Returns conversation history for the hashed passphrase.
   - `POST /api/sync/chats`: Saves or updates a chat thread.
   - `DELETE /api/sync/chats/:id`: Deletes a thread.
3. **AI Proxy & Messages API (`POST /v1/messages` and `POST /v1/chat/completions`):**
   - Accepts Anthropic Claude wire format or OpenAI format.
   - Proxies request to upstream free providers (Groq, Cerebras, Gemini) using environment keys with automatic 429 failover.
   - Streams back SSE chunks directly to the client.
4. **Health & Keep-Warm (`GET /health`):**
   - Returns `{ status: 'ok', service: 'freellmapi-unified-studio' }`. Used by keep-warm pings to prevent idle sleep.

### 5.2 Frontend UI Overhaul (`pwa/`)
- **`pwa/index.html`:** Option A layout featuring:
  - Sidebar: Brand header, Sync Passphrase pill (`● Synced`), Provider Quota meters (Groq, Cerebras, Gemini), chat history list.
  - Header: Active model selector (`qwen-2.5-coder-32b`, `llama-3.3-70b`, `gemini-2.0-flash`), auto-failover status, live speed gauge.
  - Chat Area: Author avatars, stream buffer with token speed counter, markdown code blocks with syntax highlighting and copy buttons.
  - Prompt Bar: Multi-line auto-expanding textarea, clear button, model quick-switch, and send action.
- **`pwa/style.css`:** FreeLLMAPI dark zinc developer aesthetic (`#090a0f`, `#121319`, `#27272a`, `#3b82f6`, `#10b981`), monospace code styling, and responsive media queries for mobile viewports.
- **`pwa/app.js`:**
  - Auto-detects same-origin backend (`window.location.origin`).
  - Handles streaming responses with live tokens/sec calculation.
  - Automatic background synchronization on message receipt when passphrase is set.

---

## 6. What's Left to the Builder
- Update `pwa/index.html` with Option A (Developer Studio) DOM elements.
- Implement FreeLLMAPI styling in `pwa/style.css`.
- Update `pwa/app.js` to calculate token metrics, handle same-origin routing, and support the model selector.
- Enhance `server/sync-server.js` with integrated AI proxy routing (`/v1/messages` and `/v1/chat/completions`) using environment variable keys.
- Update `render.yaml` and `.env.example` to document the unified deployment.
- Verify with automated tests (`test/sync.test.js` and streaming test).
