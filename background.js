/**
 * Gemini Reply Generator for X/Note - Background Script
 * Handles Google Gemini API communication
 */

const DEFAULT_GEMINI_API_KEY = ''; // User must provide their own API key
const GEMINI_MODEL = 'models/gemini-2.5-flash-preview-04-17';

let extensionEnabled = true;

chrome.storage.local.get(['extensionEnabled'], (result) => {
  if (result.extensionEnabled !== undefined) {
    extensionEnabled = result.extensionEnabled;
    updateExtensionIcon(extensionEnabled ? 'active' : 'inactive');
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReply') {
    if (!extensionEnabled) {
      sendResponse({ error: '拡張機能が無効になっています。設定から有効にしてください。' });
      return true;
    }
    
    generateGeminiReply(request.text, request.prompt, request.geminiApiKey)
      .then(reply => {
        sendResponse({ reply });
      })
      .catch(error => {
        console.error('Error generating reply:', error);
        sendResponse({ error: getErrorMessage(error) });
      });
    
    return true;
  }
  
  if (request.action === 'updateIcon') {
    extensionEnabled = request.state === 'active';
    updateExtensionIcon(request.state);
    return false;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "gpt-reply-port") {
    port.onMessage.addListener((request) => {
      if (request.action === 'generateReply') {
        if (!extensionEnabled) {
          port.postMessage({ error: '拡張機能が無効になっています。設定から有効にしてください。' });
          return;
        }
        
        generateGeminiReply(request.text, request.prompt, request.geminiApiKey)
          .then(reply => {
            port.postMessage({ reply });
          })
          .catch(error => {
            console.error('Error generating reply:', error);
            port.postMessage({ error: getErrorMessage(error) });
          });
      }
    });
  }
});

async function generateGeminiReply(text, prompt, apiKey) {
  const geminiApiKey = apiKey || DEFAULT_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
  
  try {
    console.log('Generating reply with Gemini API');
    console.log('- Model:', GEMINI_MODEL);
    console.log('- API key exists:', !!geminiApiKey);
    console.log('- Text length:', text.length);
    console.log('- Prompt length:', prompt.length);
    
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt + "\n\n" + text }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.9,
        topK: 40
      }
    };
    
    console.log('Sending request to Gemini API');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    console.log('Received response from Gemini API');
    
    if (!response.ok) {
      throw new Error(data.error?.message || `API error: ${response.status}`);
    }
    
    let generatedText = '';
    
    if (data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0]) {
      
      const part = data.candidates[0].content.parts[0];
      
      if (typeof part === 'object' && part.text) {
        generatedText = part.text.trim();
        console.log('Found text in parts[0].text');
      } else if (typeof part === 'string') {
        generatedText = part.trim();
        console.log('Found string directly in parts[0]');
      }
    }
    
    if (!generatedText) {
      console.error('No text found in Gemini API response:', data);
      throw new Error('Gemini APIからの応答が無効です');
    }
    
    return generatedText;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

function getErrorMessage(error) {
  const errorMessage = error.message || String(error);
  
  if (errorMessage.includes('401') || errorMessage.includes('invalid')) {
    return 'Gemini APIキーが無効か、認証に失敗しました。設定画面でAPIキーを確認してください。';
  } else if (errorMessage.includes('429') || errorMessage.includes('quota')) {
    return 'Gemini APIリクエストの上限に達しました。しばらく時間をおいてから再度お試しください。';
  } else if (errorMessage.includes('500') || errorMessage.includes('server')) {
    return 'Geminiサーバー側でエラーが発生しました。時間をおいて再度お試しください。';
  } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    return 'ネットワーク接続が不安定です。接続を確認してください。';
  }
  
  return `エラーが発生しました: ${errorMessage}`;
}

function updateExtensionIcon(state) {
  const iconPath = state === 'active' ? 
    {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png'
    } : 
    {
      16: 'icons/icon16_disabled.png',
      48: 'icons/icon48_disabled.png',
      128: 'icons/icon128_disabled.png'
    };
  
  chrome.action.setIcon({ path: iconPath });
}
