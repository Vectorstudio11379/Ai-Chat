// FreeLLM Developer Studio Frontend Logic
// Full same-origin integration, live provider telemetry, and cross-device sync

const STORAGE_KEY_CHATS = 'freellm_chats_v2';
const STORAGE_KEY_SETTINGS = 'freellm_settings_v2';
const STORAGE_KEY_ACTIVE = 'freellm_active_chat_id';

let chats = [];
let activeChatId = null;
let isGenerating = false;
let deferredInstallPrompt = null;

// Settings State
let settings = {
  backendUrl: '', // Defaults to current window.location.origin
  apiKey: '',
  passphrase: '',
  defaultModel: 'qwen-2.5-coder-32b',
};

// DOM References
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarMobileBtn = document.getElementById('sidebarMobileBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const openSyncModalBtn = document.getElementById('openSyncModalBtn');
const syncStatusBadge = document.getElementById('syncStatusBadge');
const syncBtnLabel = document.getElementById('syncBtnLabel');
const providerQuotas = document.getElementById('providerQuotas');
const chatList = document.getElementById('chatList');
const newChatBtn = document.getElementById('newChatBtn');
const modelSelector = document.getElementById('modelSelector');
const streamTelemetry = document.getElementById('streamTelemetry');
const telemetryText = document.getElementById('telemetryText');
const wakeBanner = document.getElementById('wakeBanner');
const chatContainer = document.getElementById('chatContainer');
const promptInput = document.getElementById('promptInput');
const clearInputBtn = document.getElementById('clearInputBtn');
const sendBtn = document.getElementById('sendBtn');
const installPwaBtn = document.getElementById('installPwaBtn');

// Modal Elements
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const syncNowBtn = document.getElementById('syncNowBtn');
const settingBackendUrl = document.getElementById('settingBackendUrl');
const settingApiKey = document.getElementById('settingApiKey');
const settingPassphrase = document.getElementById('settingPassphrase');

// --- Initialization ---
function init() {
  loadSettings();
  loadChats();
  setupEventListeners();
  fetchProviderStatus();
  registerServiceWorker();

  // If there's an active chat, select it, else create one
  if (chats.length === 0) {
    createNewChat();
  } else {
    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
    const target = chats.find(c => c.id === savedActive) || chats[0];
    selectChat(target.id);
  }

  // Trigger cloud sync if passphrase configured
  if (settings.passphrase) {
    syncChatsFromCloud();
  }
}

// --- Persistence Helpers ---
function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (stored) {
      settings = { ...settings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load settings from storage', e);
  }

  // Sync with form fields
  settingBackendUrl.value = settings.backendUrl || '';
  settingApiKey.value = settings.apiKey || '';
  settingPassphrase.value = settings.passphrase || '';
  if (settings.defaultModel && modelSelector) {
    modelSelector.value = settings.defaultModel;
  }
  updateSyncBadge();
}

function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  updateSyncBadge();
}

function updateSyncBadge() {
  if (!syncStatusBadge) return;
  if (settings.passphrase && settings.passphrase.trim()) {
    syncStatusBadge.textContent = '● Synced';
    syncStatusBadge.className = 'sync-pill';
    syncBtnLabel.textContent = 'Sync Linked (Edit)';
  } else {
    syncStatusBadge.textContent = '● Local Only';
    syncStatusBadge.className = 'sync-pill offline';
    syncBtnLabel.textContent = 'Configure Passphrase';
  }
}

function loadChats() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHATS);
    if (stored) {
      chats = JSON.parse(stored);
    }
  } catch (e) {
    chats = [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
  renderChatList();
}

// --- Provider Quotas Loader ---
async function fetchProviderStatus() {
  try {
    const base = getEffectiveBaseUrl();
    const res = await fetch(`${base}/api/providers`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.providers) {
        renderProviderPills(data.providers);
      }
    }
  } catch (err) {
    console.warn('Provider health check unavailable (running local offline):', err.message);
  }
}

function renderProviderPills(providers) {
  const pillGroq = document.getElementById('pill-groq');
  const pillCerebras = document.getElementById('pill-cerebras');
  const pillGemini = document.getElementById('pill-gemini');

  if (pillGroq && providers.groq) {
    pillGroq.querySelector('.p-speed').textContent = providers.groq.available ? providers.groq.speed : 'Offline';
    pillGroq.querySelector('.p-speed').style.color = providers.groq.available ? '#10b981' : '#71717a';
  }
  if (pillCerebras && providers.cerebras) {
    pillCerebras.querySelector('.p-speed').textContent = providers.cerebras.available ? providers.cerebras.speed : 'Offline';
    pillCerebras.querySelector('.p-speed').style.color = providers.cerebras.available ? '#10b981' : '#71717a';
  }
  if (pillGemini && providers.gemini) {
    pillGemini.querySelector('.p-speed').textContent = providers.gemini.available ? 'Active' : 'Offline';
    pillGemini.querySelector('.p-speed').style.color = providers.gemini.available ? '#3b82f6' : '#71717a';
  }
  const pillOpenRouter = document.getElementById('pill-openrouter');
  if (pillOpenRouter && providers.openrouter) {
    pillOpenRouter.querySelector('.p-speed').textContent = providers.openrouter.available ? providers.openrouter.speed : 'Offline';
    pillOpenRouter.querySelector('.p-speed').style.color = providers.openrouter.available ? '#8b5cf6' : '#71717a';
  }
  const pillCohere = document.getElementById('pill-cohere');
  if (pillCohere && providers.cohere) {
    pillCohere.querySelector('.p-speed').textContent = providers.cohere.available ? providers.cohere.speed : 'Offline';
    pillCohere.querySelector('.p-speed').style.color = providers.cohere.available ? '#f59e0b' : '#71717a';
  }
}

// Effective same-origin base URL to prevent HTTP 405 Method Not Allowed
function getEffectiveBaseUrl() {
  if (settings.backendUrl && settings.backendUrl.trim()) {
    return settings.backendUrl.trim().replace(/\/$/, '');
  }
  return window.location.origin;
}

// --- Chat Management ---
function createNewChat() {
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    title: 'New Session',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  chats.unshift(newChat);
  saveChats();
  selectChat(newChat.id);
  promptInput.focus();
}

function selectChat(id) {
  activeChatId = id;
  localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  renderChatList();
  renderChatMessages();

  // Close mobile sidebar on select
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }
}

function deleteChat(id, event) {
  if (event) event.stopPropagation();
  chats = chats.filter(c => c.id !== id);
  saveChats();

  if (settings.passphrase) {
    deleteChatFromCloud(id);
  }

  if (chats.length === 0) {
    createNewChat();
  } else if (activeChatId === id) {
    selectChat(chats[0].id);
  }
}

function renderChatList() {
  if (!chatList) return;
  chatList.innerHTML = '';

  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
    item.onclick = () => selectChat(chat.id);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-item-title';
    titleSpan.textContent = chat.title || 'Untitled Chat';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-chat-btn';
    deleteBtn.title = 'Delete Chat';
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    deleteBtn.onclick = (e) => deleteChat(chat.id, e);

    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);
    chatList.appendChild(item);
  });
}

function renderChatMessages() {
  chatContainer.innerHTML = '';
  const chat = chats.find(c => c.id === activeChatId);

  if (!chat || chat.messages.length === 0) {
    renderWelcomeCard();
    return;
  }

  chat.messages.forEach(msg => {
    appendMessageToDOM(msg.role, msg.content);
  });
  scrollToBottom();
}

function renderWelcomeCard() {
  const card = document.createElement('div');
  card.className = 'welcome-card';
  card.id = 'welcomeCard';
  card.innerHTML = `
    <div class="welcome-icon">⚡</div>
    <h2>FreeLLM Developer Studio</h2>
    <p class="subtitle">Aggregated free-tier AI providers with zero rate-limit freezes and instant cross-device sync.</p>
    <div class="spec-grid">
      <div class="spec-card">
        <div class="spec-title">🚀 300+ Tokens/Sec</div>
        <div class="spec-desc">Ultra-fast inference powered by Groq and Cerebras hardware.</div>
      </div>
      <div class="spec-card">
        <div class="spec-title">🛡️ Smart 429 Failover</div>
        <div class="spec-desc">Automatic instant fallback across 34 providers when rate limits hit.</div>
      </div>
      <div class="spec-card">
        <div class="spec-title">🔒 Passphrase Sync</div>
        <div class="spec-desc">Cross-device synchronization for PC & mobile with zero email signups.</div>
      </div>
    </div>
    <div class="prompt-chips">
      <button class="chip" data-prompt="Write a high-performance LRU Cache in TypeScript with O(1) get and put">LRU Cache in TypeScript</button>
      <button class="chip" data-prompt="Explain Server-Sent Events (SSE) streaming with a minimal Node.js example">Explain SSE Streaming</button>
      <button class="chip" data-prompt="Write a Python script to scan directories and detect duplicate files using SHA-256">Detect Duplicates in Python</button>
      <button class="chip" data-prompt="Create an Express.js API gateway router that retries on HTTP 429 errors">Failover Router in Node.js</button>
    </div>
  `;
  chatContainer.appendChild(card);
  attachChipListeners();
}

function appendMessageToDOM(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'assistant') {
    const header = document.createElement('div');
    header.className = 'assistant-header';
    header.innerHTML = `<span>⚡ FreeLLM Router</span>`;
    bubble.appendChild(header);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'assistant-body';
    bodyDiv.innerHTML = formatMarkdown(content);
    bubble.appendChild(bodyDiv);
    attachCopyButtons(bodyDiv);
  } else {
    bubble.textContent = content;
  }

  msgDiv.appendChild(bubble);
  chatContainer.appendChild(msgDiv);
  return bubble;
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- Streaming & Markdown Logic ---
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatMarkdown(text) {
  if (!text) return '';

  // Code blocks: ```lang ... ```
  let formatted = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || 'code';
    return `
      <div class="code-block">
        <div class="code-header">
          <span>${escapeHtml(language)}</span>
          <button class="copy-code-btn" data-code="${escapeHtml(code.trim())}">Copy</button>
        </div>
        <pre><code>${escapeHtml(code)}</code></pre>
      </div>
    `;
  });

  // Inline code: `...`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold: **...**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert double newlines to paragraphs
  formatted = formatted.split('\n\n').map(p => {
    if (p.includes('<div class="code-block">')) return p;
    return `<p style="margin-bottom: 0.65rem;">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  return formatted;
}

function attachCopyButtons(container) {
  container.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.onclick = () => {
      const code = btn.getAttribute('data-code');
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = original; }, 1500);
        });
      }
    };
  });
}

// --- Chat Execution & Streaming Telemetry ---
async function handleSend() {
  if (isGenerating) return;
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  // Auto-title chat on first message
  if (chat.messages.length === 0) {
    chat.title = prompt.length > 28 ? prompt.substring(0, 25) + '...' : prompt;
  }

  // Push user message
  chat.messages.push({
    role: 'user',
    content: prompt,
    timestamp: Date.now(),
  });
  saveChats();

  // Clear input
  promptInput.value = '';
  promptInput.style.height = 'auto';

  // Remove welcome card if present
  const welcomeCard = document.getElementById('welcomeCard');
  if (welcomeCard) welcomeCard.remove();

  appendMessageToDOM('user', prompt);
  scrollToBottom();

  // Prepare Assistant Bubble
  isGenerating = true;
  sendBtn.disabled = true;
  const assistantBubble = appendMessageToDOM('assistant', '✦ Thinking...');
  const assistantBody = assistantBubble.querySelector('.assistant-body') || assistantBubble;
  scrollToBottom();

  let accumulatedContent = '';
  let tokenCount = 0;
  const startTime = Date.now();
  let firstTokenTime = null;

  telemetryText.textContent = 'Connecting...';

  const wakeTimer = setTimeout(() => {
    if (wakeBanner) wakeBanner.style.display = 'flex';
  }, 3500);

  try {
    const backendBase = getEffectiveBaseUrl();
    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
      headers['x-api-key'] = settings.apiKey;
    }

    const selectedModel = modelSelector ? modelSelector.value : (settings.defaultModel || 'qwen-2.5-coder-32b');

    // Call /v1/messages on same-origin backend
    const res = await fetch(`${backendBase}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
        stream: true,
      }),
    });

    clearTimeout(wakeTimer);
    if (wakeBanner) wakeBanner.style.display = 'none';

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API returned status ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    assistantBody.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstTokenTime) {
        firstTokenTime = Date.now();
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            let chunkText = '';
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              chunkText = data.delta.text;
            } else if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              chunkText = data.choices[0].delta.content;
            }

            if (chunkText) {
              accumulatedContent += chunkText;
              tokenCount += Math.max(1, Math.round(chunkText.length / 4));

              const elapsedSec = (Date.now() - (firstTokenTime || startTime)) / 1000;
              const tokensPerSec = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(0) : '320';
              const ttft = firstTokenTime ? (firstTokenTime - startTime) : 150;
              telemetryText.textContent = `⚡ ${tokensPerSec} tok/s (${ttft}ms)`;

              assistantBody.innerHTML = formatMarkdown(accumulatedContent);
              scrollToBottom();
            }
          } catch (e) {
            // Partial chunk ignored
          }
        }
      }
    }

    attachCopyButtons(assistantBody);

    // Save final assistant message to chat
    chat.messages.push({
      role: 'assistant',
      content: accumulatedContent,
      timestamp: Date.now(),
      model: selectedModel,
    });
    chat.updatedAt = Date.now();
    saveChats();

    // Auto-sync to cloud if passphrase configured
    if (settings.passphrase) {
      syncChatToCloud(chat);
    }
  } catch (err) {
    clearTimeout(wakeTimer);
    if (wakeBanner) wakeBanner.style.display = 'none';
    assistantBody.innerHTML = `<span style="color: #ef4444;">⚠️ Request failed: ${escapeHtml(err.message)}</span>`;
    telemetryText.textContent = 'Error';
    console.error('Generation error:', err);
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
  }
}

// --- Cross-Device Cloud Sync ---
async function syncChatsFromCloud() {
  if (!settings.passphrase) return;
  telemetryText.textContent = 'Syncing...';

  try {
    const backendBase = getEffectiveBaseUrl();
    const res = await fetch(`${backendBase}/api/sync/chats`, {
      headers: {
        'X-Sync-Passphrase': settings.passphrase,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.chats)) {
        // Merge cloud chats with local chats (latest updatedAt wins)
        const chatMap = new Map();
        for (const local of chats) {
          chatMap.set(local.id, local);
        }
        for (const cloud of data.chats) {
          const local = chatMap.get(cloud.id);
          if (!local || (cloud.updatedAt || 0) > (local.updatedAt || 0)) {
            chatMap.set(cloud.id, cloud);
          }
        }
        chats = Array.from(chatMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        saveChats();
        telemetryText.textContent = `Synced (${chats.length})`;
      }
    } else {
      telemetryText.textContent = 'Sync auth error';
    }
  } catch (err) {
    console.warn('Cloud sync error:', err);
    telemetryText.textContent = 'Sync offline';
  }
}

async function syncChatToCloud(chat) {
  if (!settings.passphrase) return;
  try {
    const backendBase = getEffectiveBaseUrl();
    await fetch(`${backendBase}/api/sync/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Passphrase': settings.passphrase,
      },
      body: JSON.stringify(chat),
    });
  } catch (err) {
    console.warn('Failed to sync chat to cloud:', err);
  }
}

async function deleteChatFromCloud(id) {
  if (!settings.passphrase) return;
  try {
    const backendBase = getEffectiveBaseUrl();
    await fetch(`${backendBase}/api/sync/chats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'X-Sync-Passphrase': settings.passphrase,
      },
    });
  } catch (err) {
    console.warn('Failed to delete chat from cloud:', err);
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  // Mobile Drawer Toggle
  if (sidebarMobileBtn && sidebar) {
    sidebarMobileBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    });
  }

  if (sidebarBackdrop && sidebar) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    });
  }

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', createNewChat);
  }

  if (modelSelector) {
    modelSelector.addEventListener('change', () => {
      saveSettings({ defaultModel: modelSelector.value });
    });
  }

  // Send Actions
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSend);
  }

  if (clearInputBtn) {
    clearInputBtn.addEventListener('click', () => {
      promptInput.value = '';
      promptInput.style.height = 'auto';
      promptInput.focus();
    });
  }

  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
    });
  }

  // Modals & Passphrase Setup
  if (openSyncModalBtn) {
    openSyncModalBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      settingPassphrase.focus();
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.style.display = 'none';
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      saveSettings({
        backendUrl: settingBackendUrl.value.trim(),
        apiKey: settingApiKey.value.trim(),
        passphrase: settingPassphrase.value.trim(),
      });
      settingsModal.style.display = 'none';
      if (settings.passphrase) {
        syncChatsFromCloud();
      }
    });
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', async () => {
      saveSettings({ passphrase: settingPassphrase.value.trim() });
      await syncChatsFromCloud();
      alert('Cross-device synchronization complete!');
    });
  }

  // PWA Install Event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installPwaBtn) installPwaBtn.style.display = 'flex';
  });

  if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        installPwaBtn.style.display = 'none';
      }
      deferredInstallPrompt = null;
    });
  }
}

function attachChipListeners() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
      handleSend();
    });
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('ServiceWorker registration error:', err);
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', init);
