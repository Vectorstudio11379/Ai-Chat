// FreeLLM Code — PWA Client Application

// Default Settings
const DEFAULT_SETTINGS = {
  backendUrl: window.location.origin,
  apiKey: '',
  passphrase: '',
  defaultModel: 'qwen-2.5-coder-32b',
};

// State
let settings = loadSettings();
let chats = loadChats();
let activeChatId = null;
let isGenerating = false;
let deferredInstallPrompt = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const chatSearchInput = document.getElementById('chatSearchInput');
const chatStream = document.getElementById('chatStream');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const currentModelName = document.getElementById('currentModelName');
const installPwaBtn = document.getElementById('installPwaBtn');
const settingsBtn = document.getElementById('settingsBtn');
const openSettingsSidebarBtn = document.getElementById('openSettingsSidebarBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const syncNowBtn = document.getElementById('syncNowBtn');
const wakeBanner = document.getElementById('wakeBanner');
const syncStatusText = document.getElementById('syncStatusText');

// Settings Inputs
const settingBackendUrl = document.getElementById('settingBackendUrl');
const settingApiKey = document.getElementById('settingApiKey');
const settingPassphrase = document.getElementById('settingPassphrase');
const settingModel = document.getElementById('settingModel');

// --- Initialization ---
function init() {
  applySettingsToUI();
  renderChatList();
  setupEventListeners();
  registerServiceWorker();

  if (chats.length > 0) {
    selectChat(chats[0].id);
  } else {
    createNewChat();
  }

  // Attempt initial sync if passphrase exists
  if (settings.passphrase) {
    syncChatsFromCloud();
  }
}

// --- Persistence & Settings ---
function loadSettings() {
  try {
    const saved = localStorage.getItem('freellm_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  localStorage.setItem('freellm_settings', JSON.stringify(settings));
  applySettingsToUI();
}

function applySettingsToUI() {
  settingBackendUrl.value = settings.backendUrl;
  settingApiKey.value = settings.apiKey;
  settingPassphrase.value = settings.passphrase;
  settingModel.value = settings.defaultModel;

  const modelLabels = {
    'qwen-2.5-coder-32b': 'Qwen 2.5 Coder 32B',
    'llama-3.3-70b-versatile': 'Llama 3.3 70B',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'deepseek-r1-distill-llama-70b': 'DeepSeek R1 70B',
  };
  currentModelName.textContent = modelLabels[settings.defaultModel] || settings.defaultModel;
}

function loadChats() {
  try {
    const saved = localStorage.getItem('freellm_chats');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

function saveChats() {
  localStorage.setItem('freellm_chats', JSON.stringify(chats));
  renderChatList();
}

// --- Chat Management ---
function createNewChat() {
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: 'New Conversation',
    messages: [],
    updatedAt: Date.now(),
  };
  chats.unshift(newChat);
  saveChats();
  selectChat(newChat.id);
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
  }
}

function selectChat(id) {
  activeChatId = id;
  const chat = chats.find(c => c.id === id);
  renderChatList();
  renderChatMessages(chat);
}

function deleteChat(id, event) {
  if (event) event.stopPropagation();
  chats = chats.filter(c => c.id !== id);
  saveChats();

  // If cloud sync is enabled, also delete from cloud
  if (settings.passphrase) {
    deleteChatFromCloud(id);
  }

  if (chats.length === 0) {
    createNewChat();
  } else if (activeChatId === id) {
    selectChat(chats[0].id);
  }
}

function getActiveChat() {
  return chats.find(c => c.id === activeChatId);
}

// --- Rendering ---
function renderChatList() {
  chatHistoryList.innerHTML = '';
  const search = (chatSearchInput.value || '').toLowerCase().trim();

  const filtered = chats.filter(c => 
    !search || c.title.toLowerCase().includes(search)
  );

  filtered.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-history-item' + (chat.id === activeChatId ? ' active' : '');
    item.innerHTML = `
      <span class="chat-history-title">${escapeHtml(chat.title)}</span>
      <button class="icon-btn delete-btn" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 6L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2M18 6v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6"/></svg>
      </button>
    `;
    item.querySelector('.delete-btn').addEventListener('click', (e) => deleteChat(chat.id, e));
    item.addEventListener('click', () => selectChat(chat.id));
    chatHistoryList.appendChild(item);
  });
}

function renderChatMessages(chat) {
  chatStream.innerHTML = '';

  if (!chat || chat.messages.length === 0) {
    chatStream.innerHTML = `
      <div class="welcome-card" id="welcomeCard">
        <div class="welcome-icon">✦</div>
        <h2>FreeLLM Code Assistant</h2>
        <p class="subtitle">Lightning-fast coding models across 34 free providers with cross-device sync.</p>
        <div class="prompt-chips">
          <button class="chip" data-prompt="Write a TypeScript function to debounce an async API call with clean type signatures">Debounce async function</button>
          <button class="chip" data-prompt="Write a Python script to recursively scan a folder and find duplicate files by SHA-256 hash">Find duplicate files</button>
          <button class="chip" data-prompt="Explain how Server-Sent Events (SSE) streaming works with a minimal Express.js example">Explain SSE streaming</button>
          <button class="chip" data-prompt="Write a high-performance LRU Cache in JavaScript with O(1) get and put">LRU Cache in JS</button>
        </div>
      </div>
    `;
    attachChipListeners();
    return;
  }

  chat.messages.forEach(msg => {
    appendMessageToDOM(msg.role, msg.content);
  });

  scrollToBottom();
}

function appendMessageToDOM(role, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';

  if (role === 'assistant') {
    bubbleEl.innerHTML = formatMarkdown(content);
    attachCopyButtons(bubbleEl);
  } else {
    bubbleEl.textContent = content;
  }

  msgEl.appendChild(bubbleEl);
  chatStream.appendChild(msgEl);
  return bubbleEl;
}

// Simple, high-speed markdown formatter with code fence support
function formatMarkdown(text) {
  if (!text) return '';

  // Code fences: ```language\ncode\n```
  let formatted = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const cleanLang = lang.trim() || 'code';
    const escapedCode = escapeHtml(code.trim());
    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>${cleanLang}</span>
          <button class="copy-code-btn" data-code="${encodeURIComponent(code.trim())}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            <span>Copy</span>
          </button>
        </div>
        <pre><code class="language-${cleanLang}">${escapedCode}</code></pre>
      </div>
    `;
  });

  // Inline code: `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.88em;">$1</code>');

  // Paragraph breaks
  formatted = formatted.replace(/\n\n+/g, '<br><br>');

  return formatted;
}

function attachCopyButtons(container) {
  container.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rawCode = decodeURIComponent(btn.getAttribute('data-code'));
      try {
        await navigator.clipboard.writeText(rawCode);
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Copied!</span>';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    });
  });
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function scrollToBottom() {
  chatStream.scrollTop = chatStream.scrollHeight;
}

// --- Streaming Generation ---
async function handleSend() {
  const prompt = promptInput.value.trim();
  if (!prompt || isGenerating) return;

  const chat = getActiveChat();
  if (!chat) return;

  // Append user message
  chat.messages.push({ role: 'user', content: prompt, timestamp: Date.now() });
  
  // Set auto title from first prompt
  if (chat.messages.length === 1) {
    chat.title = prompt.length > 36 ? prompt.substring(0, 36) + '...' : prompt;
  }
  chat.updatedAt = Date.now();
  saveChats();

  // Clear input
  promptInput.value = '';
  promptInput.style.height = 'auto';

  // Render user message to DOM
  const welcomeCard = document.getElementById('welcomeCard');
  if (welcomeCard) welcomeCard.remove();
  appendMessageToDOM('user', prompt);
  scrollToBottom();

  // Prepare Assistant Bubble
  isGenerating = true;
  sendBtn.disabled = true;
  const assistantBubble = appendMessageToDOM('assistant', '✦ Thinking...');
  scrollToBottom();

  let accumulatedContent = '';
  let wakeTimer = setTimeout(() => {
    wakeBanner.style.display = 'flex';
  }, 3500);

  try {
    const backendBase = (settings.backendUrl || window.location.origin).replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
      headers['x-api-key'] = settings.apiKey;
    }

    // Call Claude wire-format endpoint (/v1/messages)
    const res = await fetch(`${backendBase}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.defaultModel,
        messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
        stream: true,
      }),
    });

    clearTimeout(wakeTimer);
    wakeBanner.style.display = 'none';

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API returned status ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    assistantBubble.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            // Anthropic Claude event framing
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              accumulatedContent += data.delta.text;
            } 
            // OpenAI chunk format compatibility fallback
            else if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              accumulatedContent += data.choices[0].delta.content;
            }
            assistantBubble.innerHTML = formatMarkdown(accumulatedContent);
            scrollToBottom();
          } catch (e) {
            // Partial JSON chunk
          }
        }
      }
    }

    attachCopyButtons(assistantBubble);

    // Save final assistant message to chat
    chat.messages.push({
      role: 'assistant',
      content: accumulatedContent,
      timestamp: Date.now(),
      model: settings.defaultModel,
    });
    chat.updatedAt = Date.now();
    saveChats();

    // Auto-sync to cloud if passphrase configured
    if (settings.passphrase) {
      syncChatToCloud(chat);
    }
  } catch (err) {
    clearTimeout(wakeTimer);
    wakeBanner.style.display = 'none';
    assistantBubble.innerHTML = `<span style="color: #ef4444;">⚠️ Request failed: ${escapeHtml(err.message)}</span>`;
    console.error('Generation error:', err);
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
  }
}

// --- Cross-Device Cloud Sync ---
async function syncChatsFromCloud() {
  if (!settings.passphrase) return;
  syncStatusText.textContent = 'Syncing...';

  try {
    const backendBase = (settings.backendUrl || window.location.origin).replace(/\/$/, '');
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
        syncStatusText.textContent = `Sync: Up to date (${chats.length} chats)`;
      }
    } else {
      syncStatusText.textContent = 'Sync: Auth failed';
    }
  } catch (err) {
    console.warn('Cloud sync error:', err);
    syncStatusText.textContent = 'Sync: Offline';
  }
}

async function syncChatToCloud(chat) {
  if (!settings.passphrase) return;
  try {
    const backendBase = (settings.backendUrl || window.location.origin).replace(/\/$/, '');
    await fetch(`${backendBase}/api/sync/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Passphrase': settings.passphrase,
      },
      body: JSON.stringify(chat),
    });
    syncStatusText.textContent = 'Sync: Saved to cloud';
  } catch (err) {
    console.warn('Failed to sync chat to cloud:', err);
  }
}

async function deleteChatFromCloud(id) {
  if (!settings.passphrase) return;
  try {
    const backendBase = (settings.backendUrl || window.location.origin).replace(/\/$/, '');
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
  menuBtn.addEventListener('click', () => sidebar.classList.add('open'));
  closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
  newChatBtn.addEventListener('click', createNewChat);

  chatSearchInput.addEventListener('input', renderChatList);

  // Send Actions
  sendBtn.addEventListener('click', handleSend);
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-expand textarea
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
  });

  // Settings Modal
  settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
  openSettingsSidebarBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
  closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
  });

  saveSettingsBtn.addEventListener('click', () => {
    saveSettings({
      backendUrl: settingBackendUrl.value.trim() || window.location.origin,
      apiKey: settingApiKey.value.trim(),
      passphrase: settingPassphrase.value.trim(),
      defaultModel: settingModel.value,
    });
    settingsModal.style.display = 'none';
    if (settings.passphrase) {
      syncChatsFromCloud();
    }
  });

  syncNowBtn.addEventListener('click', async () => {
    saveSettings({ passphrase: settingPassphrase.value.trim() });
    await syncChatsFromCloud();
    alert('Synchronization complete!');
  });

  // PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installPwaBtn.style.display = 'flex';
  });

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

function attachChipListeners() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
      handleSend();
    });
  });
}

// --- Service Worker Registration ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('ServiceWorker registration error:', err);
      });
    });
  }
}

// Launch
window.addEventListener('DOMContentLoaded', init);
