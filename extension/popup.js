// Recall Flow — Extension Popup Script (Manifest V3)
// Handles connectivity check, preference synchronization, and navigation

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const shortcutKey = document.getElementById('shortcut-key');
  const toggleEnabled = document.getElementById('toggle-enabled');
  const selectLanguage = document.getElementById('select-language');
  const toggleAutoMode = document.getElementById('toggle-auto-mode');
  const selectVariant = document.getElementById('select-variant');
  const btnOpenRecall = document.getElementById('btn-open-recall');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  // Detect platform for shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  if (shortcutKey) {
    shortcutKey.textContent = isMac ? '⌥ + Space' : 'Alt + Space';
  }

  // Load saved preferences from chrome.storage
  try {
    const data = await chrome.storage.sync.get([
      'flowEnabled',
      'flowLanguage',
      'flowAutoMode',
      'flowVariant',
    ]);
    if (typeof data.flowEnabled === 'boolean') toggleEnabled.checked = data.flowEnabled;
    if (data.flowLanguage) selectLanguage.value = data.flowLanguage;
    if (typeof data.flowAutoMode === 'boolean') toggleAutoMode.checked = data.flowAutoMode;
    if (data.flowVariant) selectVariant.value = data.flowVariant;
  } catch (err) {
    console.warn('Could not read chrome.storage.sync:', err);
  }

  // Save changes
  toggleEnabled.addEventListener('change', () => {
    chrome.storage.sync.set({ flowEnabled: toggleEnabled.checked });
  });

  selectLanguage.addEventListener('change', () => {
    chrome.storage.sync.set({ flowLanguage: selectLanguage.value });
  });

  toggleAutoMode.addEventListener('change', () => {
    chrome.storage.sync.set({ flowAutoMode: toggleAutoMode.checked });
  });

  selectVariant.addEventListener('change', () => {
    chrome.storage.sync.set({ flowVariant: selectVariant.value });
  });

  // Verify Recall server connectivity
  try {
    const res = await fetch('http://localhost:3001/api/google/status', { method: 'GET' });
    if (res.ok) {
      statusBadge.className = 'status-badge';
      statusText.textContent = 'Connected';
    } else {
      statusBadge.className = 'status-badge disconnected';
      statusText.textContent = 'Server busy';
    }
  } catch (e) {
    statusBadge.className = 'status-badge disconnected';
    statusText.textContent = 'Recall offline';
  }

  // Open Recall web app
  btnOpenRecall.addEventListener('click', async () => {
    await chrome.tabs.create({ url: 'http://localhost:3001' });
    window.close();
  });

  // Open Settings tab
  btnOpenSettings.addEventListener('click', async () => {
    await chrome.tabs.create({ url: 'http://localhost:3001/settings' });
    window.close();
  });
});
