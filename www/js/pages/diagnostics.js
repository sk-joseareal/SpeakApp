import { ensureInitialHash } from '../nav.js';
import {
  addNotification,
  clearNotifications,
  generateDemoNotifications,
  getNotifications
} from '../notifications-store.js';
import { clearOnboardingDone, getAppLocale } from '../state.js';
import {
  ensureTrainingData,
  getLocalizedContentField,
  getRoutes,
  getTrainingDataLoadInfo
} from '../data/training-data.js';
import { ensureReferenceData, getLocalizedMapField, getReferenceCourses } from '../data/reference-data.js';

class PageDiagnostics extends HTMLElement {
  connectedCallback() {
    
    this.classList.add('ion-page');

    const platform = window.r34lp0w3r?.platform || 'unknown';
    const uuid = window.uuid || localStorage.getItem('uuid') || 'n/a';
    const cacheKeys = Object.keys(localStorage || {}).length;
    let plugins = [];
    try {
      plugins = collectPlugins();
    } catch (e) {
      console.error('[diag] error en collectPlugins()', e);
      plugins = [];
    }

    const FREE_RIDE_AUDIO_MODE_KEY = 'appv5:free-ride-audio-mode';
    const FREE_RIDE_AUDIO_MODE_GENERATED = 'generated';
    const FREE_RIDE_AUDIO_MODE_LOCAL = 'local';
    const FREE_RIDE_ADVANCED_ENABLED_KEY = 'appv5:free-ride-advanced-enabled';
    const FREE_RIDE_WORD_TAP_AUDIO_ENABLED_KEY = 'appv5:free-ride-word-tap-audio-enabled';
    const SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY = 'appv5:speak-session-percentages-visible';
    const SPEAK_PRONUNCIATION_AVATAR_MODE_KEY = 'appv5:speak-pronunciation-avatar-mode';
    const SPEAK_PRONUNCIATION_AVATAR_OLD = 'old';
    const SPEAK_PRONUNCIATION_AVATAR_NEW = 'new';
    const REFERENCE_TAB_ENABLED_KEY = 'appv5:reference-tab-enabled';
    const CHAT_CATBOT_ENABLED_KEY = 'appv5:chat-catbot-enabled';
    const CHAT_CHATBOT_ENABLED_KEY = 'appv5:chat-chatbot-enabled';
    const TAB_VISIBILITY_ORDER = ['home', 'freeride', 'reference', 'chat', 'tu'];
    const TAB_VISIBILITY_KEYS = {
      home: 'appv5:tab-training-enabled',
      freeride: 'appv5:tab-lab-enabled',
      reference: REFERENCE_TAB_ENABLED_KEY,
      chat: 'appv5:tab-chat-enabled',
      tu: 'appv5:tab-you-enabled'
    };
    const TAB_VISIBILITY_DEFAULTS = {
      home: true,
      freeride: false,
      reference: false,
      chat: false,
      tu: true
    };
    const TAB_VISIBILITY_META = {
      home: {
        title: 'Tab Training',
        enabledSub: 'Activado: muestra el tab Training en la navegación inferior.',
        disabledSub: 'Desactivado: oculta el tab Training en la navegación inferior.'
      },
      freeride: {
        title: 'Tab Lab',
        enabledSub: 'Activado: muestra el tab Lab en la navegación inferior.',
        disabledSub: 'Desactivado: oculta el tab Lab en la navegación inferior.'
      },
      reference: {
        title: 'Tab Referencia',
        enabledSub: 'Activado: muestra el tab Referencia en la navegación inferior.',
        disabledSub: 'Desactivado: oculta el tab Referencia en la navegación inferior.'
      },
      chat: {
        title: 'Tab Chat',
        enabledSub: 'Activado: muestra el tab Chat en la navegación inferior.',
        disabledSub: 'Desactivado: oculta el tab Chat en la navegación inferior.'
      },
      tu: {
        title: 'Tab You',
        enabledSub: 'Activado: muestra el tab You en la navegación inferior.',
        disabledSub: 'Desactivado: oculta el tab You en la navegación inferior.'
      }
    };
    const normalizeFreeRideAudioMode = (value) => {
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      return normalized === FREE_RIDE_AUDIO_MODE_LOCAL
        ? FREE_RIDE_AUDIO_MODE_LOCAL
        : FREE_RIDE_AUDIO_MODE_GENERATED;
    };
    const getStoredFreeRideAudioMode = () => {
      const globalValue =
        window.r34lp0w3r && typeof window.r34lp0w3r.freeRideAudioMode === 'string'
          ? window.r34lp0w3r.freeRideAudioMode
          : '';
      if (globalValue) return normalizeFreeRideAudioMode(globalValue);
      try {
        return normalizeFreeRideAudioMode(localStorage.getItem(FREE_RIDE_AUDIO_MODE_KEY));
      } catch (err) {
        return FREE_RIDE_AUDIO_MODE_GENERATED;
      }
    };
    const normalizeFreeRideAdvancedEnabled = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return true;
      return !['0', 'false', 'off'].includes(normalized);
    };
    const getStoredFreeRideAdvancedEnabled = () => {
      const globalValue =
        window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'freeRideAdvancedEnabled')
          ? window.r34lp0w3r.freeRideAdvancedEnabled
          : undefined;
      if (globalValue !== undefined) return normalizeFreeRideAdvancedEnabled(globalValue);
      try {
        return normalizeFreeRideAdvancedEnabled(localStorage.getItem(FREE_RIDE_ADVANCED_ENABLED_KEY));
      } catch (err) {
        return true;
      }
    };
    const normalizeFreeRideWordTapAudioEnabled = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return false;
      return ['1', 'true', 'on'].includes(normalized);
    };
    const getStoredFreeRideWordTapAudioEnabled = () => {
      const globalValue =
        window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'freeRideWordTapAudioEnabled')
          ? window.r34lp0w3r.freeRideWordTapAudioEnabled
          : undefined;
      if (globalValue !== undefined) return normalizeFreeRideWordTapAudioEnabled(globalValue);
      try {
        return normalizeFreeRideWordTapAudioEnabled(localStorage.getItem(FREE_RIDE_WORD_TAP_AUDIO_ENABLED_KEY));
      } catch (err) {
        return false;
      }
    };
    const normalizeSpeakSessionPercentagesVisible = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return true;
      return !['0', 'false', 'off'].includes(normalized);
    };
    const getStoredSpeakSessionPercentagesVisible = () => {
      const globalValue =
        window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'speakSessionPercentagesVisible')
          ? window.r34lp0w3r.speakSessionPercentagesVisible
          : undefined;
      if (globalValue !== undefined) return normalizeSpeakSessionPercentagesVisible(globalValue);
      try {
        return normalizeSpeakSessionPercentagesVisible(localStorage.getItem(SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY));
      } catch (err) {
        return true;
      }
    };
    const normalizeSpeakPronunciationAvatarMode = (value) => {
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      return normalized === SPEAK_PRONUNCIATION_AVATAR_OLD
        ? SPEAK_PRONUNCIATION_AVATAR_OLD
        : SPEAK_PRONUNCIATION_AVATAR_NEW;
    };
    const getStoredSpeakPronunciationAvatarMode = () => {
      const globalValue =
        window.r34lp0w3r &&
        typeof window.r34lp0w3r.speakPronunciationAvatarMode === 'string'
          ? window.r34lp0w3r.speakPronunciationAvatarMode
          : '';
      if (globalValue) return normalizeSpeakPronunciationAvatarMode(globalValue);
      try {
        return normalizeSpeakPronunciationAvatarMode(
          localStorage.getItem(SPEAK_PRONUNCIATION_AVATAR_MODE_KEY)
        );
      } catch (err) {
        return SPEAK_PRONUNCIATION_AVATAR_OLD;
      }
    };
    const normalizeTabVisibilityEnabled = (tab, value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return Boolean(TAB_VISIBILITY_DEFAULTS[tab]);
      return !['0', 'false', 'off', 'no'].includes(normalized);
    };
    const getStoredTabVisibility = (tab) => {
      const globalMap = window.r34lp0w3r && window.r34lp0w3r.tabVisibility;
      if (globalMap && Object.prototype.hasOwnProperty.call(globalMap, tab)) {
        return normalizeTabVisibilityEnabled(tab, globalMap[tab]);
      }
      if (
        tab === 'reference' &&
        window.r34lp0w3r &&
        Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'referenceTabEnabled')
      ) {
        return normalizeTabVisibilityEnabled(tab, window.r34lp0w3r.referenceTabEnabled);
      }
      try {
        return normalizeTabVisibilityEnabled(tab, localStorage.getItem(TAB_VISIBILITY_KEYS[tab]));
      } catch (err) {
        return Boolean(TAB_VISIBILITY_DEFAULTS[tab]);
      }
    };
    const buildTabVisibilityToggleMarkup = () =>
      TAB_VISIBILITY_ORDER.map(
        (tab) => `
            <div class="diag-debug-toggle" style="margin-top: 10px;">
              <div class="diag-debug-text">
                <div class="diag-debug-title">${TAB_VISIBILITY_META[tab].title}</div>
                <div class="diag-debug-sub" id="diag-tab-${tab}-sub"></div>
              </div>
              <ion-toggle id="diag-tab-${tab}-toggle" aria-label="${TAB_VISIBILITY_META[tab].title}" ${getStoredTabVisibility(tab) ? 'checked' : ''}></ion-toggle>
            </div>`
      ).join('');
    const normalizeReferenceTabEnabled = (value) => {
      return normalizeTabVisibilityEnabled('reference', value);
    };
    const getStoredReferenceTabEnabled = () => {
      return getStoredTabVisibility('reference');
    };
    const normalizeChatCatbotEnabled = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return false;
      return ['1', 'true', 'on', 'yes'].includes(normalized);
    };
    const getStoredChatCatbotEnabled = () => {
      const globalValue =
        window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'chatCatbotEnabled')
          ? window.r34lp0w3r.chatCatbotEnabled
          : undefined;
      if (globalValue !== undefined) return normalizeChatCatbotEnabled(globalValue);
      try {
        return normalizeChatCatbotEnabled(localStorage.getItem(CHAT_CATBOT_ENABLED_KEY));
      } catch (err) {
        return false;
      }
    };
    const normalizeChatChatbotEnabled = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return false;
      return ['1', 'true', 'on', 'yes'].includes(normalized);
    };
    const getStoredChatChatbotEnabled = () => {
      const globalValue =
        window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'chatChatbotEnabled')
          ? window.r34lp0w3r.chatChatbotEnabled
          : undefined;
      if (globalValue !== undefined) return normalizeChatChatbotEnabled(globalValue);
      try {
        return normalizeChatChatbotEnabled(localStorage.getItem(CHAT_CHATBOT_ENABLED_KEY));
      } catch (err) {
        return false;
      }
    };

    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button fill="clear" id="diag-back">
              <ion-icon slot="icon-only" name="chevron-back"></ion-icon>
            </ion-button>
          </ion-buttons>
          <ion-title>Diagnósticos</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <div class="card placeholder-card">
            <div class="diag-debug-toggle">
              <div class="diag-debug-text">
                <div class="diag-debug-title">Modo debug</div>
                <div class="diag-debug-sub">Muestra caja con esperado / transcrito / porcentaje y overrrides en Speak.</div>
                <div class="diag-debug-sub">Permite acceder a cualquier ruta.</div>
              </div>
              <ion-toggle id="diag-debug-toggle" aria-label="Modo debug"></ion-toggle>
            </div>
            <div class="diag-debug-toggle" style="margin-top: 10px;">
              <div class="diag-debug-text">
                <div class="diag-debug-title">Porcentajes en sesión (Training)</div>
                <div class="diag-debug-sub" id="diag-speak-session-percentages-sub"></div>
              </div>
              <ion-toggle id="diag-speak-session-percentages-toggle" aria-label="Porcentajes en sesión (Training)" ${getStoredSpeakSessionPercentagesVisible() ? 'checked' : ''}></ion-toggle>
            </div>
            <div class="diag-speak-block">
              <div class="diag-debug-title">Avatar pronunciación</div>
              <div class="diag-audio-mode-wrap">
                <ion-segment
                  id="diag-speak-pronunciation-avatar-mode"
                  value="${getStoredSpeakPronunciationAvatarMode()}"
                >
                  <ion-segment-button value="new">
                    <ion-label>Nuevo</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="old">
                    <ion-label>Antiguo</ion-label>
                  </ion-segment-button>
                </ion-segment>
                <div class="diag-debug-sub" id="diag-speak-pronunciation-avatar-sub"></div>
              </div>
            </div>

            ${buildTabVisibilityToggleMarkup()}
            <div class="diag-debug-toggle" style="margin-top: 10px;">
              <div class="diag-debug-text">
                <div class="diag-debug-title">Catbot</div>
                <div class="diag-debug-sub" id="diag-chat-community-sub"></div>
              </div>
              <ion-toggle id="diag-chat-community-toggle" aria-label="Catbot" ${getStoredChatCatbotEnabled() ? 'checked' : ''}></ion-toggle>
            </div>
            <div class="diag-debug-toggle" style="margin-top: 10px;">
              <div class="diag-debug-text">
                <div class="diag-debug-title">Chatbot</div>
                <div class="diag-debug-sub" id="diag-chat-chatbot-sub"></div>
              </div>
              <ion-toggle id="diag-chat-chatbot-toggle" aria-label="Chatbot" ${getStoredChatChatbotEnabled() ? 'checked' : ''}></ion-toggle>
            </div>
            
            <div id="diag-user" style="display:none; margin-bottom:12px;">
              <div class="pill">Usuario</div>
              <p>ID: <strong id="diag-user-id"></strong></p>
              <p>Nombre: <strong id="diag-user-name"></strong></p>
              <p>Avatar: <strong id="diag-user-avatar"></strong></p>
              <p>Premium hasta: <strong id="diag-user-chat-expiry"></strong></p>
              <div class="diag-avatar-wrap">
                <img id="diag-user-avatar-img" src="" alt="Avatar" class="diag-avatar">
              </div>
              <hr>
            </div>
            <div class="pill">Build V5</div>
            <hr>
            <h3>Estado</h3>
            <p>Plataforma: <strong>${platform}</strong></p>
            <p>UUID: <strong>${uuid}</strong></p>
            <p>Entradas en localStorage: <strong>${cacheKeys}</strong></p>
            <h4 style="margin-top:12px;">Plugins activos</h4>
            <ul class="diag-list">
              ${plugins
                .map(
                  (p) =>
                    `<li data-diag-idx="${p.idx}"><span>${p.source}:${p.name}</span><span class="muted">${formatVersion(p.version)}</span></li>`
                )
                .join('')}
            </ul>

            <h4 style="margin-top:16px;">Status bar</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="sb-blue">Fondo azul</ion-button>
              <ion-button size="small" fill="outline" id="sb-transparent">Fondo transparente</ion-button>
              <ion-button size="small" fill="outline" id="sb-light">Iconos oscuros</ion-button>
              <ion-button size="small" fill="outline" id="sb-dark">Iconos claros</ion-button>
            </div>

            <h4 style="margin-top:16px;">Notificaciones Push</h4>
            <p>Token fcm: <strong>${window.__fcmToken ? window.__fcmToken : 'n/a'}</strong></p>
            <p>Token APNs: <strong>${window.__APNsToken ? window.__APNsToken : 'n/a' }</strong></p>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="pn-bell">Probar campana</ion-button>
              <ion-button size="small" fill="outline" id="pn-10s">Recibir en 10 segundos</ion-button>
            </div>

            <h4 style="margin-top:16px;">AdMob</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="admob-form">Formulario autorización</ion-button>
              <ion-button size="small" fill="outline" id="admob-init">Inicializar</ion-button>
              <ion-button size="small" fill="outline" id="admob-banner-show">Mostrar banner</ion-button>
              <ion-button size="small" fill="outline" id="admob-banner-hide">Ocultar banner</ion-button>
              <ion-button size="small" fill="outline" id="admob-interstitial-prepare">Preparar intersticial</ion-button>
              <ion-button size="small" fill="outline" id="admob-interstitial-show">Mostrar intersticial</ion-button>
            </div>

            <h4 style="margin-top:16px;">Varios</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="var-sendmail">Contact</ion-button>
              <ion-button size="small" fill="outline" id="var-goweblegal">Legal web</ion-button>
            </div>

            <h4 style="margin-top:16px;">Onboarding</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-onboarding-repeat">Repetir onboarding</ion-button>
            </div>

            <h4 style="margin-top:16px;">Reset app</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" color="danger" id="diag-app-reset">Reset completo</ion-button>
            </div>
            <p class="diag-debug-sub">Borra local/session storage y reinicia la app como primera ejecución.</p>

            <h4 style="margin-top:16px;">Training content</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-content-source-refresh">Refrescar</ion-button>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Training data source</div>
              <pre class="diag-json" id="diag-content-source"></pre>
            </div>
	            <div class="diag-speak-block">
	              <div class="pill">Free ride / chatbot audio</div>
              <div class="diag-audio-mode-wrap">
                <ion-segment id="diag-free-ride-audio-mode" value="${getStoredFreeRideAudioMode()}">
                  <ion-segment-button value="generated">
                    <ion-label>Alineado</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="local">
                    <ion-label>Local</ion-label>
                  </ion-segment-button>
                </ion-segment>
	                <div class="diag-debug-sub" id="diag-free-ride-audio-sub"></div>
              </div>
              <div class="diag-debug-toggle" style="margin-top: 10px;">
                <div class="diag-debug-text">
                  <div class="diag-debug-title">Pronunciación avanzada (Free ride)</div>
                  <div class="diag-debug-sub" id="diag-free-ride-advanced-sub"></div>
                </div>
                <ion-toggle id="diag-free-ride-advanced-toggle" aria-label="Pronunciación avanzada (Free ride)" ${getStoredFreeRideAdvancedEnabled() ? 'checked' : ''}></ion-toggle>
              </div>
              <div class="diag-debug-toggle" style="margin-top: 10px;">
                <div class="diag-debug-text">
                  <div class="diag-debug-title">Audio por palabra (Free ride)</div>
                  <div class="diag-debug-sub" id="diag-free-ride-word-tap-audio-sub"></div>
                </div>
                <ion-toggle id="diag-free-ride-word-tap-audio-toggle" aria-label="Audio por palabra (Free ride)" ${getStoredFreeRideWordTapAudioEnabled() ? 'checked' : ''}></ion-toggle>
              </div>
            </div>

            <h4 style="margin-top:16px;">Speak stores</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-speak-refresh">Refrescar</ion-button>
              <ion-button size="small" fill="outline" id="diag-speak-seed">Init demo</ion-button>
              <ion-button size="small" fill="outline" id="diag-speak-reset">Limpiar</ion-button>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Words</div>
              <pre class="diag-json" id="diag-speak-words"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Phrase</div>
              <pre class="diag-json" id="diag-speak-phrase"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Rewards</div>
              <pre class="diag-json" id="diag-speak-rewards"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Badges (test)</div>
              <div class="diag-badges-picker" id="diag-badges-picker"></div>
              <div class="diag-debug-sub" id="diag-badges-sub"></div>
              <pre class="diag-json" id="diag-speak-badges"></pre>
            </div>

            <h4 style="margin-top:16px;">Talk timelines</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-talk-refresh">Refrescar</ion-button>
              <ion-button size="small" fill="outline" id="diag-talk-reset">Init</ion-button>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Catbot</div>
              <pre class="diag-json" id="diag-talk-catbot"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Chatbot</div>
              <pre class="diag-json" id="diag-talk-chatbot"></pre>
            </div>

	            <h4 style="margin-top:16px;">Chatbot usage (usuario/dia)</h4>
	            <div class="diag-actions">
	              <ion-button size="small" fill="outline" id="diag-usage-refresh">Refrescar</ion-button>
	            </div>
	            <div class="diag-speak-block">
              <div class="pill">Tokens y coste</div>
              <div class="diag-usage-status" id="diag-usage-status">Cargando...</div>
              <div class="diag-actions diag-usage-limit-actions">
                <input
                  id="diag-usage-limit-input"
                  class="chat-text-input diag-usage-limit-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Limite tokens/dia"
                />
                <ion-button size="small" fill="outline" id="diag-usage-limit-save">Guardar limite</ion-button>
                <ion-button size="small" fill="outline" color="medium" id="diag-usage-limit-clear">Sin limite</ion-button>
              </div>
              <div class="diag-usage-limit-status" id="diag-usage-limit-status"></div>
              <div class="diag-usage-totals" id="diag-usage-totals" hidden></div>
	              <div class="diag-usage-list" id="diag-usage-list"></div>
	            </div>

		            <h4 style="margin-top:16px;">TTS aligned usage (usuario/dia)</h4>
		            <div class="diag-actions">
		              <ion-button size="small" fill="outline" id="diag-tts-usage-refresh">Refrescar</ion-button>
		            </div>
		            <div class="diag-speak-block">
              <div class="pill">Chars y coste</div>
              <div class="diag-usage-status" id="diag-tts-usage-status">Cargando...</div>
              <div class="diag-actions diag-usage-limit-actions">
                <input
                  id="diag-tts-usage-limit-input"
                  class="chat-text-input diag-usage-limit-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Limite chars/dia"
                />
                <ion-button size="small" fill="outline" id="diag-tts-usage-limit-save">Guardar limite</ion-button>
                <ion-button size="small" fill="outline" color="medium" id="diag-tts-usage-limit-clear">Sin limite</ion-button>
              </div>
              <div class="diag-usage-limit-status" id="diag-tts-usage-limit-status"></div>
              <div class="diag-usage-totals" id="diag-tts-usage-totals" hidden></div>
		              <div class="diag-usage-list" id="diag-tts-usage-list"></div>
		            </div>

			            <div id="diag-pron-advanced-usage-section" ${getStoredFreeRideAdvancedEnabled() ? '' : 'hidden'}>
			            <h4 style="margin-top:16px;">Pronunciation advanced usage (usuario/dia)</h4>
			            <div class="diag-actions">
			              <ion-button size="small" fill="outline" id="diag-pron-usage-refresh">Refrescar</ion-button>
			            </div>
			            <div class="diag-speak-block">
	              <div class="pill">Segundos y coste</div>
              <div class="diag-usage-status" id="diag-pron-usage-status">Cargando...</div>
              <div class="diag-actions diag-usage-limit-actions">
                <input
                  id="diag-pron-usage-limit-input"
                  class="chat-text-input diag-usage-limit-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Limite seg/dia"
                />
                <ion-button size="small" fill="outline" id="diag-pron-usage-limit-save">Guardar limite</ion-button>
                <ion-button size="small" fill="outline" color="medium" id="diag-pron-usage-limit-clear">Sin limite</ion-button>
			            </div>
                  </div>
              <div class="diag-usage-limit-status" id="diag-pron-usage-limit-status"></div>
              <div class="diag-usage-totals" id="diag-pron-usage-totals" hidden></div>
		              <div class="diag-usage-list" id="diag-pron-usage-list"></div>
		            </div>

		            <h4 style="margin-top:16px;">Prueba TTS navegador (aislada)</h4>
	            <div class="diag-speak-block">
	              <div class="pill">Web Speech API</div>
	              <textarea
	                id="diag-tts-input"
	                class="chat-text-input diag-tts-input"
	                rows="3"
	                placeholder="Texto para reproducir por TTS en el navegador"
	              >This is a browser TTS diagnostic test.</textarea>
	              <div class="diag-actions diag-tts-actions">
	                <ion-button size="small" fill="outline" id="diag-tts-play">Play TTS</ion-button>
	              </div>
	              <div class="diag-tts-status" id="diag-tts-status">Listo.</div>
	            </div>

              <h4 style="margin-top:16px;">Detección de idioma</h4>
              <div class="diag-speak-block">
                <div class="pill">NLLanguageRecognizer / ML Kit</div>
                <textarea
                  id="diag-language-input"
                  class="chat-text-input diag-tts-input"
                  rows="3"
                  placeholder="Texto para detectar idioma"
                >Hello, how are you today? I am practicing English.</textarea>
                <div class="diag-actions diag-tts-actions">
                  <ion-button size="small" fill="outline" id="diag-language-detect">Detectar idioma</ion-button>
                </div>
                <div class="diag-tts-status" id="diag-language-status">Listo.</div>
                <pre class="diag-json" id="diag-language-output"></pre>
              </div>

              <h4 style="margin-top:16px;">Moderación OpenAI</h4>
              <div class="diag-speak-block">
                <div class="pill">OpenAI Moderation</div>
                <textarea
                  id="diag-openai-moderation-input"
                  class="chat-text-input diag-tts-input"
                  rows="4"
                  placeholder="Texto para analizar con el endpoint de moderación"
                >Hello, can you help me practice this lesson in English?</textarea>
                <div class="diag-actions diag-tts-actions">
                  <ion-button size="small" fill="outline" id="diag-openai-moderation-run">Analizar moderación</ion-button>
                </div>
                <div class="diag-tts-status" id="diag-openai-moderation-status">Listo.</div>
                <div id="diag-openai-moderation-summary" hidden></div>
                <pre class="diag-json" id="diag-openai-moderation-output"></pre>
              </div>

              <h4 style="margin-top:16px;">Audio UI (SFX)</h4>
              <div class="diag-actions">
                <ion-button size="small" fill="outline" id="diag-sfx-green">Green</ion-button>
                <ion-button size="small" fill="outline" id="diag-sfx-yellow">Yellow</ion-button>
                <ion-button size="small" fill="outline" id="diag-sfx-red">Red</ion-button>
                <ion-button size="small" fill="outline" id="diag-sfx-notification">Notification</ion-button>
              </div>
              <div class="diag-tts-status" id="diag-sfx-status">Listo.</div>

	            <h4 style="margin-top:16px;">Notificaciones demo</h4>
	            <div class="diag-actions">
	              <ion-button size="small" fill="outline" id="diag-notify-generate">Generar</ion-button>
              <ion-button size="small" fill="outline" id="diag-notify-open">Abrir</ion-button>
              <ion-button size="small" fill="outline" id="diag-notify-clear">Limpiar</ion-button>
            </div>
            <div class="notify-list diag-notify-list" id="diag-notify-list"></div>
            <div class="notify-empty" id="diag-notify-empty" hidden>No hay notificaciones demo.</div>

            <h4 style="margin-top:16px;">Login</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-login">Abrir login</ion-button>
              <ion-button size="small" fill="outline" id="diag-logout" style="display:none;">Logout</ion-button>
            </div>

          </div>
        </div>
      </ion-content>
    `;

    /*
    this.innerHTML = `
      <ion-header>
        <ion-toolbar>
          <ion-title>Diagnósticos</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <p>Diagnósticos en construcción.</p>
        </div>
      </ion-content>
    `;
    */

    resolveVersionsAsync(plugins, this);
    const debugToggle = this.querySelector('#diag-debug-toggle');
    if (debugToggle) {
      const applyDebug = (enabled) => {
        if (typeof window.setSpeakDebug === 'function') {
          window.setSpeakDebug(enabled);
          return;
        }
        window.r34lp0w3r = window.r34lp0w3r || {};
        window.r34lp0w3r.speakDebug = !!enabled;
        try {
          if (enabled) {
            localStorage.setItem('appv5:speak-debug', '1');
          } else {
            localStorage.removeItem('appv5:speak-debug');
          }
        } catch (err) {
          console.error('[diag] error guardando debug', err);
        }
        window.dispatchEvent(new CustomEvent('app:speak-debug', { detail: !!enabled }));
      };

      debugToggle.checked = !!(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      debugToggle.addEventListener('ionChange', (event) => {
        const checked = event && event.detail ? event.detail.checked : debugToggle.checked;
        applyDebug(checked);
      });
    }

    const formatExpiry = (value) => {
      if (!value) return 'n/a';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toISOString();
    };

    const resolveAvatarSrc = (user) => {
      if (!user) return '';
      const local = user.image_local;
      if (local && typeof local === 'string') return local;
      return user.image || '';
    };

    const setAvatarImg = (imgEl, user) => {
      if (!imgEl) return;
      const initial = resolveAvatarSrc(user);
      const remote = user && user.image ? String(user.image) : '';
      imgEl.dataset.fallback = '';
      imgEl.onerror = null;
      imgEl.onload = null;
      if (!initial) {
        imgEl.src = '';
        return;
      }
      imgEl.onerror = () => {
        if (!remote || imgEl.dataset.fallback === '1' || imgEl.src === remote) return;
        imgEl.dataset.fallback = '1';
        imgEl.src = remote;
      };
      imgEl.src = initial;
    };

    const updateUserPanel = (user) => {
      const panel = this.querySelector('#diag-user');
      if (!panel) return;
      const loginBtn = this.querySelector('#diag-login');
      const logoutBtn = this.querySelector('#diag-logout');
      if (user) {
        const idEl = this.querySelector('#diag-user-id');
        const nameEl = this.querySelector('#diag-user-name');
        const avatarEl = this.querySelector('#diag-user-avatar');
        const avatarImgEl = this.querySelector('#diag-user-avatar-img');
        const chatExpiryEl = this.querySelector('#diag-user-chat-expiry');
        if (avatarEl) avatarEl.textContent = user.avatar || 'n/a';
        if (idEl) idEl.textContent = user.id || 'n/a';
        if (nameEl) nameEl.textContent = user.name || 'n/a';
        const avatarSrc = resolveAvatarSrc(user);
        if (avatarEl) avatarEl.textContent = avatarSrc || 'n/a';
        setAvatarImg(avatarImgEl, user);
        if (chatExpiryEl) {
          chatExpiryEl.textContent = formatExpiry(user.expires_date);
        }
        panel.style.display = 'block';
        if (loginBtn) loginBtn.disabled = true;
        if (logoutBtn) logoutBtn.style.display = '';
      } else {
        panel.style.display = 'none';
        if (loginBtn) loginBtn.disabled = false;
        if (logoutBtn) logoutBtn.style.display = 'none';
      }
    };

    updateUserPanel(window.user);
    this._userHandler = (event) => {
      updateUserPanel(event.detail);
      updateTalkPanels();
      refreshUserUsage();
      refreshTtsUserUsage();
      refreshPronUserUsage();
      TAB_VISIBILITY_ORDER.forEach((tab) => {
        updateTabVisibilityUi(tab, getStoredTabVisibility(tab));
      });
    };
    window.addEventListener('app:user-change', this._userHandler);

    const wordsEl = this.querySelector('#diag-speak-words');
    const phraseEl = this.querySelector('#diag-speak-phrase');
    const rewardsEl = this.querySelector('#diag-speak-rewards');
    const badgesEl = this.querySelector('#diag-speak-badges');
    const badgesPickerEl = this.querySelector('#diag-badges-picker');
    const badgesSubEl = this.querySelector('#diag-badges-sub');
    const talkCatEl = this.querySelector('#diag-talk-catbot');
    const talkBotEl = this.querySelector('#diag-talk-chatbot');
    const usageStatusEl = this.querySelector('#diag-usage-status');
    const usageLimitInputEl = this.querySelector('#diag-usage-limit-input');
    const usageLimitStatusEl = this.querySelector('#diag-usage-limit-status');
    const usageLimitSaveBtn = this.querySelector('#diag-usage-limit-save');
    const usageLimitClearBtn = this.querySelector('#diag-usage-limit-clear');
    const usageTotalsEl = this.querySelector('#diag-usage-totals');
    const usageListEl = this.querySelector('#diag-usage-list');
    const ttsUsageStatusEl = this.querySelector('#diag-tts-usage-status');
    const ttsUsageLimitInputEl = this.querySelector('#diag-tts-usage-limit-input');
    const ttsUsageLimitStatusEl = this.querySelector('#diag-tts-usage-limit-status');
    const ttsUsageLimitSaveBtn = this.querySelector('#diag-tts-usage-limit-save');
    const ttsUsageLimitClearBtn = this.querySelector('#diag-tts-usage-limit-clear');
    const ttsUsageTotalsEl = this.querySelector('#diag-tts-usage-totals');
    const ttsUsageListEl = this.querySelector('#diag-tts-usage-list');
    const pronUsageStatusEl = this.querySelector('#diag-pron-usage-status');
    const pronUsageLimitInputEl = this.querySelector('#diag-pron-usage-limit-input');
    const pronUsageLimitStatusEl = this.querySelector('#diag-pron-usage-limit-status');
    const pronUsageLimitSaveBtn = this.querySelector('#diag-pron-usage-limit-save');
    const pronUsageLimitClearBtn = this.querySelector('#diag-pron-usage-limit-clear');
    const pronUsageTotalsEl = this.querySelector('#diag-pron-usage-totals');
    const pronUsageListEl = this.querySelector('#diag-pron-usage-list');
    const ttsInputEl = this.querySelector('#diag-tts-input');
    const ttsPlayBtn = this.querySelector('#diag-tts-play');
    const ttsStatusEl = this.querySelector('#diag-tts-status');
    const languageInputEl = this.querySelector('#diag-language-input');
    const languageDetectBtn = this.querySelector('#diag-language-detect');
    const languageStatusEl = this.querySelector('#diag-language-status');
    const languageOutputEl = this.querySelector('#diag-language-output');
    const moderationInputEl = this.querySelector('#diag-openai-moderation-input');
    const moderationRunBtn = this.querySelector('#diag-openai-moderation-run');
    const moderationStatusEl = this.querySelector('#diag-openai-moderation-status');
    const moderationSummaryEl = this.querySelector('#diag-openai-moderation-summary');
    const moderationOutputEl = this.querySelector('#diag-openai-moderation-output');
    const sfxGreenBtn = this.querySelector('#diag-sfx-green');
    const sfxYellowBtn = this.querySelector('#diag-sfx-yellow');
    const sfxRedBtn = this.querySelector('#diag-sfx-red');
    const sfxNotificationBtn = this.querySelector('#diag-sfx-notification');
    const sfxStatusEl = this.querySelector('#diag-sfx-status');
    const freeRideAudioModeEl = this.querySelector('#diag-free-ride-audio-mode');
    const freeRideAudioSubEl = this.querySelector('#diag-free-ride-audio-sub');
    const freeRideAdvancedToggleEl = this.querySelector('#diag-free-ride-advanced-toggle');
    const freeRideAdvancedSubEl = this.querySelector('#diag-free-ride-advanced-sub');
    const freeRideWordTapAudioToggleEl = this.querySelector('#diag-free-ride-word-tap-audio-toggle');
    const freeRideWordTapAudioSubEl = this.querySelector('#diag-free-ride-word-tap-audio-sub');
    const speakSessionPercentagesToggleEl = this.querySelector('#diag-speak-session-percentages-toggle');
    const speakSessionPercentagesSubEl = this.querySelector('#diag-speak-session-percentages-sub');
    const speakPronunciationAvatarModeEl = this.querySelector('#diag-speak-pronunciation-avatar-mode');
    const speakPronunciationAvatarSubEl = this.querySelector('#diag-speak-pronunciation-avatar-sub');
    const tabVisibilityToggleEls = Object.fromEntries(
      TAB_VISIBILITY_ORDER.map((tab) => [tab, this.querySelector(`#diag-tab-${tab}-toggle`)])
    );
    const tabVisibilitySubEls = Object.fromEntries(
      TAB_VISIBILITY_ORDER.map((tab) => [tab, this.querySelector(`#diag-tab-${tab}-sub`)])
    );
    const chatCommunityToggleEl = this.querySelector('#diag-chat-community-toggle');
    const chatCommunitySubEl = this.querySelector('#diag-chat-community-sub');
    const chatChatbotToggleEl = this.querySelector('#diag-chat-chatbot-toggle');
    const chatChatbotSubEl = this.querySelector('#diag-chat-chatbot-sub');
    const pronAdvancedUsageSectionEl = this.querySelector('#diag-pron-advanced-usage-section');
    const notifyListEl = this.querySelector('#diag-notify-list');
    const notifyEmptyEl = this.querySelector('#diag-notify-empty');
    const contentSourceEl = this.querySelector('#diag-content-source');
    const TALK_STORAGE_PREFIX = 'appv5:talk-timelines:';
    let usageRequestSeq = 0;
    let ttsUsageRequestSeq = 0;
    let pronUsageRequestSeq = 0;
    let ttsUtter = null;
    let ttsPlaying = false;

    const setFreeRideAudioMode = (mode) => {
      const normalized = normalizeFreeRideAudioMode(mode);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.freeRideAudioMode = normalized;
      try {
        localStorage.setItem(FREE_RIDE_AUDIO_MODE_KEY, normalized);
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:free-ride-audio-mode-change', {
          detail: { mode: normalized }
        })
      );
      return normalized;
    };

    const updateFreeRideAudioModeUi = (mode) => {
      const normalized = normalizeFreeRideAudioMode(mode);
      if (freeRideAudioModeEl) {
        freeRideAudioModeEl.value = normalized;
      }
	      if (freeRideAudioSubEl) {
	        freeRideAudioSubEl.textContent =
	          normalized === FREE_RIDE_AUDIO_MODE_LOCAL
	            ? 'Local (Free ride / chatbot audio): usa TTS nativo/web; en Free ride aplica realce global mientras suena.'
	            : 'Alineado (Free ride / chatbot audio): usa backend alineado (audio + timings; en Free ride con highlighting progresivo por palabra).';
	      }
	      return normalized;
	    };

    const setFreeRideAdvancedEnabled = (enabled) => {
      const normalized = normalizeFreeRideAdvancedEnabled(enabled);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.freeRideAdvancedEnabled = normalized;
      try {
        localStorage.setItem(FREE_RIDE_ADVANCED_ENABLED_KEY, normalized ? '1' : '0');
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:free-ride-advanced-enabled-change', {
          detail: { enabled: normalized }
        })
      );
      return normalized;
    };

    const updateFreeRideAdvancedUi = (enabled) => {
      const normalized = normalizeFreeRideAdvancedEnabled(enabled);
      if (freeRideAdvancedToggleEl) {
        freeRideAdvancedToggleEl.checked = normalized;
      }
      if (freeRideAdvancedSubEl) {
        freeRideAdvancedSubEl.textContent = normalized
          ? 'Activado: permite usar la evaluación Advanced (Azure Speech) en Free ride y mostrar su feedback.'
          : 'Desactivado: Free ride fuerza evaluación Standard y oculta el feedback Advanced.';
      }
      if (pronAdvancedUsageSectionEl) {
        pronAdvancedUsageSectionEl.hidden = !normalized;
      }
      return normalized;
    };

    const setFreeRideWordTapAudioEnabled = (enabled) => {
      const normalized = normalizeFreeRideWordTapAudioEnabled(enabled);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.freeRideWordTapAudioEnabled = normalized;
      try {
        localStorage.setItem(FREE_RIDE_WORD_TAP_AUDIO_ENABLED_KEY, normalized ? '1' : '0');
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:free-ride-word-tap-audio-enabled-change', {
          detail: { enabled: normalized }
        })
      );
      return normalized;
    };

    const updateFreeRideWordTapAudioUi = (enabled) => {
      const normalized = normalizeFreeRideWordTapAudioEnabled(enabled);
      if (freeRideWordTapAudioToggleEl) {
        freeRideWordTapAudioToggleEl.checked = normalized;
      }
      if (freeRideWordTapAudioSubEl) {
        freeRideWordTapAudioSubEl.textContent = normalized
          ? 'Activado: al tocar palabras en Free ride (frase y popup) reproduce el fragmento correspondiente del audio grabado.'
          : 'Desactivado: tocar palabras solo selecciona/inspecciona, sin reproducir fragmentos.';
      }
      return normalized;
    };

    const setSpeakSessionPercentagesVisible = (visible) => {
      const normalized = normalizeSpeakSessionPercentagesVisible(visible);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.speakSessionPercentagesVisible = normalized;
      try {
        localStorage.setItem(SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY, normalized ? '1' : '0');
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:speak-session-percentages-visible-change', {
          detail: { visible: normalized }
        })
      );
      return normalized;
    };

    const updateSpeakSessionPercentagesUi = (visible) => {
      const normalized = normalizeSpeakSessionPercentagesVisible(visible);
      if (speakSessionPercentagesToggleEl) {
        speakSessionPercentagesToggleEl.checked = normalized;
      }
      if (speakSessionPercentagesSubEl) {
        speakSessionPercentagesSubEl.textContent = normalized
          ? 'Activado: muestra los porcentajes (%) en las pantallas de la sesión.'
          : 'Desactivado: oculta los porcentajes en la sesión; el color sigue indicando el resultado.';
      }
      return normalized;
    };

    const setSpeakPronunciationAvatarMode = (mode) => {
      const normalized = normalizeSpeakPronunciationAvatarMode(mode);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.speakPronunciationAvatarMode = normalized;
      try {
        localStorage.setItem(SPEAK_PRONUNCIATION_AVATAR_MODE_KEY, normalized);
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:speak-pronunciation-avatar-mode-change', {
          detail: { mode: normalized }
        })
      );
      return normalized;
    };

    const updateSpeakPronunciationAvatarUi = (mode) => {
      const normalized = normalizeSpeakPronunciationAvatarMode(mode);
      if (speakPronunciationAvatarModeEl) {
        speakPronunciationAvatarModeEl.value = normalized;
      }
      if (speakPronunciationAvatarSubEl) {
        speakPronunciationAvatarSubEl.textContent =
          normalized === SPEAK_PRONUNCIATION_AVATAR_NEW
            ? 'Nuevo: usa la chica con overlays de boca por visema.'
            : 'Antiguo: usa el avatar actual con las bocas simples.';
      }
      return normalized;
    };

    const getEnabledTabsCount = () =>
      TAB_VISIBILITY_ORDER.reduce((count, tab) => count + (getStoredTabVisibility(tab) ? 1 : 0), 0);

    const setTabVisibility = (tab, enabled) => {
      if (!TAB_VISIBILITY_KEYS[tab]) return false;
      const normalized = normalizeTabVisibilityEnabled(tab, enabled);
      const currentValue = getStoredTabVisibility(tab);
      if (!normalized && currentValue && getEnabledTabsCount() <= 1) {
        return currentValue;
      }
      window.r34lp0w3r = window.r34lp0w3r || {};
      const nextMap =
        window.r34lp0w3r.tabVisibility && typeof window.r34lp0w3r.tabVisibility === 'object'
          ? { ...window.r34lp0w3r.tabVisibility }
          : {};
      nextMap[tab] = normalized;
      window.r34lp0w3r.tabVisibility = nextMap;
      if (tab === 'reference') {
        window.r34lp0w3r.referenceTabEnabled = normalized;
      }
      try {
        localStorage.setItem(TAB_VISIBILITY_KEYS[tab], normalized ? '1' : '0');
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:tab-visibility-change', {
          detail: { tab, enabled: normalized }
        })
      );
      if (tab === 'reference') {
        window.dispatchEvent(
          new CustomEvent('app:reference-tab-enabled-change', {
            detail: { enabled: normalized }
          })
        );
      }
      return normalized;
    };

    const updateTabVisibilityUi = (tab, enabled) => {
      if (!TAB_VISIBILITY_META[tab]) return false;
      const normalized = normalizeTabVisibilityEnabled(tab, enabled);
      const toggleEl = tabVisibilityToggleEls[tab];
      const subEl = tabVisibilitySubEls[tab];
      if (toggleEl) {
        toggleEl.checked = normalized;
      }
      if (subEl) {
        subEl.textContent = normalized
          ? TAB_VISIBILITY_META[tab].enabledSub
          : TAB_VISIBILITY_META[tab].disabledSub;
      }
      return normalized;
    };

    const setChatCatbotEnabled = (enabled) => {
      const normalized = normalizeChatCatbotEnabled(enabled);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.chatCatbotEnabled = normalized;
      try {
        localStorage.setItem(CHAT_CATBOT_ENABLED_KEY, normalized ? '1' : '0');
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:chat-catbot-enabled-change', {
          detail: { enabled: normalized }
        })
      );
      return normalized;
    };

    const updateChatCommunityUi = (enabled) => {
      const normalized = normalizeChatCatbotEnabled(enabled);
      if (chatCommunityToggleEl) {
        chatCommunityToggleEl.checked = normalized;
      }
      if (chatCommunitySubEl) {
        chatCommunitySubEl.textContent = normalized
          ? 'Activado: muestra Catbot en el selector superior del tab Chat.'
          : 'Desactivado: oculta Catbot del selector superior del tab Chat.';
      }
      return normalized;
    };

    const setChatChatbotEnabled = (enabled) => {
      const normalized = normalizeChatChatbotEnabled(enabled);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.chatChatbotEnabled = normalized;
      try {
        localStorage.setItem(CHAT_CHATBOT_ENABLED_KEY, normalized ? '1' : '0');
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:chat-chatbot-enabled-change', {
          detail: { enabled: normalized }
        })
      );
      return normalized;
    };

    const updateChatChatbotUi = (enabled) => {
      const normalized = normalizeChatChatbotEnabled(enabled);
      if (chatChatbotToggleEl) {
        chatChatbotToggleEl.checked = normalized;
      }
      if (chatChatbotSubEl) {
        chatChatbotSubEl.textContent = normalized
          ? 'Activado: muestra Coach en el selector superior del tab Chat.'
          : 'Desactivado: oculta Coach del selector superior del tab Chat.';
      }
      return normalized;
    };

    const getTalkStorageKey = () => {
      const user = window.user;
      const userId = user && user.id !== undefined && user.id !== null ? String(user.id) : 'anon';
      return `${TALK_STORAGE_PREFIX}${userId}`;
    };

    const setSfxStatus = (text) => {
      if (!sfxStatusEl) return;
      sfxStatusEl.textContent = text || '';
    };

    const setLanguageStatus = (text) => {
      if (!languageStatusEl) return;
      languageStatusEl.textContent = text || '';
    };

    const setLanguageOutput = (value) => {
      if (!languageOutputEl) return;
      languageOutputEl.textContent = value || '';
    };

    const setModerationStatus = (text) => {
      if (!moderationStatusEl) return;
      moderationStatusEl.textContent = text || '';
    };

    const setModerationOutput = (value) => {
      if (!moderationOutputEl) return;
      moderationOutputEl.textContent = value || '';
    };

    const setModerationSummary = (html, hidden = false) => {
      if (!moderationSummaryEl) return;
      moderationSummaryEl.hidden = Boolean(hidden);
      moderationSummaryEl.innerHTML = hidden ? '' : html || '';
    };

    const formatLanguageConfidence = (value) => {
      const confidence = Number(value);
      if (!Number.isFinite(confidence) || confidence <= 0) return '0%';
      const normalized = Math.max(0, Math.min(1, confidence));
      return `${Math.round(normalized * 100)}%`;
    };

    const formatLanguageDetectionResult = (result) => {
      const formattedResult = {
        ...(result || {}),
        confidence: formatLanguageConfidence(result && result.confidence),
        alternatives: Array.isArray(result && result.alternatives)
          ? result.alternatives.map((item) => ({
              ...(item || {}),
              confidence: formatLanguageConfidence(item && item.confidence)
            }))
          : []
      };
      try {
        return JSON.stringify(formattedResult, null, 2);
      } catch (err) {
        return String(formattedResult || '');
      }
    };

    const formatDurationMs = (value) => {
      const ms = Number(value);
      if (!Number.isFinite(ms) || ms < 0) return 'n/a';
      return `${Math.round(ms)} ms`;
    };

    const formatModerationResult = (result) => {
      const moderation = result && typeof result.moderation === 'object' ? result.moderation : {};
      const formatted = {
        ...(result || {}),
        timings: {
          ...(result && result.timings ? result.timings : {}),
          total_ms: formatDurationMs(result && result.timings ? result.timings.total_ms : NaN),
          openai_ms: formatDurationMs(result && result.timings ? result.timings.openai_ms : NaN),
          client_ms: formatDurationMs(result && result.timings ? result.timings.client_ms : NaN)
        },
        moderation: {
          ...moderation,
          category_scores:
            moderation && moderation.category_scores && typeof moderation.category_scores === 'object'
              ? Object.fromEntries(
                  Object.entries(moderation.category_scores).map(([key, value]) => [
                    key,
                    formatLanguageConfidence(value)
                  ])
                )
              : {}
        }
      };
      try {
        return JSON.stringify(formatted, null, 2);
      } catch (err) {
        return String(formatted || '');
      }
    };

    const moderationCategoryLabels = {
      sexual: 'Sexual',
      'sexual/minors': 'Sexual menores',
      harassment: 'Acoso',
      'harassment/threatening': 'Acoso amenazante',
      hate: 'Odio',
      'hate/threatening': 'Odio amenazante',
      illicit: 'Ilícito',
      'illicit/violent': 'Ilícito violento',
      'self-harm': 'Autolesión',
      'self-harm/intent': 'Autolesión intención',
      'self-harm/instructions': 'Autolesión instrucciones',
      violence: 'Violencia',
      'violence/graphic': 'Violencia gráfica'
    };

    const escapeInlineHtml = (value) =>
      String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const buildModerationSummary = (result) => {
      const moderation = result && typeof result.moderation === 'object' ? result.moderation : {};
      const scores =
        moderation && moderation.category_scores && typeof moderation.category_scores === 'object'
          ? moderation.category_scores
          : {};
      const sortedScores = Object.entries(scores)
        .map(([key, value]) => ({
          key,
          label: moderationCategoryLabels[key] || key,
          score: Number(value) || 0
        }))
        .sort((a, b) => b.score - a.score);
      const topCategories = sortedScores.slice(0, 3);
      const maxScore = topCategories.length ? topCategories[0].score : 0;
      const flagged = Boolean(moderation && moderation.flagged);
      const tone = flagged ? 'bad' : maxScore >= 0.1 ? 'warn' : 'ok';
      const title = flagged ? 'Bloqueado' : maxScore >= 0.1 ? 'Revisar' : 'Limpio';
      const subtitle = flagged
        ? 'OpenAI ha marcado este contenido como potencialmente problemático.'
        : maxScore >= 0.1
          ? 'No está marcado, pero conviene revisarlo.'
          : 'No se detectan señales relevantes.';
      const badges = [
        `<span class="diag-moderation-chip free-ride-detail-badge is-${tone}">${escapeInlineHtml(title)}</span>`,
        `<span class="diag-moderation-chip">Cliente ${escapeInlineHtml(formatDurationMs(result && result.timings ? result.timings.client_ms : NaN))}</span>`,
        `<span class="diag-moderation-chip">OpenAI ${escapeInlineHtml(formatDurationMs(result && result.timings ? result.timings.openai_ms : NaN))}</span>`
      ];
      const topMarkup = topCategories.length
        ? topCategories
            .map(
              (item) => `
                <div class="diag-moderation-top-item">
                  <span class="diag-moderation-top-label">${escapeInlineHtml(item.label)}</span>
                  <span class="diag-moderation-top-score">${escapeInlineHtml(formatLanguageConfidence(item.score))}</span>
                </div>`
            )
            .join('')
        : `<div class="diag-moderation-top-empty">Sin categorías relevantes.</div>`;

      return `
        <div class="diag-moderation-summary diag-moderation-summary-${tone}">
          <div class="diag-moderation-header">
            <div>
              <div class="diag-moderation-title">${escapeInlineHtml(title)}</div>
              <div class="diag-moderation-subtitle">${escapeInlineHtml(subtitle)}</div>
            </div>
            <div class="diag-moderation-badges">${badges.join('')}</div>
          </div>
          <div class="diag-moderation-top">
            ${topMarkup}
          </div>
        </div>`;
    };

    const playSfx = async (key, label) => {
      if (typeof window.playSpeakUiSound !== 'function') {
        setSfxStatus('playSpeakUiSound no disponible en este entorno.');
        return;
      }
      setSfxStatus(`Reproduciendo ${label}...`);
      try {
        const ok = await window.playSpeakUiSound(key, {
          forceRestart: true,
          minGapMs: 0
        });
        setSfxStatus(ok ? `OK: ${label}` : `No se pudo reproducir: ${label}`);
      } catch (err) {
        setSfxStatus(`Error ${label}: ${err && err.message ? err.message : String(err)}`);
      }
    };

    const formatJson = (value) => {
      try {
        return JSON.stringify(value || {}, null, 2);
      } catch (err) {
        return '{}';
      }
    };

    const updateContentSourcePanel = () => {
      if (!contentSourceEl) return;
      const info = getTrainingDataLoadInfo && typeof getTrainingDataLoadInfo === 'function'
        ? getTrainingDataLoadInfo()
        : {};
      const routes = Array.isArray(getRoutes()) ? getRoutes() : [];
      let modulesCount = 0;
      let sessionsCount = 0;
      routes.forEach((route) => {
        const modules = route && Array.isArray(route.modules) ? route.modules : [];
        modulesCount += modules.length;
        modules.forEach((module) => {
          const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
          sessionsCount += sessions.length;
        });
      });

      const payload = {
        status: info.status || 'n/a',
        source: info.source || 'n/a',
        transport: info.transport || 'n/a',
        request_url: info.requestUrl || 'n/a',
        loaded_at: info.loadedAt || null,
        release: info.release || null,
        counts: {
          routes: routes.length,
          modules: modulesCount,
          sessions: sessionsCount
        },
        tried_urls: Array.isArray(info.triedUrls) ? info.triedUrls : [],
        errors: Array.isArray(info.errors) ? info.errors : []
      };
      contentSourceEl.textContent = formatJson(payload);
    };

    const updateSpeakPanels = () => {
      const words = window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {};
      const phrase = window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {};
      const rewards = window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards ? window.r34lp0w3r.speakSessionRewards : {};
      const badges = window.r34lp0w3r && window.r34lp0w3r.speakBadges ? window.r34lp0w3r.speakBadges : {};
      if (wordsEl) wordsEl.textContent = formatJson(words);
      if (phraseEl) phraseEl.textContent = formatJson(phrase);
      if (rewardsEl) rewardsEl.textContent = formatJson(rewards);
      if (badgesEl) badgesEl.textContent = formatJson(badges);
    };

    const getBadgeStore = () => {
      window.r34lp0w3r = window.r34lp0w3r || {};
      if (!window.r34lp0w3r.speakBadges || typeof window.r34lp0w3r.speakBadges !== 'object') {
        window.r34lp0w3r.speakBadges = {};
      }
      return window.r34lp0w3r.speakBadges;
    };

    const buildBadgeCatalog = () => {
      const routes = Array.isArray(getRoutes()) ? getRoutes() : [];
      const localeRaw = String(getAppLocale() || '').trim().toLowerCase();
      const locale = localeRaw.startsWith('es') ? 'es' : 'en';
      const trainingBadges = !routes.length
        ? Array.from({ length: 5 }, (_, idx) => ({
          id: `route:badge-${idx + 1}`,
          routeId: `badge-${idx + 1}`,
          routeTitle: `Ruta ${idx + 1}`,
          badgeIndex: idx + 1,
          image: `assets/badges/badge${idx + 1}.png`,
          title: `Badge ${idx + 1}`
        }))
        : routes.slice(0, 5).map((route, idx) => ({
        id: `route:${route.id}`,
        routeId: route.id,
        routeTitle: getLocalizedContentField(route, 'title', locale) || '',
        badgeIndex: idx + 1,
        image: `assets/badges/badge${idx + 1}.png`,
        title: `Badge ${idx + 1}`
        }));

      const referenceTitles =
        locale === 'es'
          ? {
              '4': 'Nivel básico',
              '5': 'Nivel intermedio',
              '6': 'Nivel avanzado',
              '10': 'Inglés de negocios',
              '10000': 'Vocabulario para viajar'
            }
          : {
              '4': 'Basic level',
              '5': 'Intermediate level',
              '6': 'Advanced level',
              '10': 'Business English',
              '10000': 'Travel Vocabulary'
            };
      const referenceBadgeMeta = {
        '4': { badgeIndex: 6, image: 'assets/badges/badge-basic.png', routeId: 'reference-course-basic' },
        '5': {
          badgeIndex: 7,
          image: 'assets/badges/badge-intermediate.png',
          routeId: 'reference-course-intermediate'
        },
        '6': { badgeIndex: 8, image: 'assets/badges/badge-advanced.png', routeId: 'reference-course-advanced' },
        '10': { badgeIndex: 9, image: 'assets/badges/badge-business.png', routeId: 'reference-course-business' },
        '10000': {
          badgeIndex: 10,
          image: 'assets/badges/badge-travel.png',
          routeId: 'reference-course-travel'
        }
      };
      const referenceCourses = Array.isArray(getReferenceCourses()) ? getReferenceCourses() : [];
      const referenceBadges = Object.entries(referenceBadgeMeta).map(([courseCode, meta]) => {
        const course = referenceCourses.find((item) => String(item && item.code ? item.code : '') === courseCode);
        const routeTitle =
          (course && getLocalizedMapField(course, 'display', locale)) || referenceTitles[courseCode] || '';
        return {
          id: `reference-course:${courseCode}`,
          routeId: meta.routeId,
          routeTitle,
          badgeIndex: meta.badgeIndex,
          image: meta.image,
          title: routeTitle || `Badge ${meta.badgeIndex}`
        };
      });

      return [...trainingBadges, ...referenceBadges];
    };

    let badgeCatalog = buildBadgeCatalog();

    const notifyBadgeUnlocked = (badgeId, badgeEntry) => {
      if (!badgeId || !badgeEntry) return;
      try {
        addNotification({
          type: 'reward',
          tone: 'good',
          icon: 'ribbon-outline',
          image: badgeEntry.image || '',
          title: 'Nuevo badge desbloqueado',
          text: badgeEntry.routeTitle || 'Ruta completada',
          action: {
            label: 'Ver badge',
            tab: 'tu',
            profileTab: 'prefs',
            callback: 'openSpeakBadgeFromNotification',
            badgeId,
            complete: true
          }
        });
      } catch (err) {
        // no-op
      }
    };

    const renderBadgePicker = () => {
      if (!badgesPickerEl) return;
      const badges = getBadgeStore();
      if (badgesSubEl) {
        badgesSubEl.textContent = 'Pulsa para activar/desactivar badges del usuario en esta sesión.';
      }
      badgesPickerEl.innerHTML = badgeCatalog
        .map((badge) => {
          const active = Boolean(badges[badge.id]);
          return `
            <button
              class="diag-badge-btn ${active ? 'is-active' : ''}"
              type="button"
              data-badge-id="${escapeHtml(badge.id)}"
            >
              <img src="${escapeHtml(badge.image)}" alt="${escapeHtml(badge.title)}">
              <span>${escapeHtml(badge.title)}</span>
            </button>
          `;
        })
        .join('');
    };

    const readTalkTimelines = () => {
      try {
        const raw = localStorage.getItem(getTalkStorageKey());
        if (!raw) return { catbot: [], chatbot: [] };
        const parsed = JSON.parse(raw);
        return {
          catbot: Array.isArray(parsed.catbot) ? parsed.catbot : [],
          chatbot: Array.isArray(parsed.chatbot) ? parsed.chatbot : []
        };
      } catch (err) {
        return { catbot: [], chatbot: [] };
      }
    };

    const updateTalkPanels = () => {
      const data = readTalkTimelines();
      if (talkCatEl) talkCatEl.textContent = formatJson(data.catbot);
      if (talkBotEl) talkBotEl.textContent = formatJson(data.chatbot);
    };

    const getUsageUserId = () => {
      const user = window.user;
      if (!user || user.id === undefined || user.id === null) return '';
      const value = String(user.id).trim();
      return value || '';
    };

    const toUsageNumber = (value, fallback = 0) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      if (parsed < 0) return fallback;
      return parsed;
    };

    const usageIntFmt = new Intl.NumberFormat('es-ES');
    const usageMoneyFmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });

    const formatUsageDate = (value) => {
      if (!value) return '';
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleDateString('es-ES');
    };

    const resolveUsageEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.chatbotUsageDailyEndpoint || cfg.chatbotUsageEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const emitEndpoint = cfg.emitEndpoint;
      if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
        const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
        if (trimmed.endsWith('/emit')) {
          return `${trimmed.slice(0, -5)}/chatbot/usage/daily`;
        }
      }
      return '';
    };

    const resolveUsageLimitEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.chatbotUsageLimitEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const dailyEndpoint = resolveUsageEndpoint();
      if (dailyEndpoint) {
        return dailyEndpoint.replace(/\/daily$/, '/limit');
      }
      return '';
    };

    const resolveOpenAIModerationEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.openaiModerationEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const emitEndpoint = cfg.emitEndpoint;
      if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
        const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
        if (trimmed.endsWith('/emit')) {
          return `${trimmed.slice(0, -5)}/openai/moderation`;
        }
      }
      return '';
    };

    const buildUsageHeaders = () => {
      const headers = {};
      const cfg = window.realtimeConfig || {};
      const monitor = cfg.monitorToken || '';
      const state = cfg.authToken || '';
      if (monitor) headers['x-monitor-token'] = monitor;
      if (state) headers['x-rt-token'] = state;
      return headers;
    };

    const updateUsageLimitStatus = (text) => {
      if (!usageLimitStatusEl) return;
      usageLimitStatusEl.textContent = text || '';
    };

    const renderUsageLimit = (status) => {
      if (!usageLimitInputEl) return;
      const limit = Math.max(0, Math.round(toUsageNumber(status && status.token_limit_day, 0)));
      usageLimitInputEl.value = limit > 0 ? String(limit) : '';
      const used = Math.max(0, Math.round(toUsageNumber(status && status.used_tokens_day, 0)));
      if (!limit) {
        updateUsageLimitStatus(`Sin limite diario. Usados hoy: ${usageIntFmt.format(used)} tokens.`);
        return;
      }
      const reached = Boolean(status && status.limit_reached_today);
      const remaining = Math.max(0, Math.round(toUsageNumber(status && status.remaining_tokens_day, limit - used)));
      updateUsageLimitStatus(
        reached
          ? `Limite activo: ${usageIntFmt.format(limit)} tk/dia. Alcanzado hoy (${usageIntFmt.format(used)}).`
          : `Limite activo: ${usageIntFmt.format(limit)} tk/dia. Restantes hoy: ${usageIntFmt.format(remaining)}.`
      );
    };

    const fetchUsageLimitStatus = async (userId) => {
      const endpoint = resolveUsageLimitEndpoint();
      if (!endpoint) {
        updateUsageLimitStatus('Endpoint de limite no configurado.');
        return null;
      }
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('user_id', userId);
      const response = await fetch(url.toString(), {
        headers: buildUsageHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const saveUsageLimit = async (userId, limitTokens) => {
      const endpoint = resolveUsageLimitEndpoint();
      if (!endpoint) {
        updateUsageLimitStatus('Endpoint de limite no configurado.');
        return null;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildUsageHeaders()
        },
        body: JSON.stringify({
          user_id: userId,
          token_limit_day: limitTokens
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const renderUsageRows = (rows) => {
      if (!usageListEl) return;
      usageListEl.innerHTML = '';
      if (!Array.isArray(rows) || !rows.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'diag-usage-empty';
        emptyEl.textContent = 'Sin consumo registrado.';
        usageListEl.appendChild(emptyEl);
        return;
      }
      rows.forEach((row) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'diag-usage-row';

        const dayEl = document.createElement('div');
        dayEl.className = 'diag-usage-day';
        dayEl.textContent = formatUsageDate(row.day) || '-';

        const metaEl = document.createElement('div');
        metaEl.className = 'diag-usage-meta';
        const req = usageIntFmt.format(Math.round(toUsageNumber(row.requests, 0)));
        const tokens = usageIntFmt.format(Math.round(toUsageNumber(row.total_tokens, 0)));
        const cost = usageMoneyFmt.format(toUsageNumber(row.estimated_cost_usd, 0));
        metaEl.textContent = `${req} req · ${tokens} tk · ${cost}`;

        itemEl.appendChild(dayEl);
        itemEl.appendChild(metaEl);
        usageListEl.appendChild(itemEl);
      });
    };

    const renderUsageTotals = (totals, days) => {
      if (!usageTotalsEl) return;
      const requests = usageIntFmt.format(Math.round(toUsageNumber(totals.requests, 0)));
      const tokens = usageIntFmt.format(Math.round(toUsageNumber(totals.total_tokens, 0)));
      const cost = usageMoneyFmt.format(toUsageNumber(totals.estimated_cost_usd, 0));
      const dayLabel = `${days} día${days === 1 ? '' : 's'}`;
      usageTotalsEl.hidden = false;
      usageTotalsEl.textContent = `Total (${dayLabel}): ${requests} req · ${tokens} tk · ${cost}`;
    };

    const updateUsageStatus = (text) => {
      if (!usageStatusEl) return;
      usageStatusEl.textContent = text;
    };

    const refreshUserUsage = async () => {
      if (!usageStatusEl || !usageTotalsEl || !usageListEl) return;
      const userId = getUsageUserId();
      if (!userId) {
        usageTotalsEl.hidden = true;
        usageListEl.innerHTML = '';
        updateUsageStatus('Inicia sesión para ver consumo por usuario.');
        if (usageLimitInputEl) usageLimitInputEl.value = '';
        updateUsageLimitStatus('Inicia sesión para configurar limite diario.');
        if (usageLimitSaveBtn) usageLimitSaveBtn.disabled = true;
        if (usageLimitClearBtn) usageLimitClearBtn.disabled = true;
        return;
      }
      if (usageLimitSaveBtn) usageLimitSaveBtn.disabled = false;
      if (usageLimitClearBtn) usageLimitClearBtn.disabled = false;

      const endpoint = resolveUsageEndpoint();
      if (!endpoint) {
        usageTotalsEl.hidden = true;
        usageListEl.innerHTML = '';
        updateUsageStatus('Endpoint de usage no configurado.');
        updateUsageLimitStatus('Endpoint de usage no configurado.');
        return;
      }

      let url;
      try {
        url = new URL(endpoint, window.location.origin);
      } catch (err) {
        usageTotalsEl.hidden = true;
        usageListEl.innerHTML = '';
        updateUsageStatus('Endpoint de usage inválido.');
        return;
      }
      url.searchParams.set('user_id', userId);
      url.searchParams.set('limit', '30');

      const requestId = usageRequestSeq + 1;
      usageRequestSeq = requestId;
      updateUsageStatus('Cargando consumo...');
      updateUsageLimitStatus('Cargando limite...');

      try {
        const [response, limitPayload] = await Promise.all([
          fetch(url.toString(), {
            headers: buildUsageHeaders()
          }),
          fetchUsageLimitStatus(userId).catch((err) => ({ _error: err }))
        ]);
        if (requestId !== usageRequestSeq) return;
        if (limitPayload && !limitPayload._error) {
          renderUsageLimit(limitPayload);
        } else if (limitPayload && limitPayload._error) {
          updateUsageLimitStatus(
            `No se pudo leer limite: ${limitPayload._error.message || String(limitPayload._error)}`
          );
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (requestId !== usageRequestSeq) return;
        if (!payload || payload.enabled === false) {
          usageTotalsEl.hidden = true;
          usageListEl.innerHTML = '';
          updateUsageStatus('Tracking de usage desactivado en servidor.');
          return;
        }
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        const totals = payload && typeof payload.totals === 'object' ? payload.totals : {};
        renderUsageTotals(totals, rows.length);
        renderUsageRows(rows);
        if (payload && payload.limit_status && typeof payload.limit_status === 'object') {
          renderUsageLimit(payload.limit_status);
        }
        if (rows.length) {
          const now = new Date().toLocaleTimeString('es-ES');
          updateUsageStatus(`Actualizado: ${now}`);
        } else {
          updateUsageStatus('Sin consumo registrado para este usuario.');
        }
      } catch (err) {
        if (requestId !== usageRequestSeq) return;
        usageTotalsEl.hidden = true;
        usageListEl.innerHTML = '';
        updateUsageStatus(`Error cargando usage: ${err.message || String(err)}`);
      }
    };

    const getUsageLimitInputValue = () => {
      if (!usageLimitInputEl) return NaN;
      const raw = String(usageLimitInputEl.value || '').trim();
      if (!raw) return 0;
      return Number(raw);
    };

    const submitUsageLimit = async (limitTokens) => {
      const userId = getUsageUserId();
      if (!userId) {
        updateUsageLimitStatus('Inicia sesión para configurar limite.');
        return;
      }
      const normalized = Number.isFinite(limitTokens) ? Math.max(0, Math.floor(limitTokens)) : NaN;
      if (!Number.isFinite(normalized)) {
        updateUsageLimitStatus('Introduce un numero valido.');
        return;
      }
      if (usageLimitSaveBtn) usageLimitSaveBtn.disabled = true;
      if (usageLimitClearBtn) usageLimitClearBtn.disabled = true;
      updateUsageLimitStatus('Guardando limite...');
      try {
        const payload = await saveUsageLimit(userId, normalized);
        if (payload && typeof payload === 'object') {
          renderUsageLimit(payload);
        }
        await refreshUserUsage();
      } catch (err) {
        updateUsageLimitStatus(`Error guardando limite: ${err.message || String(err)}`);
      } finally {
        if (usageLimitSaveBtn) usageLimitSaveBtn.disabled = false;
        if (usageLimitClearBtn) usageLimitClearBtn.disabled = false;
      }
    };

    const resolveTtsUsageEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.ttsUsageDailyEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const ttsAligned = cfg.ttsAlignedEndpoint || window.REALTIME_TTS_ALIGNED_ENDPOINT;
      if (typeof ttsAligned === 'string' && ttsAligned.trim()) {
        const trimmed = ttsAligned.trim().replace(/\/+$/, '');
        if (trimmed.endsWith('/tts/aligned')) {
          return `${trimmed.slice(0, -12)}/tts/usage/daily`;
        }
      }
      const emitEndpoint = cfg.emitEndpoint;
      if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
        const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
        if (trimmed.endsWith('/emit')) {
          return `${trimmed.slice(0, -5)}/tts/usage/daily`;
        }
      }
      return '';
    };

    const resolveTtsUsageLimitEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.ttsUsageLimitEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const dailyEndpoint = resolveTtsUsageEndpoint();
      if (dailyEndpoint) {
        return dailyEndpoint.replace(/\/daily$/, '/limit');
      }
      return '';
    };

    const updateTtsUsageLimitStatus = (text) => {
      if (!ttsUsageLimitStatusEl) return;
      ttsUsageLimitStatusEl.textContent = text || '';
    };

    const renderTtsUsageLimit = (status) => {
      if (!ttsUsageLimitInputEl) return;
      const limit = Math.max(0, Math.round(toUsageNumber(status && status.char_limit_day, 0)));
      ttsUsageLimitInputEl.value = limit > 0 ? String(limit) : '';
      const used = Math.max(0, Math.round(toUsageNumber(status && status.used_chars_day, 0)));
      if (!limit) {
        updateTtsUsageLimitStatus(`Sin limite diario. Usados hoy: ${usageIntFmt.format(used)} chars.`);
        return;
      }
      const reached = Boolean(status && status.limit_reached_today);
      const remaining = Math.max(0, Math.round(toUsageNumber(status && status.remaining_chars_day, limit - used)));
      updateTtsUsageLimitStatus(
        reached
          ? `Limite activo: ${usageIntFmt.format(limit)} chars/dia. Alcanzado hoy (${usageIntFmt.format(used)}).`
          : `Limite activo: ${usageIntFmt.format(limit)} chars/dia. Restantes hoy: ${usageIntFmt.format(remaining)}.`
      );
    };

    const fetchTtsUsageLimitStatus = async (userId) => {
      const endpoint = resolveTtsUsageLimitEndpoint();
      if (!endpoint) {
        updateTtsUsageLimitStatus('Endpoint de limite TTS no configurado.');
        return null;
      }
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('user_id', userId);
      const response = await fetch(url.toString(), {
        headers: buildUsageHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const saveTtsUsageLimit = async (userId, limitChars) => {
      const endpoint = resolveTtsUsageLimitEndpoint();
      if (!endpoint) {
        updateTtsUsageLimitStatus('Endpoint de limite TTS no configurado.');
        return null;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildUsageHeaders()
        },
        body: JSON.stringify({
          user_id: userId,
          char_limit_day: limitChars
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const renderTtsUsageRows = (rows) => {
      if (!ttsUsageListEl) return;
      ttsUsageListEl.innerHTML = '';
      if (!Array.isArray(rows) || !rows.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'diag-usage-empty';
        emptyEl.textContent = 'Sin consumo TTS registrado.';
        ttsUsageListEl.appendChild(emptyEl);
        return;
      }
      rows.forEach((row) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'diag-usage-row';

        const dayEl = document.createElement('div');
        dayEl.className = 'diag-usage-day';
        dayEl.textContent = formatUsageDate(row.day) || '-';

        const metaEl = document.createElement('div');
        metaEl.className = 'diag-usage-meta';
        const req = usageIntFmt.format(Math.round(toUsageNumber(row.requests, 0)));
        const chars = usageIntFmt.format(Math.round(toUsageNumber(row.billed_characters, 0)));
        const hit = usageIntFmt.format(Math.round(toUsageNumber(row.cache_hits, 0)));
        const miss = usageIntFmt.format(Math.round(toUsageNumber(row.cache_misses, 0)));
        const cost = usageMoneyFmt.format(toUsageNumber(row.estimated_cost_usd, 0));
        metaEl.textContent = `${req} req · ${chars} chars · H${hit}/M${miss} · ${cost}`;

        itemEl.appendChild(dayEl);
        itemEl.appendChild(metaEl);
        ttsUsageListEl.appendChild(itemEl);
      });
    };

    const renderTtsUsageTotals = (totals, days) => {
      if (!ttsUsageTotalsEl) return;
      const requests = usageIntFmt.format(Math.round(toUsageNumber(totals.requests, 0)));
      const chars = usageIntFmt.format(Math.round(toUsageNumber(totals.billed_characters, 0)));
      const hits = usageIntFmt.format(Math.round(toUsageNumber(totals.cache_hits, 0)));
      const misses = usageIntFmt.format(Math.round(toUsageNumber(totals.cache_misses, 0)));
      const cost = usageMoneyFmt.format(toUsageNumber(totals.estimated_cost_usd, 0));
      const dayLabel = `${days} día${days === 1 ? '' : 's'}`;
      ttsUsageTotalsEl.hidden = false;
      ttsUsageTotalsEl.textContent = `Total (${dayLabel}): ${requests} req · ${chars} chars · H${hits}/M${misses} · ${cost}`;
    };

    const updateTtsUsageStatus = (text) => {
      if (!ttsUsageStatusEl) return;
      ttsUsageStatusEl.textContent = text;
    };

    const refreshTtsUserUsage = async () => {
      if (!ttsUsageStatusEl || !ttsUsageTotalsEl || !ttsUsageListEl) return;
      const userId = getUsageUserId();
      if (!userId) {
        ttsUsageTotalsEl.hidden = true;
        ttsUsageListEl.innerHTML = '';
        updateTtsUsageStatus('Inicia sesión para ver consumo TTS por usuario.');
        if (ttsUsageLimitInputEl) ttsUsageLimitInputEl.value = '';
        updateTtsUsageLimitStatus('Inicia sesión para configurar limite diario TTS.');
        if (ttsUsageLimitSaveBtn) ttsUsageLimitSaveBtn.disabled = true;
        if (ttsUsageLimitClearBtn) ttsUsageLimitClearBtn.disabled = true;
        return;
      }
      if (ttsUsageLimitSaveBtn) ttsUsageLimitSaveBtn.disabled = false;
      if (ttsUsageLimitClearBtn) ttsUsageLimitClearBtn.disabled = false;

      const endpoint = resolveTtsUsageEndpoint();
      if (!endpoint) {
        ttsUsageTotalsEl.hidden = true;
        ttsUsageListEl.innerHTML = '';
        updateTtsUsageStatus('Endpoint de usage TTS no configurado.');
        updateTtsUsageLimitStatus('Endpoint de usage TTS no configurado.');
        return;
      }

      let url;
      try {
        url = new URL(endpoint, window.location.origin);
      } catch (err) {
        ttsUsageTotalsEl.hidden = true;
        ttsUsageListEl.innerHTML = '';
        updateTtsUsageStatus('Endpoint de usage TTS inválido.');
        return;
      }
      url.searchParams.set('user_id', userId);
      url.searchParams.set('limit', '30');

      const requestId = ttsUsageRequestSeq + 1;
      ttsUsageRequestSeq = requestId;
      updateTtsUsageStatus('Cargando consumo TTS...');
      updateTtsUsageLimitStatus('Cargando limite TTS...');

      try {
        const [response, limitPayload] = await Promise.all([
          fetch(url.toString(), {
            headers: buildUsageHeaders()
          }),
          fetchTtsUsageLimitStatus(userId).catch((err) => ({ _error: err }))
        ]);
        if (requestId !== ttsUsageRequestSeq) return;
        if (limitPayload && !limitPayload._error) {
          renderTtsUsageLimit(limitPayload);
        } else if (limitPayload && limitPayload._error) {
          updateTtsUsageLimitStatus(
            `No se pudo leer limite TTS: ${limitPayload._error.message || String(limitPayload._error)}`
          );
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (requestId !== ttsUsageRequestSeq) return;
        if (!payload || payload.enabled === false) {
          ttsUsageTotalsEl.hidden = true;
          ttsUsageListEl.innerHTML = '';
          updateTtsUsageStatus('Tracking TTS desactivado en servidor.');
          return;
        }
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        const totals = payload && typeof payload.totals === 'object' ? payload.totals : {};
        renderTtsUsageTotals(totals, rows.length);
        renderTtsUsageRows(rows);
        if (payload && payload.limit_status && typeof payload.limit_status === 'object') {
          renderTtsUsageLimit(payload.limit_status);
        }
        if (rows.length) {
          const now = new Date().toLocaleTimeString('es-ES');
          updateTtsUsageStatus(`Actualizado: ${now}`);
        } else {
          updateTtsUsageStatus('Sin consumo TTS registrado para este usuario.');
        }
      } catch (err) {
        if (requestId !== ttsUsageRequestSeq) return;
        ttsUsageTotalsEl.hidden = true;
        ttsUsageListEl.innerHTML = '';
        updateTtsUsageStatus(`Error cargando usage TTS: ${err.message || String(err)}`);
      }
    };

    const getTtsUsageLimitInputValue = () => {
      if (!ttsUsageLimitInputEl) return NaN;
      const raw = String(ttsUsageLimitInputEl.value || '').trim();
      if (!raw) return 0;
      return Number(raw);
    };

    const submitTtsUsageLimit = async (limitChars) => {
      const userId = getUsageUserId();
      if (!userId) {
        updateTtsUsageLimitStatus('Inicia sesión para configurar limite TTS.');
        return;
      }
      const normalized = Number.isFinite(limitChars) ? Math.max(0, Math.floor(limitChars)) : NaN;
      if (!Number.isFinite(normalized)) {
        updateTtsUsageLimitStatus('Introduce un numero valido.');
        return;
      }
      if (ttsUsageLimitSaveBtn) ttsUsageLimitSaveBtn.disabled = true;
      if (ttsUsageLimitClearBtn) ttsUsageLimitClearBtn.disabled = true;
      updateTtsUsageLimitStatus('Guardando limite TTS...');
      try {
        const payload = await saveTtsUsageLimit(userId, normalized);
        if (payload && typeof payload === 'object') {
          renderTtsUsageLimit(payload);
        }
        await refreshTtsUserUsage();
      } catch (err) {
        updateTtsUsageLimitStatus(`Error guardando limite TTS: ${err.message || String(err)}`);
      } finally {
        if (ttsUsageLimitSaveBtn) ttsUsageLimitSaveBtn.disabled = false;
        if (ttsUsageLimitClearBtn) ttsUsageLimitClearBtn.disabled = false;
      }
    };

    const resolvePronUsageEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.pronunciationUsageDailyEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const emitEndpoint = cfg.emitEndpoint;
      if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
        const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
        if (trimmed.endsWith('/emit')) {
          return `${trimmed.slice(0, -5)}/pronunciation/usage/daily`;
        }
      }
      return '';
    };

    const resolvePronUsageLimitEndpoint = () => {
      const cfg = window.realtimeConfig || {};
      const direct = cfg.pronunciationUsageLimitEndpoint;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const dailyEndpoint = resolvePronUsageEndpoint();
      if (dailyEndpoint) {
        return dailyEndpoint.replace(/\/daily$/, '/limit');
      }
      return '';
    };

    const updatePronUsageLimitStatus = (text) => {
      if (!pronUsageLimitStatusEl) return;
      pronUsageLimitStatusEl.textContent = text || '';
    };

    const renderPronUsageLimit = (status) => {
      if (!pronUsageLimitInputEl) return;
      const limit = Math.max(0, Math.round(toUsageNumber(status && status.seconds_limit_day, 0)));
      pronUsageLimitInputEl.value = limit > 0 ? String(limit) : '';
      const used = Math.max(0, Number(toUsageNumber(status && status.used_seconds_day, 0).toFixed(3)));
      if (!limit) {
        updatePronUsageLimitStatus(`Sin limite diario. Usados hoy: ${used.toFixed(1)} s.`);
        return;
      }
      const reached = Boolean(status && status.limit_reached_today);
      const remaining = Math.max(
        0,
        Number(toUsageNumber(status && status.remaining_seconds_day, limit - used).toFixed(3))
      );
      updatePronUsageLimitStatus(
        reached
          ? `Limite activo: ${usageIntFmt.format(limit)} s/dia. Alcanzado hoy (${used.toFixed(1)} s).`
          : `Limite activo: ${usageIntFmt.format(limit)} s/dia. Restantes hoy: ${remaining.toFixed(1)} s.`
      );
    };

    const fetchPronUsageLimitStatus = async (userId) => {
      const endpoint = resolvePronUsageLimitEndpoint();
      if (!endpoint) {
        updatePronUsageLimitStatus('Endpoint de limite Pron no configurado.');
        return null;
      }
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('user_id', userId);
      const response = await fetch(url.toString(), {
        headers: buildUsageHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const savePronUsageLimit = async (userId, limitSeconds) => {
      const endpoint = resolvePronUsageLimitEndpoint();
      if (!endpoint) {
        updatePronUsageLimitStatus('Endpoint de limite Pron no configurado.');
        return null;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildUsageHeaders()
        },
        body: JSON.stringify({
          user_id: userId,
          seconds_limit_day: limitSeconds
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const renderPronUsageRows = (rows) => {
      if (!pronUsageListEl) return;
      pronUsageListEl.innerHTML = '';
      if (!Array.isArray(rows) || !rows.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'diag-usage-empty';
        emptyEl.textContent = 'Sin consumo de evaluación avanzada registrado.';
        pronUsageListEl.appendChild(emptyEl);
        return;
      }
      rows.forEach((row) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'diag-usage-row';

        const dayEl = document.createElement('div');
        dayEl.className = 'diag-usage-day';
        dayEl.textContent = formatUsageDate(row.day) || '-';

        const metaEl = document.createElement('div');
        metaEl.className = 'diag-usage-meta';
        const req = usageIntFmt.format(Math.round(toUsageNumber(row.requests, 0)));
        const seconds = Number(toUsageNumber(row.audio_seconds, 0).toFixed(3));
        const cost = usageMoneyFmt.format(toUsageNumber(row.estimated_cost_usd, 0));
        metaEl.textContent = `${req} req · ${seconds.toFixed(1)} s · ${cost}`;

        itemEl.appendChild(dayEl);
        itemEl.appendChild(metaEl);
        pronUsageListEl.appendChild(itemEl);
      });
    };

    const renderPronUsageTotals = (totals, days) => {
      if (!pronUsageTotalsEl) return;
      const requests = usageIntFmt.format(Math.round(toUsageNumber(totals.requests, 0)));
      const seconds = Number(toUsageNumber(totals.audio_seconds, 0).toFixed(3));
      const cost = usageMoneyFmt.format(toUsageNumber(totals.estimated_cost_usd, 0));
      const dayLabel = `${days} día${days === 1 ? '' : 's'}`;
      pronUsageTotalsEl.hidden = false;
      pronUsageTotalsEl.textContent = `Total (${dayLabel}): ${requests} req · ${seconds.toFixed(1)} s · ${cost}`;
    };

    const updatePronUsageStatus = (text) => {
      if (!pronUsageStatusEl) return;
      pronUsageStatusEl.textContent = text;
    };

    const refreshPronUserUsage = async () => {
      if (!pronUsageStatusEl || !pronUsageTotalsEl || !pronUsageListEl) return;
      const userId = getUsageUserId();
      if (!userId) {
        pronUsageTotalsEl.hidden = true;
        pronUsageListEl.innerHTML = '';
        updatePronUsageStatus('Inicia sesión para ver consumo de evaluación avanzada por usuario.');
        if (pronUsageLimitInputEl) pronUsageLimitInputEl.value = '';
        updatePronUsageLimitStatus('Inicia sesión para configurar limite diario.');
        if (pronUsageLimitSaveBtn) pronUsageLimitSaveBtn.disabled = true;
        if (pronUsageLimitClearBtn) pronUsageLimitClearBtn.disabled = true;
        return;
      }
      if (pronUsageLimitSaveBtn) pronUsageLimitSaveBtn.disabled = false;
      if (pronUsageLimitClearBtn) pronUsageLimitClearBtn.disabled = false;

      const endpoint = resolvePronUsageEndpoint();
      if (!endpoint) {
        pronUsageTotalsEl.hidden = true;
        pronUsageListEl.innerHTML = '';
        updatePronUsageStatus('Endpoint de usage Pron no configurado.');
        updatePronUsageLimitStatus('Endpoint de usage Pron no configurado.');
        return;
      }

      let url;
      try {
        url = new URL(endpoint, window.location.origin);
      } catch (err) {
        pronUsageTotalsEl.hidden = true;
        pronUsageListEl.innerHTML = '';
        updatePronUsageStatus('Endpoint de usage Pron inválido.');
        return;
      }
      url.searchParams.set('user_id', userId);
      url.searchParams.set('limit', '30');

      const requestId = pronUsageRequestSeq + 1;
      pronUsageRequestSeq = requestId;
      updatePronUsageStatus('Cargando consumo de evaluación avanzada...');
      updatePronUsageLimitStatus('Cargando limite...');

      try {
        const [response, limitPayload] = await Promise.all([
          fetch(url.toString(), {
            headers: buildUsageHeaders()
          }),
          fetchPronUsageLimitStatus(userId).catch((err) => ({ _error: err }))
        ]);
        if (requestId !== pronUsageRequestSeq) return;
        if (limitPayload && !limitPayload._error) {
          renderPronUsageLimit(limitPayload);
        } else if (limitPayload && limitPayload._error) {
          updatePronUsageLimitStatus(
            `No se pudo leer limite: ${limitPayload._error.message || String(limitPayload._error)}`
          );
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (requestId !== pronUsageRequestSeq) return;
        if (!payload || payload.enabled === false) {
          pronUsageTotalsEl.hidden = true;
          pronUsageListEl.innerHTML = '';
          updatePronUsageStatus('Evaluación avanzada no configurada en servidor.');
          return;
        }
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        const totals = payload && typeof payload.totals === 'object' ? payload.totals : {};
        renderPronUsageTotals(totals, rows.length);
        renderPronUsageRows(rows);
        if (payload && payload.limit_status && typeof payload.limit_status === 'object') {
          renderPronUsageLimit(payload.limit_status);
        }
        if (rows.length) {
          const now = new Date().toLocaleTimeString('es-ES');
          updatePronUsageStatus(`Actualizado: ${now}`);
        } else {
          updatePronUsageStatus('Sin consumo de evaluación avanzada registrado para este usuario.');
        }
      } catch (err) {
        if (requestId !== pronUsageRequestSeq) return;
        pronUsageTotalsEl.hidden = true;
        pronUsageListEl.innerHTML = '';
        updatePronUsageStatus(`Error cargando usage Pron: ${err.message || String(err)}`);
      }
    };

    const getPronUsageLimitInputValue = () => {
      if (!pronUsageLimitInputEl) return NaN;
      const raw = String(pronUsageLimitInputEl.value || '').trim();
      if (!raw) return 0;
      return Number(raw);
    };

    const submitPronUsageLimit = async (limitSeconds) => {
      const userId = getUsageUserId();
      if (!userId) {
        updatePronUsageLimitStatus('Inicia sesión para configurar limite.');
        return;
      }
      const normalized = Number.isFinite(limitSeconds) ? Math.max(0, Math.floor(limitSeconds)) : NaN;
      if (!Number.isFinite(normalized)) {
        updatePronUsageLimitStatus('Introduce un numero valido.');
        return;
      }
      if (pronUsageLimitSaveBtn) pronUsageLimitSaveBtn.disabled = true;
      if (pronUsageLimitClearBtn) pronUsageLimitClearBtn.disabled = true;
      updatePronUsageLimitStatus('Guardando limite...');
      try {
        const payload = await savePronUsageLimit(userId, normalized);
        if (payload && typeof payload === 'object') {
          renderPronUsageLimit(payload);
        }
        await refreshPronUserUsage();
      } catch (err) {
        updatePronUsageLimitStatus(`Error guardando limite: ${err.message || String(err)}`);
      } finally {
        if (pronUsageLimitSaveBtn) pronUsageLimitSaveBtn.disabled = false;
        if (pronUsageLimitClearBtn) pronUsageLimitClearBtn.disabled = false;
      }
    };

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatElapsed = (ts) => {
      const value = Number(ts);
      if (!value) return 'Hace un momento';
      const diff = Math.max(0, Date.now() - value);
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) return 'Hace un momento';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `Hace ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Hace ${hours} h`;
      const days = Math.floor(hours / 24);
      return `Hace ${days} d`;
    };

    const renderNotifyList = () => {
      if (!notifyListEl || !notifyEmptyEl) return;
      const items = getNotifications();
      if (!items.length) {
        notifyListEl.innerHTML = '';
        notifyEmptyEl.hidden = false;
        return;
      }
      notifyEmptyEl.hidden = true;
      notifyListEl.innerHTML = items
        .map((item) => {
          const meta = `${item.status === 'unread' ? 'Nueva' : 'Leida'} · ${formatElapsed(item.created_at)}`;
          const tone = item.tone === 'good' || item.tone === 'warn' ? item.tone : '';
          const icon = escapeHtml(item.icon || 'notifications-outline');
          const image = escapeHtml(item.image || '');
          const iconMarkup = image
            ? `<img class="notify-thumb" src="${image}" alt="">`
            : `<ion-icon name="${icon}"></ion-icon>`;
          return `
            <div class="notify-item">
              <div class="notify-icon ${tone}">
                ${iconMarkup}
              </div>
              <div class="notify-content">
                <div class="notify-text">${escapeHtml(item.title)}</div>
                ${item.text ? `<div class="notify-meta">${escapeHtml(item.text)}</div>` : ''}
                <div class="notify-meta">${escapeHtml(meta)}</div>
              </div>
            </div>
          `;
        })
        .join('');
    };

    const resetTalkTimelines = () => {
      try {
        localStorage.setItem(getTalkStorageKey(), JSON.stringify({ catbot: [], chatbot: [] }));
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(new CustomEvent('app:talk-timelines-reset'));
      updateTalkPanels();
    };

    const setTtsStatus = (text) => {
      if (!ttsStatusEl) return;
      ttsStatusEl.textContent = text || '';
    };

    const setTtsButtonPlaying = (playing) => {
      ttsPlaying = Boolean(playing);
      if (!ttsPlayBtn) return;
      ttsPlayBtn.textContent = ttsPlaying ? 'Stop TTS' : 'Play TTS';
      ttsPlayBtn.setAttribute('color', ttsPlaying ? 'danger' : 'primary');
    };

    const stopBrowserTts = () => {
      ttsUtter = null;
      setTtsButtonPlaying(false);
      try {
        if (typeof window.cancelWebSpeech === 'function') {
          window.cancelWebSpeech();
        } else if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
          window.speechSynthesis.cancel();
        }
      } catch (err) {
        // no-op
      }
    };

    const seedSpeakStores = () => {
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.speakWordScores = {
        'session-p': {
          PEN: { percent: 72, transcript: 'pen' },
          PAPER: { percent: 82, transcript: 'paper' }
        }
      };
      window.r34lp0w3r.speakPhraseScores = {
        'session-p': { percent: 68, transcript: 'The pink pen is on the paper.' }
      };
      window.r34lp0w3r.speakSessionRewards = {
        'session-p': { rewardQty: 2, rewardLabel: 'diamonds', rewardIcon: 'diamond' }
      };
      window.r34lp0w3r.speakBadges = {
        'route:sound': {
          routeId: 'sound',
          routeTitle: 'Sound Journey',
          badgeIndex: 1,
          image: 'assets/badges/badge1.png',
          title: 'Badge 1',
          ts: Date.now()
        }
      };
      if (typeof window.persistSpeakStores === 'function') {
        window.persistSpeakStores();
      }
      if (typeof window.notifySpeakStoresChange === 'function') {
        window.notifySpeakStoresChange();
      }
      updateSpeakPanels();
    };

    const resetSpeakStores = () => {
      if (typeof window.resetSpeakStores === 'function') {
        window.resetSpeakStores();
      } else {
        window.r34lp0w3r = window.r34lp0w3r || {};
        window.r34lp0w3r.speakWordScores = {};
        window.r34lp0w3r.speakPhraseScores = {};
        window.r34lp0w3r.speakSessionRewards = {};
        window.r34lp0w3r.speakBadges = {};
        if (typeof window.persistSpeakStores === 'function') {
          window.persistSpeakStores();
        }
        window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
      }
      updateSpeakPanels();
    };

    this._speakStoresHandler = () => {
      updateSpeakPanels();
      renderBadgePicker();
    };
    window.addEventListener('app:speak-stores-change', this._speakStoresHandler);
    this._notifyHandler = renderNotifyList;
    window.addEventListener('app:notifications-change', this._notifyHandler);
    updateSpeakPanels();
    updateContentSourcePanel();
    updateTalkPanels();
    refreshUserUsage();
    refreshTtsUserUsage();
    refreshPronUserUsage();
    renderNotifyList();
    renderBadgePicker();
    Promise.all([ensureTrainingData(), ensureReferenceData().catch(() => null)])
      .then(() => {
        badgeCatalog = buildBadgeCatalog();
        renderBadgePicker();
        updateContentSourcePanel();
      })
      .catch(() => {
        updateContentSourcePanel();
      });
    const initialFreeRideAudioMode = getStoredFreeRideAudioMode();
    updateFreeRideAudioModeUi(setFreeRideAudioMode(initialFreeRideAudioMode));
    const initialFreeRideAdvancedEnabled = getStoredFreeRideAdvancedEnabled();
    updateFreeRideAdvancedUi(setFreeRideAdvancedEnabled(initialFreeRideAdvancedEnabled));
    const initialFreeRideWordTapAudioEnabled = getStoredFreeRideWordTapAudioEnabled();
    updateFreeRideWordTapAudioUi(setFreeRideWordTapAudioEnabled(initialFreeRideWordTapAudioEnabled));
    const initialSpeakSessionPercentagesVisible = getStoredSpeakSessionPercentagesVisible();
    updateSpeakSessionPercentagesUi(setSpeakSessionPercentagesVisible(initialSpeakSessionPercentagesVisible));
    const initialSpeakPronunciationAvatarMode = getStoredSpeakPronunciationAvatarMode();
    updateSpeakPronunciationAvatarUi(
      setSpeakPronunciationAvatarMode(initialSpeakPronunciationAvatarMode)
    );
    TAB_VISIBILITY_ORDER.forEach((tab) => {
      updateTabVisibilityUi(tab, setTabVisibility(tab, getStoredTabVisibility(tab)));
    });
    const initialChatCommunityEnabled = getStoredChatCatbotEnabled();
    updateChatCommunityUi(setChatCatbotEnabled(initialChatCommunityEnabled));
    const initialChatChatbotEnabled = getStoredChatChatbotEnabled();
    updateChatChatbotUi(setChatChatbotEnabled(initialChatChatbotEnabled));

    this.querySelector('#diag-back')?.addEventListener('click', () => {
      ensureInitialHash();
      window.location.hash = '#/tabs';
    });


    const bind = (id, fnName, hasPlugin) => {
      const btn = this.querySelector(id);
      const fn = window[fnName];
      if (!btn) return;
      if (!hasPlugin || typeof fn !== 'function') {
        btn.disabled = true;
        btn.innerHTML += ' (no plugin)';
        return;
      }
      btn.addEventListener('click', () => {
        try {
          fn();
        } catch (e) {
          console.error(`[diag] error ejecutando ${fnName}`, e);
        }
      });
    };    

    // Controles de StatusBar
    const hasStatusBarPlugin =
      !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar);
    bind('#sb-blue', 'setStatusBarBlue', hasStatusBarPlugin);
    bind('#sb-transparent', 'setStatusBarTransparent', hasStatusBarPlugin);
    bind('#sb-light', 'setStatusBarLight', hasStatusBarPlugin);
    bind('#sb-dark', 'setStatusBarDark', hasStatusBarPlugin);

    // Controles de Notificaciones Push
    const hasPushPlugin =
      !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications);
    bind('#pn-bell', 'playPushForegroundBell', true);
    bind('#pn-10s', platform == 'ios' ? 'enviarPushAPNS10' : 'enviarPushFCM10', hasPushPlugin);

    // Controles de AdMob
    const hasAdMobPlugin =
      !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob);
    bind('#admob-form', 'AdMobShowContentForm', hasAdMobPlugin);
    bind('#admob-init', 'AdMobInit', hasAdMobPlugin);
    bind('#admob-banner-show', 'AdMobShowBanner', hasAdMobPlugin);
    bind('#admob-banner-hide', 'AdMobHideBanner', hasAdMobPlugin);
    bind('#admob-interstitial-prepare', 'AdMobPrepareInterstitial', hasAdMobPlugin);
    bind('#admob-interstitial-show', 'AdMobShowInterstitial', hasAdMobPlugin);

    // Varios
    bind('#var-sendmail', 'sendMail', true);
    bind('#var-goweblegal', 'goWebLegal', true);

    this.querySelector('#diag-onboarding-repeat')?.addEventListener('click', () => {
      clearOnboardingDone();
      window.location.hash = '#/onboarding';
    });
    this.querySelector('#diag-app-reset')?.addEventListener('click', () => {
      const confirmReset = window.confirm(
        'Esto borrará todos los datos locales de la app en este dispositivo y la reiniciará como primera ejecución. ¿Continuar?'
      );
      if (!confirmReset) return;

      try {
        if (this._diagStopBrowserTts) this._diagStopBrowserTts();
      } catch (err) {
        // no-op
      }
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
          window.speechSynthesis.cancel();
        }
      } catch (err) {
        // no-op
      }

      try {
        localStorage.clear();
      } catch (err) {
        console.error('[diag] error limpiando localStorage', err);
      }
      try {
        sessionStorage.clear();
      } catch (err) {
        // no-op
      }

      if (typeof window.setUser === 'function') {
        try {
          window.setUser(null);
        } catch (err) {
          // no-op
        }
      } else {
        window.user = null;
      }

      window.location.hash = '#/onboarding';
      setTimeout(() => {
        window.location.reload();
      }, 40);
    });
    this.querySelector('#diag-content-source-refresh')?.addEventListener('click', () => {
      updateContentSourcePanel();
    });

    badgesPickerEl?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target ? target.closest('[data-badge-id]') : null;
      if (!button) return;
      const badgeId = String(button.dataset.badgeId || '').trim();
      if (!badgeId) return;
      const badge = badgeCatalog.find((item) => item.id === badgeId);
      if (!badge) return;
      const store = getBadgeStore();
      if (store[badgeId]) {
        delete store[badgeId];
      } else {
        const entry = {
          routeId: badge.routeId,
          routeTitle: badge.routeTitle,
          badgeIndex: badge.badgeIndex,
          image: badge.image,
          title: badge.title,
          ts: Date.now()
        };
        store[badgeId] = entry;
        notifyBadgeUnlocked(badgeId, entry);
      }
      if (typeof window.persistSpeakStores === 'function') {
        window.persistSpeakStores();
      }
      if (typeof window.notifySpeakStoresChange === 'function') {
        window.notifySpeakStoresChange();
      } else {
        window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
      }
      if (typeof window.syncSpeakProgress === 'function') {
        window
          .syncSpeakProgress({
            reason: 'diag-badge-toggle',
            includeSnapshot: true,
            strategy: 'replace'
          })
          .catch(() => {});
      }
      updateSpeakPanels();
      renderBadgePicker();
    });

    freeRideAudioModeEl?.addEventListener('ionChange', (event) => {
      const nextMode = event && event.detail ? event.detail.value : freeRideAudioModeEl.value;
      updateFreeRideAudioModeUi(setFreeRideAudioMode(nextMode));
    });
    freeRideAdvancedToggleEl?.addEventListener('ionChange', (event) => {
      const nextEnabled =
        event && event.detail && event.detail.checked !== undefined
          ? Boolean(event.detail.checked)
          : Boolean(freeRideAdvancedToggleEl.checked);
      updateFreeRideAdvancedUi(setFreeRideAdvancedEnabled(nextEnabled));
    });
    freeRideWordTapAudioToggleEl?.addEventListener('ionChange', (event) => {
      const nextEnabled =
        event && event.detail && event.detail.checked !== undefined
          ? Boolean(event.detail.checked)
          : Boolean(freeRideWordTapAudioToggleEl.checked);
      updateFreeRideWordTapAudioUi(setFreeRideWordTapAudioEnabled(nextEnabled));
    });
    speakSessionPercentagesToggleEl?.addEventListener('ionChange', (event) => {
      const nextVisible =
        event && event.detail && event.detail.checked !== undefined
          ? Boolean(event.detail.checked)
          : Boolean(speakSessionPercentagesToggleEl.checked);
      updateSpeakSessionPercentagesUi(setSpeakSessionPercentagesVisible(nextVisible));
    });
    speakPronunciationAvatarModeEl?.addEventListener('ionChange', (event) => {
      const nextMode =
        event && event.detail ? event.detail.value : speakPronunciationAvatarModeEl.value;
      updateSpeakPronunciationAvatarUi(setSpeakPronunciationAvatarMode(nextMode));
    });
    TAB_VISIBILITY_ORDER.forEach((tab) => {
      tabVisibilityToggleEls[tab]?.addEventListener('ionChange', (event) => {
        const nextEnabled =
          event && event.detail && event.detail.checked !== undefined
            ? Boolean(event.detail.checked)
            : Boolean(tabVisibilityToggleEls[tab] && tabVisibilityToggleEls[tab].checked);
        updateTabVisibilityUi(tab, setTabVisibility(tab, nextEnabled));
      });
    });
    chatCommunityToggleEl?.addEventListener('ionChange', (event) => {
      const nextEnabled =
        event && event.detail && event.detail.checked !== undefined
          ? Boolean(event.detail.checked)
          : Boolean(chatCommunityToggleEl.checked);
      updateChatCommunityUi(setChatCatbotEnabled(nextEnabled));
    });
    chatChatbotToggleEl?.addEventListener('ionChange', (event) => {
      const nextEnabled =
        event && event.detail && event.detail.checked !== undefined
          ? Boolean(event.detail.checked)
          : Boolean(chatChatbotToggleEl.checked);
      updateChatChatbotUi(setChatChatbotEnabled(nextEnabled));
    });

    // Login
    const openLoginModal = async () => {
      let modal = document.querySelector('ion-modal.login-modal');
      if (!modal) {
        modal = document.createElement('ion-modal');
        modal.classList.add('login-modal');
        modal.component = 'page-login';
        modal.backdropDismiss = true;
        modal.keepContentsMounted = true;
        const presentingEl = document.querySelector('ion-router-outlet');
        if (presentingEl) {
          modal.presentingElement = presentingEl;
        }
        document.body.appendChild(modal);
      }

      if (modal.presented || modal.isOpen) {
        return;
      }
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      await modal.present();
    };

    this.querySelector('#diag-login')?.addEventListener('click', () => {
      openLoginModal().catch((err) => {
        console.error('[diag] error abriendo login', err);
      });
    });
    this.querySelector('#diag-logout')?.addEventListener('click', () => {
      if (typeof window.setUser === 'function') {
        window.setUser(null);
      } else {
        window.user = null;
        try {
          localStorage.removeItem('appv5:user');
        } catch (err) {
          console.error('[user] error borrando localStorage', err);
        }
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: null }));
      }
    });

    this.querySelector('#diag-speak-refresh')?.addEventListener('click', () => {
      updateSpeakPanels();
      updateContentSourcePanel();
    });
    this.querySelector('#diag-speak-seed')?.addEventListener('click', () => {
      seedSpeakStores();
    });
    this.querySelector('#diag-speak-reset')?.addEventListener('click', () => {
      resetSpeakStores();
    });
    this.querySelector('#diag-talk-refresh')?.addEventListener('click', () => {
      updateTalkPanels();
    });
    this.querySelector('#diag-talk-reset')?.addEventListener('click', () => {
      resetTalkTimelines();
    });
    this.querySelector('#diag-usage-refresh')?.addEventListener('click', () => {
      refreshUserUsage();
    });
    usageLimitSaveBtn?.addEventListener('click', () => {
      submitUsageLimit(getUsageLimitInputValue());
    });
    usageLimitClearBtn?.addEventListener('click', () => {
      submitUsageLimit(0);
    });
    this.querySelector('#diag-tts-usage-refresh')?.addEventListener('click', () => {
      refreshTtsUserUsage();
    });
    ttsUsageLimitSaveBtn?.addEventListener('click', () => {
      submitTtsUsageLimit(getTtsUsageLimitInputValue());
    });
    ttsUsageLimitClearBtn?.addEventListener('click', () => {
      submitTtsUsageLimit(0);
    });
    this.querySelector('#diag-pron-usage-refresh')?.addEventListener('click', () => {
      refreshPronUserUsage();
    });
    pronUsageLimitSaveBtn?.addEventListener('click', () => {
      submitPronUsageLimit(getPronUsageLimitInputValue());
    });
    pronUsageLimitClearBtn?.addEventListener('click', () => {
      submitPronUsageLimit(0);
    });
    sfxGreenBtn?.addEventListener('click', () => {
      playSfx('green', 'Green');
    });
    sfxYellowBtn?.addEventListener('click', () => {
      playSfx('yellow', 'Yellow');
    });
    sfxRedBtn?.addEventListener('click', () => {
      playSfx('red', 'Red');
    });
    sfxNotificationBtn?.addEventListener('click', () => {
      playSfx('notification', 'Notification');
    });
    this.querySelector('#diag-notify-generate')?.addEventListener('click', () => {
      generateDemoNotifications();
    });
    this.querySelector('#diag-notify-clear')?.addEventListener('click', () => {
      clearNotifications();
    });
    this.querySelector('#diag-notify-open')?.addEventListener('click', () => {
      if (typeof window.openNotificationsModal === 'function') {
        window.openNotificationsModal();
      }
    });

    if (ttsPlayBtn) {
      const ttsSupported =
        typeof window !== 'undefined' &&
        typeof window.speechSynthesis !== 'undefined' &&
        typeof window.SpeechSynthesisUtterance !== 'undefined';
      if (!ttsSupported) {
        ttsPlayBtn.disabled = true;
        setTtsStatus('Web Speech API no disponible en este entorno.');
      } else {
        setTtsStatus('Listo.');
        ttsPlayBtn.addEventListener('click', () => {
          if (ttsPlaying) {
            stopBrowserTts();
            setTtsStatus('Detenido.');
            return;
          }
          const text = String(ttsInputEl ? ttsInputEl.value : '').trim();
          if (!text) {
            setTtsStatus('Introduce un texto para reproducir.');
            return;
          }

          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = 'en-US';
          utter.rate = 1;
          utter.pitch = 1;
          utter.volume = 1;

          utter.onstart = () => {
            setTtsButtonPlaying(true);
            setTtsStatus('Reproduciendo...');
          };
          utter.onend = () => {
            ttsUtter = null;
            setTtsButtonPlaying(false);
            setTtsStatus('Finalizado.');
          };
          utter.onerror = (event) => {
            ttsUtter = null;
            setTtsButtonPlaying(false);
            const reason = event && event.error ? String(event.error) : 'error desconocido';
            setTtsStatus(`Error TTS: ${reason}`);
          };

          ttsUtter = utter;
          try {
            const started =
              typeof window.speakWebUtterance === 'function'
                ? window.speakWebUtterance(utter)
                : (() => {
                    window.speechSynthesis.cancel();
                    if (typeof window.speechSynthesis.resume === 'function') {
                      window.speechSynthesis.resume();
                    }
                    window.currentUtterance = utter;
                    window.speechSynthesis.speak(utter);
                    return true;
                  })();
            if (!started) {
              ttsUtter = null;
              setTtsButtonPlaying(false);
              setTtsStatus('No se pudo iniciar TTS.');
            }
          } catch (err) {
            ttsUtter = null;
            setTtsButtonPlaying(false);
            setTtsStatus(`Error al iniciar TTS: ${err.message || String(err)}`);
          }
        });
      }
    }

    if (languageDetectBtn) {
      const nativePlugin = window.Capacitor?.Plugins?.P4w4Plugin;
      const canDetectLanguage = nativePlugin && typeof nativePlugin.detectLanguage === 'function';
      if (!canDetectLanguage) {
        languageDetectBtn.disabled = true;
        setLanguageStatus('Detección nativa no disponible en este entorno.');
        setLanguageOutput('');
      } else {
        setLanguageStatus('Listo.');
        languageDetectBtn.addEventListener('click', async () => {
          const text = String(languageInputEl ? languageInputEl.value : '').trim();
          if (!text) {
            setLanguageStatus('Introduce un texto para detectar el idioma.');
            setLanguageOutput('');
            return;
          }

          languageDetectBtn.disabled = true;
          setLanguageStatus('Detectando...');
          try {
            const result = await nativePlugin.detectLanguage({ text });
            setLanguageOutput(formatLanguageDetectionResult(result));
            if (!result || result.available === false) {
              setLanguageStatus('Detector no disponible en este entorno.');
            } else if (result.dominantLanguage) {
              const confidence = Number(result.confidence || 0);
              setLanguageStatus(
                `Idioma dominante: ${result.dominantLanguage}${confidence > 0 ? ` (${formatLanguageConfidence(confidence)})` : ''}`
              );
            } else {
              setLanguageStatus('No se pudo determinar un idioma dominante.');
            }
          } catch (err) {
            setLanguageStatus(`Error detectando idioma: ${err.message || String(err)}`);
            setLanguageOutput('');
          } finally {
            languageDetectBtn.disabled = false;
          }
        });
      }
    }

    if (moderationRunBtn) {
      const moderationEndpoint = resolveOpenAIModerationEndpoint();
      if (!moderationEndpoint) {
        moderationRunBtn.disabled = true;
        setModerationStatus('Endpoint de moderación no configurado.');
        setModerationSummary('', true);
        setModerationOutput('');
      } else {
        setModerationStatus('Listo.');
        moderationRunBtn.addEventListener('click', async () => {
          const text = String(moderationInputEl ? moderationInputEl.value : '').trim();
          if (!text) {
            setModerationStatus('Introduce un texto para analizar.');
            setModerationSummary('', true);
            setModerationOutput('');
            return;
          }

          moderationRunBtn.disabled = true;
          setModerationStatus('Consultando moderación...');
          try {
            const startedAt = performance.now();
            const response = await fetch(moderationEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...buildUsageHeaders()
              },
              body: JSON.stringify({ text })
            });
            const payload = await response.json().catch(() => ({}));
            const clientElapsedMs = performance.now() - startedAt;
            const result =
              payload && typeof payload === 'object'
                ? {
                    ...payload,
                    timings: {
                      ...(payload.timings || {}),
                      client_ms: Math.round(clientElapsedMs)
                    }
                  }
                : {
                    ok: false,
                    error: `HTTP ${response.status}`,
                    timings: {
                      client_ms: Math.round(clientElapsedMs)
                    }
                  };

            if (!response.ok || result.ok === false) {
              throw new Error(result.error || `HTTP ${response.status}`);
            }

            setModerationSummary(buildModerationSummary(result));
            setModerationOutput(formatModerationResult(result));
            const flagged = result.moderation && result.moderation.flagged ? 'marcado' : 'limpio';
            setModerationStatus(
              `Resultado: ${flagged} · cliente ${formatDurationMs(result.timings && result.timings.client_ms)} · OpenAI ${formatDurationMs(result.timings && result.timings.openai_ms)}`
            );
          } catch (err) {
            setModerationStatus(`Error moderando texto: ${err.message || String(err)}`);
            setModerationSummary('', true);
            setModerationOutput('');
          } finally {
            moderationRunBtn.disabled = false;
          }
        });
      }
    }

    this._diagStopBrowserTts = stopBrowserTts;

  }

  disconnectedCallback() {
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
      this._userHandler = null;
    }
    if (this._speakStoresHandler) {
      window.removeEventListener('app:speak-stores-change', this._speakStoresHandler);
      this._speakStoresHandler = null;
    }
    if (this._notifyHandler) {
      window.removeEventListener('app:notifications-change', this._notifyHandler);
      this._notifyHandler = null;
    }
    if (this._diagStopBrowserTts) {
      this._diagStopBrowserTts();
      this._diagStopBrowserTts = null;
    }
  }
}
 
customElements.define('page-diagnostics', PageDiagnostics);

function collectPlugins() {
  const list = [];
  const caps = safeObj(() => window.Capacitor && window.Capacitor.Plugins);
  const cordovaPlugs = safeObj(() => window.cordova && window.cordova.plugins);

  const seen = new Set();
  const pushUnique = (source, name, plugin) => {
    const key = `${source}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ idx: list.length, source, name, version: getVersion(plugin) });
  };

  safeKeys(caps).forEach((key) => {
    const plugin = caps[key];
    pushUnique('Capacitor', key, plugin);
  });

  safeKeys(cordovaPlugs).forEach((key) => {
    const plugin = cordovaPlugs[key];
    pushUnique('Cordova', key, plugin);
  });

  // Algunos plugins de Cordova viven en window.plugins o cordova.plugin (singular)
  const cordovaAlt = safeObj(() => window.cordova && window.cordova.plugin);
  safeKeys(cordovaAlt).forEach((key) => {
    const plugin = cordovaAlt[key];
    pushUnique('Cordova', key, plugin);
  });

  const winPlugins = safeObj(() => window.plugins);
  safeKeys(winPlugins).forEach((key) => {
    const plugin = winPlugins[key];
    pushUnique('Cordova', key, plugin);
  });

  // Detecciones manuales de globals típicos (ej. cordova-plugin-purchase)
  if (window.CdvPurchase) pushUnique('Global', 'CdvPurchase', window.CdvPurchase);
  if (window.store) pushUnique('Global', 'store', window.store);

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function safeObj(fn) {
  try {
    return fn() || {};
  } catch (e) {
    console.error('[diag] error leyendo objeto de plugins', e);
    return {};
  }
}

function safeKeys(obj) {
  try {
    return Object.keys(obj || {});
  } catch (e) {
    console.error('[diag] error iterando plugins', e);
    return [];
  }
}

function getVersion(plugin) {
  if (!plugin) return 'versión n/d';
  try {
    if (typeof plugin.getVersion === 'function') {
      return plugin.getVersion();
    }
    if (typeof plugin.getInfo === 'function') {
      return plugin.getInfo();
    }
    if (plugin.version) return plugin.version;
    if (plugin.pluginVersion) return plugin.pluginVersion;
    if (plugin.sdkVersion) return plugin.sdkVersion;
  } catch (e) {
    return 'versión n/d';
  }
  return 'versión n/d';
}

function formatVersion(version) {
  if (version && typeof version.then === 'function') return 'resolviendo...';
  if (version && typeof version === 'object') return normalizeVersionObject(version);
  return version || 'versión n/d';
}

function resolveVersionsAsync(plugins, root) {
  plugins.forEach((p) => {
    const target = root.querySelector(`li[data-diag-idx="${p.idx}"] span.muted`);
    if (!target) return;

    if (p.version && typeof p.version.then === 'function') {
      p.version
        .then((val) => {
          target.textContent = formatVersion(val);
        })
        .catch(() => {
          target.textContent = 'versión n/d';
        });
    } else {
      target.textContent = formatVersion(p.version);
    }
  });
}

function normalizeVersionObject(obj) {
  // Intentamos extraer un valor reconocible
  const preferredKeys = ['version', 'versionName', 'versionCode', 'versionString', 'appVersion', 'appBuild', 'build', 'bundleVersion'];
  for (const k of preferredKeys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k]) {
      return String(obj[k]);
    }
  }
  return JSON.stringify(obj);
}
