"use strict";
/**
 * Easy Volume Compressor - Popup Script
 *
 * This script handles the popup UI interactions and communicates with
 * the background script to update compressor settings for the active tab/domain.
 */

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  ratio: 4.0,
  threshold: -20.0,
  attack: 0.003,
  release: 0.25,
  outputGain: 0.0
};

// DOM Elements
const enableSwitch = document.getElementById('enable-switch');
const thresholdSlider = document.getElementById('threshold');
const thresholdValue = document.getElementById('threshold-value');
const ratioSlider = document.getElementById('ratio');
const ratioValue = document.getElementById('ratio-value');
const attackSlider = document.getElementById('attack');
const attackValue = document.getElementById('attack-value');
const releaseSlider = document.getElementById('release');
const releaseValue = document.getElementById('release-value');
const outputGainSlider = document.getElementById('output-gain');
const outputGainValue = document.getElementById('output-gain-value');
const resetButton = document.getElementById('reset-button');
const meterBar = document.getElementById('meter-bar');
const reductionBar = document.getElementById('reduction-bar');
const domainInfo = document.getElementById('domain-info');

// Current settings for the active context
let currentSettings = {};
// Active tab info
let activeTabId = null;
let activeTabUrl = null;
// Key used for storing/retrieving settings (domain, file URL, or tab-id)
let settingsKey = null;

// Function to extract domain or generate a key from URL
function getKeyFromUrl(url) {
  if (!url) {
    return null;
  }
  // Handle special URLs like about:, chrome:, file:
  if (!url.startsWith('http:') && !url.startsWith('https:')) {
      // For file URLs, use the full URL as the key
      if (url.startsWith('file:')) {
          return url;
      }
      // For other special URLs (e.g., about:blank, reader view), return null for now
      // Background script might decide to use tabId in this case
      return null;
  }
  try {
    // Use hostname for standard http/https URLs
    return new URL(url).hostname;
  } catch (e) {
    console.error("Error parsing URL:", url, e);
    return null; // Return null if URL parsing fails
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get the currently active tab in the current window
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      activeTabId = activeTab.id;
      activeTabUrl = activeTab.url;
      const domainOrFile = getKeyFromUrl(activeTabUrl);

      // Determine the key and display text for settings
      let displayDomain = domainOrFile;
      if (domainOrFile && domainOrFile.startsWith('file:')) {
        displayDomain = "Local File"; // More user-friendly display
        settingsKey = domainOrFile; // Use the full file URL as the key
      } else if (domainOrFile) {
        settingsKey = domainOrFile; // Use the hostname
      } else {
         // Handle cases like about:blank, reader view, etc., where getKeyFromUrl returned null
         // Use tabId as a fallback key for non-persistent settings for this specific tab instance
         settingsKey = `tab-${activeTabId}`;
         displayDomain = `This Tab (Temporary)`; // Indicate settings might not persist
      }

      // Update domain info display
      if (displayDomain) {
        domainInfo.textContent = `Settings for: ${displayDomain}`;
      } else {
         // Should ideally not happen with the logic above, but have a fallback
        domainInfo.textContent = `Settings for current tab`;
      }

      // Get settings using the determined key
      await loadSettings(settingsKey);

      // Start monitoring level for the active tab
      startLevelMonitoring();

    } else {
      console.error("Could not find active tab.");
      domainInfo.textContent = "Error: No active tab found.";
      disableControls();
    }
  } catch (error) {
    console.error("Error initializing popup:", error);
    domainInfo.textContent = "Error initializing.";
    disableControls();
  }

  // Add event listeners for UI controls
  enableSwitch.addEventListener('change', handleSettingChange);
  thresholdSlider.addEventListener('input', handleSliderInput);
  ratioSlider.addEventListener('input', handleSliderInput);
  attackSlider.addEventListener('input', handleSliderInput);
  releaseSlider.addEventListener('input', handleSliderInput);
  outputGainSlider.addEventListener('input', handleSliderInput);
  resetButton.addEventListener('click', handleResetClick);

  // Create meter scales
  createMeterScale();
  createReductionScale();

  // Listen for level updates from content script (ensure it targets the correct tab)
  browser.runtime.onMessage.addListener(handleMessages);
});

// Disable all controls
function disableControls() {
    document.querySelectorAll('input, button').forEach(el => el.disabled = true);
}

// Listen for popup window closing
window.addEventListener('unload', () => {
  stopLevelMonitoring();
});

// Handle incoming messages (filter by tabId if necessary, though background might handle this)
function handleMessages(message, sender) {
  // Only process messages relevant to the currently active tab shown in the popup
  if (sender.tab && sender.tab.id === activeTabId) {
      if (message.type === 'METER_UPDATE') {
        updateLevelMeter(message.level);
        updateReductionMeter(message.reduction);
      } else if (message.type === 'LEVEL_UPDATE') { // Backward compatibility
        updateLevelMeter(message.level);
      }
  } else if (message.type === 'SETTINGS_UPDATED_EXTERNALLY' && message.key === settingsKey) {
      // Optional: Handle cases where settings are updated elsewhere (e.g., options page)
      console.log(`Settings for ${settingsKey} updated externally, reloading UI.`);
      loadSettings(settingsKey);
  }
}

// Start level monitoring for the active tab
function startLevelMonitoring() {
  if (activeTabId) {
    browser.tabs.sendMessage(activeTabId, {
      type: 'START_LEVEL_MONITORING'
    }).catch(error => {
      // Ignore errors if the content script isn't ready or injected yet
      if (!error.message.includes("Could not establish connection")) {
          console.error("Error starting level monitoring:", error);
      }
    });
  }
}

// Stop level monitoring for the active tab
function stopLevelMonitoring() {
  if (activeTabId) {
    browser.tabs.sendMessage(activeTabId, {
      type: 'STOP_LEVEL_MONITORING'
    }).catch(error => {
       // Ignore errors if the content script isn't there or tab is closed
      if (!error.message.includes("Could not establish connection") && !error.message.includes("Receiving end does not exist")) {
         console.error("Error stopping level monitoring:", error);
      }
    });
  }
}

// Update level meter
function updateLevelMeter(level) {
  const minDb = -60;
  const percent = Math.max(0, Math.min(100, ((level - minDb) / Math.abs(minDb)) * 100));
  meterBar.style.width = `${percent}%`;
  meterBar.style.backgroundColor = level > -3 ? '#ff5555' : level > -10 ? '#ffaa00' : '#00aa44';

  const levelText = meterBar.querySelector('.level-text') || document.createElement('span');
  levelText.className = 'level-text';
  levelText.textContent = `${Math.round(level)} dB`;
  if (!meterBar.querySelector('.level-text')) {
      meterBar.appendChild(levelText);
  }
}

// Update reduction meter
function updateReductionMeter(reduction) {
  const maxReduction = 20;
  const percent = Math.min(100, (reduction / maxReduction) * 100);
  reductionBar.style.width = `${percent}%`;
  reductionBar.style.backgroundColor = reduction > 15 ? '#ff5555' : reduction > 8 ? '#ffaa00' : '#f39c12';

  const reductionText = reductionBar.querySelector('.reduction-text') || document.createElement('span');
  reductionText.className = 'reduction-text';
  reductionText.textContent = `${Math.round(reduction)} dB`;
   if (!reductionBar.querySelector('.reduction-text')) {
      reductionBar.appendChild(reductionText);
  }
}

// Load settings from background script for the specified key
async function loadSettings(key) {
  if (!activeTabId || !key) {
      console.warn("Cannot load settings without activeTabId and key");
      currentSettings = { ...DEFAULT_SETTINGS }; // Use default if no key
      updateUiWithSettings();
      return;
  }
  settingsKey = key; // Store the key being used

  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_SETTINGS',
      tabId: activeTabId, // Send tabId for context if needed by background
      key: settingsKey    // Send the specific key (domain, file URL, or tab-id)
    });

    if (response.error) {
      console.warn(`No specific settings found for key "${settingsKey}", using defaults. Error: ${response.error}`);
      currentSettings = { ...DEFAULT_SETTINGS };
    } else {
      // Merge received settings with defaults to ensure all properties exist
      currentSettings = { ...DEFAULT_SETTINGS, ...response.settings };
      console.log(`Loaded settings for key "${settingsKey}":`, currentSettings);
    }
  } catch (error) {
    console.error(`Error loading settings for key "${settingsKey}":`, error);
    currentSettings = { ...DEFAULT_SETTINGS }; // Fallback on error
  }
  updateUiWithSettings(); // Update UI with loaded/default settings
}

// Helper function to update all UI elements based on currentSettings
function updateUiWithSettings() {
  enableSwitch.checked = currentSettings.enabled;
  thresholdSlider.value = currentSettings.threshold;
  ratioSlider.value = currentSettings.ratio;
  // Ensure values are within slider bounds
  attackSlider.value = Math.max(parseFloat(attackSlider.min), Math.min(parseFloat(attackSlider.max), currentSettings.attack * 1000)); // s to ms
  releaseSlider.value = Math.max(parseFloat(releaseSlider.min), Math.min(parseFloat(releaseSlider.max), currentSettings.release * 1000)); // s to ms
  outputGainSlider.value = currentSettings.outputGain;

  // Update displayed values for sliders
  updateSliderValueDisplay(thresholdSlider);
  updateSliderValueDisplay(ratioSlider);
  updateSliderValueDisplay(attackSlider);
  updateSliderValueDisplay(releaseSlider);
  updateSliderValueDisplay(outputGainSlider);
}

// Update individual slider value displays
function updateSliderValueDisplay(slider) {
  const valueEl = document.getElementById(`${slider.id}-value`);
  if (!valueEl) return;

  let displayValue = slider.value;
  switch(slider.id) {
    case 'threshold':
      valueEl.textContent = `${displayValue} dB`;
      break;
    case 'ratio':
      valueEl.textContent = `${parseFloat(displayValue).toFixed(1)}:1`;
      break;
    case 'attack':
    case 'release':
      valueEl.textContent = `${displayValue} ms`;
      break;
    case 'output-gain':
      valueEl.textContent = `${parseFloat(displayValue).toFixed(1)} dB`;
      break;
  }
}

// Event handler for slider input changes
function handleSliderInput(e) {
  updateSliderValueDisplay(e.target); // Update the display immediately
  updateSettings(); // Debounce could be added here if performance is an issue
}

// Event handler for enable switch changes
function handleSettingChange() {
    updateSettings();
}

// Update settings and send to background script
function updateSettings() {
  if (!activeTabId || !settingsKey) {
      console.warn("Cannot update settings: Missing activeTabId or settingsKey.");
      return;
  }

  // Read current values from UI
  const newSettings = {
    enabled: enableSwitch.checked,
    threshold: parseFloat(thresholdSlider.value),
    ratio: parseFloat(ratioSlider.value),
    attack: parseFloat(attackSlider.value) / 1000, // Convert ms to s
    release: parseFloat(releaseSlider.value) / 1000, // Convert ms to s
    outputGain: parseFloat(outputGainSlider.value)
  };

  // Update local state immediately for responsiveness
  currentSettings = newSettings;

  // Send updated settings to background script with context
  browser.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    tabId: activeTabId, // Include tabId for context
    key: settingsKey,   // The key (domain, file URL, or tab-id) these settings apply to
    settings: newSettings
  }).catch(error => {
    console.error(`Error updating settings for key "${settingsKey}":`, error);
    // Optionally revert UI or show error to user
  });
}

// Reset settings to defaults for the current key
async function handleResetClick() {
   if (!activeTabId || !settingsKey) {
      console.warn("Cannot reset settings: Missing activeTabId or settingsKey.");
      return;
   }

   console.log(`Resetting settings for key: ${settingsKey}`);
   try {
       const response = await browser.runtime.sendMessage({
           type: 'RESET_SETTINGS',
           tabId: activeTabId,
           key: settingsKey
       });

       if (response.error) {
           console.error(`Error resetting settings for key "${settingsKey}":`, response.error);
           // Even on error, revert UI to default for consistency
           currentSettings = { ...DEFAULT_SETTINGS };
       } else {
           // Background confirms reset, update local state to default
           currentSettings = { ...DEFAULT_SETTINGS };
           console.log(`Settings reset to default for key "${settingsKey}".`);
       }
   } catch (error) {
       console.error(`Error communicating reset request for key "${settingsKey}":`, error);
       // Fallback UI update on communication error
       currentSettings = { ...DEFAULT_SETTINGS };
   }
   // Update UI to reflect the reset (to defaults)
   updateUiWithSettings();
}

// Create scale marks for the level meter
function createMeterScale() {
  const scaleEl = document.querySelector('.meter-scale');
  scaleEl.innerHTML = ''; // Clear existing marks
  const marks = [-60, -50, -40, -30, -20, -10, -3, 0];

  marks.forEach(dB => {
    const position = ((dB + 60) / 60) * 100;
    const mark = document.createElement('div');
    mark.className = 'meter-mark';
    mark.style.left = `${position}%`;
    scaleEl.appendChild(mark);

    if (dB % 10 === 0 || dB === -3 || dB === 0) {
      const label = document.createElement('div');
      label.className = 'meter-label';
      label.style.left = `${position}%`;
      label.textContent = dB === 0 ? '0' : dB;
      scaleEl.appendChild(label);
    }
  });
}

// Create scale marks for the reduction meter
function createReductionScale() {
  const scaleEl = document.querySelector('.reduction-scale');
  scaleEl.innerHTML = ''; // Clear existing marks
  const marks = [0, 3, 6, 10, 15, 20]; // dB reduction values

  marks.forEach(dB => {
    const position = (dB / 20) * 100; // Position from left (0dB = 0%, 20dB = 100%)
    const mark = document.createElement('div');
    mark.className = 'reduction-mark';
    // Position from left, but bar grows left-to-right visually
    mark.style.left = `${position}%`;
    scaleEl.appendChild(mark);

    if (dB % 5 === 0 || dB === 3 || dB === 0) { // Label 0, 3, 5, 10, 15, 20
      const label = document.createElement('div');
      label.className = 'reduction-label';
      label.style.left = `${position}%`;
      label.textContent = dB;
      scaleEl.appendChild(label);
    }
  });
}
