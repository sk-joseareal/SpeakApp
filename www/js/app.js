import { ensureInitialHash, setRouter, goToHome } from './nav.js';
import { onboardingDone } from './state.js';
import './pages/onboarding.js';
import './pages/home.js';
import './pages/listas.js';
import './pages/speak.js';
import './pages/profile.js';
import './pages/premium.js';
import './pages/tabs.js';
import './pages/diagnostics.js';
import './pages/login.js';

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
});

function setupSecretDiagnostics(router) {
  const sequence = [
    { target: 'title', needed: 3, count: 0 },
    { target: 'content', needed: 3, count: 0 },
    { target: 'title', needed: 3, count: 0 }
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
