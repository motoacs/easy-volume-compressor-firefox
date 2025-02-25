import { CompressorSettings, DEFAULT_SETTINGS } from '../types';

interface UIControls {
  enabled: HTMLInputElement;
  threshold: HTMLInputElement;
  ratio: HTMLInputElement;
  attack: HTMLInputElement;
  release: HTMLInputElement;
  gain: HTMLInputElement;
  [key: string]: HTMLInputElement;
}

class PopupUI {
  private settings: CompressorSettings = DEFAULT_SETTINGS;
  private currentDomain: string = '';
  private controls: UIControls;
  private saveTimeout: number | null = null;
  private isUpdating = false;

  constructor() {
    this.controls = this.initializeControls();
    this.initializeUI();
    this.addDebounce();
  }

  private initializeControls(): UIControls {
    const getElement = (id: string): HTMLInputElement => {
      const element = document.getElementById(id);
      if (!element || !(element instanceof HTMLInputElement)) {
        throw new Error(`Control element ${id} not found or invalid`);
      }
      return element;
    };

    return {
      enabled: getElement('enabled'),
      threshold: getElement('threshold'),
      ratio: getElement('ratio'),
      attack: getElement('attack'),
      release: getElement('release'),
      gain: getElement('gain')
    };
  }

  private async initializeUI() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.url) {
        this.currentDomain = new URL(currentTab.url).hostname;
        document.title = `音量調整 - ${this.currentDomain}`;

        const settings = await browser.runtime.sendMessage({
          type: 'GET_SETTINGS',
          domain: this.currentDomain
        });

        if (settings) {
          this.settings = settings;
          this.updateUIFromSettings();
        }
      } else {
        this.showError('現在のタブのURLを取得できません');
        this.disableControls();
      }
    } catch (error) {
      console.error('Failed to initialize UI:', error);
      this.showError('設定の読み込みに失敗しました');
      this.disableControls();
    }

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 各コントロールのイベントリスナー
    Object.entries(this.controls).forEach(([key, control]) => {
      control.addEventListener('change', () => this.handleControlChange(key));
      control.addEventListener('input', () => this.updateValueDisplay(key));
    });

    // リセットボタン
    const resetButton = document.getElementById('reset');
    if (resetButton) {
      resetButton.addEventListener('click', () => this.handleReset());
    }

    // フォーム送信の防止
    document.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
    });
  }

  private addDebounce() {
    const debouncedSave = (key: string) => {
      if (this.saveTimeout) {
        window.clearTimeout(this.saveTimeout);
      }

      this.saveTimeout = window.setTimeout(() => {
        this.saveSettings();
      }, 300);
    };

    Object.entries(this.controls).forEach(([key, control]) => {
      control.addEventListener('input', () => debouncedSave(key));
    });
  }

  private updateUIFromSettings() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      this.controls.enabled.checked = this.settings.enabled;
      this.controls.threshold.value = this.settings.threshold.toString();
      this.controls.ratio.value = this.settings.ratio.toString();
      this.controls.attack.value = this.settings.attack.toString();
      this.controls.release.value = this.settings.release.toString();
      this.controls.gain.value = this.settings.gain.toString();

      Object.keys(this.controls).forEach(key => this.updateValueDisplay(key));
      
      this.updateControlsState();
    } finally {
      this.isUpdating = false;
    }
  }

  private updateValueDisplay(key: string) {
    const valueElement = document.getElementById(`${key}-value`);
    if (valueElement && key !== 'enabled') {
      valueElement.textContent = this.controls[key].value;
    }
  }

  private updateControlsState() {
    const isEnabled = this.controls.enabled.checked;
    Object.values(this.controls).forEach(control => {
      if (control !== this.controls.enabled) {
        control.disabled = !isEnabled;
      }
    });
  }

  private async handleControlChange(key: string) {
    if (!this.currentDomain || this.isUpdating) return;

    try {
      this.settings = {
        ...this.settings,
        [key]: key === 'enabled' ? this.controls[key].checked : parseFloat(this.controls[key].value)
      };

      if (key === 'enabled') {
        this.updateControlsState();
      }

      await this.saveSettings();
    } catch (error) {
      console.error('Failed to handle control change:', error);
      this.showError('設定の更新に失敗しました');
    }
  }

  private async saveSettings() {
    if (!this.currentDomain) return;

    try {
      await browser.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        domain: this.currentDomain,
        settings: this.settings
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showError('設定の保存に失敗しました');
    }
  }

  private async handleReset() {
    if (!this.currentDomain) return;

    try {
      await browser.runtime.sendMessage({
        type: 'RESET_SETTINGS',
        domain: this.currentDomain
      });

      this.settings = DEFAULT_SETTINGS;
      this.updateUIFromSettings();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showError('設定のリセットに失敗しました');
    }
  }

  private disableControls() {
    Object.values(this.controls).forEach(control => {
      control.disabled = true;
    });
  }

  private showError(message: string) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.textContent = message;
    document.body.insertBefore(errorContainer, document.body.firstChild);

    setTimeout(() => {
      errorContainer.remove();
    }, 3000);
  }
}

// UIの初期化
new PopupUI();