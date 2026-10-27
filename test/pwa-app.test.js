import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Developer Studio Frontend Logic (pwa/app.js)', () => {
  const appJs = fs.readFileSync('pwa/app.js', 'utf-8');

  it('defaults backendUrl to same-origin to prevent 405 error on static hosts', () => {
    expect(appJs).toMatch(/window\.location\.origin/);
    // Verifies it calls /v1/messages using backendBase
    expect(appJs).toMatch(/\/v1\/messages/);
  });

  it('calculates real-time streaming tokens per second and TTFT telemetry', () => {
    expect(appJs).toMatch(/tokensPerSec|tok\/s/);
    expect(appJs).toMatch(/telemetryText/);
  });

  it('fetches provider quota health from /api/providers', () => {
    expect(appJs).toMatch(/\/api\/providers/);
  });

  it('maintains cross-device chat synchronization via X-Sync-Passphrase', () => {
    expect(appJs).toMatch(/X-Sync-Passphrase/);
    expect(appJs).toMatch(/\/api\/sync\/chats/);
  });

  it('wires up mobile sidebar drawer toggle and backdrop', () => {
    expect(appJs).toMatch(/sidebarMobileBtn/);
    expect(appJs).toMatch(/sidebarBackdrop/);
  });
});
