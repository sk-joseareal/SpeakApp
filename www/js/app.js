import { ensureInitialHash, setRouter, goToHome } from './nav.js';
import { clearLoginTabsLock, getAppLocale, hasLoginTabsLock, onboardingDone, setOnboardingDone, setLoginTabsLock } from './state.js';
import { generateDemoNotifications, getUnreadCount, markAllNotificationsRead } from './notifications-store.js';
import { ensureLegacySpeakCopyGlobals, getAppHeaderCopy } from './content/copy.js';
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

const ONBOARDING_STATUSBAR_COLOR = '#2d6df0';
const APP_STATUSBAR_COLOR = '#f4f6fb';
const PURCHASE_EXPIRES_STORAGE_KEY = '_purchase_expires';
const PURCHASE_EXPIRES_HUMAN_STORAGE_KEY = '_purchase_expires_human';
const PURCHASE_USER_ID_STORAGE_KEY = '_purchase_user_id';
const LAST_IAP_RESULT_STORAGE_KEY = 'appv5:last-got-premium-result';

function getCurrentAppPath() {
  return window.location.hash.replace('#', '') || '/';
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

function setNativeChrome(color, lightIcons, meta = {}) {
  try {
    const nativePlugin = window.Capacitor?.Plugins?.P4w4Plugin;
    if (!nativePlugin || typeof nativePlugin.setNativeChrome !== 'function') return;
    nativePlugin.setNativeChrome({
      backgroundColor: color,
      lightIcons,
      source: meta && meta.source ? meta.source : '',
      path: meta && meta.path ? meta.path : ''
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

function isOnboardingPath(path) {
  const normalized = String(path || '').trim();
  return normalized === '/' || normalized === '/onboarding';
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
  // If the user has completed onboarding, '/' is always a transient router state
  // before redirecting to '/tabs' — never apply onboarding chrome in that case.
  const onboarding = isOnboardingPath(path) && !onboardingDone();
  const color = onboarding ? ONBOARDING_STATUSBAR_COLOR : APP_STATUSBAR_COLOR;
  const lightIcons = onboarding;
  const style = getStatusBarStyle(lightIcons);
  console.log('[chrome] applyAppChromeForPath', JSON.stringify({ path, onboarding, color, lightIcons, style }));

  document.body.classList.toggle('onboarding-chrome-active', onboarding);
  setThemeColor(color);
  setNativeChrome(color, lightIcons, { source: 'app.js:applyAppChromeForPath', path });

  try {
    const sb = window.Capacitor?.Plugins?.StatusBar;
    if (!sb) return;
    sb.setOverlaysWebView({ overlay: true });
    if (!isAndroidPlatform()) {
      sb.setBackgroundColor({ color });
      sb.setStyle({ style });
    }
  } catch (_err) {
    // no-op
  }
}

let _chromeSyncTimers = [];
function scheduleAppChromeSync(path) {
  _chromeSyncTimers.forEach((id) => clearTimeout(id));
  console.log('[chrome] scheduleAppChromeSync', JSON.stringify({ path, delays: [0, 120, 320, 800] }));
  _chromeSyncTimers = [0, 120, 320, 800].map((delay) =>
    setTimeout(() => applyAppChromeForPath(path), delay)
  );
}

window.applyAppChromeForPath = applyAppChromeForPath;
window.scheduleAppChromeSync = scheduleAppChromeSync;

function installIonContentDimensionGuard() {
  customElements.whenDefined('ion-content').then(() => {
    const IonContent = customElements.get('ion-content');
    const proto = IonContent && IonContent.prototype;
    if (!proto || typeof proto.readDimensions !== 'function' || proto.__speakDimensionGuard) return;
    const readDimensions = proto.readDimensions;
    proto.readDimensions = function guardedReadDimensions(...args) {
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
        return readDimensions.apply(this, args);
      } catch (err) {
        if (err instanceof TypeError && String(err.message || '').includes('offsetHeight')) return;
        throw err;
      }
    };
    proto.__speakDimensionGuard = true;
  });
}

installIonContentDimensionGuard();
ensureLegacySpeakCopyGlobals();

const routerReady = customElements.whenDefined('ion-router').then(() => document.querySelector('ion-router'));

if (new URLSearchParams(window.location.search).get('autologin') === '1') {
  setOnboardingDone();
}

routerReady.then((router) => {
  setRouter(router);
  ensureInitialHash();

  const hashPath = getCurrentAppPath();
  scheduleAppChromeSync(hashPath);
  if (onboardingDone() && (hashPath === '/' || hashPath === '/onboarding')) {
    goToHome('root');
  }
  if (!onboardingDone() && (hashPath.startsWith('/tabs') || hashPath === '/speak')) {
    router.push('/onboarding', 'root');
  }

  const isLoggedIn = () => {
    const user = window.user;
    return Boolean(user && user.id !== undefined && user.id !== null);
  };

  router.addEventListener('ionRouteWillChange', (event) => {
    const to = event.detail.to;
    if (!to) return;
    scheduleAppChromeSync(to);
    if (onboardingDone() && (to === '/' || to === '/onboarding')) {
      goToHome('root');
      return;
    }
    if (!onboardingDone() && (to.startsWith('/tabs') || to === '/speak')) {
      router.push('/onboarding', 'root');
      return;
    }
    if (hasLoginTabsLock() && !isLoggedIn() && to === '/speak') {
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
  setupRewardBadgeInfoToasts();
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
  // Use a small delay so ensureInitialHash() has settled the URL before syncing chrome.
  setTimeout(() => scheduleAppChromeSync(getCurrentAppPath()), 200);
});

const resyncCurrentAppChrome = () => {
  scheduleAppChromeSync(getCurrentAppPath());
};

document.addEventListener('resume', resyncCurrentAppChrome);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    resyncCurrentAppChrome();
  }
});

try {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (appPlugin && typeof appPlugin.addListener === 'function') {
    appPlugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        resyncCurrentAppChrome();
      }
    });
  }
} catch (_err) {
  // no-op
}

function setupSecretDiagnostics(router) {
  const DIAG_UNLOCK_KEY = 'appv5:diag-unlocked';
  let lastTitleTapAt = 0;
  let diagnosticsOpening = false;
  const readUnlocked = () => {
    try {
      return localStorage.getItem(DIAG_UNLOCK_KEY) === 'yes';
    } catch (err) {
      return false;
    }
  };
  const writeUnlocked = () => {
    try {
      localStorage.setItem(DIAG_UNLOCK_KEY, 'yes');
    } catch (err) {
      // no-op
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
  const resetDiagnosticsOpening = () => {
    diagnosticsOpening = false;
  };
  router?.addEventListener('ionRouteDidChange', resetDiagnosticsOpening);

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
    const alreadyUnlocked = readUnlocked();
    if (!alreadyUnlocked) {
      writeUnlocked();
    }
    openDiagnostics();
  };

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

    const isSecretArea = hasClassInPath('secret-title-area') || hasClassInPath('secret-title');
    if (!isSecretArea || hasInteractiveInPath()) return;
    const now = Date.now();
    const isDoubleTap = lastTitleTapAt && now - lastTitleTapAt <= 420;
    if (event) {
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (isDoubleTap && typeof event.preventDefault === 'function') event.preventDefault();
    }
    onTitleTap(event);
  };

  if (typeof window !== 'undefined' && 'PointerEvent' in window) {
    document.addEventListener('pointerup', handler, true);
  } else {
    document.addEventListener('click', handler, true);
  }
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

function setupRewardBadgeInfoToasts() {
  const isUnitRewardKind = (rewardKind) => {
    const normalized = String(rewardKind || '').trim().toLowerCase();
    return (
      normalized === 'reference-unit-ribbon' ||
      normalized === 'ribbon' ||
      normalized === 'medal'
    );
  };

  const isInteractiveRewardKind = (rewardKind) => {
    const normalized = String(rewardKind || '').trim().toLowerCase();
    return normalized === 'trophy' || isUnitRewardKind(normalized);
  };

  const presentRewardToast = (message) => {
    const text = String(message || '').trim();
    if (!text) return;
    try {
      const toast = document.createElement('ion-toast');
      toast.message = text;
      toast.duration = 2200;
      toast.position = 'top';
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

  const getRewardCount = (targetKind) => {
    const normalizedTarget = String(targetKind || '').trim().toLowerCase();
    if (!normalizedTarget) return 0;
    const rewards =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : {};
    return Object.values(rewards).reduce((sum, entry) => {
      if (!entry || typeof entry.rewardQty !== 'number') return sum;
      const icon = String(entry.rewardIcon || 'diamond').trim().toLowerCase();
      const group = String(entry.rewardGroup || icon).trim().toLowerCase();
      if (group !== normalizedTarget) return sum;
      return sum + Math.max(0, Math.round(entry.rewardQty));
    }, 0);
  };

  const buildRewardMessage = (rewardKind, count) => {
    const locale = getAppLocale() || (window.varGlobal && window.varGlobal.locale) || 'en';
    const copy = getAppHeaderCopy(locale);
    const template =
      isUnitRewardKind(rewardKind)
        ? count === 1
          ? copy.completedUnitsOne
          : copy.completedUnitsOther
        : count === 1
        ? copy.completedModulesOne
        : copy.completedModulesOther;
    return String(template || '').replace('{n}', String(count));
  };

  const handleRewardBadgeInfoRequest = (badgeEl) => {
    if (!badgeEl) return;
    const rewardKind = String(badgeEl.dataset.rewardKind || '')
      .trim()
      .toLowerCase();
    const iconName =
      String(badgeEl.dataset.rewardIcon || '')
        .trim()
        .toLowerCase() ||
      String(badgeEl.querySelector('ion-icon')?.getAttribute('name') || '')
        .trim()
        .toLowerCase();
    const targetKind = rewardKind || iconName;
    if (!isInteractiveRewardKind(targetKind)) return;
    const rewardCount = Math.max(0, getRewardCount(targetKind));
    if (!rewardCount) return;
    presentRewardToast(buildRewardMessage(targetKind, rewardCount));
  };

  document.addEventListener('click', (event) => {
    const path = event.composedPath ? event.composedPath() : [event.target];
    const rewardBadge = path.find(
      (el) => el && el.classList && el.classList.contains('reward-badge')
    );
    if (!rewardBadge) return;
    handleRewardBadgeInfoRequest(rewardBadge);
  });

  document.addEventListener('keydown', (event) => {
    if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
    const target = event.target;
    if (!target || !target.classList || !target.classList.contains('reward-badge')) return;
    event.preventDefault();
    handleRewardBadgeInfoRequest(target);
  });
}

function setupLoginModal() {
  let modal = null;
  const isLoggedIn = () => {
    const user = window.user;
    return Boolean(user && user.id !== undefined && user.id !== null);
  };

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
      : hasLoginTabsLock() && !isLoggedIn();
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
      generateDemoNotifications();
    }
  });
}
