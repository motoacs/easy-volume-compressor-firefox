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
  
  // Create meter scale
  createMeterScale();
  
  // For demonstration, animate the level meter
  animateLevelMeter();
});

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

// Simulate level meter animation (just for UI demonstration)
function animateLevelMeter() {
  let level = 0;
  const direction = { up: true };
  
  setInterval(() => {
    if (direction.up) {
      level += Math.random() * 3;
      if (level > 90) {
        direction.up = false;
      }
    } else {
      level -= Math.random() * 5;
      if (level < 10) {
        direction.up = true;
      }
    }
    
    meterBar.style.width = `${level}%`;
  }, 100);
}