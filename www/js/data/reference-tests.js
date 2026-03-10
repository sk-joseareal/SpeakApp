const LOCAL_REFERENCE_TESTS_URL = new URL('../../lessons/contenido_tests_es_en.json', import.meta.url).toString();

let dataCache = null;
let dataPromise = null;
let dataLoadInfo = {
  status: 'idle',
  loadedAt: null,
  requestUrl: '',
  source: '',
  triedUrls: [],
  errors: []
};

const asText = (value) => String(value === undefined || value === null ? '' : value).trim();

const normalizeLocale = (value) => {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'es' || normalized === 'es-es') return 'es';
  if (normalized === 'en' || normalized === 'en-us') return 'en';
  return '';
};

const uniq = (values) => {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const item = asText(value);
    if (!item || seen.has(item)) return;
    seen.add(item);
    out.push(item);
  });
  return out;
};

const getConfiguredReferenceTestsUrls = () => {
  if (typeof window === 'undefined') return [LOCAL_REFERENCE_TESTS_URL];
  const globals = [
    window.SPEAK_REFERENCE_TESTS_URL,
    window.REFERENCE_TESTS_URL,
    window.contentConfig && window.contentConfig.referenceTestsUrl
  ];
  const configured = uniq(globals);
  const out = [...configured];
  if (!out.includes(LOCAL_REFERENCE_TESTS_URL)) out.push(LOCAL_REFERENCE_TESTS_URL);
  return out;
};

const getLocalizedValue = (source, locale = 'en') => {
  if (source === undefined || source === null) return '';
  if (typeof source === 'string' || typeof source === 'number') return String(source);
  if (typeof source !== 'object') return '';
  const localeCode = normalizeLocale(locale) || 'en';
  const en = asText(source.en);
  const es = asText(source.es);
  if (localeCode === 'es') return es || en || '';
  return en || es || '';
};

const normalizeQuestion = (question) => {
  if (!question || typeof question !== 'object') return null;
  return {
    ...question,
    code: asText(question.code),
    text: asText(question.text),
    interaction: asText(question.interaction),
    answer:
      question.answer && typeof question.answer === 'object'
        ? {
            raw: asText(question.answer.raw),
            accepted: Array.isArray(question.answer.accepted)
              ? question.answer.accepted.map((item) => asText(item)).filter(Boolean)
              : [],
            accepted_placeholders: Array.isArray(question.answer.accepted_placeholders)
              ? question.answer.accepted_placeholders
                  .map((item) =>
                    Array.isArray(item) ? item.map((part) => asText(part)).filter(Boolean) : []
                  )
                  .filter((parts) => parts.length)
              : []
          }
        : {
            raw: '',
            accepted: [],
            accepted_placeholders: []
          },
    options: Array.isArray(question.options)
      ? question.options
          .filter((option) => option && option.code !== undefined && option.code !== null)
          .map((option) => ({
            ...option,
            code: asText(option.code),
            text: asText(option.text),
            correct: Boolean(option.correct)
          }))
      : []
  };
};

const normalizeTest = (test) => {
  if (!test || typeof test !== 'object') return null;
  return {
    ...test,
    code: asText(test.code),
    order: Number(test.order) || 0,
    lesson_section_code: asText(test.lesson_section_code),
    test_type: test.test_type === undefined || test.test_type === null ? '' : asText(test.test_type),
    primary_interaction: asText(test.primary_interaction),
    interactions: Array.isArray(test.interactions) ? test.interactions.map((item) => asText(item)).filter(Boolean) : [],
    question_types: Array.isArray(test.question_types) ? test.question_types.map((item) => Number(item) || 0) : [],
    subtypes: Array.isArray(test.subtypes) ? test.subtypes.map((item) => (item === null ? null : Number(item) || 0)) : [],
    header:
      test.header && typeof test.header === 'object'
        ? {
            ...test.header,
            title: test.header.title && typeof test.header.title === 'object' ? test.header.title : {},
            instruction:
              test.header.instruction && typeof test.header.instruction === 'object'
                ? test.header.instruction
                : {},
            word_bank:
              test.header.word_bank && typeof test.header.word_bank === 'object'
                ? {
                    es: Array.isArray(test.header.word_bank.es)
                      ? test.header.word_bank.es.map((item) => asText(item)).filter(Boolean)
                      : [],
                    en: Array.isArray(test.header.word_bank.en)
                      ? test.header.word_bank.en.map((item) => asText(item)).filter(Boolean)
                      : []
                  }
                : { es: [], en: [] }
          }
        : {
            title: {},
            instruction: {},
            word_bank: { es: [], en: [] }
          },
    questions: Array.isArray(test.questions) ? test.questions.map(normalizeQuestion).filter(Boolean) : []
  };
};

const normalizeCollection = (raw) => {
  const courses = Array.isArray(raw && raw.cursos) ? raw.cursos : [];
  return {
    counts: raw && typeof raw.counts === 'object' ? raw.counts : {},
    cursos: courses
      .filter((course) => course && course.code !== undefined && course.code !== null)
      .map((course) => ({
        ...course,
        code: asText(course.code),
        order: Number(course.order) || 0,
        unidades: Array.isArray(course.unidades)
          ? course.unidades
              .filter((unit) => unit && unit.code !== undefined && unit.code !== null)
              .map((unit) => ({
                ...unit,
                code: asText(unit.code),
                order: Number(unit.order) || 0,
                tests_unidad: Array.isArray(unit.tests_unidad)
                  ? unit.tests_unidad.map(normalizeTest).filter(Boolean)
                  : [],
                lecciones: Array.isArray(unit.lecciones)
                  ? unit.lecciones
                      .filter((lesson) => lesson && lesson.code !== undefined && lesson.code !== null)
                      .map((lesson) => ({
                        ...lesson,
                        code: asText(lesson.code),
                        order: Number(lesson.order) || 0,
                        tests: Array.isArray(lesson.tests) ? lesson.tests.map(normalizeTest).filter(Boolean) : []
                      }))
                  : []
              }))
          : []
      }))
  };
};

const loadReferenceTestsData = async () => {
  if (dataCache) return dataCache;
  if (!dataPromise) {
    dataPromise = (async () => {
      const urls = getConfiguredReferenceTestsUrls();
      const errors = [];
      dataLoadInfo = {
        status: 'loading',
        loadedAt: null,
        requestUrl: '',
        source: '',
        triedUrls: urls.slice(),
        errors: []
      };

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`reference tests: ${res.status}`);
          const raw = await res.json();
          dataCache = normalizeCollection(raw);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: url,
            source: url === LOCAL_REFERENCE_TESTS_URL ? 'local' : 'remote',
            triedUrls: urls.slice(),
            errors: errors.map((entry) => ({ ...entry }))
          };
          dataPromise = null;
          return dataCache;
        } catch (err) {
          errors.push({
            url,
            message: err && err.message ? err.message : String(err)
          });
        }
      }

      dataCache = { counts: {}, cursos: [] };
      dataLoadInfo = {
        status: 'error',
        loadedAt: new Date().toISOString(),
        requestUrl: '',
        source: '',
        triedUrls: urls.slice(),
        errors: errors.slice()
      };
      dataPromise = null;
      return dataCache;
    })();
  }
  return dataPromise;
};

const getReferenceTestCourses = () =>
  dataCache && Array.isArray(dataCache.cursos) ? dataCache.cursos : [];

const getReferenceTestsForSelection = (selection = {}) => {
  const courses = getReferenceTestCourses();
  const courseCode = asText(selection.courseCode);
  const unitCode = asText(selection.unitCode);
  const lessonCode = asText(selection.lessonCode);

  const course = courses.find((item) => asText(item.code) === courseCode) || null;
  const units = course && Array.isArray(course.unidades) ? course.unidades : [];
  const unit = units.find((item) => asText(item.code) === unitCode) || null;
  const lessons = unit && Array.isArray(unit.lecciones) ? unit.lecciones : [];
  const lesson = lessons.find((item) => asText(item.code) === lessonCode) || null;

  const unitTests = unit && Array.isArray(unit.tests_unidad) ? unit.tests_unidad.slice() : [];
  const lessonTests = lesson && Array.isArray(lesson.tests) ? lesson.tests.slice() : [];

  return {
    course,
    unit,
    lesson,
    unitTests,
    lessonTests,
    allTests: [...lessonTests.map((test) => ({ scope: 'lesson', test })), ...unitTests.map((test) => ({ scope: 'unit', test }))]
  };
};

const ensureReferenceTestsData = async () => {
  await loadReferenceTestsData();
  return dataCache;
};

const getReferenceTestsLoadInfo = () => ({
  ...dataLoadInfo,
  triedUrls: Array.isArray(dataLoadInfo.triedUrls) ? dataLoadInfo.triedUrls.slice() : [],
  errors: Array.isArray(dataLoadInfo.errors)
    ? dataLoadInfo.errors.map((entry) => ({ ...entry }))
    : []
});

export {
  ensureReferenceTestsData,
  getLocalizedValue as getLocalizedReferenceTestValue,
  getReferenceTestCourses,
  getReferenceTestsForSelection,
  getReferenceTestsLoadInfo
};
