(() => {
  const TOKEN_KEY = 'speakapp:content-dashboard:token';
  const JWT_KEY = 'speakapp:content-dashboard:jwt';
  const LOGIN_EMAIL_KEY = 'speakapp:content-dashboard:login-email';
  const MODE_GUIDED = 'guided';
  const MODE_JSON = 'json';

  const el = {
    tokenInput: document.getElementById('tokenInput'),
    loginEmailInput: document.getElementById('loginEmailInput'),
    loginPasswordInput: document.getElementById('loginPasswordInput'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    authSummary: document.getElementById('authSummary'),
    showToken: document.getElementById('showToken'),
    saveTokenBtn: document.getElementById('saveTokenBtn'),
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
    routeTitleInput: document.getElementById('routeTitleInput'),
    routeNoteInput: document.getElementById('routeNoteInput'),
    saveRouteBtn: document.getElementById('saveRouteBtn'),
    moveRouteUpBtn: document.getElementById('moveRouteUpBtn'),
    moveRouteDownBtn: document.getElementById('moveRouteDownBtn'),
    deleteRouteBtn: document.getElementById('deleteRouteBtn'),

    selectedRouteLabel: document.getElementById('selectedRouteLabel'),
    moduleIdInput: document.getElementById('moduleIdInput'),
    moduleTitleInput: document.getElementById('moduleTitleInput'),
    moduleSubtitleInput: document.getElementById('moduleSubtitleInput'),
    saveModuleBtn: document.getElementById('saveModuleBtn'),
    moveModuleUpBtn: document.getElementById('moveModuleUpBtn'),
    moveModuleDownBtn: document.getElementById('moveModuleDownBtn'),
    deleteModuleBtn: document.getElementById('deleteModuleBtn'),

    selectedModuleLabel: document.getElementById('selectedModuleLabel'),
    selectedSessionLabel: document.getElementById('selectedSessionLabel'),
    sessionIdInput: document.getElementById('sessionIdInput'),
    sessionTitleInput: document.getElementById('sessionTitleInput'),
    sessionFocusInput: document.getElementById('sessionFocusInput'),
    sessionSoundTitleInput: document.getElementById('sessionSoundTitleInput'),
    sessionSoundHintInput: document.getElementById('sessionSoundHintInput'),
    sessionSoundPhoneticInput: document.getElementById('sessionSoundPhoneticInput'),
    sessionSoundExpectedInput: document.getElementById('sessionSoundExpectedInput'),
    sessionSpellingTitleInput: document.getElementById('sessionSpellingTitleInput'),
    sessionSpellingHintInput: document.getElementById('sessionSpellingHintInput'),
    sessionSpellingWordsInput: document.getElementById('sessionSpellingWordsInput'),
    sessionSentenceTitleInput: document.getElementById('sessionSentenceTitleInput'),
    sessionSentenceHintInput: document.getElementById('sessionSentenceHintInput'),
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

  const normalizeSession = (session, idx) => {
    const base = session && typeof session === 'object' ? deepClone(session) : {};
    base.id = asText(base.id) || `session-${idx + 1}`;
    base.title = asText(base.title) || `Session ${idx + 1}`;
    delete base.progress;
    delete base.status;

    base.speak = base.speak && typeof base.speak === 'object' ? base.speak : {};
    base.speak.focus = asText(base.speak.focus);
    base.speak.sound = base.speak.sound && typeof base.speak.sound === 'object' ? base.speak.sound : {};
    base.speak.sound.title = asText(base.speak.sound.title);
    base.speak.sound.hint = asText(base.speak.sound.hint);
    base.speak.sound.phonetic = asText(base.speak.sound.phonetic);
    base.speak.sound.expected = asText(base.speak.sound.expected);
    base.speak.spelling = base.speak.spelling && typeof base.speak.spelling === 'object' ? base.speak.spelling : {};
    base.speak.spelling.title = asText(base.speak.spelling.title);
    base.speak.spelling.hint = asText(base.speak.spelling.hint);
    base.speak.spelling.words = uniqStrings(base.speak.spelling.words);
    delete base.speak.spelling.expected;
    base.speak.sentence = base.speak.sentence && typeof base.speak.sentence === 'object' ? base.speak.sentence : {};
    base.speak.sentence.title = asText(base.speak.sentence.title);
    base.speak.sentence.hint = asText(base.speak.sentence.hint);
    base.speak.sentence.sentence = asText(base.speak.sentence.sentence);
    base.speak.sentence.expected = asText(base.speak.sentence.expected);

    return base;
  };

  const normalizePayload = (payload) => {
    const raw = payload && typeof payload === 'object' ? payload : {};

    const routes = (Array.isArray(raw.routes) ? raw.routes : []).map((route, idx) => {
      const base = route && typeof route === 'object' ? deepClone(route) : {};
      return {
        id: asText(base.id) || `route-${idx + 1}`,
        title: asText(base.title) || `Route ${idx + 1}`,
        note: asText(base.note),
        moduleIds: uniqStrings(base.moduleIds)
      };
    });

    const modules = (Array.isArray(raw.modules) ? raw.modules : []).map((module, idx) => {
      const base = module && typeof module === 'object' ? deepClone(module) : {};
      return {
        id: asText(base.id) || `module-${idx + 1}`,
        title: asText(base.title) || `Module ${idx + 1}`,
        subtitle: asText(base.subtitle),
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

  const getToken = () => asText(el.tokenInput.value);

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
    if (sessionJwt) {
      result.Authorization = `Bearer ${sessionJwt}`;
    } else {
      const token = getToken();
      if (token) result['x-content-token'] = token;
    }
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
    el.guidedSection.classList.toggle('hidden', !guided);
    el.jsonSection.classList.toggle('hidden', guided);
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
    el.jsonEditor.value = JSON.stringify(contentState, null, 2);
    updateCounts(contentState);
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
      el.routeNoteInput,
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
      el.moduleSubtitleInput,
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
      el.sessionFocusInput,
      el.sessionSoundTitleInput,
      el.sessionSoundHintInput,
      el.sessionSoundPhoneticInput,
      el.sessionSoundExpectedInput,
      el.sessionSpellingTitleInput,
      el.sessionSpellingHintInput,
      el.sessionSpellingWordsInput,
      el.sessionSentenceTitleInput,
      el.sessionSentenceHintInput,
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
      setRouteFormDisabled(false);
      el.routeIdInput.value = route.id;
      el.routeTitleInput.value = route.title;
      el.routeNoteInput.value = route.note || '';
      el.selectedRouteLabel.textContent = `Route actual: ${route.title} (${route.id})`;
      el.addModuleBtn.disabled = false;
    } else {
      setRouteFormDisabled(true);
      el.routeIdInput.value = '';
      el.routeTitleInput.value = '';
      el.routeNoteInput.value = '';
      el.selectedRouteLabel.textContent = 'Selecciona o crea una route.';
      el.addModuleBtn.disabled = true;
    }

    if (module) {
      setModuleFormDisabled(false);
      el.moduleIdInput.value = module.id;
      el.moduleTitleInput.value = module.title;
      el.moduleSubtitleInput.value = module.subtitle || '';
      el.selectedModuleLabel.textContent = `Módulo actual: ${module.title} (${module.id})`;
    } else {
      setModuleFormDisabled(true);
      el.moduleIdInput.value = '';
      el.moduleTitleInput.value = '';
      el.moduleSubtitleInput.value = '';
      el.selectedModuleLabel.textContent = 'Selecciona o crea un módulo.';
    }

    if (session) {
      setSessionFormDisabled(false);
      el.selectedSessionLabel.textContent = `Sesión actual: ${session.title} (${session.id})`;
      el.sessionIdInput.value = session.id;
      el.sessionTitleInput.value = session.title;
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

      el.sessionSoundTitleInput.value = sound.title || '';
      el.sessionSoundHintInput.value = sound.hint || '';
      el.sessionSoundPhoneticInput.value = sound.phonetic || '';
      el.sessionSoundExpectedInput.value = sound.expected || '';

      el.sessionSpellingTitleInput.value = spelling.title || '';
      el.sessionSpellingHintInput.value = spelling.hint || '';
      el.sessionSpellingWordsInput.value = Array.isArray(spelling.words) ? spelling.words.join('\n') : '';

      el.sessionSentenceTitleInput.value = sentence.title || '';
      el.sessionSentenceHintInput.value = sentence.hint || '';
      el.sessionSentenceTextInput.value = sentence.sentence || '';
      el.sessionSentenceExpectedInput.value = sentence.expected || '';
    } else {
      setSessionFormDisabled(true);
      el.selectedSessionLabel.textContent = 'Selecciona o crea una sesión.';
      el.sessionIdInput.value = '';
      el.sessionTitleInput.value = '';
      el.sessionFocusInput.value = '';
      el.sessionSoundTitleInput.value = '';
      el.sessionSoundHintInput.value = '';
      el.sessionSoundPhoneticInput.value = '';
      el.sessionSoundExpectedInput.value = '';
      el.sessionSpellingTitleInput.value = '';
      el.sessionSpellingHintInput.value = '';
      el.sessionSpellingWordsInput.value = '';
      el.sessionSentenceTitleInput.value = '';
      el.sessionSentenceHintInput.value = '';
      el.sessionSentenceTextInput.value = '';
      el.sessionSentenceExpectedInput.value = '';
    }
  };

  const addRoute = () => {
    const ids = new Set(contentState.routes.map((item) => item.id));
    const id = ensureUniqueId(`route-${contentState.routes.length + 1}`, ids);
    contentState.routes.push({ id, title: `Route ${contentState.routes.length + 1}`, note: '', moduleIds: [] });
    selectedRouteId = id;
    selectedModuleId = '';
    selectedSessionId = '';
    commitGuidedChanges('Route añadida.');
  };

  const saveRoute = () => {
    const route = getSelectedRoute();
    if (!route) return;

    const nextId = asText(el.routeIdInput.value);
    const nextTitle = asText(el.routeTitleInput.value);
    const nextNote = asText(el.routeNoteInput.value);

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
    route.title = nextTitle;
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
    const module = { id, title: `Module ${contentState.modules.length + 1}`, subtitle: '', sessionIds: [] };

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
    const nextTitle = asText(el.moduleTitleInput.value);
    const nextSubtitle = asText(el.moduleSubtitleInput.value);

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
    module.title = nextTitle;
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
          sound: { title: 'THE WAY', hint: '', phonetic: '', expected: '' },
          spelling: { title: 'THE SPELLING', hint: '', words: [], expected: '' },
          sentence: { title: 'WHOLE SENTENCE', hint: '', sentence: '', expected: '' }
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
    const nextTitle = asText(el.sessionTitleInput.value);
    const nextFocus = asText(el.sessionFocusInput.value);

    const nextSoundTitle = asText(el.sessionSoundTitleInput.value);
    const nextSoundHint = asText(el.sessionSoundHintInput.value);
    const nextSoundPhonetic = asText(el.sessionSoundPhoneticInput.value);
    const nextSoundExpected = asText(el.sessionSoundExpectedInput.value);

    const nextSpellingTitle = asText(el.sessionSpellingTitleInput.value);
    const nextSpellingHint = asText(el.sessionSpellingHintInput.value);
    const nextSpellingWords = parseWordsInput(el.sessionSpellingWordsInput.value);

    const nextSentenceTitle = asText(el.sessionSentenceTitleInput.value);
    const nextSentenceHint = asText(el.sessionSentenceHintInput.value);
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
    session.title = nextTitle;

    session.speak = session.speak && typeof session.speak === 'object' ? session.speak : {};
    session.speak.focus = nextFocus;
    session.speak.sound = session.speak.sound && typeof session.speak.sound === 'object' ? session.speak.sound : {};
    session.speak.sound.title = nextSoundTitle;
    session.speak.sound.hint = nextSoundHint;
    session.speak.sound.phonetic = nextSoundPhonetic;
    session.speak.sound.expected = nextSoundExpected;

    session.speak.spelling =
      session.speak.spelling && typeof session.speak.spelling === 'object' ? session.speak.spelling : {};
    session.speak.spelling.title = nextSpellingTitle;
    session.speak.spelling.hint = nextSpellingHint;
    session.speak.spelling.words = nextSpellingWords;

    session.speak.sentence =
      session.speak.sentence && typeof session.speak.sentence === 'object' ? session.speak.sentence : {};
    session.speak.sentence.title = nextSentenceTitle;
    session.speak.sentence.hint = nextSentenceHint;
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
      setStatus('JSON aplicado al editor guiado.');
      setEditorMode(MODE_GUIDED);
    } catch (err) {
      setStatus('Error aplicando JSON al editor guiado.', { error: err.message });
    }
  };

  const renderAuthSummary = () => {
    const token = getToken();
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
    } else if (token) {
      el.authSummary.textContent = 'Sin JWT. Usando token legacy manual.';
    } else {
      el.authSummary.textContent = 'Sin sesión JWT.';
    }

    if (el.editorsSection) {
      el.editorsSection.classList.toggle('hidden', !canManageEditors());
    }
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

      row.appendChild(nameField);
      row.appendChild(roleField);
      row.appendChild(passwordField);
      row.appendChild(activeLabel);
      row.appendChild(saveBtn);

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

      const actions = document.createElement('div');
      actions.className = 'row gap-sm top-md row-wrap';
      const canPublishAction = hasRoleAtLeast(currentRole(), 'publisher') || Boolean(getToken());

      const publishBtn = document.createElement('button');
      publishBtn.className = 'btn';
      publishBtn.textContent = 'Publicar esta release';
      publishBtn.disabled = !canPublishAction;
      publishBtn.addEventListener('click', async () => {
        try {
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
        }
      });

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn';
      restoreBtn.textContent = 'Restaurar a draft';
      restoreBtn.disabled = !canPublishAction;
      restoreBtn.addEventListener('click', async () => {
        try {
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
        }
      });

      actions.appendChild(publishBtn);
      actions.appendChild(restoreBtn);

      div.appendChild(title);
      div.appendChild(meta);
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
    if (!isAuthenticated() && !getToken()) {
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
      const out = await api('/content/training-data');
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
      const out = await api('/content/admin/releases?limit=50', {
        headers: headers(false)
      });
      renderReleases(out.releases || []);
    } catch (err) {
      renderReleases([]);
      setStatus('Error cargando releases.', err.response || { error: err.message });
    }
  };

  const saveToken = async () => {
    const token = getToken();
    try {
      localStorage.setItem(TOKEN_KEY, token);
      await loadMe({ silent: true });
      await refreshLock({ silent: true });
      setStatus('Token guardado localmente.');
    } catch (err) {
      setStatus('No se pudo guardar token.', { error: err.message || String(err) });
    }
  };

  const bindGuidedEditorEvents = () => {
    el.modeGuidedBtn.addEventListener('click', () => setEditorMode(MODE_GUIDED));
    el.modeJsonBtn.addEventListener('click', () => setEditorMode(MODE_JSON));
    el.syncFromJsonBtn.addEventListener('click', applyJsonToGuided);

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
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        el.tokenInput.value = token;
      }
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

    el.showToken.addEventListener('change', () => {
      el.tokenInput.type = el.showToken.checked ? 'text' : 'password';
    });
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
    el.saveTokenBtn.addEventListener('click', saveToken);
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

    await loadHealth();
    await loadMe({ silent: true });
    await loadDraft();
    await loadReleases();
    await refreshLock({ silent: true });
    await loadEditors({ silent: true });
  };

  bootstrap();
})();
