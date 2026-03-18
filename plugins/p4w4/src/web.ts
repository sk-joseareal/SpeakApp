import { WebPlugin } from '@capacitor/core';

import type { P4w4LanguageDetectionResult, P4w4PluginPlugin } from './definitions';

export class P4w4PluginWeb extends WebPlugin implements P4w4PluginPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
  async reverse(options: { value: string }): Promise<{ value: string }> {
    const reversed = options.value.split('').reverse().join('');
    return { value: reversed };
  }

  async detectLanguage(options: { text: string }): Promise<P4w4LanguageDetectionResult> {
    const text = String(options && options.text ? options.text : '').trim();
    const alphaChars = Array.from(text).reduce(
      (count, char) => count + (/\p{L}/u.test(char) ? 1 : 0),
      0
    );
    return {
      available: false,
      dominantLanguage: '',
      confidence: 0,
      alternatives: [],
      textLength: text.length,
      alphaChars
    };
  }

  async playNotificationBell(_options?: { soundId?: number; durationMs?: number; vibrate?: boolean }): Promise<{ started?: boolean; stream?: number; vibrated?: boolean; mode?: string } | void> {
    return;
  }
}
