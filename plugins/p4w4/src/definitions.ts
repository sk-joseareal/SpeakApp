export interface P4w4DetectedLanguage {
  language: string;
  confidence: number;
}

export interface P4w4LanguageDetectionResult {
  available: boolean;
  dominantLanguage: string;
  confidence: number;
  alternatives: P4w4DetectedLanguage[];
  textLength: number;
  alphaChars: number;
}

export interface P4w4PluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  reverse(options: { value: string }): Promise<{ value: string }>;
  resizeWebView(options: { offset: number }): Promise<void>;
  offsetTopWebView(options: { offset: number }): Promise<void>;
  getStatusBarHeight(): Promise<{ height: number }>;
  setNativeChrome(options: { backgroundColor: string; lightIcons?: boolean; source?: string; path?: string }): Promise<void>;
  detectLanguage(options: { text: string }): Promise<P4w4LanguageDetectionResult>;
  setStartupHtml(options: { file: string }): Promise<void>;
  resetBadgeCount(): Promise<void>;
  playNotificationBell(options?: { soundId?: number; durationMs?: number; vibrate?: boolean }): Promise<{ started?: boolean; stream?: number; vibrated?: boolean; mode?: string } | void>;
  playUiSfx(options: { assetPath: string; volume?: number }): Promise<{ started?: boolean; mode?: string } | void>;
}
