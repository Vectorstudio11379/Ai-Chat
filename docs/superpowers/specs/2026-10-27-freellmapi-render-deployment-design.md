# FreeLLMAPI on Render with Installable Coding PWA Design

## 1. Intent and the Why
The goal is to provide a complete, zero-cost AI coding system that:
1. Deploys **FreeLLMAPI** onto a free cloud web service on **Render**, pooling 34 free AI providers (Groq, Cerebras, Google Gemini, OpenRouter) and speaking the native Anthropic Messages API (`POST /v1/messages`).
2. Provides an installable **Progressive Web App (PWA)** styled with a **Claude Minimalist** interface, allowing the user to install the app on any device (phone, tablet, laptop, desktop) via "Add to Home Screen" / "Install App" for on-the-go coding assistance.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Render Free Tier Deployment:** Deploy FreeLLMAPI as a web service on Render's free tier using the official pre-built image (`ghcr.io/tashfeenahmed/freellmapi:latest`).
- **Claude Wire-Compatibility:** Expose `POST /v1/messages` with full streaming and non-streaming support for external editors (Claude Code, Cursor, Cline, Aider).
- **Installable PWA (Option B - Claude Minimalist):**
  - Web App Manifest (`manifest.webmanifest`) with standalone display mode and icons.
  - Service Worker (`sw.js`) for offline shell caching and installability.
  - Clean conversational stream with markdown formatting, syntax highlighting, and 1-click code copying.
  - Model switching badge (e.g. Qwen 2.5 Coder 32B, Llama 3.3 70B, Gemini 2.0 Flash).
  - Settings panel to configure the backend Render URL and unified key.
- **Keep-Alive Guidance:** Prevent Render's 15-minute idle freeze with a free ping service setup guide.

### Non-Goals
- Modifying the core FreeLLMAPI backend engine.
- Paid hosting subscriptions or paid GPU tiers.

### Anti-Goals
- Avoid complicated build steps on Render that cause memory spikes.
- Avoid cluttered interfaces; maintain Claude's clean, minimalist aesthetic.

---

## 3. Constraints
- **Render Limits:** 512 MB RAM, free tier, idle timeout after 15 minutes.
- **PWA Standards:** HTTPS required for service worker installation (Render automatically provides free HTTPS `https://<service>.onrender.com`).
- **Storage:** Client settings (API key, custom endpoints, conversation history) stored locally in browser `localStorage`.

---

## 4. Approaches Considered

1. **Render FreeLLMAPI Backend + Bundled Standalone PWA [SELECTED]**
   - *Why chosen:* Provides both a public Claude-compatible API for desktop tools (Claude Code/Cursor) AND an installable PWA for mobile/tablet/desktop browser use.
2. **Local Desktop App Only [REJECTED]**
   - *Why rejected:* User specifically requested cloud hosting on Render and installation across any device.
3. **Complex Multi-Pane IDE PWA (Option A) [REJECTED]**
   - *Why rejected:* User specifically chose Option B (Claude Minimalist) for a cleaner, responsive chat and code flow.

---

## 5. Architectural & Technical Decisions

### Backend Service (Render)
- **Deployment Artifact:** `render.yaml` specification for Render Web Service using `ghcr.io/tashfeenahmed/freellmapi:latest`.
- **Environment:**
  - `PORT`: 3001
  - `HOST_BIND`: `0.0.0.0`
  - `ENCRYPTION_KEY`: 64-character hex string generated via crypto script.

### Frontend PWA (Claude Minimalist)
- **File Structure:**
  - `pwa/index.html`: Claude-styled conversational UI with prompt box, code copy actions, and settings modal.
  - `pwa/style.css`: Minimalist dark mode theme inspired by Claude AI with glassmorphism touches.
  - `pwa/app.js`: Connects to backend `/v1/messages` (or `/v1/chat/completions`), handles SSE streaming tokens in real time, and manages conversations.
  - `pwa/manifest.webmanifest`: Progressive Web App metadata (name, icons, display: standalone).
  - `pwa/sw.js`: Service worker caching static assets for offline capability and browser install banners.
  - `pwa/icons/`: App icons for mobile home screens and desktop taskbars.

---

## 6. What's Left to the Builder
- Write `render.yaml` and key generation script (`scripts/generate-env.js`).
- Build the complete, dependency-free PWA client inside `pwa/`.
- Provide automated verification script (`scripts/test-claude-request.js`).
- Complete setup and installation guide in `README.md`.
