# FreeLLMAPI on Render with Claude Minimalist PWA & Cross-Device Sync Design

## 1. Intent and the Why
The goal is to build and deploy an ultra-fast, zero-cost AI coding solution that can be:
1. Accessed by external IDEs, tools, and coding agents (Claude Code, Cursor, Cline, Aider) via the standard **Anthropic Claude wire format** (`POST /v1/messages`).
2. Installed as a **Progressive Web App (PWA)** on any device (iOS, Android, Windows, Mac) with a **Claude Minimalist** interface.
3. Kept continuously synchronized across devices using a lightweight **Passphrase-Protected Cloud Sync**, so chats, code snippets, and prompt threads created on a PC immediately appear on a mobile phone without email/password registration.

The routing engine is **FreeLLMAPI**, aggregating 34 free AI providers (Groq, Cerebras, Google Gemini, OpenRouter, Mistral) to deliver billions of free tokens per month with automatic 429 rate-limit failover.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **FreeLLMAPI on Render:** Deploy the official FreeLLMAPI Docker container (`ghcr.io/tashfeenahmed/freellmapi:latest`) on Render's free tier.
- **Claude API Compatibility:** Expose `POST /v1/messages` accepting Anthropic messages payloads and returning Claude-formatted streaming SSE events.
- **24/7 Fast Response (Keep-Warm):** Provide an automated free ping configuration (e.g. via cron-job.org / GitHub Actions) to keep Render warm and eliminate the 30–50 second idle sleep freeze.
- **Claude Minimalist PWA (Option B):**
  - Installable on mobile and desktop via `manifest.webmanifest` and `sw.js`.
  - Clean conversational layout inspired by Claude AI with markdown rendering, syntax highlighting, and 1-click code copying.
  - Real-time token streaming with model status indicator.
- **Cross-Device Chat Sync:**
  - Lightweight sync API storing conversation threads in backend SQLite storage.
  - Passphrase-based access control: entering the same secret passphrase on any device seamlessly retrieves and syncs all conversation history.
- **Single-Command Setup & Verification:** Automated test script and clear step-by-step setup instructions.

### Non-Goals
- Modifying the core FreeLLMAPI multi-provider router logic.
- Complex multi-user billing, payment gateways, or OAuth identity providers.
- Paid hosting infrastructure.

### Anti-Goals
- Do not store unencrypted API keys (FreeLLMAPI requires AES-256-GCM encryption with an `ENCRYPTION_KEY`).
- Do not clutter the PWA interface; adhere strictly to the minimalist, distraction-free aesthetic.
- Do not let conversations remain isolated to single devices.

---

## 3. Constraints
- **Render Free Tier Limits:** 512 MB RAM, shared CPU, sleeps after 15 minutes of inactivity if not pinged. FreeLLMAPI has a ~40–80 MB idle footprint, fitting comfortably within 512 MB.
- **HTTPS Requirement:** PWA Service Workers require HTTPS, which Render automatically provisions for free on all `*.onrender.com` domains.
- **Cross-Device Sync Security:** Sync requests must be authenticated via the user's secret passphrase (hashed with SHA-256 before transmission/storage) so unauthorized parties cannot read conversation history.

---

## 4. Approaches Considered

1. **FreeLLMAPI on Render + Embedded PWA + Passphrase Sync [SELECTED]**
   - *Why chosen:* Fulfills the user's requirement to use FreeLLMAPI to route models across 34 providers, solves Render's cold-start issue via keep-alive pinging, provides an installable Claude-style UI, and syncs conversations across phone and desktop with zero friction.
2. **Cloudflare Workers Alone [REJECTED]**
   - *Why rejected:* FreeLLMAPI requires Node.js and C++ native modules (`better-sqlite3`), which cannot run in Cloudflare Workers' serverless V8 isolate.
3. **Local Storage Only without Sync [REJECTED]**
   - *Why rejected:* Fails the user's explicit requirement that chat sessions must be saved across multiple devices.
4. **Third-Party Auth (Firebase / Auth0 / Supabase Email Login) [REJECTED]**
   - *Why rejected:* Adds unnecessary registration steps, email confirmations, and external vendor dependencies when a personal sync passphrase accomplishes cross-device sync immediately.

---

## 5. Architectural & Technical Decisions

### Backend Service (Render)
- **Deployment Artifact:** `render.yaml` specification for Render Web Service using `ghcr.io/tashfeenahmed/freellmapi:latest`.
- **Environment Variables:**
  - `PORT`: 3001
  - `HOST_BIND`: `0.0.0.0`
  - `ENCRYPTION_KEY`: 64-character hex string (generated via script).
- **Keep-Warm Setup:** Ping `GET /health` or `GET /v1/models` every 10 minutes via a free external ping service (e.g. cron-job.org or GitHub Actions workflow) to maintain 0ms cold starts.

### Cross-Device Sync Architecture
- **Sync Endpoints:**
  - `GET /api/sync/chats`: Fetches conversation list and message history matching the provided `X-Sync-Passphrase`.
  - `POST /api/sync/chats`: Saves or updates conversation threads.
  - `DELETE /api/sync/chats/:id`: Deletes a conversation thread.
- **Data Model:**
  - `id`: Unique thread ID (UUID).
  - `title`: Auto-generated summary title (from first prompt).
  - `passphraseHash`: SHA-256 hash of user's sync passphrase.
  - `messages`: JSON array of `{ role, content, timestamp, model }`.
  - `updatedAt`: Timestamp for conflict resolution (latest write wins).

### Frontend PWA (Option B - Claude Minimalist)
- **Files (`pwa/`):**
  - `index.html`: Claude-styled conversational UI with floating prompt box and collapsible conversation sidebar.
  - `style.css`: Minimalist dark theme inspired by Claude with glassmorphism elements, responsive for mobile and desktop.
  - `app.js`: Connects to backend `/v1/messages` with streaming SSE, handles markdown code block formatting with copy buttons, and syncs history.
  - `manifest.webmanifest`: PWA metadata (name: "FreeLLM Code", display: "standalone", theme_color: "#18181b").
  - `sw.js`: Service worker providing offline asset caching and PWA installation support.
- **Settings Modal:**
  - Backend URL (e.g. `https://your-service.onrender.com`).
  - Unified API Key.
  - Sync Passphrase (with "Sync Now" button and automatic background sync on new messages).

---

## 6. What's Left to the Builder
- Generate `render.yaml` blueprint and `scripts/generate-env.js` encryption key generator.
- Implement the sync companion router (`server/sync.js` or standalone sync route) and integrate with FreeLLMAPI container / companion server.
- Build the complete `pwa/` frontend assets (HTML, CSS, JS, manifest, service worker, icons).
- Create automated verification scripts (`scripts/test-claude-request.js` and `scripts/test-sync.js`).
- Complete documentation in `README.md` covering Render deployment, keep-warm setup, and PWA installation on phone & PC.
