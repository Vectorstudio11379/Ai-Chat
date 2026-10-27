# Cloudflare Fast Coding AI Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a zero-cost, ultra-fast serverless AI coding gateway on Cloudflare Workers that translates Claude-compatible API requests (`/v1/messages`) to Groq's high-speed inference engine (300+ tokens/sec).

**Architecture:** A Cloudflare Workers edge service handles incoming HTTP requests. It validates optional gateway authentication, converts Anthropic Claude request payloads to Groq/OpenAI chat completion payloads (mapping model names and system prompts), forwards to Groq's API, and transforms response streams (or non-streaming JSON) back into Anthropic Claude Server-Sent Events (SSE) format in real time.

**Tech Stack:** TypeScript, Cloudflare Workers Runtime, Wrangler CLI, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-27-cloudflare-fast-coding-ai-gateway-design.md`](file:///c:/Users/new/Downloads/Ai%20Model/docs/superpowers/specs/2026-10-27-cloudflare-fast-coding-ai-gateway-design.md)

## Global Constraints

- **Platform:** Cloudflare Workers (TypeScript / ESM `export default { fetch }`).
- **Free Quotas:** Must run entirely within Cloudflare Workers free tier (100k requests/day) and Groq free tier.
- **Protocol Compliance:** Must implement Anthropic Claude Messages API format (`POST /v1/messages`) with SSE events (`message_start`, `content_block_start`, `content_block_delta`, `message_delta`, `message_stop`).
- **Zero Cold Start:** Must not use sleeping containers or platforms with spin-up latency.
- **Default Coding Model:** `qwen-2.5-coder-32b` (fallback: `llama-3.3-70b-versatile`).

## Review Focus

1. **Empty or Malformed JSON Body:** Client sends malformed JSON to `POST /v1/messages`. Expected: Return HTTP 400 with `{ error: { type: "invalid_request_error", message: "Invalid JSON body" } }`. Tested in Task 4.
2. **Top-Level Anthropic System Prompt:** Client sends `system: "You are an expert coder"` as top-level field or array in Anthropic format. Expected: Correctly transformed into `{ role: "system", content: "..." }` at the head of Groq messages. Tested in Task 2.
3. **Claude Model Name Aliasing:** Client requests `claude-3-5-sonnet-20241022`. Expected: Transparently mapped to `qwen-2.5-coder-32b` on Groq so Claude-specific clients work out of the box. Tested in Task 2.
4. **Upstream Error Handling (e.g. Rate Limit / 429):** Groq returns 429 or 5xx. Expected: Gateway cleanly proxies the error status code and wraps the response in Anthropic error schema. Tested in Task 4.
5. **Gateway Auth Token Enforcement:** When `GATEWAY_KEY` is configured in environment, unauthenticated or bad token requests must receive HTTP 401 with Anthropic error format. Tested in Task 4.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: None
- Produces: Runnable Node/Vitest test harness and Wrangler development environment

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "fast-coding-ai-gateway",
  "version": "1.0.0",
  "description": "Zero-cost, ultra-fast Cloudflare Workers gateway for AI coding models",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250224.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5",
    "wrangler": "^3.109.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Configure TypeScript for Cloudflare Workers ESM environment (`moduleResolution: "bundler"`, `target: "ES2022"`, `types: ["@cloudflare/workers-types"]`).

- [ ] **Step 3: Create `wrangler.toml`**

Configure Worker entrypoint `src/index.ts`, compatibility date `2024-10-01`, and `vars` defaults (`DEFAULT_MODEL = "qwen-2.5-coder-32b"`).

- [ ] **Step 4: Create `vitest.config.ts`**

Configure Vitest with `environment: "node"`.

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: Dependencies installed with clean exit code 0.

- [ ] **Step 6: Verify Vitest test runner works**

Run: `npx vitest run`
Expected: Vitest executes and reports no tests found (or clean run).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json wrangler.toml vitest.config.ts
git commit -m "chore: scaffold Cloudflare Worker project with TypeScript and Vitest"
```

---

### Task 2: Type Definitions and Request/Response Protocol Translator

**Files:**
- Create: `src/types.ts`
- Create: `src/translator.ts`
- Test: `test/translator.test.ts`

**Interfaces:**
- Consumes: Anthropic and OpenAI/Groq schemas
- Produces:
  - `translateAnthropicToGroq(req: AnthropicMessagesRequest, defaultModel?: string): GroqChatCompletionRequest`
  - `translateGroqNonStreamToAnthropic(res: GroqChatCompletionResponse, modelName: string): AnthropicMessagesResponse`
  - `resolveModelName(requestedModel?: string, defaultModel?: string): string`

- [ ] **Step 1: Define types in `src/types.ts`**

Define `AnthropicMessagesRequest`, `AnthropicMessage`, `AnthropicMessagesResponse`, `GroqChatCompletionRequest`, `GroqChatCompletionResponse`, and Worker `Env` interface with `GROQ_API_KEY?: string`, `GATEWAY_KEY?: string`, `DEFAULT_MODEL?: string`.

- [ ] **Step 2: Write failing unit tests in `test/translator.test.ts`**

Test:
- Model aliasing (`claude-3-5-sonnet` -> `qwen-2.5-coder-32b`, preserving explicit Groq model names).
- System prompt normalization (top-level string, top-level array of blocks, converted to `{ role: "system", content: "..." }`).
- Message conversion (`role: "user" | "assistant"`, multi-part content string vs array).
- Non-streaming response mapping (`choices[0].message.content` -> `content: [{ type: "text", text: "..." }]`, usage token counts, stop reasons).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/translator.test.ts`
Expected: FAIL with "Cannot find module '../src/translator'".

- [ ] **Step 4: Implement translation functions in `src/translator.ts`**

Implement `resolveModelName`, `translateAnthropicToGroq`, and `translateGroqNonStreamToAnthropic`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/translator.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/translator.ts test/translator.test.ts
git commit -m "feat: implement Anthropic-to-Groq request and non-streaming response translator"
```

---

### Task 3: Streaming SSE Protocol Transformer

**Files:**
- Modify: `src/translator.ts`
- Modify: `test/translator.test.ts`

**Interfaces:**
- Consumes: Groq SSE chunks (`data: {"choices":[{"delta":{"content":"..."}}]}`)
- Produces: `createAnthropicStreamTransformer(model: string, messageId?: string): TransformStream<Uint8Array, Uint8Array>` emitting Anthropic SSE events:
  - `event: message_start`
  - `event: content_block_start`
  - `event: content_block_delta`
  - `event: content_block_stop`
  - `event: message_delta`
  - `event: message_stop`

- [ ] **Step 1: Write failing streaming test in `test/translator.test.ts`**

Feed simulated Groq SSE stream chunks through `createAnthropicStreamTransformer` and verify that the transformed output contains valid Claude SSE frames in exact order with correct `event:` and `data:` formatting.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/translator.test.ts`
Expected: FAIL with "createAnthropicStreamTransformer is not a function".

- [ ] **Step 3: Implement `createAnthropicStreamTransformer` in `src/translator.ts`**

Use standard `TransformStream` with internal line buffer to parse incoming lines, handle `data: [DONE]`, extract delta text tokens, and format Anthropic events.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/translator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/translator.ts test/translator.test.ts
git commit -m "feat: implement streaming SSE transformer for Anthropic format"
```

---

### Task 4: Auth Guard and Cloudflare Worker Entrypoint

**Files:**
- Create: `src/auth.ts`
- Create: `src/index.ts`
- Test: `test/auth.test.ts`
- Test: `test/index.test.ts`

**Interfaces:**
- Consumes: `Env`, `validateGatewayAuth`, `translateAnthropicToGroq`, `createAnthropicStreamTransformer`
- Produces: Default Worker export `{ fetch(request: Request, env: Env): Promise<Response> }`

- [ ] **Step 1: Write unit tests in `test/auth.test.ts`**

Test:
- No `GATEWAY_KEY` configured in `Env` -> returns `true` (open access).
- `GATEWAY_KEY` configured with valid `x-api-key` header -> returns `true`.
- `GATEWAY_KEY` configured with valid `Authorization: Bearer <key>` header -> returns `true`.
- `GATEWAY_KEY` configured with invalid or missing header -> returns `false`.

- [ ] **Step 2: Implement `src/auth.ts`**

Implement `validateGatewayAuth(request: Request, gatewayKey?: string): boolean`.

- [ ] **Step 3: Write tests in `test/index.test.ts`**

Test Worker handler:
- `GET /` and `GET /health` returns HTTP 200 with JSON status.
- `POST /v1/messages` without authorization (when key configured) returns HTTP 401 with Anthropic error payload.
- `POST /v1/messages` with malformed JSON body returns HTTP 400 with Anthropic error payload.
- `POST /v1/messages` without `GROQ_API_KEY` configured returns HTTP 500 with helpful configuration instruction.
- `POST /v1/messages` with mocked Groq fetch call returns translated HTTP 200 response.
- `POST /v1/chat/completions` routes directly to Groq with auth forwarding.

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/index.test.ts`
Expected: FAIL with "Cannot find module '../src/index'".

- [ ] **Step 5: Implement `src/index.ts`**

Implement the Worker router, error handling wrappers, and endpoints.

- [ ] **Step 6: Run all tests to verify they pass**

Run: `npx vitest run`
Expected: PASS on all test suites (`test/translator.test.ts`, `test/auth.test.ts`, `test/index.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/auth.ts src/index.ts test/auth.test.ts test/index.test.ts
git commit -m "feat: implement auth guard and Cloudflare Worker HTTP entrypoint"
```

---

### Task 5: End-to-End Test Client and Documentation

**Files:**
- Create: `scripts/test-client.js`
- Create: `README.md`

**Interfaces:**
- Consumes: Worker API
- Produces: Executable verification client and comprehensive setup documentation

- [ ] **Step 1: Create `scripts/test-client.js`**

A standalone Node.js script (using native `fetch`) that:
- Accepts `--url <endpoint>` (default: `http://localhost:8787/v1/messages`), `--stream` (boolean), `--prompt <text>`, and `--key <gateway-key>`.
- Sends a coding prompt (e.g., "Write a quicksort in TypeScript") formatted in Claude JSON schema.
- Streams tokens to `stdout` in real time and calculates tokens/sec and latency.

- [ ] **Step 2: Create comprehensive `README.md`**

Document:
1. Quick Start (Get free Groq API key from https://console.groq.com/keys).
2. Local Development (`npm run dev`).
3. Running verification script (`node scripts/test-client.js --stream`).
4. Deployment to Cloudflare (`npx wrangler secret put GROQ_API_KEY`, `npm run deploy`).
5. Connecting to VS Code, Continue.dev, Cursor, or Aider with copy-paste config snippets.

- [ ] **Step 3: Run type check and full test suite**

Run: `npm run typecheck && npm test`
Expected: TypeScript check passes with zero errors, all Vitest tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-client.js README.md
git commit -m "docs: add test client script and setup documentation"
```
