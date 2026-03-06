import { getAppLocale } from '../state.js';
import {
  ensureReferenceData,
  getLocalizedMapField,
  getReferenceCourses,
  getReferenceSelection,
  resolveReferenceSelection,
  setReferenceSelection
} from '../data/reference-data.js';
import {
  getLocaleMeta,
  getNextLocaleCode,
  getTabsCopy,
  normalizeLocale as normalizeCopyLocale
} from '../content/copy.js';

const MARKED_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js',
  'https://unpkg.com/marked/lib/marked.esm.js'
];
const TTS_LANG_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US'
};
const HERO_MASCOT_FRAME_COUNT = 9;
const HERO_MASCOT_REST_FRAME = HERO_MASCOT_FRAME_COUNT - 1;
const HERO_MASCOT_FRAME_INTERVAL_MS = 150;
const BROWSER_AUTONARRATION_EXTRA_DELAY_MS = 120;
const REFERENCE_ALIGNED_CACHE_MAX_ITEMS = 80;

let markedParseFnPromise = null;

class PageReference extends HTMLElement {
  constructor() {
    super();
    this.state = {
      localeOverride: ''
    };
    this.expandedCourseCode = '';
    this.expandedUnitCode = '';
    this._floatingHintsObserver = null;
    this.currentHeroMessage = '';
    this.currentHeroLocale = 'en';
    this.narrationToken = 0;
    this.narrationTimer = null;
    this.heroMascotFrameIndex = HERO_MASCOT_REST_FRAME;
    this.heroMascotFrameTimer = null;
    this.heroMascotIsTalking = false;
    this.narrationAudio = null;
    this.alignedTtsCache = new Map();
    this.initialHeroNarrationStarted = this.hasAutoHeroNarrationPlayed();
  }

  connectedCallback() {
    this.classList.add('ion-page');
    this._selectionHandler = () => this.render();
    window.addEventListener('reference:selection-change', this._selectionHandler);
    this._localeHandler = () => {
      if (!this.isConnected) return;
      if (this.normalizeLocale(this.state.localeOverride)) return;
      this.render();
    };
    window.addEventListener('app:locale-change', this._localeHandler);
    this._profileLocaleToggleHandler = () => {
      if (!this.isConnected) return;
      const hasManualOverride = this.normalizeLocale(this.state.localeOverride);
      if (!hasManualOverride) return;
      const baseLocale = this.getBaseLocale();
      const currentUiLocale = this.getUiLocale(baseLocale);
      const nextUiLocale = getNextLocaleCode(currentUiLocale);
      this.state.localeOverride = nextUiLocale === baseLocale ? '' : nextUiLocale;
      this.render();
    };
    window.addEventListener('app:profile-locale-toggle', this._profileLocaleToggleHandler);
    this._userHandler = (event) => {
      this.updateHeaderUser(event && event.detail ? event.detail : null);
    };
    window.addEventListener('app:user-change', this._userHandler);
    this._rewardsHandler = () => {
      this.updateHeaderRewards();
    };
    window.addEventListener('app:speak-stores-change', this._rewardsHandler);
    this._tabChangeHandler = (event) => {
      const activeTab = String(event && event.detail ? event.detail.tab || '' : '')
        .trim()
        .toLowerCase();
      if (!activeTab) return;
      if (activeTab !== 'reference') {
        this.stopHeroNarration();
        return;
      }
      if (this.initialHeroNarrationStarted) return;
      this.scheduleHeroNarration(0, true);
    };
    document.addEventListener('ionTabsDidChange', this._tabChangeHandler);
    this._appTabChangeHandler = (event) => {
      this._tabChangeHandler(event);
    };
    window.addEventListener('app:tab-change', this._appTabChangeHandler);
    this._tabUserClickHandler = (event) => {
      const tab = String(event && event.detail ? event.detail.tab || '' : '')
        .trim()
        .toLowerCase();
      if (tab !== 'reference') return;
      if (this.initialHeroNarrationStarted) return;
      this.playHeroNarration(true).catch(() => {});
    };
    window.addEventListener('app:tab-user-click', this._tabUserClickHandler);
    this.render();
  }

  disconnectedCallback() {
    this.disconnectFloatingHintsObserver();
    if (this._selectionHandler) {
      window.removeEventListener('reference:selection-change', this._selectionHandler);
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
    }
    if (this._profileLocaleToggleHandler) {
      window.removeEventListener('app:profile-locale-toggle', this._profileLocaleToggleHandler);
    }
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._rewardsHandler) {
      window.removeEventListener('app:speak-stores-change', this._rewardsHandler);
    }
    if (this._tabChangeHandler) {
      document.removeEventListener('ionTabsDidChange', this._tabChangeHandler);
    }
    if (this._appTabChangeHandler) {
      window.removeEventListener('app:tab-change', this._appTabChangeHandler);
    }
    if (this._tabUserClickHandler) {
      window.removeEventListener('app:tab-user-click', this._tabUserClickHandler);
    }
    this.stopHeroNarration();
  }

  disconnectFloatingHintsObserver() {
    if (this._floatingHintsObserver) {
      this._floatingHintsObserver.disconnect();
      this._floatingHintsObserver = null;
    }
  }

  normalizeLocale(value) {
    return normalizeCopyLocale(value) || '';
  }

  getBaseLocale() {
    const fromState = this.normalizeLocale(getAppLocale());
    if (fromState) return fromState;
    return this.normalizeLocale(window.varGlobal?.locale) || 'en';
  }

  getUiLocale(baseLocale = this.getBaseLocale()) {
    const override = this.normalizeLocale(this.state.localeOverride);
    return override || baseLocale || 'en';
  }

  getText(entry, fieldName, locale) {
    return getLocalizedMapField(entry, fieldName, locale) || '';
  }

  getAltLocale(locale) {
    return locale === 'es' ? 'en' : 'es';
  }

  getSecondaryDisplay(entry, uiLocale) {
    const primary = this.getText(entry, 'display', uiLocale);
    const secondary = this.getText(entry, 'display', this.getAltLocale(uiLocale));
    if (!secondary) return '';
    if (!primary) return secondary;
    const normalize = (value) => String(value || '').trim().toLocaleLowerCase();
    return normalize(primary) === normalize(secondary) ? '' : secondary;
  }

  escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  parseInlineMarkdown(text) {
    let html = this.escapeHtml(text);
    html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    html = html.replace(/(^|[\s(])\*([^*\n]+?)\*(?=(?:[\s).,;!?]|$))/g, '$1<em>$2</em>');
    html = html.replace(/(^|[\s(])_([^_\n]+?)_(?=(?:[\s).,;!?]|$))/g, '$1<em>$2</em>');
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_match, label, url) =>
        `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    return html;
  }

  async loadMarkedParseFunction() {
    if (typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse.bind(window.marked);
    }
    if (!markedParseFnPromise) {
      markedParseFnPromise = (async () => {
        for (const url of MARKED_CDN_URLS) {
          try {
            const mod = await import(url);
            const marked =
              (mod && mod.marked) ||
              (mod && mod.default && mod.default.parse ? mod.default : null) ||
              null;
            if (marked && typeof marked.parse === 'function') {
              return marked.parse.bind(marked);
            }
          } catch (err) {
            // try next CDN
          }
        }
        return null;
      })();
    }
    return markedParseFnPromise;
  }

  sanitizeMarkedHtml(rawHtml) {
    if (typeof rawHtml !== 'string' || !rawHtml) return '';
    if (typeof DOMParser !== 'function' || typeof document === 'undefined') {
      return this.escapeHtml(rawHtml);
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="reference-md-root">${rawHtml}</div>`, 'text/html');
    const root = doc.getElementById('reference-md-root');
    if (!root) return '';

    const allowedTags = new Set([
      'a',
      'p',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'code',
      'pre',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'br'
    ]);

    const allowedAttrsByTag = {
      a: new Set(['href', 'title', 'target', 'rel']),
      code: new Set(['class']),
      pre: new Set(['class'])
    };

    const sanitizeHref = (value) => {
      const href = String(value || '').trim();
      if (!href) return '';
      const lower = href.toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
      return href;
    };

    const walk = (node) => {
      const children = Array.from(node.childNodes || []);
      children.forEach((child) => {
        if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
          return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;

        const tag = child.tagName.toLowerCase();
        if (!allowedTags.has(tag)) {
          const text = doc.createTextNode(child.textContent || '');
          child.replaceWith(text);
          return;
        }

        const allowedAttrs = allowedAttrsByTag[tag] || null;
        Array.from(child.attributes || []).forEach((attr) => {
          const attrName = attr.name.toLowerCase();
          if (!allowedAttrs || !allowedAttrs.has(attrName)) {
            child.removeAttribute(attr.name);
          }
        });

        if (tag === 'a') {
          const safeHref = sanitizeHref(child.getAttribute('href'));
          if (!safeHref) {
            child.removeAttribute('href');
          } else {
            child.setAttribute('href', safeHref);
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          }
        }

        walk(child);
      });
    };

    walk(root);
    return root.innerHTML;
  }

  isTableSeparator(line) {
    const raw = String(line || '').trim();
    if (!raw || !raw.includes('|')) return false;
    const normalized = raw.replace(/^\|/, '').replace(/\|$/, '');
    const cells = normalized.split('|').map((cell) => cell.trim());
    if (!cells.length) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  splitTableRow(line) {
    const normalized = String(line || '')
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '');
    return normalized.split('|').map((cell) => cell.trim());
  }

  isParagraphBoundary(line, nextLine) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return true;
    if (/^#{1,6}\s+/.test(trimmed)) return true;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return true;
    if (/^\s*>\s?/.test(trimmed)) return true;
    if (/^\s*[-*+]\s+/.test(trimmed)) return true;
    if (/^\s*\d+\.\s+/.test(trimmed)) return true;
    if (nextLine && this.isTableSeparator(nextLine) && trimmed.includes('|')) return true;
    return false;
  }

  renderMarkdownFallbackHtml(markdown, depth = 0) {
    if (!markdown) return '';
    if (depth > 3) {
      return `<p>${this.parseInlineMarkdown(String(markdown))}</p>`;
    }

    const source = String(markdown).replace(/\r\n?/g, '\n');
    const lines = source.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        i += 1;
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = Math.min(6, heading[1].length);
        blocks.push(`<h${level}>${this.parseInlineMarkdown(heading[2])}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        blocks.push('<hr>');
        i += 1;
        continue;
      }

      if (/^\s*>\s?/.test(trimmed)) {
        const quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i].trim())) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        blocks.push(
          `<blockquote>${this.renderMarkdownFallbackHtml(quoteLines.join('\n'), depth + 1)}</blockquote>`
        );
        continue;
      }

      if (trimmed.includes('|') && i + 1 < lines.length && this.isTableSeparator(lines[i + 1])) {
        const headerCells = this.splitTableRow(lines[i]);
        let j = i + 2;
        const rows = [];
        while (j < lines.length) {
          const rowLine = String(lines[j] || '').trim();
          if (!rowLine || !rowLine.includes('|')) break;
          rows.push(this.splitTableRow(lines[j]));
          j += 1;
        }
        const thead = `<thead><tr>${headerCells
          .map((cell) => `<th>${this.parseInlineMarkdown(cell)}</th>`)
          .join('')}</tr></thead>`;
        const tbody =
          rows.length > 0
            ? `<tbody>${rows
                .map(
                  (row) =>
                    `<tr>${row.map((cell) => `<td>${this.parseInlineMarkdown(cell)}</td>`).join('')}</tr>`
                )
                .join('')}</tbody>`
            : '';
        blocks.push(`<table>${thead}${tbody}</table>`);
        i = j;
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
          i += 1;
        }
        blocks.push(`<ul>${items.map((item) => `<li>${this.parseInlineMarkdown(item)}</li>`).join('')}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i += 1;
        }
        blocks.push(`<ol>${items.map((item) => `<li>${this.parseInlineMarkdown(item)}</li>`).join('')}</ol>`);
        continue;
      }

      const paragraphLines = [trimmed];
      i += 1;
      while (i < lines.length) {
        const current = String(lines[i] || '').trim();
        const next = i + 1 < lines.length ? lines[i + 1] : '';
        if (!current) break;
        if (this.isParagraphBoundary(current, next)) break;
        paragraphLines.push(current);
        i += 1;
      }
      blocks.push(`<p>${this.parseInlineMarkdown(paragraphLines.join(' '))}</p>`);
    }

    return blocks.join('');
  }

  async enhanceMarkdownWithMarked(markdown, renderToken) {
    const parseFn = await this.loadMarkedParseFunction();
    if (!parseFn || !this.isConnected) return;
    if (this._markdownRenderToken !== renderToken) return;
    const target = this.querySelector('#reference-markdown-content');
    if (!target) return;
    try {
      const rawHtml = parseFn(markdown, {
        gfm: true,
        breaks: false,
        mangle: false,
        headerIds: false
      });
      if (this._markdownRenderToken !== renderToken) return;
      target.innerHTML = this.sanitizeMarkedHtml(rawHtml);
    } catch (err) {
      // fallback already rendered
    }
  }

  getReferenceCopy(locale) {
    const isEs = locale === 'es';
    return {
      title: isEs ? 'Referencia' : 'Reference',
      subtitle: isEs
        ? 'Explora cursos, unidades y lecciones para consultar contenido.'
        : 'Browse courses, units, and lessons to review content.',
      selectedLesson: isEs ? 'Lección seleccionada' : 'Selected lesson',
      noContent: isEs ? 'No hay contenido para esta lección.' : 'No content available for this lesson.',
      noData: isEs ? 'No hay contenido de referencia disponible.' : 'No reference content available.',
      loading: isEs ? 'Cargando referencia...' : 'Loading reference...',
      toggleLanguage: isEs ? 'Cambiar idioma a {lang}' : 'Switch language to {lang}',
      lessonListEmpty: isEs ? 'Esta unidad no tiene lecciones.' : 'This unit has no lessons.',
      chooseLesson: isEs ? 'Selecciona una lección para ver su contenido.' : 'Select a lesson to view its content.'
    };
  }

  async scrollContentIntoView(options = {}) {
    const contentCard = this.querySelector('.reference-content-card');
    const contentEl =
      this.querySelector('ion-content.home-journey') || this.querySelector('ion-content');
    if (!contentCard || !contentEl) return;

    let scrollEl = null;
    if (typeof contentEl.getScrollElement === 'function') {
      try {
        scrollEl = await contentEl.getScrollElement();
      } catch (err) {
        scrollEl = null;
      }
    }

    if (!scrollEl) {
      if (typeof contentCard.scrollIntoView === 'function') {
        contentCard.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }
      return;
    }

    const previousCardTop = Number.isFinite(options.previousCardTop)
      ? Number(options.previousCardTop)
      : null;
    if (previousCardTop !== null) {
      const currentTop = contentCard.getBoundingClientRect().top;
      const preserveTop = Math.max(0, Math.round(scrollEl.scrollTop + (currentTop - previousCardTop)));
      if (typeof contentEl.scrollToPoint === 'function') {
        try {
          await contentEl.scrollToPoint(0, preserveTop, 0);
        } catch (err) {
          scrollEl.scrollTop = preserveTop;
        }
      } else {
        scrollEl.scrollTop = preserveTop;
      }
    }

    const scrollRect = scrollEl.getBoundingClientRect();
    const cardRect = contentCard.getBoundingClientRect();
    const targetTop = Math.max(0, Math.round(scrollEl.scrollTop + (cardRect.top - scrollRect.top)));
    if (Math.abs(targetTop - scrollEl.scrollTop) < 2) return;

    if (typeof contentEl.scrollToPoint === 'function') {
      try {
        await contentEl.scrollToPoint(0, targetTop, 420);
        return;
      } catch (err) {
        // fallback below
      }
    }

    scrollEl.scrollTo({
      top: targetTop,
      behavior: 'smooth'
    });
  }

  getHeroMascotSrc() {
    return this.getHeroMascotFrameSrc(HERO_MASCOT_REST_FRAME);
  }

  renderHeaderHtml() {
    return `
      <ion-header translucent="true">
        <ion-toolbar class="secret-title">
          <ion-title class="secret-title"></ion-title>
          <div class="app-header-actions" slot="end">
            <div class="app-user-info" id="reference-user-info" hidden>
              <img class="app-user-avatar" id="reference-user-avatar" alt="Avatar">
              <span class="app-user-name" id="reference-user-name"></span>
            </div>
            <div class="reward-badges" id="reference-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="reference-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
    `;
  }

  updateHeaderUser(user) {
    const infoEl = this.querySelector('#reference-user-info');
    const nameEl = this.querySelector('#reference-user-name');
    const avatarEl = this.querySelector('#reference-user-avatar');
    const logoutBtn = this.querySelector('#reference-logout-btn');
    if (!infoEl) return;
    const loggedIn = Boolean(user && user.id !== undefined && user.id !== null);
    infoEl.hidden = !loggedIn;
    if (logoutBtn) logoutBtn.hidden = !loggedIn;
    if (!loggedIn || !user) {
      if (nameEl) nameEl.textContent = '';
      if (avatarEl) {
        avatarEl.src = '';
        avatarEl.hidden = true;
      }
      return;
    }
    const name = user.name || user.first_name || user.email || user.social_id || '';
    const avatar = user.image_local || user.image || '';
    if (nameEl) nameEl.textContent = name || 'Usuario';
    if (avatarEl) {
      avatarEl.src = avatar || '';
      avatarEl.alt = name ? `Avatar ${name}` : 'Avatar';
      avatarEl.hidden = !avatar;
    }
  }

  updateHeaderRewards() {
    const container = this.querySelector('#reference-reward-badges');
    if (!container) return;
    const rewards =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : {};
    const totals = {};
    Object.values(rewards).forEach((entry) => {
      if (!entry || typeof entry.rewardQty !== 'number') return;
      const icon = entry.rewardIcon || 'diamond';
      totals[icon] = (totals[icon] || 0) + entry.rewardQty;
    });
    const entries = Object.entries(totals).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([icon, qty]) =>
          `<div class="training-badge reward-badge"><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`
      )
      .join('');
  }

  logoutUser() {
    if (typeof window.setUser === 'function') {
      window.setUser(null);
      return;
    }
    window.user = null;
    try {
      localStorage.removeItem('appv5:user');
    } catch (err) {
      // no-op
    }
    window.dispatchEvent(new CustomEvent('app:user-change', { detail: null }));
  }

  isReferenceTabActive() {
    const hostTab = this.closest('ion-tab');
    if (!hostTab) return true;
    if (hostTab.hidden) return false;
    if (hostTab.classList.contains('tab-hidden')) return false;
    if (hostTab.classList.contains('tab-selected')) return true;
    const tabsEl = hostTab.closest('ion-tabs');
    const hostTabName = String(hostTab.getAttribute('tab') || '')
      .trim()
      .toLowerCase();
    if (!hostTabName) return false;
    if (!tabsEl) {
      try {
        const stored = String(localStorage.getItem('appv5:active-tab') || '')
          .trim()
          .toLowerCase();
        if (stored) return stored === hostTabName;
      } catch (err) {
        // no-op
      }
      return false;
    }
    const selectedFromProp =
      typeof tabsEl.selectedTab === 'string' ? String(tabsEl.selectedTab).trim().toLowerCase() : '';
    const selectedFromAttr = String(tabsEl.getAttribute('selected-tab') || '')
      .trim()
      .toLowerCase();
    const selected = (selectedFromProp || selectedFromAttr).trim().toLowerCase();
    if (!selected) {
      try {
        const stored = String(localStorage.getItem('appv5:active-tab') || '')
          .trim()
          .toLowerCase();
        if (stored) return stored === hostTabName;
      } catch (err) {
        // no-op
      }
      return hostTab.classList.contains('tab-selected');
    }
    return selected === hostTabName;
  }

  isEventInHeaderZone(event) {
    if (!event) return false;
    const y = Number(event.clientY);
    if (!Number.isFinite(y)) return false;
    const headerEl = this.querySelector('ion-header');
    if (!headerEl || typeof headerEl.getBoundingClientRect !== 'function') return false;
    const rect = headerEl.getBoundingClientRect();
    return y <= rect.bottom + 2;
  }

  isNativeRuntime() {
    if (typeof window === 'undefined') return false;
    const capacitor = window.Capacitor;
    if (!capacitor) return false;
    if (typeof capacitor.isNativePlatform === 'function') {
      return Boolean(capacitor.isNativePlatform());
    }
    return capacitor.platform === 'ios' || capacitor.platform === 'android';
  }

  getAutoNarrationDelay(baseMs = 90) {
    const normalized = Math.max(0, Number(baseMs) || 0);
    if (this.isNativeRuntime()) return normalized;
    return normalized + BROWSER_AUTONARRATION_EXTRA_DELAY_MS;
  }

  getNativeTtsPlugin() {
    if (!this.isNativeRuntime()) return null;
    if (typeof window === 'undefined') return null;
    const plugins =
      window && window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins : null;
    if (!plugins) return null;
    return plugins.TextToSpeech || null;
  }

  canWebSpeak() {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  waitForWebVoices(timeoutMs = 1200) {
    if (!this.canWebSpeak()) return Promise.resolve([]);
    const synth = window.speechSynthesis;
    const voicesNow = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
    if (voicesNow.length) return Promise.resolve(voicesNow);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', onVoicesChanged);
        } else {
          synth.onvoiceschanged = null;
        }
        const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
        resolve(voices);
      };
      const onVoicesChanged = () => {
        finish();
      };
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });
      } else {
        synth.onvoiceschanged = onVoicesChanged;
      }
      setTimeout(finish, Math.max(0, timeoutMs));
    });
  }

  waitForDocumentVisible(timeoutMs = 1600) {
    if (typeof document === 'undefined') return Promise.resolve();
    if (document.visibilityState === 'visible') return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      };
      const onChange = () => {
        if (document.visibilityState === 'visible') {
          finish();
        }
      };
      document.addEventListener('visibilitychange', onChange);
      setTimeout(finish, Math.max(0, timeoutMs));
    });
  }

  extractSpeechText(value) {
    const container = document.createElement('div');
    container.innerHTML = String(value || '');
    return String(container.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractNarrationLines(value) {
    const raw = String(value || '');
    if (!raw.trim()) return [];
    const normalized = raw
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<\/li>\s*<li>/gi, '\n');
    const lines = normalized
      .split(/\r?\n+/)
      .map((part) => {
        const html = String(part || '').trim();
        const text = this.extractSpeechText(html);
        if (!text) return null;
        return { text, html };
      })
      .filter(Boolean);
    if (lines.length) return lines;
    const fallback = this.extractSpeechText(raw);
    return fallback ? [{ text: fallback, html: '' }] : [];
  }

  resolveAlignedTtsEndpoint() {
    const cfg = window.realtimeConfig || {};
    const direct = cfg.ttsAlignedEndpoint || window.REALTIME_TTS_ALIGNED_ENDPOINT;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }
    const emitEndpoint = cfg.emitEndpoint;
    if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
      const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
      if (trimmed.endsWith('/emit')) {
        return `${trimmed.slice(0, -5)}/tts/aligned`;
      }
    }
    return 'https://realtime.curso-ingles.com/realtime/tts/aligned';
  }

  buildAlignedTtsHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const cfg = window.realtimeConfig || {};
    const token =
      typeof cfg.stateToken === 'string'
        ? cfg.stateToken.trim()
        : typeof window.REALTIME_STATE_TOKEN === 'string'
          ? window.REALTIME_STATE_TOKEN.trim()
          : '';
    if (token) {
      headers['x-rt-token'] = token;
    }
    return headers;
  }

  getAlignedTtsCacheKey(text, lang) {
    return `${String(lang || '').trim().toLowerCase()}::${String(text || '').trim()}`;
  }

  getAlignedTtsFromCache(text, lang) {
    const key = this.getAlignedTtsCacheKey(text, lang);
    if (!key || !this.alignedTtsCache.has(key)) return null;
    const cached = this.alignedTtsCache.get(key);
    this.alignedTtsCache.delete(key);
    this.alignedTtsCache.set(key, cached);
    return cached;
  }

  storeAlignedTtsInCache(text, lang, payload) {
    const key = this.getAlignedTtsCacheKey(text, lang);
    if (!key || !payload) return;
    this.alignedTtsCache.set(key, payload);
    while (this.alignedTtsCache.size > REFERENCE_ALIGNED_CACHE_MAX_ITEMS) {
      const oldest = this.alignedTtsCache.keys().next();
      if (oldest && !oldest.done) {
        this.alignedTtsCache.delete(oldest.value);
      } else {
        break;
      }
    }
  }

  async fetchAlignedTts(text, lang) {
    const expected = String(text || '').trim();
    const locale = String(lang || '').trim() || 'en-US';
    if (!expected) return null;
    const cached = this.getAlignedTtsFromCache(expected, locale);
    if (cached) return cached;
    const endpoint = this.resolveAlignedTtsEndpoint();
    if (!endpoint) return null;
    const body = {
      text: expected,
      locale
    };
    const user = window.user;
    if (user && user.id !== undefined && user.id !== null && String(user.id).trim()) {
      body.user_id = String(user.id).trim();
    }
    if (user && typeof user.name === 'string' && user.name.trim()) {
      body.user_name = user.name.trim();
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.buildAlignedTtsHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || payload.ok !== true) return null;
    if (typeof payload.audio_url !== 'string' || !payload.audio_url.trim()) return null;
    this.storeAlignedTtsInCache(expected, locale, payload);
    return payload;
  }

  getHeroBubbleEl() {
    return this.querySelector('.reference-hero-bubble');
  }

  getHeroMascotImageEl() {
    return this.querySelector('#reference-hero-mascot');
  }

  getHeroMascotFrameSrc(index) {
    const safeIndex = Number.isFinite(index) ? Math.trunc(index) : HERO_MASCOT_REST_FRAME;
    const normalized = Math.max(0, Math.min(HERO_MASCOT_REST_FRAME, safeIndex));
    const padded = String(normalized).padStart(2, '0');
    return `assets/mascot/mascota-boca-${padded}.png`;
  }

  setHeroBubbleSpeaking(isSpeaking) {
    const bubbleEl = this.getHeroBubbleEl();
    if (!bubbleEl) return;
    bubbleEl.classList.toggle('is-speaking', Boolean(isSpeaking));
  }

  setHeroMascotFrame(index) {
    const imageEl = this.getHeroMascotImageEl();
    if (!imageEl) return;
    this.heroMascotFrameIndex = Math.max(0, Math.min(HERO_MASCOT_REST_FRAME, Number(index) || 0));
    imageEl.src = this.getHeroMascotFrameSrc(this.heroMascotFrameIndex);
  }

  startHeroMascotTalk() {
    if (this.heroMascotIsTalking) return;
    this.heroMascotIsTalking = true;
    if (this.heroMascotFrameTimer) {
      clearInterval(this.heroMascotFrameTimer);
      this.heroMascotFrameTimer = null;
    }
    this.setHeroBubbleSpeaking(true);
    this.setHeroMascotFrame(0);
    this.heroMascotFrameTimer = setInterval(() => {
      if (!this.heroMascotIsTalking) return;
      const nextIndex = Math.floor(Math.random() * HERO_MASCOT_REST_FRAME);
      this.setHeroMascotFrame(nextIndex);
    }, HERO_MASCOT_FRAME_INTERVAL_MS);
  }

  stopHeroMascotTalk({ settle = false } = {}) {
    this.heroMascotIsTalking = false;
    if (this.heroMascotFrameTimer) {
      clearInterval(this.heroMascotFrameTimer);
      this.heroMascotFrameTimer = null;
    }
    this.setHeroBubbleSpeaking(false);
    if (settle) {
      this.setHeroMascotFrame(HERO_MASCOT_REST_FRAME);
    }
  }

  clearNarrationTimer() {
    if (!this.narrationTimer) return;
    clearTimeout(this.narrationTimer);
    this.narrationTimer = null;
  }

  hasAutoHeroNarrationPlayed() {
    if (typeof window === 'undefined') return false;
    const appState = window.r34lp0w3r;
    return Boolean(appState && appState.referenceHeroAutoNarrationPlayed);
  }

  markAutoHeroNarrationPlayed() {
    if (typeof window === 'undefined') return;
    if (!window.r34lp0w3r) window.r34lp0w3r = {};
    window.r34lp0w3r.referenceHeroAutoNarrationPlayed = true;
  }

  async stopHeroNarrationPlayback() {
    if (this.narrationAudio) {
      try {
        this.narrationAudio.pause();
        this.narrationAudio.currentTime = 0;
      } catch (_err) {
        // no-op
      }
      this.narrationAudio.onplaying = null;
      this.narrationAudio.onended = null;
      this.narrationAudio.onerror = null;
      this.narrationAudio = null;
    }
    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.stop === 'function') {
      try {
        await plugin.stop();
      } catch (_err) {
        // no-op
      }
    }
    if (this.canWebSpeak() && typeof window.speechSynthesis.cancel === 'function') {
      if (typeof window.cancelWebSpeech === 'function') {
        window.cancelWebSpeech();
      } else {
        window.speechSynthesis.cancel();
      }
    }
    this.stopHeroMascotTalk({ settle: true });
  }

  stopHeroNarration() {
    this.clearNarrationTimer();
    this.narrationToken += 1;
    this.stopHeroNarrationPlayback().catch(() => {});
  }

  scheduleHeroNarration(delayMs = 0, forceNarration = false) {
    this.clearNarrationTimer();
    const message = String(this.currentHeroMessage || '').trim();
    if (!message) return;
    if (!forceNarration && this.initialHeroNarrationStarted) return;
    if (!forceNarration && !this.isReferenceTabActive()) return;
    const waitMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 90;
    if (waitMs === 0) {
      if (!this.isConnected) return;
      if (!forceNarration && !this.isReferenceTabActive()) return;
      this.playHeroNarration(forceNarration).catch(() => {});
      return;
    }
    this.narrationTimer = setTimeout(() => {
      this.narrationTimer = null;
      if (!this.isConnected) return;
      if (!forceNarration && !this.isReferenceTabActive()) return;
      this.playHeroNarration(forceNarration).catch(() => {});
    }, waitMs);
  }

  async playHeroNarration(forceNarration = false) {
    const lines = this.extractNarrationLines(this.currentHeroMessage);
    if (!lines.length) {
      this.stopHeroNarration();
      return false;
    }
    if (!forceNarration && !this.isReferenceTabActive()) return false;
    const locale = this.normalizeLocale(this.currentHeroLocale) || this.getUiLocale();
    const started = await this.speakHeroNarration(lines, locale);
    if (started && !this.initialHeroNarrationStarted) {
      this.initialHeroNarrationStarted = true;
      this.markAutoHeroNarrationPlayed();
    }
    return started;
  }

  async playHeroNarrationAligned(text, lang, token) {
    const message = String(text || '').trim();
    if (!message) return false;
    if (token !== this.narrationToken) return false;
    let payload = null;
    try {
      payload = await this.fetchAlignedTts(message, lang);
    } catch (_err) {
      payload = null;
    }
    if (!payload || token !== this.narrationToken) return false;
    const audioUrl = String(payload.audio_url || '').trim();
    if (!audioUrl) return false;

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';

    return new Promise((resolve) => {
      let started = false;
      let settled = false;
      let cancelTimer = null;
      let startTimeout = null;
      let maxTimeout = null;

      const notifyStart = () => {
        if (started) return;
        started = true;
        this.startHeroMascotTalk();
      };

      const cleanup = () => {
        if (cancelTimer) {
          clearInterval(cancelTimer);
          cancelTimer = null;
        }
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        if (maxTimeout) {
          clearTimeout(maxTimeout);
          maxTimeout = null;
        }
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.narrationAudio === audio) {
          this.narrationAudio = null;
        }
      };

      const settle = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this.stopHeroMascotTalk({ settle: true });
        resolve(started);
      };

      cancelTimer = setInterval(() => {
        if (settled) return;
        if (token !== this.narrationToken) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (_err) {
            // no-op
          }
          settle();
        }
      }, 80);

      startTimeout = setTimeout(() => {
        settle();
      }, 1800);

      const estimatedMs = Math.min(12000, Math.max(1200, Math.round(message.length * 84) + 3200));
      maxTimeout = setTimeout(() => {
        settle();
      }, estimatedMs);

      audio.onplaying = () => {
        notifyStart();
      };
      audio.onended = () => {
        settle();
      };
      audio.onerror = () => {
        settle();
      };

      this.narrationAudio = audio;
      audio
        .play()
        .then(() => {
          if (token !== this.narrationToken) {
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch (_err) {
              // no-op
            }
            settle();
            return;
          }
          notifyStart();
        })
        .catch(() => {
          settle();
        });
    });
  }

  async speakHeroWithNativePlugin(text, lang, token) {
    const plugin = this.getNativeTtsPlugin();
    if (!plugin || typeof plugin.speak !== 'function') return false;
    if (token !== this.narrationToken) return false;
    const lineText = String(text || '').trim();
    if (!lineText) return false;
    this.startHeroMascotTalk();
    try {
      await plugin.speak({
        text: lineText,
        lang,
        rate: 1,
        pitch: 1,
        volume: 1,
        category: 'ambient',
        queueStrategy: 1
      });
      return token === this.narrationToken;
    } catch (_err) {
      return false;
    } finally {
      if (token === this.narrationToken) {
        this.stopHeroMascotTalk({ settle: true });
      }
    }
  }

  async speakHeroWithWebTts(text, lang, token) {
    if (!this.canWebSpeak()) return false;
    await this.waitForDocumentVisible(1800);
    if (token !== this.narrationToken) return false;
    await this.waitForWebVoices(1200);
    if (token !== this.narrationToken) return false;

    const utter = new SpeechSynthesisUtterance(String(text || ''));
    utter.lang = lang;

    return new Promise((resolve) => {
      let started = false;
      let settled = false;
      let startTimeout = null;

      const cleanup = () => {
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
      };

      const settle = (didStart) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.stopHeroMascotTalk({ settle: true });
        resolve(Boolean(didStart));
      };

      startTimeout = setTimeout(() => settle(false), 1800);
      utter.onstart = () => {
        started = true;
        this.startHeroMascotTalk();
        clearTimeout(startTimeout);
      };
      utter.onend = () => {
        settle(started);
      };
      utter.onerror = () => {
        settle(false);
      };
      try {
        const didLaunch =
          typeof window.speakWebUtterance === 'function'
            ? window.speakWebUtterance(utter)
            : (() => {
                window.speechSynthesis.speak(utter);
                return true;
              })();
        if (!didLaunch) {
          settle(false);
        }
      } catch (_err) {
        settle(false);
      }
    });
  }

  async speakHeroNarration(linesOrText, locale) {
    const lines = Array.isArray(linesOrText)
      ? linesOrText.filter((line) => line && typeof line.text === 'string' && line.text.trim())
      : this.extractNarrationLines(linesOrText);
    if (!lines.length) return false;
    const normalizedLocale = this.normalizeLocale(locale) || 'en';
    const lang = TTS_LANG_BY_LOCALE[normalizedLocale] || 'en-US';
    const token = ++this.narrationToken;
    const bubbleEl = this.getHeroBubbleEl();
    const hasMultipleLines = lines.length > 1;
    const restLine = lines[0] || null;
    const originalBubbleMinHeight = bubbleEl ? bubbleEl.style.minHeight : '';

    await this.stopHeroNarrationPlayback();
    if (token !== this.narrationToken) return false;

    const applyLine = (line) => {
      if (!bubbleEl || !line) return;
      const lineHtml = typeof line.html === 'string' ? line.html.trim() : '';
      if (lineHtml) {
        bubbleEl.innerHTML = lineHtml;
      } else {
        bubbleEl.textContent = line.text || '';
      }
    };

    const measureMaxLineHeight = () => {
      if (!bubbleEl || !hasMultipleLines) return 0;
      const width =
        Math.ceil(
          bubbleEl.getBoundingClientRect().width || bubbleEl.clientWidth || bubbleEl.offsetWidth || 0
        ) || 0;
      if (!width) return 0;
      const probe = document.createElement('div');
      probe.className = bubbleEl.className;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.left = '-99999px';
      probe.style.top = '0';
      probe.style.width = `${width}px`;
      probe.style.minHeight = '0';
      probe.style.height = 'auto';
      const parent = bubbleEl.parentElement || this;
      parent.appendChild(probe);
      let maxHeight = 0;
      lines.forEach((line) => {
        const html = line && typeof line.html === 'string' ? line.html.trim() : '';
        if (html) probe.innerHTML = html;
        else probe.textContent = line && line.text ? line.text : '';
        const nextHeight = Math.ceil(
          Math.max(probe.scrollHeight || 0, probe.getBoundingClientRect().height || 0)
        );
        if (nextHeight > maxHeight) maxHeight = nextHeight;
      });
      probe.remove();
      return maxHeight;
    };

    if (bubbleEl) {
      applyLine(restLine);
      if (hasMultipleLines) {
        const maxHeight = measureMaxLineHeight();
        if (maxHeight > 0) {
          bubbleEl.style.minHeight = `${maxHeight}px`;
        }
      } else {
        bubbleEl.style.minHeight = originalBubbleMinHeight;
      }
    }

    const waitMs = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, Number(ms) || 0));
      });

    const restoreBubble = () => {
      if (!bubbleEl) return;
      if (restLine) {
        applyLine(restLine);
      }
      if (!hasMultipleLines) {
        bubbleEl.style.minHeight = originalBubbleMinHeight;
      }
    };

    let startedAny = false;
    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (token !== this.narrationToken) return startedAny;
        const line = lines[index];
        const lineText = String(line.text || '').trim();
        if (!lineText) continue;
        if (hasMultipleLines) {
          applyLine(line);
        }

        let started = await this.playHeroNarrationAligned(lineText, lang, token);
        if (!started && token === this.narrationToken) {
          started = await this.speakHeroWithNativePlugin(lineText, lang, token);
        }
        if (!started && token === this.narrationToken) {
          started = await this.speakHeroWithWebTts(lineText, lang, token);
        }
        startedAny = startedAny || started;

        if (index < lines.length - 1 && token === this.narrationToken) {
          await waitMs(130);
        }
      }
      return startedAny;
    } finally {
      if (token === this.narrationToken) {
        this.stopHeroMascotTalk({ settle: true });
      }
      restoreBubble();
    }
  }

  render(options = {}) {
    this.stopHeroNarration();
    this.disconnectFloatingHintsObserver();
    const forceNarration = Boolean(options && options.forceNarration);
    const narrationDelayMs =
      typeof options.narrationDelayMs === 'number'
        ? options.narrationDelayMs
        : this.getAutoNarrationDelay(95);
    const baseLocale = this.getBaseLocale();
    const uiLocale = this.getUiLocale(baseLocale);
    const tabsCopy = getTabsCopy(uiLocale);
    const copy = this.getReferenceCopy(uiLocale);
    const flag = getLocaleMeta(uiLocale);
    const nextLocale = getNextLocaleCode(uiLocale);
    const nextLocaleMeta = getLocaleMeta(nextLocale);
    const toggleLanguageLabel = String(copy.toggleLanguage || '').replace('{lang}', nextLocaleMeta.label);
    const heroMascotSrc = this.getHeroMascotSrc();

    const courses = getReferenceCourses();
    if (!courses.length) {
      this.innerHTML = `
        ${this.renderHeaderHtml()}
        <ion-content fullscreen class="home-journey secret-content">
          <div class="journey-shell reference-shell">
            <div class="journey-title">
              <h2 class="onboarding-intro-title">${this.escapeHtml(copy.title)}</h2>
            </div>
            <section class="journey-plan-card onboarding-intro-card reference-hero-card">
              <button class="onboarding-intro-flag-btn journey-plan-flag-btn" type="button" data-action="toggle-language" aria-label="${this.escapeHtml(
                toggleLanguageLabel
              )}" title="${this.escapeHtml(toggleLanguageLabel)}">
                <img class="onboarding-intro-flag" src="${flag.flag}" alt="${flag.alt}">
              </button>
              <span class="journey-plan-mascot-wrap" aria-hidden="true">
                <img id="reference-hero-mascot" class="onboarding-intro-cat" src="${heroMascotSrc}" alt="">
              </span>
              <p class="onboarding-intro-bubble journey-plan-bubble reference-hero-bubble">${this.escapeHtml(
                copy.subtitle
              )}</p>
            </section>
            <section class="reference-content-card">
              <div class="reference-empty">${this.escapeHtml(copy.loading)}</div>
            </section>
          </div>
        </ion-content>
      `;

      this.querySelector('[data-action="toggle-language"]')?.addEventListener('click', () => {
        const nextCode = getNextLocaleCode(uiLocale);
        this.state.localeOverride = nextCode === baseLocale ? '' : nextCode;
        this.render({ forceNarration: true, narrationDelayMs: 80 });
      });
      this.querySelector('.reference-hero-card')?.addEventListener('click', (event) => {
        if (this.isEventInHeaderZone(event)) return;
        const target = event && event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (
          target.closest(
            'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-action]'
          )
        ) {
          return;
        }
        this.scheduleHeroNarration(0, true);
      });
      this.updateHeaderUser(window.user || null);
      this.updateHeaderRewards();
      this.querySelector('#reference-logout-btn')?.addEventListener('click', () => {
        this.logoutUser();
      });
      this.currentHeroMessage = copy.subtitle;
      this.currentHeroLocale = uiLocale;
      this.scheduleHeroNarration(narrationDelayMs, forceNarration);

      if (!this._loadingReferenceData && !this._referenceDataLoadAttempted) {
        this._loadingReferenceData = true;
        this._referenceDataLoadAttempted = true;
        ensureReferenceData()
          .catch((err) => {
            console.warn('[reference] data load failed', err);
          })
          .finally(() => {
            this._loadingReferenceData = false;
            if (this.isConnected) this.render();
          });
      }
      return;
    }

    const { course: selectedCourse, unit: selectedUnit, lesson: selectedLesson } = resolveReferenceSelection(
      getReferenceSelection()
    );
    if (!selectedCourse || !selectedUnit || !selectedLesson) return;

    const selectedCourseCode = String(selectedCourse.code);
    const selectedUnitCode = String(selectedUnit.code);
    const selectedLessonCode = String(selectedLesson.code);

    if (!this.expandedCourseCode || !courses.some((item) => String(item.code) === this.expandedCourseCode)) {
      this.expandedCourseCode = selectedCourseCode;
    }
    const expandedCourse =
      courses.find((item) => String(item.code) === this.expandedCourseCode) || selectedCourse;
    const expandedUnits = expandedCourse && Array.isArray(expandedCourse.unidades) ? expandedCourse.unidades : [];
    if (!this.expandedUnitCode || !expandedUnits.some((item) => String(item.code) === this.expandedUnitCode)) {
      this.expandedUnitCode =
        expandedCourse.code === selectedCourse.code && selectedUnit ? String(selectedUnit.code) : expandedUnits[0] ? String(expandedUnits[0].code) : '';
    }

    const lessonSequence = [];
    courses.forEach((course) => {
      const courseCode = String(course.code);
      const units = Array.isArray(course.unidades) ? course.unidades : [];
      units.forEach((unit) => {
        const unitCode = String(unit.code);
        const lessons = Array.isArray(unit.lecciones) ? unit.lecciones : [];
        lessons.forEach((lesson) => {
          lessonSequence.push({
            courseCode,
            unitCode,
            lessonCode: String(lesson.code)
          });
        });
      });
    });
    const selectedLessonSeqIndex = lessonSequence.findIndex(
      (item) =>
        item.courseCode === selectedCourseCode &&
        item.unitCode === selectedUnitCode &&
        item.lessonCode === selectedLessonCode
    );
    const prevLessonRef = selectedLessonSeqIndex > 0 ? lessonSequence[selectedLessonSeqIndex - 1] : null;
    const nextLessonRef =
      selectedLessonSeqIndex >= 0 && selectedLessonSeqIndex < lessonSequence.length - 1
        ? lessonSequence[selectedLessonSeqIndex + 1]
        : null;

    const openLesson = (lessonRef) => {
      if (!lessonRef || !lessonRef.courseCode || !lessonRef.unitCode || !lessonRef.lessonCode) return;
      const contentCard = this.querySelector('.reference-content-card');
      const previousCardTop =
        contentCard && Number.isFinite(contentCard.getBoundingClientRect().top)
          ? contentCard.getBoundingClientRect().top
          : null;
      this.expandedCourseCode = String(lessonRef.courseCode);
      this.expandedUnitCode = String(lessonRef.unitCode);
      setReferenceSelection({
        courseCode: String(lessonRef.courseCode),
        unitCode: String(lessonRef.unitCode),
        lessonCode: String(lessonRef.lessonCode)
      });
      this.render();
      requestAnimationFrame(() => {
        this.scrollContentIntoView({ previousCardTop }).catch(() => {});
      });
    };

    const accordionMarkup = courses
      .map((course) => {
        const courseCode = String(course.code);
        const isCourseOpen = courseCode === this.expandedCourseCode;
        const courseTitle = this.getText(course, 'display', uiLocale) || `Course ${courseCode}`;
        const courseSubtitle = this.getSecondaryDisplay(course, uiLocale);
        const units = Array.isArray(course.unidades) ? course.unidades : [];
        const unitsMarkup = units
          .map((unit) => {
            const unitCode = String(unit.code);
            const isUnitOpen = isCourseOpen && unitCode === this.expandedUnitCode;
            const unitTitle = this.getText(unit, 'display', uiLocale) || `Unit ${unitCode}`;
            const unitSubtitle = this.getSecondaryDisplay(unit, uiLocale);
            const lessons = Array.isArray(unit.lecciones) ? unit.lecciones : [];
            const lessonsMarkup = isUnitOpen
              ? lessons.length
                ? `<div class="module-sessions training-list">${lessons
                    .map((lesson) => {
                      const lessonCode = String(lesson.code);
                      const isSelected =
                        courseCode === selectedCourseCode &&
                        unitCode === selectedUnitCode &&
                        lessonCode === selectedLessonCode;
                      const lessonTitle = this.getText(lesson, 'display', uiLocale) || `Lesson ${lessonCode}`;
                      const lessonSubtitle = this.getSecondaryDisplay(lesson, uiLocale);
                      return `
                        <div
                          class="training-row reference-lesson-row ${isSelected ? 'is-selected' : ''}"
                          data-action="select-lesson"
                          data-course-code="${courseCode}"
                          data-unit-code="${unitCode}"
                          data-lesson-code="${lessonCode}"
                        >
                          <div class="training-row-icon">
                            <ion-icon name="document-text-outline"></ion-icon>
                          </div>
                          <div class="training-row-body">
                            <div class="training-row-title">${this.escapeHtml(lessonTitle)}</div>
                            ${lessonSubtitle ? `<div class="training-row-sub">${this.escapeHtml(lessonSubtitle)}</div>` : ''}
                          </div>
                          <ion-icon name="chevron-forward" class="training-row-arrow"></ion-icon>
                        </div>
                      `;
                    })
                    .join('')}</div>`
                : `<div class="reference-empty">${this.escapeHtml(copy.lessonListEmpty)}</div>`
              : '';

            return `
              <div class="module-item ${isUnitOpen ? 'is-open' : ''}">
                <button
                  class="module-header"
                  type="button"
                  data-action="toggle-unit"
                  data-course-code="${courseCode}"
                  data-unit-code="${unitCode}"
                >
                  <div>
                    <div class="module-title">${this.escapeHtml(unitTitle)}</div>
                    ${unitSubtitle ? `<div class="module-sub">${this.escapeHtml(unitSubtitle)}</div>` : ''}
                  </div>
                  <div class="module-meta">
                    <ion-icon name="${isUnitOpen ? 'chevron-down' : 'chevron-forward'}"></ion-icon>
                  </div>
                </button>
                ${lessonsMarkup}
              </div>
            `;
          })
          .join('');

        return `
          <div class="route-item ${isCourseOpen ? 'is-open' : ''}">
            <button
              class="route-header"
              type="button"
              data-action="toggle-course"
              data-course-code="${courseCode}"
            >
              <span>${this.escapeHtml(courseTitle)}</span>
              <div class="route-header-meta">
                <ion-icon name="chevron-down"></ion-icon>
              </div>
            </button>
            ${courseSubtitle ? `<div class="route-note">${this.escapeHtml(courseSubtitle)}</div>` : ''}
            <div class="route-modules">${unitsMarkup}</div>
          </div>
        `;
      })
      .join('');

    const lessonText = this.getText(selectedLesson, 'view', uiLocale);
    const lessonTextFallback = this.getText(selectedLesson, 'view', uiLocale === 'es' ? 'en' : 'es');
    const lessonContent = lessonText || lessonTextFallback;
    const markdownRenderToken = lessonContent
      ? `${selectedCourseCode}:${selectedUnitCode}:${selectedLessonCode}:${uiLocale}:${Date.now()}`
      : '';
    this._markdownRenderToken = markdownRenderToken;
    const selectedPath = [
      this.getText(selectedCourse, 'display', uiLocale),
      this.getText(selectedUnit, 'display', uiLocale),
      this.getText(selectedLesson, 'display', uiLocale)
    ]
      .map((part) => this.escapeHtml(part))
      .join(' · ');

    this.innerHTML = `
      ${this.renderHeaderHtml()}
      <ion-content fullscreen class="home-journey secret-content">
        <div class="journey-shell reference-shell">
          <div class="journey-title">
            <h2 class="onboarding-intro-title">${this.escapeHtml(tabsCopy.reference || copy.title)}</h2>
          </div>
          <section class="journey-plan-card onboarding-intro-card reference-hero-card">
            <button class="onboarding-intro-flag-btn journey-plan-flag-btn" type="button" data-action="toggle-language" aria-label="${this.escapeHtml(
              toggleLanguageLabel
            )}" title="${this.escapeHtml(toggleLanguageLabel)}">
              <img class="onboarding-intro-flag" src="${flag.flag}" alt="${flag.alt}">
            </button>
            <span class="journey-plan-mascot-wrap" aria-hidden="true">
              <img id="reference-hero-mascot" class="onboarding-intro-cat" src="${heroMascotSrc}" alt="">
            </span>
            <p class="onboarding-intro-bubble journey-plan-bubble reference-hero-bubble">${this.escapeHtml(
              copy.subtitle
            )}</p>
          </section>

          <div class="journey-accordion reference-accordion">
            ${accordionMarkup}
          </div>

          <section class="reference-content-card">
            <div class="pill">${this.escapeHtml(copy.selectedLesson)}</div>
            <div class="reference-selected-path">${selectedPath}</div>
            <h3 class="reference-content-title">${this.escapeHtml(
              this.getText(selectedLesson, 'display', uiLocale) || `Lesson ${selectedLessonCode}`
            )}</h3>
            ${
              lessonContent
                ? `<div class="reference-markdown" id="reference-markdown-content">${this.renderMarkdownFallbackHtml(
                    lessonContent
                  )}</div>`
                : `<div class="reference-empty">${this.escapeHtml(copy.noContent)}</div>`
            }
            <div class="reference-page-hints" aria-hidden="true">
              <span class="reference-page-hint reference-page-hint-prev ${prevLessonRef ? 'is-visible' : ''}"></span>
              <span class="reference-page-hint reference-page-hint-next ${nextLessonRef ? 'is-visible' : ''}"></span>
            </div>
          </section>
        </div>
      </ion-content>
    `;

    this.querySelector('[data-action="toggle-language"]')?.addEventListener('click', () => {
      const nextCode = getNextLocaleCode(uiLocale);
      this.state.localeOverride = nextCode === baseLocale ? '' : nextCode;
      this.render({ forceNarration: true, narrationDelayMs: 80 });
    });
    this.querySelector('.reference-hero-card')?.addEventListener('click', (event) => {
      if (this.isEventInHeaderZone(event)) return;
      const target = event && event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (
        target.closest(
          'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-action]'
        )
      ) {
        return;
      }
      this.scheduleHeroNarration(0, true);
    });
    this.updateHeaderUser(window.user || null);
    this.updateHeaderRewards();
    this.querySelector('#reference-logout-btn')?.addEventListener('click', () => {
      this.logoutUser();
    });
    this.currentHeroMessage = copy.subtitle;
    this.currentHeroLocale = uiLocale;
    this.scheduleHeroNarration(narrationDelayMs, forceNarration);
    if (lessonContent) {
      this.enhanceMarkdownWithMarked(lessonContent, markdownRenderToken);
    }
    const lessonCardEl = this.querySelector('.reference-content-card');
    const floatingHintsEl = this.querySelector('.reference-page-hints');
    const ionContentEl = this.querySelector('ion-content');
    const hasDirectionalHints = Boolean(prevLessonRef || nextLessonRef);
    const SWIPE_DRAG_THRESHOLD = 10;
    const SWIPE_COMMIT_THRESHOLD = 56;
    const SWIPE_VERTICAL_RATIO = 1.2;
    let suppressTapUntil = 0;
    let swipeTouchActive = false;
    let swipeTouchHorizontal = false;
    let swipeTouchBlocked = false;
    let swipeTouchStartX = 0;
    let swipeTouchStartY = 0;
    let swipeTouchCurrentX = 0;
    const isLessonCardVisible = () => {
      if (!lessonCardEl) return false;
      const rect = lessonCardEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      return rect.bottom > 0 && rect.top < viewportHeight;
    };
    const isInteractiveTarget = (target) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-action]'
        )
      );
    };
    const isOutsideLessonSurface = (target) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('.journey-accordion, .journey-plan-card, .journey-title'));
    };
    if (floatingHintsEl && hasDirectionalHints && lessonCardEl) {
      const applyVisibility = (visible) => {
        floatingHintsEl.classList.toggle('is-card-visible', Boolean(visible));
      };
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries && entries[0] ? entries[0] : null;
          applyVisibility(Boolean(entry && entry.isIntersecting && entry.intersectionRatio > 0));
        },
        { threshold: [0, 0.01, 0.2] }
      );
      observer.observe(lessonCardEl);
      this._floatingHintsObserver = observer;
      applyVisibility(isLessonCardVisible());
    }
    ionContentEl?.addEventListener(
      'touchstart',
      (event) => {
        if (!event.touches || event.touches.length !== 1) return;
        if (!isLessonCardVisible()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (isInteractiveTarget(target) || isOutsideLessonSurface(target)) return;
        const touch = event.touches[0];
        swipeTouchActive = true;
        swipeTouchHorizontal = false;
        swipeTouchBlocked = false;
        swipeTouchStartX = touch.clientX;
        swipeTouchStartY = touch.clientY;
        swipeTouchCurrentX = touch.clientX;
      },
      { passive: true }
    );
    ionContentEl?.addEventListener(
      'touchmove',
      (event) => {
        if (!swipeTouchActive || !event.touches || event.touches.length !== 1) return;
        const touch = event.touches[0];
        const dx = touch.clientX - swipeTouchStartX;
        const dy = touch.clientY - swipeTouchStartY;

        if (!swipeTouchHorizontal && !swipeTouchBlocked) {
          if (Math.abs(dx) < SWIPE_DRAG_THRESHOLD && Math.abs(dy) < SWIPE_DRAG_THRESHOLD) return;
          if (Math.abs(dx) < Math.abs(dy) * SWIPE_VERTICAL_RATIO) {
            swipeTouchBlocked = true;
            return;
          }
          swipeTouchHorizontal = true;
        }

        if (!swipeTouchHorizontal) return;
        swipeTouchCurrentX = touch.clientX;
        if (event.cancelable) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
    ionContentEl?.addEventListener(
      'touchend',
      () => {
        if (!swipeTouchActive) return;
        swipeTouchActive = false;
        if (!swipeTouchHorizontal) {
          swipeTouchBlocked = false;
          return;
        }
        const dx = swipeTouchCurrentX - swipeTouchStartX;
        const absDx = Math.abs(dx);
        swipeTouchHorizontal = false;
        swipeTouchBlocked = false;
        if (absDx < SWIPE_COMMIT_THRESHOLD) {
          suppressTapUntil = Date.now() + 180;
          return;
        }
        suppressTapUntil = Date.now() + 420;
        if (dx > 0) {
          if (prevLessonRef) openLesson(prevLessonRef);
          return;
        }
        if (nextLessonRef) openLesson(nextLessonRef);
      },
      { passive: true }
    );
    ionContentEl?.addEventListener(
      'touchcancel',
      () => {
        if (!swipeTouchActive) return;
        swipeTouchActive = false;
        swipeTouchHorizontal = false;
        swipeTouchBlocked = false;
        suppressTapUntil = Date.now() + 120;
      },
      { passive: true }
    );
    ionContentEl?.addEventListener('click', (event) => {
      if (Date.now() < suppressTapUntil) return;
      const target = event && event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (isInteractiveTarget(target)) return;
      if (isOutsideLessonSurface(target)) return;
      if (!isLessonCardVisible()) return;
      const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
      if (selection && !selection.isCollapsed && String(selection).trim()) {
        return;
      }
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewportWidth) return;
      const clientX = Number.isFinite(event.clientX) ? event.clientX : viewportWidth / 2;
      const isLeftHalf = clientX < viewportWidth / 2;
      if (isLeftHalf) {
        if (!prevLessonRef) return;
        openLesson(prevLessonRef);
        return;
      }
      if (!nextLessonRef) return;
      openLesson(nextLessonRef);
    });

    this.querySelectorAll('[data-action="toggle-course"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const courseCode = String(button.getAttribute('data-course-code') || '');
        if (!courseCode) return;
        const isClosing = this.expandedCourseCode === courseCode;
        this.expandedCourseCode = isClosing ? '' : courseCode;
        if (!isClosing) {
          const course = courses.find((item) => String(item.code) === courseCode);
          const firstUnit =
            course && Array.isArray(course.unidades) && course.unidades.length ? course.unidades[0] : null;
          this.expandedUnitCode = firstUnit ? String(firstUnit.code) : '';
        }
        this.render();
      });
    });

    this.querySelectorAll('[data-action="toggle-unit"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const courseCode = String(button.getAttribute('data-course-code') || '');
        const unitCode = String(button.getAttribute('data-unit-code') || '');
        if (!courseCode || !unitCode) return;
        this.expandedCourseCode = courseCode;
        const isClosing = this.expandedUnitCode === unitCode;
        this.expandedUnitCode = isClosing ? '' : unitCode;
        this.render();
      });
    });

    this.querySelectorAll('[data-action="select-lesson"]').forEach((row) => {
      row.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const courseCode = String(row.getAttribute('data-course-code') || '');
        const unitCode = String(row.getAttribute('data-unit-code') || '');
        const lessonCode = String(row.getAttribute('data-lesson-code') || '');
        if (!courseCode || !unitCode || !lessonCode) return;
        openLesson({ courseCode, unitCode, lessonCode });
      });
    });
  }
}

if (!customElements.get('page-reference')) {
  customElements.define('page-reference', PageReference);
}
