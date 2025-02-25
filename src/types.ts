export interface CompressorSettings {
  enabled: boolean;
  threshold: number;  // dB
  ratio: number;
  attack: number;    // ms
  release: number;   // ms
  gain: number;      // dB
}

export const DEFAULT_SETTINGS: CompressorSettings = {
  enabled: true,
  threshold: -24,
  ratio: 4,
  attack: 5,
  release: 50,
  gain: 0
};

export interface StorageData {
  [domain: string]: CompressorSettings;
}