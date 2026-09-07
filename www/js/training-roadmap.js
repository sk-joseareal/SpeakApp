const STORAGE_KEY = 'appv5:training-roadmap-enabled';
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
    return normalizeEnabled(localStorage.getItem(STORAGE_KEY));
  } catch (_err) {
    return false;
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
