import { ensureInitialHash, setRouter, goToHome } from './nav.js';
import { clearLoginTabsLock, getAppLocale, hasLoginTabsLock, onboardingDone, setOnboardingDone, setLoginTabsLock } from './state.js';
import { getUnreadCount, markAllNotificationsRead } from './notifications-store.js';
import { ensureLegacySpeakCopyGlobals, getTabsCopy, normalizeLocale as normalizeCopyLocale } from './content/copy.js';
import { isAppTitlebarEnabled } from './components/app-header.js';
import { refreshTranslationCapabilities } from './translation-capabilities.js';
import './pages/onboarding.js';
import './pages/home.js';
import './pages/reference.js';
import './pages/speak.js';
import './pages/profile.js';
import './pages/chat.js';
import './pages/free-ride.js';
import './pages/tabs.js';
import './pages/diagnostics.js';
import './pages/login.js';
import './pages/notifications.js';

const APP_STATUSBAR_COLOR = '#00000000';
const LAB_STATUSBAR_COLOR = '#00000000';
const LAB_THEME_COLOR = '#00000000';
const APP_STATUSBAR_PRESET_KEY = 'appv5:statusbar-preset';
const APP_FONT_SF_PRO_ENABLED_KEY = 'appv5:font-sf-pro-enabled';
const SYSTEM_BOTTOM_INSET_DEBUG_KEY = 'appv5:system-bottom-inset-debug';
const DISPLAY_ZOOM_COMPENSATION_DEFAULT_FACTOR = 0.92;
const RECORDING_STOP_DELAY_KEY = 'appv5:recording-stop-delay-ms';
const RECORDING_STOP_DELAY_DEFAULT_MS = 1400;
const LEGACY_LAYOUT_TRACE_STORAGE_KEY = 'appv5:legacy-layout-trace';
const DEBUG_DISABLE_FOREGROUND_CHROME_RESYNC = false;
const TAB_STORAGE_KEY = 'appv5:active-tab';
const LAB_TAB_IDS = new Set(['freeride', 'home', 'reference', 'chat', 'tu']);
const PURCHASE_EXPIRES_STORAGE_KEY = '_purchase_expires';
const PURCHASE_EXPIRES_HUMAN_STORAGE_KEY = '_purchase_expires_human';
const PURCHASE_USER_ID_STORAGE_KEY = '_purchase_user_id';
const LAST_IAP_RESULT_STORAGE_KEY = 'appv5:last-got-premium-result';

let currentTabsActiveTab = '';
let lastNativeStatusBarInfo = { height: 0, platform: '', osVersion: '' };
let lastNativeSystemInsetsInfo = { top: 0, right: 0, bottom: 0, left: 0, platform: '', osVersion: '' };
let _titlebarCalibrationTimers = [];
let _pendingChromeResyncRaf = 0;
let _pendingChromeResyncPath = '';
let _lastAppliedChromeKey = '';
let _legacyViewportRelayoutTimer = 0;
let _viewportHeightSyncRaf = 0;
let _nativeSystemInsetsSyncRaf = 0;
let _nativeSystemInsetsRetryTimers = [];
let _nativeDisplayZoomCompensationRetryTimers = [];
let _legacyLayoutUnlockTimer = 0;
let _legacyLayoutUnlockTimer2 = 0;
let _legacyLayoutReady = true;
let _legacyLayoutInitDone = false;
let _legacyViewportEventsFrozen = false;

function resolveChromeLocale(preferredLocale = '') {
  const fromPreferred = normalizeCopyLocale(preferredLocale);
  if (fromPreferred) return fromPreferred;
  const fromState = normalizeCopyLocale(getAppLocale());
  if (fromState) return fromState;
  const fromGlobal = normalizeCopyLocale(window.varGlobal && window.varGlobal.locale);
  return fromGlobal || 'en';
}

function syncTabsLocaleLabels(preferredLocale = '') {
  const copy = getTabsCopy(resolveChromeLocale(preferredLocale)) || {};
  const labelsByTab = {
    home: copy.training || 'Training',
    freeride: copy.lab || 'Lab',
    reference: copy.reference || 'Reference',
    chat: copy.chat || 'Chat',
    tu: copy.you || 'Profile'
  };
  Object.entries(labelsByTab).forEach(([tab, label]) => {
    const nextLabel = String(label || '').trim();
    const buttonEl = document.querySelector(`tabs-page ion-tab-button[tab="${tab}"]`);
    const labelEl = buttonEl ? buttonEl.querySelector('ion-label') : null;
    if (labelEl) labelEl.textContent = nextLabel;
    if (buttonEl) {
      buttonEl.setAttribute('aria-label', nextLabel);
      buttonEl.setAttribute('title', nextLabel);
    }
  });
}

function normalizeRecordingStopDelayMs(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return RECORDING_STOP_DELAY_DEFAULT_MS;
  return Math.min(5000, Math.max(0, n));
}

function getRecordingStopDelayMs() {
  const runtimeValue =
    window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'recordingStopDelayMs')
      ? window.r34lp0w3r.recordingStopDelayMs
      : undefined;
  if (runtimeValue !== undefined) return normalizeRecordingStopDelayMs(runtimeValue);
  try {
    const storedValue = localStorage.getItem(RECORDING_STOP_DELAY_KEY);
    return storedValue === null
      ? RECORDING_STOP_DELAY_DEFAULT_MS
      : normalizeRecordingStopDelayMs(storedValue);
  } catch (_err) {
    return RECORDING_STOP_DELAY_DEFAULT_MS;
  }
}

function setRecordingStopDelayMs(value) {
  const normalized = normalizeRecordingStopDelayMs(value);
  window.r34lp0w3p = window.r34lp0w3p || {};
  window.r34lp0w3p.recordingStopDelayMs = normalized;
  try {
    localStorage.setItem(RECORDING_STOP_DELAY_KEY, String(normalized));
  } catch (_err) {
    // no-op
  }
  return normalized;
}

window.getRecordingStopDelayMs = getRecordingStopDelayMs;
if (
  !window.r34lp0w3p ||
  !Object.prototype.hasOwnProperty.call(window.r34lp0w3p, 'recordingStopDelayMs')
) {
  setRecordingStopDelayMs(getRecordingStopDelayMs());
}

function freezeLegacyViewportEvents() {
  _legacyViewportEventsFrozen = true;
}

function shouldBlockLegacyViewportEvent() {
  return isLegacyAndroidStatusbarMode() && _legacyViewportEventsFrozen;
}

function blockLegacyViewportEvent(event) {
  if (!shouldBlockLegacyViewportEvent()) return;
  if (event && typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
}

function getLegacyLayoutTraceEnabled() {
  try {
    const queryValue = new URLSearchParams(window.location.search).get('legacy-layout-trace');
    if (queryValue !== null) {
      return ['1', 'true', 'yes', 'on'].includes(String(queryValue).trim().toLowerCase());
    }
    const stored = localStorage.getItem(LEGACY_LAYOUT_TRACE_STORAGE_KEY);
    if (stored !== null) {
      return ['1', 'true', 'yes', 'on'].includes(String(stored).trim().toLowerCase());
    }
  } catch (_err) {
    // no-op
  }
  return Boolean(window.r34lp0w3r && window.r34lp0w3r.legacyLayoutTrace);
}

function describeLegacyLayoutNode(node) {
  if (!node) return 'unknown-node';
  if (node === document.documentElement) return 'html';
  if (node === document.body) return 'body';
  if (node.nodeType !== 1) return String(node.nodeName || 'node').toLowerCase();
  const tag = String(node.tagName || node.nodeName || 'node').toLowerCase();
  const id = node.id ? `#${node.id}` : '';
  const className =
    typeof node.className === 'string' && node.className.trim()
      ? `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
  return `${tag}${id}${className}`;
}

function installLegacyLayoutMutationTracer() {
  if (!isLegacyAndroidStatusbarMode() || !getLegacyLayoutTraceEnabled()) return;
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.legacyLayoutTrace = true;

  const interestingProps = new Set([
    'top',
    'height',
    'min-height',
    'padding-top',
    'transform',
    '--offset-top',
    '--offset-bottom',
    '--app-native-statusbar-height',
    '--app-native-bottom-inset',
    '--app-system-bottom-inset',
    '--app-viewport-height',
    '--app-titlebar-y-correction',
    '--ion-safe-area-top'
  ]);

  const styleProto = window.CSSStyleDeclaration && window.CSSStyleDeclaration.prototype;
  if (styleProto && !styleProto.__speakLegacyLayoutTracePatched) {
    const originalSetProperty = styleProto.setProperty;
    const cssTextDescriptor = Object.getOwnPropertyDescriptor(styleProto, 'cssText');
    styleProto.setProperty = function tracedSetProperty(property, value, priority) {
      if (interestingProps.has(String(property))) {
        try {
          console.groupCollapsed(
            '[legacy-layout-trace] setProperty',
            String(property),
            '=',
            String(value),
            priority ? `!${priority}` : ''
          );
          console.trace();
          console.groupEnd();
        } catch (_err) {
          // no-op
        }
      }
      return originalSetProperty.apply(this, arguments);
    };
    if (cssTextDescriptor && typeof cssTextDescriptor.set === 'function' && typeof cssTextDescriptor.get === 'function') {
      Object.defineProperty(styleProto, 'cssText', {
        configurable: true,
        enumerable: cssTextDescriptor.enumerable,
        get() {
          return cssTextDescriptor.get.call(this);
        },
        set(value) {
          try {
            console.groupCollapsed('[legacy-layout-trace] cssText =', String(value));
            console.trace();
            console.groupEnd();
          } catch (_err) {
            // no-op
          }
          return cssTextDescriptor.set.call(this, value);
        }
      });
    }
    styleProto.__speakLegacyLayoutTracePatched = true;
  }

  const elementProto = window.Element && window.Element.prototype;
  if (elementProto && !elementProto.__speakLegacyLayoutTracePatched) {
    const originalSetAttribute = elementProto.setAttribute;
    const originalRemoveAttribute = elementProto.removeAttribute;
    elementProto.setAttribute = function tracedSetAttribute(name, value) {
      if (
        name === 'style' ||
        name === 'class' ||
        (name === 'hidden' && this === document.body) ||
        this === document.documentElement ||
        this === document.body ||
        String(this.tagName || '').toLowerCase() === 'ion-content'
      ) {
        try {
          console.log('[legacy-layout-trace] setAttribute', describeLegacyLayoutNode(this), name, value);
          console.trace();
        } catch (_err) {
          // no-op
        }
      }
      return originalSetAttribute.apply(this, arguments);
    };
    elementProto.removeAttribute = function tracedRemoveAttribute(name) {
      if (name === 'style' || name === 'class' || this === document.documentElement || this === document.body) {
        try {
          console.log('[legacy-layout-trace] removeAttribute', describeLegacyLayoutNode(this), name);
          console.trace();
        } catch (_err) {
          // no-op
        }
      }
      return originalRemoveAttribute.apply(this, arguments);
    };
    elementProto.__speakLegacyLayoutTracePatched = true;
  }

  const attachShadowProto = window.Element && window.Element.prototype && window.Element.prototype.attachShadow;
  if (typeof attachShadowProto === 'function' && !window.Element.prototype.__speakLegacyShadowTracePatched) {
    const originalAttachShadow = attachShadowProto;
    const observeShadowRoot = (shadowRoot, host) => {
      if (!shadowRoot || shadowRoot.__speakLegacyShadowObserver) return;
      const shadowObserver = new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target;
          if (!target || target.nodeType !== 1) continue;
          if (record.type !== 'attributes') continue;
          const attrName = record.attributeName || '';
          if (!['style', 'class', 'hidden'].includes(attrName)) continue;
          console.log(
            '[legacy-layout-trace][shadow]',
            describeLegacyLayoutNode(host),
            '=>',
            describeLegacyLayoutNode(target),
            attrName,
            target.getAttribute(attrName)
          );
          console.trace();
        }
      });
      shadowObserver.observe(shadowRoot, {
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden']
      });
      shadowRoot.__speakLegacyShadowObserver = shadowObserver;
    };

    window.Element.prototype.attachShadow = function tracedAttachShadow(init) {
      const shadowRoot = originalAttachShadow.call(this, init);
      try {
        observeShadowRoot(shadowRoot, this);
      } catch (_err) {
        // no-op
      }
      return shadowRoot;
    };

    window.Element.prototype.__speakLegacyShadowTracePatched = true;

    const existingShadowHosts = Array.from(
      document.querySelectorAll('ion-app, ion-content, ion-header, ion-toolbar, ion-title, ion-tab-bar, ion-modal, ion-toast')
    );
    existingShadowHosts.forEach((host) => {
      if (host && host.shadowRoot) {
        try {
          observeShadowRoot(host.shadowRoot, host);
        } catch (_err) {
          // no-op
        }
      }
    });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target;
      if (!target || target.nodeType !== 1) continue;
      const tag = String(target.tagName || '').toLowerCase();
      if (tag !== 'body' && tag !== 'html' && tag !== 'ion-content' && tag !== 'ion-header' && tag !== 'ion-toolbar') {
        continue;
      }
      if (record.type === 'attributes') {
        const attrName = record.attributeName || '';
        if (!['style', 'class', 'hidden'].includes(attrName)) continue;
        console.log(
          '[legacy-layout-trace] mutation',
          describeLegacyLayoutNode(target),
          attrName,
          target.getAttribute(attrName)
        );
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden']
  });

  window.r34lp0w3r.legacyLayoutTraceObserver = observer;
  console.log('[legacy-layout-trace] enabled');
}

function applyInitialTitlebarClassEarly() {
  const apply = () => {
    if (!document.body) return;
    document.body.classList.toggle('app-titlebar-enabled', isAppTitlebarEnabled());
    // Apply legacy Android class synchronously so CSS overrides (which need
    // app-android-legacy-webview on body) are active from the very first render,
    // before the async applyAppChromeForPath call adds the class later.
    if (detectLegacyAndroidFromUserAgent()) {
      document.body.classList.add('app-android-legacy-webview');
    }
  };
  apply();
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }
}

applyInitialTitlebarClassEarly();
installLegacyLayoutMutationTracer();

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  try {
    window.history.scrollRestoration = 'manual';
  } catch (_err) {
    // no-op
  }
}

function getCurrentAppPath() {
  return window.location.hash.replace('#', '') || '/';
}

function logViewportGeometry(reason) {
  if (!getLegacyLayoutTraceEnabled()) return;
  try {
    const vv = window.visualViewport || null;
    const rootStyle = window.getComputedStyle(document.documentElement);
    const body = document.body;
    console.log('[layout][viewport]', reason, {
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
      visualViewportHeight: vv ? Math.round(vv.height) : null,
      visualViewportOffsetTop: vv ? Math.round(vv.offsetTop) : null,
      visualViewportPageTop: vv ? Math.round(vv.pageTop) : null,
      appViewportHeight: rootStyle.getPropertyValue('--app-viewport-height').trim(),
      nativeStatusBarHeight: rootStyle.getPropertyValue('--app-native-statusbar-height').trim(),
      nativeBottomInset: rootStyle.getPropertyValue('--app-native-bottom-inset').trim(),
      systemBottomInset: rootStyle.getPropertyValue('--app-system-bottom-inset').trim(),
      bodyClientHeight: body ? body.clientHeight : null,
      bodyScrollHeight: body ? body.scrollHeight : null,
      docScrollHeight: document.documentElement.scrollHeight,
      docClientHeight: document.documentElement.clientHeight
    });
  } catch (_err) {
    // no-op
  }
}

function syncAppViewportHeightVar() {
  const viewportHeight = Math.max(
    0,
    Math.round(
      Number(
        window.visualViewport && Number.isFinite(window.visualViewport.height)
          ? window.visualViewport.height
          : window.innerHeight || document.documentElement.clientHeight || 0
      )
    )
  );
  if (!viewportHeight) return;
  document.documentElement.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
  logViewportGeometry('syncAppViewportHeightVar');
}

function setLegacyLayoutReady(nextReady, reason = '') {
  const ready = Boolean(nextReady);
  if (_legacyLayoutReady === ready && _legacyLayoutInitDone) return;
  _legacyLayoutReady = ready;
  _legacyLayoutInitDone = true;
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.legacyLayoutReady = ready;
  if (reason) {
    console.log('[layout][legacy] ready=', ready, 'reason=', reason);
  }
  window.dispatchEvent(
    new CustomEvent('app:legacy-layout-ready', {
      detail: { ready, reason }
    })
  );
}

function scheduleLegacyLayoutUnlock() {
  setLegacyLayoutReady(true, 'legacy-no-delayed-viewport-sync');
}

function scheduleViewportHeightSync() {
  if (isLegacyAndroidStatusbarMode()) return;
  if (_viewportHeightSyncRaf) return;
  _viewportHeightSyncRaf = requestAnimationFrame(() => {
    _viewportHeightSyncRaf = 0;
    syncAppViewportHeightVar();
  });
}

function getStatusBarStyle(lightIcons) {
  // Capacitor StatusBar plugin: 'DARK' = dark appearance = light/white icons (for dark backgrounds)
  //                             'LIGHT' = light appearance = dark/black icons (for light backgrounds)
  // This is the same on both iOS and Android.
  return lightIcons ? 'DARK' : 'LIGHT';
}

function isAndroidPlatform() {
  return (
    window.Capacitor &&
    typeof window.Capacitor.getPlatform === 'function' &&
    window.Capacitor.getPlatform() === 'android'
  );
}

function detectLegacyAndroidFromUserAgent() {
  const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
  const match = ua.match(/Android\s+(\d+)/i);
  const major = match ? Number(match[1]) : 0;
  return Number.isFinite(major) && major > 0 && major <= 12;
}

function isLegacyAndroidStatusbarMode() {
  if (document.body && document.body.classList.contains('app-android-legacy-webview')) return true;
  const platform = String(lastNativeStatusBarInfo.platform || '').trim().toLowerCase();
  const osMajor = parseMajorVersion(lastNativeStatusBarInfo.osVersion);
  return platform === 'android' && osMajor > 0 && osMajor <= 31;
}

function shouldDeferAndroidNativeChrome() {
  if (!isAndroidPlatform()) return false;
  const osVersion = String(lastNativeStatusBarInfo.osVersion || '').trim();
  return !osVersion;
}

function setNativeChrome(color, lightIcons, meta = {}) {
  try {
    if (shouldDeferAndroidNativeChrome()) return;
    const nativePlugin =
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.P4w4Plugin : null;
    if (!nativePlugin || typeof nativePlugin.setNativeChrome !== 'function') return;
    nativePlugin.setNativeChrome({
      backgroundColor: color,
      lightIcons,
      source: meta && meta.source ? meta.source : '',
      path: meta && meta.path ? meta.path : '',
      legacyChromeDebug: getStoredLegacyChromeDebugEnabled()
    });
  } catch (_err) {
    // no-op
  }
}

function setThemeColor(color) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

function normalizeStatusbarPreset(value) {
  return String(value || '').trim().toLowerCase() === 'clear' ? 'clear' : 'dark';
}

function getStoredStatusbarPreset() {
  const globalValue =
    window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'appStatusbarPreset')
      ? window.r34lp0w3r.appStatusbarPreset
      : undefined;
  if (globalValue !== undefined) return normalizeStatusbarPreset(globalValue);
  try {
    return normalizeStatusbarPreset(localStorage.getItem(APP_STATUSBAR_PRESET_KEY));
  } catch (_err) {
    return 'dark';
  }
}

function normalizeAppFontSfProEnabled(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'on', 'yes'].includes(normalized);
}

function getStoredAppFontSfProEnabled() {
  const globalValue =
    window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'appFontSfProEnabled')
      ? window.r34lp0w3r.appFontSfProEnabled
      : undefined;
  if (globalValue !== undefined) return normalizeAppFontSfProEnabled(globalValue);
  try {
    const stored = localStorage.getItem(APP_FONT_SF_PRO_ENABLED_KEY);
    if (stored === null) return true; // SF Pro is the default
    return normalizeAppFontSfProEnabled(stored);
  } catch (_err) {
    return true;
  }
}

function applyAppFontPreference(enabled = getStoredAppFontSfProEnabled()) {
  const normalized = normalizeAppFontSfProEnabled(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.appFontSfProEnabled = normalized;
  document.body.classList.toggle('app-font-sf-pro', normalized);
  return normalized;
}

function normalizeDisplayZoomCompensationFactor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DISPLAY_ZOOM_COMPENSATION_DEFAULT_FACTOR;
  return Math.min(1, Math.max(0.5, numeric));
}

function applyDisplayZoomCompensationPreference(info = {}) {
  const factor = normalizeDisplayZoomCompensationFactor(info.factor);
  const mode = String(info.mode || '').trim();
  const enabled = info.enabled === true;
  const applied = info.applied === true;
  const shouldCompensateWebLayout = enabled && applied && mode === 'webScale';
  document.documentElement.style.setProperty('--app-display-zoom-compensation-factor', String(factor));
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.displayZoomCompensation = {
    ...info,
    factor,
    enabled,
    applied,
    mode
  };
  document.body.classList.toggle('app-display-zoom-compensation', shouldCompensateWebLayout);
  return window.r34lp0w3r.displayZoomCompensation;
}

function normalizeSystemBottomInsetDebugEnabled(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'on', 'yes'].includes(normalized);
}

function getStoredSystemBottomInsetDebugEnabled() {
  const globalValue =
    window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'systemBottomInsetDebug')
      ? window.r34lp0w3r.systemBottomInsetDebug
      : undefined;
  if (globalValue !== undefined) return normalizeSystemBottomInsetDebugEnabled(globalValue);
  try {
    return normalizeSystemBottomInsetDebugEnabled(localStorage.getItem(SYSTEM_BOTTOM_INSET_DEBUG_KEY));
  } catch (_err) {
    return false;
  }
}

function applySystemBottomInsetDebugPreference(enabled = getStoredSystemBottomInsetDebugEnabled()) {
  const normalized = normalizeSystemBottomInsetDebugEnabled(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.systemBottomInsetDebug = normalized;
  document.body.classList.toggle('app-system-bottom-inset-debug', normalized);
  applyLegacyChromeDebugPreference(normalized);
  return normalized;
}

function normalizeLegacyChromeDebugEnabled(value) {
  if (value === true || value === '1' || value === 1 || value === 'true') return true;
  return false;
}

function getStoredLegacyChromeDebugEnabled() {
  return getStoredSystemBottomInsetDebugEnabled();
}

function applyLegacyChromeDebugPreference(enabled = getStoredLegacyChromeDebugEnabled()) {
  const normalized = normalizeLegacyChromeDebugEnabled(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.legacyChromeDebug = normalized;
  document.body.classList.toggle('app-android-legacy-chrome-debug', normalized);
  try {
    const nativePlugin =
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.P4w4Plugin : null;
    if (nativePlugin && typeof nativePlugin.setLegacyChromeDebug === 'function') {
      nativePlugin.setLegacyChromeDebug({ enabled: normalized }).catch(() => {});
    }
  } catch (_err) {
    // no-op
  }
  return normalized;
}

function setNativeStatusBarCssHeight(height) {
  const numeric = Number(height);
  const cssHeight = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  document.documentElement.style.setProperty('--app-native-statusbar-height', `${cssHeight}px`);
}

function nativeInsetToCssPx(value, platform = '') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  if (normalizedPlatform === 'android') {
    return numeric / Math.max(1, Number(window.devicePixelRatio) || 1);
  }
  return numeric;
}

function applyNativeSystemInsetsCssVars(info = {}) {
  const platform = String(info.platform || lastNativeStatusBarInfo.platform || '').trim().toLowerCase();
  const osVersion = String(info.osVersion || lastNativeStatusBarInfo.osVersion || '').trim();
  const nextInfo = {
    top: nativeInsetToCssPx(info.top, platform),
    right: nativeInsetToCssPx(info.right, platform),
    bottom: nativeInsetToCssPx(info.bottom, platform),
    left: nativeInsetToCssPx(info.left, platform),
    platform,
    osVersion
  };
  lastNativeSystemInsetsInfo = nextInfo;
  document.documentElement.style.setProperty('--app-native-top-inset', `${nextInfo.top}px`);
  document.documentElement.style.setProperty('--app-native-bottom-inset', `${nextInfo.bottom}px`);
  document.documentElement.style.setProperty('--app-native-left-inset', `${nextInfo.left}px`);
  document.documentElement.style.setProperty('--app-native-right-inset', `${nextInfo.right}px`);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.nativeSystemInsets = nextInfo;
  window.dispatchEvent(new CustomEvent('app:system-insets-change', { detail: nextInfo }));
  logViewportGeometry('applyNativeSystemInsetsCssVars');
}

function parseMajorVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function syncNativeStatusBarCapabilityClasses(info = {}) {
  const platform = String(info.platform || '').trim().toLowerCase();
  const osMajor = parseMajorVersion(info.osVersion);
  lastNativeStatusBarInfo = {
    height: Number(info.height) || lastNativeStatusBarInfo.height || 0,
    platform,
    osVersion: String(info.osVersion || '').trim()
  };
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.nativeStatusBar = lastNativeStatusBarInfo;
  const needsManualOffset = platform === 'android' || (platform === 'ios' && osMajor >= 26);
  document.body.classList.toggle('app-statusbar-manual-offset', needsManualOffset);
  document.body.classList.toggle('app-ios-statusbar-auto-offset', platform === 'ios' && !needsManualOffset);
  const isLegacyAndroidWebView = platform === 'android' && osMajor > 0 && osMajor <= 31;
  document.body.classList.toggle('app-android-legacy-webview', isLegacyAndroidWebView);
  if (isLegacyAndroidWebView) {
    setLegacyLayoutReady(true, 'legacy-detected');
  } else {
    setLegacyLayoutReady(true, 'non-legacy');
  }
  if (osMajor > 0) {
    document.body.dataset.osMajor = String(osMajor);
  }
}

function syncNativeStatusBarCssHeight() {
  try {
    const nativePlugin =
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.P4w4Plugin : null;
    if (!nativePlugin || typeof nativePlugin.getStatusBarHeight !== 'function') return;
    Promise.resolve(nativePlugin.getStatusBarHeight())
      .then((info) => {
        const prevHeight = Number(lastNativeStatusBarInfo.height) || 0;
        const prevPlatform = String(lastNativeStatusBarInfo.platform || '').trim().toLowerCase();
        const prevOsVersion = String(lastNativeStatusBarInfo.osVersion || '').trim();
        syncNativeStatusBarCapabilityClasses(info || {});
        const rawHeight = Number(info && info.height);
        if (!Number.isFinite(rawHeight) || rawHeight <= 0) return;
        const cssHeight = isAndroidPlatform()
          ? rawHeight / Math.max(1, Number(window.devicePixelRatio) || 1)
          : rawHeight;
        setNativeStatusBarCssHeight(cssHeight);
        const nextPlatform = String(lastNativeStatusBarInfo.platform || '').trim().toLowerCase();
        const nextOsVersion = String(lastNativeStatusBarInfo.osVersion || '').trim();
        const statusbarInfoChanged =
          prevHeight !== rawHeight || prevPlatform !== nextPlatform || prevOsVersion !== nextOsVersion;
        if (statusbarInfoChanged) {
          _lastAppliedChromeKey = '';
          logViewportGeometry('syncNativeStatusBarCssHeight');
        }
      })
      .catch(() => {});
  } catch (_err) {
    // no-op
  }
}

function syncNativeSystemInsetsCssVars() {
  try {
    const nativePlugin =
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.P4w4Plugin : null;
    if (!nativePlugin || typeof nativePlugin.getSystemInsets !== 'function') {
      applyNativeSystemInsetsCssVars({ top: 0, right: 0, bottom: 0, left: 0, platform: '', osVersion: '' });
      return;
    }
    Promise.resolve(nativePlugin.getSystemInsets())
      .then((info) => {
        applyNativeSystemInsetsCssVars(info || {});
      })
      .catch(() => {});
  } catch (_err) {
    // no-op
  }
}

function scheduleNativeSystemInsetsSync() {
  if (_nativeSystemInsetsSyncRaf) return;
  _nativeSystemInsetsSyncRaf = requestAnimationFrame(() => {
    _nativeSystemInsetsSyncRaf = 0;
    syncNativeSystemInsetsCssVars();
  });
}

function syncNativeSystemInsetsCssVarsWithRetries() {
  _nativeSystemInsetsRetryTimers.forEach((timerId) => clearTimeout(timerId));
  _nativeSystemInsetsRetryTimers = [];
  syncNativeSystemInsetsCssVars();
  [120, 320, 800, 1500].forEach((delay) => {
    _nativeSystemInsetsRetryTimers.push(setTimeout(() => syncNativeSystemInsetsCssVars(), delay));
  });
}

function syncNativeDisplayZoomCompensation() {
  try {
    const nativePlugin =
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.P4w4Plugin : null;
    if (!nativePlugin || typeof nativePlugin.getDisplayZoomCompensationInfo !== 'function') {
      applyDisplayZoomCompensationPreference({
        supported: false,
        enabled: false,
        applied: false,
        factor: DISPLAY_ZOOM_COMPENSATION_DEFAULT_FACTOR,
        mode: 'unsupported'
      });
      return;
    }
    Promise.resolve(nativePlugin.getDisplayZoomCompensationInfo())
      .then((info) => {
        applyDisplayZoomCompensationPreference(info || {});
      })
      .catch(() => {});
  } catch (_err) {
    // no-op
  }
}

function syncNativeDisplayZoomCompensationWithRetries() {
  _nativeDisplayZoomCompensationRetryTimers.forEach((timerId) => clearTimeout(timerId));
  _nativeDisplayZoomCompensationRetryTimers = [];
  syncNativeDisplayZoomCompensation();
  [120, 320, 800, 1500].forEach((delay) => {
    _nativeDisplayZoomCompensationRetryTimers.push(
      setTimeout(() => syncNativeDisplayZoomCompensation(), delay)
    );
  });
}

function syncPlatformChromeClasses() {
  const isAndroid = isAndroidPlatform();
  const nativeOsMajor = parseMajorVersion(lastNativeStatusBarInfo.osVersion);
  const nativeLegacyKnown = String(lastNativeStatusBarInfo.platform || '').trim().toLowerCase() === 'android' && nativeOsMajor > 0;
  const isLegacyAndroidWebView =
    nativeLegacyKnown
      ? nativeOsMajor <= 31
      : detectLegacyAndroidFromUserAgent();
  document.body.classList.toggle('app-platform-android', isAndroid);
  document.body.classList.toggle('app-platform-ios', !isAndroid);
  if (!isAndroid) {
    document.body.classList.remove('app-android-legacy-webview');
  } else if (isLegacyAndroidWebView) {
    document.body.classList.add('app-android-legacy-webview');
  } else {
    document.body.classList.remove('app-android-legacy-webview');
  }
  if (isAndroid) {
    document.body.classList.add('app-statusbar-manual-offset');
    document.body.classList.remove('app-ios-statusbar-auto-offset');
  }
}

function resetAppTitlebarCalibration() {
  document.documentElement.style.setProperty('--app-titlebar-y-correction', '0px');
  document.body.classList.remove('app-titlebar-y-corrected');
}

function getCurrentNativeStatusBarCssHeight() {
  const cssValue = window.getComputedStyle(document.documentElement)
    .getPropertyValue('--app-native-statusbar-height')
    .trim();
  const parsedCssValue = Number.parseFloat(cssValue);
  if (Number.isFinite(parsedCssValue) && parsedCssValue > 0) return parsedCssValue;
  const rawHeight = Number(lastNativeStatusBarInfo.height) || 0;
  if (!rawHeight) return 0;
  return isAndroidPlatform() ? rawHeight / Math.max(1, Number(window.devicePixelRatio) || 1) : rawHeight;
}

function calibrateAppTitlebarStatusbarOffset() {
  resetAppTitlebarCalibration();
}

function scheduleAppTitlebarCalibration() {
  _titlebarCalibrationTimers.forEach((id) => clearTimeout(id));
  _titlebarCalibrationTimers = [];
  resetAppTitlebarCalibration();
}

function normalizeChromeTabId(tab) {
  return String(tab || '').trim().toLowerCase();
}

function getStoredActiveTab() {
  try {
    return normalizeChromeTabId(localStorage.getItem(TAB_STORAGE_KEY));
  } catch (_err) {
    return '';
  }
}

function getCurrentTabsActiveTab() {
  const tabsEl = document.querySelector('tabs-page ion-tabs');
  const selectedFromProperty = normalizeChromeTabId(tabsEl && tabsEl.selectedTab);
  const selectedFromAttribute = normalizeChromeTabId(tabsEl && tabsEl.getAttribute('selected-tab'));
  const selectedButton = normalizeChromeTabId(
    (document.querySelector('tabs-page ion-tab-button.tab-selected') || {}).getAttribute
      ? document.querySelector('tabs-page ion-tab-button.tab-selected').getAttribute('tab')
      : ''
  );
  const selectedVisiblePane = normalizeChromeTabId(
    (document.querySelector('tabs-page ion-tab[tab][aria-hidden="false"]') || {}).getAttribute
      ? document.querySelector('tabs-page ion-tab[tab][aria-hidden="false"]').getAttribute('tab')
      : ''
  );

  return (
    selectedVisiblePane ||
    selectedFromProperty ||
    selectedFromAttribute ||
    selectedButton ||
    currentTabsActiveTab ||
    getStoredActiveTab()
  );
}

function isLabChromePath(path) {
  const normalized = String(path || '').trim();
  if (normalized === '/speak' || normalized.startsWith('/speak/')) return true;
  if (normalized.includes('freeride') || normalized.includes('free-ride')) return true;
  if (normalized.includes('/home')) return true;
  if (normalized === '/tabs' || normalized.startsWith('/tabs')) {
    return LAB_TAB_IDS.has(getCurrentTabsActiveTab());
  }
  return false;
}

function parsePurchaseExpiry(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function purchaseExpiryToIso(value) {
  const ts = parsePurchaseExpiry(value);
  if (!ts) return '';
  return new Date(ts).toISOString();
}

function isPremiumFromExpiryIso(value) {
  const ts = parsePurchaseExpiry(value);
  return Boolean(ts && ts > Date.now());
}

function getCurrentUserIdText() {
  return window.user && window.user.id !== undefined && window.user.id !== null
    ? String(window.user.id).trim()
    : '';
}

function readStoredPurchaseStateForUser(userId) {
  try {
    const storedUserId = String(localStorage.getItem(PURCHASE_USER_ID_STORAGE_KEY) || '').trim();
    if (userId && storedUserId && storedUserId !== userId) {
      return { expiresTs: null, purchase_id: '', human: '', user_id: storedUserId };
    }
    const expiresTs = parsePurchaseExpiry(localStorage.getItem(PURCHASE_EXPIRES_STORAGE_KEY) || '');
    return {
      expiresTs,
      purchase_id: '',
      human: localStorage.getItem(PURCHASE_EXPIRES_HUMAN_STORAGE_KEY) || '',
      user_id: storedUserId || ''
    };
  } catch (_err) {
    return { expiresTs: null, purchase_id: '', human: '', user_id: '' };
  }
}

function readStoredLastIapResultForUser(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_IAP_RESULT_STORAGE_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return null;
    const storedUserId =
      stored.user_id !== undefined && stored.user_id !== null ? String(stored.user_id).trim() : '';
    if (userId && storedUserId && storedUserId !== userId) return null;
    return stored;
  } catch (_err) {
    return null;
  }
}

function readCurrentEntitlementSnapshot(userId) {
  const snapshots = [];

  if (window.user && typeof window.user === 'object') {
    const windowUserId =
      window.user.id !== undefined && window.user.id !== null ? String(window.user.id).trim() : '';
    if (!userId || !windowUserId || windowUserId === userId) {
      const userExpiryTs = parsePurchaseExpiry(window.user.expires_date || window.user.expiresDate || '');
      if (userExpiryTs) {
        snapshots.push({
          expiresTs: userExpiryTs,
          purchase_id: window.user.purchase_id ? String(window.user.purchase_id) : '',
          human: new Date(userExpiryTs).toISOString(),
          source: 'window.user'
        });
      }
    }
  }

  const memoryResult =
    window.__lastGotPremiumResult && typeof window.__lastGotPremiumResult === 'object'
      ? window.__lastGotPremiumResult
      : null;
  const candidateResults = [memoryResult, readStoredLastIapResultForUser(userId)];
  candidateResults.forEach((candidate, idx) => {
    if (!candidate || typeof candidate !== 'object') return;
    const candidateUserId =
      candidate.user_id !== undefined && candidate.user_id !== null ? String(candidate.user_id).trim() : '';
    if (userId && candidateUserId && candidateUserId !== userId) return;
    const expiresTs = parsePurchaseExpiry(candidate.purchase_expires);
    if (!expiresTs) return;
    snapshots.push({
      expiresTs,
      purchase_id: candidate.purchase_id ? String(candidate.purchase_id) : '',
      human: candidate.purchase_expires_human || new Date(expiresTs).toISOString(),
      source: idx === 0 ? '__lastGotPremiumResult' : 'localStorage:last-got-premium-result'
    });
  });

  const storedPurchase = readStoredPurchaseStateForUser(userId);
  if (storedPurchase.expiresTs) {
    snapshots.push({
      expiresTs: storedPurchase.expiresTs,
      purchase_id: '',
      human: storedPurchase.human || new Date(storedPurchase.expiresTs).toISOString(),
      source: 'localStorage:purchase-expiry'
    });
  }

  if (!snapshots.length) return null;

  return snapshots.reduce((best, current) =>
    !best || current.expiresTs > best.expiresTs ? current : best
  , null);
}

function mergePremiumResultWithCurrentState(result) {
  if (!result || typeof result !== 'object') return result;
  const incomingExpiryTs = parsePurchaseExpiry(result.purchase_expires);
  if (!incomingExpiryTs) return result;

  const resultUserId =
    result.user_id !== undefined && result.user_id !== null ? String(result.user_id).trim() : '';
  const currentUserId = resultUserId || getCurrentUserIdText();
  const currentEntitlement = readCurrentEntitlementSnapshot(currentUserId);

  if (!currentEntitlement || !currentEntitlement.expiresTs) {
    return result;
  }
  if (incomingExpiryTs >= currentEntitlement.expiresTs) {
    return result;
  }

  console.warn('[iap] ignoring stale entitlement result', {
    incomingExpiry: new Date(incomingExpiryTs).toISOString(),
    currentExpiry: new Date(currentEntitlement.expiresTs).toISOString(),
    incomingPurchaseId: result.purchase_id || '',
    currentPurchaseId: currentEntitlement.purchase_id || '',
    currentSource: currentEntitlement.source || ''
  });

  return {
    ...result,
    register_ok: currentEntitlement.expiresTs > Date.now(),
    purchase_expires: currentEntitlement.expiresTs,
    purchase_expires_human:
      currentEntitlement.human || new Date(currentEntitlement.expiresTs).toISOString(),
    purchase_id: currentEntitlement.purchase_id || result.purchase_id || '',
    merged_from_stale_result: true
  };
}

function persistPurchaseState(result) {
  const expiresTs = parsePurchaseExpiry(result && result.purchase_expires);
  const currentUserId =
    window.user && window.user.id !== undefined && window.user.id !== null
      ? String(window.user.id).trim()
      : '';
  try {
    if (result && expiresTs) {
      localStorage.setItem(PURCHASE_EXPIRES_STORAGE_KEY, String(expiresTs));
      localStorage.setItem(
        PURCHASE_EXPIRES_HUMAN_STORAGE_KEY,
        result.purchase_expires_human || new Date(expiresTs).toISOString()
      );
      if (currentUserId) {
        localStorage.setItem(PURCHASE_USER_ID_STORAGE_KEY, currentUserId);
      } else {
        localStorage.removeItem(PURCHASE_USER_ID_STORAGE_KEY);
      }
    }
  } catch (err) {
    console.error('[iap] error guardando expiracion local', err);
  }

  try {
    localStorage.setItem(
      LAST_IAP_RESULT_STORAGE_KEY,
      JSON.stringify({
        ...(result && typeof result === 'object' ? result : {}),
        user_id: currentUserId || null
      })
    );
  } catch (err) {
    console.error('[iap] error guardando ultimo resultado IAP', err);
  }
}

function buildUpdatedUserFromPurchase(currentUser, result) {
  if (!currentUser || typeof currentUser !== 'object') return currentUser;
  const nextUser = { ...currentUser };
  const expiresIso = purchaseExpiryToIso(result && result.purchase_expires);
  const hasPremium = Boolean(result && result.register_ok && isPremiumFromExpiryIso(expiresIso));

  if (expiresIso) {
    nextUser.expires_date = expiresIso;
    nextUser.expiresDate = expiresIso;
  }

  if (result && result.purchase_id) {
    nextUser.purchase_id = String(result.purchase_id);
  }

  if (result && result.register_ok) {
    nextUser.premium = hasPremium;
  } else if (expiresIso) {
    nextUser.premium = false;
    delete nextUser.purchase_id;
  }

  return nextUser;
}

window._trigger_gotPremium = (result) => {
  const safeResult = result && typeof result === 'object' ? { ...result } : { register_ok: false };
  if (window.user && window.user.id !== undefined && window.user.id !== null) {
    safeResult.user_id = String(window.user.id).trim();
  }
  const mergedResult = mergePremiumResultWithCurrentState(safeResult);
  const nextUser = buildUpdatedUserFromPurchase(window.user, mergedResult);

  window.__lastGotPremiumResult = mergedResult;
  persistPurchaseState(mergedResult);

  if (nextUser && typeof window.setUser === 'function') {
    window.setUser(nextUser);
  } else if (nextUser) {
    window.user = nextUser;
    window.dispatchEvent(new CustomEvent('app:user-change', { detail: nextUser }));
  }

  window.dispatchEvent(
    new CustomEvent('app:iap-premium-change', {
      detail: {
        result: mergedResult,
        user: nextUser || window.user || null
      }
    })
  );
};

window.getLastIapPremiumResult = () => {
  const currentUserId =
    window.user && window.user.id !== undefined && window.user.id !== null
      ? String(window.user.id).trim()
      : '';
  if (window.__lastGotPremiumResult) {
    const resultUserId =
      window.__lastGotPremiumResult.user_id !== undefined && window.__lastGotPremiumResult.user_id !== null
        ? String(window.__lastGotPremiumResult.user_id).trim()
        : '';
    if (currentUserId) return resultUserId === currentUserId ? window.__lastGotPremiumResult : null;
    return window.__lastGotPremiumResult;
  }
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_IAP_RESULT_STORAGE_KEY) || 'null');
    const storedUserId =
      stored && stored.user_id !== undefined && stored.user_id !== null
        ? String(stored.user_id).trim()
        : '';
    if (currentUserId && (!storedUserId || storedUserId !== currentUserId)) return null;
    return stored;
  } catch (_err) {
    return null;
  }
};

window.presentAppToast = (message, options = {}) => {
  const text = String(message || '').trim();
  if (!text) return;
  try {
    const toast = document.createElement('ion-toast');
    toast.message = text;
    const autoDismiss = options.autoDismiss === true || Number(options.duration) > 0;
    toast.duration = autoDismiss ? Number(options.duration) || 2200 : 0;
    toast.position = options.position || 'top';
    if (!autoDismiss) {
      toast.buttons = [
        {
          text: options.closeText || 'Cerrar',
          role: 'cancel'
        }
      ];
    }
    document.body.appendChild(toast);
    toast.present().catch(() => {});
    toast.addEventListener(
      'didDismiss',
      () => {
        toast.remove();
      },
      { once: true }
    );
  } catch (_err) {
    // no-op
  }
};

const IAP_SUPPORT_EMAIL = 'contact@sokinternet.com';

function getIapSupportUserSnapshot() {
  const user = window.user && typeof window.user === 'object' ? window.user : null;
  return {
    user_id:
      user && user.id !== undefined && user.id !== null
        ? String(user.id).trim()
        : window.user_id !== undefined && window.user_id !== null
        ? String(window.user_id).trim()
        : '',
    email: user && user.email ? String(user.email).trim() : '',
    premium: Boolean(user && user.premium),
    expires_date: user ? user.expires_date || user.expiresDate || '' : ''
  };
}

function normalizeIapSupportError(errorValue) {
  if (errorValue === undefined || errorValue === null) return '';
  if (typeof errorValue === 'string') return errorValue.trim();
  if (errorValue && typeof errorValue.message === 'string') return errorValue.message.trim();
  try {
    return JSON.stringify(errorValue);
  } catch (_err) {
    return String(errorValue);
  }
}

window.isIapOwnershipConflict = (value) => {
  const text = normalizeIapSupportError(value).toLowerCase();
  if (!text) return false;
  return (
    text.includes('owned_by_other_user') ||
    text.includes('purchase_owned_by_other_user') ||
    text.includes('already linked to another user') ||
    text.includes('already associated to another user') ||
    text.includes('already associated with another user') ||
    text.includes('already linked to another account') ||
    text.includes('already associated to another account') ||
    text.includes('belongs to another user') ||
    text.includes('belongs to another account')
  );
};

window.buildIapSupportPayload = (context = {}) => {
  const user = getIapSupportUserSnapshot();
  const lastResult =
    typeof window.getLastIapPremiumResult === 'function'
      ? window.getLastIapPremiumResult()
      : window.__lastGotPremiumResult || null;
  const lastDiagnosticsBackend =
    window.__iapDiagnosticsState && window.__iapDiagnosticsState.lastBackend
      ? window.__iapDiagnosticsState.lastBackend
      : null;
  const lastEvent = window.__lastIapStoreEvent || null;
  const platform =
    context.platform ||
    (lastDiagnosticsBackend && lastDiagnosticsBackend.platform) ||
    (lastEvent && lastEvent.platform) ||
    (window.Capacitor && typeof window.Capacitor.getPlatform === 'function'
      ? window.Capacitor.getPlatform()
      : 'unknown');
  const meta = window.appMeta || {};
  const version =
    meta.version || meta.appVersion || meta.versionName || meta.versionString || '';
  const build =
    meta.build || meta.appBuild || meta.buildNumber || meta.versionCode || '';
  const supportPayload = {
    issue: context.issue || 'iap_support_request',
    ownership_conflict: Boolean(
      context.ownership_conflict ||
      window.isIapOwnershipConflict(context.error) ||
      window.isIapOwnershipConflict(lastDiagnosticsBackend && lastDiagnosticsBackend.error) ||
      window.isIapOwnershipConflict(lastResult && lastResult.error)
    ),
    timestamp: new Date().toISOString(),
    user_id: context.user_id || user.user_id || '',
    user_email: context.user_email || user.email || '',
    platform: String(platform || '').trim(),
    product_id:
      context.product_id ||
      context.productId ||
      (lastDiagnosticsBackend && lastDiagnosticsBackend.productId) ||
      (lastEvent && lastEvent.productId) ||
      '',
    transaction_id:
      context.transaction_id ||
      context.transactionId ||
      (lastDiagnosticsBackend && lastDiagnosticsBackend.transactionId) ||
      (lastEvent && lastEvent.transactionId) ||
      '',
    purchase_id:
      context.purchase_id ||
      context.purchaseId ||
      (lastDiagnosticsBackend && lastDiagnosticsBackend.purchase_id) ||
      (lastResult && lastResult.purchase_id) ||
      '',
    purchase_expires:
      context.purchase_expires ||
      (lastDiagnosticsBackend && lastDiagnosticsBackend.purchase_expires) ||
      (lastResult && lastResult.purchase_expires) ||
      user.expires_date ||
      '',
    error:
      normalizeIapSupportError(context.error) ||
      normalizeIapSupportError(lastDiagnosticsBackend && lastDiagnosticsBackend.error) ||
      normalizeIapSupportError(lastResult && lastResult.error),
    source:
      context.source ||
      (lastDiagnosticsBackend && lastDiagnosticsBackend.source) ||
      (lastEvent && lastEvent.extra && lastEvent.extra.source) ||
      '',
    app_version: version || '',
    app_build: build || '',
    uuid: window.uuid || localStorage.getItem('uuid') || '',
    user_premium: user.premium,
    user_expires_date: user.expires_date || ''
  };
  return supportPayload;
};

window.formatIapSupportPayload = (payload) => {
  const data = payload && typeof payload === 'object' ? payload : window.buildIapSupportPayload();
  return [
    `issue: ${data.issue || 'iap_support_request'}`,
    `ownership_conflict: ${data.ownership_conflict ? 'yes' : 'no'}`,
    `timestamp: ${data.timestamp || ''}`,
    `user_id: ${data.user_id || ''}`,
    `user_email: ${data.user_email || ''}`,
    `platform: ${data.platform || ''}`,
    `product_id: ${data.product_id || ''}`,
    `transaction_id: ${data.transaction_id || ''}`,
    `purchase_id: ${data.purchase_id || ''}`,
    `purchase_expires: ${data.purchase_expires || ''}`,
    `source: ${data.source || ''}`,
    `user_premium: ${data.user_premium ? 'true' : 'false'}`,
    `user_expires_date: ${data.user_expires_date || ''}`,
    `app_version: ${data.app_version || ''}`,
    `app_build: ${data.app_build || ''}`,
    `uuid: ${data.uuid || ''}`,
    `error: ${data.error || ''}`
  ].join('\n');
};

window.copyIapSupportPayload = async (context = {}) => {
  const payload = window.buildIapSupportPayload(context);
  const text = window.formatIapSupportPayload(payload);
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    throw new Error('Clipboard API not available');
  }
  await navigator.clipboard.writeText(text);
  return payload;
};

window.openIapSupportMail = (context = {}) => {
  const payload = window.buildIapSupportPayload(context);
  const subjectParts = ['IAP support'];
  if (payload.ownership_conflict) subjectParts.push('ownership conflict');
  if (payload.product_id) subjectParts.push(payload.product_id);
  if (payload.user_id) subjectParts.push(`user ${payload.user_id}`);
  const subject = encodeURIComponent(subjectParts.join(' · '));
  const body = encodeURIComponent(window.formatIapSupportPayload(payload));
  window.location.href = `mailto:${IAP_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  return payload;
};

function applyAppChromeForPath(path) {
  console.log('[chrome] apply start', path, Date.now());
  syncPlatformChromeClasses();
  const onboarding = false;
  const labChrome = !onboarding && isLabChromePath(path);
  const statusbarPreset = getStoredStatusbarPreset();
  const color = labChrome
    ? LAB_STATUSBAR_COLOR
    : APP_STATUSBAR_COLOR;
  const themeColor = labChrome ? LAB_THEME_COLOR : color;
  const lightIcons = statusbarPreset === 'clear';
  const style = getStatusBarStyle(lightIcons);
  const chromeKey = [
    String(path || '').trim(),
    onboarding ? 'onboarding' : 'app',
    labChrome ? 'lab' : 'plain',
    statusbarPreset,
    color,
    lightIcons ? 'clear' : 'dark',
    getStoredLegacyChromeDebugEnabled() ? 'legacy-debug' : 'legacy-normal'
  ].join('|');
  if (_lastAppliedChromeKey === chromeKey) return;
  _lastAppliedChromeKey = chromeKey;
  console.log('[chrome] applyAppChromeForPath', JSON.stringify({ path, onboarding, labChrome, statusbarPreset, color, lightIcons, style }));

  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.appStatusbarPreset = statusbarPreset;
  document.body.classList.toggle('app-statusbar-items-clear', statusbarPreset === 'clear');
  document.body.classList.toggle('app-statusbar-items-dark', statusbarPreset !== 'clear');
  document.body.classList.toggle('onboarding-chrome-active', onboarding);
  document.body.classList.toggle('lab-chrome-active', labChrome);
  setThemeColor(themeColor);
  setNativeChrome(color, lightIcons, { source: 'app.js:applyAppChromeForPath', path });

  try {
    if (shouldDeferAndroidNativeChrome()) {
      scheduleAppTitlebarCalibration();
      return;
    }
    if (isLegacyAndroidStatusbarMode()) {
      scheduleAppTitlebarCalibration();
      return;
    }
    const sb = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.StatusBar : null;
    if (!sb) return;
    sb.setOverlaysWebView({ overlay: true });
    if (!isAndroidPlatform()) {
      sb.setBackgroundColor({ color });
      sb.setStyle({ style });
    }
  } catch (_err) {
    // no-op
  }
  scheduleAppTitlebarCalibration();
}

let _chromeSyncTimers = [];
function scheduleLegacyViewportRelayout() {
  if (!document.body.classList.contains('app-android-legacy-webview')) return;
}

function scheduleAppChromeSync(path) {
  _chromeSyncTimers.forEach((id) => clearTimeout(id));
  _chromeSyncTimers = [];
  applyAppChromeForPath(path);
  scheduleLegacyViewportRelayout();
}

window.applyAppChromeForPath = applyAppChromeForPath;
window.scheduleAppChromeSync = scheduleAppChromeSync;

function installIonContentDimensionGuard() {
  // Note: on old Android WebView, Stencil uses polyfill mode which registers a proxy wrapper
  // class. customElements.get('ion-content') returns that proxy, so patching its prototype
  // does NOT reach the real readDimensions on the actual component class. This guard blocks
  // resize-time recomputation on legacy Android so Ionic cannot rewrite --offset-top after
  // the screen has already painted correctly.
  const patchIonContentPrototype = (proto) => {
    if (!proto || proto.__speakDimensionGuard) return;
    const isLegacyAndroidNow = () => isLegacyAndroidStatusbarMode();
    const originalOnResize = typeof proto.onResize === 'function' ? proto.onResize : null;
    const originalResize = typeof proto.resize === 'function' ? proto.resize : null;
    const originalReadDimensions = typeof proto.readDimensions === 'function' ? proto.readDimensions : null;
    if (typeof proto.onResize === 'function') {
      proto.onResize = function guardedOnResize(...args) {
        if (isLegacyAndroidNow()) return;
        return originalOnResize ? originalOnResize.apply(this, args) : undefined;
      };
    }
    if (typeof proto.resize === 'function') {
      proto.resize = function guardedResize(...args) {
        if (isLegacyAndroidNow()) return;
        return originalResize ? originalResize.apply(this, args) : undefined;
      };
    }
    if (typeof originalReadDimensions === 'function') {
      proto.readDimensions = function guardedReadDimensions(...args) {
        if (isLegacyAndroidNow()) return;
        const el = this && this.el;
        const fallbackParent =
          el && el.parentElement
            ? el.parentElement
            : el && el.parentNode && el.parentNode.host
            ? el.parentNode.host
            : null;
        const container =
          el &&
          (el.closest('ion-tabs') ||
            el.closest('ion-app, ion-page, .ion-page, page-inner, .popover-content') ||
            fallbackParent);
        if (!container) return;
        try {
          return originalReadDimensions.apply(this, args);
        } catch (err) {
          if (err instanceof TypeError && String(err.message || '').includes('offsetHeight')) return;
          throw err;
        }
      };
    }
    proto.__speakDimensionGuard = true;
  };

  customElements.whenDefined('ion-content').then(() => {
    const IonContent = customElements.get('ion-content');
    patchIonContentPrototype(IonContent && IonContent.prototype);
    import('../vendor/ionic/p-aedf995b.entry.js')
      .then((mod) => {
        if (mod && mod.ion_content && mod.ion_content.prototype) {
          patchIonContentPrototype(mod.ion_content.prototype);
        }
      })
      .catch(() => {});
  });
}

installIonContentDimensionGuard();
ensureLegacySpeakCopyGlobals();
applyAppFontPreference();
applySystemBottomInsetDebugPreference();
applyDisplayZoomCompensationPreference();
syncNativeStatusBarCssHeight();
syncNativeSystemInsetsCssVarsWithRetries();
syncNativeDisplayZoomCompensationWithRetries();
syncAppViewportHeightVar();
refreshTranslationCapabilities().catch(() => {});
window.addEventListener('app:locale-change', (event) => {
  const nextLocale = event && event.detail ? event.detail.locale : '';
  syncTabsLocaleLabels(nextLocale);
});
requestAnimationFrame(() => {
  syncTabsLocaleLabels();
});

const routerReady = customElements.whenDefined('ion-router').then(() => document.querySelector('ion-router'));

if (new URLSearchParams(window.location.search).get('autologin') === '1') {
  setOnboardingDone();
}

const isLoggedInAtBoot = () => {
  const user = window.user;
  return Boolean(user && user.id !== undefined && user.id !== null);
};

const isLoggedInNow = () => {
  const user = window.user;
  return Boolean(user && user.id !== undefined && user.id !== null);
};

if (!onboardingDone() && !isLoggedInAtBoot()) {
  setLoginTabsLock();
}

routerReady.then((router) => {
  setRouter(router);
  ensureInitialHash();

  const hashPath = getCurrentAppPath();
  scheduleAppChromeSync(hashPath);
  if (hashPath === '/') goToHome('root');

  // On first launch (onboarding not done, not logged in), lock tabs before
  // tabs-page mounts so it initialises with 'tu' as active tab and tab bar hidden.
  if (!onboardingDone() && !isLoggedInAtBoot()) {
    setLoginTabsLock();
  }

  router.addEventListener('ionRouteWillChange', (event) => {
    const to = event.detail.to;
    if (!to) return;
    if (to === '/' || to === '/onboarding') {
      goToHome('root');
      return;
    }
    if (hasLoginTabsLock() && !isLoggedInNow() && to === '/speak') {
      goToHome('root');
      return;
    }
    if (to === '/tabs/speak') {
      router.push('/speak', 'root');
      return;
    }
    if (to.startsWith('/tabs/') && to !== '/tabs') {
      router.push('/tabs', 'root');
    }
  });

  router.addEventListener('ionRouteDidChange', (event) => {
    const to = event.detail.to;
    if (!to) return;
    scheduleAppChromeSync(to);
  });

  setupDiagnosticsModal();
  setupSecretDiagnostics(router);
  setupNotificationsModal();
  setupAppTitlebarToggle();
  setupNativeToastTopOffset();
  setupLoginModal();
  setupLoginNotificationsSeed();
  checkMagicToken();

  if (new URLSearchParams(window.location.search).get('autologin') === '1') {
    setTimeout(() => {
      if (typeof window.openLoginModal === 'function') {
        window.openLoginModal({ locked: false });
      }
    }, 400);
  }
});

document.addEventListener('deviceready', () => {
  scheduleViewportHeightSync();
  syncNativeSystemInsetsCssVarsWithRetries();
});

const resyncCurrentAppChrome = () => {
  _pendingChromeResyncPath = getCurrentAppPath();
  if (_pendingChromeResyncRaf) return;
  _pendingChromeResyncRaf = requestAnimationFrame(() => {
    _pendingChromeResyncRaf = 0;
    restoreAppChromeAfterForeground();
    _pendingChromeResyncPath = '';
  });
};

window.addEventListener('app:tab-change', (event) => {
  currentTabsActiveTab = normalizeChromeTabId(event && event.detail ? event.detail.tab : '');
});

document.addEventListener('ionTabsDidChange', (event) => {
  const eventTab = normalizeChromeTabId(event && event.detail ? event.detail.tab : '');
  currentTabsActiveTab = eventTab || getCurrentTabsActiveTab();
});

window.addEventListener('app:statusbar-preset-change', (event) => {
  const requestedPreset = event && event.detail ? event.detail.preset : undefined;
  if (requestedPreset !== undefined) {
    window.r34lp0w3r = window.r34lp0w3r || {};
    window.r34lp0w3r.appStatusbarPreset = normalizeStatusbarPreset(requestedPreset);
  }
  resyncCurrentAppChrome();
});

window.addEventListener('app:font-sf-pro-change', (event) => {
  applyAppFontPreference(event && event.detail ? event.detail.enabled : undefined);
});

window.addEventListener('app:system-bottom-inset-debug-change', (event) => {
  applySystemBottomInsetDebugPreference(event && event.detail ? event.detail.enabled : undefined);
  _lastAppliedChromeKey = '';
  scheduleAppChromeSync(getCurrentAppPath());
});

window.addEventListener('app:display-zoom-compensation-change', (event) => {
  applyDisplayZoomCompensationPreference(event && event.detail ? event.detail : {});
  _lastAppliedChromeKey = '';
  scheduleAppChromeSync(getCurrentAppPath());
});

window.addEventListener('app:legacy-chrome-debug-change', (event) => {
  applyLegacyChromeDebugPreference(event && event.detail ? event.detail.enabled : undefined);
  _lastAppliedChromeKey = '';
  scheduleAppChromeSync(getCurrentAppPath());
});

const handleGlobalViewportEvent = () => {
  scheduleViewportHeightSync();
  scheduleNativeSystemInsetsSync();
};
window.addEventListener('resize', blockLegacyViewportEvent, true);
window.addEventListener('resize', handleGlobalViewportEvent);
if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
  window.visualViewport.addEventListener('resize', blockLegacyViewportEvent, true);
  window.visualViewport.addEventListener('scroll', blockLegacyViewportEvent, true);
  window.visualViewport.addEventListener('resize', handleGlobalViewportEvent);
  window.visualViewport.addEventListener('scroll', handleGlobalViewportEvent);
}

function restoreAppChromeAfterForeground() {
  syncNativeSystemInsetsCssVars();
  if (typeof window.scheduleAppChromeSync === 'function') {
    window.scheduleAppChromeSync(getCurrentAppPath());
  } else {
    applyAppChromeForPath(getCurrentAppPath());
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    freezeLegacyViewportEvents();
    restoreAppChromeAfterForeground();
  }
});

try {
  const appPlugin = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.App : null;
  if (appPlugin && typeof appPlugin.addListener === 'function') {
    appPlugin.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      freezeLegacyViewportEvents();
      restoreAppChromeAfterForeground();
    });
  }
} catch (_err) {
  // no-op
}

function setupSecretDiagnostics(router) {
  const DIAG_UNLOCK_STATE_KEY = 'appv5:diag-unlock-state';
  const DIAG_UNLOCK_CODE_KEY = 'appv5:diag-unlock-code';
  const DIAG_UNLOCK_LEGACY_KEY = 'appv5:diag-unlocked';
  let lastTitleTapAt = 0;
  let lastVersionTapAt = 0;
  let versionTapCount = 0;
  let diagnosticsOpening = false;
  let unlockPromptOpen = false;
  let unlockValidationInFlight = false;
  const readUnlockState = () => {
    try {
      const raw = localStorage.getItem(DIAG_UNLOCK_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const code = String(parsed.code || localStorage.getItem(DIAG_UNLOCK_CODE_KEY) || '').trim();
      const expiresAtMs = Number(
        parsed.expiresAtMs || parsed.expires_at_ms || parsed.expiresAt || parsed.expires_at || 0
      );
      const expiresAtIso = String(parsed.expiresAtIso || parsed.expires_at_iso || parsed.expires_at || '').trim();
      const lastValidatedAtMs = Number(parsed.lastValidatedAtMs || parsed.last_validated_at_ms || 0);
      return {
        code,
        expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
        expiresAtIso,
        lastValidatedAtMs: Number.isFinite(lastValidatedAtMs) ? lastValidatedAtMs : 0
      };
    } catch (err) {
      return null;
    }
  };
  const getUnlockCode = () => {
    const state = readUnlockState();
    if (state && state.code) return state.code;
    try {
      return String(localStorage.getItem(DIAG_UNLOCK_CODE_KEY) || '').trim();
    } catch (err) {
      return '';
    }
  };
  const getUnlockExpiryMs = () => {
    const state = readUnlockState();
    if (state && Number.isFinite(state.expiresAtMs)) return state.expiresAtMs;
    return 0;
  };
  const writeUnlockState = ({ code, expiresAtMs, expiresAtIso }) => {
    const normalizedCode = String(code || '').trim();
    const normalizedExpiresAtMs = Number(expiresAtMs);
    const normalizedExpiresAtIso = String(expiresAtIso || '').trim();
    if (!normalizedCode || !Number.isFinite(normalizedExpiresAtMs) || normalizedExpiresAtMs <= 0) return false;
    const payload = {
      code: normalizedCode,
      expiresAtMs: normalizedExpiresAtMs,
      expiresAtIso: normalizedExpiresAtIso || new Date(normalizedExpiresAtMs).toISOString(),
      lastValidatedAtMs: Date.now()
    };
    try {
      localStorage.setItem(DIAG_UNLOCK_STATE_KEY, JSON.stringify(payload));
      localStorage.setItem(DIAG_UNLOCK_CODE_KEY, normalizedCode);
      localStorage.removeItem(DIAG_UNLOCK_LEGACY_KEY);
      return true;
    } catch (err) {
      console.warn('[diagnostics] no se pudo guardar el desbloqueo', err);
      return false;
    }
  };
  const clearUnlockState = () => {
    try {
      localStorage.removeItem(DIAG_UNLOCK_STATE_KEY);
      localStorage.removeItem(DIAG_UNLOCK_CODE_KEY);
      localStorage.removeItem(DIAG_UNLOCK_LEGACY_KEY);
    } catch (err) {
      // no-op
    }
  };
  const getApiBase = () =>
    (window.env === 'PRO' ? window.apiPRO : window.apiDEV) || window.apiDEV || window.apiPRO || '';
  const presentDiagnosticsMessage = (message) => {
    const text = String(message || '').trim();
    if (!text) return;
    if (typeof window.presentAppToast === 'function') {
      window.presentAppToast(text, { duration: 2400 });
      return;
    }
    console.info('[diagnostics]', text);
  };
  const fetchDiagnosticsUnlock = async (code, source = 'unknown', mode = 'issue') => {
    const normalizedCode = String(code || '').trim();
    const normalizedMode = String(mode || 'issue').trim().toLowerCase() === 'revalidate' ? 'revalidate' : 'issue';
    if (!normalizedCode) {
      throw new Error('missing_code');
    }
    const baseUrl = getApiBase();
    if (!baseUrl) {
      throw new Error('api_base_missing');
    }
    const response = await fetch(`${baseUrl}/diagnostics/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: normalizedCode,
        source,
        mode: normalizedMode
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.ok !== true) {
      throw new Error(data && data.error ? data.error : `http_${response.status}`);
    }
    const expiresAtMs = Number(data.expires_at_ms || Date.parse(data.expires_at || '') || 0);
    if (normalizedMode === 'issue') {
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        throw new Error('expired_unlock');
      }
      writeUnlockState({
        code: normalizedCode,
        expiresAtMs,
        expiresAtIso: String(data.expires_at || '').trim()
      });
      return {
        expiresAtMs,
        expiresAtIso: String(data.expires_at || '').trim(),
        revalidated: false
      };
    }
    const currentState = readUnlockState();
    const currentExpiryMs = currentState && Number.isFinite(currentState.expiresAtMs) ? currentState.expiresAtMs : 0;
    if (!currentExpiryMs || currentExpiryMs <= Date.now()) {
      throw new Error('expired_unlock');
    }
    return {
      expiresAtMs: currentExpiryMs,
      expiresAtIso: currentState && currentState.expiresAtIso ? currentState.expiresAtIso : '',
      revalidated: true
    };
  };
  const promptDiagnosticsUnlock = async ({ source = 'profile-version-taps' } = {}) => {
    if (unlockPromptOpen) return false;
    unlockPromptOpen = true;
    try {
      const currentCode = getUnlockCode();
      const currentExpiryMs = getUnlockExpiryMs();
      const expiresText =
        currentExpiryMs && currentExpiryMs > Date.now()
          ? new Date(currentExpiryMs).toLocaleString()
          : '';
      const hasIonAlert =
        window.customElements &&
        typeof window.customElements.get === 'function' &&
        Boolean(window.customElements.get('ion-alert'));
      const askCode = async () => {
        if (!hasIonAlert) {
          return window.prompt(
            expiresText
              ? `Desbloqueo de diagnósticos\n\nActivo hasta: ${expiresText}\n\nIntroduce el código`
              : 'Desbloqueo de diagnósticos\n\nIntroduce el código',
            currentCode || ''
          );
        }
        const alert = document.createElement('ion-alert');
        alert.header = 'Desbloquear diagnósticos';
        alert.message = expiresText
          ? `Activo hasta: ${expiresText}`
          : 'Introduce el código de desbloqueo.';
        alert.inputs = [
          {
            name: 'code',
            type: 'text',
            placeholder: 'Código',
            value: currentCode || '',
            attributes: {
              autocapitalize: 'off',
              autocorrect: 'off',
              spellcheck: 'false'
            }
          }
        ];
        alert.buttons = [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Validar', role: 'confirm' }
        ];
        document.body.appendChild(alert);
        await alert.present();
        const result = await alert.onDidDismiss();
        alert.remove();
        if (!result || result.role !== 'confirm') return null;
        const values = result.data && result.data.values ? result.data.values : {};
        return String(values.code || '').trim();
      };
      const code = String(await askCode() || '').trim();
      if (!code) return false;
      await fetchDiagnosticsUnlock(code, source, 'issue');
      const state = readUnlockState();
      const expiresForMessage =
        state && state.expiresAtMs && state.expiresAtMs > Date.now()
          ? new Date(state.expiresAtMs).toLocaleString()
          : '';
      presentDiagnosticsMessage(
        expiresForMessage ? `Diagnósticos desbloqueados hasta ${expiresForMessage}` : 'Diagnósticos desbloqueados'
      );
      return true;
    } catch (err) {
      clearUnlockState();
      const reason = err && err.message ? String(err.message) : 'unknown';
      if (reason !== 'cancel') {
        presentDiagnosticsMessage('Código inválido o expirado');
      }
      return false;
    } finally {
      unlockPromptOpen = false;
    }
  };
  const openDiagnostics = () => {
    if (diagnosticsOpening) return;
    diagnosticsOpening = true;
    if (typeof window.openDiagnosticsModal === 'function') {
      window.openDiagnosticsModal()
        .catch((err) => {
          console.error('[diagnostics] error abriendo modal', err);
        })
        .finally(() => {
          diagnosticsOpening = false;
        });
      return;
    }
    if (getCurrentAppPath() === '/diagnostics') {
      diagnosticsOpening = false;
      return;
    }
    ensureInitialHash();
    window.location.hash = '#/diagnostics';
  };
  const attemptOpenDiagnostics = async (source = 'double-tap') => {
    if (unlockValidationInFlight) return false;
    const code = getUnlockCode();
    if (!code) {
      return false;
    }
    unlockValidationInFlight = true;
    try {
      await fetchDiagnosticsUnlock(code, source, 'revalidate');
      openDiagnostics();
      return true;
    } catch (err) {
      clearUnlockState();
      // No hints here: if the unlock expired, fail silently.
      console.info('[diagnostics] unlock revalidation failed', err && err.message ? err.message : err);
      return false;
    } finally {
      unlockValidationInFlight = false;
    }
  };
  const resetDiagnosticsOpening = () => {
    diagnosticsOpening = false;
  };
  if (router && typeof router.addEventListener === 'function') {
    router.addEventListener('ionRouteDidChange', resetDiagnosticsOpening);
  }

  const onTitleTap = (event) => {
    const now = Date.now();
    const isDoubleTap = lastTitleTapAt && now - lastTitleTapAt <= 420;
    lastTitleTapAt = now;
    if (!isDoubleTap) return;
    lastTitleTapAt = 0;
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    attemptOpenDiagnostics('secret-content-double-tap');
  };

  // Selectors whose tap should NOT open diagnostics (they have their own behavior).
  const DIAG_EXCLUDED_SELECTOR = [
    // Bubbles with their own audio playback action
    '.onboarding-intro-bubble',
    '.free-ride-hero-bubble',
    '.journey-plan-bubble',
    '.speak-hero-bubble',
    '.hero-playable-bubble',
    // Main content cards (interactive in their own right)
    '.free-ride-card',
    '.chat-chat-card',
    '.profile-hero-card',
    '.profile-panel',
    '[data-diagnostics-unlock-version]',
    '.profile-app-meta',
    '#compat-version'
  ].join(',');
  const DIAG_VERSION_TRIGGER_SELECTOR = [
    '[data-diagnostics-unlock-version]',
    '.profile-app-meta',
    '#compat-version'
  ].join(',');

  const handler = (event) => {
    const path = event.composedPath ? event.composedPath() : [event.target];
    const hasClassInPath = (className) =>
      path.some((el) => el && el.classList && el.classList.contains(className));
    const hasInteractiveInPath = () =>
      path.some(
        (el) =>
          el &&
          typeof el.matches === 'function' &&
          el.matches('button, ion-button, ion-buttons, a, input, textarea, select, [role="button"], .app-header-actions')
      );
    const hasExcludedZoneInPath = () =>
      path.some(
        (el) =>
          el &&
          typeof el.matches === 'function' &&
          el.matches(DIAG_EXCLUDED_SELECTOR)
      );

    const isContentArea = hasClassInPath('secret-content');
    if (!isContentArea || hasInteractiveInPath() || hasExcludedZoneInPath()) return;
    const now = Date.now();
    const isDoubleTap = lastTitleTapAt && now - lastTitleTapAt <= 420;
    if (event) {
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (isDoubleTap && typeof event.preventDefault === 'function') event.preventDefault();
    }
    onTitleTap(event);
  };

  const versionTapHandler = (event) => {
    const path = event.composedPath ? event.composedPath() : [event.target];
    const hasProfileVersion = path.some(
      (el) =>
        el &&
        typeof el.matches === 'function' &&
        el.matches(DIAG_VERSION_TRIGGER_SELECTOR)
    );
    if (!hasProfileVersion) return;
    const now = Date.now();
    if (now - lastVersionTapAt > 1200) {
      versionTapCount = 0;
    }
    lastVersionTapAt = now;
    versionTapCount += 1;
    if (versionTapCount < 7) return;
    versionTapCount = 0;
    lastVersionTapAt = 0;
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    promptDiagnosticsUnlock({ source: 'profile-seven-taps' });
  };

  if (typeof window !== 'undefined' && 'PointerEvent' in window) {
    document.addEventListener('pointerup', handler, true);
    document.addEventListener('pointerup', versionTapHandler, true);
  } else {
    document.addEventListener('click', handler, true);
    document.addEventListener('click', versionTapHandler, true);
  }

  window.requestDiagnosticsUnlockPrompt = promptDiagnosticsUnlock;
}

function setupDiagnosticsModal() {
  let modal = null;

  const openDiagnosticsModal = async () => {
    if (!modal) {
      modal = document.createElement('ion-modal');
      modal.classList.add('diagnostics-modal');
      modal.component = 'page-diagnostics';
      modal.backdropDismiss = true;
      modal.keepContentsMounted = true;
      document.body.appendChild(modal);
    }
    if (modal.presented || modal.isOpen) {
      return;
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    syncNativeStatusBarCssHeight();
    syncNativeSystemInsetsCssVarsWithRetries();
    await modal.present();
  };

  window.openDiagnosticsModal = openDiagnosticsModal;
}

function setupNotificationsModal() {
  let modal = null;
  let lastUnread = getUnreadCount();
  const updateNotifyBadge = ({ silent = false } = {}) => {
    const unread = getUnreadCount();
    document.body.classList.toggle('has-unread-notify', unread > 0);
    if (!silent && unread > lastUnread && typeof window.playSpeakUiSound === 'function') {
      window.playSpeakUiSound('notification', { minGapMs: 450, forceRestart: true }).catch(() => {});
    }
    lastUnread = unread;
  };
  updateNotifyBadge({ silent: true });
  window.addEventListener('app:notifications-change', () => updateNotifyBadge());

  const openNotificationsModal = async () => {
    markAllNotificationsRead();
    updateNotifyBadge();
    if (!modal) {
      modal = document.createElement('ion-modal');
      modal.classList.add('notifications-modal');
      modal.component = 'page-notifications';
      modal.backdropDismiss = true;
      modal.keepContentsMounted = true;
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

  window.openNotificationsModal = openNotificationsModal;

  document.addEventListener('click', (event) => {
    const path = event.composedPath ? event.composedPath() : [event.target];
    const hasNotifyBtn = path.some(
      (el) => el && el.classList && el.classList.contains('app-notify-btn')
    );
    if (!hasNotifyBtn) return;
    openNotificationsModal().catch((err) => {
      console.error('[notifications] error abriendo modal', err);
    });
  });
}

function setupAppTitlebarToggle() {
  const refreshMountedPages = () => {
    const pages = new Set([
      ...document.querySelectorAll('ion-router-outlet > *'),
      ...document.querySelectorAll('ion-tabs ion-tab > *'),
      ...document.querySelectorAll('page-home, page-free-ride, page-reference, page-chat, page-profile, page-speak')
    ]);
    pages.forEach((pageEl) => {
      if (!pageEl || typeof pageEl.render !== 'function') return;
      if (pageEl.tagName && pageEl.tagName.toLowerCase() === 'page-diagnostics') return;
      try {
        pageEl.render();
      } catch (err) {
        console.warn('[app] no se pudo refrescar la titlebar en', pageEl.tagName, err);
      }
    });
  };

  const applyState = () => {
    const enabled = isAppTitlebarEnabled();
    document.body.classList.toggle('app-titlebar-enabled', enabled);
    document.querySelectorAll('ion-header.app-header-shell').forEach((headerEl) => {
      headerEl.hidden = !enabled;
    });
  };

  applyState();
  window.addEventListener('app:titlebar-enabled-change', () => {
    if (isLegacyAndroidStatusbarMode()) {
      applyState();
      return;
    }
    applyState();
    refreshMountedPages();
    applyState();
    if (typeof window.scheduleAppChromeSync === 'function') {
      window.scheduleAppChromeSync(getCurrentAppPath());
    } else {
      applyAppChromeForPath(getCurrentAppPath());
    }
  });
  window.addEventListener('app:notifications-enabled-change', () => {
    refreshMountedPages();
  });
}

function setupNativeToastTopOffset() {
  const applyOffset = (toastEl) => {
    if (!toastEl || !toastEl.style) return;
    const isNativePlatform =
      document.body.classList.contains('app-platform-android') ||
      document.body.classList.contains('app-platform-ios');
    if (!isNativePlatform) {
      toastEl.style.removeProperty('--ion-safe-area-top');
      toastEl.style.removeProperty('padding-top');
      toastEl.style.removeProperty('margin-top');
      return;
    }
    // Measure the actual rendered header height (includes safe-area inset on iOS)
    const headerEl = document.querySelector('ion-header.app-header-shell:not([hidden])');
    const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
    let offsetExpr;
    if (headerHeight > 0) {
      offsetExpr = `${headerHeight}px`;
    } else {
      const usesManualOffset = document.body.classList.contains('app-statusbar-manual-offset');
      offsetExpr = usesManualOffset
        ? 'var(--app-native-statusbar-height, env(safe-area-inset-top, 0px))'
        : 'env(safe-area-inset-top, 0px)';
    }
    toastEl.style.setProperty('--ion-safe-area-top', offsetExpr);
    toastEl.style.removeProperty('padding-top');
    toastEl.style.setProperty('margin-top', '0');
    toastEl.dataset.nativeTopOffset = headerHeight > 0 ? 'measured' : 'fallback';
  };

  const patchExistingToasts = () => {
    document.querySelectorAll('ion-toast').forEach((toastEl) => applyOffset(toastEl));
  };

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (!node || node.nodeType !== 1) return;
        if (node.tagName && node.tagName.toLowerCase() === 'ion-toast') {
          applyOffset(node);
          node.addEventListener('ionToastWillPresent', () => applyOffset(node), { once: true });
          return;
        }
        if (typeof node.querySelectorAll === 'function') {
          node.querySelectorAll('ion-toast').forEach((toastEl) => {
            applyOffset(toastEl);
            toastEl.addEventListener('ionToastWillPresent', () => applyOffset(toastEl), { once: true });
          });
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('app:titlebar-enabled-change', () => {
    if (isLegacyAndroidStatusbarMode()) return;
    patchExistingToasts();
  });
  patchExistingToasts();
}

function setupLoginModal() {
  let modal = null;
  const applyLoginModalLock = (locked) => {
    if (!modal) return;
    modal.dataset.locked = locked ? 'true' : 'false';
    modal.backdropDismiss = !locked;
    modal.canDismiss = !locked;
    window.dispatchEvent(new CustomEvent('app:login-modal-lock-change', { detail: { locked } }));
  };

  const openLoginModal = async (options = {}) => {
    if (!modal) {
      modal = document.querySelector('ion-modal.login-modal');
    }
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

    const hasExplicitLockedOption =
      options && Object.prototype.hasOwnProperty.call(options, 'locked');
    const locked = hasExplicitLockedOption
      ? Boolean(options.locked)
      : hasLoginTabsLock() && !isLoggedInNow();
    applyLoginModalLock(locked);

    if (modal.presented || modal.isOpen) {
      return;
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    await modal.present();
  };

  window.openLoginModal = openLoginModal;

  window.addEventListener('app:user-change', (event) => {
    const detail = event && event.detail ? event.detail : null;
    const loggedIn = Boolean(detail && detail.id !== undefined && detail.id !== null);
    if (loggedIn) {
      if (hasLoginTabsLock()) {
        clearLoginTabsLock();
        window.dispatchEvent(new CustomEvent('app:tabs-lock-change', { detail: { locked: false } }));
      }
      if (modal) {
        applyLoginModalLock(false);
        modal.dismiss().catch(() => {});
      }
      return;
    }

    setLoginTabsLock();
    try {
      localStorage.setItem(TAB_STORAGE_KEY, 'tu');
    } catch (_err) {
      // no-op
    }
    window.dispatchEvent(new CustomEvent('app:tabs-lock-change', { detail: { locked: true } }));
    if (modal) {
      applyLoginModalLock(true);
    }
  });
}

function checkMagicToken() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('magic_token');
    const uid   = params.get('magic_uid');
    if (!token || !uid) return;

    params.delete('magic_token');
    params.delete('magic_uid');
    const cleanUrl = window.location.pathname +
      (params.toString() ? '?' + params.toString() : '') +
      window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    if (typeof window.doPost !== 'function') {
      console.warn('[magic] doPost no disponible');
      return;
    }
    window.doPost('/auth/magic/exchange', null, { token, uid }).then(result => {
      if (!result || !result.ok) {
        console.warn('[magic] intercambio fallido:', result && result.data && result.data.error);
        return;
      }
      const user = result.data && result.data.user ? { ...result.data.user } : null;
      if (!user) { console.warn('[magic] sesión sin usuario'); return; }
      if (typeof window.setUser === 'function') {
        window.setUser(user);
      } else {
        window.user = user;
        try { localStorage.setItem('appv5:user', JSON.stringify(user)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: user }));
      }
    }).catch(err => console.warn('[magic] error en exchange:', err));
  } catch (err) {
    console.warn('[magic] error procesando magic_token:', err);
  }
}

function setupLoginNotificationsSeed() {
  const resetProfileTabOnLogin = () => {
    window.r34lp0w3r = window.r34lp0w3r || {};
    window.r34lp0w3r.profileActiveTab = 'prefs';
    window.r34lp0w3r.profileForceTab = null;
    try {
      localStorage.setItem('appv5:profile-tab', 'prefs');
    } catch (err) {
      // no-op
    }
  };

  let lastUserId = '';
  try {
    const user = window.user;
    if (user && user.id !== undefined && user.id !== null) {
      lastUserId = String(user.id);
    }
  } catch (err) {
    lastUserId = '';
  }

  window.addEventListener('app:user-change', (event) => {
    const detail = event && event.detail ? event.detail : null;
    const nextId =
      detail && detail.id !== undefined && detail.id !== null ? String(detail.id) : '';
    const isLogin = !lastUserId && nextId;
    lastUserId = nextId;
    if (isLogin) {
      resetProfileTabOnLogin();
    }
  });
}

try {
  if (typeof window.__hideCompatGuard === 'function') {
    window.__hideCompatGuard();
  }
  window.dispatchEvent(new CustomEvent('app:ui-ready'));
} catch (_err) {
  // no-op
}
