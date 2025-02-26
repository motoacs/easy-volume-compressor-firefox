/**
 * Easy Volume Compressor - Popup Script
 *
 * This script handles the popup UI interactions and communicates with
 * the background script to update compressor settings
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

// Current settings
let currentSettings = {};
// Current domain and tab info
let activeDomain = null;
let activeTabId = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get active domain from the background script
  browser.runtime.sendMessage({ type: 'GET_ACTIVE_DOMAIN' }).then(response => {
    activeDomain = response.domain;
    activeTabId = response.tabId;

    // Update domain info display
    if (activeDomain) {
      domainInfo.textContent = `Settings for: ${activeDomain}`;
    } else {
      domainInfo.textContent = `No website detected (using default settings)`;
    }

    // Get settings for current site
    loadSettings();

    // Start monitoring level
    startLevelMonitoring();
  });

  // Add event listeners for UI controls
  enableSwitch.addEventListener('change', updateSettings);
  thresholdSlider.addEventListener('input', updateSliderValue);
  ratioSlider.addEventListener('input', updateSliderValue);
  attackSlider.addEventListener('input', updateSliderValue);
  releaseSlider.addEventListener('input', updateSliderValue);
  outputGainSlider.addEventListener('input', updateSliderValue);

  // Trigger initial UI update
  updateSliderValue({ target: thresholdSlider });
  updateSliderValue({ target: ratioSlider });
  updateSliderValue({ target: attackSlider });
  updateSliderValue({ target: releaseSlider });
  updateSliderValue({ target: outputGainSlider });

  // Reset button
  resetButton.addEventListener('click', resetSettings);

  // Create meter scales
  createMeterScale();
  createReductionScale();

  // Listen for level updates from content script
  browser.runtime.onMessage.addListener(handleMessages);
});

// Listen for popup window closing
window.addEventListener('unload', () => {
  stopLevelMonitoring();
});

// Handle incoming messages
function handleMessages(message) {
  if (message.type === 'METER_UPDATE') {
    updateLevelMeter(message.level);
    updateReductionMeter(message.reduction);
  } else if (message.type === 'LEVEL_UPDATE') {
    // For backward compatibility
    updateLevelMeter(message.level);
  }
}

// Start level monitoring
function startLevelMonitoring() {
  if (activeTabId) {
    browser.tabs.sendMessage(activeTabId, {
      type: 'START_LEVEL_MONITORING'
    }).catch(error => {
      console.error("Error starting level monitoring:", error);
    });
  }
}

// Stop level monitoring
function stopLevelMonitoring() {
  if (activeTabId) {
    browser.tabs.sendMessage(activeTabId, {
      type: 'STOP_LEVEL_MONITORING'
    }).catch(error => {
      console.error("Error stopping level monitoring:", error);
    });
  }
}

// Update level meter with actual level data
function updateLevelMeter(level) {
  // Convert dB level to percentage width (0dB = 100%, -60dB or below = 0%)
  const minDb = -60;
  const percent = Math.max(0, Math.min(100, ((level - minDb) / Math.abs(minDb)) * 100));

  // Update meter width
  meterBar.style.width = `${percent}%`;

  // Color the meter based on level
  if (level > -3) {
    meterBar.style.backgroundColor = '#ff5555'; // Red for near-clipping
  } else if (level > -10) {
    meterBar.style.backgroundColor = '#ffaa00'; // Orange/yellow for high levels
  } else {
    meterBar.style.backgroundColor = '#00aa44'; // Green for normal levels
  }

  // Display the current level value
  const levelText = document.createElement('span');
  levelText.className = 'level-text';
  levelText.textContent = `${Math.round(level)} dB`;

  // Remove any existing level text before adding new one
  const existingText = meterBar.querySelector('.level-text');
  if (existingText) {
    existingText.remove();
  }
  meterBar.appendChild(levelText);
}

// Update reduction meter with gain reduction data
function updateReductionMeter(reduction) {
  // Convert reduction value to percentage width (max 20dB = 100%)
  const maxReduction = 20;
  const percent = Math.min(100, (reduction / maxReduction) * 100);

  // Update meter width for right-to-left display
  reductionBar.style.width = `${percent}%`;

  // Color the reduction meter based on amount
  if (reduction > 15) {
    reductionBar.style.backgroundColor = '#ff5555'; // Red for heavy reduction
  } else if (reduction > 8) {
    reductionBar.style.backgroundColor = '#ffaa00'; // Orange for medium reduction
  } else {
    reductionBar.style.backgroundColor = '#f39c12'; // Yellow for light reduction
  }

  // Display the current reduction value
  const reductionText = document.createElement('span');
  reductionText.className = 'reduction-text';
  reductionText.textContent = `${Math.round(reduction)} dB`;

  // Remove any existing reduction text before adding new one
  const existingText = reductionBar.querySelector('.reduction-text');
  if (existingText) {
    existingText.remove();
  }
  reductionBar.appendChild(reductionText);
}

// Load settings from background script
function loadSettings() {
  browser.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(response => {
    if (response.error) {
      console.error("Error getting settings:", response.error);
      currentSettings = DEFAULT_SETTINGS;
    } else {
      currentSettings = response.settings;
    }

    // Update UI with current settings
    enableSwitch.checked = currentSettings.enabled;
    thresholdSlider.value = currentSettings.threshold;
    ratioSlider.value = currentSettings.ratio;
    attackSlider.value = currentSettings.attack * 1000; // Convert seconds to ms
    releaseSlider.value = currentSettings.release * 1000; // Convert seconds to ms
    outputGainSlider.value = currentSettings.outputGain;

    // Update displayed values
    updateSliderValue({ target: thresholdSlider });
    updateSliderValue({ target: ratioSlider });
    updateSliderValue({ target: attackSlider });
    updateSliderValue({ target: releaseSlider });
    updateSliderValue({ target: outputGainSlider });
  }).catch(error => {
    console.error("Error loading settings:", error);
  });
}

// Update slider value displays
function updateSliderValue(e) {
  const slider = e.target;
  const valueEl = document.getElementById(`${slider.id}-value`);

  switch(slider.id) {
    case 'threshold':
      valueEl.textContent = `${slider.value} dB`;
      break;
    case 'ratio':
      valueEl.textContent = `${slider.value}:1`;
      break;
    case 'attack':
      valueEl.textContent = `${slider.value} ms`;
      break;
    case 'release':
      valueEl.textContent = `${slider.value} ms`;
      break;
    case 'output-gain':
      valueEl.textContent = `${slider.value} dB`;
      break;
  }

  // If not the initial setup, update settings in real-time
  if (e.type === 'input') {
    updateSettings();
  }
}

// Update settings and send to background script
function updateSettings() {
  currentSettings = {
    enabled: enableSwitch.checked,
    threshold: parseFloat(thresholdSlider.value),
    ratio: parseFloat(ratioSlider.value),
    attack: parseFloat(attackSlider.value) / 1000, // Convert ms to seconds
    release: parseFloat(releaseSlider.value) / 1000, // Convert ms to seconds
    outputGain: parseFloat(outputGainSlider.value)
  };

  // Send updated settings to background script
  browser.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: currentSettings
  }).catch(error => {
    console.error("Error updating settings:", error);
  });
}

// Reset settings to defaults
function resetSettings() {
  browser.runtime.sendMessage({ type: 'RESET_SETTINGS' }).then(response => {
    if (response.error) {
      console.error("Error resetting settings:", response.error);
      currentSettings = DEFAULT_SETTINGS;
    } else {
      currentSettings = response.settings;
    }

    // Update UI with default settings
    enableSwitch.checked = currentSettings.enabled;
    thresholdSlider.value = currentSettings.threshold;
    ratioSlider.value = currentSettings.ratio;
    attackSlider.value = currentSettings.attack * 1000; // Convert seconds to ms
    releaseSlider.value = currentSettings.release * 1000; // Convert seconds to ms
    outputGainSlider.value = currentSettings.outputGain;

    // Update displayed values
    updateSliderValue({ target: thresholdSlider });
    updateSliderValue({ target: ratioSlider });
    updateSliderValue({ target: attackSlider });
    updateSliderValue({ target: releaseSlider });
    updateSliderValue({ target: outputGainSlider });
  }).catch(error => {
    console.error("Error resetting settings:", error);
  });
}

// Create scale marks for the level meter
function createMeterScale() {
  const scaleEl = document.querySelector('.meter-scale');
  const marks = [-60, -50, -40, -30, -20, -10, -3, 0];

  marks.forEach(dB => {
    // Calculate position (0 dB = 100%, -60 dB = 0%)
    const position = ((dB + 60) / 60) * 100;

    // Create mark element
    const mark = document.createElement('div');
    mark.className = 'meter-mark';
    mark.style.left = `${position}%`;
    scaleEl.appendChild(mark);

    // Add label for selected marks
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
  const marks = [0, 3, 6, 10, 15, 20];

  marks.forEach(dB => {
    // Calculate position (20 dB = 100%, 0 dB = 0%) from right side
    const position = 100 - (dB / 20) * 100;

    // Create mark element
    const mark = document.createElement('div');
    mark.className = 'reduction-mark';
    mark.style.right = `${position}%`; // Position from right instead of left
    scaleEl.appendChild(mark);

    // Add label for selected marks
    if (dB % 5 === 0 || dB === 3) {
      const label = document.createElement('div');
      label.className = 'reduction-label';
      label.style.right = `${position}%`; // Position from right instead of left
      label.textContent = dB;
      scaleEl.appendChild(label);
    }
  });
}