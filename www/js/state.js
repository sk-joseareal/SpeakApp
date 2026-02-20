const ONBOARDING_KEY = 'appv5:onboarding-done';
const APP_LOCALE_KEY = 'appv5:locale';
const LOGIN_TABS_LOCK_KEY = 'appv5:login-tabs-lock';
const ALLOWED_LOCALES = new Set(['es', 'en']);

export const onboardingDone = () => localStorage.getItem(ONBOARDING_KEY) === 'yes';
export const setOnboardingDone = () => localStorage.setItem(ONBOARDING_KEY, 'yes');
export const clearOnboardingDone = () => localStorage.removeItem(ONBOARDING_KEY);

export const getAppLocale = () => {
  const raw = String(localStorage.getItem(APP_LOCALE_KEY) || '').trim().toLowerCase();
  return ALLOWED_LOCALES.has(raw) ? raw : '';
};

export const setAppLocale = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  if (!ALLOWED_LOCALES.has(normalized)) return;
  localStorage.setItem(APP_LOCALE_KEY, normalized);
};

export const hasLoginTabsLock = () => localStorage.getItem(LOGIN_TABS_LOCK_KEY) === 'yes';
export const setLoginTabsLock = () => localStorage.setItem(LOGIN_TABS_LOCK_KEY, 'yes');
export const clearLoginTabsLock = () => localStorage.removeItem(LOGIN_TABS_LOCK_KEY);
