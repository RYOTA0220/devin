/**
 * Gemini Reply Generator for X/Note - Content Script
 * Handles text selection detection and UI elements in the page
 */

let replyButton = null;
let replyPopup = null;
let selectedText = '';
let isLoading = false;

const DEFAULT_GEMINI_API_KEY = ''; // User must provide their own API key
const DEFAULT_GEMINI_PROMPT = 'このテキストに対して、丁寧かつ簡潔な返信を考えてください。相手の意見を尊重し、建設的な内容を心がけてください。';
const GEMINI_MODEL = 'models/gemini-2.5-flash-preview-04-17';

let config = {
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  geminiPrompt: DEFAULT_GEMINI_PROMPT,
  geminiModel: GEMINI_MODEL,
  enabledDomains: {
    twitter: true,
    note: true
  },
  extensionEnabled: true,
  minSelectedChars: 3
};

function loadConfig() {
  chrome.storage.local.get(['geminiApiKey', 'geminiPrompt', 'geminiModel', 'enabledDomains', 'extensionEnabled'], (result) => {
    if (result.geminiApiKey) config.geminiApiKey = result.geminiApiKey;
    if (result.geminiPrompt) config.geminiPrompt = result.geminiPrompt;
    if (result.geminiModel) config.geminiModel = result.geminiModel;
    if (result.enabledDomains) config.enabledDomains = result.enabledDomains;
    if (result.extensionEnabled !== undefined) config.extensionEnabled = result.extensionEnabled;
    
    console.log('設定を読み込みました');
    console.log('- 拡張機能の状態:', config.extensionEnabled ? '有効' : '無効');
    console.log('- Gemini APIキー:', config.geminiApiKey ? '設定済み' : '未設定');
    console.log('- Geminiモデル:', config.geminiModel);
    
    const currentDomain = window.location.hostname;
    if (!config.extensionEnabled) {
      console.log('拡張機能は無効になっています');
      return;
    }
    
    if (
      (currentDomain.includes('twitter.com') || currentDomain.includes('x.com')) && !config.enabledDomains.twitter ||
      (currentDomain.includes('note.com') && !config.enabledDomains.note)
    ) {
      console.log('現在のドメインでは拡張機能は無効です:', currentDomain);
      return;
    }
    
    console.log('拡張機能は現在のドメインで有効です:', currentDomain);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
});

loadConfig();

document.addEventListener('mouseup', (event) => {
  if (!config.extensionEnabled) {
    return;
  }
  
  removeReplyButton();
  
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
  
  if (selectedText.length < config.minSelectedChars) {
    return;
  }
  
  createReplyButton(selection, event);
});

function createReplyButton(selection, event) {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  replyButton = document.createElement('button');
  replyButton.textContent = '返信を生成する';
  replyButton.id = 'gemini-reply-button';
  replyButton.className = 'gemini-reply-button';
  
  replyButton.style.position = 'absolute';
  replyButton.style.left = `${rect.right + window.scrollX + 5}px`;
  replyButton.style.top = `${rect.bottom + window.scrollY + 5}px`;
  replyButton.style.zIndex = '2147483647';
  replyButton.style.backgroundColor = '#1DA1F2';
  replyButton.style.color = 'white';
  replyButton.style.border = 'none';
  replyButton.style.borderRadius = '15px';
  replyButton.style.padding = '8px 12px';
  replyButton.style.fontSize = '14px';
  replyButton.style.fontWeight = 'bold';
  replyButton.style.cursor = 'pointer';
  replyButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  replyButton.addEventListener('click', handleReplyButtonClick);
  
  document.body.appendChild(replyButton);
  
  console.log('返信ボタンを表示しました');
  
  setTimeout(() => {
    removeReplyButton();
  }, 10000);
}

function removeReplyButton() {
  if (replyButton && replyButton.parentNode) {
    replyButton.parentNode.removeChild(replyButton);
    replyButton = null;
  }
}

function handleReplyButtonClick() {
  console.log('返信ボタンがクリックされました');
  removeReplyButton();
  
  if (!config.extensionEnabled) {
    showReplyPopup('エラー: 拡張機能が無効になっています。設定から有効にしてください。', true);
    return;
  }
  
  if (!config.geminiApiKey) {
    showReplyPopup('エラー: Gemini APIキーが設定されていません。拡張機能のオプションから設定してください。', true);
    return;
  }
  
  showLoadingIndicator();
  
  let processedPrompt = config.geminiPrompt || DEFAULT_GEMINI_PROMPT;
  processedPrompt = processedPrompt.replace(/{{selectedText}}/g, selectedText);
  
  console.log('Gemini APIリクエストを送信します');
  console.log('- テキスト長:', selectedText.length);
  console.log('- プロンプト長:', processedPrompt.length);
  
  chrome.runtime.sendMessage({
    action: 'generateReply',
    text: selectedText,
    prompt: processedPrompt,
    geminiApiKey: config.geminiApiKey
  }, (response) => {
    hideLoadingIndicator();
    
    if (chrome.runtime.lastError) {
      console.error('ランタイムエラー:', chrome.runtime.lastError);
      showReplyPopup(`エラー: ${chrome.runtime.lastError.message || 'バックグラウンドスクリプトとの通信エラー'}`, true);
      return;
    }
    
    if (!response) {
      console.error('応答がありません');
      showReplyPopup('エラー: バックグラウンドスクリプトからの応答がありません。', true);
      return;
    }
    
    if (response.error) {
      console.error('エラー応答:', response.error);
      showReplyPopup(`エラー: ${response.error}`, true);
    } else {
      console.log('返信を受信しました');
      showReplyPopup(response.reply);
    }
  });
}

function showLoadingIndicator() {
  isLoading = true;
  
  let loadingIndicator = document.getElementById('gemini-reply-loading');
  if (!loadingIndicator) {
    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'gemini-reply-loading';
    loadingIndicator.className = 'gemini-reply-loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><div>Geminiが返信を生成中...</div>';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.borderRadius = '10px';
    loadingIndicator.style.zIndex = '2147483647';
    loadingIndicator.style.display = 'flex';
    loadingIndicator.style.flexDirection = 'column';
    loadingIndicator.style.alignItems = 'center';
    loadingIndicator.style.justifyContent = 'center';
    
    document.body.appendChild(loadingIndicator);
  }
}

function hideLoadingIndicator() {
  isLoading = false;
  const loadingIndicator = document.getElementById('gemini-reply-loading');
  if (loadingIndicator) {
    loadingIndicator.parentNode.removeChild(loadingIndicator);
  }
}

function showReplyPopup(content, isError = false) {
  if (replyPopup && replyPopup.parentNode) {
    replyPopup.parentNode.removeChild(replyPopup);
  }
  
  replyPopup = document.createElement('div');
  replyPopup.id = 'gemini-reply-popup';
  replyPopup.className = 'gemini-reply-popup';
  
  replyPopup.style.position = 'fixed';
  replyPopup.style.top = '50%';
  replyPopup.style.left = '50%';
  replyPopup.style.transform = 'translate(-50%, -50%)';
  replyPopup.style.backgroundColor = 'white';
  replyPopup.style.border = '1px solid #ccc';
  replyPopup.style.borderRadius = '10px';
  replyPopup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  replyPopup.style.zIndex = '2147483647';
  replyPopup.style.width = '80%';
  replyPopup.style.maxWidth = '600px';
  replyPopup.style.maxHeight = '80vh';
  replyPopup.style.overflow = 'hidden';
  replyPopup.style.display = 'flex';
  replyPopup.style.flexDirection = 'column';
  
  if (isError) {
    replyPopup.style.borderColor = '#e74c3c';
  }
  
  const popupHTML = `
    <div class="gemini-reply-header" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background-color: ${isError ? '#ffebee' : '#f8f9fa'};">
      <h3 style="margin: 0; font-size: 16px;">🤖 Geminiからの返信案</h3>
      <button class="gemini-reply-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 5px;">×</button>
    </div>
    <div class="gemini-reply-content" style="padding: 15px; flex-grow: 1; overflow-y: auto;">
      <textarea readonly class="gemini-reply-textarea" style="width: 100%; min-height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical; font-family: inherit; font-size: 14px;">${content}</textarea>
    </div>
    <div class="gemini-reply-footer" style="padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
      <button class="gemini-reply-copy-btn" style="background-color: #1DA1F2; color: white; border: none; border-radius: 5px; padding: 8px 12px; cursor: pointer; font-weight: bold;">📝 この内容をコピー</button>
      <span class="gemini-reply-copy-status" style="color: #2ecc71; font-size: 14px;"></span>
    </div>
  `;
  
  replyPopup.innerHTML = popupHTML;
  
  replyPopup.querySelector('.gemini-reply-close-btn').addEventListener('click', () => {
    if (replyPopup && replyPopup.parentNode) {
      replyPopup.parentNode.removeChild(replyPopup);
      replyPopup = null;
    }
  });
  
  replyPopup.querySelector('.gemini-reply-copy-btn').addEventListener('click', () => {
    const textarea = replyPopup.querySelector('.gemini-reply-textarea');
    const copyStatus = replyPopup.querySelector('.gemini-reply-copy-status');
    
    navigator.clipboard.writeText(textarea.value)
      .then(() => {
        copyStatus.textContent = 'コピーしました！';
        setTimeout(() => {
          copyStatus.textContent = '';
        }, 2000);
      })
      .catch(err => {
        copyStatus.textContent = 'コピーに失敗しました';
        console.error('クリップボードへのコピーに失敗しました:', err);
      });
  });
  
  document.body.appendChild(replyPopup);
  
  if (isError) {
    setTimeout(() => {
      if (replyPopup && replyPopup.parentNode) {
        replyPopup.parentNode.removeChild(replyPopup);
        replyPopup = null;
      }
    }, 5000);
  }
}

document.addEventListener('click', (event) => {
  if (
    (replyButton && replyButton.contains(event.target)) ||
    (replyPopup && replyPopup.contains(event.target))
  ) {
    return;
  }
  
  removeReplyButton();
});
