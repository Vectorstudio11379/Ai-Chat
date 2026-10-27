#!/usr/bin/env node

/**
 * FreeLLMAPI Render Keep-Warm Ping Script
 * Pings the Render service periodically to prevent the 15-minute idle freeze.
 *
 * Usage:
 *   node scripts/keep-warm.js --url https://your-service.onrender.com --interval 10
 */

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const rawUrl = getArg('--url', process.env.RENDER_URL || 'http://localhost:3001');
const baseUrl = rawUrl.replace(/\/$/, '');
const intervalMinutes = parseInt(getArg('--interval', '10'), 10);
const intervalMs = intervalMinutes * 60 * 1000;

console.log('========================================================');
console.log('FreeLLMAPI Render Keep-Warm Pinger');
console.log(`Target URL : ${baseUrl}`);
console.log(`Interval   : Every ${intervalMinutes} minutes`);
console.log('========================================================\n');

async function ping() {
  const timestamp = new Date().toISOString();
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'FreeLLM-KeepWarm/1.0' },
    });

    if (res.ok) {
      console.log(`[${timestamp}] ✅ Ping successful (HTTP ${res.status})`);
    } else {
      // Fallback to /v1/models if /health is not implemented on upstream
      const resModels = await fetch(`${baseUrl}/v1/models`);
      console.log(`[${timestamp}] ℹ️ Ping fallback /v1/models (HTTP ${resModels.status})`);
    }
  } catch (err) {
    console.warn(`[${timestamp}] ⚠️ Ping failed: ${err.message}`);
  }
}

// Initial ping
ping();

// Recurring ping
setInterval(ping, intervalMs);
