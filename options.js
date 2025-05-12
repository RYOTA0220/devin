/**
 * Gemini Reply Generator for X/Note - Options Page Script
 * Handles settings UI and storage
 */

const apiKeyInput = document.getElementById('apiKey');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const testApiBtn = document.getElementById('testApiBtn');
const promptTextarea = document.getElementById('prompt');
const enableTwitterCheckbox = document.getElementById('enableTwitter');
const enableNoteCheckbox = document.getElementById('enableNote');
const saveBtn = document.getElementById('saveBtn');
const apiStatus = document.getElementById('apiStatus');
const saveStatus = document.getElementById('saveStatus');
const extensionEnabledToggle = document.getElementById('extensionEnabled');

const DEFAULT_GEMINI_PROMPT = 'このテキストに対して、丁寧かつ簡潔な返信を考えてください。相手の意見を尊重し、建設的な内容を心がけてください。';
const DEFAULT_GEMINI_API_KEY = ''; // User must provide their own API key
const GEMINI_MODEL = 'models/gemini-2.5-flash-preview-04-17';

function loadSettings() {
  chrome.storage.local.get(['geminiApiKey', 'geminiPrompt', 'enabledDomains', 'extensionEnabled'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    } else {
      apiKeyInput.value = DEFAULT_GEMINI_API_KEY;
    }
    
    if (result.geminiPrompt) {
      promptTextarea.value = result.geminiPrompt;
    } else {
      promptTextarea.value = DEFAULT_GEMINI_PROMPT;
    }
    
    if (result.enabledDomains) {
      enableTwitterCheckbox.checked = result.enabledDomains.twitter !== false;
      enableNoteCheckbox.checked = result.enabledDomains.note !== false;
    }
    
    if (result.extensionEnabled !== undefined) {
      extensionEnabledToggle.checked = result.extensionEnabled;
    } else {
      extensionEnabledToggle.checked = true; // デフォルトで有効
    }
  });
}

function saveSettings() {
  const settings = {
    geminiApiKey: apiKeyInput.value.trim(),
    geminiPrompt: promptTextarea.value.trim() || DEFAULT_GEMINI_PROMPT,
    geminiModel: GEMINI_MODEL,
    enabledDomains: {
      twitter: enableTwitterCheckbox.checked,
      note: enableNoteCheckbox.checked
    },
    extensionEnabled: extensionEnabledToggle.checked
  };
  
  chrome.storage.local.set(settings, () => {
    showStatus(saveStatus, '設定を保存しました', 'success');
  });
}

async function testApiKey() {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showStatus(apiStatus, 'APIキーを入力してください', 'error');
    return;
  }
  
  try {
    showStatus(apiStatus, 'APIキーをテスト中...', 'info');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    
    const data = await response.json();
    
    if (response.ok) {
      showStatus(apiStatus, 'Gemini APIキーは有効です', 'success');
    } else {
      showStatus(apiStatus, `APIキーエラー: ${data.error?.message || '不明なエラー'}`, 'error');
    }
  } catch (error) {
    showStatus(apiStatus, `接続エラー: ${error.message}`, 'error');
  }
}

function toggleApiKeyVisibility() {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleVisibilityBtn.textContent = '🔒';
  } else {
    apiKeyInput.type = 'password';
    toggleVisibilityBtn.textContent = '👁️';
  }
}

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = 'status-message';
  element.classList.add(type);
  element.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      element.style.display = 'none';
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', loadSettings);
saveBtn.addEventListener('click', saveSettings);
testApiBtn.addEventListener('click', testApiKey);
toggleVisibilityBtn.addEventListener('click', toggleApiKeyVisibility);

extensionEnabledToggle.addEventListener('change', () => {
  saveSettings();
  
  const iconState = extensionEnabledToggle.checked ? 'active' : 'inactive';
  chrome.runtime.sendMessage({
    action: 'updateIcon',
    state: iconState
  });
});
