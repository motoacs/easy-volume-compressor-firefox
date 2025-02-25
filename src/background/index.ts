import { CompressorSettings, DEFAULT_SETTINGS, StorageData } from '../types';

class SettingsManager {
  private static instance: SettingsManager;
  private cache: Map<string, CompressorSettings> = new Map();

  private constructor() {
    this.initializeStorageListener();
  }

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private initializeStorageListener() {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        for (const [key, { newValue }] of Object.entries(changes)) {
          if (newValue) {
            this.cache.set(key, newValue as CompressorSettings);
          } else {
            this.cache.delete(key);
          }
        }
      }
    });
  }

  async getSettings(domain: string): Promise<CompressorSettings> {
    try {
      // キャッシュをチェック
      if (this.cache.has(domain)) {
        return this.cache.get(domain)!;
      }

      // ストレージから取得
      const result = await browser.storage.local.get(domain);
      const settings = result[domain] || DEFAULT_SETTINGS;
      
      // キャッシュに保存
      this.cache.set(domain, settings);
      
      return settings;
    } catch (error) {
      console.error(`Failed to get settings for domain ${domain}:`, error);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(domain: string, settings: CompressorSettings): Promise<void> {
    try {
      // 設定値の検証
      const validatedSettings = this.validateSettings(settings);
      
      // ストレージに保存
      await browser.storage.local.set({ [domain]: validatedSettings });
      
      // キャッシュを更新
      this.cache.set(domain, validatedSettings);

      // 同じドメインの他のタブに通知
      await this.notifyTabs(domain, validatedSettings);
    } catch (error) {
      console.error(`Failed to save settings for domain ${domain}:`, error);
      throw error;
    }
  }

  private validateSettings(settings: CompressorSettings): CompressorSettings {
    return {
      enabled: Boolean(settings.enabled),
      threshold: Math.max(-100, Math.min(0, Number(settings.threshold) || DEFAULT_SETTINGS.threshold)),
      ratio: Math.max(1, Math.min(20, Number(settings.ratio) || DEFAULT_SETTINGS.ratio)),
      attack: Math.max(0, Math.min(100, Number(settings.attack) || DEFAULT_SETTINGS.attack)),
      release: Math.max(0, Math.min(1000, Number(settings.release) || DEFAULT_SETTINGS.release)),
      gain: Math.max(-20, Math.min(20, Number(settings.gain) || DEFAULT_SETTINGS.gain))
    };
  }

  private async notifyTabs(domain: string, settings: CompressorSettings): Promise<void> {
    try {
      const tabs = await browser.tabs.query({});
      const updatePromises = tabs
        .filter(tab => tab.id && tab.url?.includes(domain))
        .map(tab => 
          browser.tabs.sendMessage(tab.id!, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          }).catch(error => {
            console.error(`Failed to notify tab ${tab.id}:`, error);
          })
        );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to notify tabs:', error);
    }
  }

  async clearDomainSettings(domain: string): Promise<void> {
    try {
      await browser.storage.local.remove(domain);
      this.cache.delete(domain);
      await this.notifyTabs(domain, DEFAULT_SETTINGS);
    } catch (error) {
      console.error(`Failed to clear settings for domain ${domain}:`, error);
      throw error;
    }
  }
}

// シングルトンインスタンスを作成
const settingsManager = SettingsManager.getInstance();

// メッセージハンドラーを設定
browser.runtime.onMessage.addListener(async (message: {
  type: string;
  domain?: string;
  settings?: CompressorSettings;
}): Promise<any> => {
  try {
    switch (message.type) {
      case 'GET_SETTINGS':
        if (message.domain) {
          return await settingsManager.getSettings(message.domain);
        }
        break;
      case 'SAVE_SETTINGS':
        if (message.domain && message.settings) {
          await settingsManager.saveSettings(message.domain, message.settings);
          return { success: true };
        }
        break;
      case 'RESET_SETTINGS':
        if (message.domain) {
          await settingsManager.clearDomainSettings(message.domain);
          return { success: true };
        }
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
});