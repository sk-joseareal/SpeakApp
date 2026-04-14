import { getAppLocale, setAppLocale, getActiveLocale, getLocaleOverride, setLocaleOverride, clearLocaleOverride } from '../state.js';
import { renderAppHeader } from '../components/app-header.js';
import { ensureTrainingData, getRoutes, setSelection } from '../data/training-data.js';
import { ensureReferenceData, getLocalizedMapField, getReferenceCourses } from '../data/reference-data.js';
import {
  ensureReferenceTestsData,
  getLocalizedReferenceTestValue,
  getReferenceTestCourses
} from '../data/reference-tests.js';
import { getNextLocaleCode, getProfileCopy, getTabsCopy, resolveLocale } from '../content/copy.js';
import { goToSpeak } from '../nav.js';

const REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX = 'appv5:reference-tests-progress';

class PageProfile extends HTMLElement {
  notifyChromeState() {
    const user = window.user;
    const loggedIn = Boolean(user && user.id !== undefined && user.id !== null);
    const tabsPage = document.querySelector('tabs-page');
    if (tabsPage && tabsPage.classList) {
      tabsPage.classList.toggle('profile-auth-tabs-hidden', !loggedIn);
    }
    window.dispatchEvent(
      new CustomEvent('app:profile-auth-view-change', {
        detail: { hideTabBar: !loggedIn }
      })
    );
  }

  connectedCallback() {
    this.classList.add('ion-page');
    if (!this.activeTab) {
      this.activeTab = 'progress';
    }
    if (!this.reviewTone) {
      const storedTone = window.r34lp0w3r && window.r34lp0w3r.profileReviewTone;
      this.reviewTone = storedTone === 'okay' ? 'okay' : 'bad';
    }
    this.render();
    this.notifyChromeState();
    this._userHandler = (e) => {
      const u = e && e.detail && typeof e.detail === 'object' ? e.detail : null;
      if (u && u.locale && !getLocaleOverride()) {
        setAppLocale(u.locale);
        if (window.varGlobal && typeof window.varGlobal === 'object') {
          window.varGlobal.locale = u.locale;
        }
      }
      this.render();
      this.notifyChromeState();
    };
    this._storesHandler = () => this.render();
    this._localeHandler = () => this.render();
    window.addEventListener('app:user-change', this._userHandler);
    window.addEventListener('app:speak-stores-change', this._storesHandler);
    window.addEventListener('app:locale-change', this._localeHandler);
  }

  disconnectedCallback() {
    const tabsPage = document.querySelector('tabs-page');
    if (tabsPage && tabsPage.classList) {
      tabsPage.classList.remove('profile-auth-tabs-hidden');
    }
    window.dispatchEvent(
      new CustomEvent('app:profile-auth-view-change', {
        detail: { hideTabBar: false }
      })
    );
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._storesHandler) {
      window.removeEventListener('app:speak-stores-change', this._storesHandler);
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
    }
    if (this._metaHandler) {
      window.removeEventListener('app:meta-change', this._metaHandler);
    }
  }

  render() {
    const platform =
      window.r34lp0w3r && typeof window.r34lp0w3r.platform === 'string'
        ? String(window.r34lp0w3r.platform).trim().toLowerCase()
        : '';
    const persistProfileTab = (tab) => {
      if (!tab) return;
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      window.r34lp0w3r.profileActiveTab = tab;
      try {
        localStorage.setItem('appv5:profile-tab', tab);
      } catch (err) {
        // no-op
      }
    };
    if (window.r34lp0w3r && window.r34lp0w3r.profileForceTab) {
      this.activeTab = window.r34lp0w3r.profileForceTab;
      persistProfileTab(this.activeTab);
      window.r34lp0w3r.profileForceTab = null;
    }
    if (this.activeTab === 'prefs') {
      this.activeTab = 'progress';
    }
    if (this.activeTab !== 'review' && this.activeTab !== 'progress') {
      this.activeTab = 'progress';
    }
    const storedReviewTone = window.r34lp0w3r && window.r34lp0w3r.profileReviewTone;
    if (storedReviewTone === 'okay' || storedReviewTone === 'bad') {
      this.reviewTone = storedReviewTone;
    }

    const routes = getRoutes();
    if (!routes.length && !this._loadingData && !this._trainingDataLoadAttempted) {
      this._loadingData = true;
      this._trainingDataLoadAttempted = true;
      ensureTrainingData()
        .catch((err) => {
          console.warn('[profile] training data load failed', err);
        })
        .finally(() => {
          this._loadingData = false;
          if (this.isConnected) this.render();
        });
    }

    const referenceCourses = getReferenceCourses();
    const referenceTestCourses = getReferenceTestCourses();
    if (
      (!referenceCourses.length || !referenceTestCourses.length) &&
      !this._loadingReferenceData &&
      !this._referenceDataLoadAttempted
    ) {
      this._loadingReferenceData = true;
      this._referenceDataLoadAttempted = true;
      Promise.all([
        ensureReferenceData().catch((err) => {
          console.warn('[profile] reference data load failed', err);
        }),
        ensureReferenceTestsData().catch((err) => {
          console.warn('[profile] reference tests load failed', err);
        })
      ]).finally(() => {
        this._loadingReferenceData = false;
        if (this.isConnected) this.render();
      });
    }

    const getUserDisplayName = (user) => {
      if (!user) return '';
      const derivedName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      return derivedName || user.name || user.email || user.social_id || '';
    };

    const getUserAvatar = (user) => {
      if (!user) return '';
      return user.image_local || user.image || '';
    };

    const getFeedbackConfig = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      return {
        toneScale: config && Array.isArray(config.toneScale) ? config.toneScale : []
      };
    };

    const normalizeScale = (scale, key) => {
      const list = (scale || []).filter(
        (item) => item && typeof item.min === 'number' && typeof item[key] === 'string' && item[key]
      );
      if (!list.length) return [];
      return list.slice().sort((a, b) => b.min - a.min);
    };

    const resolveFromScale = (scale, value, key, fallback) => {
      const match = scale.find((item) => value >= item.min);
      if (match && match[key]) return match[key];
      return fallback;
    };

    const getScoreTone = (percent) => {
      const value = typeof percent === 'number' ? percent : 0;
      const { toneScale } = getFeedbackConfig();
      const normalized = normalizeScale(toneScale, 'tone');
      return resolveFromScale(normalized, value, 'tone', 'bad');
    };

    const escapeHtml = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const wordScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {};
    const phraseScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {};
    const user = window.user;
    const rawLocaleSetting = resolveLocale(
      getActiveLocale() || (window.varGlobal && window.varGlobal.locale) || 'es',
      'es'
    );
    const tabsCopy = getTabsCopy(rawLocaleSetting);
    const profileCopy = getProfileCopy(rawLocaleSetting);

    const reviewTone = this.reviewTone === 'okay' ? 'okay' : 'bad';
    const reviewToneLabel =
      reviewTone === 'okay'
        ? profileCopy.reviewToneYellowLabel || 'yellow'
        : profileCopy.reviewToneRedLabel || 'red';

    const sessionLookup = new Map();
    routes.forEach((routeItem) => {
      const modules = routeItem && Array.isArray(routeItem.modules) ? routeItem.modules : [];
      modules.forEach((moduleItem) => {
        const sessions = moduleItem && Array.isArray(moduleItem.sessions) ? moduleItem.sessions : [];
        sessions.forEach((sessionItem) => {
          sessionLookup.set(sessionItem.id, {
            routeId: routeItem.id,
            moduleId: moduleItem.id,
            session: sessionItem
          });
        });
      });
    });

    const hasSessionAttempts = (session) => {
      const wordScores = wordScoresStore[session.id] || {};
      const hasWord = Object.values(wordScores).some(
        (entry) => entry && typeof entry.percent === 'number'
      );
      const phrase = phraseScoresStore[session.id];
      const hasPhrase = phrase && typeof phrase.percent === 'number';
      return hasWord || hasPhrase;
    };

    const getWordsPercent = (session) => {
      const words =
        session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
          ? session.speak.spelling.words
          : [];
      if (!words.length) return 0;
      const sessionScores = wordScoresStore[session.id] || {};
      const total = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : 0;
        return sum + value;
      }, 0);
      return Math.round(total / words.length);
    };

    const getPhrasePercent = (session) => {
      const stored = phraseScoresStore[session.id];
      if (stored && typeof stored.percent === 'number') return stored.percent;
      return 0;
    };

    const getSessionPercent = (session) => {
      const wordsPercent = getWordsPercent(session);
      const phrasePercent = getPhrasePercent(session);
      return Math.round((wordsPercent + phrasePercent) / 2);
    };

    const getModulePercent = (module) => {
      const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
      if (!sessions.length) return { started: false, percent: null, tone: 'neutral' };
      const started = sessions.some((session) => hasSessionAttempts(session));
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = sessions.reduce((sum, session) => sum + getSessionPercent(session), 0);
      const percent = Math.round(total / sessions.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const getRoutePercent = (route) => {
      const modules = route && Array.isArray(route.modules) ? route.modules : [];
      if (!modules.length) return { started: false, percent: null, tone: 'neutral' };
      const moduleProgress = modules.map((module) => getModulePercent(module));
      const started = moduleProgress.some((entry) => entry.started);
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = moduleProgress.reduce(
        (sum, entry) => sum + (entry.started ? entry.percent : 0),
        0
      );
      const percent = Math.round(total / modules.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const routeProgressList = routes.map((route) => getRoutePercent(route));
    const hasAnyRoute = routeProgressList.some((entry) => entry.started);
    const globalPercent = hasAnyRoute
      ? Math.round(
          routeProgressList.reduce((sum, entry) => sum + (entry.started ? entry.percent : 0), 0) /
            (routes.length || 1)
        )
      : 0;
    const globalTone = hasAnyRoute ? getScoreTone(globalPercent) : 'neutral';

    const getProgressMapValue = (progressMap, code) => {
      const key = String(code === undefined || code === null ? '' : code).trim();
      if (!key || !progressMap || typeof progressMap !== 'object') return null;
      if (progressMap[key] !== undefined && progressMap[key] !== null) return progressMap[key];
      const numericKey = Number(key);
      if (
        Number.isFinite(numericKey) &&
        progressMap[numericKey] !== undefined &&
        progressMap[numericKey] !== null
      ) {
        return progressMap[numericKey];
      }
      return null;
    };

    const referenceSectionProgress =
      user && user.section_progress && typeof user.section_progress === 'object' ? user.section_progress : {};
    const referenceTestProgress =
      user && user.test_progress && typeof user.test_progress === 'object' ? user.test_progress : {};

    const hasReferenceLessonCompletion = (lessonCode) => {
      const value = getProgressMapValue(referenceSectionProgress, lessonCode);
      if (value === true) return true;
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0;
    };

    const getImportedReferenceTestStatus = (testCode) => {
      const numericValue = Number(getProgressMapValue(referenceTestProgress, testCode) || 0);
      if (!Number.isFinite(numericValue)) return 0;
      if (numericValue === 1) return 1;
      if (numericValue === 2) return 2;
      return 0;
    };

    const isReferenceTestPassingScore = (percent) => {
      const value = Number(percent);
      return Number.isFinite(value) && value > 80;
    };

    const getReferenceScoreTone = (percent) => {
      const value = Number.isFinite(Number(percent)) ? Number(percent) : 0;
      if (isReferenceTestPassingScore(value)) return 'good';
      if (value >= 60) return 'okay';
      return 'bad';
    };

    const getReferenceTestsStorageUserKey = (currentUser = user) => {
      if (currentUser && currentUser.id !== undefined && currentUser.id !== null) {
        const value = String(currentUser.id).trim();
        if (value) return value;
      }
      return 'anon';
    };

    const getReferenceTestsStorageKey = (currentUser = user) =>
      `${REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX}:${getReferenceTestsStorageUserKey(currentUser)}`;

    const sanitizeStoredReferenceTestResponses = (responses) => {
      const source = responses && typeof responses === 'object' ? responses : {};
      const output = {};
      Object.entries(source).forEach(([questionCode, rawValue]) => {
        const key = String(questionCode || '').trim();
        if (!key) return;
        if (Array.isArray(rawValue)) {
          const values = rawValue.map((item) => String(item || ''));
          while (values.length && !String(values[values.length - 1] || '').trim()) values.pop();
          if (values.some((item) => String(item || '').trim())) {
            output[key] = values;
          }
          return;
        }
        const value = String(rawValue || '');
        if (value.trim()) {
          output[key] = value;
        }
      });
      return output;
    };

    const loadStoredReferenceTestStates = () => {
      try {
        const raw = localStorage.getItem(getReferenceTestsStorageKey(user));
        if (!raw) return {};
        const payload = JSON.parse(raw);
        const statesSource = payload && payload.states && typeof payload.states === 'object' ? payload.states : {};
        const states = {};
        Object.entries(statesSource).forEach(([testKey, rawState]) => {
          const key = String(testKey || '').trim();
          if (!key || !rawState || typeof rawState !== 'object') return;
          const responses = sanitizeStoredReferenceTestResponses(rawState.responses);
          const checked = Boolean(rawState.checked);
          const lastCheckedAt = Number.isFinite(Number(rawState.lastCheckedAt))
            ? Number(rawState.lastCheckedAt)
            : 0;
          if (!Object.keys(responses).length && !checked && !lastCheckedAt) return;
          states[key] = {
            responses,
            checked,
            lastCheckedAt
          };
        });
        return states;
      } catch (_err) {
        return {};
      }
    };

    const referenceStoredTestStates = loadStoredReferenceTestStates();

    const getReferenceTestKey = (scope, test) => {
      const normalizedScope = scope === 'unit' ? 'unit' : 'lesson';
      const code = test && test.code !== undefined && test.code !== null ? String(test.code).trim() : '';
      return code ? `${normalizedScope}:${code}` : '';
    };

    const getStoredReferenceTestState = (testKey) => {
      const key = String(testKey || '').trim();
      if (!key || !referenceStoredTestStates[key]) {
        return {
          responses: {},
          checked: false,
          lastCheckedAt: 0
        };
      }
      return referenceStoredTestStates[key];
    };

    const getReferenceQuestionSlotCount = (question) => {
      const acceptedPlaceholders =
        question &&
        question.answer &&
        Array.isArray(question.answer.accepted_placeholders)
          ? question.answer.accepted_placeholders
          : [];
      const fromAccepted = acceptedPlaceholders.reduce(
        (max, entry) => Math.max(max, Array.isArray(entry) ? entry.length : 0),
        0
      );
      if (fromAccepted > 0) return fromAccepted;
      const matches = String(question && question.text ? question.text : '').match(/_{3,}/g);
      const fromText = Array.isArray(matches) ? matches.length : 0;
      return Math.max(1, fromText);
    };

    const normalizeReferenceAnswerValue = (value) =>
      String(value || '')
        .normalize('NFKC')
        .replace(/[\u2018\u2019\u0060\u00b4]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[¿¡]/g, '')
        .replace(/[.,!?;:()"[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const getReferenceQuestionAcceptedAnswers = (question) => {
      const answer = question && question.answer ? question.answer : {};
      const accepted = Array.isArray(answer.accepted) ? answer.accepted.filter(Boolean) : [];
      if (accepted.length) return accepted;
      const raw = String(answer.raw || '').trim();
      return raw ? [raw] : [];
    };

    const evaluateReferenceQuestion = (question, response) => {
      const interaction = String(question && question.interaction ? question.interaction : '')
        .trim()
        .toLowerCase();
      const acceptedAnswers = getReferenceQuestionAcceptedAnswers(question);
      const acceptedPlaceholders =
        question &&
        question.answer &&
        Array.isArray(question.answer.accepted_placeholders)
          ? question.answer.accepted_placeholders
          : [];

      if (interaction === 'multiple_choice') {
        const selectedCode = String(response || '').trim();
        const correctOption = Array.isArray(question.options)
          ? question.options.find((option) => option.correct)
          : null;
        return Boolean(correctOption && selectedCode && String(correctOption.code) === selectedCode);
      }

      if (interaction === 'reorder_words') {
        const answerTokens = Array.isArray(response) ? response : [];
        const userNormalized = normalizeReferenceAnswerValue(answerTokens.join(' ').trim());
        const acceptedNormalized = acceptedAnswers.map((item) => normalizeReferenceAnswerValue(item));
        return Boolean(userNormalized) && acceptedNormalized.includes(userNormalized);
      }

      const slotCount = getReferenceQuestionSlotCount(question);
      const rawParts = Array.isArray(response)
        ? response.slice(0, slotCount).map((item) => String(item || ''))
        : [String(response || '')];
      const filledParts = Array.from({ length: slotCount }, (_unused, index) => rawParts[index] || '');
      const userDisplay =
        slotCount > 1
          ? filledParts.map((part) => part.trim()).filter(Boolean).join(' · ')
          : filledParts[0].trim();

      if (acceptedPlaceholders.length) {
        const normalizedParts = filledParts.map((part) => normalizeReferenceAnswerValue(part));
        return acceptedPlaceholders.some((entry) => {
          if (!Array.isArray(entry) || entry.length !== slotCount) return false;
          return entry.every(
            (part, index) => normalizeReferenceAnswerValue(part) === (normalizedParts[index] || '')
          );
        });
      }

      const userNormalized = normalizeReferenceAnswerValue(userDisplay);
      const acceptedNormalized = acceptedAnswers.map((item) => normalizeReferenceAnswerValue(item));
      return Boolean(userNormalized) && acceptedNormalized.includes(userNormalized);
    };

    const hasReferenceQuestionResponse = (question, response) => {
      const interaction = String(question && question.interaction ? question.interaction : '')
        .trim()
        .toLowerCase();
      if (interaction === 'multiple_choice') {
        return Boolean(String(response || '').trim());
      }
      if (interaction === 'reorder_words') {
        return Array.isArray(response) && response.some((item) => String(item || '').trim());
      }
      const slotCount = getReferenceQuestionSlotCount(question);
      const values = Array.isArray(response)
        ? response.slice(0, slotCount).map((item) => String(item || ''))
        : [String(response || '')];
      while (values.length < slotCount) values.push('');
      return values.every((item) => String(item || '').trim());
    };

    const getLocalizedReferenceTitle = (entry, field, fallback) =>
      getLocalizedMapField(entry, field, rawLocaleSetting) || fallback || '';

    const getReferenceTestReviewState = (test, testKey) => {
      const importedStatus = getImportedReferenceTestStatus(test && test.code);
      if (importedStatus === 1) return null;

      const state = getStoredReferenceTestState(testKey);
      const questions = Array.isArray(test && test.questions) ? test.questions : [];
      const total = questions.length;
      const answeredCount = questions.reduce((count, question) => {
        const questionCode = String(question && question.code ? question.code : '');
        return count + (hasReferenceQuestionResponse(question, state.responses[questionCode]) ? 1 : 0);
      }, 0);

      if (state.checked && total > 0) {
        const correctCount = questions.reduce((count, question) => {
          const questionCode = String(question && question.code ? question.code : '');
          return count + (evaluateReferenceQuestion(question, state.responses[questionCode]) ? 1 : 0);
        }, 0);
        const scorePercent = Math.max(0, Math.min(100, Math.round((correctCount / total) * 100)));
        if (isReferenceTestPassingScore(scorePercent)) return null;
        return {
          tone: getReferenceScoreTone(scorePercent),
          percent: scorePercent,
          source: 'local-checked'
        };
      }

      if (answeredCount > 0) {
        const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
        return {
          tone: 'okay',
          percent: progressPercent,
          source: 'local-progress'
        };
      }

      if (importedStatus === 2) {
        return {
          tone: 'bad',
          percent: 50,
          source: 'remote-failed'
        };
      }

      return null;
    };

    const testCourseMap = new Map(
      (Array.isArray(referenceTestCourses) ? referenceTestCourses : []).map((course) => [String(course.code), course])
    );

    const getReferenceCoursePercent = (course) => {
      const courseCode = String(course && course.code ? course.code : '').trim();
      if (!courseCode) return { started: false, percent: 0, tone: 'neutral' };
      const testCourse = testCourseMap.get(courseCode) || null;
      const testUnitMap = new Map(
        (testCourse && Array.isArray(testCourse.unidades) ? testCourse.unidades : []).map((unit) => [
          String(unit.code),
          unit
        ])
      );

      let completedCount = 0;
      let totalCount = 0;
      let started = false;

      (Array.isArray(course && course.unidades) ? course.unidades : []).forEach((unit) => {
        const unitCode = String(unit && unit.code ? unit.code : '').trim();
        const testUnit = testUnitMap.get(unitCode) || null;
        const testLessonMap = new Map(
          (testUnit && Array.isArray(testUnit.lecciones) ? testUnit.lecciones : []).map((lesson) => [
            String(lesson.code),
            lesson
          ])
        );

        (Array.isArray(unit && unit.lecciones) ? unit.lecciones : []).forEach((lesson) => {
          const lessonCode = String(lesson && lesson.code ? lesson.code : '').trim();
          const lessonCompleted = hasReferenceLessonCompletion(lessonCode);
          const testLesson = testLessonMap.get(lessonCode) || null;
          const lessonTests =
            testLesson && Array.isArray(testLesson.tests) ? testLesson.tests : [];

          totalCount += 1 + lessonTests.length;
          if (lessonCompleted) {
            completedCount += 1;
            started = true;
          }

          lessonTests.forEach((test) => {
            const importedStatus = getImportedReferenceTestStatus(test && test.code);
            if (importedStatus > 0) started = true;
            if (importedStatus === 1) completedCount += 1;
          });
        });

        const unitTests = testUnit && Array.isArray(testUnit.tests_unidad) ? testUnit.tests_unidad : [];
        totalCount += unitTests.length;
        unitTests.forEach((test) => {
          const importedStatus = getImportedReferenceTestStatus(test && test.code);
          if (importedStatus > 0) started = true;
          if (importedStatus === 1) completedCount += 1;
        });
      });

      const percent = totalCount > 0 ? Math.round((completedCount * 100) / totalCount) : 0;
      return {
        started,
        percent,
        tone: started ? getScoreTone(percent) : 'neutral'
      };
    };

    const referenceCourseProgressList = referenceCourses.map((course) => getReferenceCoursePercent(course));
    const hasAnyReferenceProgress = referenceCourseProgressList.some((entry) => entry.started);
    const referenceGlobalPercent =
      hasAnyReferenceProgress && referenceCourses.length
        ? Math.round(
            referenceCourseProgressList.reduce(
              (sum, entry) => sum + (entry.started ? entry.percent : 0),
              0
            ) / referenceCourses.length
          )
        : 0;
    const referenceGlobalTone = hasAnyReferenceProgress ? getScoreTone(referenceGlobalPercent) : 'neutral';

    const reviewTestEntries = [];
    (Array.isArray(referenceTestCourses) ? referenceTestCourses : []).forEach((course) => {
      const courseCode = String(course && course.code ? course.code : '').trim();
      const courseTitle =
        getLocalizedReferenceTitle(course, 'display', course && course.title ? String(course.title) : '') ||
        `Course ${courseCode}`;
      (Array.isArray(course && course.unidades) ? course.unidades : []).forEach((unit) => {
        const unitCode = String(unit && unit.code ? unit.code : '').trim();
        const unitTitle =
          getLocalizedReferenceTitle(unit, 'display', unit && unit.title ? String(unit.title) : '') ||
          `Unit ${unitCode}`;
        const lessons = Array.isArray(unit && unit.lecciones) ? unit.lecciones : [];
        const firstLessonCode =
          lessons[0] && lessons[0].code !== undefined && lessons[0].code !== null
            ? String(lessons[0].code).trim()
            : '';

        lessons.forEach((lesson) => {
          const lessonCode = String(lesson && lesson.code ? lesson.code : '').trim();
          const lessonTitle =
            getLocalizedReferenceTitle(lesson, 'display', lesson && lesson.title ? String(lesson.title) : '') ||
            `Lesson ${lessonCode}`;
          (Array.isArray(lesson && lesson.tests) ? lesson.tests : []).forEach((test) => {
            const testKey = getReferenceTestKey('lesson', test);
            const reviewState = getReferenceTestReviewState(test, testKey);
            if (!reviewState || reviewState.tone !== reviewTone) return;
            reviewTestEntries.push({
              type: 'reference-test',
              tone: reviewState.tone,
              courseCode,
              unitCode,
              lessonCode,
              testKey,
              title:
                getLocalizedReferenceTestValue(test && test.display ? test.display : '', rawLocaleSetting) ||
                `Test ${String(test && test.code ? test.code : '').trim()}`,
              eyebrow: profileCopy.reviewLessonTestLabel || 'Lesson test',
              meta: `${courseTitle} · ${unitTitle} · ${lessonTitle}`
            });
          });
        });

        (Array.isArray(unit && unit.tests_unidad) ? unit.tests_unidad : []).forEach((test) => {
          if (!firstLessonCode) return;
          const testKey = getReferenceTestKey('unit', test);
          const reviewState = getReferenceTestReviewState(test, testKey);
          if (!reviewState || reviewState.tone !== reviewTone) return;
          reviewTestEntries.push({
            type: 'reference-test',
            tone: reviewState.tone,
            courseCode,
            unitCode,
            lessonCode: firstLessonCode,
            testKey,
            title:
              getLocalizedReferenceTestValue(test && test.display ? test.display : '', rawLocaleSetting) ||
              `Test ${String(test && test.code ? test.code : '').trim()}`,
            eyebrow: profileCopy.reviewUnitTestLabel || 'Unit test',
            meta: `${courseTitle} · ${unitTitle}`
          });
        });
      });
    });

    const reviewWordsMap = new Map();
    Object.entries(wordScoresStore).forEach(([sessionId, sessionScores]) => {
      if (!sessionScores || typeof sessionScores !== 'object') return;
      Object.entries(sessionScores).forEach(([word, entry]) => {
        const percent = entry && typeof entry.percent === 'number' ? entry.percent : null;
        if (percent === null) return;
        const tone = getScoreTone(percent);
        if (tone !== reviewTone) return;
        const key = word.toLowerCase();
        const existing = reviewWordsMap.get(key);
        if (!existing || percent < existing.percent) {
          reviewWordsMap.set(key, { word, percent, sessionId });
        }
      });
    });
    const reviewWordEntries = Array.from(reviewWordsMap.values()).sort((a, b) =>
      a.word.localeCompare(b.word)
    );

    const reviewPhraseEntries = [];
    Object.entries(phraseScoresStore).forEach(([sessionId, entry]) => {
      const percent = entry && typeof entry.percent === 'number' ? entry.percent : null;
      if (percent === null) return;
      const tone = getScoreTone(percent);
      if (tone !== reviewTone) return;
      const sessionInfo = sessionLookup.get(sessionId);
      const phrase =
        sessionInfo &&
        sessionInfo.session &&
        sessionInfo.session.speak &&
        sessionInfo.session.speak.sentence
          ? sessionInfo.session.speak.sentence.sentence
          : '';
      if (!phrase) return;
      reviewPhraseEntries.push({ phrase, percent, sessionId });
    });
    reviewPhraseEntries.sort((a, b) => a.phrase.localeCompare(b.phrase));

    const userId = user && user.id !== undefined && user.id !== null ? String(user.id) : '';
    const loggedIn = Boolean(userId);
    const progressActive = this.activeTab === 'progress';
    const reviewActive = this.activeTab === 'review';
    const settingsOpen = loggedIn && this.settingsOpen === true;
    const showFooterLinks = loggedIn && settingsOpen;
    const showAppMeta = loggedIn && settingsOpen;
    const formatExpiry = (value) => {
      if (!value) return profileCopy.expiryNA || 'n/a';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const lang = String(rawLocaleSetting || 'es').toLowerCase();
      const fmtLocale = lang.startsWith('en')
        ? 'en-US'
        : lang.startsWith('br') || lang.startsWith('pt')
          ? 'pt-BR'
          : 'es-ES';
      try {
        return new Intl.DateTimeFormat(fmtLocale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }).format(date);
      } catch (err) {
        return typeof date.toLocaleDateString === 'function'
          ? date.toLocaleDateString()
          : date.toISOString().split('T')[0];
      }
    };
    const formatAppMeta = (meta) => {
      const info = meta && typeof meta === 'object' ? meta : {};
      const version =
        info.version || info.appVersion || info.versionName || info.versionString || '';
      const build = info.build || info.appBuild || info.buildNumber || info.versionCode || '';
      if (version && build) return `v${version} (${build})`;
      if (version) return `v${version}`;
      if (build) return `build ${build}`;
      return profileCopy.appMetaNA || 'v n/d';
    };
    const resetProfileState = (nextUser) => {
      if (!nextUser || nextUser.id === undefined || nextUser.id === null) {
        this.profileFormState = null;
        this.profileFormSeed = null;
        this._profileSeedId = null;
        this.profileSaveMessage = '';
        this.profileSaveError = false;
        return null;
      }
      let firstName = nextUser.first_name || '';
      let lastName = nextUser.last_name || '';
      if (!firstName && !lastName && nextUser.name) {
        const parts = String(nextUser.name).trim().split(/\s+/);
        firstName = parts.shift() || '';
        lastName = parts.join(' ');
      }
      const seed = {
        first_name: firstName,
        last_name: lastName,
        email: nextUser.email || '',
        expires_date: nextUser.expires_date || '',
        birthdate: nextUser.birthdate || '1901-01-01',
        lc: nextUser.lc || nextUser.locale || 'en-gb',
        sex: typeof nextUser.sex === 'number' ? nextUser.sex : 1
      };
      this.profileFormSeed = seed;
      this.profileFormState = {
        ...seed,
        password: '',
        passwordConfirm: ''
      };
      this._profileSeedId = String(nextUser.id);
      this.profileSaveMessage = '';
      this.profileSaveError = false;
      return this.profileFormState;
    };
    if (!loggedIn) {
      resetProfileState(null);
    } else if (!this.profileFormState || this._profileSeedId !== userId) {
      resetProfileState(user);
    }
    const profileSeed = this.profileFormSeed || {
      first_name: '',
      last_name: '',
      email: '',
      expires_date: '',
      birthdate: '1901-01-01',
      lc: 'en-gb',
      sex: 1
    };
    const profileState = this.profileFormState || {
      ...profileSeed,
      password: '',
      passwordConfirm: ''
    };
    const hasProfileChanges = () => {
      if (!loggedIn) return false;
      const first = String(profileState.first_name || '').trim();
      const last = String(profileState.last_name || '').trim();
      const baseFirst = String(profileSeed.first_name || '').trim();
      const baseLast = String(profileSeed.last_name || '').trim();
      if (first !== baseFirst || last !== baseLast) return true;
      if (profileState.password || profileState.passwordConfirm) return true;
      return false;
    };
    const getPasswordError = () => {
      const pass = String(profileState.password || '');
      const confirm = String(profileState.passwordConfirm || '');
      if (!pass && !confirm) return '';
      if (!pass || !confirm) {
        return profileCopy.passwordBothRequired || 'Please complete both password fields.';
      }
      if (pass !== confirm) return profileCopy.passwordMismatch || 'Passwords do not match.';
      return '';
    };
    const profileNote = this.profileSaveMessage || '';
    const profileNoteError = this.profileSaveError === true;
    const appMetaLabel = formatAppMeta(window.appMeta);

    const reviewFiltersMarkup = `
      <div class="review-filters">
        <button class="review-filter-btn bad ${reviewTone === 'bad' ? 'active' : ''}" type="button" data-tone="bad">
          <span class="review-dot bad"></span>
          <span>${escapeHtml(profileCopy.reviewRed || 'Red')}</span>
        </button>
        <button class="review-filter-btn okay ${reviewTone === 'okay' ? 'active' : ''}" type="button" data-tone="okay">
          <span class="review-dot okay"></span>
          <span>${escapeHtml(profileCopy.reviewYellow || 'Yellow')}</span>
        </button>
      </div>
    `;

    const reviewWordsMarkup = reviewWordEntries.length
      ? `<div class="review-words">${reviewWordEntries
          .map(
            (entry) =>
              `<button class="review-word review-entry ${reviewTone}" type="button" data-type="word" data-word="${escapeHtml(entry.word)}" data-session-id="${escapeHtml(entry.sessionId)}">${escapeHtml(entry.word)}</button>`
          )
          .join('')}</div>`
      : `<div class="review-empty">${escapeHtml(
          String(profileCopy.reviewWordsEmpty || 'No words in {tone}.').replace('{tone}', reviewToneLabel)
        )}</div>`;

    const reviewPhrasesMarkup = reviewPhraseEntries.length
      ? `<div class="review-phrases">${reviewPhraseEntries
          .map(
            (entry) =>
              `<button class="review-word review-phrase review-entry ${reviewTone}" type="button" data-type="phrase" data-session-id="${escapeHtml(entry.sessionId)}">${escapeHtml(entry.phrase)}</button>`
          )
          .join('')}</div>`
      : `<div class="review-empty">${escapeHtml(
          String(profileCopy.reviewPhrasesEmpty || 'No phrases in {tone}.').replace(
            '{tone}',
            reviewToneLabel
          )
        )}</div>`;

    const reviewTestsMarkup = reviewTestEntries.length
      ? `<div class="review-tests">${reviewTestEntries
          .map(
            (entry) => `
              <button
                class="review-word review-test review-entry ${escapeHtml(entry.tone)}"
                type="button"
                data-type="reference-test"
                data-course-code="${escapeHtml(entry.courseCode)}"
                data-unit-code="${escapeHtml(entry.unitCode)}"
                data-lesson-code="${escapeHtml(entry.lessonCode)}"
                data-test-key="${escapeHtml(entry.testKey)}"
              >
                <span class="review-test-eyebrow">${escapeHtml(entry.eyebrow)}</span>
                <span class="review-test-meta">${escapeHtml(entry.meta)}</span>
              </button>
            `
          )
          .join('')}</div>`
      : `<div class="review-empty">${escapeHtml(
          String(profileCopy.reviewTestsEmpty || 'There are no tests in {tone}.').replace(
            '{tone}',
            reviewToneLabel
          )
        )}</div>`;

    const badgeStore =
      window.r34lp0w3r && window.r34lp0w3r.speakBadges && typeof window.r34lp0w3r.speakBadges === 'object'
        ? window.r34lp0w3r.speakBadges
        : {};
    const routeTitleById = new Map(
      routes.map((route) => {
        const routeId = route && route.id ? String(route.id).trim() : '';
        const routeTitle =
          String(
            (route &&
              (route.display && typeof route.display === 'object'
                ? route.display[rawLocaleSetting] || route.display.es || route.display.en
                : route.display)) ||
              route?.title ||
              route?.name ||
              ''
          ).trim();
        return [routeId, routeTitle];
      })
    );
    const routeBadgeOrder = new Map(
      routes.map((route, idx) => [route && route.id ? route.id : '', idx + 1])
    );
    const resolveBadgeView = (badgeId, entry) => {
      if (!badgeId || !entry || typeof entry !== 'object') return null;
      const routeId = String(entry.routeId || '').trim();
      const routeTitle =
        String(entry.routeTitle || '').trim() || (routeId ? String(routeTitleById.get(routeId) || '').trim() : '');
      let badgeIndex = Number(entry.badgeIndex);
      if (!Number.isFinite(badgeIndex) || badgeIndex <= 0) {
        badgeIndex = routeId && routeBadgeOrder.has(routeId) ? routeBadgeOrder.get(routeId) : NaN;
      }
      if (!Number.isFinite(badgeIndex) || badgeIndex <= 0) {
        return null;
      }
      const image = String(entry.image || '').trim() || `assets/badges/badge${badgeIndex}.png`;
      const title = routeTitle || String(entry.title || entry.label || '').trim() || `Badge ${badgeIndex}`;
      return {
        id: badgeId,
        badgeIndex,
        image,
        title,
        routeTitle
      };
    };
    const earnedBadges = Object.entries(badgeStore)
      .map(([badgeId, entry]) => resolveBadgeView(badgeId, entry))
      .filter(Boolean)
      .sort((a, b) => a.badgeIndex - b.badgeIndex);
    const earnedBadgesMarkup = earnedBadges.length
      ? earnedBadges
          .map(
            (badge) => `
              <button class="profile-earned-badge-card" type="button" data-badge-id="${escapeHtml(badge.id)}">
                <img class="profile-earned-badge-img" src="${escapeHtml(badge.image)}" alt="${escapeHtml(
              badge.title
            )}">
                <span class="profile-earned-badge-title">${escapeHtml(badge.title)}</span>
              </button>
            `
          )
          .join('')
      : `<div class="profile-earned-badges-empty">${escapeHtml(
          profileCopy.badgesEmpty || 'You have not unlocked badges yet.'
        )}</div>`;
    const sessionRewardsStore =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : {};
    const sessionRewardEntries = Object.values(sessionRewardsStore).filter(
      (entry) => entry && typeof entry.rewardQty === 'number' && entry.rewardQty > 0
    );
    const trainingTrophyQty = sessionRewardEntries.reduce((sum, entry) => {
      const icon = String(entry.rewardIcon || '').trim().toLowerCase();
      return icon === 'trophy' ? sum + Number(entry.rewardQty || 0) : sum;
    }, 0);
    const referenceMedalQty = sessionRewardEntries.reduce((sum, entry) => {
      const icon = String(entry.rewardIcon || '').trim().toLowerCase();
      const kind = String(entry.rewardGroup || '').trim().toLowerCase();
      return icon === 'ribbon' || icon === 'medal' || kind === 'reference-unit-ribbon'
        ? sum + Number(entry.rewardQty || 0)
        : sum;
    }, 0);
    const reviewItemsCount =
      reviewWordEntries.length + reviewPhraseEntries.length + reviewTestEntries.length;
    const avatarSrc = escapeHtml(
      getUserAvatar(user) || 'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif'
    );
    const userDisplayName = escapeHtml(
      getUserDisplayName(user) || profileCopy.userFallbackName || 'Usuario'
    );
    const progressCardsMarkup = [
      {
        label: tabsCopy.training || 'Training',
        value: `${globalPercent}%`,
        tone: globalTone,
        iconSrc: 'assets/profile/training.png',
        iconAlt: tabsCopy.training || 'Training'
      },
      {
        label: tabsCopy.reference || 'Reference',
        value: `${referenceGlobalPercent}%`,
        tone: referenceGlobalTone,
        iconSrc: 'assets/profile/reference.png',
        iconAlt: tabsCopy.reference || 'Reference'
      }
    ]
      .map(
        (item) => `
          <div class="profile-stat-card profile-stat-card--reward">
            <div class="profile-stat-copy">
              <div class="profile-stat-value profile-stat-value--${escapeHtml(item.tone)}">${escapeHtml(
                item.value
              )}</div>
              <div class="profile-stat-label">${escapeHtml(item.label)}</div>
            </div>
            <div class="profile-stat-media">
              <img class="profile-stat-icon" src="${escapeHtml(item.iconSrc)}" alt="${escapeHtml(
                item.iconAlt
              )}">
            </div>
          </div>
        `
      )
      .join('');
    const rewardCardsMarkup = [
      {
        label: profileCopy.trainingTrophies || 'Copas training',
        value: String(trainingTrophyQty),
        tone: 'neutral',
        iconSrc: 'assets/profile/copa.png',
        iconAlt: profileCopy.trainingTrophies || 'Copas training'
      },
      {
        label: profileCopy.referenceMedals || 'Medallas reference',
        value: String(referenceMedalQty),
        tone: 'neutral',
        iconSrc: 'assets/profile/medalla.png',
        iconAlt: profileCopy.referenceMedals || 'Medallas reference'
      }
    ]
      .map(
        (item) => `
          <div class="profile-stat-card profile-stat-card--reward">
            <div class="profile-stat-copy">
              <div class="profile-stat-value profile-stat-value--${escapeHtml(item.tone)}">${escapeHtml(
                item.value
              )}</div>
              <div class="profile-stat-label">${escapeHtml(item.label)}</div>
            </div>
            <div class="profile-stat-media">
              <img class="profile-stat-icon" src="${escapeHtml(item.iconSrc)}" alt="${escapeHtml(
                item.iconAlt
              )}">
            </div>
          </div>
        `
      )
      .join('');

    this.innerHTML = `
      ${loggedIn ? renderAppHeader({ title: tabsCopy.you, rewardBadgesId: 'profile-reward-badges', locale: rawLocaleSetting }) : ''}
      <ion-content fullscreen class="secret-content profile-content ${loggedIn ? '' : 'profile-content--logged-out'}">
        <div class="page-shell profile-shell ${loggedIn ? '' : `profile-shell--logged-out ${platform === 'android' ? 'profile-shell--logged-out-android' : ''}`}">
          <div id="profile-login-panel" ${loggedIn ? 'hidden' : ''}>
            <div class="profile-login-hero">
              <h1 class="profile-login-title">${escapeHtml(profileCopy.loginTitle || 'Inicia sesión')}</h1>
            </div>
            <page-login embedded flat></page-login>
            <div class="profile-auth-footer" ${loggedIn ? 'hidden' : ''}>
              <div class="profile-links profile-links--centered" id="profile-links-login" ${loggedIn ? 'hidden' : ''}>
                <button class="profile-link-btn" type="button" data-action="contact">${escapeHtml(
                  profileCopy.contact || 'Contact'
                )}</button>
                <button class="profile-link-btn" type="button" data-action="legal">${escapeHtml(
                  profileCopy.legal || 'Legal'
                )}</button>
              </div>
              <div class="profile-app-meta profile-app-meta--auth">${escapeHtml(appMetaLabel)}</div>
            </div>
          </div>
          <div class="profile-panel" id="profile-content-panel" ${loggedIn ? '' : 'hidden'}>
            ${settingsOpen ? '' : `
            <div class="profile-hero-wrap">
              <button class="profile-settings-toggle" type="button" id="profile-settings-toggle" aria-label="${escapeHtml(
                profileCopy.tabPrefs || 'Profile'
              )}">
                <ion-icon name="settings-outline"></ion-icon>
              </button>
              <div class="card card--plain profile-hero-card">
                <div class="profile-hero-avatar-wrap">
                  <img class="profile-hero-avatar" src="${avatarSrc}" alt="">
                </div>
                <div class="profile-hero-name">${userDisplayName}</div>
                <div class="profile-segmented-tabs" role="tablist">
                  <button class="profile-segmented-btn ${progressActive ? 'active' : ''}" type="button" data-tab="progress" role="tab">
                    <span>${escapeHtml(profileCopy.progressLabel || 'Progreso')}</span>
                  </button>
                  <button class="profile-segmented-btn ${reviewActive ? 'active' : ''}" type="button" data-tab="review" role="tab">
                    <span>${escapeHtml(profileCopy.tabReview || 'Review')}</span>
                    ${reviewItemsCount > 0 ? `<span class="profile-segmented-count">${reviewItemsCount}</span>` : ''}
                  </button>
                </div>
              </div>
            </div>
            `}
            <div class="profile-tab-panel" ${progressActive && !settingsOpen ? '' : 'hidden'}>
              <div class="profile-stats-grid">
                ${progressCardsMarkup}
              </div>
              <div class="profile-progress-section">
                <h3 class="profile-section-title">${escapeHtml(profileCopy.awardsTitle || 'Premios')}</h3>
                <div class="profile-stats-grid">
                  ${rewardCardsMarkup}
                </div>
              </div>
              <div class="profile-earned-badges-section">
                <h3 class="profile-section-title">${escapeHtml(profileCopy.badgesTitle || 'Badges')}</h3>
                <div class="profile-earned-badges" id="profile-earned-badges">
                  ${earnedBadgesMarkup}
                </div>
              </div>
            </div>
            <div class="profile-tab-panel" ${settingsOpen ? '' : 'hidden'}>
              <div class="card card--plain profile-settings">
                <div class="profile-settings-header">
                  <button class="profile-settings-back" type="button" id="profile-settings-back">${escapeHtml(
                    profileCopy.recoverBack || 'Volver'
                  )}</button>
                </div>
                <div class="profile-avatar-block">
                  <div class="profile-avatar-wrap">
                    <img
                      class="profile-avatar-large"
                      id="profile-avatar-img"
                      src="${avatarSrc}"
                      alt="${escapeHtml(profileCopy.profileAvatarAlt || 'Profile avatar')}"
                    >
                  </div>
                  <div class="profile-avatar-actions">
                    <ion-button size="small" shape="round" id="profile-avatar-upload" style="text-transform:none">${escapeHtml(
                      profileCopy.changePhoto || 'Change photo'
                    )}</ion-button>
                    <ion-button size="small" shape="round" color="danger" id="profile-avatar-delete" fill="solid" style="text-transform:none">${escapeHtml(
                      profileCopy.deletePhoto || 'Delete'
                    )}</ion-button>
                  </div>
                  <input type="file" accept="image/jpeg,image/png,image/gif" id="profile-avatar-input" hidden>
                </div>
                <div class="profile-form">
                  <div class="profile-form-row">
                    <label class="profile-input-shell" for="profile-first-name">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="person-outline"></ion-icon>
                      </span>
                      <input
                        class="profile-input profile-input--shell"
                        type="text"
                        id="profile-first-name"
                        value="${escapeHtml(profileState.first_name || '')}"
                        placeholder="${escapeHtml(profileCopy.firstName || 'First name')}"
                        aria-label="${escapeHtml(profileCopy.firstName || 'First name')}"
                      >
                    </label>
                    <label class="profile-input-shell" for="profile-last-name">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="people-outline"></ion-icon>
                      </span>
                      <input
                        class="profile-input profile-input--shell"
                        type="text"
                        id="profile-last-name"
                        value="${escapeHtml(profileState.last_name || '')}"
                        placeholder="${escapeHtml(profileCopy.lastName || 'Last name')}"
                        aria-label="${escapeHtml(profileCopy.lastName || 'Last name')}"
                      >
                    </label>
                  </div>
                  <div class="profile-form-row">
                    <label class="profile-input-shell" for="profile-password">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="lock-closed-outline"></ion-icon>
                      </span>
                      <input
                        class="profile-input profile-input--shell"
                        type="password"
                        id="profile-password"
                        autocomplete="new-password"
                        placeholder="${escapeHtml(profileCopy.passwordNewPlaceholder || 'New password')}"
                        aria-label="${escapeHtml(profileCopy.password || 'Password')}"
                      >
                      <button class="profile-input-toggle" type="button" id="profile-password-toggle" aria-label="${escapeHtml(
                        profileCopy.password || 'Password'
                      )}">
                        <ion-icon name="eye-outline"></ion-icon>
                      </button>
                    </label>
                    <label class="profile-input-shell" for="profile-password-confirm">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="lock-closed-outline"></ion-icon>
                      </span>
                      <input
                        class="profile-input profile-input--shell"
                        type="password"
                        id="profile-password-confirm"
                        autocomplete="new-password"
                        placeholder="${escapeHtml(profileCopy.passwordRepeatPlaceholder || 'Repeat password')}"
                        aria-label="${escapeHtml(profileCopy.passwordRepeat || 'Repeat password')}"
                      >
                      <button class="profile-input-toggle" type="button" id="profile-password-confirm-toggle" aria-label="${escapeHtml(
                        profileCopy.passwordRepeat || 'Repeat password'
                      )}">
                        <ion-icon name="eye-outline"></ion-icon>
                      </button>
                    </label>
                  </div>
                  <div class="profile-form-row">
                    <label class="profile-input-shell profile-input-shell--select" for="profile-locale">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="globe-outline"></ion-icon>
                      </span>
                      <select class="profile-input profile-input--shell" id="profile-locale" aria-label="${escapeHtml(
                        profileCopy.interfaceLanguage || 'Interface language'
                      )}">
                        <option value="es"${(user && user.locale || rawLocaleSetting) === 'es' ? ' selected' : ''}>ES</option>
                        <option value="en"${(user && user.locale || rawLocaleSetting) === 'en' ? ' selected' : ''}>EN</option>
                      </select>
                    </label>
                  </div>
                  <div class="profile-form-row">
                    <label class="profile-input-shell" for="profile-email">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="mail-outline"></ion-icon>
                      </span>
                      <input
                        class="profile-input profile-input--shell"
                        type="email"
                        id="profile-email"
                        value="${escapeHtml(profileState.email || '')}"
                        readonly
                        aria-label="${escapeHtml(profileCopy.email || 'Email')}"
                      >
                    </label>
                    <label class="profile-input-shell" for="profile-expiry">
                      <span class="profile-input-icon" aria-hidden="true">
                        <ion-icon name="calendar-outline"></ion-icon>
                      </span>
                      <input
                        class="profile-input profile-input--shell"
                        type="text"
                        id="profile-expiry"
                        value="${escapeHtml(formatExpiry(profileState.expires_date))}"
                        readonly
                        aria-label="${escapeHtml(profileCopy.subscriptionUntil || 'Subscription until')}"
                      >
                    </label>
                  </div>
                </div>
                <div class="profile-save-row">
                  <ion-button expand="block" shape="round" id="profile-save-btn">${escapeHtml(
                    profileCopy.saveChanges || 'Save changes'
                  )}</ion-button>
                  <p class="profile-save-note ${profileNoteError ? 'error' : ''}" id="profile-save-note">${
                    profileNote ? escapeHtml(profileNote) : ''
                  }</p>
                </div>
                <div class="profile-logout-row">
                  <ion-button expand="block" shape="round" fill="outline" class="profile-logout-btn" id="profile-logout-btn">
                    <ion-icon slot="start" name="log-out-outline"></ion-icon>
                    ${escapeHtml(profileCopy.logout || 'Log out')}
                  </ion-button>
                </div>
                <div class="profile-delete-account-row">
                  <ion-button expand="block" shape="round" color="danger" class="profile-delete-account-btn" id="profile-delete-account-btn">
                    <ion-icon slot="start" name="trash-outline"></ion-icon>
                    ${escapeHtml(profileCopy.deleteAccount || 'Delete account')}
                  </ion-button>
                  <p class="profile-delete-account-note">${escapeHtml(
                    profileCopy.deleteAccountHint ||
                      'Your account will be removed and you will be signed out.'
                  )}</p>
                </div>
              </div>
            </div>
            <div class="profile-tab-panel" ${reviewActive && !settingsOpen ? '' : 'hidden'}>
              ${reviewFiltersMarkup}
              <div class="profile-review-section">
                <h3 class="profile-section-title">${escapeHtml(
                  profileCopy.reviewWordsTitle || 'Words to review'
                )}</h3>
                <div class="card card--plain profile-review-block">
                  <div class="profile-review-content" data-review-collapse data-collapsed-height="82">
                    ${reviewWordsMarkup}
                  </div>
                  <button class="profile-review-more" type="button" hidden>${escapeHtml(
                    profileCopy.reviewMore || 'More'
                  )}</button>
                </div>
              </div>
              <div class="profile-review-section">
                <h3 class="profile-section-title">${escapeHtml(
                  profileCopy.reviewPhrasesTitle || 'Phrases to review'
                )}</h3>
                <div class="card card--plain profile-review-block">
                  <div class="profile-review-content" data-review-collapse data-collapsed-height="82">
                    ${reviewPhrasesMarkup}
                  </div>
                  <button class="profile-review-more" type="button" hidden>${escapeHtml(
                    profileCopy.reviewMore || 'More'
                  )}</button>
                </div>
              </div>
              <div class="profile-review-section">
                <h3 class="profile-section-title">${escapeHtml(
                  profileCopy.reviewTestsTitle || 'Tests to review'
                )}</h3>
                <div class="card card--plain profile-review-block">
                  <div class="profile-review-content" data-review-collapse data-collapsed-height="150">
                    ${reviewTestsMarkup}
                  </div>
                  <button class="profile-review-more" type="button" hidden>${escapeHtml(
                    profileCopy.reviewMore || 'More'
                  )}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="profile-links profile-links--footer" id="profile-links-footer" ${showFooterLinks ? '' : 'hidden'}>
            <button class="profile-link-btn" type="button" data-action="contact">${escapeHtml(
              profileCopy.contact || 'Contact'
            )}</button>
            <button class="profile-link-btn" type="button" data-action="legal">${escapeHtml(
              profileCopy.legal || 'Legal'
            )}</button>
          </div>
          <div class="profile-app-meta" id="profile-app-meta" ${showAppMeta ? '' : 'hidden'}>${escapeHtml(
            appMetaLabel
          )}</div>
        </div>
      </ion-content>
    `;

    const rewardsEl = this.querySelector('#profile-reward-badges');
    const linksLogin = this.querySelector('#profile-links-login');
    const linksFooter = this.querySelector('#profile-links-footer');
    const appMetaEl = this.querySelector('#profile-app-meta');
    const avatarInput = this.querySelector('#profile-avatar-input');
    const avatarUploadBtn = this.querySelector('#profile-avatar-upload');
    const avatarDeleteBtn = this.querySelector('#profile-avatar-delete');
    const profileFirstName = this.querySelector('#profile-first-name');
    const profileLastName = this.querySelector('#profile-last-name');
    const profilePassword = this.querySelector('#profile-password');
    const profilePasswordConfirm = this.querySelector('#profile-password-confirm');
    const profileSaveBtn = this.querySelector('#profile-save-btn');
    const profileLogoutBtn = this.querySelector('#profile-logout-btn');
    const profileDeleteAccountBtn = this.querySelector('#profile-delete-account-btn');
    const profileSaveNote = this.querySelector('#profile-save-note');
    const profileEarnedBadgesEl = this.querySelector('#profile-earned-badges');
    const profileSettingsBackBtn = this.querySelector('#profile-settings-back');

    const updateProfileState = (nextUser) => {
      const nextUserId =
        nextUser && nextUser.id !== undefined && nextUser.id !== null ? String(nextUser.id) : '';
      const isLoggedIn = Boolean(nextUserId);
      const loginPanel = this.querySelector('#profile-login-panel');
      const contentPanel = this.querySelector('#profile-content-panel');
      if (loginPanel) loginPanel.hidden = isLoggedIn;
      if (contentPanel) contentPanel.hidden = !isLoggedIn;
      if (linksLogin) linksLogin.hidden = isLoggedIn;
      const shouldShowFooterLinks = isLoggedIn && this.settingsOpen === true;
      const shouldShowAppMeta = isLoggedIn && this.settingsOpen === true;
      if (linksFooter) linksFooter.hidden = !shouldShowFooterLinks;
      if (appMetaEl) appMetaEl.hidden = !shouldShowAppMeta;
    };

    const updateHeaderRewards = () => {
      if (!rewardsEl) return;
      const rewards =
        window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
          ? window.r34lp0w3r.speakSessionRewards
          : {};
      const totals = {};
      Object.values(rewards).forEach((entry) => {
        if (!entry || typeof entry.rewardQty !== 'number') return;
        const icon = entry.rewardIcon || 'diamond';
        const rewardKind = String(entry.rewardGroup || icon).trim() || String(icon).trim() || 'diamond';
        if (!totals[rewardKind]) totals[rewardKind] = { icon, qty: 0 };
        totals[rewardKind].qty += entry.rewardQty;
      });
      const entries = Object.entries(totals).filter(([, meta]) => meta && meta.qty > 0);
      if (!entries.length) {
        rewardsEl.innerHTML = '';
        rewardsEl.hidden = true;
        return;
      }
      rewardsEl.hidden = false;
      rewardsEl.innerHTML = entries
        .sort((left, right) => {
          const leftIcon = String(left[1] && left[1].icon ? left[1].icon : 'diamond').trim().toLowerCase();
          const rightIcon = String(right[1] && right[1].icon ? right[1].icon : 'diamond').trim().toLowerCase();
          const getOrder = (icon) =>
            icon === 'trophy'
              ? 0
              : icon === 'ribbon' || icon === 'medal'
              ? 1
              : icon === 'diamond'
              ? 2
              : 9;
          const byOrder = getOrder(leftIcon) - getOrder(rightIcon);
          if (byOrder !== 0) return byOrder;
          return String(left[0] || '').localeCompare(String(right[0] || ''));
        })
        .map(([rewardKind, meta]) => {
          const icon = meta.icon || 'diamond';
          const qty = meta.qty || 0;
          const normalizedIcon = String(icon || '').trim().toLowerCase();
          const isInteractive =
            normalizedIcon === 'trophy' ||
            normalizedIcon === 'ribbon' ||
            normalizedIcon === 'medal' ||
            rewardKind === 'reference-unit-ribbon';
          return `<div class="training-badge reward-badge${isInteractive ? ' is-interactive' : ''}" data-reward-kind="${rewardKind}" data-reward-icon="${icon}" data-reward-qty="${qty}"${isInteractive ? ' role="button" tabindex="0"' : ''}><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`;
        })
        .join('');
    };

    const openLoginModal = async () => {
      if (typeof window.openLoginModal === 'function') {
        await window.openLoginModal({ locked: false });
        return;
      }
      let modal = document.querySelector('ion-modal.login-modal');
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

    const hasIonAlert = () =>
      Boolean(
        window.customElements &&
          typeof window.customElements.get === 'function' &&
          window.customElements.get('ion-alert')
      );

    const replaceCopyToken = (template, token, value) =>
      String(template || '').split(token).join(value);

    const presentProfileAlert = async (header, message) => {
      const title = String(header || '').trim();
      const body = String(message || '').trim();
      if (!hasIonAlert()) {
        window.alert(body ? `${title}\n\n${body}` : title);
        return;
      }
      const alert = document.createElement('ion-alert');
      alert.header = title;
      alert.message = body;
      alert.buttons = ['OK'];
      document.body.appendChild(alert);
      await alert.present();
      await alert.onDidDismiss();
      alert.remove();
    };

    const getDeleteAccountConfirmationConfig = (accountUser) => {
      const email =
        accountUser && typeof accountUser.email === 'string' ? String(accountUser.email).trim() : '';
      if (email) {
        return {
          kind: 'email',
          value: email,
          label: replaceCopyToken(
            profileCopy.deleteAccountConfirmEmailLabel || 'Type this email to confirm: {value}',
            '{value}',
            email
          ),
          placeholder:
            profileCopy.deleteAccountConfirmPlaceholderEmail || 'you@email.com',
          inputType: 'email'
        };
      }
      return {
        kind: 'keyword',
        value: 'DELETE',
        label:
          profileCopy.deleteAccountConfirmKeywordLabel || 'Type DELETE to confirm.',
        placeholder:
          profileCopy.deleteAccountConfirmPlaceholderKeyword || 'DELETE',
        inputType: 'text'
      };
    };

    const normalizeDeleteConfirmationValue = (value) =>
      String(value || '').trim().toLowerCase();

    const promptDeleteAccountConfirmation = async (accountUser) => {
      const confirmation = getDeleteAccountConfirmationConfig(accountUser);
      const title = profileCopy.deleteAccountConfirmTitle || 'Delete account';
      const messageText = profileCopy.deleteAccountConfirmMessage || 'This action is permanent.';
      if (!hasIonAlert()) {
        const promptMessage = `${title}\n\n${messageText}\n\n${confirmation.label}`;
        return window.prompt(promptMessage, '');
      }
      const alert = document.createElement('ion-alert');
      alert.header = title;
      alert.subHeader = confirmation.label;
      alert.message = messageText;
      alert.inputs = [
        {
          name: 'confirmationValue',
          type: confirmation.inputType,
          placeholder: confirmation.placeholder,
          attributes: {
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false'
          }
        }
      ];
      alert.buttons = [
        {
          text: profileCopy.deleteAccountConfirmCancel || 'Cancel',
          role: 'cancel'
        },
        {
          text: profileCopy.deleteAccountConfirmAccept || 'Delete',
          role: 'confirm'
        }
      ];
      document.body.appendChild(alert);
      await alert.present();
      const result = await alert.onDidDismiss();
      alert.remove();
      if (!result || result.role !== 'confirm') return null;
      const values = result.data && result.data.values ? result.data.values : {};
      return values && typeof values.confirmationValue === 'string'
        ? values.confirmationValue
        : '';
    };


    this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
      const nextLocale = getNextLocaleCode(getActiveLocale() || 'en');
      setLocaleOverride(nextLocale);
      if (window.varGlobal && typeof window.varGlobal === 'object') {
        window.varGlobal.locale = nextLocale;
      }
      window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
    });

    profileEarnedBadgesEl?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target ? target.closest('[data-badge-id]') : null;
      if (!button) return;
      const badgeId = String(button.dataset.badgeId || '').trim();
      if (!badgeId) return;
      if (typeof window.openSpeakBadgePopup === 'function') {
        window.openSpeakBadgePopup(badgeId).catch(() => {});
      }
    });

    const updateProfileNote = () => {
      if (!profileSaveNote) return;
      const passwordError = getPasswordError();
      if (this.profileSaveMessage) {
        profileSaveNote.textContent = this.profileSaveMessage;
        profileSaveNote.classList.toggle('error', this.profileSaveError === true);
        return;
      }
      if (passwordError) {
        profileSaveNote.textContent = passwordError;
        profileSaveNote.classList.add('error');
        return;
      }
      profileSaveNote.textContent = '';
      profileSaveNote.classList.remove('error');
    };

    const updateSaveState = () => {
      const passwordError = getPasswordError();
      const dirty = hasProfileChanges();
      const pending = this.profileSavePending === true;
      if (profileSaveBtn) {
        profileSaveBtn.disabled = !dirty || !!passwordError || pending;
      }
      if (profileLogoutBtn) profileLogoutBtn.disabled = pending;
      if (profileDeleteAccountBtn) profileDeleteAccountBtn.disabled = pending;
      if (avatarUploadBtn) avatarUploadBtn.disabled = pending;
      if (avatarDeleteBtn) avatarDeleteBtn.disabled = pending;
      if (avatarInput) avatarInput.disabled = pending;
      updateProfileNote();
    };

    const markProfileDirty = () => {
      this.profileSaveMessage = '';
      this.profileSaveError = false;
      updateSaveState();
    };

    const setProfileMessage = (message, isError) => {
      this.profileSaveMessage = message;
      this.profileSaveError = !!isError;
      updateSaveState();
    };

    const avatarConfig = {
      maxBytes: 500000,
      types: {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/gif': 'gif'
      },
      exts: ['jpg', 'jpeg', 'png', 'gif']
    };

    const getAvatarExt = (file) => {
      if (file && file.type && avatarConfig.types[file.type]) {
        return avatarConfig.types[file.type];
      }
      if (file && file.name && file.name.includes('.')) {
        return file.name.split('.').pop().toLowerCase();
      }
      return 'jpeg';
    };

    const validateAvatarFile = (file) => {
      if (!file) {
        return { ok: false, message: profileCopy.fileReadError || 'Could not read the file.' };
      }
      if (file.type) {
        if (!avatarConfig.types[file.type]) {
          return { ok: false, message: profileCopy.fileFormatError || 'Unsupported format. Use JPG, PNG or GIF.' };
        }
      } else {
        const ext = getAvatarExt(file);
        if (!avatarConfig.exts.includes(ext)) {
          return { ok: false, message: profileCopy.fileFormatError || 'Unsupported format. Use JPG, PNG or GIF.' };
        }
      }
      if (file.size && file.size > avatarConfig.maxBytes) {
        return { ok: false, message: profileCopy.fileTooLarge || 'File too large. Max 500 KB.' };
      }
      return { ok: true, message: '' };
    };

    const applyProfileField = (field, value) => {
      if (!this.profileFormState) return;
      this.profileFormState[field] = value;
      markProfileDirty();
    };

    profileFirstName?.addEventListener('input', (event) => {
      applyProfileField('first_name', event.target.value);
    });
    profileLastName?.addEventListener('input', (event) => {
      applyProfileField('last_name', event.target.value);
    });
    profilePassword?.addEventListener('input', (event) => {
      applyProfileField('password', event.target.value);
    });
    profilePasswordConfirm?.addEventListener('input', (event) => {
      applyProfileField('passwordConfirm', event.target.value);
    });
    this.querySelector('#profile-password-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#profile-password');
      const iconEl = this.querySelector('#profile-password-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });
    this.querySelector('#profile-password-confirm-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#profile-password-confirm');
      const iconEl = this.querySelector('#profile-password-confirm-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });

    const clearLocalAvatar = async (targetUser) => {
      const fs = window.Capacitor?.Plugins?.Filesystem;
      if (!fs || !targetUser || targetUser.id === undefined || targetUser.id === null) return;
      const path = targetUser.image_path || `avatars/${targetUser.id}.jpg`;
      try {
        await fs.deleteFile({ path, directory: 'DATA' });
      } catch (err) {
        // no-op
      }
    };

    const updateLocalUser = (nextUser) => {
      if (typeof window.setUser === 'function') {
        window.setUser(nextUser);
      } else {
        window.user = nextUser;
        try {
          localStorage.setItem('appv5:user', JSON.stringify(nextUser));
        } catch (err) {
          console.error('[profile] error guardando usuario', err);
        }
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: nextUser }));
      }
      return nextUser;
    };

    const submitProfileUpdate = async () => {
      if (!user || !profileSaveBtn) return;
      const passwordError = getPasswordError();
      if (passwordError) {
        setProfileMessage(passwordError, true);
        return;
      }
      if (!hasProfileChanges()) {
        setProfileMessage('', false);
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      const firstName = String(profileState.first_name || '').trim();
      const lastName = String(profileState.last_name || '').trim();
      const profileLocaleEl = this.querySelector('#profile-locale');
      const chosenLocale = profileLocaleEl ? profileLocaleEl.value : (rawLocaleSetting || 'es');
      const payload = {
        first_name: firstName,
        last_name: lastName,
        birthdate: profileSeed.birthdate || '1901-01-01',
        sex: profileSeed.sex,
        lc: profileSeed.lc,
        locale: chosenLocale
      };
      if (profileState.password) {
        payload.password = String(profileState.password);
      }
      const result = await doPost('/v3/usr/updateprofile', user, payload);
      this.profileSavePending = false;
      if (!result.ok) {
        const message =
          (result && result.data && result.data.error) ||
          (result && result.error) ||
          profileCopy.profileUpdateFailed ||
          'Could not update profile.';
        setProfileMessage(message, true);
        updateSaveState();
        return;
      }
      setAppLocale(chosenLocale);
      clearLocaleOverride();
      if (window.varGlobal && typeof window.varGlobal === 'object') {
        window.varGlobal.locale = chosenLocale;
      }
      const nextUser = {
        ...user,
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        lc: profileSeed.lc,
        locale: chosenLocale
      };
      resetProfileState(nextUser);
      setProfileMessage(profileCopy.profileUpdated || 'Profile updated.', false);
      updateLocalUser(nextUser);
      updateSaveState();
    };

    profileSaveBtn?.addEventListener('click', () => {
      submitProfileUpdate().catch((err) => {
        console.error('[profile] error guardando perfil', err);
        setProfileMessage(profileCopy.profileUpdateFailed || 'Could not update profile.', true);
      });
    });

    this.querySelector('#profile-logout-btn')?.addEventListener('click', () => {
      if (typeof window.setUser === 'function') {
        window.setUser(null);
      }
    });

    const deleteAccount = async () => {
      if (!user) return;
      const confirmation = getDeleteAccountConfirmationConfig(user);
      const typedValue = await promptDeleteAccountConfirmation(user);
      if (typedValue === null) return;
      if (
        normalizeDeleteConfirmationValue(typedValue) !==
        normalizeDeleteConfirmationValue(confirmation.value)
      ) {
        setProfileMessage(
          profileCopy.deleteAccountConfirmMismatch || 'The confirmation does not match.',
          true
        );
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      try {
        const result = await doPost('/v3/usr/deleteaccount', user, {
          confirmation_type: confirmation.kind,
          confirmation_value: String(typedValue || '').trim(),
          locale: rawLocaleSetting || 'es',
          source: 'profile'
        });
        if (!result.ok) {
          const message =
            (result &&
              result.data &&
              typeof result.data === 'object' &&
              result.data.error) ||
            (result && result.error) ||
            profileCopy.deleteAccountFailed ||
            'Could not delete the account.';
          setProfileMessage(message, true);
          return;
        }
        await clearLocalAvatar(user);
        if (typeof window.setUser === 'function') {
          window.setUser(null);
        }
        await presentProfileAlert(
          profileCopy.deleteAccountDeletedTitle || 'Account deleted',
          profileCopy.deleteAccountDeletedMessage ||
            'Your account has been deleted and you have been signed out.'
        );
      } catch (err) {
        console.error('[profile] error eliminando cuenta', err);
        setProfileMessage(
          profileCopy.deleteAccountFailed || 'Could not delete the account.',
          true
        );
      } finally {
        this.profileSavePending = false;
        updateSaveState();
      }
    };

    profileDeleteAccountBtn?.addEventListener('click', () => {
      deleteAccount();
    });

    const uploadAvatar = async (file) => {
      if (!user || !file) return;
      const validation = validateAvatarFile(file);
      if (!validation.ok) {
        setProfileMessage(validation.message, true);
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      const apiURL =
        (window.varGlobal && window.varGlobal.apiURL) ||
        (window.env === 'PRO' ? window.apiPRO : window.apiDEV) ||
        '';
      const timestamp = Math.round(Date.now() / 1000);
      const query = new URLSearchParams({
        timestamp: String(timestamp),
        user_id: String(user.id),
        token: String(user.token || '')
      }).toString();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);
      formData.append('token', user.token || '');
      formData.append('timestamp', timestamp);
      try {
        const response = await fetch(`${apiURL}/v3/fileupload?${query}`, {
          method: 'POST',
          headers: {
            Authorization: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'X-Platform': deviceId()
          },
          body: formData
        });
        const text = await response.text();
        let payload = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch (err) {
            payload = null;
          }
        }
        if (!response.ok || (payload && payload.error)) {
          const message =
            (payload && payload.error) ||
            profileCopy.avatarUploadFailed ||
            'Could not upload avatar.';
          setProfileMessage(message, true);
          this.profileSavePending = false;
          updateSaveState();
          return;
        }
        const imageUrl = payload && payload.image_url ? String(payload.image_url) : '';
        const avatarFileName =
          payload && payload.avatar_file_name ? String(payload.avatar_file_name) : '';
        const ext = getAvatarExt(file);
        const baseAvatar =
          imageUrl ||
          `https://s3.amazonaws.com/sk.assets/avatars/${user.id}/avatarv4.${ext}`;
        const cacheBust = baseAvatar.includes('?') ? '&ts=' : '?ts=';
        const nextAvatar = `${baseAvatar}${cacheBust}${Date.now()}`;
        const resolvedAvatarFileName = avatarFileName || nextAvatar.split('/').pop().split('?')[0];
        const nextUser = {
          ...user,
          image: nextAvatar,
          avatar_file_name: resolvedAvatarFileName,
          image_local: '',
          image_path: ''
        };
        await clearLocalAvatar(user);
        if (typeof refreshUserAvatarLocal === 'function') {
          refreshUserAvatarLocal(nextUser, { force: true });
        }
        this.profileSavePending = false;
        resetProfileState(nextUser);
        setProfileMessage(profileCopy.avatarUpdated || 'Avatar updated.', false);
        updateLocalUser(nextUser);
      } catch (err) {
        console.error('[profile] error subiendo avatar', err);
        this.profileSavePending = false;
        setProfileMessage(profileCopy.avatarUploadFailed || 'Could not upload avatar.', true);
      }
    };

    const deleteAvatar = async () => {
      if (!user) return;
      this.profileSavePending = true;
      updateSaveState();
      const apiURL =
        (window.varGlobal && window.varGlobal.apiURL) ||
        (window.env === 'PRO' ? window.apiPRO : window.apiDEV) ||
        '';
      const timestamp = Math.round(Date.now() / 1000);
      const query = new URLSearchParams({
        timestamp: String(timestamp),
        user_id: String(user.id),
        token: String(user.token || '')
      }).toString();
      const payload = {
        user_id: user.id,
        token: user.token || '',
        timestamp
      };
      try {
        const response = await fetch(`${apiURL}/v3/deleteUserImage?${query}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'X-Platform': deviceId()
          },
          body: JSON.stringify(payload)
        });
        const text = await response.text();
        let resPayload = null;
        if (text) {
          try {
            resPayload = JSON.parse(text);
          } catch (err) {
            resPayload = null;
          }
        }
        if (!response.ok || (resPayload && resPayload.error)) {
          const message =
            (resPayload && resPayload.error) ||
            profileCopy.avatarDeleteFailed ||
            'Could not delete avatar.';
          setProfileMessage(message, true);
          this.profileSavePending = false;
          updateSaveState();
          return;
        }
        const baseAvatar =
          (resPayload && resPayload.image_url ? String(resPayload.image_url) : '') ||
          'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif';
        const nextAvatar = `${baseAvatar}${baseAvatar.includes('?') ? '&ts=' : '?ts='}${Date.now()}`;
        const nextAvatarFileName =
          resPayload && resPayload.avatar_file_name ? String(resPayload.avatar_file_name) : '';
        const nextUser = {
          ...user,
          avatar_file_name: nextAvatarFileName,
          image: nextAvatar,
          image_local: '',
          image_path: ''
        };
        await clearLocalAvatar(nextUser);
        this.profileSavePending = false;
        resetProfileState(nextUser);
        setProfileMessage(profileCopy.avatarDeleted || 'Avatar deleted.', false);
        updateLocalUser(nextUser);
      } catch (err) {
        console.error('[profile] error eliminando avatar', err);
        this.profileSavePending = false;
        setProfileMessage(profileCopy.avatarDeleteFailed || 'Could not delete avatar.', true);
      }
    };

    avatarUploadBtn?.addEventListener('click', () => {
      if (avatarInput) avatarInput.click();
    });

    avatarInput?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if (!file) return;
      const validation = validateAvatarFile(file);
      if (!validation.ok) {
        setProfileMessage(validation.message, true);
        event.target.value = '';
        return;
      }
      uploadAvatar(file);
      event.target.value = '';
    });

    avatarDeleteBtn?.addEventListener('click', () => {
      deleteAvatar();
    });

    const linkButtons = Array.from(this.querySelectorAll('.profile-link-btn'));
    linkButtons.forEach((button) => {
      const action = button.dataset.action;
      const fnName = action === 'contact' ? 'sendMail' : action === 'legal' ? 'goWebLegal' : '';
      const fn = fnName ? window[fnName] : null;
      if (typeof fn !== 'function') {
        button.disabled = true;
        return;
      }
      button.addEventListener('click', () => {
        try {
          fn();
        } catch (err) {
          console.error('[profile] error ejecutando accion', err);
        }
      });
    });

    const tabButtons = Array.from(this.querySelectorAll('.profile-segmented-btn'));
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        this.settingsOpen = false;
        persistProfileTab(tab);
        this.render();
      });
    });
    this.querySelector('#profile-settings-toggle')?.addEventListener('click', () => {
      this.settingsOpen = !(this.settingsOpen === true);
      this.render();
    });
    profileSettingsBackBtn?.addEventListener('click', () => {
      this.settingsOpen = false;
      this.render();
    });

    updateSaveState();

    const filterButtons = Array.from(this.querySelectorAll('.review-filter-btn'));
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tone = button.dataset.tone;
        if (!tone || tone === this.reviewTone) return;
        this.reviewTone = tone === 'okay' ? 'okay' : 'bad';
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        window.r34lp0w3r.profileReviewTone = this.reviewTone;
        this.render();
      });
    });

    const reviewCollapseBlocks = Array.from(this.querySelectorAll('[data-review-collapse]'));
    reviewCollapseBlocks.forEach((contentEl) => {
      const container = contentEl.closest('.profile-review-block');
      const toggleBtn = container ? container.querySelector('.profile-review-more') : null;
      if (!container || !toggleBtn) return;
      const collapsedHeight = Math.max(0, Number(contentEl.dataset.collapsedHeight) || 0);
      const applyCollapseState = () => {
        const shouldCollapse = collapsedHeight > 0 && contentEl.scrollHeight > collapsedHeight + 4;
        container.classList.toggle('is-collapsible', shouldCollapse);
        if (!shouldCollapse) {
          container.classList.remove('is-expanded');
          toggleBtn.hidden = true;
          return;
        }
        toggleBtn.hidden = false;
        toggleBtn.textContent = container.classList.contains('is-expanded')
          ? profileCopy.reviewLess || 'Less'
          : profileCopy.reviewMore || 'More';
      };
      requestAnimationFrame(applyCollapseState);
      toggleBtn.addEventListener('click', () => {
        container.classList.toggle('is-expanded');
        toggleBtn.textContent = container.classList.contains('is-expanded')
          ? profileCopy.reviewLess || 'Less'
          : profileCopy.reviewMore || 'More';
      });
    });

    const findSessionLocation = (sessionId) => {
      if (!sessionId) return null;
      const entry = sessionLookup.get(sessionId);
      return entry ? { routeId: entry.routeId, moduleId: entry.moduleId, sessionId } : null;
    };

    const reviewButtons = Array.from(this.querySelectorAll('.review-entry'));
    reviewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.type;
        if (type === 'reference-test') {
          const courseCode = String(button.dataset.courseCode || '').trim();
          const unitCode = String(button.dataset.unitCode || '').trim();
          const lessonCode = String(button.dataset.lessonCode || '').trim();
          const testKey = String(button.dataset.testKey || '').trim();
          if (!courseCode || !unitCode || !lessonCode || !testKey) return;
          if (!window.r34lp0w3r) window.r34lp0w3r = {};
          window.r34lp0w3r.profileForceTab = 'review';
          window.r34lp0w3r.profileReviewTone = this.reviewTone;
          window.r34lp0w3r.referenceDeepLink = {
            courseCode,
            unitCode,
            lessonCode,
            testKey,
            tab: 'tests'
          };
          const referencePage = document.querySelector('page-reference');
          if (referencePage && typeof referencePage.render === 'function') {
            try {
              referencePage.render();
            } catch (err) {
              console.error('[profile] error abriendo test de reference', err);
            }
          }
          const tabs = document.querySelector('ion-tabs');
          if (tabs && typeof tabs.select === 'function') {
            tabs.select('reference').catch(() => {});
          }
          return;
        }
        const sessionId = button.dataset.sessionId;
        const location = findSessionLocation(sessionId);
        if (!location) return;
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        if (type === 'phrase') {
          window.r34lp0w3r.speakStartStep = 'sentence';
          window.r34lp0w3r.speakStartWord = null;
        } else {
          const word = button.dataset.word;
          if (!word) return;
          window.r34lp0w3r.speakStartStep = 'spelling';
          window.r34lp0w3r.speakStartWord = word;
        }
        window.r34lp0w3r.speakReturnToReview = true;
        window.r34lp0w3r.speakReturnSessionId = sessionId;
        window.r34lp0w3r.profileForceTab = 'review';
        window.r34lp0w3r.profileReviewTone = this.reviewTone;
        setSelection(location);
        goToSpeak('forward');
      });
    });

    updateProfileState(user);
    updateHeaderRewards();

    const applyAppMeta = (meta) => {
      if (!appMetaEl) return;
      appMetaEl.textContent = formatAppMeta(meta);
    };
    applyAppMeta(window.appMeta);
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin && typeof appPlugin.getInfo === 'function') {
      appPlugin
        .getInfo()
        .then((info) => {
          if (!info || typeof info !== 'object') return;
          window.appMeta = { ...(window.appMeta || {}), ...info };
          applyAppMeta(window.appMeta);
        })
        .catch(() => {});
    }
    if (this._metaHandler) {
      window.removeEventListener('app:meta-change', this._metaHandler);
    }
    this._metaHandler = (event) => {
      const meta = event && event.detail ? event.detail : window.appMeta;
      applyAppMeta(meta);
    };
    window.addEventListener('app:meta-change', this._metaHandler);
  }
}

customElements.define('page-profile', PageProfile);
