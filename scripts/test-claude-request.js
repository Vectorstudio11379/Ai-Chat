#!/usr/bin/env node

/**
 * FreeLLMAPI Claude Wire-Format Verification Script
 * Sends a coding request to /v1/messages and streams the response.
 *
 * Usage:
 *   node scripts/test-claude-request.js --url https://your-service.onrender.com --key <unified-key>
 *   node scripts/test-claude-request.js --url http://localhost:3001
 */

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const rawUrl = getArg('--url', 'http://localhost:3001');
const baseUrl = rawUrl.replace(/\/$/, '');
const apiKey = getArg('--key', process.env.FREELLMAPI_KEY || '');
const model = getArg('--model', 'qwen-2.5-coder-32b');
const prompt = getArg('--prompt', 'Write a clean, efficient debounce function in TypeScript with type definitions.');

async function run() {
  console.log('========================================================');
  console.log('Testing FreeLLMAPI Claude Wire-Format Endpoint');
  console.log(`Target URL : ${baseUrl}/v1/messages`);
  console.log(`Model      : ${model}`);
  console.log(`Prompt     : "${prompt}"`);
  console.log('========================================================\n');

  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  const startTime = Date.now();
  let firstTokenTime = null;
  let accumulatedText = '';
  let tokenCount = 0;

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`\n❌ Request failed with HTTP ${res.status}:`);
      console.error(err);
      process.exit(1);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    process.stdout.write('AI Output:\n');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            let delta = '';

            // Claude SSE format
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              delta = data.delta.text;
            }
            // OpenAI SSE chunk format
            else if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              delta = data.choices[0].delta.content;
            }

            if (delta) {
              if (!firstTokenTime) {
                firstTokenTime = Date.now();
              }
              process.stdout.write(delta);
              accumulatedText += delta;
              tokenCount++;
            }
          } catch (e) {
            // Ignore partial SSE split
          }
        }
      }
    }

    const totalTimeMs = Date.now() - startTime;
    const timeToFirstToken = firstTokenTime ? firstTokenTime - startTime : totalTimeMs;
    const tokensPerSec = tokenCount > 0 ? ((tokenCount / (totalTimeMs - timeToFirstToken)) * 1000).toFixed(1) : 0;

    console.log('\n\n========================================================');
    console.log('✅ Request Completed Successfully!');
    console.log(`Time to first token : ${timeToFirstToken} ms`);
    console.log(`Total duration      : ${(totalTimeMs / 1000).toFixed(2)} s`);
    console.log(`Estimated speed     : ~${tokensPerSec} tokens/sec`);
    console.log('========================================================');
  } catch (err) {
    console.error('\n❌ Connection error:', err.message);
    process.exit(1);
  }
}

run();
