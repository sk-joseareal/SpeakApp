export const readPersistedSheetState = (expandedKey, offsetKey) => {
  let expanded = false;
  let offset = 0;
  try {
    expanded = localStorage.getItem(expandedKey) === 'true';
    if (expanded) {
      const parsed = parseInt(localStorage.getItem(offsetKey) || '0', 10);
      if (Number.isFinite(parsed) && parsed > 0) offset = parsed;
    }
  } catch (_) {
    expanded = false;
    offset = 0;
  }
  return { expanded, offset };
};

export const persistSheetState = (expandedKey, offsetKey, expanded, offset) => {
  try {
    localStorage.setItem(expandedKey, expanded ? 'true' : 'false');
    if (expanded && Number.isFinite(offset) && offset > 0) {
      localStorage.setItem(offsetKey, String(Math.round(offset)));
    }
  } catch (_) {
    // no-op
  }
};
