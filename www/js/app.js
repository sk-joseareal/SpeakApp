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

  const hashPath = window.location.hash.replace('#', '') || '/';
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

function setupSecretDiagnostics(router) {
  const DIAG_UNLOCK_KEY = 'appv5:diag-unlocked';
  let titleTapCount = 0;
  let titleTapTimer = null;
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
    router?.push('/diagnostics', 'forward');
  };
  const resetTitleTap = () => {
    titleTapCount = 0;
    if (titleTapTimer) {
      clearTimeout(titleTapTimer);
      titleTapTimer = null;
    }
  };
  const onTitleTap = () => {
    titleTapCount += 1;
    if (titleTapCount >= 2) {
      const alreadyUnlocked = readUnlocked();
      resetTitleTap();
      if (!alreadyUnlocked) {
        writeUnlocked();
      }
      openDiagnostics();
      return;
    }
    if (titleTapTimer) {
      clearTimeout(titleTapTimer);
    }
    titleTapTimer = setTimeout(() => {
      resetTitleTap();
    }, 700);
  };

  const handler = (event) => {
    const path = event.composedPath ? event.composedPath() : [event.target];
    const hasClassInPath = (className) =>
      path.some((el) => el && el.classList && el.classList.contains(className));

    const isTitle = hasClassInPath('secret-title');
    if (!isTitle) return;
    onTitleTap();
  };

  document.addEventListener('click', handler);
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
