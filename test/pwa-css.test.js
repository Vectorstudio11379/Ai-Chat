import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Developer Studio CSS Theme', () => {
  const css = fs.readFileSync('pwa/style.css', 'utf-8');

  it('defines obsidian dark palette and custom properties', () => {
    expect(css).toMatch(/--bg-dark:\s*#090a0f/);
    expect(css).toMatch(/--sidebar-bg:\s*#111218/);
    expect(css).toMatch(/--border:\s*#27272a/);
    expect(css).toMatch(/--accent-blue:\s*#3b82f6/);
    expect(css).toMatch(/--accent-green:\s*#10b981/);
  });

  it('includes styling for provider status pills and sync card', () => {
    expect(css).toMatch(/\.provider-pill/);
    expect(css).toMatch(/\.sync-card/);
    expect(css).toMatch(/\.sync-pill/);
  });

  it('includes styling for real-time telemetry badge and model selector', () => {
    expect(css).toMatch(/\.telemetry-badge/);
    expect(css).toMatch(/\.model-selector/);
    expect(css).toMatch(/\.failover-badge/);
  });

  it('includes markdown code block formatting with copy buttons', () => {
    expect(css).toMatch(/\.code-block/);
    expect(css).toMatch(/\.code-header/);
    expect(css).toMatch(/\.copy-code-btn/);
  });

  it('includes responsive mobile rules under 768px with off-canvas drawer', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(css).toMatch(/\.studio-sidebar\.open/);
    expect(css).toMatch(/\.sidebar-backdrop\.active/);
  });
});
