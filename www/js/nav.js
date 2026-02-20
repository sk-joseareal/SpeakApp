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

  if (onboardingDone()) {
    if (!hash || hash === '/') {
      window.location.hash = '/tabs';
    }
    return;
  }

  if (hash !== '/onboarding') {
    window.location.hash = '/onboarding';
  }
};
