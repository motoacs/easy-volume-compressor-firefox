import { CompressorSettings, DEFAULT_SETTINGS } from '../types';

class AudioCompressor {
  private context: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private mediaElements: Map<HTMLMediaElement, MediaElementAudioSourceNode> = new Map();
  private settings: CompressorSettings = DEFAULT_SETTINGS;
  private initialized = false;
  private initializationError: Error | null = null;
  private disconnectedElements = new WeakSet<HTMLMediaElement>();

  constructor() {
    console.log('[AudioCompressor] Initializing...');
    this.initializeWithUserGesture();
    this.setupMessageListener();
    this.observeMediaElements();
  }

  private async initializeWithUserGesture() {
    try {
      // AudioContextの作成を遅延させ、ユーザージェスチャーを待つ
      console.log('[AudioCompressor] Setting up initialization triggers');
      
      document.addEventListener('click', () => {
        console.log('[AudioCompressor] Click event detected');
        if (!this.initialized && !this.initializationError) {
          this.initializeAudioContext();
        }
      }, { once: true });

      // メディア要素の再生開始時にも初期化を試みる
      document.addEventListener('play', (event) => {
        console.log('[AudioCompressor] Play event detected');
        if (!this.initialized && !this.initializationError && event.target instanceof HTMLMediaElement) {
          this.initializeAudioContext();
        }
      }, true);

    } catch (error) {
      console.error('[AudioCompressor] Failed to initialize audio context:', error);
      this.initializationError = error as Error;
    }
  }

  private initializeAudioContext() {
    try {
      console.log('[AudioCompressor] Creating AudioContext');
      this.context = new AudioContext();
      console.log('[AudioCompressor] Creating DynamicsCompressorNode');
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.connect(this.context.destination);
      console.log('[AudioCompressor] Initialized audio nodes');
      
      this.updateCompressorSettings();
      this.initialized = true;

      // 既存のメディア要素を再処理
      console.log('[AudioCompressor] Processing existing media elements');
      document.querySelectorAll('video, audio').forEach(element => {
        this.attachCompressor(element as HTMLMediaElement);
      });
    } catch (error) {
      console.error('[AudioCompressor] Failed to initialize audio context:', error);
      this.initializationError = error as Error;
    }
  }

  private updateCompressorSettings() {
    if (!this.compressor || !this.settings.enabled) {
      console.log('[AudioCompressor] Skipping settings update - compressor not ready or disabled');
      return;
    }

    try {
      console.log('[AudioCompressor] Updating compressor settings:', this.settings);
      const currentTime = this.context?.currentTime || 0;

      // パラメータの範囲を制限して安全な値を保証
      this.compressor.threshold.setValueAtTime(
        Math.max(-100, Math.min(0, this.settings.threshold)),
        currentTime
      );
      this.compressor.ratio.setValueAtTime(
        Math.max(1, Math.min(20, this.settings.ratio)),
        currentTime
      );
      this.compressor.attack.setValueAtTime(
        Math.max(0, Math.min(1, this.settings.attack / 1000)),
        currentTime
      );
      this.compressor.release.setValueAtTime(
        Math.max(0, Math.min(1, this.settings.release / 1000)),
        currentTime
      );

      // Output Gainの処理を追加
      if (!this.gainNode) {
        console.log('[AudioCompressor] Creating GainNode for output gain');
        this.gainNode = this.context!.createGain();
        this.compressor.disconnect();
        this.compressor.connect(this.gainNode);
        this.gainNode.connect(this.context!.destination);
      }
      
      this.gainNode.gain.setValueAtTime(
        Math.pow(10, this.settings.gain / 20), // dBをリニアゲインに変換
        currentTime
      );

      console.log('[AudioCompressor] Settings updated successfully');

      // 既存の接続を更新
      this.mediaElements.forEach((source, element) => {
        if (!this.disconnectedElements.has(element)) {
          this.updateElementConnection(element, source);
        }
      });
    } catch (error) {
      console.error('[AudioCompressor] Failed to update compressor settings:', error);
    }
  }

  private setupMessageListener() {
    console.log('[AudioCompressor] Setting up message listener');
    browser.runtime.onMessage.addListener((message: { type: string; settings?: CompressorSettings }) => {
      console.log('[AudioCompressor] Received message:', message);
      if (message.type === 'SETTINGS_UPDATED' && message.settings) {
        this.settings = message.settings;
        this.updateCompressorSettings();
        return true;
      }
    });

    // 初期設定を取得
    const domain = window.location.hostname;
    console.log('[AudioCompressor] Requesting initial settings for domain:', domain);
    browser.runtime.sendMessage({ type: 'GET_SETTINGS', domain }).then((settings) => {
      console.log('[AudioCompressor] Received initial settings:', settings);
      if (settings) {
        this.settings = settings;
        this.updateCompressorSettings();
      }
    }).catch(error => {
      console.error('[AudioCompressor] Failed to get initial settings:', error);
    });
  }

  private gainNode: GainNode | null = null;

  private updateElementConnection(element: HTMLMediaElement, source: MediaElementAudioSourceNode) {
    if (!this.context || !this.compressor) return;

    try {
      console.log('[AudioCompressor] Updating element connection:', element);
      // 既存の接続を解除
      source.disconnect();

      // 設定に基づいて再接続
      if (this.settings.enabled) {
        source.connect(this.compressor);
      } else {
        source.connect(this.context.destination);
      }
      console.log('[AudioCompressor] Element connection updated successfully');
    } catch (error) {
      console.error('[AudioCompressor] Failed to update element connection:', error);
    }
  }

  private attachCompressor(mediaElement: HTMLMediaElement) {
    if (!this.context || !this.initialized || this.mediaElements.has(mediaElement)) {
      console.log('[AudioCompressor] Skipping compressor attachment - not ready or already attached');
      return;
    }

    try {
      console.log('[AudioCompressor] Attaching compressor to media element:', mediaElement);
      const source = this.context.createMediaElementSource(mediaElement);
      this.mediaElements.set(mediaElement, source);
      this.updateElementConnection(mediaElement, source);

      // メディア要素のエラーハンドリング
      mediaElement.addEventListener('error', () => {
        console.log('[AudioCompressor] Media element error detected, detaching compressor');
        this.detachCompressor(mediaElement);
      });

      console.log('[AudioCompressor] Compressor attached successfully');
    } catch (error) {
      console.error('[AudioCompressor] Failed to attach compressor to media element:', error);
    }
  }

  private detachCompressor(mediaElement: HTMLMediaElement) {
    const source = this.mediaElements.get(mediaElement);
    if (source) {
      try {
        console.log('[AudioCompressor] Detaching compressor from media element:', mediaElement);
        source.disconnect();
        this.mediaElements.delete(mediaElement);
        this.disconnectedElements.add(mediaElement);
        console.log('[AudioCompressor] Compressor detached successfully');
      } catch (error) {
        console.error('[AudioCompressor] Failed to detach compressor from media element:', error);
      }
    }
  }

  private observeMediaElements() {
    console.log('[AudioCompressor] Setting up media element observer');
    // 既存のメディア要素を処理
    document.querySelectorAll('video, audio').forEach(element => {
      console.log('[AudioCompressor] Found existing media element:', element);
      this.attachCompressor(element as HTMLMediaElement);
    });

    // DOM変更の監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLMediaElement) {
            console.log('[AudioCompressor] New media element detected:', node);
            this.attachCompressor(node);
          } else if (node instanceof Element) {
            node.querySelectorAll('video, audio').forEach(element => {
              console.log('[AudioCompressor] New nested media element detected:', element);
              this.attachCompressor(element as HTMLMediaElement);
            });
          }
        });

        // 削除されたノードの処理
        mutation.removedNodes.forEach(node => {
          if (node instanceof HTMLMediaElement) {
            console.log('[AudioCompressor] Media element removed:', node);
            this.detachCompressor(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('[AudioCompressor] Media element observer setup complete');
  }
}

// コンプレッサーのインスタンスを作成
console.log('[AudioCompressor] Starting initialization');
new AudioCompressor();