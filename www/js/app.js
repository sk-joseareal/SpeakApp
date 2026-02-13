import { ensureInitialHash, setRouter, goToHome } from './nav.js';
import { onboardingDone } from './state.js';
import { generateDemoNotifications, getUnreadCount, markAllNotificationsRead } from './notifications-store.js';
import './pages/onboarding.js';
import './pages/home.js';
import './pages/listas.js';
import './pages/speak.js';
import './pages/profile.js';
import './pages/premium.js';
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
  if (!onboardingDone() && hashPath.startsWith('/tabs')) {
    router.push('/onboarding', 'root');
  }

  router.addEventListener('ionRouteWillChange', (event) => {
    const to = event.detail.to;
    if (!to) return;
    if (onboardingDone() && (to === '/' || to === '/onboarding')) {
      goToHome('root');
      return;
    }
    if (!onboardingDone() && to.startsWith('/tabs')) {
      router.push('/onboarding', 'root');
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
  const sequence = [
    { target: 'title', needed: 2, count: 0 },
    { target: 'content', needed: 2, count: 0 },
    { target: 'title', needed: 1, count: 0 }
  ];
  let step = 0;
  const reset = () => {
    step = 0;
    sequence.forEach((s) => (s.count = 0));
  };

  const handler = (event) => {
    const path = event.composedPath ? event.composedPath() : [event.target];
    const hasClassInPath = (className) =>
      path.some((el) => el && el.classList && el.classList.contains(className));

    const isTitle = hasClassInPath('secret-title');
    const isContent = hasClassInPath('secret-content');
    const expected = sequence[step];

    const matched =
      (expected.target === 'title' && isTitle) ||
      (expected.target === 'content' && isContent);

    if (!matched) {
      reset();
      return;
    }

    expected.count += 1;
    if (expected.count >= expected.needed) {
      step += 1;
      if (step >= sequence.length) {
        reset();
        router?.push('/diagnostics', 'forward');
        return;
      }
    }
  };

  document.addEventListener('click', handler);
}

function setupNotificationsModal() {
  let modal = null;
  const updateNotifyBadge = () => {
    const unread = getUnreadCount();
    document.body.classList.toggle('has-unread-notify', unread > 0);
  };
  updateNotifyBadge();
  window.addEventListener('app:notifications-change', updateNotifyBadge);

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
  const openLoginModal = async () => {
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

    if (modal.presented || modal.isOpen) {
      return;
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    await modal.present();
  };

  window.openLoginModal = openLoginModal;
}

function setupLoginNotificationsSeed() {
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
      generateDemoNotifications();
    }
  });
}
