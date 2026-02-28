(() => {
  const TOKEN_KEY = 'speakapp:content-dashboard:token';
  const MODE_GUIDED = 'guided';
  const MODE_JSON = 'json';

  const el = {
    tokenInput: document.getElementById('tokenInput'),
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
    sessionIdInput: document.getElementById('sessionIdInput'),
    sessionTitleInput: document.getElementById('sessionTitleInput'),
    sessionFocusInput: document.getElementById('sessionFocusInput'),
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

  const asText = (value) => String(value === undefined || value === null ? '' : value).trim();

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

  const normalizeSession = (session, idx) => {
    const base = session && typeof session === 'object' ? deepClone(session) : {};
    base.id = asText(base.id) || `session-${idx + 1}`;
    base.title = asText(base.title) || `Session ${idx + 1}`;

    base.progress = base.progress && typeof base.progress === 'object' ? base.progress : {};
    base.progress.done = Number.isFinite(Number(base.progress.done)) ? Math.max(0, Math.round(Number(base.progress.done))) : 0;
    base.progress.total = Number.isFinite(Number(base.progress.total))
      ? Math.max(0, Math.round(Number(base.progress.total)))
      : 10;

    base.status = base.status && typeof base.status === 'object' ? base.status : {};
    if (base.status.score !== null && base.status.score !== undefined && base.status.score !== '') {
      const score = Number(base.status.score);
      base.status.score = Number.isFinite(score) ? Math.round(score) : null;
    } else {
      base.status.score = null;
    }
    base.status.label = asText(base.status.label);
    base.status.tone = asText(base.status.tone) || 'neutral';

    base.speak = base.speak && typeof base.speak === 'object' ? base.speak : {};
    base.speak.focus = asText(base.speak.focus);
    base.speak.sound = base.speak.sound && typeof base.speak.sound === 'object' ? base.speak.sound : {};
    base.speak.spelling = base.speak.spelling && typeof base.speak.spelling === 'object' ? base.speak.spelling : {};
    base.speak.sentence = base.speak.sentence && typeof base.speak.sentence === 'object' ? base.speak.sentence : {};

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
    const token = getToken();
    if (token) result['x-content-token'] = token;
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
      el.sessionIdInput.value = session.id;
      el.sessionTitleInput.value = session.title;
      el.sessionFocusInput.value = session.speak && typeof session.speak === 'object' ? session.speak.focus || '' : '';
    } else {
      setSessionFormDisabled(true);
      el.sessionIdInput.value = '';
      el.sessionTitleInput.value = '';
      el.sessionFocusInput.value = '';
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
        progress: { done: 0, total: 10 },
        status: { score: null, label: '', tone: 'neutral' },
        speak: { focus: '', sound: {}, spelling: {}, sentence: {} }
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

      const publishBtn = document.createElement('button');
      publishBtn.className = 'btn';
      publishBtn.textContent = 'Publicar esta release';
      publishBtn.addEventListener('click', async () => {
        try {
          const out = await api(`/content/admin/releases/${item.id}/publish`, {
            method: 'POST',
            headers: headers(false)
          });
          setStatus('Release publicada.', out);
          await loadReleases();
        } catch (err) {
          setStatus('Error publicando release.', err.response || { error: err.message });
        }
      });

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn';
      restoreBtn.textContent = 'Restaurar a draft';
      restoreBtn.addEventListener('click', async () => {
        try {
          const out = await api(`/content/admin/releases/${item.id}/restore-draft`, {
            method: 'POST',
            headers: headers(false)
          });
          setStatus('Draft restaurado desde release.', out);
          await loadDraft();
          await loadReleases();
        } catch (err) {
          setStatus('Error restaurando release.', err.response || { error: err.message });
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
    } catch (err) {
      setStatus('Error guardando draft.', err.response || { error: err.message });
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
    } catch (err) {
      setStatus('Error publicando draft.', err.response || { error: err.message });
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

  const saveToken = () => {
    const token = getToken();
    try {
      localStorage.setItem(TOKEN_KEY, token);
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
    } catch (_err) {
      // no-op
    }

    el.showToken.addEventListener('change', () => {
      el.tokenInput.type = el.showToken.checked ? 'text' : 'password';
    });
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
    await loadDraft();
    await loadReleases();
  };

  bootstrap();
})();
