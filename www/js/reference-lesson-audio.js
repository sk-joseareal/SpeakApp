const STORAGE_KEY = 'appv5:reference-lesson-audio-enabled';
export const REFERENCE_LESSON_AUDIO_CHANGE_EVENT = 'app:reference-lesson-audio-change';

const normalizeEnabled = (value) => {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'on', 'yes'].includes(String(value || '').trim().toLowerCase());
};

export const isReferenceLessonAudioEnabled = () => {
  const runtime = window.r34lp0w3r;
  if (runtime && Object.prototype.hasOwnProperty.call(runtime, 'referenceLessonAudioEnabled')) {
    return normalizeEnabled(runtime.referenceLessonAudioEnabled);
  }
  try {
    return normalizeEnabled(localStorage.getItem(STORAGE_KEY));
  } catch (_err) {
    return false;
  }
};

export const setReferenceLessonAudioEnabled = (enabled) => {
  const normalized = normalizeEnabled(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.referenceLessonAudioEnabled = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, normalized ? '1' : '0');
  } catch (_err) {
    // Runtime state still keeps the setting usable when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(REFERENCE_LESSON_AUDIO_CHANGE_EVENT, {
      detail: { enabled: normalized }
    })
  );
  return normalized;
};
