/**
 * Easy Volume Compressor - Background Script
 * 
 * This script manages the addon's state and communicates with content scripts
 */

// Default compressor settings
const DEFAULT_SETTINGS = {
  enabled: true,
  ratio: 4.0,        // Compression ratio (higher = more compression)
  threshold: -20.0,  // dB threshold where compression begins
  attack: 0.003,     // How quickly compression is applied (seconds)
  release: 0.25,     // How quickly compression is released (seconds)
  outputGain: 0.0    // Additional output gain in dB after compression
};

// Store settings per domain
let domainSettings = {};
// Track active tab for popup communications
let activeTabId = null;
let activeDomain = null;

// Initialize addon when installed
browser.runtime.onInstalled.addListener(() => {
  // Load any saved settings
  browser.storage.local.get('domainSettings').then(result => {
    if (result.domainSettings) {
      domainSettings = result.domainSettings;
    }
  });
});

// Track active tab changes
browser.tabs.onActivated.addListener(activeInfo => {
  activeTabId = activeInfo.tabId;
  
  // Get the URL of the active tab
  browser.tabs.get(activeTabId).then(tab => {
    if (tab.url) {
      try {
        const url = new URL(tab.url);
        activeDomain = url.hostname;
      } catch (e) {
        console.error("Error parsing URL:", e);
        activeDomain = null;
      }
    }
  });
});

// Listen for messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if sender is a popup (no tab) or content script (has tab)
  const isFromPopup = !sender.tab;
  
  switch (message.type) {
    case 'GET_SETTINGS':
      let domain;
      let tabId;
      
      if (isFromPopup) {
        // Message is from popup - use active domain
        domain = activeDomain;
        tabId = activeTabId;
      } else {
        // Message is from content script - use sender tab info
        const url = new URL(sender.tab.url);
        domain = url.hostname;
        tabId = sender.tab.id;
      }
      
      // If settings exist for this domain, return them, otherwise return default
      const settings = domain && domainSettings[domain] ? domainSettings[domain] : DEFAULT_SETTINGS;
      sendResponse({ settings });
      break;
      
    case 'UPDATE_SETTINGS':
      let updateDomain;
      let updateTabId;
      
      if (isFromPopup) {
        // From popup - update for active domain
        updateDomain = activeDomain;
        updateTabId = activeTabId;
      } else {
        // From content script
        const updateUrl = new URL(sender.tab.url);
        updateDomain = updateUrl.hostname;
        updateTabId = sender.tab.id;
      }
      
      // Only proceed if we have a valid domain
      if (!updateDomain) {
        console.error("No domain available to update settings");
        sendResponse({ error: "No domain available" });
        break;
      }
      
      // Update settings for this domain
      domainSettings[updateDomain] = message.settings;
      
      // Persist settings
      browser.storage.local.set({ domainSettings });
      
      // Notify the content script about updated settings
      if (updateTabId) {
        browser.tabs.sendMessage(updateTabId, {
          type: 'SETTINGS_UPDATED',
          settings: message.settings
        }).catch(err => {
          console.error("Error sending message to tab:", err);
        });
      }
      
      sendResponse({ success: true });
      break;
      
    case 'RESET_SETTINGS':
      let resetDomain;
      let resetTabId;
      
      if (isFromPopup) {
        // From popup - reset for active domain
        resetDomain = activeDomain;
        resetTabId = activeTabId;
      } else {
        // From content script
        const resetUrl = new URL(sender.tab.url);
        resetDomain = resetUrl.hostname;
        resetTabId = sender.tab.id;
      }
      
      // Only proceed if we have a valid domain
      if (!resetDomain) {
        console.error("No domain available to reset settings");
        sendResponse({ error: "No domain available", settings: DEFAULT_SETTINGS });
        break;
      }
      
      // Reset to default settings
      domainSettings[resetDomain] = DEFAULT_SETTINGS;
      
      // Persist settings
      browser.storage.local.set({ domainSettings });
      
      // Notify the content script about reset settings
      if (resetTabId) {
        browser.tabs.sendMessage(resetTabId, {
          type: 'SETTINGS_UPDATED',
          settings: DEFAULT_SETTINGS
        }).catch(err => {
          console.error("Error sending message to tab:", err);
        });
      }
      
      // Respond with the default settings
      sendResponse({ settings: DEFAULT_SETTINGS });
      break;
      
    case 'GET_ACTIVE_DOMAIN':
      // Special method for popup to get current domain
      sendResponse({ 
        domain: activeDomain,
        tabId: activeTabId 
      });
      break;
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});