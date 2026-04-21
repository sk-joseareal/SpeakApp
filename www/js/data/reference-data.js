const LOCAL_REFERENCE_URL = new URL('./reference-data.json', import.meta.url).toString();
const DEV_REFERENCE_URL = '/lessons/contenido_lecciones_view_es_en.json';
const SELECTION_STORAGE_KEY = 'appv5:reference-selection';

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

const getConfiguredReferenceUrls = () => {
  if (typeof window === 'undefined') return [LOCAL_REFERENCE_URL];
  const globals = [
    window.SPEAK_REFERENCE_DATA_URL,
    window.REFERENCE_DATA_URL,
    window.contentConfig && window.contentConfig.referenceDataUrl
  ];
  const configured = uniq(globals);
  const out = [...configured];
  if (!out.includes(LOCAL_REFERENCE_URL)) out.push(LOCAL_REFERENCE_URL);
  if (!out.includes(DEV_REFERENCE_URL)) out.push(DEV_REFERENCE_URL);
  return out;
};

const readStoredSelection = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      courseCode: asText(parsed.courseCode),
      unitCode: asText(parsed.unitCode),
      lessonCode: asText(parsed.lessonCode)
    };
  } catch (err) {
    return null;
  }
};

const writeStoredSelection = (value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(value));
  } catch (err) {
    // no-op
  }
};

let selection = readStoredSelection() || { courseCode: '', unitCode: '', lessonCode: '' };

const normalizeCollection = (raw) => {
  const courses = Array.isArray(raw && raw.cursos) ? raw.cursos : [];
  return {
    cursos: courses
      .filter((course) => course && course.code !== undefined && course.code !== null)
      .map((course) => ({
        ...course,
        unidades: Array.isArray(course.unidades)
          ? course.unidades
              .filter((unit) => unit && unit.code !== undefined && unit.code !== null)
              .map((unit) => ({
                ...unit,
                lecciones: Array.isArray(unit.lecciones)
                  ? unit.lecciones.filter(
                      (lesson) => lesson && lesson.code !== undefined && lesson.code !== null
                    )
                  : []
              }))
          : []
      }))
  };
};

const loadReferenceData = async () => {
  if (dataCache) return dataCache;
  if (!dataPromise) {
    dataPromise = (async () => {
      const urls = getConfiguredReferenceUrls();
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
          if (!res.ok) throw new Error(`reference data: ${res.status}`);
          const raw = await res.json();
          dataCache = normalizeCollection(raw);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: url,
            source: url === LOCAL_REFERENCE_URL ? 'local' : url === DEV_REFERENCE_URL ? 'dev-lessons' : 'remote',
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

      dataCache = { cursos: [] };
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

const getReferenceCourses = () =>
  dataCache && Array.isArray(dataCache.cursos)
    ? dataCache.cursos.filter((c) => c.typeCourse !== 2)
    : [];

const getReferenceSpecialCourses = () =>
  dataCache && Array.isArray(dataCache.cursos)
    ? dataCache.cursos.filter((c) => c.typeCourse === 2)
    : [];

const resolveReferenceSelection = (nextSelection = selection) => {
  const courses = getReferenceCourses();
  if (!courses.length) {
    return {
      selection: { courseCode: '', unitCode: '', lessonCode: '' },
      course: null,
      unit: null,
      lesson: null
    };
  }

  const course =
    courses.find((item) => asText(item.code) === asText(nextSelection.courseCode)) || courses[0];
  const units = course && Array.isArray(course.unidades) ? course.unidades : [];
  const unit = units.find((item) => asText(item.code) === asText(nextSelection.unitCode)) || units[0];
  const lessons = unit && Array.isArray(unit.lecciones) ? unit.lecciones : [];
  const lesson =
    lessons.find((item) => asText(item.code) === asText(nextSelection.lessonCode)) || lessons[0];

  return {
    selection: {
      courseCode: course ? asText(course.code) : '',
      unitCode: unit ? asText(unit.code) : '',
      lessonCode: lesson ? asText(lesson.code) : ''
    },
    course,
    unit,
    lesson
  };
};

const ensureReferenceData = async () => {
  await loadReferenceData();
  const resolved = resolveReferenceSelection(selection);
  selection = resolved.selection;
  writeStoredSelection(selection);
  return resolved;
};

const notifySelectionChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('reference:selection-change', { detail: selection }));
};

const setReferenceSelection = (nextSelection) => {
  selection = { ...selection, ...nextSelection };
  if (dataCache) {
    const resolved = resolveReferenceSelection(selection);
    selection = resolved.selection;
  }
  writeStoredSelection(selection);
  notifySelectionChange();
  return selection;
};

const getReferenceSelection = () => ({ ...selection });

const getReferenceDataLoadInfo = () => ({
  ...dataLoadInfo,
  triedUrls: Array.isArray(dataLoadInfo.triedUrls) ? dataLoadInfo.triedUrls.slice() : [],
  errors: Array.isArray(dataLoadInfo.errors)
    ? dataLoadInfo.errors.map((entry) => ({ ...entry }))
    : []
});

const getLocalizedMapField = (entry, field, locale = 'en') => {
  if (!entry || typeof entry !== 'object') return '';
  const localeCode = normalizeLocale(locale) || 'en';
  const source = entry[field];
  if (!source || typeof source !== 'object') return '';
  const en = asText(source.en);
  const es = asText(source.es);
  if (localeCode === 'es') return es || en || '';
  return en || es || '';
};

export {
  ensureReferenceData,
  getLocalizedMapField,
  getReferenceCourses,
  getReferenceSpecialCourses,
  getReferenceDataLoadInfo,
  getReferenceSelection,
  resolveReferenceSelection,
  setReferenceSelection
};
