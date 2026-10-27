# FreeLLM Code — Ultra-Fast AI Coding on Render with PWA & Sync

Run an ultra-fast, zero-cost AI coding model backend on **Render**, speak the **Anthropic Claude API wire format** (`/v1/messages`), install the **Claude Minimalist Progressive Web App (PWA)** on any device, and keep your chat sessions synchronized across all your devices using a simple passphrase.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│  Any Client (Cursor / Claude Code / Continue / PWA)    │
└───────────────────────────┬────────────────────────────┘
                            │ /v1/messages (Claude format)
                            ▼
┌────────────────────────────────────────────────────────┐
│  FreeLLMAPI on Render (Free Web Service)               │
│  - Pools 34 free AI providers (Groq, Cerebras, Gemini) │
│  - Streams 300+ tokens/sec on Qwen 2.5 Coder 32B       │
│  - Automatic 429 rate-limit failover                   │
└───────────────────────────┬────────────────────────────┘
                            │ Sync API & Static PWA Serving
                            ▼
┌────────────────────────────────────────────────────────┐
│  Claude Minimalist PWA + Cross-Device Sync             │
│  - Installable on iOS, Android, Mac & Windows          │
│  - Passphrase-protected cross-device chat sync         │
│  - Syntax highlighting & 1-click code copying          │
└────────────────────────────────────────────────────────┘
```

---

## 1. Deploy FreeLLMAPI on Render (100% Free)

### Step 1: Generate your Encryption Key
FreeLLMAPI encrypts provider API keys using AES-256-GCM. Generate a 64-character key locally:

```bash
node scripts/generate-env.js
```

Copy the generated `ENCRYPTION_KEY` printed in the terminal.

### Step 2: Deploy to Render

**Option A (Direct Docker Image — Fastest, 1 Minute):**
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service** → Select **Existing Image**.
3. Image URL:
   ```
   ghcr.io/tashfeenahmed/freellmapi:latest
   ```
4. Choose the **Free** instance type.
5. In **Environment Variables**, add:
   - `ENCRYPTION_KEY`: `<Your 64-character generated key>`
   - `PORT`: `3001`
   - `HOST_BIND`: `0.0.0.0`
6. Click **Create Web Service**.

**Option B (Blueprint via Git):**
Push this repository to GitHub and select **New +** → **Blueprint** on Render. It will automatically detect `render.yaml`.

Once deployed, your service will be live at `https://your-service.onrender.com`.

---

## 2. Configure Free AI Providers (300+ Tokens/Sec)

Open your deployed Render URL in your browser (`https://your-service.onrender.com`).
1. Navigate to the **Keys** page.
2. Add free API keys from top-speed providers:
   - **[Groq Console](https://console.groq.com/keys)** *(Provides Qwen 2.5 Coder 32B at 300+ tokens/sec for free)*
   - **[Google AI Studio](https://aistudio.google.com/app/apikey)** *(Provides Gemini 2.0 Flash for free)*
   - **[Cerebras](https://cloud.cerebras.ai/)** *(Ultra-low latency Llama models)*
   - **[OpenRouter](https://openrouter.ai/keys)** *(Free model endpoints)*
3. Grab your **Unified API Key** from the header of the Keys page.

---

## 3. Keep-Warm Setup (Eliminate the 15-Minute Render Sleep)

Render's free tier goes to sleep after 15 minutes of idle time. To ensure **0ms instant response** 24/7:

1. Go to [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) (both 100% free).
2. Create a new monitor/job:
   - **URL:** `https://your-service.onrender.com/v1/models`
   - **Interval:** Every **10 minutes**
3. That's it! Your Render container will never go to sleep, giving you instant responses on every prompt.

---

## 4. Install the Claude Minimalist PWA on Any Device

The PWA provides a clean conversational coding workspace styled like Claude AI:

### Start the PWA locally or on your server:
```bash
npm start
```
By default, the PWA and sync server run on port `3002`.

### Install on Mobile & Desktop:
- **iPhone / iPad:** Open the web app in Safari → Tap **Share** (square with arrow) → Tap **Add to Home Screen**.
- **Android:** Open in Chrome → Tap **Install App** or the menu (⋮) → **Install app**.
- **Windows / Mac:** Open in Chrome or Edge → Click the **Install** button in the top navigation bar (or the install icon in the address bar).

---

## 5. Cross-Device Chat Synchronization

You can start a coding session on your PC and continue it on your phone:
1. Open the PWA and click the **Settings (gear)** icon.
2. Enter your deployed **Render Backend URL** (e.g. `https://your-service.onrender.com`).
3. Set your personal **Sync Passphrase** (any secret word of your choice).
4. Enter the same passphrase on your other devices and click **Sync Now**.
5. All your conversation threads and code snippets will automatically stay in sync in real time!

---

## 6. Connect to Your Code Editors

Because FreeLLMAPI speaks the standard **Anthropic Messages wire format**, you can connect your favorite coding tools:

### Claude Code CLI:
```bash
npx freellmapi setup-claude --url https://your-service.onrender.com --api-key <your-unified-key>
```

### Cursor / Continue.dev:
- **Base URL:** `https://your-service.onrender.com`
- **Model:** `qwen-2.5-coder-32b` (or `claude-3-5-sonnet` which FreeLLMAPI maps automatically)
- **API Key:** `<your-unified-key>`

---

## 7. Verify with the Test Script

Test streaming code generation directly from your terminal:

```bash
# Test local deployment
node scripts/test-claude-request.js --url http://localhost:3001

# Test deployed Render instance
node scripts/test-claude-request.js --url https://your-service.onrender.com --key <your-unified-key>
```
