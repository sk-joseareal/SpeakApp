const SUPPORTED_LOCALES = new Set(['es', 'en']);

export const LOCALE_META = {
  es: {
    code: 'es',
    label: 'Spanish',
    flag: 'assets/flags/spain.png',
    alt: 'Spanish',
    ttsLang: 'es-ES'
  },
  en: {
    code: 'en',
    label: 'English',
    flag: 'assets/flags/eeuu.png',
    alt: 'English',
    ttsLang: 'en-US'
  }
};

const APP_COPY = {
  es: {
    onboarding: {
      brand: 'SPEAK English',
      skip: 'Saltar',
      cta: "Let's go!",
      toggleLanguage: 'Cambiar idioma a {lang}',
      slides: {
        intro: {
          title: 'SAY like a Native',
          messageHtml:
            'Hola, vamos a enseñarte a <strong>entrenar tu pronunciación</strong> y a hablar inglés con naturalidad.',
          points: ['Y tu inglés sonará mejor', 'Tu confianza aumentará']
        },
        level: {
          title: 'SAY like a Native',
          messageHtml: 'Este es tu plan para mejorar pronunciación paso a paso en 48 días.',
          points: [
            'Sesiones cortas cada día',
            'Escucha, repite y grábate',
            'Mejora con feedback inmediato'
          ]
        },
        topics: {
          title: 'SAY like a Native',
          messageHtml: '¿Cuál es tu lengua materna?'
        }
      }
    },
    home: {
      planTitle: 'Tu plan',
      planMessage: 'Este es tu plan para sonar como nativo.',
      toggleLanguage: 'Cambiar idioma a {lang}'
    },
    freeRide: {
      tabLabel: 'Free ride',
      title: 'Free ride',
      subtitle: 'Escribe tu frase o texto y practica pronunciacion libre.',
      inputLabel: 'Tu frase',
      inputPlaceholder: 'Ejemplo: I would like to order a coffee, please.',
      emptyPhrase: 'Escribe una frase para practicar.',
      toggleLanguage: 'Cambiar idioma a {lang}',
      playPhrase: 'Escuchar frase',
      sayLabel: 'Say',
      endLabel: 'End',
      yourVoiceLabel: 'Your voice',
      feedbackHint: 'Practica la frase',
      feedbackNative: 'Suena como un nativo',
      feedbackGood: 'Bien. Sigue practicando',
      feedbackAlmost: 'Casi correcto',
      feedbackKeep: 'Sigue practicando',
      transcribing: 'Transcribiendo...'
    }
  },
  en: {
    onboarding: {
      brand: 'SPEAK English',
      skip: 'Skip',
      cta: "Let's go!",
      toggleLanguage: 'Switch language to {lang}',
      slides: {
        intro: {
          title: 'SAY like a Native',
          messageHtml:
            'Hi, we are going to teach you to <strong>train your pronunciation</strong> and speak English naturally.',
          points: ['Your English will sound better', 'Your confidence will grow']
        },
        level: {
          title: 'SAY like a Native',
          messageHtml: 'This is your step-by-step plan to improve pronunciation in 48 days.',
          points: [
            'Short daily sessions',
            'Listen, repeat, and record yourself',
            'Improve with instant feedback'
          ]
        },
        topics: {
          title: 'SAY like a Native',
          messageHtml: 'What is your native language?'
        }
      }
    },
    home: {
      planTitle: 'Your plan',
      planMessage: 'This is your plan to sound like a native.',
      toggleLanguage: 'Switch language to {lang}'
    },
    freeRide: {
      tabLabel: 'Free ride',
      title: 'Free ride',
      subtitle: 'Write your own phrase or longer text and practice freely.',
      inputLabel: 'Your phrase',
      inputPlaceholder: 'Example: I would like to order a coffee, please.',
      emptyPhrase: 'Write a phrase to practice.',
      toggleLanguage: 'Switch language to {lang}',
      playPhrase: 'Play phrase',
      sayLabel: 'Say',
      endLabel: 'End',
      yourVoiceLabel: 'Your voice',
      feedbackHint: 'Practice the phrase',
      feedbackNative: 'You sound like a native',
      feedbackGood: 'Good! Continue practicing',
      feedbackAlmost: 'Almost Correct!',
      feedbackKeep: 'Keep practicing',
      transcribing: 'Transcribing...'
    }
  }
};

export const normalizeLocale = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  return SUPPORTED_LOCALES.has(normalized) ? normalized : '';
};

export const resolveLocale = (locale, fallback = 'en') => {
  const normalized = normalizeLocale(locale);
  if (normalized) return normalized;
  const fallbackLocale = normalizeLocale(fallback);
  return fallbackLocale || 'en';
};

export const getLocaleMeta = (locale) => {
  const resolved = resolveLocale(locale);
  return LOCALE_META[resolved] || LOCALE_META.en;
};

export const getNextLocaleCode = (locale) => {
  const resolved = resolveLocale(locale);
  return resolved === 'en' ? 'es' : 'en';
};

export const getCopyBundle = (locale) => {
  const resolved = resolveLocale(locale);
  return APP_COPY[resolved] || APP_COPY.en;
};

export const getOnboardingCopy = (locale) => getCopyBundle(locale).onboarding;

export const getHomeCopy = (locale) => getCopyBundle(locale).home;

export const getFreeRideCopy = (locale) => getCopyBundle(locale).freeRide;
