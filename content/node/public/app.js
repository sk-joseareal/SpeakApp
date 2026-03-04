(() => {
  const JWT_KEY = 'speakapp:content-dashboard:jwt';
  const LOGIN_EMAIL_KEY = 'speakapp:content-dashboard:login-email';
  const MODE_GUIDED = 'guided';
  const MODE_JSON = 'json';

  const el = {
    loginEmailInput: document.getElementById('loginEmailInput'),
    loginPasswordInput: document.getElementById('loginPasswordInput'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    authSummary: document.getElementById('authSummary'),
    healthBtn: document.getElementById('healthBtn'),
    loadDraftBtn: document.getElementById('loadDraftBtn'),
    loadPublicBtn: document.getElementById('loadPublicBtn'),
    validateBtn: document.getElementById('validateBtn'),
    saveDraftBtn: document.getElementById('saveDraftBtn'),
    publishBtn: document.getElementById('publishBtn'),
    releaseNameInput: document.getElementById('releaseNameInput'),
    refreshReleasesBtn: document.getElementById('refreshReleasesBtn'),
    lockInfo: document.getElementById('lockInfo'),
    claimLockBtn: document.getElementById('claimLockBtn'),
    releaseLockBtn: document.getElementById('releaseLockBtn'),
    refreshLockBtn: document.getElementById('refreshLockBtn'),
    editorsSection: document.getElementById('editorsSection'),
    refreshEditorsBtn: document.getElementById('refreshEditorsBtn'),
    newEditorEmailInput: document.getElementById('newEditorEmailInput'),
    newEditorNameInput: document.getElementById('newEditorNameInput'),
    newEditorRoleInput: document.getElementById('newEditorRoleInput'),
    newEditorPasswordInput: document.getElementById('newEditorPasswordInput'),
    newEditorActiveInput: document.getElementById('newEditorActiveInput'),
    createEditorBtn: document.getElementById('createEditorBtn'),
    editorsList: document.getElementById('editorsList'),
    statusBox: document.getElementById('statusBox'),
    countsBox: document.getElementById('countsBox'),
    guidedCountsBox: document.getElementById('guidedCountsBox'),
    jsonEditor: document.getElementById('jsonEditor'),
    releasesBox: document.getElementById('releasesBox'),
    editorModeSection: document.getElementById('editorModeSection'),
    releasesSection: document.getElementById('releasesSection'),

    modeGuidedBtn: document.getElementById('modeGuidedBtn'),
    modeJsonBtn: document.getElementById('modeJsonBtn'),
    syncFromJsonBtn: document.getElementById('syncFromJsonBtn'),
    guidedSection: document.getElementById('guidedSection'),
    jsonSection: document.getElementById('jsonSection'),

    routesList: document.getElementById('routesList'),
    modulesList: document.getElementById('modulesList'),
    sessionsList: document.getElementById('sessionsList'),
    addRouteBtn: document.getElementById('addRouteBtn'),
    addModuleBtn: document.getElementById('addModuleBtn'),
    addSessionBtn: document.getElementById('addSessionBtn'),

    routeIdInput: document.getElementById('routeIdInput'),
    routeTitleInput: document.getElementById('routeTitleEnInput'),
    routeTitleEsInput: document.getElementById('routeTitleEsInput'),
    routeNoteInput: document.getElementById('routeNoteEnInput'),
    routeNoteEsInput: document.getElementById('routeNoteEsInput'),
    saveRouteBtn: document.getElementById('saveRouteBtn'),
    moveRouteUpBtn: document.getElementById('moveRouteUpBtn'),
    moveRouteDownBtn: document.getElementById('moveRouteDownBtn'),
    deleteRouteBtn: document.getElementById('deleteRouteBtn'),

    selectedRouteLabel: document.getElementById('selectedRouteLabel'),
    moduleIdInput: document.getElementById('moduleIdInput'),
    moduleTitleInput: document.getElementById('moduleTitleEnInput'),
    moduleTitleEsInput: document.getElementById('moduleTitleEsInput'),
    moduleSubtitleInput: document.getElementById('moduleSubtitleEnInput'),
    moduleSubtitleEsInput: document.getElementById('moduleSubtitleEsInput'),
    saveModuleBtn: document.getElementById('saveModuleBtn'),
    moveModuleUpBtn: document.getElementById('moveModuleUpBtn'),
    moveModuleDownBtn: document.getElementById('moveModuleDownBtn'),
    deleteModuleBtn: document.getElementById('deleteModuleBtn'),

    selectedModuleLabel: document.getElementById('selectedModuleLabel'),
    selectedSessionLabel: document.getElementById('selectedSessionLabel'),
    sessionIdInput: document.getElementById('sessionIdInput'),
    sessionTitleInput: document.getElementById('sessionTitleEnInput'),
    sessionTitleEsInput: document.getElementById('sessionTitleEsInput'),
    sessionFocusInput: document.getElementById('sessionFocusInput'),
    sessionSoundTitleInput: document.getElementById('sessionSoundTitleEnInput'),
    sessionSoundTitleEsInput: document.getElementById('sessionSoundTitleEsInput'),
    sessionSoundHintEnLine1Input: document.getElementById('sessionSoundHintEnLine1Input'),
    sessionSoundHintEnLine2Input: document.getElementById('sessionSoundHintEnLine2Input'),
    sessionSoundHintEsLine1Input: document.getElementById('sessionSoundHintEsLine1Input'),
    sessionSoundHintEsLine2Input: document.getElementById('sessionSoundHintEsLine2Input'),
    sessionSoundPhoneticInput: document.getElementById('sessionSoundPhoneticInput'),
    sessionSoundExpectedInput: document.getElementById('sessionSoundExpectedInput'),
    sessionSpellingTitleInput: document.getElementById('sessionSpellingTitleEnInput'),
    sessionSpellingTitleEsInput: document.getElementById('sessionSpellingTitleEsInput'),
    sessionSpellingHintEnLine1Input: document.getElementById('sessionSpellingHintEnLine1Input'),
    sessionSpellingHintEnLine2Input: document.getElementById('sessionSpellingHintEnLine2Input'),
    sessionSpellingHintEsLine1Input: document.getElementById('sessionSpellingHintEsLine1Input'),
    sessionSpellingHintEsLine2Input: document.getElementById('sessionSpellingHintEsLine2Input'),
    sessionSpellingWordsInput: document.getElementById('sessionSpellingWordsInput'),
    sessionSentenceTitleInput: document.getElementById('sessionSentenceTitleEnInput'),
    sessionSentenceTitleEsInput: document.getElementById('sessionSentenceTitleEsInput'),
    sessionSentenceHintEnLine1Input: document.getElementById('sessionSentenceHintEnLine1Input'),
    sessionSentenceHintEnLine2Input: document.getElementById('sessionSentenceHintEnLine2Input'),
    sessionSentenceHintEsLine1Input: document.getElementById('sessionSentenceHintEsLine1Input'),
    sessionSentenceHintEsLine2Input: document.getElementById('sessionSentenceHintEsLine2Input'),
    sessionSentenceTextInput: document.getElementById('sessionSentenceTextInput'),
    sessionSentenceExpectedInput: document.getElementById('sessionSentenceExpectedInput'),
    saveSessionBtn: document.getElementById('saveSessionBtn'),
    moveSessionUpBtn: document.getElementById('moveSessionUpBtn'),
    moveSessionDownBtn: document.getElementById('moveSessionDownBtn'),
    deleteSessionBtn: document.getElementById('deleteSessionBtn')
  };

  let contentState = { routes: [], modules: [], sessions: [] };
  let selectedRouteId = '';
  let selectedModuleId = '';
  let selectedSessionId = '';
  let editorMode = MODE_GUIDED;
  let jsonDirty = false;
  let syncingJsonEditor = false;
  let sessionJwt = '';
  let currentAuth = null;
  let currentEditor = null;
  let currentLock = null;

  const asText = (value) => String(value === undefined || value === null ? '' : value).trim();
  const roleRank = { editor: 1, publisher: 2, admin: 3 };
  const normalizeRole = (value) => {
    const role = asText(value).toLowerCase();
    return roleRank[role] ? role : 'editor';
  };
  const hasRoleAtLeast = (role, minRole) => (roleRank[normalizeRole(role)] || 0) >= (roleRank[normalizeRole(minRole)] || 0);
  const isAuthenticated = () => Boolean(currentAuth && currentAuth.authorized);
  const currentRole = () => normalizeRole(currentAuth && currentAuth.role ? currentAuth.role : '');
  const canManageEditors = () => isAuthenticated() && hasRoleAtLeast(currentRole(), 'admin');

  const uniqStrings = (items) => {
    const seen = new Set();
    const out = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      const value = asText(item);
      if (!value || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    });
    return out;
  };

  const deepClone = (value) => JSON.parse(JSON.stringify(value));

  const parseWordsInput = (value) =>
    uniqStrings(
      String(value || '')
        .split(/\r?\n|,/)
        .map((item) => asText(item))
    );

  const splitHintLines = (value) =>
    String(value || '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .split(/\r?\n+/)
      .map((line) => asText(line))
      .filter(Boolean)
      .slice(0, 2);

  const getFirstText = (...values) => {
    for (const value of values) {
      const normalized = asText(value);
      if (normalized) return normalized;
    }
    return '';
  };

  const normalizeHintI18n = (rawStep) => {
    const step = rawStep && typeof rawStep === 'object' ? rawStep : {};
    const legacyLines = splitHintLines(step.hint);

    let hintEnLine1 = getFirstText(
      step.hint_en_line1,
      step.hint_en_1,
      step.hint_en_line_1,
      step.hint_en_linea_1
    );
    let hintEnLine2 = getFirstText(
      step.hint_en_line2,
      step.hint_en_2,
      step.hint_en_line_2,
      step.hint_en_linea_2
    );
    let hintEsLine1 = getFirstText(
      step.hint_es_line1,
      step.hint_es_1,
      step.hint_es_line_1,
      step.hint_es_linea_1
    );
    let hintEsLine2 = getFirstText(
      step.hint_es_line2,
      step.hint_es_2,
      step.hint_es_line_2,
      step.hint_es_linea_2
    );

    const hasExplicitHints = Boolean(
      hintEnLine1 || hintEnLine2 || hintEsLine1 || hintEsLine2
    );

    if (!hasExplicitHints && legacyLines.length) {
      hintEnLine1 = legacyLines[0] || '';
      hintEnLine2 = legacyLines[1] || '';
      hintEsLine1 = legacyLines[0] || '';
      hintEsLine2 = legacyLines[1] || '';
    }

    if ((!hintEnLine1 && !hintEnLine2) && (hintEsLine1 || hintEsLine2)) {
      hintEnLine1 = hintEsLine1;
      hintEnLine2 = hintEsLine2;
    }

    if ((!hintEsLine1 && !hintEsLine2) && (hintEnLine1 || hintEnLine2)) {
      hintEsLine1 = hintEnLine1;
      hintEsLine2 = hintEnLine2;
    }

    return {
      hint_en_line1: hintEnLine1,
      hint_en_line2: hintEnLine2,
      hint_es_line1: hintEsLine1,
      hint_es_line2: hintEsLine2
    };
  };

  const normalizeTextI18n = (value, fallbackValue = '') => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const fallback = asText(fallbackValue);
    let en = getFirstText(source.en, source['en-US'], source.en_us);
    let es = getFirstText(source.es, source['es-ES'], source.es_es);
    if (!en && fallback) en = fallback;
    if (!es && fallback) es = fallback;
    if (!en && es) en = es;
    if (!es && en) es = en;
    return { en, es };
  };

  const extractTextI18n = (rawEntity, fieldName) => {
    const entity = rawEntity && typeof rawEntity === 'object' ? rawEntity : {};
    const explicit = entity[`${fieldName}_i18n`];
    const legacy = {
      en: entity[`${fieldName}_en`],
      es: entity[`${fieldName}_es`]
    };
    const source =
      explicit && typeof explicit === 'object' && !Array.isArray(explicit) ? explicit : legacy;
    return normalizeTextI18n(source, entity[fieldName]);
  };

  const normalizeSession = (session, idx) => {
    const base = session && typeof session === 'object' ? deepClone(session) : {};
    base.id = asText(base.id) || `session-${idx + 1}`;
    base.title_i18n = extractTextI18n(base, 'title');
    base.title = getFirstText(base.title_i18n.en, base.title_i18n.es) || `Session ${idx + 1}`;
    delete base.progress;
    delete base.status;

    base.speak = base.speak && typeof base.speak === 'object' ? base.speak : {};
    base.speak.focus = asText(base.speak.focus);
    base.speak.sound = base.speak.sound && typeof base.speak.sound === 'object' ? base.speak.sound : {};
    base.speak.sound.title_i18n = extractTextI18n(base.speak.sound, 'title');
    base.speak.sound.title = getFirstText(base.speak.sound.title_i18n.en, base.speak.sound.title_i18n.es);
    Object.assign(base.speak.sound, normalizeHintI18n(base.speak.sound));
    delete base.speak.sound.hint;
    delete base.speak.sound.hint_en_1;
    delete base.speak.sound.hint_en_2;
    delete base.speak.sound.hint_es_1;
    delete base.speak.sound.hint_es_2;
    base.speak.sound.phonetic = asText(base.speak.sound.phonetic);
    base.speak.sound.expected = asText(base.speak.sound.expected);
    base.speak.spelling = base.speak.spelling && typeof base.speak.spelling === 'object' ? base.speak.spelling : {};
    base.speak.spelling.title_i18n = extractTextI18n(base.speak.spelling, 'title');
    base.speak.spelling.title = getFirstText(base.speak.spelling.title_i18n.en, base.speak.spelling.title_i18n.es);
    Object.assign(base.speak.spelling, normalizeHintI18n(base.speak.spelling));
    delete base.speak.spelling.hint;
    delete base.speak.spelling.hint_en_1;
    delete base.speak.spelling.hint_en_2;
    delete base.speak.spelling.hint_es_1;
    delete base.speak.spelling.hint_es_2;
    base.speak.spelling.words = uniqStrings(base.speak.spelling.words);
    delete base.speak.spelling.expected;
    base.speak.sentence = base.speak.sentence && typeof base.speak.sentence === 'object' ? base.speak.sentence : {};
    base.speak.sentence.title_i18n = extractTextI18n(base.speak.sentence, 'title');
    base.speak.sentence.title = getFirstText(base.speak.sentence.title_i18n.en, base.speak.sentence.title_i18n.es);
    Object.assign(base.speak.sentence, normalizeHintI18n(base.speak.sentence));
    delete base.speak.sentence.hint;
    delete base.speak.sentence.hint_en_1;
    delete base.speak.sentence.hint_en_2;
    delete base.speak.sentence.hint_es_1;
    delete base.speak.sentence.hint_es_2;
    base.speak.sentence.sentence = asText(base.speak.sentence.sentence);
    base.speak.sentence.expected = asText(base.speak.sentence.expected);

    return base;
  };

  const normalizePayload = (payload) => {
    const raw = payload && typeof payload === 'object' ? payload : {};

    const routes = (Array.isArray(raw.routes) ? raw.routes : []).map((route, idx) => {
      const base = route && typeof route === 'object' ? deepClone(route) : {};
      const titleI18n = extractTextI18n(base, 'title');
      const noteI18n = extractTextI18n(base, 'note');
      return {
        id: asText(base.id) || `route-${idx + 1}`,
        title: getFirstText(titleI18n.en, titleI18n.es) || `Route ${idx + 1}`,
        title_i18n: titleI18n,
        note: getFirstText(noteI18n.en, noteI18n.es),
        note_i18n: noteI18n,
        moduleIds: uniqStrings(base.moduleIds)
      };
    });

    const modules = (Array.isArray(raw.modules) ? raw.modules : []).map((module, idx) => {
      const base = module && typeof module === 'object' ? deepClone(module) : {};
      const titleI18n = extractTextI18n(base, 'title');
      const subtitleI18n = extractTextI18n(base, 'subtitle');
      return {
        id: asText(base.id) || `module-${idx + 1}`,
        title: getFirstText(titleI18n.en, titleI18n.es) || `Module ${idx + 1}`,
        title_i18n: titleI18n,
        subtitle: getFirstText(subtitleI18n.en, subtitleI18n.es),
        subtitle_i18n: subtitleI18n,
        sessionIds: uniqStrings(base.sessionIds)
      };
    });

    const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).map((session, idx) =>
      normalizeSession(session, idx)
    );

    const moduleIds = new Set(modules.map((item) => item.id));
    const sessionIds = new Set(sessions.map((item) => item.id));

    routes.forEach((route) => {
      route.moduleIds = route.moduleIds.filter((id) => moduleIds.has(id));
    });

    modules.forEach((module) => {
      module.sessionIds = module.sessionIds.filter((id) => sessionIds.has(id));
    });

    return { routes, modules, sessions };
  };

  const setStatus = (message, payload) => {
    const text = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
    el.statusBox.textContent = text;
  };

  const updateCounts = (payload) => {
    const routes = Array.isArray(payload && payload.routes) ? payload.routes.length : 0;
    const modules = Array.isArray(payload && payload.modules) ? payload.modules.length : 0;
    const sessions = Array.isArray(payload && payload.sessions) ? payload.sessions.length : 0;
    const text = `routes: ${routes} · modules: ${modules} · sessions: ${sessions}`;
    el.countsBox.textContent = text;
    if (el.guidedCountsBox) {
      el.guidedCountsBox.textContent = text;
    }
  };

  const tryParseEditor = () => {
    const raw = String(el.jsonEditor.value || '').trim();
    if (!raw) throw new Error('JSON vacío');
    const payload = JSON.parse(raw);
    const routes = Array.isArray(payload.routes) ? payload.routes : null;
    const modules = Array.isArray(payload.modules) ? payload.modules : null;
    const sessions = Array.isArray(payload.sessions) ? payload.sessions : null;
    if (!routes || !modules || !sessions) {
      throw new Error('Estructura inválida: se esperaba { routes, modules, sessions }');
    }
    return payload;
  };

  const headers = (withBody = false) => {
    const result = {};
    if (sessionJwt) result.Authorization = `Bearer ${sessionJwt}`;
    if (withBody) result['Content-Type'] = 'application/json';
    return result;
  };

  const api = async (url, options = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_err) {
      json = { ok: false, error: 'invalid_json_response', raw: text };
    }
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      err.response = json;
      throw err;
    }
    return json;
  };

  const setEditorMode = (mode) => {
    editorMode = mode === MODE_JSON ? MODE_JSON : MODE_GUIDED;
    const guided = editorMode === MODE_GUIDED;
    el.modeGuidedBtn.classList.toggle('is-active', guided);
    el.modeJsonBtn.classList.toggle('is-active', !guided);
    el.modeGuidedBtn.classList.toggle('btn-primary', guided);
    el.modeJsonBtn.classList.toggle('btn-primary', !guided);
    renderEditorVisibility();
    updateSyncFromJsonButtonState();
  };

  const getRouteById = (id) => contentState.routes.find((route) => route.id === id) || null;
  const getModuleById = (id) => contentState.modules.find((module) => module.id === id) || null;
  const getSessionById = (id) => contentState.sessions.find((session) => session.id === id) || null;

  const getSelectedRoute = () => getRouteById(selectedRouteId);
  const getSelectedModule = () => getModuleById(selectedModuleId);
  const getSelectedSession = () => getSessionById(selectedSessionId);

  const ensureSelection = () => {
    const route = getRouteById(selectedRouteId) || contentState.routes[0] || null;
    selectedRouteId = route ? route.id : '';

    const routeModuleIds = route ? uniqStrings(route.moduleIds) : [];
    const moduleId = routeModuleIds.includes(selectedModuleId) ? selectedModuleId : routeModuleIds[0] || '';
    selectedModuleId = moduleId;

    const module = getModuleById(selectedModuleId);
    const moduleSessionIds = module ? uniqStrings(module.sessionIds) : [];
    const sessionId = moduleSessionIds.includes(selectedSessionId) ? selectedSessionId : moduleSessionIds[0] || '';
    selectedSessionId = sessionId;
  };

  const syncJsonFromState = () => {
    syncingJsonEditor = true;
    el.jsonEditor.value = JSON.stringify(contentState, null, 2);
    syncingJsonEditor = false;
    jsonDirty = false;
    updateSyncFromJsonButtonState();
    updateCounts(contentState);
  };

  const updateSyncFromJsonButtonState = () => {
    const shouldShow = isAuthenticated() && editorMode === MODE_JSON && jsonDirty;
    el.syncFromJsonBtn.classList.toggle('hidden', !shouldShow);
    el.syncFromJsonBtn.disabled = !shouldShow;
  };

  const renderEditorVisibility = () => {
    const canAccessEditor = isAuthenticated();
    const guided = editorMode === MODE_GUIDED;
    if (el.editorModeSection) {
      el.editorModeSection.classList.toggle('hidden', !canAccessEditor);
    }
    if (el.guidedSection) {
      el.guidedSection.classList.toggle('hidden', !canAccessEditor || !guided);
    }
    if (el.jsonSection) {
      el.jsonSection.classList.toggle('hidden', !canAccessEditor || guided);
    }
    if (el.releasesSection) {
      el.releasesSection.classList.toggle('hidden', !canAccessEditor);
    }
  };

  const setContentState = (payload, options = {}) => {
    contentState = normalizePayload(payload);
    if (!options.preserveSelection) {
      selectedRouteId = '';
      selectedModuleId = '';
      selectedSessionId = '';
    }
    ensureSelection();
    renderGuided();
    if (options.syncJson !== false) {
      syncJsonFromState();
    } else {
      updateCounts(contentState);
    }
  };

  const ensureUniqueId = (seed, existingIds) => {
    const base = asText(seed).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
    if (!existingIds.has(base)) return base;
    let idx = 2;
    while (existingIds.has(`${base}-${idx}`)) {
      idx += 1;
    }
    return `${base}-${idx}`;
  };

  const moveInArray = (array, from, to) => {
    if (!Array.isArray(array)) return;
    if (from < 0 || to < 0 || from >= array.length || to >= array.length) return;
    const [item] = array.splice(from, 1);
    array.splice(to, 0, item);
  };

  const cleanupOrphans = () => {
    const validModuleIds = new Set(contentState.modules.map((item) => item.id));
    contentState.routes.forEach((route) => {
      route.moduleIds = uniqStrings(route.moduleIds).filter((id) => validModuleIds.has(id));
    });

    const referencedModuleIds = new Set(contentState.routes.flatMap((route) => route.moduleIds));
    contentState.modules = contentState.modules.filter((module) => referencedModuleIds.has(module.id));

    const validSessionIds = new Set(contentState.sessions.map((item) => item.id));
    contentState.modules.forEach((module) => {
      module.sessionIds = uniqStrings(module.sessionIds).filter((id) => validSessionIds.has(id));
    });

    const referencedSessionIds = new Set(contentState.modules.flatMap((module) => module.sessionIds));
    contentState.sessions = contentState.sessions.filter((session) => referencedSessionIds.has(session.id));
  };

  const commitGuidedChanges = (statusMessage) => {
    cleanupOrphans();
    ensureSelection();
    renderGuided();
    syncJsonFromState();
    if (statusMessage) {
      setStatus(statusMessage);
    }
  };

  const renderEntityItem = (entry, selected, meta) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `entity-item${selected ? ' is-selected' : ''}`;

    const titleEl = document.createElement('span');
    titleEl.className = 'entity-item-title';
    titleEl.textContent = entry.title || entry.id;

    const metaEl = document.createElement('span');
    metaEl.className = 'entity-item-meta';
    metaEl.textContent = meta;

    btn.appendChild(titleEl);
    btn.appendChild(metaEl);
    return btn;
  };

  const setRouteFormDisabled = (disabled) => {
    [
      el.routeIdInput,
      el.routeTitleInput,
      el.routeTitleEsInput,
      el.routeNoteInput,
      el.routeNoteEsInput,
      el.saveRouteBtn,
      el.moveRouteUpBtn,
      el.moveRouteDownBtn,
      el.deleteRouteBtn
    ].forEach((node) => {
      node.disabled = disabled;
    });
  };

  const setModuleFormDisabled = (disabled) => {
    [
      el.moduleIdInput,
      el.moduleTitleInput,
      el.moduleTitleEsInput,
      el.moduleSubtitleInput,
      el.moduleSubtitleEsInput,
      el.saveModuleBtn,
      el.moveModuleUpBtn,
      el.moveModuleDownBtn,
      el.deleteModuleBtn,
      el.addSessionBtn
    ].forEach((node) => {
      node.disabled = disabled;
    });
  };

  const setSessionFormDisabled = (disabled) => {
    [
      el.sessionIdInput,
      el.sessionTitleInput,
      el.sessionTitleEsInput,
      el.sessionFocusInput,
      el.sessionSoundTitleInput,
      el.sessionSoundTitleEsInput,
      el.sessionSoundHintEnLine1Input,
      el.sessionSoundHintEnLine2Input,
      el.sessionSoundHintEsLine1Input,
      el.sessionSoundHintEsLine2Input,
      el.sessionSoundPhoneticInput,
      el.sessionSoundExpectedInput,
      el.sessionSpellingTitleInput,
      el.sessionSpellingTitleEsInput,
      el.sessionSpellingHintEnLine1Input,
      el.sessionSpellingHintEnLine2Input,
      el.sessionSpellingHintEsLine1Input,
      el.sessionSpellingHintEsLine2Input,
      el.sessionSpellingWordsInput,
      el.sessionSentenceTitleInput,
      el.sessionSentenceTitleEsInput,
      el.sessionSentenceHintEnLine1Input,
      el.sessionSentenceHintEnLine2Input,
      el.sessionSentenceHintEsLine1Input,
      el.sessionSentenceHintEsLine2Input,
      el.sessionSentenceTextInput,
      el.sessionSentenceExpectedInput,
      el.saveSessionBtn,
      el.moveSessionUpBtn,
      el.moveSessionDownBtn,
      el.deleteSessionBtn
    ].forEach((node) => {
      node.disabled = disabled;
    });
  };

  const renderGuided = () => {
    ensureSelection();

    const route = getSelectedRoute();
    const module = getSelectedModule();
    const session = getSelectedSession();

    el.routesList.innerHTML = '';
    contentState.routes.forEach((item) => {
      const node = renderEntityItem(item, item.id === selectedRouteId, `${item.id} · ${item.moduleIds.length} módulos`);
      node.dataset.routeId = item.id;
      el.routesList.appendChild(node);
    });

    const routeModules = route
      ? route.moduleIds.map((id) => getModuleById(id)).filter(Boolean)
      : [];

    el.modulesList.innerHTML = '';
    routeModules.forEach((item) => {
      const node = renderEntityItem(item, item.id === selectedModuleId, `${item.id} · ${item.sessionIds.length} sesiones`);
      node.dataset.moduleId = item.id;
      el.modulesList.appendChild(node);
    });

    const moduleSessions = module
      ? module.sessionIds.map((id) => getSessionById(id)).filter(Boolean)
      : [];

    el.sessionsList.innerHTML = '';
    moduleSessions.forEach((item) => {
      const node = renderEntityItem(item, item.id === selectedSessionId, item.id);
      node.dataset.sessionId = item.id;
      el.sessionsList.appendChild(node);
    });

    if (route) {
      const routeTitleI18n = normalizeTextI18n(route.title_i18n, route.title);
      const routeNoteI18n = normalizeTextI18n(route.note_i18n, route.note);
      setRouteFormDisabled(false);
      el.routeIdInput.value = route.id;
      el.routeTitleInput.value = routeTitleI18n.en || '';
      el.routeTitleEsInput.value = routeTitleI18n.es || '';
      el.routeNoteInput.value = routeNoteI18n.en || '';
      el.routeNoteEsInput.value = routeNoteI18n.es || '';
      el.selectedRouteLabel.textContent = `Route actual: ${route.title} (${route.id})`;
      el.addModuleBtn.disabled = false;
    } else {
      setRouteFormDisabled(true);
      el.routeIdInput.value = '';
      el.routeTitleInput.value = '';
      el.routeTitleEsInput.value = '';
      el.routeNoteInput.value = '';
      el.routeNoteEsInput.value = '';
      el.selectedRouteLabel.textContent = 'Selecciona o crea una route.';
      el.addModuleBtn.disabled = true;
    }

    if (module) {
      const moduleTitleI18n = normalizeTextI18n(module.title_i18n, module.title);
      const moduleSubtitleI18n = normalizeTextI18n(module.subtitle_i18n, module.subtitle);
      setModuleFormDisabled(false);
      el.moduleIdInput.value = module.id;
      el.moduleTitleInput.value = moduleTitleI18n.en || '';
      el.moduleTitleEsInput.value = moduleTitleI18n.es || '';
      el.moduleSubtitleInput.value = moduleSubtitleI18n.en || '';
      el.moduleSubtitleEsInput.value = moduleSubtitleI18n.es || '';
      el.selectedModuleLabel.textContent = `Módulo actual: ${module.title} (${module.id})`;
    } else {
      setModuleFormDisabled(true);
      el.moduleIdInput.value = '';
      el.moduleTitleInput.value = '';
      el.moduleTitleEsInput.value = '';
      el.moduleSubtitleInput.value = '';
      el.moduleSubtitleEsInput.value = '';
      el.selectedModuleLabel.textContent = 'Selecciona o crea un módulo.';
    }

    if (session) {
      const sessionTitleI18n = normalizeTextI18n(session.title_i18n, session.title);
      setSessionFormDisabled(false);
      el.selectedSessionLabel.textContent = `Sesión actual: ${session.title} (${session.id})`;
      el.sessionIdInput.value = session.id;
      el.sessionTitleInput.value = sessionTitleI18n.en || '';
      el.sessionTitleEsInput.value = sessionTitleI18n.es || '';
      el.sessionFocusInput.value = session.speak && typeof session.speak === 'object' ? session.speak.focus || '' : '';

      const sound = session.speak && session.speak.sound && typeof session.speak.sound === 'object'
        ? session.speak.sound
        : {};
      const spelling = session.speak && session.speak.spelling && typeof session.speak.spelling === 'object'
        ? session.speak.spelling
        : {};
      const sentence = session.speak && session.speak.sentence && typeof session.speak.sentence === 'object'
        ? session.speak.sentence
        : {};
      const soundTitleI18n = normalizeTextI18n(sound.title_i18n, sound.title);
      const spellingTitleI18n = normalizeTextI18n(spelling.title_i18n, spelling.title);
      const sentenceTitleI18n = normalizeTextI18n(sentence.title_i18n, sentence.title);

      el.sessionSoundTitleInput.value = soundTitleI18n.en || '';
      el.sessionSoundTitleEsInput.value = soundTitleI18n.es || '';
      el.sessionSoundHintEnLine1Input.value = sound.hint_en_line1 || '';
      el.sessionSoundHintEnLine2Input.value = sound.hint_en_line2 || '';
      el.sessionSoundHintEsLine1Input.value = sound.hint_es_line1 || '';
      el.sessionSoundHintEsLine2Input.value = sound.hint_es_line2 || '';
      el.sessionSoundPhoneticInput.value = sound.phonetic || '';
      el.sessionSoundExpectedInput.value = sound.expected || '';

      el.sessionSpellingTitleInput.value = spellingTitleI18n.en || '';
      el.sessionSpellingTitleEsInput.value = spellingTitleI18n.es || '';
      el.sessionSpellingHintEnLine1Input.value = spelling.hint_en_line1 || '';
      el.sessionSpellingHintEnLine2Input.value = spelling.hint_en_line2 || '';
      el.sessionSpellingHintEsLine1Input.value = spelling.hint_es_line1 || '';
      el.sessionSpellingHintEsLine2Input.value = spelling.hint_es_line2 || '';
      el.sessionSpellingWordsInput.value = Array.isArray(spelling.words) ? spelling.words.join('\n') : '';

      el.sessionSentenceTitleInput.value = sentenceTitleI18n.en || '';
      el.sessionSentenceTitleEsInput.value = sentenceTitleI18n.es || '';
      el.sessionSentenceHintEnLine1Input.value = sentence.hint_en_line1 || '';
      el.sessionSentenceHintEnLine2Input.value = sentence.hint_en_line2 || '';
      el.sessionSentenceHintEsLine1Input.value = sentence.hint_es_line1 || '';
      el.sessionSentenceHintEsLine2Input.value = sentence.hint_es_line2 || '';
      el.sessionSentenceTextInput.value = sentence.sentence || '';
      el.sessionSentenceExpectedInput.value = sentence.expected || '';
    } else {
      setSessionFormDisabled(true);
      el.selectedSessionLabel.textContent = 'Selecciona o crea una sesión.';
      el.sessionIdInput.value = '';
      el.sessionTitleInput.value = '';
      el.sessionTitleEsInput.value = '';
      el.sessionFocusInput.value = '';
      el.sessionSoundTitleInput.value = '';
      el.sessionSoundTitleEsInput.value = '';
      el.sessionSoundHintEnLine1Input.value = '';
      el.sessionSoundHintEnLine2Input.value = '';
      el.sessionSoundHintEsLine1Input.value = '';
      el.sessionSoundHintEsLine2Input.value = '';
      el.sessionSoundPhoneticInput.value = '';
      el.sessionSoundExpectedInput.value = '';
      el.sessionSpellingTitleInput.value = '';
      el.sessionSpellingTitleEsInput.value = '';
      el.sessionSpellingHintEnLine1Input.value = '';
      el.sessionSpellingHintEnLine2Input.value = '';
      el.sessionSpellingHintEsLine1Input.value = '';
      el.sessionSpellingHintEsLine2Input.value = '';
      el.sessionSpellingWordsInput.value = '';
      el.sessionSentenceTitleInput.value = '';
      el.sessionSentenceTitleEsInput.value = '';
      el.sessionSentenceHintEnLine1Input.value = '';
      el.sessionSentenceHintEnLine2Input.value = '';
      el.sessionSentenceHintEsLine1Input.value = '';
      el.sessionSentenceHintEsLine2Input.value = '';
      el.sessionSentenceTextInput.value = '';
      el.sessionSentenceExpectedInput.value = '';
    }
  };

  const addRoute = () => {
    const ids = new Set(contentState.routes.map((item) => item.id));
    const id = ensureUniqueId(`route-${contentState.routes.length + 1}`, ids);
    const title = `Route ${contentState.routes.length + 1}`;
    contentState.routes.push({
      id,
      title,
      title_i18n: normalizeTextI18n({ en: title, es: title }, title),
      note: '',
      note_i18n: { en: '', es: '' },
      moduleIds: []
    });
    selectedRouteId = id;
    selectedModuleId = '';
    selectedSessionId = '';
    commitGuidedChanges('Route añadida.');
  };

  const saveRoute = () => {
    const route = getSelectedRoute();
    if (!route) return;

    const nextId = asText(el.routeIdInput.value);
    const nextTitleI18n = normalizeTextI18n({
      en: asText(el.routeTitleInput.value),
      es: asText(el.routeTitleEsInput.value)
    });
    const nextNoteI18n = normalizeTextI18n({
      en: asText(el.routeNoteInput.value),
      es: asText(el.routeNoteEsInput.value)
    });
    const nextTitle = getFirstText(nextTitleI18n.en, nextTitleI18n.es);
    const nextNote = getFirstText(nextNoteI18n.en, nextNoteI18n.es);

    if (!nextId) {
      setStatus('Route ID obligatorio.');
      return;
    }
    if (!nextTitle) {
      setStatus('Título de route obligatorio.');
      return;
    }

    if (nextId !== route.id && contentState.routes.some((item) => item.id === nextId)) {
      setStatus('Ya existe una route con ese ID.');
      return;
    }

    route.id = nextId;
    route.title_i18n = nextTitleI18n;
    route.title = nextTitle;
    route.note_i18n = nextNoteI18n;
    route.note = nextNote;
    selectedRouteId = nextId;
    commitGuidedChanges('Route actualizada.');
  };

  const moveRoute = (direction) => {
    const index = contentState.routes.findIndex((item) => item.id === selectedRouteId);
    if (index < 0) return;
    const nextIndex = direction < 0 ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= contentState.routes.length) return;
    moveInArray(contentState.routes, index, nextIndex);
    commitGuidedChanges('Orden de routes actualizado.');
  };

  const deleteRoute = () => {
    const route = getSelectedRoute();
    if (!route) return;
    contentState.routes = contentState.routes.filter((item) => item.id !== route.id);
    commitGuidedChanges('Route eliminada.');
  };

  const addModule = () => {
    const route = getSelectedRoute();
    if (!route) {
      setStatus('Selecciona primero una route.');
      return;
    }

    const ids = new Set(contentState.modules.map((item) => item.id));
    const id = ensureUniqueId(`module-${contentState.modules.length + 1}`, ids);
    const title = `Module ${contentState.modules.length + 1}`;
    const module = {
      id,
      title,
      title_i18n: normalizeTextI18n({ en: title, es: title }, title),
      subtitle: '',
      subtitle_i18n: { en: '', es: '' },
      sessionIds: []
    };

    contentState.modules.push(module);
    route.moduleIds = uniqStrings([...route.moduleIds, id]);
    selectedModuleId = id;
    selectedSessionId = '';
    commitGuidedChanges('Módulo añadido.');
  };

  const saveModule = () => {
    const module = getSelectedModule();
    if (!module) return;

    const nextId = asText(el.moduleIdInput.value);
    const nextTitleI18n = normalizeTextI18n({
      en: asText(el.moduleTitleInput.value),
      es: asText(el.moduleTitleEsInput.value)
    });
    const nextSubtitleI18n = normalizeTextI18n({
      en: asText(el.moduleSubtitleInput.value),
      es: asText(el.moduleSubtitleEsInput.value)
    });
    const nextTitle = getFirstText(nextTitleI18n.en, nextTitleI18n.es);
    const nextSubtitle = getFirstText(nextSubtitleI18n.en, nextSubtitleI18n.es);

    if (!nextId) {
      setStatus('Módulo ID obligatorio.');
      return;
    }
    if (!nextTitle) {
      setStatus('Título de módulo obligatorio.');
      return;
    }

    if (nextId !== module.id && contentState.modules.some((item) => item.id === nextId)) {
      setStatus('Ya existe un módulo con ese ID.');
      return;
    }

    const prevId = module.id;
    module.id = nextId;
    module.title_i18n = nextTitleI18n;
    module.title = nextTitle;
    module.subtitle_i18n = nextSubtitleI18n;
    module.subtitle = nextSubtitle;

    if (prevId !== nextId) {
      contentState.routes.forEach((route) => {
        route.moduleIds = route.moduleIds.map((id) => (id === prevId ? nextId : id));
      });
      selectedModuleId = nextId;
    }

    commitGuidedChanges('Módulo actualizado.');
  };

  const moveModule = (direction) => {
    const route = getSelectedRoute();
    if (!route) return;
    const index = route.moduleIds.findIndex((id) => id === selectedModuleId);
    if (index < 0) return;
    const nextIndex = direction < 0 ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= route.moduleIds.length) return;
    moveInArray(route.moduleIds, index, nextIndex);
    commitGuidedChanges('Orden de módulos actualizado.');
  };

  const deleteModule = () => {
    const module = getSelectedModule();
    if (!module) return;

    contentState.routes.forEach((route) => {
      route.moduleIds = route.moduleIds.filter((id) => id !== module.id);
    });
    contentState.modules = contentState.modules.filter((item) => item.id !== module.id);
    selectedModuleId = '';
    selectedSessionId = '';
    commitGuidedChanges('Módulo eliminado.');
  };

  const addSession = () => {
    const module = getSelectedModule();
    if (!module) {
      setStatus('Selecciona primero un módulo.');
      return;
    }

    const ids = new Set(contentState.sessions.map((item) => item.id));
    const id = ensureUniqueId(`session-${contentState.sessions.length + 1}`, ids);
    const session = normalizeSession(
      {
        id,
        title: `Session ${contentState.sessions.length + 1}`,
        speak: {
          focus: '',
          sound: {
            title: 'THE WAY',
            hint_en_line1: '',
            hint_en_line2: '',
            hint_es_line1: '',
            hint_es_line2: '',
            phonetic: '',
            expected: ''
          },
          spelling: {
            title: 'THE SPELLING',
            hint_en_line1: '',
            hint_en_line2: '',
            hint_es_line1: '',
            hint_es_line2: '',
            words: [],
            expected: ''
          },
          sentence: {
            title: 'WHOLE SENTENCE',
            hint_en_line1: '',
            hint_en_line2: '',
            hint_es_line1: '',
            hint_es_line2: '',
            sentence: '',
            expected: ''
          }
        }
      },
      contentState.sessions.length
    );

    contentState.sessions.push(session);
    module.sessionIds = uniqStrings([...module.sessionIds, id]);
    selectedSessionId = id;
    commitGuidedChanges('Sesión añadida.');
  };

  const saveSession = () => {
    const session = getSelectedSession();
    if (!session) return;

    const nextId = asText(el.sessionIdInput.value);
    const nextTitleI18n = normalizeTextI18n({
      en: asText(el.sessionTitleInput.value),
      es: asText(el.sessionTitleEsInput.value)
    });
    const nextTitle = getFirstText(nextTitleI18n.en, nextTitleI18n.es);
    const nextFocus = asText(el.sessionFocusInput.value);

    const nextSoundTitleI18n = normalizeTextI18n({
      en: asText(el.sessionSoundTitleInput.value),
      es: asText(el.sessionSoundTitleEsInput.value)
    });
    const nextSoundTitle = getFirstText(nextSoundTitleI18n.en, nextSoundTitleI18n.es);
    const nextSoundHintEnLine1 = asText(el.sessionSoundHintEnLine1Input.value);
    const nextSoundHintEnLine2 = asText(el.sessionSoundHintEnLine2Input.value);
    const nextSoundHintEsLine1 = asText(el.sessionSoundHintEsLine1Input.value);
    const nextSoundHintEsLine2 = asText(el.sessionSoundHintEsLine2Input.value);
    const nextSoundPhonetic = asText(el.sessionSoundPhoneticInput.value);
    const nextSoundExpected = asText(el.sessionSoundExpectedInput.value);

    const nextSpellingTitleI18n = normalizeTextI18n({
      en: asText(el.sessionSpellingTitleInput.value),
      es: asText(el.sessionSpellingTitleEsInput.value)
    });
    const nextSpellingTitle = getFirstText(nextSpellingTitleI18n.en, nextSpellingTitleI18n.es);
    const nextSpellingHintEnLine1 = asText(el.sessionSpellingHintEnLine1Input.value);
    const nextSpellingHintEnLine2 = asText(el.sessionSpellingHintEnLine2Input.value);
    const nextSpellingHintEsLine1 = asText(el.sessionSpellingHintEsLine1Input.value);
    const nextSpellingHintEsLine2 = asText(el.sessionSpellingHintEsLine2Input.value);
    const nextSpellingWords = parseWordsInput(el.sessionSpellingWordsInput.value);

    const nextSentenceTitleI18n = normalizeTextI18n({
      en: asText(el.sessionSentenceTitleInput.value),
      es: asText(el.sessionSentenceTitleEsInput.value)
    });
    const nextSentenceTitle = getFirstText(nextSentenceTitleI18n.en, nextSentenceTitleI18n.es);
    const nextSentenceHintEnLine1 = asText(el.sessionSentenceHintEnLine1Input.value);
    const nextSentenceHintEnLine2 = asText(el.sessionSentenceHintEnLine2Input.value);
    const nextSentenceHintEsLine1 = asText(el.sessionSentenceHintEsLine1Input.value);
    const nextSentenceHintEsLine2 = asText(el.sessionSentenceHintEsLine2Input.value);
    const nextSentenceText = asText(el.sessionSentenceTextInput.value);
    const nextSentenceExpected = asText(el.sessionSentenceExpectedInput.value);

    if (!nextId) {
      setStatus('Session ID obligatorio.');
      return;
    }
    if (!nextTitle) {
      setStatus('Título de sesión obligatorio.');
      return;
    }

    if (nextId !== session.id && contentState.sessions.some((item) => item.id === nextId)) {
      setStatus('Ya existe una sesión con ese ID.');
      return;
    }

    const prevId = session.id;
    session.id = nextId;
    session.title_i18n = nextTitleI18n;
    session.title = nextTitle;

    session.speak = session.speak && typeof session.speak === 'object' ? session.speak : {};
    session.speak.focus = nextFocus;
    session.speak.sound = session.speak.sound && typeof session.speak.sound === 'object' ? session.speak.sound : {};
    session.speak.sound.title_i18n = nextSoundTitleI18n;
    session.speak.sound.title = nextSoundTitle;
    session.speak.sound.hint_en_line1 = nextSoundHintEnLine1;
    session.speak.sound.hint_en_line2 = nextSoundHintEnLine2;
    session.speak.sound.hint_es_line1 = nextSoundHintEsLine1;
    session.speak.sound.hint_es_line2 = nextSoundHintEsLine2;
    delete session.speak.sound.hint;
    session.speak.sound.phonetic = nextSoundPhonetic;
    session.speak.sound.expected = nextSoundExpected;

    session.speak.spelling =
      session.speak.spelling && typeof session.speak.spelling === 'object' ? session.speak.spelling : {};
    session.speak.spelling.title_i18n = nextSpellingTitleI18n;
    session.speak.spelling.title = nextSpellingTitle;
    session.speak.spelling.hint_en_line1 = nextSpellingHintEnLine1;
    session.speak.spelling.hint_en_line2 = nextSpellingHintEnLine2;
    session.speak.spelling.hint_es_line1 = nextSpellingHintEsLine1;
    session.speak.spelling.hint_es_line2 = nextSpellingHintEsLine2;
    delete session.speak.spelling.hint;
    session.speak.spelling.words = nextSpellingWords;

    session.speak.sentence =
      session.speak.sentence && typeof session.speak.sentence === 'object' ? session.speak.sentence : {};
    session.speak.sentence.title_i18n = nextSentenceTitleI18n;
    session.speak.sentence.title = nextSentenceTitle;
    session.speak.sentence.hint_en_line1 = nextSentenceHintEnLine1;
    session.speak.sentence.hint_en_line2 = nextSentenceHintEnLine2;
    session.speak.sentence.hint_es_line1 = nextSentenceHintEsLine1;
    session.speak.sentence.hint_es_line2 = nextSentenceHintEsLine2;
    delete session.speak.sentence.hint;
    session.speak.sentence.sentence = nextSentenceText;
    session.speak.sentence.expected = nextSentenceExpected;

    if (prevId !== nextId) {
      contentState.modules.forEach((module) => {
        module.sessionIds = module.sessionIds.map((id) => (id === prevId ? nextId : id));
      });
      selectedSessionId = nextId;
    }

    commitGuidedChanges('Sesión actualizada.');
  };

  const moveSession = (direction) => {
    const module = getSelectedModule();
    if (!module) return;
    const index = module.sessionIds.findIndex((id) => id === selectedSessionId);
    if (index < 0) return;
    const nextIndex = direction < 0 ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= module.sessionIds.length) return;
    moveInArray(module.sessionIds, index, nextIndex);
    commitGuidedChanges('Orden de sesiones actualizado.');
  };

  const deleteSession = () => {
    const session = getSelectedSession();
    if (!session) return;

    contentState.modules.forEach((module) => {
      module.sessionIds = module.sessionIds.filter((id) => id !== session.id);
    });
    contentState.sessions = contentState.sessions.filter((item) => item.id !== session.id);
    selectedSessionId = '';
    commitGuidedChanges('Sesión eliminada.');
  };

  const applyJsonToGuided = () => {
    try {
      const payload = tryParseEditor();
      setContentState(payload, { syncJson: true, preserveSelection: true });
      jsonDirty = false;
      updateSyncFromJsonButtonState();
      setStatus('JSON aplicado al Editor.');
      setEditorMode(MODE_GUIDED);
    } catch (err) {
      setStatus('Error aplicando JSON al Editor.', { error: err.message });
    }
  };

  const renderAuthSummary = () => {
    if (currentAuth && currentAuth.authorized) {
      const who =
        (currentEditor && currentEditor.display_name) ||
        currentAuth.displayName ||
        currentAuth.email ||
        'editor';
      const mode = currentAuth.mode ? ` · ${currentAuth.mode}` : '';
      el.authSummary.textContent = `Sesión: ${who} (${currentRole()})${mode}`;
    } else if (sessionJwt) {
      el.authSummary.textContent = 'JWT guardado pero inválido/caducado.';
    } else {
      el.authSummary.textContent = 'Sin sesión JWT.';
    }

    if (el.editorsSection) {
      el.editorsSection.classList.toggle('hidden', !canManageEditors());
    }
    renderEditorVisibility();
  };

  const renderLockInfo = () => {
    if (!isAuthenticated()) {
      currentLock = null;
      el.lockInfo.textContent = 'Lock: inicia sesión para ver/gestionar lock.';
      return;
    }
    if (!currentLock) {
      el.lockInfo.textContent = 'Lock: sin lock activo.';
      return;
    }
    const me =
      currentAuth &&
      currentAuth.editorId !== null &&
      currentAuth.editorId !== undefined &&
      Number(currentAuth.editorId) === Number(currentLock.owner_id);
    const who = currentLock.owner_email || `editor:${currentLock.owner_id || '?'}`;
    el.lockInfo.textContent = `Lock: ${me ? 'tuyo' : `de ${who}`} · expira: ${
      currentLock.expires_at || 'n/d'
    }`;
  };

  const renderEditors = (items) => {
    if (!el.editorsList) return;
    el.editorsList.innerHTML = '';
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      el.editorsList.textContent = 'No hay editores.';
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'editor-item';

      const header = document.createElement('div');
      header.className = 'editor-header';

      const email = document.createElement('p');
      email.className = 'editor-email';
      email.textContent = item.email || `editor-${item.id}`;

      const roleTag = document.createElement('span');
      roleTag.className = 'editor-role';
      roleTag.textContent = item.role || 'editor';

      header.appendChild(email);
      header.appendChild(roleTag);

      const row = document.createElement('div');
      row.className = 'row row-wrap gap-sm';

      const nameField = document.createElement('label');
      nameField.className = 'field grow';
      const nameLabel = document.createElement('span');
      nameLabel.textContent = 'Nombre';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = item.display_name || '';
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);

      const roleField = document.createElement('label');
      roleField.className = 'field';
      const roleLabel = document.createElement('span');
      roleLabel.textContent = 'Rol';
      const roleSelect = document.createElement('select');
      ['editor', 'publisher', 'admin'].forEach((role) => {
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = role;
        if (normalizeRole(item.role) === role) opt.selected = true;
        roleSelect.appendChild(opt);
      });
      roleField.appendChild(roleLabel);
      roleField.appendChild(roleSelect);

      const passwordField = document.createElement('label');
      passwordField.className = 'field grow';
      const passwordLabel = document.createElement('span');
      passwordLabel.textContent = 'Nueva password (opcional)';
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.placeholder = 'mínimo 8';
      passwordField.appendChild(passwordLabel);
      passwordField.appendChild(passwordInput);

      const activeLabel = document.createElement('label');
      activeLabel.className = 'checkbox';
      const activeInput = document.createElement('input');
      activeInput.type = 'checkbox';
      activeInput.checked = Boolean(item.is_active);
      activeLabel.appendChild(activeInput);
      activeLabel.append('Activo');

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary';
      saveBtn.textContent = 'Guardar editor';
      saveBtn.addEventListener('click', async () => {
        try {
          const body = {
            display_name: asText(nameInput.value),
            role: asText(roleSelect.value),
            is_active: Boolean(activeInput.checked)
          };
          const nextPassword = asText(passwordInput.value);
          if (nextPassword) body.password = nextPassword;
          const out = await api(`/content/admin/editors/${item.id}`, {
            method: 'PUT',
            headers: headers(true),
            body: JSON.stringify(body)
          });
          setStatus('Editor actualizado.', out);
          await loadEditors();
        } catch (err) {
          setStatus('Error actualizando editor.', err.response || { error: err.message });
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Eliminar editor';
      const isSelf =
        currentAuth &&
        currentAuth.editorId !== undefined &&
        currentAuth.editorId !== null &&
        Number(currentAuth.editorId) === Number(item.id);
      deleteBtn.disabled = Boolean(isSelf);
      if (isSelf) {
        deleteBtn.title = 'No puedes eliminar tu propio usuario.';
      }
      deleteBtn.addEventListener('click', async () => {
        if (isSelf) {
          setStatus('No puedes eliminar tu propio usuario.');
          return;
        }
        const ok = window.confirm(
          `¿Eliminar el editor ${item.email || `#${item.id}`}? Esta acción no se puede deshacer.`
        );
        if (!ok) return;
        try {
          const out = await api(`/content/admin/editors/${item.id}`, {
            method: 'DELETE',
            headers: headers(false)
          });
          setStatus('Editor eliminado.', out);
          await loadEditors();
          await refreshLock({ silent: true });
        } catch (err) {
          setStatus('Error eliminando editor.', err.response || { error: err.message });
        }
      });

      row.appendChild(nameField);
      row.appendChild(roleField);
      row.appendChild(passwordField);
      row.appendChild(activeLabel);
      row.appendChild(saveBtn);
      row.appendChild(deleteBtn);

      card.appendChild(header);
      card.appendChild(row);
      el.editorsList.appendChild(card);
    });
  };

  const renderReleases = (items) => {
    el.releasesBox.innerHTML = '';
    const releases = Array.isArray(items) ? items : [];
    if (!releases.length) {
      el.releasesBox.textContent = 'No hay releases.';
      return;
    }

    releases.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'release-item';

      const title = document.createElement('p');
      title.className = 'release-name';
      title.textContent = `#${item.id} ${item.name || '(sin nombre)'}`;
      if (item.published) {
        const tag = document.createElement('span');
        tag.className = 'release-tag';
        tag.textContent = 'published';
        title.appendChild(tag);
      }

      const meta = document.createElement('p');
      meta.className = 'release-meta';
      meta.textContent = `created: ${item.created_at || '-'} · published: ${item.published_at || '-'}`;

      const ttsSummary = item && item.tts_summary && typeof item.tts_summary === 'object' ? item.tts_summary : null;
      const ttsSummaryEl = document.createElement('p');
      ttsSummaryEl.className = 'release-meta release-tts-summary';
      const ttsProgressEl = document.createElement('div');
      ttsProgressEl.className = 'release-tts-progress';
      const ttsProgressFillEl = document.createElement('span');
      ttsProgressFillEl.className = 'release-tts-progress-fill';
      ttsProgressEl.appendChild(ttsProgressFillEl);
      if (ttsSummary) {
        ttsProgressEl.classList.remove('hidden', 'is-ok', 'is-warn', 'is-error');
        if (ttsSummary.invalid_snapshot) {
          ttsSummaryEl.textContent = 'Audios: snapshot inválido.';
          ttsSummaryEl.classList.add('is-warn');
          ttsProgressEl.classList.add('is-error');
          ttsProgressFillEl.style.width = '0%';
        } else {
          const total = Number(ttsSummary.total) || 0;
          const ready = Number(ttsSummary.ready) || 0;
          const pending = Number(ttsSummary.pending) || 0;
          const outdated = Number(ttsSummary.outdated) || 0;
          const remoteMissing = Number(ttsSummary.remote_missing) || 0;
          const errors = Number(ttsSummary.errors) || 0;
          const coverage = Number.isFinite(Number(ttsSummary.coverage_percent))
            ? Math.max(0, Math.min(100, Math.round(Number(ttsSummary.coverage_percent))))
            : 0;
          if (total <= 0) {
            ttsSummaryEl.textContent = 'Audios: sin hints para generar.';
            ttsSummaryEl.classList.add('is-ok');
            ttsProgressEl.classList.add('is-ok');
            ttsProgressFillEl.style.width = '100%';
          } else {
            ttsSummaryEl.textContent = `Audios: ${ready}/${total} (${coverage}%) · pendientes ${pending} · outdated ${outdated}${
              remoteMissing > 0 ? ` · remote missing ${remoteMissing}` : ''
            }`;
            ttsProgressFillEl.style.width = `${coverage}%`;
            if (pending === 0 && outdated === 0 && remoteMissing === 0 && errors === 0) {
              ttsSummaryEl.classList.add('is-ok');
              ttsProgressEl.classList.add('is-ok');
            } else if (errors > 0 || remoteMissing > 0) {
              ttsSummaryEl.classList.add('is-warn');
              ttsProgressEl.classList.add('is-error');
            } else {
              ttsSummaryEl.classList.add('is-warn');
              ttsProgressEl.classList.add('is-warn');
            }
          }
        }
      } else {
        ttsSummaryEl.textContent = 'Audios: resumen no disponible.';
        ttsProgressEl.classList.add('hidden');
      }

      const actions = document.createElement('div');
      actions.className = 'row gap-sm top-md row-wrap';
      const canPublishAction = hasRoleAtLeast(currentRole(), 'publisher');
      const baseDisabled = {
        publish: !canPublishAction,
        restore: !canPublishAction,
        verify: !canPublishAction,
        generate: !canPublishAction || !Boolean(item.published),
        delete: !canPublishAction || Boolean(item.published)
      };
      let actionBusy = false;

      const applyActionDisabledState = () => {
        if (actionBusy) {
          publishBtn.disabled = true;
          restoreBtn.disabled = true;
          verifyTtsBtn.disabled = true;
          generateTtsBtn.disabled = true;
          deleteBtn.disabled = true;
          return;
        }
        publishBtn.disabled = baseDisabled.publish;
        restoreBtn.disabled = baseDisabled.restore;
        verifyTtsBtn.disabled = baseDisabled.verify;
        generateTtsBtn.disabled = baseDisabled.generate;
        deleteBtn.disabled = baseDisabled.delete;
      };

      const setActionBusy = (busy) => {
        actionBusy = Boolean(busy);
        [publishBtn, restoreBtn, verifyTtsBtn, generateTtsBtn, deleteBtn].forEach((btn) => {
          if (!btn) return;
          btn.classList.toggle('is-busy', actionBusy);
        });
        applyActionDisabledState();
      };

      const publishBtn = document.createElement('button');
      publishBtn.className = 'btn';
      publishBtn.textContent = 'Publicar esta release';
      publishBtn.addEventListener('click', async () => {
        if (actionBusy) return;
        setActionBusy(true);
        try {
          setStatus('Publicando release...');
          const out = await api(`/content/admin/releases/${item.id}/publish`, {
            method: 'POST',
            headers: headers(false)
          });
          setStatus('Release publicada.', out);
          await loadReleases();
          await refreshLock({ silent: true });
        } catch (err) {
          setStatus('Error publicando release.', err.response || { error: err.message });
          await refreshLock({ silent: true });
        } finally {
          setActionBusy(false);
        }
      });

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn';
      restoreBtn.textContent = 'Restaurar a draft';
      restoreBtn.addEventListener('click', async () => {
        if (actionBusy) return;
        setActionBusy(true);
        try {
          setStatus('Restaurando draft desde release...');
          const out = await api(`/content/admin/releases/${item.id}/restore-draft`, {
            method: 'POST',
            headers: headers(false)
          });
          setStatus('Draft restaurado desde release.', out);
          await loadDraft();
          await loadReleases();
          await refreshLock({ silent: true });
        } catch (err) {
          setStatus('Error restaurando release.', err.response || { error: err.message });
          await refreshLock({ silent: true });
        } finally {
          setActionBusy(false);
        }
      });

      const verifyTtsBtn = document.createElement('button');
      verifyTtsBtn.className = 'btn';
      verifyTtsBtn.textContent = 'Verificar audios';
      verifyTtsBtn.addEventListener('click', async () => {
        if (actionBusy) return;
        const originalLabel = verifyTtsBtn.textContent;
        setActionBusy(true);
        verifyTtsBtn.textContent = 'Verificando...';
        try {
          setStatus('Verificando audios...');
          const out = await api(`/content/admin/releases/${item.id}/tts/verify`, {
            method: 'POST',
            headers: headers(true),
            body: JSON.stringify({ checkRemote: true })
          });
          setStatus('Audios verificados.', out);
          await loadReleases();
        } catch (err) {
          setStatus('Error verificando audios.', err.response || { error: err.message });
        } finally {
          verifyTtsBtn.textContent = originalLabel;
          setActionBusy(false);
        }
      });

      const generateTtsBtn = document.createElement('button');
      generateTtsBtn.className = 'btn btn-primary';
      generateTtsBtn.textContent = 'Generar audios';
      if (!item.published) {
        generateTtsBtn.title = 'Solo se generan audios para releases publicadas.';
      }
      generateTtsBtn.addEventListener('click', async () => {
        if (actionBusy) return;
        if (!item.published) {
          setStatus('Solo se generan audios para releases publicadas.');
          return;
        }
        const originalLabel = generateTtsBtn.textContent;
        setActionBusy(true);
        generateTtsBtn.textContent = 'Generando...';
        try {
          setStatus('Generando audios...');
          const out = await api(`/content/admin/releases/${item.id}/tts/generate`, {
            method: 'POST',
            headers: headers(true),
            body: JSON.stringify({})
          });
          setStatus('Generación de audios finalizada.', out);
          await loadReleases();
        } catch (err) {
          setStatus('Error generando audios.', err.response || { error: err.message });
        } finally {
          generateTtsBtn.textContent = originalLabel;
          setActionBusy(false);
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Eliminar release';
      if (item.published) {
        deleteBtn.title = 'No se puede eliminar la release publicada.';
      }
      deleteBtn.addEventListener('click', async () => {
        if (actionBusy) return;
        if (item.published) {
          setStatus('No se puede eliminar la release publicada.');
          return;
        }
        const ok = window.confirm(
          `¿Eliminar la release #${item.id} (${item.name || 'sin nombre'})? Esta acción no se puede deshacer.`
        );
        if (!ok) return;
        setActionBusy(true);
        try {
          setStatus('Eliminando release...');
          const out = await api(`/content/admin/releases/${item.id}`, {
            method: 'DELETE',
            headers: headers(false)
          });
          setStatus('Release eliminada.', out);
          await loadReleases();
        } catch (err) {
          setStatus('Error eliminando release.', err.response || { error: err.message });
        } finally {
          setActionBusy(false);
        }
      });

      applyActionDisabledState();

      actions.appendChild(publishBtn);
      actions.appendChild(restoreBtn);
      actions.appendChild(verifyTtsBtn);
      actions.appendChild(generateTtsBtn);
      actions.appendChild(deleteBtn);

      div.appendChild(title);
      div.appendChild(meta);
      div.appendChild(ttsSummaryEl);
      div.appendChild(ttsProgressEl);
      div.appendChild(actions);
      el.releasesBox.appendChild(div);
    });
  };

  const loadMe = async ({ silent = false } = {}) => {
    try {
      const out = await api('/content/admin/me', { headers: headers(false) });
      currentAuth = out.auth || null;
      currentEditor = out.editor || null;
      renderAuthSummary();
      return true;
    } catch (err) {
      currentAuth = { authorized: false, role: 'guest' };
      currentEditor = null;
      renderAuthSummary();
      if (!silent) {
        setStatus('Sesión no válida.', err.response || { error: err.message });
      }
      return false;
    }
  };

  const login = async () => {
    try {
      const email = asText(el.loginEmailInput.value).toLowerCase();
      const password = String(el.loginPasswordInput.value || '');
      if (!email || !password) {
        setStatus('Email y password son obligatorios para login.');
        return;
      }
      const out = await api('/content/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      sessionJwt = asText(out && out.token);
      if (!sessionJwt) {
        setStatus('Login inválido: token vacío.', out || {});
        return;
      }
      localStorage.setItem(JWT_KEY, sessionJwt);
      localStorage.setItem(LOGIN_EMAIL_KEY, email);
      el.loginPasswordInput.value = '';
      await loadMe({ silent: true });
      await refreshLock({ silent: true });
      await loadDraft();
      await loadReleases();
      await loadEditors({ silent: true });
      setStatus('Login OK.', {
        editor: out.editor || null,
        expires_in: out.expires_in || null
      });
    } catch (err) {
      setStatus('Error en login.', err.response || { error: err.message });
    }
  };

  const logout = async () => {
    sessionJwt = '';
    currentAuth = { authorized: false, role: 'guest' };
    currentEditor = null;
    currentLock = null;
    localStorage.removeItem(JWT_KEY);
    renderAuthSummary();
    renderLockInfo();
    renderEditors([]);
    setStatus('Sesión cerrada.');
  };

  const refreshLock = async ({ silent = false } = {}) => {
    if (!isAuthenticated()) {
      currentLock = null;
      renderLockInfo();
      return;
    }
    try {
      const out = await api('/content/admin/draft-lock', { headers: headers(false) });
      currentLock = out && out.lock ? out.lock : null;
      renderLockInfo();
    } catch (err) {
      currentLock = null;
      renderLockInfo();
      if (!silent) {
        setStatus('Error obteniendo lock.', err.response || { error: err.message });
      }
    }
  };

  const claimLock = async () => {
    try {
      const out = await api('/content/admin/draft-lock/claim', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({})
      });
      currentLock = out && out.lock ? out.lock : null;
      renderLockInfo();
      setStatus('Lock tomado.', out);
    } catch (err) {
      setStatus('No se pudo tomar lock.', err.response || { error: err.message });
      await refreshLock({ silent: true });
    }
  };

  const releaseLock = async () => {
    try {
      const out = await api('/content/admin/draft-lock/release', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({})
      });
      currentLock = null;
      renderLockInfo();
      setStatus('Lock liberado.', out);
    } catch (err) {
      setStatus('No se pudo liberar lock.', err.response || { error: err.message });
      await refreshLock({ silent: true });
    }
  };

  const loadEditors = async ({ silent = false } = {}) => {
    if (!canManageEditors()) {
      renderEditors([]);
      return;
    }
    try {
      const out = await api('/content/admin/editors', { headers: headers(false) });
      renderEditors(out && out.editors ? out.editors : []);
    } catch (err) {
      renderEditors([]);
      if (!silent) {
        setStatus('Error cargando editores.', err.response || { error: err.message });
      }
    }
  };

  const createEditor = async () => {
    try {
      const email = asText(el.newEditorEmailInput.value).toLowerCase();
      const displayName = asText(el.newEditorNameInput.value);
      const role = asText(el.newEditorRoleInput.value).toLowerCase();
      const password = asText(el.newEditorPasswordInput.value);
      const isActive = Boolean(el.newEditorActiveInput.checked);
      if (!email || !password) {
        setStatus('Email y password son obligatorios para crear editor.');
        return;
      }
      const out = await api('/content/admin/editors', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({
          email,
          display_name: displayName,
          role,
          password,
          is_active: isActive
        })
      });
      el.newEditorEmailInput.value = '';
      el.newEditorNameInput.value = '';
      el.newEditorPasswordInput.value = '';
      el.newEditorRoleInput.value = 'editor';
      el.newEditorActiveInput.checked = true;
      setStatus('Editor creado.', out);
      await loadEditors({ silent: true });
    } catch (err) {
      setStatus('Error creando editor.', err.response || { error: err.message });
    }
  };

  const loadHealth = async () => {
    try {
      const out = await api('/content/health');
      setStatus('Health OK.', out);
    } catch (err) {
      setStatus('Error en health.', err.response || { error: err.message });
    }
  };

  const loadPublic = async () => {
    try {
      const out = await api('/content/training-data', {
        headers: headers(false)
      });
      const payload = out && out.data ? out.data : out;
      setContentState(payload, { syncJson: true, preserveSelection: false });
      setStatus('Contenido público cargado.', {
        source: out && out.source ? out.source : 'n/a',
        release: out && out.release ? out.release : null
      });
    } catch (err) {
      setStatus('Error cargando contenido público.', err.response || { error: err.message });
    }
  };

  const loadDraft = async () => {
    try {
      const out = await api('/content/admin/training-data', {
        headers: headers(false)
      });
      const payload = out && out.live ? out.live : { routes: [], modules: [], sessions: [] };
      setContentState(payload, { syncJson: true, preserveSelection: false });
      setStatus('Draft cargado.', {
        published:
          out && out.published
            ? {
                id: out.published.id,
                name: out.published.name,
                published_at: out.published.published_at
              }
            : null
      });
      await refreshLock({ silent: true });
    } catch (err) {
      setStatus('Error cargando draft (token requerido).', err.response || { error: err.message });
    }
  };

  const saveDraft = async () => {
    try {
      const payload = tryParseEditor();
      const out = await api('/content/admin/training-data', {
        method: 'PUT',
        headers: headers(true),
        body: JSON.stringify(payload)
      });
      setContentState(payload, { syncJson: true, preserveSelection: true });
      setStatus('Draft guardado.', out);
      await refreshLock({ silent: true });
    } catch (err) {
      setStatus('Error guardando draft.', err.response || { error: err.message });
      await refreshLock({ silent: true });
    }
  };

  const publishDraft = async () => {
    try {
      const name = asText(el.releaseNameInput.value);
      const out = await api('/content/admin/publish', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ name })
      });
      setStatus('Draft publicado.', out);
      await loadReleases();
      await refreshLock({ silent: true });
    } catch (err) {
      setStatus('Error publicando draft.', err.response || { error: err.message });
      await refreshLock({ silent: true });
    }
  };

  const validateEditor = () => {
    try {
      const payload = tryParseEditor();
      const normalized = normalizePayload(payload);
      updateCounts(normalized);
      setStatus('JSON válido.', {
        routes: normalized.routes.length,
        modules: normalized.modules.length,
        sessions: normalized.sessions.length
      });
    } catch (err) {
      setStatus('JSON inválido.', { error: err.message });
    }
  };

  const loadReleases = async () => {
    try {
      const out = await api('/content/admin/releases?limit=50&include_tts_summary=1', {
        headers: headers(false)
      });
      renderReleases(out.releases || []);
    } catch (err) {
      renderReleases([]);
      setStatus('Error cargando releases.', err.response || { error: err.message });
    }
  };

  const bindGuidedEditorEvents = () => {
    el.modeGuidedBtn.addEventListener('click', () => setEditorMode(MODE_GUIDED));
    el.modeJsonBtn.addEventListener('click', () => setEditorMode(MODE_JSON));
    el.syncFromJsonBtn.addEventListener('click', applyJsonToGuided);
    el.jsonEditor.addEventListener('input', () => {
      if (syncingJsonEditor) return;
      jsonDirty = true;
      updateSyncFromJsonButtonState();
    });

    el.routesList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-route-id]');
      if (!button) return;
      selectedRouteId = button.dataset.routeId;
      selectedModuleId = '';
      selectedSessionId = '';
      renderGuided();
    });

    el.modulesList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-module-id]');
      if (!button) return;
      selectedModuleId = button.dataset.moduleId;
      selectedSessionId = '';
      renderGuided();
    });

    el.sessionsList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-session-id]');
      if (!button) return;
      selectedSessionId = button.dataset.sessionId;
      renderGuided();
    });

    el.addRouteBtn.addEventListener('click', addRoute);
    el.saveRouteBtn.addEventListener('click', saveRoute);
    el.moveRouteUpBtn.addEventListener('click', () => moveRoute(-1));
    el.moveRouteDownBtn.addEventListener('click', () => moveRoute(1));
    el.deleteRouteBtn.addEventListener('click', deleteRoute);

    el.addModuleBtn.addEventListener('click', addModule);
    el.saveModuleBtn.addEventListener('click', saveModule);
    el.moveModuleUpBtn.addEventListener('click', () => moveModule(-1));
    el.moveModuleDownBtn.addEventListener('click', () => moveModule(1));
    el.deleteModuleBtn.addEventListener('click', deleteModule);

    el.addSessionBtn.addEventListener('click', addSession);
    el.saveSessionBtn.addEventListener('click', saveSession);
    el.moveSessionUpBtn.addEventListener('click', () => moveSession(-1));
    el.moveSessionDownBtn.addEventListener('click', () => moveSession(1));
    el.deleteSessionBtn.addEventListener('click', deleteSession);
  };

  const bootstrap = async () => {
    try {
      const jwtStored = localStorage.getItem(JWT_KEY);
      if (jwtStored) {
        sessionJwt = String(jwtStored);
      }
      const lastEmail = localStorage.getItem(LOGIN_EMAIL_KEY);
      if (lastEmail) {
        el.loginEmailInput.value = String(lastEmail);
      }
    } catch (_err) {
      // no-op
    }

    renderAuthSummary();
    renderLockInfo();

    el.loginBtn.addEventListener('click', login);
    el.logoutBtn.addEventListener('click', logout);
    el.loginPasswordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') login();
    });
    el.claimLockBtn.addEventListener('click', claimLock);
    el.releaseLockBtn.addEventListener('click', releaseLock);
    el.refreshLockBtn.addEventListener('click', () => refreshLock({ silent: false }));
    el.refreshEditorsBtn.addEventListener('click', () => loadEditors({ silent: false }));
    el.createEditorBtn.addEventListener('click', createEditor);
    el.healthBtn.addEventListener('click', loadHealth);
    el.loadDraftBtn.addEventListener('click', loadDraft);
    el.loadPublicBtn.addEventListener('click', loadPublic);
    el.validateBtn.addEventListener('click', validateEditor);
    el.saveDraftBtn.addEventListener('click', saveDraft);
    el.publishBtn.addEventListener('click', publishDraft);
    el.refreshReleasesBtn.addEventListener('click', loadReleases);

    bindGuidedEditorEvents();
    setEditorMode(MODE_GUIDED);
    setContentState({ routes: [], modules: [], sessions: [] }, { syncJson: true, preserveSelection: false });
    updateSyncFromJsonButtonState();

    await loadHealth();
    await loadMe({ silent: true });
    await loadDraft();
    await loadReleases();
    await refreshLock({ silent: true });
    await loadEditors({ silent: true });
  };

  bootstrap();
})();
