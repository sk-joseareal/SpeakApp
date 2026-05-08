import { onboardingDone } from './state.js';

let routerRef = null;

export const setRouter = (router) => {
  routerRef = router;
};

export const goToHome = async (direction = 'forward') => {
  if (!routerRef) return;
  routerRef.push('/tabs', direction);
};

export const goToSpeak = async (direction = 'forward') => {
  if (!routerRef) return;
  routerRef.push('/speak', direction);
};

export const ensureInitialHash = () => {
  const hash = window.location.hash.replace('#', '');

  // Redirect non-app hashes (diagnostics, login, empty) to /tabs.
  // /onboarding stays accessible directly for testing.
  if (!hash || hash === '/' || hash === '/diagnostics' || hash === '/login') {
    window.location.hash = '/tabs';
    return;
  }

  if (onboardingDone() && hash === '/onboarding') {
    window.location.hash = '/tabs';
  }
};
