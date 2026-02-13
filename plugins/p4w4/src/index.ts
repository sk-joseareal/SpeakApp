import { registerPlugin } from '@capacitor/core';

import type { P4w4PluginPlugin } from './definitions';

const P4w4Plugin = registerPlugin<P4w4PluginPlugin>('P4w4Plugin', {
  web: () => import('./web').then((m) => new m.P4w4PluginWeb()),
});

export * from './definitions';
export { P4w4Plugin };

// Para uso sin módulos
(window as any).P4w4 = P4w4Plugin
;


