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

export interface P4w4TranslationResult {
  available: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  engine: string;
  modelDownloaded?: boolean;
  reason?: string;
}

export interface P4w4TranslationStatusResult {
  available: boolean;
  engine: string;
  platform?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  modelDownloaded?: boolean;
  reason?: string;
  osVersion?: string;
}

export interface P4w4DisplayZoomCompensationInfo {
  supported: boolean;
  enabled: boolean;
  applied: boolean;
  factor: number;
  currentZoom?: number;
  textZoom?: number;
  mode?: string;
  platform?: string;
  osVersion?: string;
  screenScale?: number;
  screenNativeScale?: number;
  fontScale?: number;
  density?: number;
  scaledDensity?: number;
  screenWidthPoints?: number;
  screenHeightPoints?: number;
  screenWidthPx?: number;
  screenHeightPx?: number;
  nativeScreenWidthPx?: number;
  nativeScreenHeightPx?: number;
  webViewWidth?: number;
  webViewHeight?: number;
}

export interface P4w4PluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  reverse(options: { value: string }): Promise<{ value: string }>;
  resizeWebView(options: { offset: number }): Promise<void>;
  offsetTopWebView(options: { offset: number }): Promise<void>;
  getStatusBarHeight(): Promise<{ height: number }>;
  getSystemInsets(): Promise<{ top: number; right: number; bottom: number; left: number; platform?: string; osVersion?: string }>;
  getDisplayZoomCompensationInfo(): Promise<P4w4DisplayZoomCompensationInfo>;
  setDisplayZoomCompensation(options: { enabled: boolean; factor?: number }): Promise<P4w4DisplayZoomCompensationInfo>;
  setNativeChrome(options: { backgroundColor: string; lightIcons?: boolean; source?: string; path?: string; legacyChromeDebug?: boolean }): Promise<void>;
  setLegacyChromeDebug(options: { enabled: boolean }): Promise<{ enabled?: boolean; platform?: string; osVersion?: string } | void>;
  detectLanguage(options: { text: string }): Promise<P4w4LanguageDetectionResult>;
  getTranslationStatus(options?: { sourceLanguage?: string; targetLanguage?: string }): Promise<P4w4TranslationStatusResult>;
  translateText(options: { text: string; sourceLanguage?: string; targetLanguage?: string }): Promise<P4w4TranslationResult>;
  setStartupHtml(options: { file: string }): Promise<void>;
  resetBadgeCount(): Promise<void>;
  playNotificationBell(options?: { soundId?: number; durationMs?: number; vibrate?: boolean }): Promise<{ started?: boolean; stream?: number; vibrated?: boolean; mode?: string } | void>;
  playUiSfx(options: { assetPath: string; volume?: number }): Promise<{ started?: boolean; mode?: string } | void>;
}
