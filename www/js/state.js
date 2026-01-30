const ONBOARDING_KEY = 'appv5:onboarding-done';

export const onboardingDone = () => localStorage.getItem(ONBOARDING_KEY) === 'yes';
export const setOnboardingDone = () => localStorage.setItem(ONBOARDING_KEY, 'yes');
