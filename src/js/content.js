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
    
    // Initialize when settings are received
    this.getSettings().then(() => {
      this.initialize();
    });
    
    // Listen for settings updates from popup
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_UPDATED') {
        this.settings = message.settings;
        this.updateAllCompressors();
      }
    });
  }
  
  // Get settings from background script
  async getSettings() {
    return new Promise((resolve) => {
      browser.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(response => {
        this.settings = response.settings;
        resolve(this.settings);
      });
    });
  }
  
  // Initialize the compressor
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
      
      // Connect the nodes
      source.connect(compressor);
      compressor.connect(gainNode);
      
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
}

// Create compressor instance
const compressor = new EasyVolumeCompressor();