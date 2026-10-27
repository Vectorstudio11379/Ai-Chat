# FreeLLM Studio — AI Developer Workbench with Multi-Provider Failover & Cross-Device Sync

A unified, self-hosted AI developer studio and router deployed on **Render**. It serves the **FreeLLM Developer Studio Web App** (Option A dark workbench), routes **Anthropic Claude API messages** (`/v1/messages`) and **OpenAI completions** (`/v1/chat/completions`) with automatic 429 failover, and keeps your chat sessions continuously synchronized across PC and mobile via a single secret passphrase.

---

## What Was Fixed

1. **Permanently Resolved HTTP 405 (Method Not Allowed):**
   - The web app and API router now live on the exact same origin (`https://your-service.onrender.com`). Requests to `/v1/messages` and `/v1/chat/completions` directly hit the active HTTP server, eliminating CORS preflight friction and static hosting 405 rejections.
2. **Eliminated Container Reset / Logouts on Render:**
   - Provider API keys (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`) are loaded directly from persistent environment variables on Render. When Render's free tier spins down or restarts, your keys and services boot ready-to-use without ever asking you to create an account or re-enter credentials.
3. **FreeLLMAPI Developer Studio Interface (Option A):**
   - Replaced simplistic minimalist UI with FreeLLMAPI's dark developer workbench (`#090a0f`, `#121319`, `#27272a`).
   - Collapsible left sidebar displaying live provider quota meters (Groq 320 t/s, Cerebras 450 t/s, Gemini Active), chat threads, and sync passphrase badge (`● Synced`).
   - Main workbench featuring model switcher, 429 auto-failover badge, real-time token speed telemetry (`⚡ 320 tok/s • 120ms TTFT`), and syntax-highlighted code blocks with 1-click copying.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│  Any Client (Desktop PWA / Mobile PWA / Claude Code)   │
└───────────────────────────┬────────────────────────────┘
                            │ Same-Origin Requests (/v1/messages, /)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Unified FreeLLM Studio Service on Render              │
│  - Serves Developer Studio PWA from /                  │
│  - Routes /v1/messages with 429 Failover (Groq, etc.)  │
│  - Synchronizes chats via SHA-256 Passphrase Hash      │
│  - Keys persisted in Render Environment Variables      │
└────────────────────────────────────────────────────────┘
```

---

## 1. Quick Local Start

```bash
# 1. Install dependencies
npm install

# 2. Add your free keys to .env
# (Get free keys from: console.groq.com, cloud.cerebras.ai, aistudio.google.com)
GROQ_API_KEY=gsk_...
CEREBRAS_API_KEY=csk_...
GEMINI_API_KEY=AIzaSy_...

# 3. Start unified studio
npm start
```

Open `http://localhost:3001` in your browser.

---

## 2. Deploy to Render (100% Free & Persistent)

1. Push this repository to your GitHub account.
2. Log into the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint** and select your repository. Render will automatically detect `render.yaml`.
4. Under **Environment Variables**, provide your free provider keys:
   - `GROQ_API_KEY`: Your key from [Groq Console](https://console.groq.com/keys) (300+ tok/sec Qwen 2.5 Coder)
   - `CEREBRAS_API_KEY`: Your key from [Cerebras Cloud](https://cloud.cerebras.ai/) (Ultra-fast Llama 3.3)
   - `GEMINI_API_KEY`: Your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
5. Click **Apply**.

Your unified service will be live at:
`https://your-service.onrender.com`

---

## 3. Keep-Warm Setup (0ms Cold Starts)

To keep Render from going to sleep after 15 minutes of inactivity:
1. Go to [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) (both 100% free).
2. Create an HTTP monitor:
   - **URL:** `https://your-service.onrender.com/health`
   - **Interval:** Every **10 minutes**
3. Your service stays warm 24/7 with zero cold starts.

---

## 4. Cross-Device Passphrase Synchronization

To sync chats across your PC and mobile phone:
1. Open FreeLLM Studio in your browser on PC.
2. In the left sidebar, click **Configure Passphrase** under "Cross-Device Sync".
3. Enter any secret passphrase of your choice and click **Sync Now**.
4. Open the same URL on your phone, enter that exact passphrase, and click **Sync Now**.
5. All your conversations and code snippets will instantly sync across both devices.

---

## 5. Automated Verification

Run the comprehensive test suite verifying the router, server integration, PWA structure, CSS tokens, and sync mechanics:

```bash
npm test
```
