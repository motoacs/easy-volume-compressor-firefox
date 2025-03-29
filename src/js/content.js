"use strict";
/**
 * Easy Volume Compressor - Content Script
 *
 * This script detects audio elements and applies compression to them
 * using the Web Audio API
 */

// Audio processing class
class EasyVolumeCompressor {
  constructor() {
    this.initialized = false;
    this.settings = null;
    this.mediaElements = new Map(); // Store media elements and their audio contexts
    this.audioContext = null;
    this.levelAnalyzers = new Map(); // Store analyzers for level measurement
    this.reductionValues = new Map(); // Store reduction values from compressors
    this.isMonitoringLevel = false;
    this.isPopupOpen = false;

    // Request initial settings from background script
    this.requestInitialSettings();

    // Listen for messages from background or popup
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SETTINGS_UPDATED') {
        this.settings = message.settings;
        this.updateAllCompressors();
      } else if (message.type === 'START_LEVEL_MONITORING') {
        this.isPopupOpen = true;
        this.startLevelMonitoring();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_LEVEL_MONITORING') {
        this.isPopupOpen = false;
        this.stopLevelMonitoring();
        sendResponse({ success: true });
      }
      // Indicate that the response function will be called asynchronously
      // only if we intend to send a response from this listener.
      // For START/STOP monitoring, we do send a response.
      if (message.type === 'START_LEVEL_MONITORING' || message.type === 'STOP_LEVEL_MONITORING') {
          return true;
      }
      // For SETTINGS_UPDATED, we don't send a response back.
    });
  }

  // Request initial settings from background script
  async requestInitialSettings() {
      try {
          console.log("Requesting initial settings...");
          const response = await browser.runtime.sendMessage({ type: 'REQUEST_INITIAL_SETTINGS' });
          if (response && response.settings) {
              this.settings = response.settings;
              console.log("Received initial settings:", this.settings);
              this.initialize(); // Initialize after receiving settings
          } else {
              console.error("Failed to get initial settings, using defaults.", response);
              this.settings = { ...DEFAULT_SETTINGS }; // Fallback to defaults
              this.initialize();
          }
      } catch (error) {
          console.error("Error requesting initial settings:", error);
          // Fallback to defaults if background script is unavailable or throws error
          this.settings = { ...DEFAULT_SETTINGS };
          this.initialize();
      }
  }


  // Initialize the compressor (should only be called after settings are loaded)
  initialize() {
    if (this.initialized) return;

    // Create audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Process all existing media elements
    this.processExistingMediaElements();

    // Set up mutation observer to detect new media elements
    this.setupMutationObserver();

    this.initialized = true;
  }

  // Process all existing media elements on the page
  processExistingMediaElements() {
    // Find all video and audio elements
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(element => {
      this.setupAudioProcessing(element);
    });
  }

  // Set up mutation observer to detect new media elements
  setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            // Check if node is an element
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if node is a media element
              if (node.nodeName.toLowerCase() === 'video' || node.nodeName.toLowerCase() === 'audio') {
                this.setupAudioProcessing(node);
              } else {
                // Check for media elements inside the added node
                const mediaElements = node.querySelectorAll('video, audio');
                mediaElements.forEach(element => {
                  this.setupAudioProcessing(element);
                });
              }
            }
          });
        }
      });
    });

    // Observe changes in the entire document
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Set up audio processing for a media element
  setupAudioProcessing(mediaElement) {
    // Skip if already processed
    if (this.mediaElements.has(mediaElement)) return;

    // Create a new processor for this media element
    try {
      const source = this.audioContext.createMediaElementSource(mediaElement);

      // Create compressor node
      const compressor = this.audioContext.createDynamicsCompressor();
      this.configureCompressor(compressor);

      // Create gain node for output gain control
      const gainNode = this.audioContext.createGain();
      this.updateOutputGain(gainNode);

      // Create analyzer for level metering
      const analyzer = this.audioContext.createAnalyser();
      analyzer.fftSize = 1024;
      analyzer.smoothingTimeConstant = 0.3;

      // Connect the nodes
      source.connect(compressor);
      compressor.connect(gainNode);

      // Connect analyzer after the gain node to measure the final output
      gainNode.connect(analyzer);

      // Connect to output or bypass based on enabled setting
      if (this.settings.enabled) {
        gainNode.connect(this.audioContext.destination);
      } else {
        source.connect(this.audioContext.destination);
      }

      // Store nodes for later reference
      this.mediaElements.set(mediaElement, {
        source,
        compressor,
        gainNode,
        connected: this.settings.enabled
      });

      // Store analyzer separately
      this.levelAnalyzers.set(mediaElement, analyzer);

      // Initialize reduction value tracking
      this.reductionValues.set(mediaElement, 0);

    } catch (error) {
      console.error('Failed to set up audio processing:', error);
    }
  }

  // Configure compressor with current settings
  configureCompressor(compressor) {
    compressor.threshold.value = this.settings.threshold;
    compressor.ratio.value = this.settings.ratio;
    compressor.attack.value = this.settings.attack;
    compressor.release.value = this.settings.release;
    // Standard values for other parameters
    compressor.knee.value = 10; // Soft knee
  }

  // Update output gain
  updateOutputGain(gainNode) {
    // Convert dB to linear gain
    gainNode.gain.value = Math.pow(10, this.settings.outputGain / 20);
  }

  // Update all compressors with new settings
  updateAllCompressors() {
    this.mediaElements.forEach((nodes, element) => {
      // Update compressor settings
      this.configureCompressor(nodes.compressor);
      this.updateOutputGain(nodes.gainNode);

      // Handle enable/disable
      if (this.settings.enabled && !nodes.connected) {
        // Disconnect direct connection
        nodes.source.disconnect(this.audioContext.destination);
        // Connect through compressor
        nodes.gainNode.connect(this.audioContext.destination);
        nodes.connected = true;
      } else if (!this.settings.enabled && nodes.connected) {
        // Disconnect compressor
        nodes.gainNode.disconnect(this.audioContext.destination);
        // Connect directly to output
        nodes.source.connect(this.audioContext.destination);
        nodes.connected = false;
      }
    });
  }

  // Start monitoring audio levels
  startLevelMonitoring() {
    if (this.isMonitoringLevel) return;
    this.isMonitoringLevel = true;

    // Set up monitoring interval
    this.levelMonitoringInterval = setInterval(() => {
      this.sendLevelData();
    }, 100); // Update every 100ms
  }

  // Stop monitoring audio levels
  stopLevelMonitoring() {
    if (!this.isMonitoringLevel) return;
    this.isMonitoringLevel = false;

    clearInterval(this.levelMonitoringInterval);
  }

  // Send level data to popup
  sendLevelData() {
    if (!this.isPopupOpen || this.levelAnalyzers.size === 0) return;

    let maxLevel = -Infinity;
    let maxReduction = 0;
    let hasActiveMedia = false;

    // Find the maximum level across all active media elements
    this.mediaElements.forEach((nodes, mediaElement) => {
      if (mediaElement.paused) return;
      hasActiveMedia = true;

      // Get output level
      const analyzer = this.levelAnalyzers.get(mediaElement);
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteTimeDomainData(dataArray);

      // Calculate RMS value (root mean square)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        // Convert from 0-255 to -1.0 to 1.0
        const amplitude = (dataArray[i] - 128) / 128;
        sum += amplitude * amplitude;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Convert to dB (clamped to -60dB minimum)
      let db = 20 * Math.log10(Math.max(rms, 0.001));

      // Update max level
      if (db > maxLevel) {
        maxLevel = db;
      }

      // Get reduction amount (in dB)
      // Note: reduction is a negative value in the Web Audio API
      const reduction = Math.abs(nodes.compressor.reduction);

      // Update max reduction
      if (reduction > maxReduction) {
        maxReduction = reduction;
      }
    });

    // If we have a valid level, send it to the popup
    if (hasActiveMedia) {
      browser.runtime.sendMessage({
        type: 'METER_UPDATE',
        level: maxLevel !== -Infinity ? maxLevel : -60,
        reduction: maxReduction
      });
    }
  }
}

// Create compressor instance
const compressor = new EasyVolumeCompressor();
