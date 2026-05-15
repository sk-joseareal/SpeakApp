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
  if (!hash || hash === '/' || hash === '/diagnostics' || hash === '/login') {
    window.location.hash = '/tabs';
    return;
  }

  if (hash === '/onboarding') {
    window.location.hash = '/tabs';
  }
};
