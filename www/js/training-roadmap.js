const STORAGE_KEY = 'appv5:training-roadmap-enabled';
const MARKER_SIZE_STORAGE_KEY = 'appv5:training-roadmap-marker-size';
const SPACING_STORAGE_KEY = 'appv5:training-roadmap-spacing';
export const TRAINING_ROADMAP_CHANGE_EVENT = 'app:training-roadmap-change';

const normalizeEnabled = (value) => {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'on', 'yes'].includes(String(value || '').trim().toLowerCase());
};

export const isTrainingRoadmapEnabled = () => {
  const runtime = window.r34lp0w3r;
  if (runtime && Object.prototype.hasOwnProperty.call(runtime, 'trainingRoadmapEnabled')) {
    return normalizeEnabled(runtime.trainingRoadmapEnabled);
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : normalizeEnabled(stored);
  } catch (_err) {
    return true;
  }
};

export const setTrainingRoadmapEnabled = (enabled) => {
  const normalized = normalizeEnabled(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.trainingRoadmapEnabled = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, normalized ? '1' : '0');
  } catch (_err) {
    // Runtime state remains available when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(TRAINING_ROADMAP_CHANGE_EVENT, { detail: { enabled: normalized } })
  );
  return normalized;
};

const normalizeMarkerSize = (value) => ['small', 'tiny'].includes(value) ? value : 'large';
const normalizeSpacing = (value) => ['compact', 'tight'].includes(value) ? value : 'wide';

export const getTrainingRoadmapMarkerSize = () => {
  try { return normalizeMarkerSize(localStorage.getItem(MARKER_SIZE_STORAGE_KEY)); } catch (_err) { return 'large'; }
};

export const getTrainingRoadmapSpacing = () => {
  try { return normalizeSpacing(localStorage.getItem(SPACING_STORAGE_KEY)); } catch (_err) { return 'wide'; }
};

const dispatchRoadmapChange = () => {
  window.dispatchEvent(new CustomEvent(TRAINING_ROADMAP_CHANGE_EVENT, {
    detail: {
      enabled: isTrainingRoadmapEnabled(),
      markerSize: getTrainingRoadmapMarkerSize(),
      spacing: getTrainingRoadmapSpacing()
    }
  }));
};

export const setTrainingRoadmapMarkerSize = (value) => {
  const normalized = normalizeMarkerSize(value);
  try { localStorage.setItem(MARKER_SIZE_STORAGE_KEY, normalized); } catch (_err) {}
  dispatchRoadmapChange();
  return normalized;
};

export const setTrainingRoadmapSpacing = (value) => {
  const normalized = normalizeSpacing(value);
  try { localStorage.setItem(SPACING_STORAGE_KEY, normalized); } catch (_err) {}
  dispatchRoadmapChange();
  return normalized;
};
