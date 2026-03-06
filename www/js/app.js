import { ensureInitialHash, setRouter, goToHome } from './nav.js';
import { clearLoginTabsLock, hasLoginTabsLock, onboardingDone, setLoginTabsLock } from './state.js';
import { generateDemoNotifications, getUnreadCount, markAllNotificationsRead } from './notifications-store.js';
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

const routerReady = customElements.whenDefined('ion-router').then(() => document.querySelector('ion-router'));

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
  setupLoginModal();
  setupLoginNotificationsSeed();
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

    const locked = Boolean(options && options.locked) || (hasLoginTabsLock() && !isLoggedIn());
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
