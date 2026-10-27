// FreeLLM Studio — Unified AI Workbench Frontend Logic
// Pixel-perfect interface matching mockup with Auto-Unified AI Router,
// Live streaming telemetry, cross-device sync, and speech recognition.

const STORAGE_KEY_CHATS = 'freellm_chats_v3';
const STORAGE_KEY_SETTINGS = 'freellm_settings_v3';
const STORAGE_KEY_ACTIVE = 'freellm_active_chat_id_v3';

let chats = [];
let activeChatId = null;
let isGenerating = false;
let deferredInstallPrompt = null;
let speechRecognizer = null;

// Settings State (Default to Auto-Unified AI)
let settings = {
  backendUrl: '', // Defaults to same-origin window.location.origin
  apiKey: '',
  passphrase: '',
  defaultModel: 'auto', // ⚡ Auto-Unified Smart Router
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
const micBtn = document.getElementById('micBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const plusBtn = document.getElementById('plusBtn');
const installPwaBtn = document.getElementById('installPwaBtn');
const failoverBadge = document.getElementById('failoverBadge');

// Top Navigation Tabs
const tabDashboard = document.getElementById('tabDashboard');
const tabAiChat = document.getElementById('tabAiChat');
const tabHelp = document.getElementById('tabHelp');
const tabAccount = document.getElementById('tabAccount');
const userProfileBtn = document.getElementById('userProfileBtn');
const themeLightBtn = document.getElementById('themeLightBtn');
const themeDarkBtn = document.getElementById('themeDarkBtn');

// Modal Elements
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const syncNowBtn = document.getElementById('syncNowBtn');
const settingBackendUrl = document.getElementById('settingBackendUrl');
const settingApiKey = document.getElementById('settingApiKey');
const settingPassphrase = document.getElementById('settingPassphrase');
const exitAppBtn = document.getElementById('exitAppBtn');

// --- Initialization ---
function init() {
  loadSettings();
  loadChats();
  setupEventListeners();
  setupSpeechRecognition();
  fetchProviderStatus();
  registerServiceWorker();

  // Seed mockup conversation if first time or empty
  if (chats.length === 0) {
    seedMockupConversation();
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

// --- Seed Mockup Conversation matching the screenshot pixel by pixel ---
function seedMockupConversation() {
  const now = Date.now();
  const DAY_MS = 86400000;

  // Active chat matching mockup conversation
  const mainChat = {
    id: 'chat_active_mockup',
    title: 'Mortgage Rate Insights & Options',
    createdAt: now - 3600000,
    updatedAt: now,
    messages: [
      {
        role: 'assistant',
        content: 'How Can I Help You Today?',
        timestamp: now - 3500000,
      },
      {
        role: 'user',
        content: 'Hi there',
        timestamp: now - 3400000,
      },
      {
        role: 'user',
        content: 'Could you please provide me with the latest update on the current mortgage rate today, including details for both 30-year fixed and 15-year fixed loan options, if available?',
        timestamp: now - 1800000,
      },
      {
        role: 'assistant',
        content: "Today's average 30-year fixed mortgage rate is 6.45%, 15-year fixed is 5.85%. Our app updates daily with real-time rates, trends, and personalized mortgage options for you.",
        timestamp: now - 1700000,
      }
    ]
  };

  // Seed history threads for Today, 5 Days Ago, 7 Days Ago matching the screenshot
  const historicalChats = [
    mainChat,
    { id: 'c_today_1', title: 'Last week, mortgage rates rose s...', createdAt: now - 2 * 3600000, updatedAt: now - 2 * 3600000, messages: [] },
    { id: 'c_today_2', title: 'Two weeks ago, rates dipped to 6...', createdAt: now - 5 * 3600000, updatedAt: now - 5 * 3600000, messages: [] },
    { id: 'c_today_3', title: 'Three weeks ago, rates increase...', createdAt: now - 8 * 3600000, updatedAt: now - 8 * 3600000, messages: [] },
    { id: 'c_today_4', title: 'A month ago, rates remained sta...', createdAt: now - 12 * 3600000, updatedAt: now - 12 * 3600000, messages: [] },
    { id: 'c_today_5', title: 'Recent months show gradual ris...', createdAt: now - 18 * 3600000, updatedAt: now - 18 * 3600000, messages: [] },

    // 5 Days Ago
    { id: 'c_5d_1', title: 'Five weeks ago, mortgage rates a...', createdAt: now - 5 * DAY_MS, updatedAt: now - 5 * DAY_MS, messages: [] },
    { id: 'c_5d_2', title: 'Earlier this year, rates dropped to...', createdAt: now - 5.2 * DAY_MS, updatedAt: now - 5.2 * DAY_MS, messages: [] },
    { id: 'c_5d_3', title: 'January saw rates rise quickly fro...', createdAt: now - 5.8 * DAY_MS, updatedAt: now - 5.8 * DAY_MS, messages: [] },

    // 7 Days Ago
    { id: 'c_7d_1', title: 'Mortgage application volumes fl...', createdAt: now - 7 * DAY_MS, updatedAt: now - 7 * DAY_MS, messages: [] },
  ];

  chats = historicalChats;
  saveChats();
  selectChat(mainChat.id);
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
  if (settingBackendUrl) settingBackendUrl.value = settings.backendUrl || '';
  if (settingApiKey) settingApiKey.value = settings.apiKey || '';
  if (settingPassphrase) settingPassphrase.value = settings.passphrase || '';
  if (modelSelector) {
    modelSelector.value = settings.defaultModel || 'auto';
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
    if (syncBtnLabel) syncBtnLabel.textContent = 'Sync Linked (Edit)';
  } else {
    syncStatusBadge.textContent = '● Local Only';
    syncStatusBadge.className = 'sync-pill offline';
    if (syncBtnLabel) syncBtnLabel.textContent = 'Configure Passphrase';
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

// --- Provider Quotas & Health Telemetry ---
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
    console.warn('Provider health check unavailable (offline mode):', err.message);
  }
}

function renderProviderPills(providers) {
  const pillGroq = document.getElementById('pill-groq');
  const pillCerebras = document.getElementById('pill-cerebras');
  const pillGemini = document.getElementById('pill-gemini');
  const pillOpenRouter = document.getElementById('pill-openrouter');
  const pillCohere = document.getElementById('pill-cohere');

  if (pillGroq && providers.groq) {
    const speedEl = pillGroq.querySelector('.p-speed');
    if (speedEl) {
      speedEl.textContent = providers.groq.available ? providers.groq.speed : 'Offline';
      speedEl.style.color = providers.groq.available ? '#10b981' : '#71717a';
    }
  }
  if (pillCerebras && providers.cerebras) {
    const speedEl = pillCerebras.querySelector('.p-speed');
    if (speedEl) {
      speedEl.textContent = providers.cerebras.available ? providers.cerebras.speed : 'Offline';
      speedEl.style.color = providers.cerebras.available ? '#10b981' : '#71717a';
    }
  }
  if (pillGemini && providers.gemini) {
    const speedEl = pillGemini.querySelector('.p-speed');
    if (speedEl) {
      speedEl.textContent = providers.gemini.available ? 'Active' : 'Offline';
      speedEl.style.color = providers.gemini.available ? '#3b82f6' : '#71717a';
    }
  }
  if (pillOpenRouter && providers.openrouter) {
    const speedEl = pillOpenRouter.querySelector('.p-speed');
    if (speedEl) {
      speedEl.textContent = providers.openrouter.available ? providers.openrouter.speed : 'Offline';
      speedEl.style.color = providers.openrouter.available ? '#8b5cf6' : '#71717a';
    }
  }
  if (pillCohere && providers.cohere) {
    const speedEl = pillCohere.querySelector('.p-speed');
    if (speedEl) {
      speedEl.textContent = providers.cohere.available ? providers.cohere.speed : 'Offline';
      speedEl.style.color = providers.cohere.available ? '#f59e0b' : '#71717a';
    }
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
    messages: [
      {
        role: 'assistant',
        content: 'How Can I Help You Today?',
        timestamp: Date.now()
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  chats.unshift(newChat);
  saveChats();
  selectChat(newChat.id);
  if (promptInput) promptInput.focus();
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

// --- Grouped History Chat List Rendering ---
function renderChatList() {
  if (!chatList) return;
  chatList.innerHTML = '';

  const now = Date.now();
  const DAY_MS = 86400000;

  const groups = {
    'Today': [],
    '5 Days Ago': [],
    '7 Days Ago': []
  };

  chats.forEach(chat => {
    const ageMs = now - (chat.updatedAt || chat.createdAt || now);
    const ageDays = ageMs / DAY_MS;

    if (ageDays < 2) {
      groups['Today'].push(chat);
    } else if (ageDays < 6) {
      groups['5 Days Ago'].push(chat);
    } else {
      groups['7 Days Ago'].push(chat);
    }
  });

  Object.entries(groups).forEach(([groupName, groupChats]) => {
    if (groupChats.length === 0) return;

    const groupHeader = document.createElement('div');
    groupHeader.className = 'history-group-label';
    groupHeader.textContent = groupName;
    chatList.appendChild(groupHeader);

    groupChats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
      item.onclick = () => selectChat(chat.id);

      // Outline chat spark icon
      const iconSpan = document.createElement('span');
      iconSpan.className = 'chat-item-icon';
      iconSpan.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      `;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'chat-item-title';
      titleSpan.textContent = chat.title || 'Untitled Chat';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-chat-btn';
      deleteBtn.title = 'Delete Chat';
      deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      deleteBtn.onclick = (e) => deleteChat(chat.id, e);

      item.appendChild(iconSpan);
      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);
      chatList.appendChild(item);
    });
  });
}

function renderChatMessages() {
  if (!chatContainer) return;
  chatContainer.innerHTML = '';
  const chat = chats.find(c => c.id === activeChatId);

  if (!chat || chat.messages.length === 0) {
    appendMessageToDOM('assistant', 'How Can I Help You Today?');
    return;
  }

  chat.messages.forEach((msg, idx) => {
    appendMessageToDOM(msg.role, msg.content, idx);
  });
  scrollToBottom();
}

// --- Append Message to DOM with Exact Mockup Avatars & Actions ---
function appendMessageToDOM(role, content, msgIndex = null) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  if (role === 'assistant') {
    // 1. Concentric Neon Green Rings Avatar
    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar-rings';
    avatar.innerHTML = `
      <div class="ai-ring-outer">
        <div class="ai-ring-inner">
          <div class="ai-ring-dot"></div>
        </div>
      </div>
    `;

    // 2. Content Wrapper (Bubble + Action Toolbar)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'msg-content-wrapper';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = formatMarkdown(content);

    // 3. Message Action Toolbar (6 Mockup Icons)
    const toolbar = document.createElement('div');
    toolbar.className = 'message-action-toolbar';
    toolbar.innerHTML = `
      <button class="msg-action-btn copy-msg-btn" title="Copy Message" aria-label="Copy">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="msg-action-btn thumb-up-btn" title="Good Response" aria-label="Thumbs up">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button class="msg-action-btn thumb-down-btn" title="Bad Response" aria-label="Thumbs down">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
      </button>
      <button class="msg-action-btn edit-msg-btn" title="Edit in Prompt" aria-label="Edit">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button class="msg-action-btn download-msg-btn" title="Download Text" aria-label="Download">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="msg-action-btn reload-msg-btn" title="Regenerate Response" aria-label="Regenerate">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      </button>
    `;

    attachToolbarEvents(toolbar, content, bubble);
    attachCopyButtons(bubble);

    contentWrapper.appendChild(bubble);
    contentWrapper.appendChild(toolbar);

    row.appendChild(avatar);
    row.appendChild(contentWrapper);
  } else {
    // User Message: Bubble on right, User Avatar on far right
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'msg-content-wrapper';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = content;
    contentWrapper.appendChild(bubble);

    const avatar = document.createElement('div');
    avatar.className = 'user-msg-avatar';

    row.appendChild(contentWrapper);
    row.appendChild(avatar);
  }

  chatContainer.appendChild(row);
  return row.querySelector('.message-bubble');
}

function attachToolbarEvents(toolbar, textContent, bubbleEl) {
  const copyBtn = toolbar.querySelector('.copy-msg-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(textContent).then(() => {
        copyBtn.style.color = '#22c55e';
        setTimeout(() => { copyBtn.style.color = ''; }, 1500);
      });
    };
  }

  const thumbUp = toolbar.querySelector('.thumb-up-btn');
  const thumbDown = toolbar.querySelector('.thumb-down-btn');
  if (thumbUp) {
    thumbUp.onclick = () => {
      thumbUp.classList.toggle('active');
      if (thumbDown) thumbDown.classList.remove('active');
    };
  }
  if (thumbDown) {
    thumbDown.onclick = () => {
      thumbDown.classList.toggle('active');
      if (thumbUp) thumbUp.classList.remove('active');
    };
  }

  const editBtn = toolbar.querySelector('.edit-msg-btn');
  if (editBtn) {
    editBtn.onclick = () => {
      if (promptInput) {
        promptInput.value = textContent;
        promptInput.focus();
      }
    };
  }

  const downloadBtn = toolbar.querySelector('.download-msg-btn');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-chat-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  const reloadBtn = toolbar.querySelector('.reload-msg-btn');
  if (reloadBtn) {
    reloadBtn.onclick = () => {
      regenerateLastResponse();
    };
  }
}

function scrollToBottom() {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// --- Markdown Rendering ---
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

  // Paragraphs
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

// --- Send & Auto-Unified AI Streaming ---
async function handleSend() {
  if (isGenerating) return;
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  // Auto-title chat on first message
  if (chat.messages.length <= 1) {
    chat.title = prompt.length > 32 ? prompt.substring(0, 29) + '...' : prompt;
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

  appendMessageToDOM('user', prompt);
  scrollToBottom();

  // Stream assistant response
  await executeStreamingChat(chat);
}

async function regenerateLastResponse() {
  if (isGenerating) return;
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat || chat.messages.length === 0) return;

  // If last message was assistant, pop it
  if (chat.messages[chat.messages.length - 1].role === 'assistant') {
    chat.messages.pop();
  }

  renderChatMessages();
  await executeStreamingChat(chat);
}

async function executeStreamingChat(chat) {
  isGenerating = true;
  if (sendBtn) sendBtn.disabled = true;

  const assistantBubble = appendMessageToDOM('assistant', '✦ Thinking...');
  scrollToBottom();

  let accumulatedContent = '';
  let tokenCount = 0;
  const startTime = Date.now();
  let firstTokenTime = null;

  if (telemetryText) telemetryText.textContent = 'Routing Auto-Unified AI...';

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

    const selectedModel = modelSelector ? modelSelector.value : (settings.defaultModel || 'auto');

    // Call /v1/messages on same-origin backend router
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
    assistantBubble.innerHTML = '';

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
              const tokensPerSec = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(0) : '380';
              const ttft = firstTokenTime ? (firstTokenTime - startTime) : 150;
              if (telemetryText) {
                telemetryText.textContent = `⚡ ${tokensPerSec} tok/s (${ttft}ms)`;
              }

              assistantBubble.innerHTML = formatMarkdown(accumulatedContent);
              scrollToBottom();
            }
          } catch (e) {
            // Ignore partial SSE chunk
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
      model: selectedModel,
    });
    chat.updatedAt = Date.now();
    saveChats();

    // Attach toolbar events on the newly finished message row
    const row = assistantBubble.closest('.message-row');
    if (row) {
      const tb = row.querySelector('.message-action-toolbar');
      if (tb) attachToolbarEvents(tb, accumulatedContent, assistantBubble);
    }

    // Auto-sync to cloud if passphrase configured
    if (settings.passphrase) {
      syncChatToCloud(chat);
    }
  } catch (err) {
    clearTimeout(wakeTimer);
    if (wakeBanner) wakeBanner.style.display = 'none';
    assistantBubble.innerHTML = `<span style="color: #ef4444;">⚠️ Auto-Unified Request Notice: ${escapeHtml(err.message)}</span>`;
    if (telemetryText) telemetryText.textContent = 'Failover Offline';
    console.error('Generation error:', err);
  } finally {
    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

// --- Web Speech API (Microphone voice input) ---
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || !micBtn) return;

  try {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = false;
    speechRecognizer.interimResults = false;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onstart = () => {
      micBtn.classList.add('listening');
      micBtn.title = 'Listening... Speak now';
    };

    speechRecognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (promptInput) {
        promptInput.value = (promptInput.value ? promptInput.value + ' ' : '') + transcript;
        promptInput.focus();
      }
    };

    speechRecognizer.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      micBtn.classList.remove('listening');
    };

    speechRecognizer.onend = () => {
      micBtn.classList.remove('listening');
      micBtn.title = 'Voice Input (Speech-to-Text)';
    };

    micBtn.addEventListener('click', () => {
      if (micBtn.classList.contains('listening')) {
        speechRecognizer.stop();
      } else {
        speechRecognizer.start();
      }
    });
  } catch (e) {
    console.warn('SpeechRecognition setup skipped', e);
  }
}

// --- Cross-Device Cloud Sync ---
async function syncChatsFromCloud() {
  if (!settings.passphrase) return;
  if (telemetryText) telemetryText.textContent = 'Syncing...';

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
        if (telemetryText) telemetryText.textContent = `Synced (${chats.length})`;
      }
    }
  } catch (err) {
    console.warn('Cloud sync error:', err);
    if (telemetryText) telemetryText.textContent = 'Sync offline';
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
  // Mobile History Drawer Toggle
  if (sidebarMobileBtn && sidebar) {
    sidebarMobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active');
    });
  }

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active');
    });
  }

  if (sidebarBackdrop && sidebar) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', createNewChat);
  }

  if (plusBtn) {
    plusBtn.addEventListener('click', createNewChat);
  }

  // Model Selector
  if (modelSelector) {
    modelSelector.addEventListener('change', () => {
      saveSettings({ defaultModel: modelSelector.value });
      if (failoverBadge) {
        failoverBadge.querySelector('span:last-child').textContent =
          modelSelector.value === 'auto' ? 'Unified AI Active' : `${modelSelector.value} Selected`;
      }
    });
  }

  // Send Actions
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSend);
  }

  if (clearInputBtn && promptInput) {
    clearInputBtn.addEventListener('click', () => {
      promptInput.value = '';
      promptInput.style.height = 'auto';
      clearInputBtn.style.display = 'none';
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
      promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + 'px';
      if (clearInputBtn) {
        clearInputBtn.style.display = promptInput.value.length > 0 ? 'flex' : 'none';
      }
    });
  }

  // File Attachment Button
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const fileContent = event.target.result;
        promptInput.value = `[File: ${file.name}]\n${fileContent.substring(0, 1500)}\n\n` + promptInput.value;
        promptInput.focus();
      };
      reader.readAsText(file);
    });
  }

  // Top Nav Tabs
  if (tabAiChat) {
    tabAiChat.addEventListener('click', () => {
      setActiveNavTab(tabAiChat);
    });
  }
  if (tabDashboard) {
    tabDashboard.addEventListener('click', () => {
      setActiveNavTab(tabDashboard);
      openSettings();
    });
  }
  if (tabHelp) {
    tabHelp.addEventListener('click', () => {
      setActiveNavTab(tabHelp);
      alert('FreeLLM Studio Help:\n• Default model "Unified AI" automatically chooses the fastest provider and fails over on 429 limits.\n• Click the mic icon for voice input.\n• Set a passphrase under Settings to sync chats between mobile and desktop.');
    });
  }
  if (tabAccount) {
    tabAccount.addEventListener('click', () => {
      setActiveNavTab(tabAccount);
      openSettings();
    });
  }

  if (userProfileBtn) {
    userProfileBtn.addEventListener('click', openSettings);
  }

  // Settings Modal
  if (openSyncModalBtn) openSyncModalBtn.addEventListener('click', openSettings);
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      saveSettings({
        backendUrl: settingBackendUrl ? settingBackendUrl.value.trim() : '',
        apiKey: settingApiKey ? settingApiKey.value.trim() : '',
        passphrase: settingPassphrase ? settingPassphrase.value.trim() : '',
      });
      closeSettings();
      if (settings.passphrase) {
        syncChatsFromCloud();
      }
    });
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', async () => {
      if (settingPassphrase) {
        saveSettings({ passphrase: settingPassphrase.value.trim() });
      }
      await syncChatsFromCloud();
      alert('Cross-device synchronization complete!');
    });
  }

  // Reset Session
  if (exitAppBtn) {
    exitAppBtn.addEventListener('click', () => {
      if (confirm('Start fresh session? This clears local chat cache.')) {
        localStorage.removeItem(STORAGE_KEY_CHATS);
        localStorage.removeItem(STORAGE_KEY_ACTIVE);
        chats = [];
        seedMockupConversation();
      }
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

function setActiveNavTab(activeEl) {
  [tabDashboard, tabAiChat, tabHelp, tabAccount].forEach(tab => {
    if (tab) tab.classList.remove('active');
  });
  if (activeEl) activeEl.classList.add('active');
}

function openSettings() {
  if (settingsModal) {
    settingsModal.style.display = 'flex';
    if (settingPassphrase) settingPassphrase.focus();
  }
}

function closeSettings() {
  if (settingsModal) {
    settingsModal.style.display = 'none';
    if (tabAiChat) setActiveNavTab(tabAiChat);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
      }).catch(err => {
        console.warn('ServiceWorker registration error:', err);
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', init);
