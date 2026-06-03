import { persistSheetState, readPersistedSheetState } from './sheet-state.js';

export const createSheetController = (options) => {
  const {
    expandedKey,
    offsetKey,
    getSheetEl,
    getHandleEl,
    getShellEl,
    getTopInset = () => 0,
    getExpandedLabel = () => 'Collapse card',
    getCollapsedLabel = () => 'Expand card',
    canInteract = () => true
  } = options || {};

  const persisted = readPersistedSheetState(expandedKey, offsetKey);
  const debug =
    typeof window !== 'undefined' &&
    window.r34lp0w3r &&
    window.r34lp0w3r.debugSheetState === true;
  const log = (...args) => {
    if (!debug) return;
    try {
      console.log('[sheet-controller]', ...args);
    } catch (_) {
      // no-op
    }
  };
  const state = {
    expanded: persisted.expanded,
    offset: persisted.offset,
    translateY: 0,
    dragging: false,
    pointerId: null,
    dragStartY: 0,
    dragStartTranslateY: 0,
    dragMoved: false,
    lastPointerUpTs: 0,
    lastInteractionTs: 0
  };

  const AUTO_MEASURE_COOLDOWN_MS = 350;

  const markInteraction = () => {
    state.lastInteractionTs = Date.now();
  };

  const shouldSkipAutoMeasure = (opts = {}) => {
    if (opts.ignoreInteractionCooldown) return false;
    if (state.dragging) return true;
    const sinceInteraction = Date.now() - (state.lastInteractionTs || 0);
    return sinceInteraction >= 0 && sinceInteraction < AUTO_MEASURE_COOLDOWN_MS;
  };

  const readAppliedTranslateY = (sheetEl) => {
    const parseLift = (value) => {
      const lift = Number.parseFloat(String(value || '').trim());
      return Number.isFinite(lift) ? Math.max(0, lift) : null;
    };
    const inlineLift = parseLift(sheetEl?.style?.getPropertyValue('--sheet-lift'));
    if (inlineLift !== null) return -inlineLift;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const computedLift = parseLift(window.getComputedStyle(sheetEl).getPropertyValue('--sheet-lift'));
      if (computedLift !== null) return -computedLift;
    }
    return 0;
  };

  const measureOffset = (opts = {}) => {
    const shellEl = getShellEl();
    const sheetEl = getSheetEl();
    if (!shellEl || !sheetEl) return 0;
    if (shouldSkipAutoMeasure(opts)) {
      return Number.isFinite(state.offset) ? state.offset : 0;
    }
    const shellRect = shellEl.getBoundingClientRect();
    const sheetRect = sheetEl.getBoundingClientRect();
    const currentTranslate = readAppliedTranslateY(sheetEl);
    const targetTop = shellRect.top + Math.max(0, Number(getTopInset()) || 0);
    const offset = Math.max(0, Math.round(sheetRect.top - currentTranslate - targetTop));
    state.offset = offset;
    return offset;
  };

  const applyState = (opts = {}) => {
    const animate = opts.animate !== false;
    const sheetEl = getSheetEl();
    const handleEl = getHandleEl();
    if (!sheetEl) return;

    const offset = state.expanded
      ? (opts.force ? measureOffset({ force: true }) : (state.offset || measureOffset()))
      : 0;
    state.translateY = state.expanded ? -offset : 0;

    sheetEl.dataset.sheetState = state.expanded ? 'expanded' : 'collapsed';
    sheetEl.classList.toggle('is-sheet-dragging', state.dragging);
    sheetEl.classList.toggle('is-sheet-instant', !animate);
    sheetEl.style.setProperty('--sheet-lift', `${Math.max(0, -state.translateY)}px`);

    if (handleEl) {
      handleEl.setAttribute('aria-expanded', state.expanded ? 'true' : 'false');
      handleEl.setAttribute('aria-label', state.expanded ? getExpandedLabel() : getCollapsedLabel());
    }

    if (!animate) {
      sheetEl.getBoundingClientRect();
      requestAnimationFrame(() => {
        if (!sheetEl.isConnected) return;
        sheetEl.classList.remove('is-sheet-instant');
      });
    }
    log('apply', {
      expandedKey,
      expanded: state.expanded,
      offset: state.offset,
      translateY: state.translateY,
      dragging: state.dragging,
      animate
    });
  };

  const setExpanded = (nextExpanded, opts = {}) => {
    const expanded = Boolean(nextExpanded);
    if (state.expanded === expanded && !opts.force) {
      applyState(opts);
      return;
    }
    const measuredOffset = expanded
      ? measureOffset({ force: true, ignoreInteractionCooldown: true })
      : state.offset;
    markInteraction();
    state.expanded = expanded;
    if (expanded) {
      state.offset = measuredOffset;
    }
    if (!opts.skipPersist) {
      persistSheetState(expandedKey, offsetKey, state.expanded, state.offset);
    }
    applyState(opts);
    log('setExpanded', {
      expandedKey,
      expanded: state.expanded,
      offset: state.offset,
      skipPersist: Boolean(opts.skipPersist)
    });
  };

  const toggle = (opts = {}) => setExpanded(!state.expanded, opts);

  const startDrag = (event) => {
    const handleEl = event && event.currentTarget ? event.currentTarget : null;
    const sheetEl = getSheetEl();
    if (!handleEl || !sheetEl || typeof event.pointerId !== 'number') return;
    if (event.button !== 0 || !canInteract()) return;

    state.offset = measureOffset({ force: true, ignoreInteractionCooldown: true });
    markInteraction();
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.dragStartY = event.clientY;
    state.dragStartTranslateY = state.expanded ? -state.offset : 0;
    state.dragMoved = false;
    sheetEl.classList.add('is-sheet-dragging');
    applyState({ animate: false });

    try { handleEl.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!state.dragging) return;
    if (typeof event.pointerId === 'number' && event.pointerId !== state.pointerId) return;
    const sheetEl = getSheetEl();
    if (!sheetEl) return;
    const deltaY = Number(event.clientY) - state.dragStartY;
    const nextTranslate = state.dragStartTranslateY + deltaY;
    const clamped = Math.max(-state.offset, Math.min(0, nextTranslate));
    if (Math.abs(clamped - state.dragStartTranslateY) > 4) state.dragMoved = true;
    state.translateY = clamped;
    sheetEl.style.setProperty('--sheet-lift', `${Math.max(0, -clamped)}px`);
    event.preventDefault();
  };

  const finishDrag = (event) => {
    if (!state.dragging) return;
    if (typeof event.pointerId === 'number' && event.pointerId !== state.pointerId) return;
    const handleEl = getHandleEl();
    const midpoint = -Math.max(0, state.offset) / 2;
    const nextExpanded = state.dragMoved
      ? (Number.isFinite(state.translateY) ? state.translateY : 0) <= midpoint
      : !state.expanded;

    state.dragging = false;
    state.pointerId = null;
    state.dragMoved = false;
    state.lastPointerUpTs = Date.now();
    markInteraction();

    if (handleEl) {
      try {
        if (typeof event.pointerId === 'number' && handleEl.hasPointerCapture(event.pointerId)) {
          handleEl.releasePointerCapture(event.pointerId);
        }
      } catch (_) {}
    }
    setExpanded(nextExpanded, { animate: true });
  };

  const cancelDrag = () => {
    if (!state.dragging) return;
    state.dragging = false;
    state.pointerId = null;
    state.dragMoved = false;
    setExpanded(state.expanded, { animate: true, force: true, skipPersist: true });
  };

  return {
    state,
    measureOffset,
    applyState,
    setExpanded,
    toggle,
    startDrag,
    moveDrag,
    finishDrag,
    cancelDrag
  };
};
