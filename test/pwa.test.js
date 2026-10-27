import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Claude Minimalist PWA Frontend Assets', () => {
  const pwaDir = path.resolve(process.cwd(), 'pwa');

  it('manifest.webmanifest is valid JSON and includes required PWA fields', () => {
    const manifestPath = path.join(pwaDir, 'manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    expect(manifest.name).toBe('FreeLLM Code');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#18181b');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('pwa/index.html references manifest and includes essential Claude Minimalist UI elements', () => {
    const indexPath = path.join(pwaDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);

    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('id="chatStream"');
    expect(html).toContain('id="promptInput"');
    expect(html).toContain('id="sendBtn"');
    expect(html).toContain('id="settingsModal"');
    expect(html).toContain('id="installPwaBtn"');
    expect(html).toContain('id="settingPassphrase"');
  });

  it('pwa/sw.js defines install, activate, and fetch listeners for offline caching', () => {
    const swPath = path.join(pwaDir, 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("addEventListener('install'");
    expect(swContent).toContain("addEventListener('activate'");
    expect(swContent).toContain("addEventListener('fetch'");
  });

  it('pwa/icons contains icon-192.svg and icon-512.svg', () => {
    const icon192 = path.join(pwaDir, 'icons', 'icon-192.svg');
    const icon512 = path.join(pwaDir, 'icons', 'icon-512.svg');
    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.existsSync(icon512)).toBe(true);
  });
});
