(() => {
  const TOKEN_KEY = 'speakapp:content-dashboard:token';

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
    jsonEditor: document.getElementById('jsonEditor'),
    releasesBox: document.getElementById('releasesBox')
  };

  const getToken = () => String(el.tokenInput.value || '').trim();

  const setStatus = (message, payload) => {
    const text = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
    el.statusBox.textContent = text;
  };

  const updateCounts = (payload) => {
    const routes = Array.isArray(payload && payload.routes) ? payload.routes.length : 0;
    const modules = Array.isArray(payload && payload.modules) ? payload.modules.length : 0;
    const sessions = Array.isArray(payload && payload.sessions) ? payload.sessions.length : 0;
    el.countsBox.textContent = `routes: ${routes} · modules: ${modules} · sessions: ${sessions}`;
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
      el.jsonEditor.value = JSON.stringify(payload || {}, null, 2);
      updateCounts(payload);
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
      el.jsonEditor.value = JSON.stringify(payload, null, 2);
      updateCounts(payload);
      setStatus('Draft cargado.', {
        published: out && out.published ? {
          id: out.published.id,
          name: out.published.name,
          published_at: out.published.published_at
        } : null
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
      updateCounts(payload);
      setStatus('Draft guardado.', out);
    } catch (err) {
      setStatus('Error guardando draft.', err.response || { error: err.message });
    }
  };

  const publishDraft = async () => {
    try {
      const name = String(el.releaseNameInput.value || '').trim();
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
      updateCounts(payload);
      setStatus('JSON válido.', {
        routes: payload.routes.length,
        modules: payload.modules.length,
        sessions: payload.sessions.length
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

    await loadHealth();
    await loadDraft();
    await loadReleases();
  };

  bootstrap();
})();
