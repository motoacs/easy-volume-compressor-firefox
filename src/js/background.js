/**
 * Easy Volume Compressor - Background Script
 *
 * Manages settings per site/tab and communicates with content scripts.
 */

// Default compressor settings
const DEFAULT_SETTINGS = {
  enabled: true,
  ratio: 4.0,        // Compression ratio
  threshold: -20.0,  // dB threshold
  attack: 0.003,     // Seconds
  release: 0.25,     // Seconds
  outputGain: 0.0    // dB
};

// Store settings per key (domain, file URL, tab-id-X)
let siteSettings = {}; // In-memory cache of settings
const STORAGE_KEY = 'siteSettings'; // Key for browser.storage.local

// --- Initialization ---

// Load settings from storage when the extension starts
async function loadSettingsFromStorage() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      siteSettings = result[STORAGE_KEY];
      console.log("Loaded site settings from storage:", siteSettings);
    } else {
      console.log("No saved site settings found in storage.");
      siteSettings = {}; // Ensure it's an empty object if nothing is loaded
    }
  } catch (error) {
    console.error("Error loading settings from storage:", error);
    siteSettings = {}; // Fallback to empty object on error
  }
}

// Save settings to storage
async function saveSettingsToStorage() {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: siteSettings });
    // console.log("Saved site settings to storage:", siteSettings); // Optional: log on save
  } catch (error) {
    console.error("Error saving settings to storage:", error);
  }
}

// Initialize on install/startup
browser.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated.");
  loadSettingsFromStorage();
});

// Load settings on browser startup as well
browser.runtime.onStartup.addListener(() => {
    console.log("Browser startup.");
    loadSettingsFromStorage();
});


// --- Message Handling ---

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async function to handle promises with sendResponse
  (async () => {
    const key = message.key; // Key provided by popup (domain, file URL, tab-id-X)
    const tabId = message.tabId || sender.tab?.id; // Tab ID from message or sender

    switch (message.type) {
      case 'GET_SETTINGS':
        if (!key) {
          console.warn("GET_SETTINGS request missing key.");
          sendResponse({ settings: { ...DEFAULT_SETTINGS } }); // Send default if no key
          return;
        }
        // Retrieve settings for the specific key, fallback to default if not found
        const settings = siteSettings[key] ? { ...DEFAULT_SETTINGS, ...siteSettings[key] } : { ...DEFAULT_SETTINGS };
        console.log(`GET_SETTINGS for key "${key}", returning:`, settings);
        sendResponse({ settings });
        break;

      case 'UPDATE_SETTINGS':
        if (!key || !message.settings) {
          console.error("UPDATE_SETTINGS request missing key or settings.");
          sendResponse({ error: "Missing key or settings" });
          return;
        }
        if (!tabId) {
             console.error("UPDATE_SETTINGS request missing tabId.");
             sendResponse({ error: "Missing tabId" });
             return;
        }

        console.log(`UPDATE_SETTINGS for key "${key}" in tab ${tabId}:`, message.settings);
        // Update in-memory cache
        siteSettings[key] = message.settings;
        // Persist changes to storage
        await saveSettingsToStorage();

        // Notify the relevant content script about the updated settings
        try {
            await browser.tabs.sendMessage(tabId, {
                type: 'SETTINGS_UPDATED',
                settings: message.settings // Send the complete new settings object
            });
            sendResponse({ success: true });
        } catch (err) {
            // Ignore errors if tab/content script not ready/available
            if (!err.message.includes("Could not establish connection") && !err.message.includes("Receiving end does not exist")) {
                console.error(`Error sending SETTINGS_UPDATED to tab ${tabId} for key "${key}":`, err);
            }
            // Still respond success as settings were saved, even if tab couldn't be notified
            sendResponse({ success: true, warning: "Could not notify content script" });
        }
        break;

      case 'RESET_SETTINGS':
        if (!key) {
          console.error("RESET_SETTINGS request missing key.");
          sendResponse({ error: "Missing key", settings: { ...DEFAULT_SETTINGS } });
          return;
        }
         if (!tabId) {
             console.error("RESET_SETTINGS request missing tabId.");
             sendResponse({ error: "Missing tabId", settings: { ...DEFAULT_SETTINGS } });
             return;
        }

        console.log(`RESET_SETTINGS for key "${key}" in tab ${tabId}`);
        // Remove the specific setting from the cache
        let settingsExisted = false;
        if (siteSettings.hasOwnProperty(key)) {
            delete siteSettings[key];
            settingsExisted = true;
        }

        // Persist the change (removal) if settings existed
        if (settingsExisted) {
            await saveSettingsToStorage();
        }

        // Notify the content script to apply default settings
         try {
            await browser.tabs.sendMessage(tabId, {
                type: 'SETTINGS_UPDATED',
                settings: { ...DEFAULT_SETTINGS } // Send defaults
            });
            // Respond with the default settings after notifying tab
            sendResponse({ settings: { ...DEFAULT_SETTINGS } });
        } catch (err) {
             if (!err.message.includes("Could not establish connection") && !err.message.includes("Receiving end does not exist")) {
                console.error(`Error sending SETTINGS_UPDATED (reset) to tab ${tabId} for key "${key}":`, err);
             }
             // Respond with defaults even if tab couldn't be notified
             sendResponse({ settings: { ...DEFAULT_SETTINGS }, warning: "Could not notify content script" });
        }
        break;

      // --- Content Script Specific Messages ---
      case 'REQUEST_INITIAL_SETTINGS':
        // Content script requests settings when it loads
        if (!sender.tab || !sender.tab.url || !sender.tab.id) {
            console.warn("REQUEST_INITIAL_SETTINGS from invalid sender:", sender);
            sendResponse({ error: "Invalid sender" });
            return;
        }
        const contentTabId = sender.tab.id;
        const contentUrl = sender.tab.url;
        let contentKey = null;
        try {
            // Reuse the key generation logic from popup
            const urlObj = new URL(contentUrl);
            if (urlObj.protocol === 'file:') {
                contentKey = contentUrl; // Use full file URL
            } else if (urlObj.protocol.startsWith('http')) {
                contentKey = urlObj.hostname; // Use hostname
            }
            // Add handling for other protocols if needed, otherwise key remains null
        } catch (e) {
            console.warn(`Could not determine key for URL: ${contentUrl}`, e);
        }

        // If no domain/file key, maybe use tab-id? Or just send defaults?
        // For now, send specific settings if key exists, otherwise defaults.
        // Let's use the same logic as GET_SETTINGS
        const initialSettings = contentKey && siteSettings[contentKey]
                                ? { ...DEFAULT_SETTINGS, ...siteSettings[contentKey] }
                                : { ...DEFAULT_SETTINGS };

        console.log(`Content script in tab ${contentTabId} (URL: ${contentUrl}, Key: ${contentKey}) requested initial settings. Sending:`, initialSettings);
        sendResponse({ settings: initialSettings });
        break;

      default:
        console.log("Received unknown message type:", message.type);
        // sendResponse({ error: "Unknown message type" }); // Optional: respond for unknown types
        break;
    }
  })().catch(error => {
      // Catch any unexpected errors in the async handler
      console.error("Error processing message:", message, error);
      // Attempt to send an error response if possible
      if (typeof sendResponse === 'function') {
          try {
              sendResponse({ error: "Internal background script error" });
          } catch (e) {
              // Ignore errors trying to send response after an error
          }
      }
  });

  // Return true to indicate that the response will be sent asynchronously
  return true;
});

// --- Tab Management (Optional but Recommended) ---

// Clean up tab-specific settings when a tab is closed
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    const tabKey = `tab-${tabId}`;
    if (siteSettings.hasOwnProperty(tabKey)) {
        console.log(`Tab ${tabId} closed, removing temporary settings for key: ${tabKey}`);
        delete siteSettings[tabKey];
        // Persist this cleanup immediately
        saveSettingsToStorage();
    }
});

console.log("Background script loaded.");
// Initial load of settings when the script is first evaluated (e.g., after update/reload)
loadSettingsFromStorage();
