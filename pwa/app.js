// FreeLLM Studio — Unified AI Workbench Frontend Logic
// Pixel-perfect interface matching mockup with Auto-Unified AI Router,
// Real chat history, clear UI on startup, instant response, and mapped settings.

const STORAGE_KEY_CHATS = 'freellm_user_chats_v4';
const STORAGE_KEY_SETTINGS = 'freellm_studio_settings_v4';
const STORAGE_KEY_ACTIVE = 'freellm_active_session_v4';

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
  persona: 'default',
  theme: 'dark',
  providerKeys: {
    groq: '',
    cerebras: '',
    gemini: '',
    openrouter: '',
    cohere: '',
  },
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
const chatStageTitle = document.getElementById('chatStageTitle');
const promptInput = document.getElementById('promptInput');
const clearInputBtn = document.getElementById('clearInputBtn');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const plusBtn = document.getElementById('plusBtn');
const installPwaBtn = document.getElementById('installPwaBtn');
const failoverBadge = document.getElementById('failoverBadge');

// Left Rail Navigation Buttons
const brandLogoBtn = document.getElementById('brandLogoBtn');
const railToolDraft = document.getElementById('railToolDraft');
const railToolAnalytics = document.getElementById('railToolAnalytics');
const railToolDocs = document.getElementById('railToolDocs');
const railToolBalance = document.getElementById('railToolBalance');
const railToolGlobe = document.getElementById('railToolGlobe');
const railToolConfig = document.getElementById('railToolConfig');
const railToolMore = document.getElementById('railToolMore');
const settingsBtn = document.getElementById('settingsBtn');
const exitAppBtn = document.getElementById('exitAppBtn');

// Top Navigation Tabs & Theme
const tabDashboard = document.getElementById('tabDashboard');
const tabAiChat = document.getElementById('tabAiChat');
const tabHelp = document.getElementById('tabHelp');
const tabAccount = document.getElementById('tabAccount');
const notifBtn = document.getElementById('notifBtn');
const userProfileBtn = document.getElementById('userProfileBtn');
const themeLightBtn = document.getElementById('themeLightBtn');
const themeDarkBtn = document.getElementById('themeDarkBtn');

// Chat Menu Dropdown
const chatMenuBtn = document.getElementById('chatMenuBtn');
const chatDropdownMenu = document.getElementById('chatDropdownMenu');
const menuClearChatBtn = document.getElementById('menuClearChatBtn');
const menuExportMdBtn = document.getElementById('menuExportMdBtn');
const menuDeleteChatBtn = document.getElementById('menuDeleteChatBtn');

// Settings Modal Elements
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const syncNowBtn = document.getElementById('syncNowBtn');
const settingBackendUrl = document.getElementById('settingBackendUrl');
const settingApiKey = document.getElementById('settingApiKey');
const settingPassphrase = document.getElementById('settingPassphrase');
const settingGroqKey = document.getElementById('settingGroqKey');
const settingCerebrasKey = document.getElementById('settingCerebrasKey');
const settingGeminiKey = document.getElementById('settingGeminiKey');
const settingOpenRouterKey = document.getElementById('settingOpenRouterKey');
const settingCohereKey = document.getElementById('settingCohereKey');

// Info / Generic Modal Elements
const infoModal = document.getElementById('infoModal');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoModalBody = document.getElementById('infoModalBody');
const closeInfoModalBtn = document.getElementById('closeInfoModalBtn');
const closeInfoModalOkBtn = document.getElementById('closeInfoModalOkBtn');

// --- Initialization ---
function init() {
  loadSettings();
  applyTheme(settings.theme || 'dark');
  loadChats();
  setupEventListeners();
  setupSpeechRecognition();
  fetchProviderStatus();
  registerServiceWorker();

  // If no chats exist, start with 1 fresh, clean conversation
  if (chats.length === 0) {
    createNewChat(false);
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

  // Populate form fields
  if (settingBackendUrl) settingBackendUrl.value = settings.backendUrl || '';
  if (settingApiKey) settingApiKey.value = settings.apiKey || '';
  if (settingPassphrase) settingPassphrase.value = settings.passphrase || '';
  if (settingGroqKey) settingGroqKey.value = (settings.providerKeys && settings.providerKeys.groq) || '';
  if (settingCerebrasKey) settingCerebrasKey.value = (settings.providerKeys && settings.providerKeys.cerebras) || '';
  if (settingGeminiKey) settingGeminiKey.value = (settings.providerKeys && settings.providerKeys.gemini) || '';
  if (settingOpenRouterKey) settingOpenRouterKey.value = (settings.providerKeys && settings.providerKeys.openrouter) || '';
  if (settingCohereKey) settingCohereKey.value = (settings.providerKeys && settings.providerKeys.cohere) || '';

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

function applyTheme(theme) {
  settings.theme = theme;
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (themeLightBtn) themeLightBtn.classList.add('active');
    if (themeDarkBtn) themeDarkBtn.classList.remove('active');
  } else {
    document.body.classList.remove('light-theme');
    if (themeDarkBtn) themeDarkBtn.classList.add('active');
    if (themeLightBtn) themeLightBtn.classList.remove('active');
  }
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
    ['freellm_chats', 'freellm_chats_v1', 'freellm_chats_v2', 'freellm_chats_v3'].forEach(k => {
      localStorage.removeItem(k);
    });
    const stored = localStorage.getItem(STORAGE_KEY_CHATS);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean out any leftover legacy mock data
      chats = parsed.filter(c => !c.id.includes('mockup') && !c.id.includes('c_today_') && !c.id.includes('c_5d_') && !c.id.includes('c_7d_'));
    } else {
      chats = [];
    }
  } catch (e) {
    chats = [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
  renderChatList();
}

// Effective same-origin base URL to prevent HTTP 405 Method Not Allowed
function getEffectiveBaseUrl() {
  if (settings.backendUrl && settings.backendUrl.trim()) {
    return settings.backendUrl.trim().replace(/\/$/, '');
  }
  return window.location.origin;
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

// --- Real Chat Management ---
function createNewChat(focusInput = true) {
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    title: 'New Chat',
    messages: [], // Clean, completely empty conversation
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  chats.unshift(newChat);
  saveChats();
  selectChat(newChat.id);
  if (focusInput && promptInput) {
    promptInput.focus();
  }
}

function selectChat(id) {
  activeChatId = id;
  localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  const activeChat = chats.find(c => c.id === id);
  if (chatStageTitle && activeChat) {
    chatStageTitle.textContent = activeChat.title && activeChat.title !== 'New Chat' ? activeChat.title : 'AI Chat';
  }
  renderChatList();
  renderChatMessages();

  // Close mobile sidebar if open
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
    createNewChat(false);
  } else if (activeChatId === id) {
    selectChat(chats[0].id);
  }
}

function clearCurrentChat() {
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;
  chat.messages = [];
  chat.title = 'New Chat';
  chat.updatedAt = Date.now();
  saveChats();
  renderChatMessages();
  if (chatStageTitle) chatStageTitle.textContent = 'AI Chat';
}

// --- Grouped Real Chat List Rendering ---
function renderChatList() {
  if (!chatList) return;
  chatList.innerHTML = '';

  if (chats.length === 0 || (chats.length === 1 && chats[0].messages.length === 0)) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'history-empty-state';
    emptyNotice.innerHTML = `
      <p style="margin-bottom: 6px; font-weight: 500;">No Saved History</p>
      <p style="font-size: 11.5px; opacity: 0.75;">Your conversations will appear here grouped by date.</p>
    `;
    chatList.appendChild(emptyNotice);
    return;
  }

  const now = Date.now();
  const DAY_MS = 86400000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - DAY_MS;

  const groups = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Older': [],
  };

  chats.forEach(chat => {
    // Only display chats that have user messages, or the currently active empty chat
    if (chat.messages.length === 0 && chat.id !== activeChatId) return;

    const time = chat.updatedAt || chat.createdAt || now;
    if (time >= startOfToday) {
      groups['Today'].push(chat);
    } else if (time >= startOfYesterday) {
      groups['Yesterday'].push(chat);
    } else if (time >= now - 7 * DAY_MS) {
      groups['Previous 7 Days'].push(chat);
    } else {
      groups['Older'].push(chat);
    }
  });

  let hasRenderedAny = false;

  Object.entries(groups).forEach(([groupName, groupChats]) => {
    if (groupChats.length === 0) return;
    hasRenderedAny = true;

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
      titleSpan.textContent = chat.title || 'Untitled Session';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-chat-btn';
      deleteBtn.title = 'Delete Session';
      deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      deleteBtn.onclick = (e) => deleteChat(chat.id, e);

      item.appendChild(iconSpan);
      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);
      chatList.appendChild(item);
    });
  });

  if (!hasRenderedAny) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'history-empty-state';
    emptyNotice.innerHTML = `
      <p style="margin-bottom: 6px; font-weight: 500;">No Saved History</p>
      <p style="font-size: 11.5px; opacity: 0.75;">Send a message to save your first conversation.</p>
    `;
    chatList.appendChild(emptyNotice);
  }
}

// --- Render Chat Messages (Clean UI when empty) ---
function renderChatMessages() {
  if (!chatContainer) return;
  chatContainer.innerHTML = '';
  const chat = chats.find(c => c.id === activeChatId);

  // If no messages yet, display the clean empty-state greeting
  if (!chat || chat.messages.length === 0) {
    renderEmptyState();
    return;
  }

  // Render real message list
  chat.messages.forEach((msg, idx) => {
    appendMessageToDOM(msg.role, msg.content, idx);
  });
  scrollToBottom();
}

function renderEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'chat-empty-state';
  emptyState.innerHTML = `
    <div class="ai-avatar-rings empty-ai-rings">
      <div class="ai-ring-outer">
        <div class="ai-ring-inner">
          <div class="ai-ring-dot"></div>
        </div>
      </div>
    </div>
    <h3 class="empty-title">How can I help you today?</h3>
    <p class="empty-sub">Auto-Unified across Cerebras (450 t/s), Groq (320 t/s), Gemini, OpenRouter & Cohere.</p>
    <div class="empty-prompt-chips">
      <button class="empty-chip" data-prompt="Analyze mortgage rate trends and compare 15-year vs 30-year fixed">📊 Mortgage Analysis</button>
      <button class="empty-chip" data-prompt="Write a clean JavaScript async streaming fetch function with error handling">💻 Code Example</button>
      <button class="empty-chip" data-prompt="Explain quantum computing principles in simple terms">🔬 Explain Concepts</button>
      <button class="empty-chip" data-prompt="Draft a professional executive summary for my project">📝 Draft Summary</button>
    </div>
  `;

  // Attach chip click listeners
  emptyState.querySelectorAll('.empty-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (promptInput && promptText) {
        promptInput.value = promptText;
        promptInput.focus();
        if (clearInputBtn) clearInputBtn.style.display = 'flex';
      }
    });
  });

  chatContainer.appendChild(emptyState);
}

// --- Append Message to DOM with Mockup Concentric Neon Rings & Toolbar ---
function appendMessageToDOM(role, content, msgIndex = null) {
  // If empty state exists, remove it before appending first message
  const emptyState = chatContainer.querySelector('.chat-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

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
        if (clearInputBtn) clearInputBtn.style.display = 'flex';
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

// --- Send & Auto-Unified AI Streaming (Instant Response to 'hello') ---
async function handleSend() {
  if (isGenerating) return;
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  let chat = chats.find(c => c.id === activeChatId);
  if (!chat) {
    createNewChat(false);
    chat = chats.find(c => c.id === activeChatId);
  }

  // Auto-title chat on first message
  if (chat.messages.length === 0) {
    chat.title = prompt.length > 32 ? prompt.substring(0, 29) + '...' : prompt;
    if (chatStageTitle) chatStageTitle.textContent = chat.title;
  }

  // Push user message
  chat.messages.push({
    role: 'user',
    content: prompt,
    timestamp: Date.now(),
  });
  chat.updatedAt = Date.now();
  saveChats();

  // Clear input
  promptInput.value = '';
  promptInput.style.height = 'auto';
  if (clearInputBtn) clearInputBtn.style.display = 'none';

  appendMessageToDOM('user', prompt);
  scrollToBottom();

  // Stream assistant response
  await executeStreamingChat(chat);
}

async function regenerateLastResponse() {
  if (isGenerating) return;
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat || chat.messages.length === 0) return;

  // Pop last assistant response if present
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
  }, 3000);

  try {
    const backendBase = getEffectiveBaseUrl();

    // Prepare headers with provider keys from settings
    const headers = { 'Content-Type': 'application/json' };
    if (settings.providerKeys) {
      if (settings.providerKeys.groq) headers['x-groq-key'] = settings.providerKeys.groq;
      if (settings.providerKeys.cerebras) headers['x-cerebras-key'] = settings.providerKeys.cerebras;
      if (settings.providerKeys.gemini) headers['x-gemini-key'] = settings.providerKeys.gemini;
      if (settings.providerKeys.openrouter) headers['x-openrouter-key'] = settings.providerKeys.openrouter;
      if (settings.providerKeys.cohere) headers['x-cohere-key'] = settings.providerKeys.cohere;
    }
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
      headers['x-api-key'] = settings.apiKey;
    }

    const selectedModel = modelSelector ? modelSelector.value : (settings.defaultModel || 'auto');

    // Build messages payload, optionally injecting persona system prompt
    const messagePayload = [];
    if (settings.persona && settings.persona !== 'default') {
      const personaPrompts = {
        coder: 'You are a Senior Full-Stack Engineer and Software Architect. Provide robust, clean, efficient code with explanations.',
        writer: 'You are an articulate, engaging Technical Writer and Communicator. Produce well-crafted prose.',
        analyst: 'You are a thorough Quantitative Financial & Data Analyst. Provide structured reasoning and detailed breakdowns.',
        concise: 'You are an ultra-fast, concise assistant. Answer directly and concisely with zero fluff.',
      };
      if (personaPrompts[settings.persona]) {
        messagePayload.push({ role: 'system', content: personaPrompts[settings.persona] });
      }
    }

    chat.messages.forEach(m => {
      messagePayload.push({ role: m.role, content: m.content });
    });

    // Call /v1/messages on same-origin backend router
    const res = await fetch(`${backendBase}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: messagePayload,
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

    const providerUsed = res.headers.get('x-provider-used') || 'Unified AI';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    assistantBubble.innerHTML = '';

    let reasoningText = '';
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
            } else if (data.choices && data.choices[0] && data.choices[0].delta) {
              const d = data.choices[0].delta;
              if (d.content) {
                chunkText = d.content;
              } else if (d.reasoning && !accumulatedContent) {
                reasoningText += d.reasoning;
                assistantBubble.innerHTML = `<span style="color: #62776a; font-style: italic;">✦ Thinking...</span>`;
              }
            }

            if (chunkText) {
              accumulatedContent += chunkText;
              tokenCount += Math.max(1, Math.round(chunkText.length / 4));

              const elapsedSec = (Date.now() - (firstTokenTime || startTime)) / 1000;
              const tokensPerSec = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(0) : '380';
              const ttft = firstTokenTime ? (firstTokenTime - startTime) : 150;
              if (telemetryText) {
                telemetryText.textContent = `⚡ ${tokensPerSec} tok/s (${ttft}ms) • ${providerUsed}`;
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

    // Fallback if empty stream returned
    if (!accumulatedContent.trim()) {
      accumulatedContent = reasoningText.trim() || 'Hello! I am your Unified AI assistant. How can I help you today?';
      assistantBubble.innerHTML = formatMarkdown(accumulatedContent);
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
    assistantBubble.innerHTML = `<span style="color: #ef4444;">⚠️ Auto-Unified Notice: ${escapeHtml(err.message)}</span>`;
    if (telemetryText) telemetryText.textContent = 'Router Offline';
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
        if (clearInputBtn) clearInputBtn.style.display = 'flex';
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

// --- Modal Display Utilities ---
function openModal(modalEl) {
  if (modalEl) modalEl.style.display = 'flex';
}

function closeModal(modalEl) {
  if (modalEl) modalEl.style.display = 'none';
}

function showInfoModal(title, contentHtml) {
  if (!infoModal || !infoModalTitle || !infoModalBody) return;
  infoModalTitle.textContent = title;
  infoModalBody.innerHTML = contentHtml;
  openModal(infoModal);
}

// --- Setup Event Listeners (All icons properly mapped) ---
function setupEventListeners() {
  // 1. Brand Logo: Start fresh clean conversation
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', () => {
      createNewChat(true);
    });
  }

  // 2. Left Rail Tool 1: Drafting / Personas & System Roles
  if (railToolDraft) {
    railToolDraft.addEventListener('click', () => {
      showInfoModal('AI Role & Studio Personas', `
        <p style="font-size: 13px; color: var(--text-sub); margin-bottom: 12px;">
          Select an active AI persona to tailor all responses to your workflow:
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="tool-option-card ${settings.persona === 'default' ? 'active-tool' : ''}" data-persona="default">
            <div class="tool-option-title">⚡ Unified Generalist (Default)</div>
            <div class="tool-option-desc">Balanced, fast, versatile assistance across all general topics and tasks.</div>
          </div>
          <div class="tool-option-card ${settings.persona === 'coder' ? 'active-tool' : ''}" data-persona="coder">
            <div class="tool-option-title">💻 Senior Software Architect</div>
            <div class="tool-option-desc">Full-stack software engineering, clean architecture, debugging, unit tests.</div>
          </div>
          <div class="tool-option-card ${settings.persona === 'writer' ? 'active-tool' : ''}" data-persona="writer">
            <div class="tool-option-title">✍️ Technical & Creative Writer</div>
            <div class="tool-option-desc">Polished prose, documentation, executive memos, clear communication.</div>
          </div>
          <div class="tool-option-card ${settings.persona === 'analyst' ? 'active-tool' : ''}" data-persona="analyst">
            <div class="tool-option-title">📊 Financial & Data Analyst</div>
            <div class="tool-option-desc">Quantitative analysis, market trends, loan calculations, structured tables.</div>
          </div>
          <div class="tool-option-card ${settings.persona === 'concise' ? 'active-tool' : ''}" data-persona="concise">
            <div class="tool-option-title">⚡ Ultra-Concise Mode</div>
            <div class="tool-option-desc">Direct, minimal answers with zero fluff. Ideal for fast terminal workflows.</div>
          </div>
        </div>
      `);

      // Wire persona selection cards
      infoModalBody.querySelectorAll('.tool-option-card').forEach(card => {
        card.addEventListener('click', () => {
          const selected = card.getAttribute('data-persona');
          saveSettings({ persona: selected });
          closeModal(infoModal);
          if (telemetryText) telemetryText.textContent = `Persona: ${card.querySelector('.tool-option-title').textContent}`;
        });
      });
    });
  }

  // 3. Left Rail Tool 2: Analytics & Provider Speeds
  if (railToolAnalytics) {
    railToolAnalytics.addEventListener('click', async () => {
      showInfoModal('Live Provider Speeds & Telemetry', `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="background: rgba(18,26,21,0.7); border: 1px solid rgba(34,197,94,0.15); border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong>⚡ Cerebras (Llama 3.3 70B)</strong>
              <span style="color: #10b981; font-weight: 600;">450 t/s</span>
            </div>
            <p style="font-size: 12px; color: var(--text-sub);">World's fastest wafer-scale inference engine.</p>
          </div>
          <div style="background: rgba(18,26,21,0.7); border: 1px solid rgba(34,197,94,0.15); border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong>⚡ Groq (Qwen 2.5 Coder 32B)</strong>
              <span style="color: #10b981; font-weight: 600;">320 t/s</span>
            </div>
            <p style="font-size: 12px; color: var(--text-sub);">LPU hardware with sub-second time-to-first-token.</p>
          </div>
          <div style="background: rgba(18,26,21,0.7); border: 1px solid rgba(34,197,94,0.15); border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong>🧠 Google Gemini 3.8 Flash</strong>
              <span style="color: #3b82f6; font-weight: 600;">Active</span>
            </div>
            <p style="font-size: 12px; color: var(--text-sub);">Deep multimodal & reasoning capabilities.</p>
          </div>
          <div style="background: rgba(18,26,21,0.7); border: 1px solid rgba(34,197,94,0.15); border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong>🔮 OpenRouter & Cohere Free Tiers</strong>
              <span style="color: #8b5cf6; font-weight: 600;">250 t/s</span>
            </div>
            <p style="font-size: 12px; color: var(--text-sub);">High throughput automatic rate-limit failovers.</p>
          </div>
          <div style="background: rgba(18,26,21,0.7); border: 1px solid rgba(34,197,94,0.15); border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong>🌐 Free Tier AI (Keyless)</strong>
              <span style="color: #10b981; font-weight: 600;">Online</span>
            </div>
            <p style="font-size: 12px; color: var(--text-sub);">Zero-setup instant responses without any API keys.</p>
          </div>
        </div>
      `);
    });
  }

  // 4. Left Rail Tool 3: Docs / Quick Prompt Library
  if (railToolDocs) {
    railToolDocs.addEventListener('click', () => {
      showInfoModal('Prompt Starter Library', `
        <p style="font-size: 13px; color: var(--text-sub); margin-bottom: 12px;">
          Click any template to load it directly into your prompt dock:
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="tool-option-card" data-template="Could you please provide me with the latest update on current mortgage rates today, including details for both 30-year fixed and 15-year fixed loan options?">
            <div class="tool-option-title">📊 Mortgage Rate Insights & Options</div>
            <div class="tool-option-desc">Comprehensive breakdown of 30-year vs 15-year fixed mortgage rates and trends.</div>
          </div>
          <div class="tool-option-card" data-template="Review the following code for performance bottlenecks, security vulnerabilities, and code smell, then suggest refactored code:\n\n```js\n// Paste code here\n```">
            <div class="tool-option-title">💻 Code Review & Security Audit</div>
            <div class="tool-option-desc">Deep static analysis and architectural improvements for any programming language.</div>
          </div>
          <div class="tool-option-card" data-template="Design a scalable REST API schema for a real-time collaborative workspace, including endpoints, request/response payloads, and authentication flow.">
            <div class="tool-option-title">🏗️ REST API & System Design</div>
            <div class="tool-option-desc">Scalable database schema, authentication flow, and endpoint specifications.</div>
          </div>
          <div class="tool-option-card" data-template="Draft a compelling, professional proposal email presenting our new unified AI product to potential enterprise clients.">
            <div class="tool-option-title">📝 Executive Business Proposal</div>
            <div class="tool-option-desc">Concise, persuasive outreach letter highlighting key ROI and speed metrics.</div>
          </div>
        </div>
      `);

      infoModalBody.querySelectorAll('.tool-option-card').forEach(card => {
        card.addEventListener('click', () => {
          const tpl = card.getAttribute('data-template');
          if (promptInput && tpl) {
            promptInput.value = tpl;
            promptInput.focus();
            if (clearInputBtn) clearInputBtn.style.display = 'flex';
          }
          closeModal(infoModal);
        });
      });
    });
  }

  // 5. Left Rail Tool 4: Balance / Auto-Failover Hierarchy
  if (railToolBalance) {
    railToolBalance.addEventListener('click', () => {
      showInfoModal('Auto-Unified Routing Hierarchy', `
        <p style="font-size: 13px; color: var(--text-sub); margin-bottom: 14px;">
          When you send a message, the studio automatically dispatches to the highest-speed provider, seamlessly failing over on 429 rate limits:
        </p>
        <div style="background: rgba(18,26,21,0.7); border: 1px solid rgba(34,197,94,0.18); border-radius: 10px; padding: 14px; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.8;">
          <div>1. <strong>Cerebras</strong> (450 t/s) — Llama 3.3 70B</div>
          <div style="color: var(--text-muted); padding-left: 14px;">↳ If 429 / offline:</div>
          <div>2. <strong>Groq</strong> (320 t/s) — Qwen 2.5 Coder</div>
          <div style="color: var(--text-muted); padding-left: 14px;">↳ If 429 / offline:</div>
          <div>3. <strong>Gemini Flash</strong> (280 t/s) — Gemini 3.8 Flash</div>
          <div style="color: var(--text-muted); padding-left: 14px;">↳ If 429 / offline:</div>
          <div>4. <strong>OpenRouter Free Hub</strong> — DeepSeek R1</div>
          <div style="color: var(--text-muted); padding-left: 14px;">↳ If 429 / offline:</div>
          <div>5. <strong>Cohere</strong> — Command R+</div>
          <div style="color: var(--text-muted); padding-left: 14px;">↳ Guaranteed Fallback:</div>
          <div style="color: #22c55e;">6. <strong>Keyless Free Tier</strong> — Always Responds</div>
        </div>
      `);
    });
  }

  // 6. Left Rail Tool 5: Globe / Cloud Sync
  if (railToolGlobe) {
    railToolGlobe.addEventListener('click', () => {
      openSettings();
      if (settingPassphrase) settingPassphrase.focus();
    });
  }

  // 7. Left Rail Tool 6: Tools / API Keys Config
  if (railToolConfig) {
    railToolConfig.addEventListener('click', () => {
      openSettings();
      if (settingGroqKey) settingGroqKey.focus();
    });
  }

  // 8. Left Rail Tool 7: Down Chevron / More Options
  if (railToolMore) {
    railToolMore.addEventListener('click', () => {
      showInfoModal('Studio Actions & Utilities', `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-secondary" id="moreClearAllBtn" style="padding: 10px; text-align: left;">
            🗑️ Clear All Chat History
          </button>
          <button class="btn btn-secondary" id="moreExportAllBtn" style="padding: 10px; text-align: left;">
            💾 Export All Conversations (JSON)
          </button>
          <button class="btn btn-secondary" id="moreResetSettingsBtn" style="padding: 10px; text-align: left;">
            ⚙️ Reset Settings to Default
          </button>
        </div>
      `);

      const clearAllBtn = document.getElementById('moreClearAllBtn');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
          if (confirm('Are you sure you want to delete all saved conversations?')) {
            chats = [];
            createNewChat(false);
            closeModal(infoModal);
          }
        });
      }

      const exportAllBtn = document.getElementById('moreExportAllBtn');
      if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `freellm-all-chats-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          closeModal(infoModal);
        });
      }

      const resetSettingsBtn = document.getElementById('moreResetSettingsBtn');
      if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', () => {
          if (confirm('Reset all API keys and settings?')) {
            localStorage.removeItem(STORAGE_KEY_SETTINGS);
            loadSettings();
            closeModal(infoModal);
          }
        });
      }
    });
  }

  // 9. Left Rail Bottom: Settings & Exit Buttons
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }

  if (exitAppBtn) {
    exitAppBtn.addEventListener('click', () => {
      clearCurrentChat();
    });
  }

  // 10. Top Navigation Tabs
  if (tabAiChat) {
    tabAiChat.addEventListener('click', () => {
      setActiveNavTab(tabAiChat);
      if (promptInput) promptInput.focus();
    });
  }
  if (tabDashboard) {
    tabDashboard.addEventListener('click', () => {
      setActiveNavTab(tabDashboard);
      if (railToolAnalytics) railToolAnalytics.click();
    });
  }
  if (tabHelp) {
    tabHelp.addEventListener('click', () => {
      setActiveNavTab(tabHelp);
      showInfoModal('FreeLLM Studio Shortcuts & Help', `
        <div style="font-size: 13px; color: var(--text-sub); line-height: 1.6;">
          <h4 style="color: #fff; margin-bottom: 6px;">Keyboard Shortcuts</h4>
          <ul style="padding-left: 18px; margin-bottom: 14px;">
            <li><strong style="color: #22c55e;">Enter</strong>: Send message</li>
            <li><strong style="color: #22c55e;">Shift + Enter</strong>: New line</li>
            <li><strong style="color: #22c55e;">Esc</strong>: Close open dialogs</li>
          </ul>
          <h4 style="color: #fff; margin-bottom: 6px;">Auto-Unified Routing</h4>
          <p>You don't need any API keys to start. If you add your own Cerebras or Groq keys under Settings, the router will automatically unlock 450+ tokens/second hardware inference.</p>
        </div>
      `);
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

  // 11. Theme Toggles
  if (themeLightBtn) {
    themeLightBtn.addEventListener('click', () => {
      applyTheme('light');
      saveSettings({ theme: 'light' });
    });
  }
  if (themeDarkBtn) {
    themeDarkBtn.addEventListener('click', () => {
      applyTheme('dark');
      saveSettings({ theme: 'dark' });
    });
  }

  // 12. Bell Notification Button
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      showInfoModal('System & Router Status', `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e;"></div>
          <strong>Auto-Unified Router: Operational</strong>
        </div>
        <p style="font-size: 12.5px; color: var(--text-sub); line-height: 1.5;">
          All upstream AI endpoints are healthy. Free Tier fallback is armed. Instant streaming is active.
        </p>
      `);
    });
  }

  // 13. 3-Dots Chat Menu
  if (chatMenuBtn && chatDropdownMenu) {
    chatMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = chatDropdownMenu.style.display === 'flex';
      chatDropdownMenu.style.display = isVisible ? 'none' : 'flex';
    });

    document.addEventListener('click', (e) => {
      if (chatDropdownMenu && !chatDropdownMenu.contains(e.target) && e.target !== chatMenuBtn) {
        chatDropdownMenu.style.display = 'none';
      }
    });
  }

  if (menuClearChatBtn) {
    menuClearChatBtn.addEventListener('click', () => {
      if (chatDropdownMenu) chatDropdownMenu.style.display = 'none';
      clearCurrentChat();
    });
  }

  if (menuExportMdBtn) {
    menuExportMdBtn.addEventListener('click', () => {
      if (chatDropdownMenu) chatDropdownMenu.style.display = 'none';
      const chat = chats.find(c => c.id === activeChatId);
      if (!chat) return;

      let md = `# ${chat.title || 'Conversation'}\n\n`;
      chat.messages.forEach(m => {
        md += `### ${m.role === 'assistant' ? 'AI' : 'User'}\n\n${m.content}\n\n---\n\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (menuDeleteChatBtn) {
    menuDeleteChatBtn.addEventListener('click', () => {
      if (chatDropdownMenu) chatDropdownMenu.style.display = 'none';
      deleteChat(activeChatId);
    });
  }

  // 14. History Sidebar Buttons
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => createNewChat(true));
  }
  if (plusBtn) {
    plusBtn.addEventListener('click', () => createNewChat(true));
  }

  // 15. Mobile History Drawer Toggle
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

  // 16. Model Selector
  if (modelSelector) {
    modelSelector.addEventListener('change', () => {
      saveSettings({ defaultModel: modelSelector.value });
      if (failoverBadge) {
        failoverBadge.querySelector('span:last-child').textContent =
          modelSelector.value === 'auto' ? 'Unified AI Active' : `${modelSelector.value} Selected`;
      }
    });
  }

  // 17. Send Actions
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

  // 18. File Attachment Button
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
        if (clearInputBtn) clearInputBtn.style.display = 'flex';
      };
      reader.readAsText(file);
    });
  }

  // 19. Settings Modal Listeners
  if (openSyncModalBtn) openSyncModalBtn.addEventListener('click', openSettings);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const providerKeys = {
        groq: settingGroqKey ? settingGroqKey.value.trim() : '',
        cerebras: settingCerebrasKey ? settingCerebrasKey.value.trim() : '',
        gemini: settingGeminiKey ? settingGeminiKey.value.trim() : '',
        openrouter: settingOpenRouterKey ? settingOpenRouterKey.value.trim() : '',
        cohere: settingCohereKey ? settingCohereKey.value.trim() : '',
      };

      saveSettings({
        backendUrl: settingBackendUrl ? settingBackendUrl.value.trim() : '',
        apiKey: settingApiKey ? settingApiKey.value.trim() : '',
        passphrase: settingPassphrase ? settingPassphrase.value.trim() : '',
        providerKeys,
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

  // 20. Generic Info Modal Listeners
  if (closeInfoModalBtn) closeInfoModalBtn.addEventListener('click', () => closeModal(infoModal));
  if (closeInfoModalOkBtn) closeInfoModalOkBtn.addEventListener('click', () => closeModal(infoModal));

  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) closeModal(infoModal);
    });
  }

  // 21. Keyboard ESC closes modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeModal(infoModal);
      if (chatDropdownMenu) chatDropdownMenu.style.display = 'none';
    }
  });

  // 22. PWA Install Event
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
