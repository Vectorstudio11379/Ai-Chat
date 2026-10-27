import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Developer Studio PWA DOM Structure', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf-8');

  it('includes Developer Studio sidebar and brand heading', () => {
    expect(html).toMatch(/id="sidebar"/);
    expect(html).toMatch(/FreeLLM Studio|FreeLLM Router/);
  });

  it('includes live provider quota meter container', () => {
    expect(html).toMatch(/id="providerQuotas"/);
  });

  it('includes unified passphrase sync badge', () => {
    expect(html).toMatch(/id="passphraseStatus"/);
  });

  it('includes model selector dropdown and stream telemetry chip in workbench header', () => {
    expect(html).toMatch(/id="modelSelector"/);
    expect(html).toMatch(/id="streamTelemetry"/);
  });

  it('includes chat stream container, prompt input, and send button', () => {
    expect(html).toMatch(/id="chatContainer"/);
    expect(html).toMatch(/id="promptInput"/);
    expect(html).toMatch(/id="sendBtn"/);
  });

  it('includes mobile sidebar toggle button and settings modal', () => {
    expect(html).toMatch(/id="sidebarToggle"/);
    expect(html).toMatch(/id="settingsModal"/);
  });
});
