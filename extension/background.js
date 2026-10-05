// Recall Flow — Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(async (details) => {
  // Set default settings if not already present
  const data = await chrome.storage.local.get(['recallServerUrl', 'flowEnabled']);
  if (!data.recallServerUrl) {
    await chrome.storage.local.set({
      recallServerUrl: 'http://localhost:3001',
      flowEnabled: true,
    });
  }
});

// Global keyboard shortcut handler (Alt+Space / Option+Space)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate_recall_flow') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://')) {
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_RECALL_FLOW' });
    } catch (err) {
      console.warn('Could not forward command to active tab:', err);
    }
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CHECK_SERVER_STATUS') {
    (async () => {
      try {
        const { recallServerUrl = 'http://localhost:3001' } = await chrome.storage.local.get('recallServerUrl');
        const res = await fetch(`${recallServerUrl}/api/google/status`);
        const data = await res.json();
        sendResponse({ connected: true, data });
      } catch (e) {
        sendResponse({ connected: false, error: 'Could not connect to Recall server' });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.action === 'OPEN_RECALL_APP') {
    (async () => {
      const { recallServerUrl = 'http://localhost:3001' } = await chrome.storage.local.get('recallServerUrl');
      await chrome.tabs.create({ url: recallServerUrl });
      sendResponse({ success: true });
    })();
    return true;
  }
});
