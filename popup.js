/**
 * Gemini Reply Generator for X/Note - Popup Script
 * Handles extension toggle functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('extensionToggle');
  const statusText = document.getElementById('statusText');
  
  chrome.storage.local.get(['extensionEnabled'], function(result) {
    const isEnabled = result.extensionEnabled !== false; // デフォルトで有効
    toggleSwitch.checked = isEnabled;
    updateStatusText(isEnabled);
  });
  
  toggleSwitch.addEventListener('change', function() {
    const isEnabled = toggleSwitch.checked;
    
    chrome.storage.local.set({extensionEnabled: isEnabled}, function() {
      console.log('拡張機能の状態を保存しました:', isEnabled ? '有効' : '無効');
      
      chrome.runtime.sendMessage({
        action: 'updateIcon',
        state: isEnabled ? 'active' : 'inactive'
      });
      
      updateStatusText(isEnabled);
    });
  });
  
  function updateStatusText(isEnabled) {
    if (isEnabled) {
      statusText.textContent = '有効';
      statusText.className = 'status enabled';
    } else {
      statusText.textContent = '無効';
      statusText.className = 'status disabled';
    }
  }
});
