import { getAppLocale, setAppLocale, getActiveLocale, setLocaleOverride } from '../state.js';
import { renderAppHeader } from '../components/app-header.js';
import { addNotification } from '../notifications-store.js';
import {
  ensureReferenceData,
  getLocalizedMapField,
  getReferenceCourses,
  getReferenceSpecialCourses,
  getReferenceSelection,
  resolveReferenceSelection,
  setReferenceSelection
} from '../data/reference-data.js';
import {
  ensureReferenceTestsData,
  getLocalizedReferenceTestValue,
  getReferenceTestCourses,
  getReferenceTestsForSelection,
  getReferenceTestsLoadInfo
} from '../data/reference-tests.js';
import {
  getNextLocaleCode,
  getReferenceCopy,
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
const HERO_MASCOT_FRAME_COUNT = 8;
const HERO_MASCOT_REST_FRAME = 0;
const HERO_MASCOT_FRAME_INTERVAL_MS = 150;
const BROWSER_AUTONARRATION_EXTRA_DELAY_MS = 120;
const REFERENCE_ALIGNED_CACHE_MAX_ITEMS = 80;
const REFERENCE_HERO_AUTONARRATION_PLAYED_KEY = 'appv5:reference-hero-auto-narration-played';
const REFERENCE_TOOLS_ENABLED_KEY = 'appv5:reference-tools-enabled';
const REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX = 'appv5:reference-tests-progress';
const REFERENCE_PROGRESS_QUEUE_STORAGE_PREFIX = 'appv5:reference-progress-queue';
const REFERENCE_TEST_REWARD_ENTRY_PREFIX = 'reference-test';
const REFERENCE_TEST_DIAMOND_REWARD_QTY = 1;
const REFERENCE_TEST_DIAMOND_REWARD_LABEL = 'diamonds';
const REFERENCE_TEST_DIAMOND_REWARD_ICON = 'diamond';
const REFERENCE_UNIT_REWARD_ENTRY_PREFIX = 'reference-unit';
const REFERENCE_UNIT_REWARD_GROUP = 'reference-unit-ribbon';
const REFERENCE_UNIT_RIBBON_REWARD_QTY = 1;
const REFERENCE_UNIT_RIBBON_REWARD_ICON = 'ribbon';
const REFERENCE_COURSE_BADGE_META_BY_CODE = {
  '4': { badgeIndex: 6, image: 'assets/badges/badge-basic.png', routeId: 'reference-course-basic' },
  '5': {
    badgeIndex: 7,
    image: 'assets/badges/badge-intermediate.png',
    routeId: 'reference-course-intermediate'
  },
  '6': { badgeIndex: 8, image: 'assets/badges/badge-advanced.png', routeId: 'reference-course-advanced' },
  '10': { badgeIndex: 9, image: 'assets/badges/badge-business.png', routeId: 'reference-course-business' },
  '10000': {
    badgeIndex: 10,
    image: 'assets/badges/badge-travel.png',
    routeId: 'reference-course-travel'
  }
};
const REFERENCE_LESSON_COMPLETE_DELAY_MS = 30000;
const REFERENCE_TEST_PASS_PERCENT = 80;
const SPEAK_USER_STORAGE_KEY = 'appv5:user';
const REFERENCE_REMOTE_AUTH_SIGNATURE =
  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const REFERENCE_RIBBON_POPUP_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">
  <defs>
    <linearGradient id="rg" x1="52" y1="44" x2="204" y2="212" gradientUnits="userSpaceOnUse">
      <stop stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="108" r="70" fill="url(#rg)"/>
  <path d="M92 150 74 220l54-28 54 28-18-70" fill="#115e59"/>
  <circle cx="128" cy="108" r="46" fill="#f8fafc" fill-opacity=".95"/>
  <path d="m128 76 10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3 10-21Z" fill="#f59e0b"/>
</svg>
`)}`;

let markedParseFnPromise = null;

const getResolvedUserName = (user) => {
  if (!user || typeof user !== 'object') return '';
  const derived = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return derived || String(user.name || user.email || user.social_id || '').trim();
};

const readStoredSpeakUser = () => {
  try {
    const raw = localStorage.getItem(SPEAK_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_err) {
    return null;
  }
};

const resolveReferenceRemoteAuth = () => {
  const user = window.user || null;
  if (user && user.id !== undefined && user.id !== null && user.token) {
    return { userId: user.id, token: user.token };
  }
  const stored = readStoredSpeakUser();
  if (stored && stored.id !== undefined && stored.id !== null && stored.token) {
    return { userId: stored.id, token: stored.token };
  }
  return null;
};

const buildReferenceAuthHeaders = () => {
  const headers = {
    Authorization: REFERENCE_REMOTE_AUTH_SIGNATURE
  };
  if (typeof window.deviceId === 'function') {
    headers['X-Platform'] = window.deviceId();
  }
  return headers;
};

class PageReference extends HTMLElement {
  constructor() {
    super();
    this.state = {
      localeOverride: ''
    };
    this.expandedCourseCode = '';
    this.expandedUnitCode = '';
    this.lessonView = false;
    this._accordionInitialized = false;
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
    this.referenceTestSelectionKey = '';
    this.referenceTestStates = {};
    this.referenceTestFocus = {
      testKey: '',
      questionCode: '',
      inputIndex: 0
    };
    this.referenceTestsStorageUserKey = '';
    this._loadingReferenceTests = false;
    this._referenceTestsLoadAttempted = false;
    this.referenceLessonCompletionTimer = null;
    this.referenceLessonCompletionKey = '';
    this.referenceProgressSyncInFlight = false;
    this.pendingReferenceUnitRewardPopup = null;
    this.pendingReferenceCourseBadgePopup = null;
    this.referenceLessonTab = 'content';
    this.referenceMainTab = 'courses';
    this.referenceLessonTabScrollTop = {
      content: 0,
      tests: 0
    };
    this.toolView = false;
    this.activeTool = '';
    this.toolsDataCache = {};
    this.expandedToolItemId = null;
    this.toolFilter = 'featured';
    this.vocabImageCache = new Set();
    this.activeArticleUnitCode = null;
    this.activeArticleLessonCode = null;
    this.translatorInput = '';
    this.translatorResult = null;
    this.translatorLoading = false;
    this.translatorError = '';
    this.translatorRequestId = 0;
  }

  connectedCallback() {
    this.classList.add('ion-page');
    for (let i = 0; i < HERO_MASCOT_FRAME_COUNT; i++) { new Image().src = `assets/mascot/nena/nena-v5-${String(i).padStart(2, '0')}.png`; }
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
      this.ensureReferenceTestsPersistenceLoaded(true);
      this.flushReferenceProgressQueue({ reason: 'user-change' }).catch(() => {});
      if (this.isConnected) this.render();
    };
    window.addEventListener('app:user-change', this._userHandler);
    this._onlineHandler = () => {
      this.flushReferenceProgressQueue({ reason: 'online' }).catch(() => {});
    };
    window.addEventListener('online', this._onlineHandler);
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
      }
    };
    document.addEventListener('ionTabsDidChange', this._tabChangeHandler);
    this._appTabChangeHandler = (event) => {
      this._tabChangeHandler(event);
    };
    window.addEventListener('app:tab-change', this._appTabChangeHandler);
    this._referenceToolsHandler = () => {
      if (!this.isConnected) return;
      this.render();
    };
    window.addEventListener('app:reference-tools-enabled-change', this._referenceToolsHandler);
    this.flushReferenceProgressQueue({ reason: 'connect' }).catch(() => {});
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
    if (this._onlineHandler) {
      window.removeEventListener('online', this._onlineHandler);
    }
    if (this._tabChangeHandler) {
      document.removeEventListener('ionTabsDidChange', this._tabChangeHandler);
    }
    if (this._appTabChangeHandler) {
      window.removeEventListener('app:tab-change', this._appTabChangeHandler);
    }
    if (this._referenceToolsHandler) {
      window.removeEventListener('app:reference-tools-enabled-change', this._referenceToolsHandler);
    }
    if (this._tabUserClickHandler) {
      window.removeEventListener('app:tab-user-click', this._tabUserClickHandler);
    }
    this.clearReferenceLessonCompletionTimer();
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
    const fromState = this.normalizeLocale(getActiveLocale());
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
      /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
      (_match, alt, url) =>
        `<img src="${url}" alt="${alt}" class="reference-md-img reference-md-img--inline" loading="lazy">`
    );
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_match, label, url) =>
        `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    return html;
  }

  getTranslatorWordToneClass(word) {
    const pos = String(word && word.pos ? word.pos : '').trim().toLowerCase();
    switch (pos) {
      case 'v':
        return 'translator-word-card--verb';
      case 'n':
        return 'translator-word-card--noun';
      case 'a':
      case 's':
        return 'translator-word-card--adjective';
      case 'r':
        return 'translator-word-card--adverb';
      default:
        return 'translator-word-card--default';
    }
  }

  getTranslatorSyntaxToneClass(item) {
    const pos = String(item && item.pos ? item.pos : '').trim().toLowerCase();
    switch (pos) {
      case 'v':
        return 'translator-syntax-token--verb';
      case 'n':
        return 'translator-syntax-token--noun';
      case 'a':
      case 's':
        return 'translator-syntax-token--adjective';
      case 'r':
        return 'translator-syntax-token--adverb';
      default:
        return 'translator-syntax-token--default';
    }
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

      const imgMatch = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/\S+)\)$/);
      if (imgMatch) {
        blocks.push(`<img src="${this.escapeHtml(imgMatch[2])}" alt="${this.escapeHtml(imgMatch[1])}" class="reference-md-img" loading="lazy">`);
        i += 1;
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
    const currentLocale = getAppLocale() || 'en';
    const tabTitle = getReferenceCopy(currentLocale).title;
    return renderAppHeader({ title: tabTitle, rewardBadgesId: 'reference-reward-badges', locale: currentLocale });
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
      const rewardKind = String(entry.rewardGroup || icon).trim() || String(icon).trim() || 'diamond';
      if (!totals[rewardKind]) totals[rewardKind] = { icon, qty: 0 };
      totals[rewardKind].qty += entry.rewardQty;
    });
    const entries = Object.entries(totals).filter(([, meta]) => meta && meta.qty > 0);
    if (!entries.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = entries
      .sort((left, right) => {
        const leftIcon = String(left[1] && left[1].icon ? left[1].icon : 'diamond').trim().toLowerCase();
        const rightIcon = String(right[1] && right[1].icon ? right[1].icon : 'diamond').trim().toLowerCase();
        const getOrder = (icon) =>
          icon === 'trophy'
            ? 0
            : icon === 'ribbon' || icon === 'medal'
            ? 1
            : icon === 'diamond'
            ? 2
            : 9;
        const byOrder = getOrder(leftIcon) - getOrder(rightIcon);
        if (byOrder !== 0) return byOrder;
        return String(left[0] || '').localeCompare(String(right[0] || ''));
      })
      .map(([rewardKind, meta]) => {
        const icon = meta.icon || 'diamond';
        const qty = meta.qty || 0;
        const normalizedIcon = String(icon || '').trim().toLowerCase();
        const isInteractive =
          normalizedIcon === 'trophy' ||
          normalizedIcon === 'ribbon' ||
          normalizedIcon === 'medal' ||
          rewardKind === REFERENCE_UNIT_REWARD_GROUP;
        return `<div class="training-badge reward-badge${isInteractive ? ' is-interactive' : ''}" data-reward-kind="${rewardKind}" data-reward-icon="${icon}" data-reward-qty="${qty}"${isInteractive ? ' role="button" tabindex="0"' : ''}><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`;
      })
      .join('');
  }

  getReferenceRewardStore() {
    if (!window.r34lp0w3r || typeof window.r34lp0w3r !== 'object') {
      window.r34lp0w3r = {};
    }
    if (
      !window.r34lp0w3r.speakSessionRewards ||
      typeof window.r34lp0w3r.speakSessionRewards !== 'object'
    ) {
      window.r34lp0w3r.speakSessionRewards = {};
    }
    return window.r34lp0w3r.speakSessionRewards;
  }

  persistReferenceRewardStore() {
    if (typeof window.persistSpeakStores === 'function') {
      window.persistSpeakStores();
      return;
    }
    try {
      localStorage.setItem(
        'appv5:speak-session-rewards',
        JSON.stringify(this.getReferenceRewardStore())
      );
    } catch (err) {
      // no-op
    }
  }

  notifyReferenceRewardStoreChange() {
    if (typeof window.notifySpeakStoresChange === 'function') {
      window.notifySpeakStoresChange();
    } else {
      window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
    }
  }

  queueReferenceRewardEvent(entryId, entry, reason = '') {
    if (!entryId || !entry || typeof window.queueSpeakEvent !== 'function') return;
    window.queueSpeakEvent({
      type: 'session_reward',
      session_id: entryId,
      rewardQty: entry.rewardQty,
      rewardLabel: entry.rewardLabel,
      rewardIcon: entry.rewardIcon,
      ts: entry.ts || Date.now(),
      reason: reason || 'reference-reward'
    });
  }

  getReferenceBadgeStore() {
    if (!window.r34lp0w3r || typeof window.r34lp0w3r !== 'object') {
      window.r34lp0w3r = {};
    }
    if (!window.r34lp0w3r.speakBadges || typeof window.r34lp0w3r.speakBadges !== 'object') {
      window.r34lp0w3r.speakBadges = {};
    }
    return window.r34lp0w3r.speakBadges;
  }

  queueReferenceBadgeEvent(entryId, entry) {
    if (!entryId || !entry || typeof window.queueSpeakEvent !== 'function') return;
    window.queueSpeakEvent({
      type: 'badge_awarded',
      badge_id: entryId,
      route_id: entry.routeId || '',
      route_title: entry.routeTitle || '',
      badgeIndex: entry.badgeIndex,
      badge_image: entry.image || '',
      badge_title: entry.title || '',
      ts: entry.ts || Date.now()
    });
  }

  notifyReferenceBadgeUnlocked(entryId, entry) {
    if (!entryId || !entry) return;
    try {
      addNotification({
        type: 'reward',
        tone: 'good',
        icon: 'ribbon-outline',
        image: entry.image || '',
        title: 'Nuevo badge desbloqueado',
        text: entry.routeTitle || 'Curso completado',
        action: {
          label: 'Ver badge',
          tab: 'tu',
          profileTab: 'prefs',
          callback: 'openSpeakBadgeFromNotification',
          badgeId: entryId,
          complete: true
        }
      });
    } catch (_err) {
      // no-op
    }
  }

  syncReferenceRewardsNow(reason = '') {
    if (typeof window.syncSpeakProgress !== 'function') return;
    window
      .syncSpeakProgress({
        reason: reason || 'reference-reward',
        force: true,
        includeSnapshot: true
      })
      .catch(() => {});
  }

  getReferenceRibbonRewardLabel(uiLocale, qty = REFERENCE_UNIT_RIBBON_REWARD_QTY) {
    const copy = getReferenceCopy(uiLocale || this.getUiLocale(this.getBaseLocale()));
    return qty === 1 ? copy.ribbonLabelOne : copy.ribbonLabelOther;
  }

  presentReferenceUnitRewardPopup(entry, uiLocale) {
    if (!entry) return;
    const copy = getReferenceCopy(uiLocale || this.getUiLocale(this.getBaseLocale()));
    const unitTitle = String(entry.unitTitle || '').trim();
    const title = unitTitle || copy.unitRewardPopupTitle;
    const subtitleParts = [];
    if (unitTitle && copy.unitRewardPopupStatus) {
      subtitleParts.push(copy.unitRewardPopupStatus);
    }
    if (copy.unitRewardPopupReward) {
      subtitleParts.push(copy.unitRewardPopupReward);
    }
    const subtitle = subtitleParts.join(' ');

    if (typeof window.openSpeakBadgePopup === 'function') {
      window
        .openSpeakBadgePopup({
          id: `${entry.entryId || REFERENCE_UNIT_REWARD_ENTRY_PREFIX}:${Date.now()}`,
          title,
          subtitle,
          image: REFERENCE_RIBBON_POPUP_IMAGE
        })
        .catch(() => {});
      return;
    }

    const message = subtitle || copy.unitRewardPopupReward;
    if (!window.customElements || typeof window.customElements.get !== 'function') {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    const hasIonAlert = window.customElements.get('ion-alert');
    if (!hasIonAlert) {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    const alert = document.createElement('ion-alert');
    alert.header = title;
    alert.message = message;
    alert.buttons = ['OK'];
    document.body.appendChild(alert);
    alert.present().catch(() => {
      if (alert.isConnected) alert.remove();
    });
    alert.onDidDismiss().then(() => {
      alert.remove();
    });
  }

  getReferenceCourseBadgeMeta(course, uiLocale) {
    const courseCode = String(course && course.code ? course.code : '').trim();
    const meta = REFERENCE_COURSE_BADGE_META_BY_CODE[courseCode];
    if (!meta) return null;
    const courseTitle = this.getText(course, 'display', uiLocale) || `Course ${courseCode}`;
    return {
      id: `reference-course:${courseCode}`,
      routeId: meta.routeId,
      routeTitle: courseTitle,
      badgeIndex: meta.badgeIndex,
      image: meta.image,
      title: courseTitle
    };
  }

  consumePendingReferenceDeepLink(courses = getReferenceCourses()) {
    const runtime = window.r34lp0w3r && typeof window.r34lp0w3r === 'object' ? window.r34lp0w3r : null;
    const pending = runtime && runtime.referenceDeepLink && typeof runtime.referenceDeepLink === 'object'
      ? runtime.referenceDeepLink
      : null;
    if (!pending) return false;

    const courseCode = String(pending.courseCode || '').trim();
    const unitCode = String(pending.unitCode || '').trim();
    const lessonCode = String(pending.lessonCode || '').trim();
    const testKey = String(pending.testKey || '').trim();
    const targetTab = String(pending.tab || '').trim() === 'content' ? 'content' : 'tests';

    const course = (Array.isArray(courses) ? courses : []).find((item) => String(item.code) === courseCode) || null;
    const units = course && Array.isArray(course.unidades) ? course.unidades : [];
    const unit = units.find((item) => String(item.code) === unitCode) || null;
    const lessons = unit && Array.isArray(unit.lecciones) ? unit.lecciones : [];
    const lesson = lessons.find((item) => String(item.code) === lessonCode) || lessons[0] || null;

    runtime.referenceDeepLink = null;
    if (!course || !unit || !lesson) return false;

    const resolvedSelection = {
      courseCode: String(course.code),
      unitCode: String(unit.code),
      lessonCode: String(lesson.code)
    };

    this.expandedCourseCode = resolvedSelection.courseCode;
    this.expandedUnitCode = resolvedSelection.unitCode;
    this.lessonView = true;
    this.referenceLessonTab = targetTab;
    if (testKey) {
      this.referenceTestSelectionKey = testKey;
      this.persistReferenceTestsState();
    }

    const currentSelection = getReferenceSelection();
    if (
      String(currentSelection.courseCode || '') !== resolvedSelection.courseCode ||
      String(currentSelection.unitCode || '') !== resolvedSelection.unitCode ||
      String(currentSelection.lessonCode || '') !== resolvedSelection.lessonCode
    ) {
      setReferenceSelection(resolvedSelection);
      return true;
    }

    return false;
  }

  syncReferenceUnitRewardsFromSnapshot(progressSnapshot, courses = getReferenceCourses(), options = {}) {
    if (!progressSnapshot || typeof progressSnapshot !== 'object') return [];
    const uiLocale = options.uiLocale || this.getUiLocale(this.getBaseLocale());
    const rewardStore = this.getReferenceRewardStore();
    const awardedEntries = [];

    (Array.isArray(courses) ? courses : []).forEach((course) => {
      const courseCode = String(course && course.code ? course.code : '').trim();
      const units = course && Array.isArray(course.unidades) ? course.unidades : [];
      units.forEach((unit) => {
        const unitCode = String(unit && unit.code ? unit.code : '').trim();
        if (!courseCode || !unitCode) return;
        const unitKey = this.getReferenceUnitProgressKey(courseCode, unitCode);
        const unitProgress =
          progressSnapshot.units && typeof progressSnapshot.units === 'object'
            ? progressSnapshot.units[unitKey]
            : null;
        if (!unitProgress || unitProgress.completed !== true) return;
        const entryId = `${REFERENCE_UNIT_REWARD_ENTRY_PREFIX}:${courseCode}:${unitCode}`;
        if (rewardStore[entryId]) return;

        const entry = {
          rewardQty: REFERENCE_UNIT_RIBBON_REWARD_QTY,
          rewardLabel: this.getReferenceRibbonRewardLabel(uiLocale, REFERENCE_UNIT_RIBBON_REWARD_QTY),
          rewardIcon: REFERENCE_UNIT_RIBBON_REWARD_ICON,
          rewardGroup: REFERENCE_UNIT_REWARD_GROUP,
          ts: Date.now(),
          source: 'reference-unit',
          courseCode,
          unitCode,
          unitTitle: this.getText(unit, 'display', uiLocale) || `Unit ${unitCode}`
        };
        rewardStore[entryId] = entry;
        awardedEntries.push({ entryId, ...entry });
      });
    });

    if (!awardedEntries.length) return [];

    this.persistReferenceRewardStore();
    awardedEntries.forEach((entry) => {
      this.queueReferenceRewardEvent(entry.entryId, entry, options.reason || 'reference-unit-complete');
    });
    this.notifyReferenceRewardStoreChange();
    if (options.showPopup) {
      this.presentReferenceUnitRewardPopup(awardedEntries[0], uiLocale);
    }
    if (options.syncRemote) {
      this.syncReferenceRewardsNow(options.reason || 'reference-unit-complete');
    }
    return awardedEntries;
  }

  syncReferenceCourseBadgesFromSnapshot(progressSnapshot, courses = getReferenceCourses(), options = {}) {
    if (!progressSnapshot || typeof progressSnapshot !== 'object') return [];
    const uiLocale = options.uiLocale || this.getUiLocale(this.getBaseLocale());
    const badgeStore = this.getReferenceBadgeStore();
    const awardedBadges = [];

    (Array.isArray(courses) ? courses : []).forEach((course) => {
      const courseCode = String(course && course.code ? course.code : '').trim();
      const courseProgress =
        progressSnapshot.courses && typeof progressSnapshot.courses === 'object'
          ? progressSnapshot.courses[courseCode]
          : null;
      if (!courseProgress || courseProgress.completed !== true) return;
      const meta = this.getReferenceCourseBadgeMeta(course, uiLocale);
      if (!meta || badgeStore[meta.id]) return;

      const entry = {
        routeId: meta.routeId,
        routeTitle: meta.routeTitle,
        badgeIndex: meta.badgeIndex,
        image: meta.image,
        title: meta.title,
        ts: Date.now()
      };
      badgeStore[meta.id] = entry;
      awardedBadges.push({ id: meta.id, ...entry });
    });

    if (!awardedBadges.length) return [];

    if (typeof window.persistSpeakStores === 'function') {
      window.persistSpeakStores();
    } else {
      try {
        localStorage.setItem('appv5:speak-badges', JSON.stringify(badgeStore));
      } catch (_err) {
        // no-op
      }
    }

    awardedBadges.forEach((badge) => {
      this.queueReferenceBadgeEvent(badge.id, badge);
      this.notifyReferenceBadgeUnlocked(badge.id, badge);
    });

    this.notifyReferenceRewardStoreChange();
    if (options.showPopup && awardedBadges[0] && typeof window.openSpeakBadgePopup === 'function') {
      window.openSpeakBadgePopup(awardedBadges[0].id).catch(() => {});
    }
    if (options.syncRemote) {
      this.syncReferenceRewardsNow(options.reason || 'reference-course-badge');
    }
    return awardedBadges;
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
      typeof cfg.authToken === 'string'
        ? cfg.authToken.trim()
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
    const userName = getResolvedUserName(user);
    if (userName) {
      body.user_name = userName;
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
    const normalized = Math.max(0, Math.min(HERO_MASCOT_FRAME_COUNT - 1, safeIndex));
    const padded = String(normalized).padStart(2, '0');
    return `assets/mascot/nena/nena-v5-${padded}.png`;
  }

  setHeroBubbleSpeaking(isSpeaking) {
    const bubbleEl = this.getHeroBubbleEl();
    if (!bubbleEl) return;
    bubbleEl.classList.toggle('is-speaking', Boolean(isSpeaking));
  }

  setHeroMascotFrame(index) {
    const imageEl = this.getHeroMascotImageEl();
    if (!imageEl) return;
    this.heroMascotFrameIndex = Math.max(0, Math.min(HERO_MASCOT_FRAME_COUNT - 1, Number(index) || 0));
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
    this.setHeroMascotFrame(1);
    this.heroMascotFrameTimer = setInterval(() => {
      if (!this.heroMascotIsTalking) return;
      const nextIndex = Math.floor(Math.random() * (HERO_MASCOT_FRAME_COUNT - 1)) + 1;
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

  loadToolData(key) {
    if (this.toolsDataCache[key]) {
      return Promise.resolve(this.toolsDataCache[key]);
    }
    return fetch(`data/tools/${key}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        this.toolsDataCache[key] = data;
        return data;
      });
  }

  resolveTranslatorEndpoint() {
    const cfg = window.referenceToolsConfig || {};
    const endpoint = typeof cfg.translatorEndpoint === 'string' ? cfg.translatorEndpoint.trim() : '';
    return endpoint || 'https://www.curso-ingles.com/api/v4/tools/translator';
  }

  async fetchTranslatorResult(text, uiLocale) {
    const endpoint = this.resolveTranslatorEndpoint();
    const auth = resolveReferenceRemoteAuth();
    if (!auth) {
      throw new Error('translator_auth_missing');
    }
    const url = new URL(endpoint);
    url.searchParams.set('text', String(text || '').trim());
    url.searchParams.set('locale', uiLocale === 'en' ? 'en' : 'es');
    url.searchParams.set('user_id', String(auth.userId));
    url.searchParams.set('token', String(auth.token));
    url.searchParams.set('timestamp', String(Math.round(Date.now() / 1000)));
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildReferenceAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload && typeof payload.error === 'string' && payload.error.includes('(002)')) {
      window.requestSessionInvalidation?.('referenceTranslator', {
        endpoint,
        status: response.status,
        error: payload.error,
        code: '002'
      });
      throw new Error('translator_auth_invalid');
    }
    if (!payload || payload.ok !== true) {
      throw new Error(payload && payload.error ? payload.error : 'translator_failed');
    }
    return payload;
  }

  async submitTranslator(uiLocale) {
    const text = String(this.translatorInput || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      this.translatorError = getReferenceCopy(uiLocale).translatorEmpty || 'Type something to translate.';
      this.translatorResult = null;
      this.render();
      return;
    }
    const requestId = this.translatorRequestId + 1;
    this.translatorRequestId = requestId;
    this.translatorLoading = true;
    this.translatorError = '';
    this.render();
    try {
      const result = await this.fetchTranslatorResult(text, uiLocale);
      if (this.translatorRequestId !== requestId) return;
      this.translatorResult = result;
      this.translatorError = '';
    } catch (error) {
      if (this.translatorRequestId !== requestId) return;
      console.warn('[translator] request failed', error);
      const copy = getReferenceCopy(uiLocale);
      this.translatorResult = null;
      this.translatorError = copy.translatorError;
    } finally {
      if (this.translatorRequestId === requestId) {
        this.translatorLoading = false;
        if (this.isConnected) this.render();
      }
    }
  }

  renderTranslatorToolHtml(copy, uiLocale) {
    const result = this.translatorResult;
    const canSubmit = !this.translatorLoading;
    const sourceLang = result && result.source_language === 'en' ? 'en' : 'es';
    const targetLang = result && result.target_language === 'en' ? 'en' : 'es';
    const syntaxLang = result && result.syntax_language === 'en' ? 'en' : 'es';
    const syntax = result && Array.isArray(result.syntax) ? result.syntax : [];
    const words = result && Array.isArray(result.words) ? result.words : [];
    const variants = result && Array.isArray(result.variants) ? result.variants.filter(Boolean) : [];
    const playIconHtml = this.buildPlayIconHtml();

    const syntaxHtml = syntax.length
      ? syntax.map((item) => `
          <div class="translator-syntax-token ${this.getTranslatorSyntaxToneClass(item)}">
            <div class="tool-expr-play-zone translator-syntax-play" data-play-text="${this.escapeHtml(item.token || item.lemma || '')}" data-play-lang="${this.escapeHtml(syntaxLang)}">
              <div class="tool-expr-text">
                <span class="tool-expr-name">${this.escapeHtml(item.token || item.lemma || '')}</span>
                <span class="tool-expr-translation">${this.escapeHtml(item.label || item.tag || '')}</span>
              </div>
              ${playIconHtml}
            </div>
          </div>
        `).join('')
      : `<p class="translator-empty">${this.escapeHtml(copy.translatorNoSyntax)}</p>`;

    const wordsHtml = words.length
      ? words.map((word) => `
          <article class="translator-word-card ${this.getTranslatorWordToneClass(word)} card card--plain">
            <div class="translator-word-head">
              <div class="tool-expr-play-zone translator-word-play" data-play-text="${this.escapeHtml(word.word || '')}" data-play-lang="en">
                <div class="tool-expr-text">
                  <span class="tool-expr-name">${this.escapeHtml(word.word || '')}</span>
                  <span class="tool-expr-translation">${this.escapeHtml(word.pos_label || word.pos || '')}</span>
                </div>
                ${playIconHtml}
              </div>
            </div>
            ${(Array.isArray(word.definitions) ? word.definitions : []).map((definition, index) => `
              <div class="translator-definition">
                <div class="translator-definition-title">${this.escapeHtml(`${index + 1}. ${definition.definition || ''}`)}</div>
                ${(Array.isArray(definition.examples) ? definition.examples : []).map((example) => `
                  <div class="translator-example">
                    <div class="tool-expr-play-zone tool-expr-example-play" data-play-text="${this.escapeHtml(example.en || '')}" data-play-lang="en">
                      <span class="tool-expr-example-text">${this.escapeHtml(example.en || '')}</span>
                      ${playIconHtml}
                    </div>
                    ${example.es ? `<p class="tool-expr-example-es">${this.escapeHtml(example.es)}</p>` : ''}
                  </div>
                `).join('')}
              </div>
            `).join('')}
            ${word.conjugable && word.conjugation_key ? `
              <button class="conj-btn" type="button" data-verb="${this.escapeHtml(word.conjugation_key)}">
                <ion-icon name="git-branch-outline" aria-hidden="true"></ion-icon>
                ${this.escapeHtml(copy.conjugate)}
              </button>
            ` : ''}
          </article>
        `).join('')
      : `<p class="translator-empty">${this.escapeHtml(copy.translatorNoWords)}</p>`;

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(copy.toolTranslator)}</h2>
        </div>
      </div>
      <div class="tool-content-list tool-content-list--translator" id="tool-content-list">
        <section class="translator-panel translator-panel--composer card card--plain">
          <div class="translator-input-shell profile-input-shell">
            <textarea
              id="translator-input"
              class="translator-input profile-input--shell"
              rows="4"
              placeholder="${this.escapeHtml(copy.translatorPlaceholder)}"
            >${this.escapeHtml(this.translatorInput || '')}</textarea>
          </div>
          <ion-button class="translator-submit-btn" id="translator-submit-btn" shape="round" ${canSubmit ? '' : 'disabled'}>
            ${this.escapeHtml(this.translatorLoading ? copy.translatorWorking : copy.translatorTranslate)}
          </ion-button>
          ${this.translatorError ? `<p class="translator-feedback translator-feedback--error">${this.escapeHtml(this.translatorError)}</p>` : ''}
        </section>

        ${result ? `
          <section class="translator-panel translator-result-panel card card--plain">
            <div class="translator-result-grid">
              <div class="translator-result-card card card--plain">
                <div class="translator-section-label">${this.escapeHtml(copy.translatorSource)}</div>
                <div class="tool-expr-play-zone translator-result-play" data-play-text="${this.escapeHtml(result.source_text || '')}" data-play-lang="${this.escapeHtml(sourceLang)}">
                  <div class="tool-expr-text">
                    <span class="tool-expr-name">${this.escapeHtml(result.source_text || '')}</span>
                    <span class="tool-expr-translation">${this.escapeHtml(`${copy.translatorDetected}: ${sourceLang.toUpperCase()}`)}</span>
                  </div>
                  ${playIconHtml}
                </div>
              </div>
              <div class="translator-result-card card card--plain">
                <div class="translator-section-label">${this.escapeHtml(copy.translatorResult)}</div>
                <div class="tool-expr-play-zone translator-result-play" data-play-text="${this.escapeHtml(result.translated_text || '')}" data-play-lang="${this.escapeHtml(targetLang)}">
                  <div class="tool-expr-text">
                    <span class="tool-expr-name">${this.escapeHtml(result.translated_text || '')}</span>
                    <span class="tool-expr-translation">${this.escapeHtml(targetLang.toUpperCase())}</span>
                  </div>
                  ${playIconHtml}
                </div>
              </div>
            </div>

            ${variants.length ? `
              <div class="translator-result-block">
                <div class="translator-section-label">${this.escapeHtml(copy.translatorAlternatives)}</div>
                <div class="translator-chip-list">
                  ${variants.map((item) => `<span class="translator-chip">${this.escapeHtml(item)}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            <div class="translator-result-block">
              <div class="translator-section-label">${this.escapeHtml(copy.translatorSyntax)}</div>
              <div class="translator-syntax-list">${syntaxHtml}</div>
            </div>

            <div class="translator-result-block">
              <div class="translator-section-label">${this.escapeHtml(copy.translatorWords)}</div>
              <div class="translator-words-list">${wordsHtml}</div>
            </div>
          </section>
        ` : ''}
      </div>`;
  }

  renderExpressionsToolHtml(data, copy, uiLocale) {
    const expressions = data.expressions;
    const letters = (expressions.letras || []).map((l) => l.letra);
    const filter = this.toolFilter || 'all';

    const showTranslation = uiLocale === 'es';
    const playIconHtml = this.buildPlayIconHtml();
    const itemHtml = (item) => `
      <div class="tool-expr-item" data-tool-item-id="${item.id}">
        <div class="tool-expr-item-main">
          <div class="tool-expr-play-zone" data-play-text="${this.escapeHtml(item.name)}">
            <div class="tool-expr-text">
              <span class="tool-expr-name">${this.escapeHtml(item.name)}</span>
              ${showTranslation ? `<span class="tool-expr-translation">${this.escapeHtml(item.translation)}</span>` : ''}
            </div>
            ${playIconHtml}
          </div>
          <button class="tool-expr-expand-btn" type="button" aria-label="expand">
            <ion-icon name="chevron-down" class="tool-expr-chevron" aria-hidden="true"></ion-icon>
          </button>
        </div>
      </div>`;

    let contentHtml;
    if (filter === 'featured') {
      const featured = expressions.featured || [];
      contentHtml = `<div class="tool-letter-section">${featured.map(itemHtml).join('')}</div>`;
    } else {
      contentHtml = letters.map((letter) => {
        const items = expressions[letter] || [];
        return `
          <div class="tool-letter-section" id="tool-section-${this.escapeHtml(letter)}">
            <div class="tool-letter-header">${this.escapeHtml(letter.toUpperCase())}</div>
            ${items.map(itemHtml).join('')}
          </div>`;
      }).join('');
    }

    const letterNavHtml = filter === 'all' ? `
      <div class="tool-letter-nav" id="tool-letter-nav">
        ${letters.map((letter) =>
          `<button class="tool-letter-nav-btn" data-tool-letter="${this.escapeHtml(letter)}">${this.escapeHtml(letter.toUpperCase())}</button>`
        ).join('')}
      </div>` : '';

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(copy.toolExpressions)}</h2>
        </div>
        <div class="profile-segmented-tabs tool-filter-tabs">
          <button class="profile-segmented-btn${filter === 'featured' ? ' active' : ''}" data-tool-filter="featured">${this.escapeHtml(copy.toolFilterFeatured)}</button>
          <button class="profile-segmented-btn${filter === 'all' ? ' active' : ''}" data-tool-filter="all">${this.escapeHtml(copy.toolFilterAll)}</button>
        </div>
        ${letterNavHtml}
      </div>
      <div class="tool-content-list" id="tool-content-list">
        ${contentHtml}
      </div>`;
  }

  buildPlayIconHtml() {
    return `<span class="tool-play-icon" aria-hidden="true"><ion-icon class="tool-play-speaker-icon" name="volume-medium-outline"></ion-icon><span class="tool-play-waves"><i></i><i></i><i></i></span></span>`;
  }

  findToolItem(id, data) {
    const featured = data.featured || [];
    const letters = (data.letras || []).map((l) => l.letra);
    const allItems = [...featured, ...letters.flatMap((l) => data[l] || [])];
    return allItems.find((item) => item.id === id) || null;
  }

  findQuoteItem(id, quotesData) {
    const featured = quotesData.featured || [];
    const themes = quotesData.themes || [];
    const allItems = [...featured, ...themes.flatMap((t) => quotesData[String(t.id)] || [])];
    return allItems.find((item) => item.id === id) || null;
  }

  buildConjugationPersonsHtml(tenseData, mood) {
    if (!tenseData) return '';
    const PERSON_LABELS = { I: 'I', You: 'You', hesheit: 'He / She / It', We: 'We', You2: 'You (pl.)', They: 'They' };
    const PERSON_ORDER = ['I', 'You', 'hesheit', 'We', 'You2', 'They'];
    const playIconHtml = this.buildPlayIconHtml();
    return PERSON_ORDER.map((person) => {
      const text = (tenseData[person] || {})[mood] || '';
      return `
        <div class="conj-person-row">
          <span class="conj-person-label">${this.escapeHtml(PERSON_LABELS[person] || person)}</span>
          <div class="tool-expr-play-zone conj-person-play" data-play-text="${this.escapeHtml(text)}">
            <span class="conj-person-form">${this.escapeHtml(text)}</span>
            ${playIconHtml}
          </div>
        </div>`;
    }).join('');
  }

  buildConjugationSheetHtml(verbName, verbData, uiLocale) {
    const copy = getReferenceCopy(uiLocale);
    const TENSE_LABELS = {
      PresentSimple: 'Present Simple',
      PresentContinuous: 'Present Continuous',
      PresentPerfect: 'Present Perfect',
      PresentPerfectContinuous: 'Pres. Perf. Cont.',
      PastSimple: 'Past Simple',
      PastContinuous: 'Past Continuous',
      PastPerfect: 'Past Perfect',
      PastPerfectContinuous: 'Past Perf. Cont.',
      FutureSimple: 'Future Simple',
      FuturePerfect: 'Future Perfect',
      Conditional: 'Conditional',
      ConditionalPerfect: 'Cond. Perfect'
    };
    const defaultTense = 'PresentSimple';
    const defaultMood = 'Affirmative';
    const title = verbData ? (verbData.infinitive || verbName) : verbName;
    const tensePillsHtml = Object.entries(TENSE_LABELS).map(([key, label]) =>
      `<button class="conj-tense-pill${key === defaultTense ? ' active' : ''}" data-tense="${key}">${label}</button>`
    ).join('');
    const moodAff = copy.conjMoodAffirmative;
    const moodInt = copy.conjMoodInterrogative;
    const moodNeg = copy.conjMoodNegative;
    const personsHtml = verbData
      ? this.buildConjugationPersonsHtml((verbData.tenses || {})[defaultTense], defaultMood)
      : `<p class="conj-not-found">Not available</p>`;
    return `
      <div class="conj-sheet" id="conj-sheet">
        <div class="conj-sheet-header">
          <h3 class="conj-sheet-title">${this.escapeHtml(title)}</h3>
          <button class="conj-sheet-close" aria-label="Close">
            <ion-icon name="close" aria-hidden="true"></ion-icon>
          </button>
        </div>
        <div class="conj-tense-scroll">
          <div class="conj-tense-pills">${tensePillsHtml}</div>
        </div>
        <div class="conj-mood-tabs">
          <button class="conj-mood-btn active" data-mood="Affirmative">${this.escapeHtml(moodAff)}</button>
          <button class="conj-mood-btn" data-mood="Interrogative">${this.escapeHtml(moodInt)}</button>
          <button class="conj-mood-btn" data-mood="Negative">${this.escapeHtml(moodNeg)}</button>
        </div>
        <div class="conj-persons-list" id="conj-persons-list">
          ${personsHtml}
        </div>
      </div>`;
  }

  async openConjugationSheet(verbName, uiLocale) {
    this.closeConjugationSheet();
    let verbData = null;
    try {
      const data = await this.loadToolData('conjugations');
      verbData = (data.conjugations && data.conjugations.data && data.conjugations.data[verbName]) || null;
    } catch (e) {
      console.warn('[conj] failed to load conjugations', e);
    }
    const overlayEl = document.createElement('div');
    overlayEl.className = 'conj-sheet-overlay';
    overlayEl.id = 'conj-sheet-overlay';
    overlayEl.innerHTML = this.buildConjugationSheetHtml(verbName, verbData, uiLocale);
    this.appendChild(overlayEl);
    requestAnimationFrame(() => overlayEl.classList.add('is-open'));
    overlayEl.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      // Close on backdrop tap
      if (target === overlayEl) { this.closeConjugationSheet(); return; }
      // Close button
      if (target.closest('.conj-sheet-close')) { this.closeConjugationSheet(); return; }
      // Tense pill
      const tensePill = target.closest('.conj-tense-pill');
      if (tensePill) {
        overlayEl.querySelectorAll('.conj-tense-pill').forEach((b) => b.classList.toggle('active', b === tensePill));
        const tense = tensePill.getAttribute('data-tense');
        const mood = overlayEl.querySelector('.conj-mood-btn.active')?.getAttribute('data-mood') || 'Affirmative';
        const personsList = overlayEl.querySelector('#conj-persons-list');
        if (personsList && verbData) personsList.innerHTML = this.buildConjugationPersonsHtml((verbData.tenses || {})[tense], mood);
        return;
      }
      // Mood button
      const moodBtn = target.closest('.conj-mood-btn');
      if (moodBtn) {
        overlayEl.querySelectorAll('.conj-mood-btn').forEach((b) => b.classList.toggle('active', b === moodBtn));
        const mood = moodBtn.getAttribute('data-mood');
        const tense = overlayEl.querySelector('.conj-tense-pill.active')?.getAttribute('data-tense') || 'PresentSimple';
        const personsList = overlayEl.querySelector('#conj-persons-list');
        if (personsList && verbData) personsList.innerHTML = this.buildConjugationPersonsHtml((verbData.tenses || {})[tense], mood);
        return;
      }
      // Audio play zone
      const playZone = target.closest('.tool-expr-play-zone');
      if (playZone) {
        const text = String(playZone.getAttribute('data-play-text') || '').trim();
        if (text) {
          overlayEl.querySelectorAll('.tool-expr-play-zone.is-playing').forEach((el) => el.classList.remove('is-playing'));
          playZone.classList.add('is-playing');
          this.speakHeroNarration(text, 'en').catch(() => {}).finally(() => playZone.classList.remove('is-playing'));
        }
        return;
      }
    });
  }

  extractFirstMarkdownImage(markdown) {
    if (!markdown) return null;
    const match = String(markdown).match(/!\[[^\]]*\]\((https?:\/\/\S+?)\)/);
    return match ? match[1] : null;
  }

  resolveColorSwatch(name) {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return null;
    // Try normalized (spaces removed): "light blue" → "lightblue"
    const normalized = name.toLowerCase().replace(/\s+/g, '');
    if (CSS.supports('color', normalized)) return normalized;
    // Try as-is (single-word colors like "red")
    const lower = name.toLowerCase();
    if (CSS.supports('color', lower)) return lower;
    return null;
  }

  closeConjugationSheet() {
    const existing = this.querySelector('#conj-sheet-overlay');
    if (existing) {
      existing.classList.remove('is-open');
      setTimeout(() => existing.remove(), 300);
    }
  }

  buildToolExpandHtml(id, toolData, uiLocale) {
    const copy = getReferenceCopy(uiLocale);
    const playIconHtml = this.buildPlayIconHtml();
    const showTr = uiLocale === 'es';
    switch (this.activeTool) {
      case 'expressions': {
        const item = this.findToolItem(id, toolData.expressions);
        if (!item) return '';
        return `
          <div class="tool-expr-play-zone tool-expr-example-play" data-play-text="${this.escapeHtml(item.example || '')}">
            <span class="tool-expr-example-text">${this.escapeHtml(item.example || '')}</span>
            ${playIconHtml}
          </div>
          ${showTr ? `<p class="tool-expr-example-es">${this.escapeHtml(item.example_translation || '')}</p>` : ''}`;
      }
      case 'proverbs': {
        const item = this.findToolItem(id, toolData.proverbs);
        if (!item) return '';
        const explanation = String(item.explanation || '').trim();
        return explanation ? `<p class="tool-expr-example-en">${this.escapeHtml(explanation)}</p>` : '';
      }
      case 'regverbs':
      case 'irregverbs': {
        const dataKey = this.activeTool === 'irregverbs' ? 'irregverbs' : 'regverbs';
        const item = this.findToolItem(id, toolData[dataKey]);
        if (!item) return '';
        const rows = [
          { label: copy.verbPresent, value: item.present || '' },
          { label: copy.verbPastSimple, value: item.past_simple || '' },
          { label: copy.verbPastParticiple, value: item.past_participle || '' },
          { label: copy.verbGerund, value: item.gerund || '' }
        ];
        const conjLabel = copy.conjugate;
        return `<div class="tool-verb-table">${rows.map((row) => `
          <div class="tool-verb-row">
            <span class="tool-verb-label">${this.escapeHtml(row.label)}</span>
            <div class="tool-expr-play-zone tool-verb-play-zone" data-play-text="${this.escapeHtml(row.value)}">
              <span class="tool-verb-form">${this.escapeHtml(row.value)}</span>
              ${playIconHtml}
            </div>
          </div>`).join('')}</div>
          <button class="conj-btn" type="button" data-verb="${this.escapeHtml(item.name)}">
            <ion-icon name="git-branch-outline" aria-hidden="true"></ion-icon>
            ${this.escapeHtml(conjLabel)}
          </button>`;
      }
      case 'phrasalverbs': {
        const item = this.findToolItem(id, toolData.phrasverbs);
        if (!item) return '';
        const examples = item.examples || [];
        return examples.map((ex) => {
          const syntax = String(ex.syntax || '').toLowerCase().trim();
          const syntaxClass = syntax === 'separable' ? 'tool-pill-sep'
            : syntax === 'inseparable' ? 'tool-pill-insep'
            : syntax === 'intransitive' ? 'tool-pill-intrans'
            : syntax ? 'tool-pill-other' : '';
          const definition = uiLocale === 'es' ? (ex.definition || '') : (ex.definition_en || ex.definition || '');
          return `
            <div class="tool-phrasal-example">
              <div class="tool-expr-play-zone tool-expr-example-play" data-play-text="${this.escapeHtml(ex.example || '')}">
                <span class="tool-expr-example-text">${this.escapeHtml(ex.example || '')}</span>
                ${playIconHtml}
              </div>
              ${showTr ? `<p class="tool-expr-example-es">${this.escapeHtml(ex.example_translation || '')}</p>` : ''}
              ${syntax || definition ? `<div class="tool-phrasal-meta">${syntaxClass ? `<span class="tool-syntax-pill ${this.escapeHtml(syntaxClass)}">${this.escapeHtml(syntax)}</span>` : ''}${definition ? `<span class="tool-phrasal-def">${this.escapeHtml(definition)}</span>` : ''}</div>` : ''}
            </div>`;
        }).join('');
      }
      default:
        return '';
    }
  }

  renderProverbsToolHtml(data, copy, uiLocale) {
    const proverbs = data.proverbs;
    const letters = (proverbs.letras || []).map((l) => l.letra);
    const filter = this.toolFilter || 'featured';
    const showTranslation = uiLocale === 'es';
    const playIconHtml = this.buildPlayIconHtml();

    const itemHtml = (item) => {
      const explanation = String(item.explanation || '').trim();
      return `
        <div class="tool-expr-item" data-tool-item-id="${item.id}">
          <div class="tool-expr-item-main">
            <div class="tool-expr-play-zone" data-play-text="${this.escapeHtml(item.name)}">
              <div class="tool-expr-text">
                <span class="tool-expr-name">${this.escapeHtml(item.name)}</span>
                ${showTranslation ? `<span class="tool-expr-translation">${this.escapeHtml(item.translation)}</span>` : ''}
              </div>
              ${playIconHtml}
            </div>
            ${explanation ? `<button class="tool-expr-expand-btn" type="button" aria-label="expand">
              <ion-icon name="chevron-down" class="tool-expr-chevron" aria-hidden="true"></ion-icon>
            </button>` : ''}
          </div>
        </div>`;
    };

    let contentHtml;
    if (filter === 'featured') {
      const featured = proverbs.featured || [];
      contentHtml = `<div class="tool-letter-section">${featured.map(itemHtml).join('')}</div>`;
    } else {
      contentHtml = letters.map((letter) => {
        const items = proverbs[letter] || [];
        return `
          <div class="tool-letter-section" id="tool-section-${this.escapeHtml(letter)}">
            <div class="tool-letter-header">${this.escapeHtml(letter)}</div>
            ${items.map(itemHtml).join('')}
          </div>`;
      }).join('');
    }

    const letterNavHtml = filter === 'all' ? `
      <div class="tool-letter-nav" id="tool-letter-nav">
        ${letters.map((letter) =>
          `<button class="tool-letter-nav-btn" data-tool-letter="${this.escapeHtml(letter)}">${this.escapeHtml(letter)}</button>`
        ).join('')}
      </div>` : '';

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(copy.toolProverbs)}</h2>
        </div>
        <div class="profile-segmented-tabs tool-filter-tabs">
          <button class="profile-segmented-btn${filter === 'featured' ? ' active' : ''}" data-tool-filter="featured">${this.escapeHtml(copy.toolFilterFeatured)}</button>
          <button class="profile-segmented-btn${filter === 'all' ? ' active' : ''}" data-tool-filter="all">${this.escapeHtml(copy.toolFilterAll)}</button>
        </div>
        ${letterNavHtml}
      </div>
      <div class="tool-content-list" id="tool-content-list">
        ${contentHtml}
      </div>`;
  }

  renderVerbsToolHtml(verbsData, copy, uiLocale) {
    const letters = (verbsData.letras || []).map((l) => l.letra);
    const filter = this.toolFilter || 'featured';
    const title = this.activeTool === 'irregverbs'
      ? copy.toolIrregVerbs
      : copy.toolRegVerbs;
    const showTranslation = uiLocale === 'es';
    const playIconHtml = this.buildPlayIconHtml();

    const itemHtml = (item) => `
      <div class="tool-expr-item" data-tool-item-id="${item.id}">
        <div class="tool-expr-item-main">
          <div class="tool-expr-play-zone" data-play-text="${this.escapeHtml(item.name)}">
            <div class="tool-expr-text">
              <span class="tool-expr-name">${this.escapeHtml(item.name)}</span>
              ${showTranslation ? `<span class="tool-expr-translation">${this.escapeHtml(item.translation)}</span>` : ''}
            </div>
            ${playIconHtml}
          </div>
          <button class="tool-expr-expand-btn" type="button" aria-label="expand">
            <ion-icon name="chevron-down" class="tool-expr-chevron" aria-hidden="true"></ion-icon>
          </button>
        </div>
      </div>`;

    let contentHtml;
    if (filter === 'featured') {
      const featured = verbsData.featured || [];
      contentHtml = `<div class="tool-letter-section">${featured.map(itemHtml).join('')}</div>`;
    } else {
      contentHtml = letters.map((letter) => {
        const items = verbsData[letter] || [];
        return `
          <div class="tool-letter-section" id="tool-section-${this.escapeHtml(letter)}">
            <div class="tool-letter-header">${this.escapeHtml(letter.toUpperCase())}</div>
            ${items.map(itemHtml).join('')}
          </div>`;
      }).join('');
    }

    const letterNavHtml = filter === 'all' ? `
      <div class="tool-letter-nav" id="tool-letter-nav">
        ${letters.map((letter) =>
          `<button class="tool-letter-nav-btn" data-tool-letter="${this.escapeHtml(letter)}">${this.escapeHtml(letter.toUpperCase())}</button>`
        ).join('')}
      </div>` : '';

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(title)}</h2>
        </div>
        <div class="profile-segmented-tabs tool-filter-tabs">
          <button class="profile-segmented-btn${filter === 'featured' ? ' active' : ''}" data-tool-filter="featured">${this.escapeHtml(copy.toolFilterFeatured)}</button>
          <button class="profile-segmented-btn${filter === 'all' ? ' active' : ''}" data-tool-filter="all">${this.escapeHtml(copy.toolFilterAll)}</button>
        </div>
        ${letterNavHtml}
      </div>
      <div class="tool-content-list" id="tool-content-list">
        ${contentHtml}
      </div>`;
  }

  renderQuotesToolHtml(data, copy, uiLocale) {
    const quotes = data.quotes;
    const themes = quotes.themes || [];
    const filter = this.toolFilter || 'featured';
    const showTranslation = uiLocale === 'es';
    const playIconHtml = this.buildPlayIconHtml();

    const itemHtml = (item) => `
      <div class="tool-expr-item" data-tool-item-id="${item.id}">
        <div class="tool-expr-item-main">
          <div class="tool-expr-play-zone" data-play-text="${this.escapeHtml(item.text || '')}">
            <div class="tool-expr-text">
              <span class="tool-expr-name tool-quote-text">${this.escapeHtml(item.text || '')}</span>
              ${item.author ? `<span class="tool-expr-translation tool-quote-author">— ${this.escapeHtml(item.author)}</span>` : ''}
              ${showTranslation && item.text_translation ? `<span class="tool-quote-translation">${this.escapeHtml(item.text_translation)}</span>` : ''}
            </div>
            ${playIconHtml}
          </div>
        </div>
      </div>`;

    let contentHtml;
    if (filter === 'featured') {
      const featured = quotes.featured || [];
      contentHtml = `<div class="tool-letter-section">${featured.map(itemHtml).join('')}</div>`;
    } else {
      contentHtml = themes.map((theme) => {
        const themeItems = quotes[String(theme.id)] || [];
        if (!themeItems.length) return '';
        const themeLabel = uiLocale === 'es' ? theme.name : theme.name_en;
        return `
          <div class="tool-letter-section" id="tool-section-${this.escapeHtml(String(theme.id))}">
            <div class="tool-letter-header">${this.escapeHtml(themeLabel || theme.name || '')}</div>
            ${themeItems.map(itemHtml).join('')}
          </div>`;
      }).join('');
    }

    const themeNavHtml = filter === 'all' ? `
      <div class="tool-letter-nav tool-theme-nav" id="tool-letter-nav">
        ${themes.filter((t) => (quotes[String(t.id)] || []).length > 0).map((theme) => {
          const label = uiLocale === 'es' ? theme.name : theme.name_en;
          return `<button class="tool-letter-nav-btn tool-theme-nav-btn" data-tool-letter="${this.escapeHtml(String(theme.id))}">${this.escapeHtml(label || theme.name || '')}</button>`;
        }).join('')}
      </div>` : '';

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(copy.toolQuotes)}</h2>
        </div>
        <div class="profile-segmented-tabs tool-filter-tabs">
          <button class="profile-segmented-btn${filter === 'featured' ? ' active' : ''}" data-tool-filter="featured">${this.escapeHtml(copy.toolFilterFeatured)}</button>
          <button class="profile-segmented-btn${filter === 'all' ? ' active' : ''}" data-tool-filter="all">${this.escapeHtml(copy.toolFilterAll)}</button>
        </div>
        ${themeNavHtml}
      </div>
      <div class="tool-content-list" id="tool-content-list">
        ${contentHtml}
      </div>`;
  }

  renderPhrasalVerbsToolHtml(data, copy, uiLocale) {
    const phrasverbs = data.phrasverbs;
    const letters = (phrasverbs.letras || []).map((l) => l.letra);
    const filter = this.toolFilter || 'featured';
    const playIconHtml = this.buildPlayIconHtml();

    const itemHtml = (item) => `
      <div class="tool-expr-item" data-tool-item-id="${item.id}">
        <div class="tool-expr-item-main">
          <div class="tool-expr-play-zone" data-play-text="${this.escapeHtml(item.name)}">
            <div class="tool-expr-text">
              <span class="tool-expr-name">${this.escapeHtml(item.name)}</span>
            </div>
            ${playIconHtml}
          </div>
          <button class="tool-expr-expand-btn" type="button" aria-label="expand">
            <ion-icon name="chevron-down" class="tool-expr-chevron" aria-hidden="true"></ion-icon>
          </button>
        </div>
      </div>`;

    let contentHtml;
    if (filter === 'featured') {
      const featured = phrasverbs.featured || [];
      contentHtml = `<div class="tool-letter-section">${featured.map(itemHtml).join('')}</div>`;
    } else {
      contentHtml = letters.map((letter) => {
        const items = phrasverbs[letter] || [];
        return `
          <div class="tool-letter-section" id="tool-section-${this.escapeHtml(letter)}">
            <div class="tool-letter-header">${this.escapeHtml(letter.toUpperCase())}</div>
            ${items.map(itemHtml).join('')}
          </div>`;
      }).join('');
    }

    const letterNavHtml = filter === 'all' ? `
      <div class="tool-letter-nav" id="tool-letter-nav">
        ${letters.map((letter) =>
          `<button class="tool-letter-nav-btn" data-tool-letter="${this.escapeHtml(letter)}">${this.escapeHtml(letter.toUpperCase())}</button>`
        ).join('')}
      </div>` : '';

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(copy.toolPhrasalVerbs)}</h2>
        </div>
        <div class="profile-segmented-tabs tool-filter-tabs">
          <button class="profile-segmented-btn${filter === 'featured' ? ' active' : ''}" data-tool-filter="featured">${this.escapeHtml(copy.toolFilterFeatured)}</button>
          <button class="profile-segmented-btn${filter === 'all' ? ' active' : ''}" data-tool-filter="all">${this.escapeHtml(copy.toolFilterAll)}</button>
        </div>
        ${letterNavHtml}
      </div>
      <div class="tool-content-list" id="tool-content-list">
        ${contentHtml}
      </div>`;
  }

  renderVocabsToolHtml(data, copy, uiLocale) {
    const vocabs = data.vocabs;
    const groupKeys = Object.keys(vocabs).sort((a, b) => Number(a) - Number(b));
    const playIconHtml = this.buildPlayIconHtml();

    const wordHtml = (word) => {
      const isCached = word.image_url && this.vocabImageCache.has(word.image_url);
      let imgHtml;
      if (word.image_url) {
        imgHtml = `<div class="tool-vocab-img-skeleton${isCached ? ' is-hidden' : ''}"></div>
           <img class="tool-vocab-img${isCached ? ' is-loaded' : ''}" src="${this.escapeHtml(word.image_url)}" alt="${this.escapeHtml(word.name)}" loading="lazy">`;
      } else {
        const swatch = this.resolveColorSwatch(word.name);
        imgHtml = swatch
          ? `<div class="tool-vocab-color-swatch" style="background:${swatch}"></div>`
          : null;
      }
      return `
        <div class="tool-vocab-word">
          ${imgHtml !== null ? `<div class="tool-vocab-img-wrap">${imgHtml}</div>` : ''}
          <div class="tool-expr-play-zone tool-vocab-play-zone" data-play-text="${this.escapeHtml(word.name)}">
            <div class="tool-vocab-word-text">
              <span class="tool-vocab-word-name">${this.escapeHtml(word.name)}</span>
              ${uiLocale === 'es' ? `<span class="tool-vocab-word-tr">${this.escapeHtml(word.translation)}</span>` : ''}
            </div>
            ${playIconHtml}
          </div>
        </div>`;
    };

    const contentHtml = groupKeys.map((key) => {
      const group = vocabs[key];
      const vocabularies = group.vocabularies || [];
      const vocabsHtml = vocabularies.map((vocab) => {
        const wordsHtml = (vocab.words || []).map(wordHtml).join('');
        return `
          <div class="tool-vocab-subcat">
            <div class="tool-vocab-subcat-header">
              <div class="tool-expr-play-zone tool-vocab-subcat-play" data-play-text="${this.escapeHtml(vocab.name)}">
                <div class="tool-vocab-subcat-text">
                  <span class="tool-vocab-subcat-name">${this.escapeHtml(vocab.name)}</span>
                  ${uiLocale === 'es' ? `<span class="tool-vocab-subcat-tr">${this.escapeHtml(vocab.translation)}</span>` : ''}
                </div>
                ${playIconHtml}
              </div>
            </div>
            <div class="tool-vocab-words">${wordsHtml}</div>
          </div>`;
      }).join('');
      return `
        <div class="tool-letter-section" id="tool-section-${this.escapeHtml(key)}">
          <div class="tool-letter-header">${this.escapeHtml(group.name)}</div>
          ${vocabsHtml}
        </div>`;
    }).join('');

    const groupNavHtml = `
      <div class="tool-letter-nav tool-theme-nav" id="tool-letter-nav">
        ${groupKeys.map((key) =>
          `<button class="tool-letter-nav-btn tool-theme-nav-btn" data-tool-letter="${this.escapeHtml(key)}">${this.escapeHtml(vocabs[key].name)}</button>`
        ).join('')}
      </div>`;

    return `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(copy.backToList)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(copy.toolVocabulary)}</h2>
        </div>
        ${groupNavHtml}
      </div>
      <div class="tool-content-list" id="tool-content-list">
        ${contentHtml}
      </div>`;
  }

  renderArticlesToolHtml(units, toolTitle, copy, uiLocale) {
    const backLabel = copy.backToList || 'Back';
    const noContent = copy.noContent || 'No content.';

    const articleRowHtml = (item, dataAttr, iconName, thumbnailUrl = null) => {
      const title    = this.getText(item, 'display', uiLocale) || '';
      const subtitle = this.getSecondaryDisplay(item, uiLocale);
      const iconHtml = thumbnailUrl
        ? `<div class="training-row-icon articles-row-thumb">
             <img src="${this.escapeHtml(thumbnailUrl)}" alt="" loading="lazy">
           </div>`
        : `<div class="training-row-icon">
             <ion-icon name="${iconName}" aria-hidden="true"></ion-icon>
           </div>`;
      return `
        <div class="training-row ${dataAttr.cls}" ${dataAttr.attr}="${item.code}">
          ${iconHtml}
          <div class="training-row-body">
            <div class="training-row-title">${this.escapeHtml(title)}</div>
            ${subtitle ? `<div class="module-sub module-sub-neutral">${this.escapeHtml(subtitle)}</div>` : ''}
          </div>
          <ion-icon name="chevron-forward" class="training-row-arrow" aria-hidden="true"></ion-icon>
        </div>`;
    };

    const stickyHeader = (viewTitle) => `
      <div class="tool-sticky-header">
        <div class="tool-view-header">
          <button class="tool-back-btn" id="tool-back-btn">
            <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
            <span>${this.escapeHtml(backLabel)}</span>
          </button>
          <h2 class="tool-view-title">${this.escapeHtml(viewTitle)}</h2>
        </div>
      </div>`;

    // ── Level 2: lesson content ──────────────────────────────────────
    if (this.activeArticleLessonCode !== null) {
      let lesson = null;
      for (const unit of units) {
        lesson = (unit.lecciones || []).find((l) => l.code === this.activeArticleLessonCode);
        if (lesson) break;
      }
      const lessonTitle = lesson ? this.getText(lesson, 'display', uiLocale) : '';
      const md = lesson
        ? (this.getText(lesson, 'view', uiLocale) || this.getText(lesson, 'view', this.getAltLocale(uiLocale)))
        : '';
      return `
        ${stickyHeader(lessonTitle)}
        <div class="reference-markdown articles-content tool-content-list" id="tool-content-list">
          ${md
            ? this.renderMarkdownFallbackHtml(md)
            : `<p class="reference-empty">${this.escapeHtml(noContent)}</p>`}
        </div>`;
    }

    // ── Level 1: all units as group headers with lessons below ───────
    const ARTICLE_THUMB_FALLBACKS = { 304: 'assets/flags/gbus.png' };
    const groupsHtml = units.map((unit) => {
      const unitTitle = this.getText(unit, 'display', uiLocale) || '';
      const lecciones = unit.lecciones || [];
      if (!lecciones.length) return '';
      const lessonsHtml = lecciones.map((l) => {
        const md = this.getText(l, 'view', uiLocale) || this.getText(l, 'view', this.getAltLocale(uiLocale));
        const thumb = this.extractFirstMarkdownImage(md) || ARTICLE_THUMB_FALLBACKS[l.code] || null;
        return articleRowHtml(l, { cls: 'articles-lesson-item', attr: 'data-lesson-code' }, 'reader-outline', thumb);
      }).join('');
      return `
        <div class="tool-letter-section">
          <div class="tool-letter-header">${this.escapeHtml(unitTitle)}</div>
          <div class="articles-unit-list">${lessonsHtml}</div>
        </div>`;
    }).join('');
    return `
      ${stickyHeader(toolTitle)}
      <div class="tool-content-list" id="tool-content-list">
        ${groupsHtml}
      </div>`;
  }

  isReferenceToolsEnabled() {
    const globalValue =
      window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'referenceToolsEnabled')
        ? window.r34lp0w3r.referenceToolsEnabled
        : undefined;
    if (globalValue !== undefined) return Boolean(globalValue);
    try {
      const v = localStorage.getItem(REFERENCE_TOOLS_ENABLED_KEY);
      if (!v) return false;
      return ['1', 'true', 'on'].includes(String(v).trim().toLowerCase());
    } catch (err) {
      return false;
    }
  }

  hasAutoHeroNarrationPlayed() {
    if (typeof window === 'undefined') return false;
    const appState = window.r34lp0w3r;
    if (appState && appState.referenceHeroAutoNarrationPlayed) return true;
    try {
      const persisted = localStorage.getItem(REFERENCE_HERO_AUTONARRATION_PLAYED_KEY) === '1';
      if (persisted) {
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        window.r34lp0w3r.referenceHeroAutoNarrationPlayed = true;
      }
      return persisted;
    } catch (err) {
      return false;
    }
  }

  markAutoHeroNarrationPlayed() {
    if (typeof window === 'undefined') return;
    if (!window.r34lp0w3r) window.r34lp0w3r = {};
    window.r34lp0w3r.referenceHeroAutoNarrationPlayed = true;
    try {
      localStorage.setItem(REFERENCE_HERO_AUTONARRATION_PLAYED_KEY, '1');
    } catch (err) {
      // no-op
    }
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

      const notifyStart = () => {
        if (started) return;
        started = true;
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
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
          started = await this.speakHeroWithWebTts(lineText, lang, token);
        }
        if (!started && token === this.narrationToken) {
          started = await this.speakHeroWithNativePlugin(lineText, lang, token);
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

  formatReferenceCopy(template, params = {}) {
    return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
      params[key] === undefined || params[key] === null ? '' : String(params[key])
    );
  }

  getLocalizedTestText(source, locale) {
    return getLocalizedReferenceTestValue(source, locale) || '';
  }

  getReferenceUnitProgressKey(courseCode, unitCode) {
    return `${String(courseCode || '').trim()}::${String(unitCode || '').trim()}`;
  }

  getReferenceLessonProgressKey(courseCode, unitCode, lessonCode) {
    return `${this.getReferenceUnitProgressKey(courseCode, unitCode)}::${String(
      lessonCode || ''
    ).trim()}`;
  }

  getProgressMapValue(progressMap, code) {
    const key = String(code === undefined || code === null ? '' : code).trim();
    if (!key || !progressMap || typeof progressMap !== 'object') return null;
    if (progressMap[key] !== undefined && progressMap[key] !== null) return progressMap[key];
    const numericKey = Number(key);
    if (
      Number.isFinite(numericKey) &&
      progressMap[numericKey] !== undefined &&
      progressMap[numericKey] !== null
    ) {
      return progressMap[numericKey];
    }
    return null;
  }

  hasImportedSectionCompletion(sectionCode, user = window.user || null) {
    const progressMap =
      user && user.section_progress && typeof user.section_progress === 'object'
        ? user.section_progress
        : null;
    const value = this.getProgressMapValue(progressMap, sectionCode);
    if (value === true) return true;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0;
  }

  getImportedReferenceTestStatus(testCode, user = window.user || null) {
    const progressMap =
      user && user.test_progress && typeof user.test_progress === 'object'
        ? user.test_progress
        : null;
    const value = this.getProgressMapValue(progressMap, testCode);
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    if (numericValue === 1) return 1;
    if (numericValue === 2) return 2;
    return 0;
  }

  getReferenceAggregateTone(percent) {
    const value = Number.isFinite(Number(percent)) ? Number(percent) : 0;
    if (value >= 100) return 'good';
    if (value <= 0) return 'neutral';
    return 'okay';
  }

  getReferenceLessonTone(isCompleted) {
    return isCompleted ? 'good' : 'neutral';
  }

  getActiveReferenceLessonTab() {
    return this.referenceLessonTab === 'tests' ? 'tests' : 'content';
  }

  getReferenceLessonTabScrollState() {
    if (!this.referenceLessonTabScrollTop || typeof this.referenceLessonTabScrollTop !== 'object') {
      this.referenceLessonTabScrollTop = { content: 0, tests: 0 };
    }
    return this.referenceLessonTabScrollTop;
  }

  async getReferenceLessonScrollTop() {
    const contentEl =
      this.querySelector('ion-content.home-journey') || this.querySelector('ion-content');
    if (!contentEl) return 0;
    if (typeof contentEl.getScrollElement === 'function') {
      try {
        const scrollEl = await contentEl.getScrollElement();
        return scrollEl ? Math.max(0, Number(scrollEl.scrollTop) || 0) : 0;
      } catch (err) {
        return 0;
      }
    }
    return Math.max(0, Number(contentEl.scrollTop) || 0);
  }

  async setReferenceLessonScrollTop(nextTop = 0) {
    const targetTop = Math.max(0, Number(nextTop) || 0);
    const contentEl =
      this.querySelector('ion-content.home-journey') || this.querySelector('ion-content');
    if (!contentEl) return;
    if (typeof contentEl.scrollToPoint === 'function') {
      try {
        await contentEl.scrollToPoint(0, targetTop, 0);
        return;
      } catch (err) {
        // fallback below
      }
    }
    if (typeof contentEl.getScrollElement === 'function') {
      try {
        const scrollEl = await contentEl.getScrollElement();
        if (scrollEl) {
          scrollEl.scrollTop = targetTop;
          return;
        }
      } catch (err) {
        // fallback below
      }
    }
    contentEl.scrollTop = targetTop;
  }

  async switchReferenceLessonTab(nextTab) {
    const normalizedTab = nextTab === 'tests' ? 'tests' : 'content';
    const currentTab = this.getActiveReferenceLessonTab();
    if (normalizedTab === currentTab) return;
    const scrollState = this.getReferenceLessonTabScrollState();
    scrollState[currentTab] = await this.getReferenceLessonScrollTop();
    this.referenceLessonTab = normalizedTab;
    this.applyReferenceLessonTabUi(normalizedTab);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    await this.setReferenceLessonScrollTop(scrollState[normalizedTab] || 0);
  }

  applyReferenceLessonTabUi(tab = this.getActiveReferenceLessonTab()) {
    const normalizedTab = tab === 'tests' ? 'tests' : 'content';
    const buttons = Array.from(this.querySelectorAll('[data-reference-lesson-tab]'));
    buttons.forEach((button) => {
      const isActive = String(button.dataset.referenceLessonTab || '').trim() === normalizedTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    const contentPanel = this.querySelector('#reference-content-panel');
    const testsPanel = this.querySelector('#reference-tests-panel');
    if (contentPanel) contentPanel.hidden = normalizedTab !== 'content';
    if (testsPanel) testsPanel.hidden = normalizedTab !== 'tests';
  }

  renderReferenceLessonDots(lessonProgress) {
    const learnDone = lessonProgress && lessonProgress.learnDone;
    const testsTone = lessonProgress && lessonProgress.testsTone ? lessonProgress.testsTone : 'neutral';
    const hasTests = lessonProgress && lessonProgress.hasTests;
    const learnDot = `<span class="lesson-dot tone-${learnDone ? 'good' : 'neutral'}"></span>`;
    const testsDot = hasTests
      ? `<span class="lesson-dot tone-${testsTone}"></span>`
      : `<span class="lesson-dot tone-neutral is-empty"></span>`;
    return `<span class="lesson-dots">${learnDot}${testsDot}</span>`;
  }

  renderReferenceProgressPill(percent, tone, options = {}) {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const normalizedTone = ['good', 'okay', 'bad', 'neutral'].includes(String(tone || '').trim())
      ? String(tone || '').trim()
      : 'neutral';
    const compactClass = options.compact ? ' is-compact' : '';
    const extraClass = String(options.extraClass || '')
      .trim()
      .replace(/\s+/g, ' ');
    const label =
      options.label !== undefined && options.label !== null
        ? String(options.label)
        : `${value}%`;
    const ariaLabel =
      options.ariaLabel !== undefined && options.ariaLabel !== null
        ? String(options.ariaLabel)
        : `${value}%`;
    return `<span class="reference-progress-pill tone-${normalizedTone}${compactClass}${
      extraClass ? ` ${extraClass}` : ''
    }" aria-label="${this.escapeHtml(
      ariaLabel
    )}">${this.escapeHtml(label)}</span>`;
  }

  getReferenceProgressQueueStorageKey(user = window.user || null) {
    return `${REFERENCE_PROGRESS_QUEUE_STORAGE_PREFIX}:${this.getReferenceTestsStorageUserKey(user)}`;
  }

  readReferenceProgressQueue(user = window.user || null) {
    try {
      const raw = localStorage.getItem(this.getReferenceProgressQueueStorageKey(user));
      if (!raw) {
        return { lessons: [], tests: {} };
      }
      const parsed = JSON.parse(raw);
      const lessons = Array.isArray(parsed && parsed.lessons)
        ? parsed.lessons.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      const tests = {};
      Object.entries(parsed && parsed.tests && typeof parsed.tests === 'object' ? parsed.tests : {}).forEach(
        ([testCode, rawScore]) => {
          const normalizedCode = String(testCode || '').trim();
          const normalizedScore = Math.max(0, Math.min(100, Math.round(Number(rawScore) || 0)));
          if (!normalizedCode) return;
          tests[normalizedCode] = normalizedScore;
        }
      );
      return { lessons, tests };
    } catch (err) {
      return { lessons: [], tests: {} };
    }
  }

  writeReferenceProgressQueue(queue, user = window.user || null) {
    const safeQueue = queue && typeof queue === 'object' ? queue : {};
    const lessons = Array.isArray(safeQueue.lessons)
      ? safeQueue.lessons.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const tests = {};
    Object.entries(safeQueue.tests && typeof safeQueue.tests === 'object' ? safeQueue.tests : {}).forEach(
      ([testCode, rawScore]) => {
        const normalizedCode = String(testCode || '').trim();
        if (!normalizedCode) return;
        tests[normalizedCode] = Math.max(0, Math.min(100, Math.round(Number(rawScore) || 0)));
      }
    );
    try {
      if (!lessons.length && !Object.keys(tests).length) {
        localStorage.removeItem(this.getReferenceProgressQueueStorageKey(user));
        return;
      }
      localStorage.setItem(
        this.getReferenceProgressQueueStorageKey(user),
        JSON.stringify({ lessons, tests })
      );
    } catch (err) {
      // no-op
    }
  }

  hasAuthenticatedReferenceUser(user = window.user || null) {
    return Boolean(
      user &&
        user.id !== undefined &&
        user.id !== null &&
        String(user.id).trim() &&
        user.token !== undefined &&
        user.token !== null &&
        String(user.token).trim()
    );
  }

  applyReferenceUserProgressPatch(mutator) {
    if (typeof mutator !== 'function') return false;
    const currentUser = window.user || null;
    if (!currentUser || currentUser.id === undefined || currentUser.id === null) return false;
    const nextUser = {
      ...currentUser,
      section_progress:
        currentUser.section_progress && typeof currentUser.section_progress === 'object'
          ? { ...currentUser.section_progress }
          : {},
      test_progress:
        currentUser.test_progress && typeof currentUser.test_progress === 'object'
          ? { ...currentUser.test_progress }
          : {}
    };
    const changed = mutator(nextUser);
    if (!changed) return false;
    if (typeof window.setUser === 'function') {
      window.setUser(nextUser);
      return true;
    }
    window.user = nextUser;
    try {
      localStorage.setItem('appv5:user', JSON.stringify(nextUser));
    } catch (err) {
      // no-op
    }
    window.dispatchEvent(new CustomEvent('app:user-change', { detail: nextUser }));
    return true;
  }

  enqueueReferenceLessonSync(lessonCode, user = window.user || null) {
    const normalizedCode = String(lessonCode || '').trim();
    if (!normalizedCode || !this.hasAuthenticatedReferenceUser(user)) return false;
    const queue = this.readReferenceProgressQueue(user);
    if (!queue.lessons.includes(normalizedCode)) {
      queue.lessons.push(normalizedCode);
      this.writeReferenceProgressQueue(queue, user);
    }
    return true;
  }

  enqueueReferenceTestSync(testCode, scorePercent, user = window.user || null) {
    const normalizedCode = String(testCode || '').trim();
    if (!normalizedCode || !this.hasAuthenticatedReferenceUser(user)) return false;
    const normalizedScore = Math.max(0, Math.min(100, Math.round(Number(scorePercent) || 0)));
    const queue = this.readReferenceProgressQueue(user);
    const previousScore = Math.max(0, Math.min(100, Math.round(Number(queue.tests[normalizedCode]) || 0)));
    if (normalizedScore > previousScore) {
      queue.tests[normalizedCode] = normalizedScore;
      this.writeReferenceProgressQueue(queue, user);
    }
    return true;
  }

  buildReferenceProgressPayload(queue) {
    const lessons = Array.isArray(queue && queue.lessons)
      ? queue.lessons.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const testEntries = Object.entries(queue && queue.tests && typeof queue.tests === 'object' ? queue.tests : {})
      .map(([testCode, rawScore]) => [
        String(testCode || '').trim(),
        Math.max(0, Math.min(100, Math.round(Number(rawScore) || 0)))
      ])
      .filter(([testCode]) => Boolean(testCode));
    const payload = {};
    if (lessons.length) payload.lessons = lessons;
    if (testEntries.length) {
      payload.tests = testEntries.map(([testCode]) => testCode);
      payload.results = testEntries.map(([_testCode, score]) => score);
    }
    return payload;
  }

  async flushReferenceProgressQueue(options = {}) {
    if (this.referenceProgressSyncInFlight) {
      return { ok: false, skipped: 'in-flight' };
    }
    const user = window.user || null;
    if (!this.hasAuthenticatedReferenceUser(user)) {
      return { ok: false, skipped: 'no-user' };
    }
    if (typeof window.doPost !== 'function') {
      return { ok: false, skipped: 'no-client' };
    }
    if (window.navigator && window.navigator.onLine === false) {
      return { ok: false, skipped: 'offline' };
    }
    const queue = this.readReferenceProgressQueue(user);
    const payload = this.buildReferenceProgressPayload(queue);
    if (!payload.lessons && !payload.tests) {
      return { ok: false, skipped: 'empty' };
    }

    this.referenceProgressSyncInFlight = true;
    try {
      const result = await window.doPost('/v4/recordProgress', user, payload);
      if (result && result.ok && !(result.data && result.data.error)) {
        this.writeReferenceProgressQueue({ lessons: [], tests: {} }, user);
        return { ok: true, result, reason: options.reason || '' };
      }
      return {
        ok: false,
        status: result && result.status ? result.status : 0,
        error: result && result.data && result.data.error ? result.data.error : ''
      };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err || '') };
    } finally {
      this.referenceProgressSyncInFlight = false;
    }
  }

  clearReferenceLessonCompletionTimer() {
    if (this.referenceLessonCompletionTimer) {
      clearTimeout(this.referenceLessonCompletionTimer);
      this.referenceLessonCompletionTimer = null;
    }
    this.referenceLessonCompletionKey = '';
  }

  startReferenceLessonCompletionTimer(lessonRef) {
    this.clearReferenceLessonCompletionTimer();
    if (!this.lessonView || !this.hasAuthenticatedReferenceUser(window.user || null)) return;
    const courseCode = String(lessonRef && lessonRef.courseCode ? lessonRef.courseCode : '').trim();
    const unitCode = String(lessonRef && lessonRef.unitCode ? lessonRef.unitCode : '').trim();
    const lessonCode = String(lessonRef && lessonRef.lessonCode ? lessonRef.lessonCode : '').trim();
    if (!courseCode || !unitCode || !lessonCode) return;
    if (this.hasImportedSectionCompletion(lessonCode)) return;
    const lessonKey = `${courseCode}:${unitCode}:${lessonCode}`;
    this.referenceLessonCompletionKey = lessonKey;
    this.referenceLessonCompletionTimer = setTimeout(() => {
      if (!this.isConnected || !this.lessonView) return;
      const selection = getReferenceSelection();
      if (
        String(selection && selection.courseCode ? selection.courseCode : '').trim() !== courseCode ||
        String(selection && selection.unitCode ? selection.unitCode : '').trim() !== unitCode ||
        String(selection && selection.lessonCode ? selection.lessonCode : '').trim() !== lessonCode
      ) {
        return;
      }
      this.markReferenceLessonCompleted({ courseCode, unitCode, lessonCode }).catch(() => {});
    }, REFERENCE_LESSON_COMPLETE_DELAY_MS);
  }

  async markReferenceLessonCompleted(lessonRef) {
    const lessonCode = String(lessonRef && lessonRef.lessonCode ? lessonRef.lessonCode : '').trim();
    if (!lessonCode) return false;
    if (!this.hasAuthenticatedReferenceUser(window.user || null)) return false;
    if (this.hasImportedSectionCompletion(lessonCode)) return false;

    this.clearReferenceLessonCompletionTimer();
    this.enqueueReferenceLessonSync(lessonCode);
    this.pendingReferenceUnitRewardPopup = { reason: 'reference-lesson-complete' };
    this.pendingReferenceCourseBadgePopup = { reason: 'reference-lesson-complete' };
    this.applyReferenceUserProgressPatch((nextUser) => {
      const currentValue = this.getProgressMapValue(nextUser.section_progress, lessonCode);
      if (currentValue !== null && Number(currentValue) > 0) return false;
      nextUser.section_progress[lessonCode] = 1;
      return true;
    });
    this.flushReferenceProgressQueue({ reason: 'lesson-complete' }).catch(() => {});
    return true;
  }

  isReferenceTestPassingScore(percent) {
    const value = Number(percent);
    return Number.isFinite(value) && value > REFERENCE_TEST_PASS_PERCENT;
  }

  getReferenceTestScorePercent(progress) {
    const total = Number(progress && progress.total) || 0;
    const correctCount = Number(progress && progress.correctCount) || 0;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((correctCount / total) * 100)));
  }

  async syncReferenceTestResult(test, progress) {
    const testCode = String(test && test.code !== undefined && test.code !== null ? test.code : '').trim();
    if (!testCode) return { ok: false, skipped: 'no-test' };
    if (!this.hasAuthenticatedReferenceUser(window.user || null)) {
      return { ok: false, skipped: 'no-user' };
    }
    const percent = this.getReferenceTestScorePercent(progress);
    this.enqueueReferenceTestSync(testCode, percent);
    this.applyReferenceUserProgressPatch((nextUser) => {
      const currentValue = Number(this.getProgressMapValue(nextUser.test_progress, testCode) || 0);
      const nextValue = this.isReferenceTestPassingScore(percent) ? 1 : 2;
      if (nextValue <= currentValue) return false;
      nextUser.test_progress[testCode] = nextValue;
      return true;
    });
    return this.flushReferenceProgressQueue({ reason: 'test-check' });
  }

  getReferenceTestKey(scope, test) {
    const normalizedScope = scope === 'unit' ? 'unit' : 'lesson';
    const code = test && test.code !== undefined && test.code !== null ? String(test.code).trim() : '';
    return code ? `${normalizedScope}:${code}` : '';
  }

  getReferenceTestsStorageUserKey(user = window.user || null) {
    if (user && user.id !== undefined && user.id !== null) {
      const value = String(user.id).trim();
      if (value) return value;
    }
    return 'anon';
  }

  getReferenceTestsStorageKey(user = window.user || null) {
    return `${REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX}:${this.getReferenceTestsStorageUserKey(user)}`;
  }

  serializeReferenceTestResponses(responses) {
    const source = responses && typeof responses === 'object' ? responses : {};
    const output = {};
    Object.entries(source).forEach(([questionCode, rawValue]) => {
      const key = String(questionCode || '').trim();
      if (!key) return;
      if (Array.isArray(rawValue)) {
        const values = rawValue.map((item) => String(item || ''));
        while (values.length && !String(values[values.length - 1] || '').trim()) values.pop();
        if (values.some((item) => String(item || '').trim())) {
          output[key] = values;
        }
        return;
      }
      const value = String(rawValue || '');
      if (value.trim()) {
        output[key] = value;
      }
    });
    return output;
  }

  serializeReferenceTestState(state) {
    const responses = this.serializeReferenceTestResponses(state && state.responses);
    const checked = Boolean(state && state.checked);
    const lastCheckedAt =
      state && Number.isFinite(Number(state.lastCheckedAt)) ? Number(state.lastCheckedAt) : 0;
    if (!Object.keys(responses).length && !checked && !lastCheckedAt) {
      return null;
    }
    const payload = {
      responses,
      checked
    };
    if (lastCheckedAt > 0) payload.lastCheckedAt = lastCheckedAt;
    return payload;
  }

  sanitizeStoredReferenceTestsPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const statesSource = source.states && typeof source.states === 'object' ? source.states : {};
    const states = {};
    Object.entries(statesSource).forEach(([testKey, rawState]) => {
      const key = String(testKey || '').trim();
      if (!key || !rawState || typeof rawState !== 'object') return;
      const serialized = this.serializeReferenceTestState(rawState);
      if (serialized) states[key] = serialized;
    });
    return {
      selectionKey: String(source.selectionKey || '').trim(),
      states
    };
  }

  ensureReferenceTestsPersistenceLoaded(force = false) {
    const userKey = this.getReferenceTestsStorageUserKey(window.user || null);
    if (!force && this.referenceTestsStorageUserKey === userKey) return;
    this.referenceTestsStorageUserKey = userKey;
    this.referenceTestFocus = { testKey: '', questionCode: '', inputIndex: 0 };
    try {
      const raw = localStorage.getItem(this.getReferenceTestsStorageKey(window.user || null));
      if (!raw) {
        this.referenceTestStates = {};
        this.referenceTestSelectionKey = '';
        return;
      }
      const payload = this.sanitizeStoredReferenceTestsPayload(JSON.parse(raw));
      this.referenceTestStates = payload.states;
      this.referenceTestSelectionKey = payload.selectionKey;
    } catch (err) {
      this.referenceTestStates = {};
      this.referenceTestSelectionKey = '';
    }
  }

  persistReferenceTestsState() {
    this.ensureReferenceTestsPersistenceLoaded();
    const states = {};
    Object.entries(this.referenceTestStates || {}).forEach(([testKey, rawState]) => {
      const key = String(testKey || '').trim();
      if (!key) return;
      const serialized = this.serializeReferenceTestState(rawState);
      if (serialized) states[key] = serialized;
    });
    const payload = {
      selectionKey: String(this.referenceTestSelectionKey || '').trim(),
      states
    };
    try {
      localStorage.setItem(this.getReferenceTestsStorageKey(window.user || null), JSON.stringify(payload));
    } catch (err) {
      // keep UI functional even if persistence fails
    }
  }

  getReferenceTestState(testKey) {
    this.ensureReferenceTestsPersistenceLoaded();
    const key = String(testKey || '').trim();
    if (!key) {
      return {
        responses: {},
        checked: false,
        lastCheckedAt: 0
      };
    }
    if (!this.referenceTestStates[key]) {
      this.referenceTestStates[key] = {
        responses: {},
        checked: false,
        lastCheckedAt: 0
      };
    }
    return this.referenceTestStates[key];
  }

  peekReferenceTestState(testKey) {
    this.ensureReferenceTestsPersistenceLoaded();
    const key = String(testKey || '').trim();
    if (!key) {
      return {
        responses: {},
        checked: false,
        lastCheckedAt: 0
      };
    }
    const stored = this.referenceTestStates[key];
    if (stored && typeof stored === 'object') return stored;
    return {
      responses: {},
      checked: false,
      lastCheckedAt: 0
    };
  }

  clearReferenceTestState(testKey) {
    const key = String(testKey || '').trim();
    if (!key) return;
    this.referenceTestStates[key] = {
      responses: {},
      checked: false,
      lastCheckedAt: 0
    };
  }

  clearReferenceTestCheckedState(state) {
    if (!state || typeof state !== 'object') return;
    state.checked = false;
    state.lastCheckedAt = 0;
  }

  parseReferenceReorderTokens(text) {
    return String(text || '')
      .split('/')
      .map((part) => String(part || '').trim())
      .filter(Boolean);
  }

  getReferenceQuestionSlotCount(question) {
    const acceptedPlaceholders =
      question &&
      question.answer &&
      Array.isArray(question.answer.accepted_placeholders)
        ? question.answer.accepted_placeholders
        : [];
    const fromAccepted = acceptedPlaceholders.reduce(
      (max, entry) => Math.max(max, Array.isArray(entry) ? entry.length : 0),
      0
    );
    if (fromAccepted > 0) return fromAccepted;
    const matches = String(question && question.text ? question.text : '').match(/_{3,}/g);
    const fromText = Array.isArray(matches) ? matches.length : 0;
    return Math.max(1, fromText);
  }

  normalizeReferenceAnswerValue(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u2018\u2019\u0060\u00b4]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[¿¡]/g, '')
      .replace(/[.,!?;:()"[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  getReferenceQuestionAcceptedAnswers(question) {
    const answer = question && question.answer ? question.answer : {};
    const accepted = Array.isArray(answer.accepted) ? answer.accepted.filter(Boolean) : [];
    if (accepted.length) return accepted;
    const raw = String(answer.raw || '').trim();
    return raw ? [raw] : [];
  }

  buildReferenceQuestionInputs(question, testKey, values, copy, options = {}) {
    const slotCount = this.getReferenceQuestionSlotCount(question);
    const safeValues = Array.from({ length: slotCount }, (_unused, index) =>
      Array.isArray(values) && values[index] !== undefined ? String(values[index] || '') : ''
    );
    const questionCode = String(question.code || '');
    const checked = Boolean(options.checked);
    const statusClass = checked
      ? options.correct
        ? 'is-correct'
        : 'is-incorrect'
      : '';
    const promptParts = String(question.text || '').split(/_{3,}/g);
    if (promptParts.length > 1) {
      const fragments = [];
      for (let index = 0; index < promptParts.length; index += 1) {
        const part = promptParts[index];
        if (part) {
          fragments.push(`<span class="reference-test-prompt-text">${this.escapeHtml(part)}</span>`);
        }
        if (index < slotCount) {
          fragments.push(`
            <input
              type="text"
              class="reference-test-input ${statusClass}"
              data-action="reference-test-input"
              data-test-key="${this.escapeHtml(testKey)}"
              data-question-code="${this.escapeHtml(questionCode)}"
              data-input-index="${index}"
              value="${this.escapeHtml(safeValues[index])}"
              placeholder="${this.escapeHtml(
                slotCount > 1
                  ? `${copy.testsAnswerPlaceholder} ${index + 1}`
                  : copy.testsAnswerPlaceholder
              )}"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            >
          `);
        }
      }
      return `<div class="reference-test-inline-prompt">${fragments.join('')}</div>`;
    }

    return `
      <p class="reference-test-question-text">${this.escapeHtml(question.text || '')}</p>
      <div class="reference-test-inputs">
        ${safeValues
          .map(
            (value, index) => `
              <input
                type="text"
                class="reference-test-input ${statusClass}"
                data-action="reference-test-input"
                data-test-key="${this.escapeHtml(testKey)}"
                data-question-code="${this.escapeHtml(questionCode)}"
                data-input-index="${index}"
                value="${this.escapeHtml(value)}"
                placeholder="${this.escapeHtml(
                  slotCount > 1
                    ? `${copy.testsAnswerPlaceholder} ${index + 1}`
                    : copy.testsAnswerPlaceholder
                )}"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
              >
            `
          )
          .join('')}
      </div>
    `;
  }

  evaluateReferenceQuestion(question, response) {
    const interaction = String(question && question.interaction ? question.interaction : '')
      .trim()
      .toLowerCase();
    const acceptedAnswers = this.getReferenceQuestionAcceptedAnswers(question);
    const acceptedPlaceholders =
      question &&
      question.answer &&
      Array.isArray(question.answer.accepted_placeholders)
        ? question.answer.accepted_placeholders
        : [];

    if (interaction === 'multiple_choice') {
      const selectedCode = String(response || '').trim();
      const correctOption = Array.isArray(question.options)
        ? question.options.find((option) => option.correct)
        : null;
      const selectedOption = Array.isArray(question.options)
        ? question.options.find((option) => String(option.code) === selectedCode)
        : null;
      return {
        correct: Boolean(correctOption && selectedCode && String(correctOption.code) === selectedCode),
        userDisplay: selectedOption ? selectedOption.text : '',
        correctDisplay: correctOption ? correctOption.text : acceptedAnswers[0] || ''
      };
    }

    if (interaction === 'reorder_words') {
      const answerTokens = Array.isArray(response) ? response : [];
      const userDisplay = answerTokens.join(' ').trim();
      const userNormalized = this.normalizeReferenceAnswerValue(userDisplay);
      const acceptedNormalized = acceptedAnswers.map((item) => this.normalizeReferenceAnswerValue(item));
      return {
        correct: Boolean(userNormalized) && acceptedNormalized.includes(userNormalized),
        userDisplay,
        correctDisplay: acceptedAnswers[0] || ''
      };
    }

    const slotCount = this.getReferenceQuestionSlotCount(question);
    const rawParts = Array.isArray(response)
      ? response.slice(0, slotCount).map((item) => String(item || ''))
      : [String(response || '')];
    const filledParts = Array.from({ length: slotCount }, (_unused, index) => rawParts[index] || '');
    const userDisplay =
      slotCount > 1
        ? filledParts.map((part) => part.trim()).filter(Boolean).join(' · ')
        : filledParts[0].trim();

    if (acceptedPlaceholders.length) {
      const normalizedParts = filledParts.map((part) => this.normalizeReferenceAnswerValue(part));
      const isCorrect = acceptedPlaceholders.some((entry) => {
        if (!Array.isArray(entry) || entry.length !== slotCount) return false;
        return entry.every(
          (part, index) =>
            this.normalizeReferenceAnswerValue(part) === (normalizedParts[index] || '')
        );
      });
      const correctEntry = acceptedPlaceholders[0] || [];
      return {
        correct: isCorrect,
        userDisplay,
        correctDisplay:
          slotCount > 1 ? correctEntry.join(' · ') : String(correctEntry[0] || acceptedAnswers[0] || '')
      };
    }

    const userNormalized = this.normalizeReferenceAnswerValue(userDisplay);
    const acceptedNormalized = acceptedAnswers.map((item) => this.normalizeReferenceAnswerValue(item));
    return {
      correct: Boolean(userNormalized) && acceptedNormalized.includes(userNormalized),
      userDisplay,
      correctDisplay: acceptedAnswers[0] || ''
    };
  }

  evaluateReferenceTest(test, testKey) {
    const state = this.peekReferenceTestState(testKey);
    const questions = Array.isArray(test && test.questions) ? test.questions : [];
    const results = questions.map((question) => {
      const response = state.responses[String(question.code || '')];
      return {
        questionCode: String(question.code || ''),
        ...this.evaluateReferenceQuestion(question, response)
      };
    });
    const correctCount = results.filter((item) => item.correct).length;
    return {
      results,
      total: questions.length,
      correctCount
    };
  }

  hasReferenceQuestionResponse(question, response) {
    const interaction = String(question && question.interaction ? question.interaction : '')
      .trim()
      .toLowerCase();
    if (interaction === 'multiple_choice') {
      return Boolean(String(response || '').trim());
    }
    if (interaction === 'reorder_words') {
      return Array.isArray(response) && response.some((item) => String(item || '').trim());
    }
    const slotCount = this.getReferenceQuestionSlotCount(question);
    const values = Array.isArray(response)
      ? response.slice(0, slotCount).map((item) => String(item || ''))
      : [String(response || '')];
    while (values.length < slotCount) values.push('');
    return values.every((item) => String(item || '').trim());
  }

  getReferenceTestProgress(test, testKey) {
    const questions = Array.isArray(test && test.questions) ? test.questions : [];
    const state = this.peekReferenceTestState(testKey);
    const evaluation = this.evaluateReferenceTest(test, testKey);
    const answeredCount = questions.reduce((count, question) => {
      const questionCode = String(question && question.code ? question.code : '');
      return count + (this.hasReferenceQuestionResponse(question, state.responses[questionCode]) ? 1 : 0);
    }, 0);
    const total = evaluation.total;
    const checked = Boolean(state.checked);
    const correctCount = checked ? evaluation.correctCount : 0;
    const scorePercent = total > 0 ? (correctCount / total) * 100 : 0;
    const completed = Boolean(checked && total > 0 && this.isReferenceTestPassingScore(scorePercent));
    const progressCount = checked ? correctCount : answeredCount;
    return {
      checked,
      completed,
      answeredCount,
      correctCount,
      total,
      scorePercent,
      progressCount,
      progressRatio: total > 0 ? Math.max(0, Math.min(1, progressCount / total)) : 0
    };
  }

  getReferenceTestDisplayProgress(test, testKey) {
    const localProgress = this.getReferenceTestProgress(test, testKey);
    const importedStatus = this.getImportedReferenceTestStatus(test && test.code);
    const localPercent = Math.max(
      0,
      Math.min(100, Math.round(Number(localProgress.progressRatio || 0) * 100))
    );

    if (localProgress.checked) {
      const resolved = localProgress.completed || importedStatus === 1;
      return {
        ...localProgress,
        completed: resolved,
        percent: localPercent,
        tone: resolved ? 'good' : localPercent > 0 ? this.getReferenceScoreTone(localPercent) : 'neutral',
        importedStatus
      };
    }

    if (importedStatus === 1) {
      return {
        ...localProgress,
        checked: true,
        completed: true,
        correctCount: localProgress.total,
        progressCount: localProgress.total,
        progressRatio: localProgress.total > 0 ? 1 : 0,
        percent: localProgress.total > 0 ? 100 : 0,
        tone: 'good',
        importedStatus
      };
    }

    if (localProgress.answeredCount > 0) {
      return {
        ...localProgress,
        percent: localPercent,
        tone: localPercent > 0 ? 'okay' : 'neutral',
        importedStatus
      };
    }

    if (importedStatus === 2) {
      return {
        ...localProgress,
        percent: 50,
        progressRatio: localProgress.total > 0 ? 0.5 : 0,
        tone: 'bad',
        importedStatus
      };
    }

    return {
      ...localProgress,
      percent: 0,
      tone: 'neutral',
      importedStatus
    };
  }

  buildReferenceProgressSnapshot(courses = getReferenceCourses()) {
    const snapshot = {
      courses: {},
      units: {},
      lessons: {},
      tests: {}
    };

    const testCourses = getReferenceTestCourses();
    const testCourseMap = new Map(
      (Array.isArray(testCourses) ? testCourses : []).map((course) => [String(course.code), course])
    );

    (Array.isArray(courses) ? courses : []).forEach((course) => {
      const courseCode = String(course.code);
      const testCourse = testCourseMap.get(courseCode) || null;
      const testUnitMap = new Map(
        (testCourse && Array.isArray(testCourse.unidades) ? testCourse.unidades : []).map((unit) => [
          String(unit.code),
          unit
        ])
      );

      let courseCompletedCount = 0;
      let courseTotalCount = 0;

      (Array.isArray(course.unidades) ? course.unidades : []).forEach((unit) => {
        const unitCode = String(unit.code);
        const testUnit = testUnitMap.get(unitCode) || null;
        const testLessonMap = new Map(
          (testUnit && Array.isArray(testUnit.lecciones) ? testUnit.lecciones : []).map((lesson) => [
            String(lesson.code),
            lesson
          ])
        );

        let unitCompletedCount = 0;
        let unitTotalCount = 0;

        (Array.isArray(unit.lecciones) ? unit.lecciones : []).forEach((lesson) => {
          const lessonCode = String(lesson.code);
          const lessonTestsEntry = testLessonMap.get(lessonCode) || null;
          const lessonTests =
            lessonTestsEntry && Array.isArray(lessonTestsEntry.tests) ? lessonTestsEntry.tests : [];
          const learnDone = this.hasImportedSectionCompletion(lessonCode);

          // Compute tests tone for this lesson
          let lessonTestsTone = 'neutral';
          if (lessonTests.length > 0) {
            let lessonTestsCompleted = 0;
            let lessonTestsFailed = 0;
            lessonTests.forEach((test) => {
              const testKey = this.getReferenceTestKey('lesson', test);
              const testProgress = this.getReferenceTestDisplayProgress(test, testKey);
              snapshot.tests[testKey] = testProgress;
              if (testProgress.completed) lessonTestsCompleted += 1;
              else if (testProgress.tone === 'bad') lessonTestsFailed += 1;
              if (testProgress.completed) unitCompletedCount += 1;
            });
            if (lessonTestsCompleted === lessonTests.length) lessonTestsTone = 'good';
            else if (lessonTestsFailed > 0) lessonTestsTone = 'bad';
            else if (lessonTestsCompleted > 0) lessonTestsTone = 'okay';
          }

          snapshot.lessons[this.getReferenceLessonProgressKey(courseCode, unitCode, lessonCode)] = {
            learnDone,
            testsTone: lessonTestsTone,
            hasTests: lessonTests.length > 0
          };

          unitTotalCount += lessonTests.length;
        });

        const unitTests = testUnit && Array.isArray(testUnit.tests_unidad) ? testUnit.tests_unidad : [];
        unitTotalCount += unitTests.length;
        unitTests.forEach((test) => {
          const testKey = this.getReferenceTestKey('unit', test);
          const testProgress = this.getReferenceTestDisplayProgress(test, testKey);
          snapshot.tests[testKey] = testProgress;
          if (testProgress.completed) unitCompletedCount += 1;
        });

        const unitPercent =
          unitTotalCount > 0 ? Math.round((unitCompletedCount * 100) / unitTotalCount) : 0;

        snapshot.units[this.getReferenceUnitProgressKey(courseCode, unitCode)] = {
          percent: unitPercent,
          completed: unitPercent >= 100 && unitTotalCount > 0,
          tone: this.getReferenceAggregateTone(unitPercent)
        };

        courseCompletedCount += unitCompletedCount;
        courseTotalCount += unitTotalCount;
      });

      const coursePercent =
        courseTotalCount > 0 ? Math.round((courseCompletedCount * 100) / courseTotalCount) : 0;

      snapshot.courses[courseCode] = {
        percent: coursePercent,
        completed: coursePercent >= 100 && courseTotalCount > 0,
        tone: this.getReferenceAggregateTone(coursePercent)
      };
    });

    return snapshot;
  }

  getReferenceTestsContext(uiLocale) {
    this.ensureReferenceTestsPersistenceLoaded();
    const selection = getReferenceSelection();
    const { unitTests, lessonTests } = getReferenceTestsForSelection(selection);
    const lessonItems = lessonTests
      .map((test) => ({ scope: 'lesson', test }))
      .sort((a, b) => (a.test.order || 0) - (b.test.order || 0) || String(a.test.code).localeCompare(String(b.test.code)));
    const unitItems = unitTests
      .map((test) => ({ scope: 'unit', test }))
      .sort((a, b) => (a.test.order || 0) - (b.test.order || 0) || String(a.test.code).localeCompare(String(b.test.code)));
    const allItems = [...lessonItems, ...unitItems];
    const activeKeySet = new Set(allItems.map((item) => this.getReferenceTestKey(item.scope, item.test)));
    if (!this.referenceTestSelectionKey || !activeKeySet.has(this.referenceTestSelectionKey)) {
      const defaultItem = lessonItems[0] || unitItems[0] || null;
      this.referenceTestSelectionKey = defaultItem
        ? this.getReferenceTestKey(defaultItem.scope, defaultItem.test)
        : '';
    }
    const activeItem =
      allItems.find((item) => this.getReferenceTestKey(item.scope, item.test) === this.referenceTestSelectionKey) ||
      null;
    const copy = getReferenceCopy(uiLocale);
    return {
      copy,
      loadInfo: getReferenceTestsLoadInfo(),
      lessonItems,
      unitItems,
      allItems,
      activeItem
    };
  }

  getReferenceScoreTone(percent) {
    const value = Number.isFinite(Number(percent)) ? Number(percent) : 0;
    if (this.isReferenceTestPassingScore(value)) return 'good';
    if (value >= 60) return 'okay';
    return 'bad';
  }

  playReferenceResultSound(tone) {
    const normalizedTone = String(tone || '').trim().toLowerCase();
    const soundKey =
      normalizedTone === 'good'
        ? 'green'
        : normalizedTone === 'okay'
          ? 'yellow'
          : normalizedTone === 'bad'
            ? 'red'
            : '';
    if (!soundKey) return;
    if (typeof window.playSpeakUiSound === 'function') {
      window.playSpeakUiSound(soundKey, { minGapMs: 150, forceRestart: true }).catch(() => {});
    }
  }

  awardDiamondForReferenceTest(testKey, options = {}) {
    const normalizedKey = String(testKey || '').trim();
    if (!normalizedKey) return null;
    const rewardStore = this.getReferenceRewardStore();
    const entryId = `${REFERENCE_TEST_REWARD_ENTRY_PREFIX}:${normalizedKey}`;
    if (rewardStore[entryId]) return null;
    const now = Date.now();
    rewardStore[entryId] = {
      rewardQty: REFERENCE_TEST_DIAMOND_REWARD_QTY,
      rewardLabel: REFERENCE_TEST_DIAMOND_REWARD_LABEL,
      rewardIcon: REFERENCE_TEST_DIAMOND_REWARD_ICON,
      ts: now,
      source: 'reference-test'
    };
    this.persistReferenceRewardStore();
    this.queueReferenceRewardEvent(entryId, rewardStore[entryId], options.reason || 'reference-test-complete');
    this.notifyReferenceRewardStoreChange();
    return {
      entryId,
      rewardQty: REFERENCE_TEST_DIAMOND_REWARD_QTY,
      rewardLabel: REFERENCE_TEST_DIAMOND_REWARD_LABEL,
      rewardIcon: REFERENCE_TEST_DIAMOND_REWARD_ICON
    };
  }

  renderReferenceTestQuestion(question, testKey, testState, result, copy, uiLocale) {
    const questionCode = String(question.code || '');
    const questionLabel = this.formatReferenceCopy(copy.testsQuestionLabel, {
      n: ''
    });
    const checked = Boolean(testState.checked);
    const explanation = this.getLocalizedTestText(question.explanation, uiLocale);
    const response = testState.responses[questionCode];
    const interaction = String(question.interaction || '').trim().toLowerCase();
    let bodyMarkup = '';

    if (interaction === 'multiple_choice') {
      const selectedCode = String(response || '').trim();
      bodyMarkup = `
        <p class="reference-test-question-text">${this.escapeHtml(question.text || '')}</p>
        <div class="reference-test-options">
          ${(Array.isArray(question.options) ? question.options : [])
            .map((option) => {
              const optionCode = String(option.code || '');
              const isChecked = selectedCode === optionCode;
              const optionStatusClass = checked
                ? option.correct
                  ? 'is-correct'
                  : isChecked
                    ? 'is-incorrect'
                    : ''
                : '';
              return `
                <label class="reference-test-option ${optionStatusClass}">
                  <input
                    type="radio"
                    name="reference-test-${this.escapeHtml(testKey)}-${this.escapeHtml(questionCode)}"
                    value="${this.escapeHtml(optionCode)}"
                    data-action="reference-test-choice"
                    data-test-key="${this.escapeHtml(testKey)}"
                    data-question-code="${this.escapeHtml(questionCode)}"
                    ${isChecked ? 'checked' : ''}
                  >
                  <span>${this.escapeHtml(option.text || '')}</span>
                </label>
              `;
            })
            .join('')}
        </div>
      `;
    } else if (interaction === 'reorder_words') {
      const sourceTokens = this.parseReferenceReorderTokens(question.text);
      const answerTokens = Array.isArray(response) ? response.slice() : [];
      const usage = new Map();
      answerTokens.forEach((token) => {
        const key = String(token);
        usage.set(key, (usage.get(key) || 0) + 1);
      });
      const poolTokens = [];
      sourceTokens.forEach((token) => {
        const key = String(token);
        const usedCount = usage.get(key) || 0;
        if (usedCount > 0) {
          usage.set(key, usedCount - 1);
          return;
        }
        poolTokens.push(token);
      });
      bodyMarkup = `
        <div class="reference-test-reorder">
          <div class="reference-test-reorder-answer ${checked ? (result.correct ? 'is-correct' : 'is-incorrect') : ''}">
            ${answerTokens.length
              ? answerTokens
                  .map(
                    (token, index) => `
                      <button
                        type="button"
                        class="reference-test-token is-answer"
                        data-action="reference-test-reorder-remove"
                        data-test-key="${this.escapeHtml(testKey)}"
                        data-question-code="${this.escapeHtml(questionCode)}"
                        data-token-index="${index}"
                      >${this.escapeHtml(token)}</button>
                    `
                  )
                  .join('')
              : `<span class="reference-test-reorder-placeholder">${this.escapeHtml(
                  copy.testsTapWords
                )}</span>`}
          </div>
          <div class="reference-test-reorder-pool">
            ${poolTokens
              .map(
                (token, index) => `
                  <button
                    type="button"
                    class="reference-test-token"
                    data-action="reference-test-reorder-add"
                    data-test-key="${this.escapeHtml(testKey)}"
                    data-question-code="${this.escapeHtml(questionCode)}"
                    data-token-index="${index}"
                    data-token-value="${this.escapeHtml(token)}"
                  >${this.escapeHtml(token)}</button>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    } else {
      const slotCount = this.getReferenceQuestionSlotCount(question);
      const values = Array.from({ length: slotCount }, (_unused, index) =>
        Array.isArray(response) && response[index] !== undefined ? String(response[index] || '') : ''
      );
      bodyMarkup = this.buildReferenceQuestionInputs(question, testKey, values, copy, {
        checked,
        correct: result.correct
      });
    }

    return `
      <div class="reference-test-question ${checked ? (result.correct ? 'is-correct' : 'is-incorrect') : ''}">
        <div class="reference-test-question-head">
          <span class="pill reference-test-question-pill">${this.escapeHtml(questionLabel.trim())}</span>
          ${
            checked
              ? `<span class="reference-test-status ${result.correct ? 'is-correct' : 'is-incorrect'}">${this.escapeHtml(
                  result.correct ? copy.testsCorrect : copy.testsIncorrect
                )}</span>`
              : ''
          }
        </div>
        ${bodyMarkup}
        ${
          checked
            ? `
              <div class="reference-test-feedback">
                <div class="reference-test-feedback-row">
                  <strong>${this.escapeHtml(copy.testsYourAnswer)}</strong>
                  <span>${this.escapeHtml(result.userDisplay || copy.testsNoAnswer)}</span>
                </div>
                <div class="reference-test-feedback-row">
                  <strong>${this.escapeHtml(copy.testsCorrectAnswer)}</strong>
                  <span>${this.escapeHtml(result.correctDisplay || copy.testsNoAnswer)}</span>
                </div>
                ${
                  explanation
                    ? `<div class="reference-test-explanation"><strong>${this.escapeHtml(
                        copy.testsExplanation
                      )}</strong><span>${this.escapeHtml(explanation)}</span></div>`
                    : ''
                }
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  renderReferenceTestsSection(uiLocale) {
    const sectionEl = this.querySelector('#reference-tests-section');
    if (!sectionEl) return;
    const context = this.getReferenceTestsContext(uiLocale);
    const progressSnapshot = this.buildReferenceProgressSnapshot(getReferenceCourses());
    const { copy, loadInfo, lessonItems, unitItems, allItems, activeItem } = context;

    if (loadInfo.status === 'loading' && !allItems.length) {
      sectionEl.innerHTML = `
        <div class="reference-tests-shell">
          <div class="pill">${this.escapeHtml(copy.lessonTabTests)}</div>
          <div class="reference-empty">${this.escapeHtml(copy.testsLoading)}</div>
        </div>
      `;
      return;
    }

    if (loadInfo.status === 'error' && !allItems.length) {
      sectionEl.innerHTML = `
        <div class="reference-tests-shell">
          <div class="pill">${this.escapeHtml(copy.lessonTabTests)}</div>
          <div class="reference-empty">${this.escapeHtml(copy.testsLoadError)}</div>
        </div>
      `;
      return;
    }

    if (!allItems.length) {
      sectionEl.innerHTML = `
        <div class="reference-tests-shell">
          <div class="pill">${this.escapeHtml(copy.lessonTabTests)}</div>
          <div class="reference-empty">${this.escapeHtml(copy.testsEmpty)}</div>
        </div>
      `;
      return;
    }

    const activeTestKey = activeItem ? this.getReferenceTestKey(activeItem.scope, activeItem.test) : '';
    const activeTest = activeItem ? activeItem.test : null;
    const activeState = activeTestKey ? this.getReferenceTestState(activeTestKey) : { responses: {}, checked: false };
    const evaluation = activeTest ? this.evaluateReferenceTest(activeTest, activeTestKey) : null;
    const activeDisplay = activeTest ? this.getLocalizedTestText(activeTest.display, uiLocale) || `Test ${activeTest.code}` : '';
    const activeInstruction =
      activeTest && activeTest.header
        ? this.getLocalizedTestText(activeTest.header.instruction, uiLocale)
        : '';
    const activeProgress = activeTest
      ? progressSnapshot.tests[activeTestKey] || this.getReferenceTestDisplayProgress(activeTest, activeTestKey)
      : null;
    const wordBank =
      activeTest && activeTest.header && activeTest.header.word_bank
        ? activeTest.header.word_bank[uiLocale] || activeTest.header.word_bank.en || activeTest.header.word_bank.es || []
        : [];
    const renderItemGroup = (label, items) => {
      if (!items.length) return '';
      return `
        <div class="reference-tests-group">
          <div class="reference-tests-group-label">${this.escapeHtml(label)}</div>
          <div class="reference-tests-list">
            ${items
              .map((item) => {
                const itemKey = this.getReferenceTestKey(item.scope, item.test);
                const itemTitle = this.getLocalizedTestText(item.test.display, uiLocale) || `Test ${item.test.code}`;
                const itemProgress =
                  progressSnapshot.tests[itemKey] || this.getReferenceTestDisplayProgress(item.test, itemKey);
                const questionsLabel = this.formatReferenceCopy(copy.testsQuestions, {
                  n: Array.isArray(item.test.questions) ? item.test.questions.length : 0
                });
                return `
                  <button
                    type="button"
                    class="reference-test-chip ${itemKey === activeTestKey ? 'is-active' : ''} ${
                      itemProgress.completed ? 'is-complete' : ''
                    }"
                    data-action="select-reference-test"
                    data-test-key="${this.escapeHtml(itemKey)}"
                  >
                    <span class="reference-test-chip-title-row">
                      <span class="reference-test-chip-title">${this.escapeHtml(itemTitle)}</span>
                      ${this.renderReferenceProgressPill(itemProgress.percent, itemProgress.tone, {
                        compact: true,
                        ariaLabel: `${itemTitle}: ${itemProgress.percent}%`
                      })}
                      ${
                        itemProgress.completed
                          ? `<span class="reference-test-chip-complete" aria-hidden="true"><ion-icon name="checkmark-circle"></ion-icon></span>`
                          : ''
                      }
                    </span>
                    <span class="reference-test-chip-meta">${this.escapeHtml(questionsLabel)}</span>
                    <span class="reference-test-chip-progress">
                      <span class="reference-test-chip-progress-fill" style="width:${Math.round(
                        itemProgress.progressRatio * 100
                      )}%"></span>
                    </span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    };

    sectionEl.innerHTML = `
      <div class="reference-tests-shell">
        ${renderItemGroup(copy.lessonTests, lessonItems)}
        ${renderItemGroup(copy.unitTests, unitItems)}
        ${
          activeTest
            ? `
              <div class="reference-test-card">
                <div class="reference-test-card-head">
                  <div class="pill">${this.escapeHtml(copy.testsSelectedTest)}</div>
                  <div class="reference-test-card-meta">${this.escapeHtml(
                    this.formatReferenceCopy(copy.testsQuestions, {
                      n: evaluation ? evaluation.total : 0
                    })
                  )}</div>
                </div>
                <h4 class="reference-test-card-title">${this.escapeHtml(activeDisplay)}</h4>
                ${
                  activeInstruction
                    ? `<p class="reference-test-card-instruction">${this.escapeHtml(activeInstruction)}</p>`
                    : ''
                }
                ${
                  Array.isArray(wordBank) && wordBank.length
                    ? `
                      <div class="reference-test-word-bank">
                        <div class="reference-test-word-bank-label">${this.escapeHtml(
                          copy.testsWordBank
                        )}</div>
                        <div class="reference-test-word-bank-items">
                          ${wordBank
                            .map(
                              (word) => `
                                <button
                                  type="button"
                                  class="reference-test-token is-word-bank"
                                  data-action="reference-test-word-bank"
                                  data-test-key="${this.escapeHtml(activeTestKey)}"
                                  data-word="${this.escapeHtml(word)}"
                                >${this.escapeHtml(word)}</button>
                              `
                            )
                            .join('')}
                        </div>
                      </div>
                    `
                    : ''
                }
                ${
                  activeProgress
                    ? `<div class="reference-test-summary ${activeProgress.completed ? 'is-complete' : ''}">${this.escapeHtml(
                        `${copy.testsResult} · ${
                          activeProgress.checked ? activeProgress.correctCount : activeProgress.answeredCount
                        }/${activeProgress.total}`
                      )}</div>`
                    : ''
                }
                <div class="reference-test-questions">
                  ${(Array.isArray(activeTest.questions) ? activeTest.questions : [])
                    .map((question, index) =>
                      this.renderReferenceTestQuestion(
                        {
                          ...question,
                          _position: index + 1
                        },
                        activeTestKey,
                        activeState,
                        evaluation && evaluation.results[index]
                          ? evaluation.results[index]
                          : { correct: false, userDisplay: '', correctDisplay: '' },
                        {
                          ...copy,
                          testsQuestionLabel: this.formatReferenceCopy(
                            copy.testsQuestionLabel,
                            { n: index + 1 }
                          )
                        },
                        uiLocale
                      )
                    )
                    .join('')}
                </div>
                <div class="reference-test-actions">
                  <button type="button" class="reference-test-btn is-primary" data-action="check-reference-test" data-test-key="${this.escapeHtml(
                    activeTestKey
                  )}">${this.escapeHtml(copy.testsCheck)}</button>
                  <button type="button" class="reference-test-btn" data-action="reset-reference-test" data-test-key="${this.escapeHtml(
                    activeTestKey
                  )}">${this.escapeHtml(copy.testsReset)}</button>
                </div>
              </div>
            `
            : `<div class="reference-empty">${this.escapeHtml(copy.testsPickOne)}</div>`
        }
      </div>
    `;

    this.bindReferenceTestsEvents(uiLocale);
  }

  bindReferenceTestsEvents(uiLocale) {
    const sectionEl = this.querySelector('#reference-tests-section');
    if (!sectionEl) return;

    const getActiveTestContext = () => this.getReferenceTestsContext(uiLocale);

    sectionEl.onclick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const actionEl = target ? target.closest('[data-action]') : null;
      if (!actionEl) return;
      const action = String(actionEl.getAttribute('data-action') || '').trim();
      if (!action) return;

      if (action === 'select-reference-test') {
        event.preventDefault();
        this.referenceTestSelectionKey = String(actionEl.getAttribute('data-test-key') || '').trim();
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
        return;
      }

      if (action === 'check-reference-test') {
        event.preventDefault();
        const testKey = String(actionEl.getAttribute('data-test-key') || '').trim();
        if (!testKey) return;
        const { activeItem } = getActiveTestContext();
        if (!activeItem || this.getReferenceTestKey(activeItem.scope, activeItem.test) !== testKey) return;
        const state = this.getReferenceTestState(testKey);
        const previousProgress = this.getReferenceTestDisplayProgress(activeItem.test, testKey);
        state.checked = true;
        state.lastCheckedAt = Date.now();
        const nextProgress = this.getReferenceTestDisplayProgress(activeItem.test, testKey);
        const percent = Number(nextProgress.percent) || 0;
        const tone = nextProgress.tone || this.getReferenceScoreTone(percent);
        if (!previousProgress.completed && nextProgress.completed) {
          this.awardDiamondForReferenceTest(testKey, { reason: 'reference-test-complete' });
        }
        this.playReferenceResultSound(tone);
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
        this.pendingReferenceUnitRewardPopup = { reason: 'reference-test-check' };
        this.pendingReferenceCourseBadgePopup = { reason: 'reference-test-check' };
        this.syncReferenceTestResult(activeItem.test, nextProgress).catch(() => {});
        return;
      }

      if (action === 'reset-reference-test') {
        event.preventDefault();
        const testKey = String(actionEl.getAttribute('data-test-key') || '').trim();
        if (!testKey) return;
        this.clearReferenceTestState(testKey);
        if (this.referenceTestFocus.testKey === testKey) {
          this.referenceTestFocus = { testKey: '', questionCode: '', inputIndex: 0 };
        }
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
        return;
      }

      if (action === 'reference-test-reorder-add') {
        event.preventDefault();
        const testKey = String(actionEl.getAttribute('data-test-key') || '').trim();
        const questionCode = String(actionEl.getAttribute('data-question-code') || '').trim();
        const tokenValue = String(actionEl.getAttribute('data-token-value') || '').trim();
        if (!testKey || !questionCode || !tokenValue) return;
        const state = this.getReferenceTestState(testKey);
        const current = Array.isArray(state.responses[questionCode]) ? state.responses[questionCode].slice() : [];
        current.push(tokenValue);
        state.responses[questionCode] = current;
        this.clearReferenceTestCheckedState(state);
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
        return;
      }

      if (action === 'reference-test-reorder-remove') {
        event.preventDefault();
        const testKey = String(actionEl.getAttribute('data-test-key') || '').trim();
        const questionCode = String(actionEl.getAttribute('data-question-code') || '').trim();
        const tokenIndex = Number(actionEl.getAttribute('data-token-index'));
        if (!testKey || !questionCode || !Number.isFinite(tokenIndex)) return;
        const state = this.getReferenceTestState(testKey);
        const current = Array.isArray(state.responses[questionCode]) ? state.responses[questionCode].slice() : [];
        if (tokenIndex < 0 || tokenIndex >= current.length) return;
        current.splice(tokenIndex, 1);
        state.responses[questionCode] = current;
        this.clearReferenceTestCheckedState(state);
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
        return;
      }

      if (action === 'reference-test-word-bank') {
        event.preventDefault();
        const testKey = String(actionEl.getAttribute('data-test-key') || '').trim();
        const word = String(actionEl.getAttribute('data-word') || '').trim();
        if (!testKey || !word) return;
        const { activeItem } = getActiveTestContext();
        if (!activeItem || this.getReferenceTestKey(activeItem.scope, activeItem.test) !== testKey) return;
        const state = this.getReferenceTestState(testKey);
        const focusQuestionCode =
          this.referenceTestFocus.testKey === testKey ? this.referenceTestFocus.questionCode : '';
        const focusInputIndex =
          this.referenceTestFocus.testKey === testKey ? Number(this.referenceTestFocus.inputIndex) || 0 : 0;
        let targetQuestion = null;
        let targetIndex = 0;
        const questions = Array.isArray(activeItem.test.questions) ? activeItem.test.questions : [];
        if (focusQuestionCode) {
          targetQuestion = questions.find((question) => String(question.code) === focusQuestionCode) || null;
          if (targetQuestion) {
            targetIndex = focusInputIndex;
          }
        }
        if (!targetQuestion) {
          targetQuestion =
            questions.find((question) => {
              const interaction = String(question.interaction || '').trim().toLowerCase();
              return interaction === 'fill_from_word_bank' || interaction === 'free_text';
            }) || questions[0] || null;
          targetIndex = 0;
        }
        if (!targetQuestion) return;
        const questionCode = String(targetQuestion.code || '');
        const slotCount = this.getReferenceQuestionSlotCount(targetQuestion);
        const currentValues = Array.isArray(state.responses[questionCode])
          ? state.responses[questionCode].slice(0, slotCount)
          : Array.from({ length: slotCount }, () => '');
        while (currentValues.length < slotCount) currentValues.push('');
        if (targetIndex < 0 || targetIndex >= slotCount) {
          targetIndex = currentValues.findIndex((value) => !String(value || '').trim());
          if (targetIndex < 0) targetIndex = 0;
        }
        currentValues[targetIndex] = word;
        state.responses[questionCode] = currentValues;
        this.clearReferenceTestCheckedState(state);
        this.referenceTestFocus = {
          testKey,
          questionCode,
          inputIndex: targetIndex + 1 < slotCount ? targetIndex + 1 : targetIndex
        };
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
      }
    };

    sectionEl.onfocusin = (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target) return;
      const action = String(target.getAttribute('data-action') || '').trim();
      if (action !== 'reference-test-input') return;
      this.referenceTestFocus = {
        testKey: String(target.getAttribute('data-test-key') || '').trim(),
        questionCode: String(target.getAttribute('data-question-code') || '').trim(),
        inputIndex: Number(target.getAttribute('data-input-index')) || 0
      };
    };

    sectionEl.oninput = (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target) return;
      const action = String(target.getAttribute('data-action') || '').trim();
      if (action !== 'reference-test-input') return;
      const testKey = String(target.getAttribute('data-test-key') || '').trim();
      const questionCode = String(target.getAttribute('data-question-code') || '').trim();
      const inputIndex = Number(target.getAttribute('data-input-index')) || 0;
      if (!testKey || !questionCode) return;
      const state = this.getReferenceTestState(testKey);
      const current = Array.isArray(state.responses[questionCode]) ? state.responses[questionCode].slice() : [];
      current[inputIndex] = target.value;
      state.responses[questionCode] = current;
      this.clearReferenceTestCheckedState(state);
      this.referenceTestFocus = {
        testKey,
        questionCode,
        inputIndex
      };
      this.persistReferenceTestsState();
    };

    sectionEl.onchange = (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target) return;
      const action = String(target.getAttribute('data-action') || '').trim();
      if (action === 'reference-test-choice') {
        const testKey = String(target.getAttribute('data-test-key') || '').trim();
        const questionCode = String(target.getAttribute('data-question-code') || '').trim();
        if (!testKey || !questionCode) return;
        const state = this.getReferenceTestState(testKey);
        state.responses[questionCode] = target.value;
        this.clearReferenceTestCheckedState(state);
        this.persistReferenceTestsState();
        return;
      }
      if (action === 'reference-test-input') {
        const testKey = String(target.getAttribute('data-test-key') || '').trim();
        if (!testKey) return;
        this.clearReferenceTestCheckedState(this.getReferenceTestState(testKey));
        this.persistReferenceTestsState();
      }
    };
  }

  render(options = {}) {
    this.stopHeroNarration();
    this.disconnectFloatingHintsObserver();
    this.clearReferenceLessonCompletionTimer();
    const baseLocale = this.getBaseLocale();
    const uiLocale = this.getUiLocale(baseLocale);
    const tabsCopy = getTabsCopy(uiLocale);
    const copy = getReferenceCopy(uiLocale);
    const heroMascotSrc = this.getHeroMascotSrc();
    this.ensureReferenceTestsPersistenceLoaded();

    if (!this._loadingReferenceTests && !this._referenceTestsLoadAttempted) {
      this._loadingReferenceTests = true;
      this._referenceTestsLoadAttempted = true;
      ensureReferenceTestsData()
        .catch((err) => {
          console.warn('[reference-tests] data load failed', err);
        })
        .finally(() => {
          this._loadingReferenceTests = false;
          if (this.isConnected) this.render();
        });
    }

    const courses = getReferenceCourses();
    if (!courses.length) {
      this.innerHTML = `
        ${this.renderHeaderHtml()}
        <ion-content fullscreen class="home-journey secret-content">
          <div class="journey-shell reference-shell">
            <section class="journey-plan-card onboarding-intro-card reference-hero-card">
              <span class="journey-plan-mascot-wrap" aria-hidden="true">
                <img id="reference-hero-mascot" class="onboarding-intro-cat" src="${heroMascotSrc}" alt="">
              </span>
              <div class="journey-plan-body">
                <p class="onboarding-intro-bubble journey-plan-bubble reference-hero-bubble hero-playable-bubble"><span class="journey-plan-bubble-text">${this.escapeHtml(copy.subtitle)}</span></p>
              </div>
            </section>
            <section class="reference-content-card">
              <div class="reference-empty">${this.escapeHtml(copy.loading)}</div>
            </section>
          </div>
        </ion-content>
      `;

      this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
        const nextLocale = getNextLocaleCode(getActiveLocale() || 'en');
        setLocaleOverride(nextLocale);
        if (window.varGlobal && typeof window.varGlobal === 'object') {
          window.varGlobal.locale = nextLocale;
        }
        window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
      });
      this.querySelector('.reference-hero-card')?.addEventListener('click', (event) => {
        if (this.isEventInHeaderZone(event)) return;
        const target = event && event.target instanceof Element ? event.target : null;
        if (!target) return;
        const inNarrationZone = target.closest('.journey-plan-mascot-wrap, .onboarding-intro-bubble, .reference-hero-bubble, .journey-plan-bubble');
        if (!inNarrationZone) return;
        this.playHeroNarration(true).catch(() => {});
      });
      this.updateHeaderRewards();
      this.currentHeroMessage = copy.subtitle;
      this.currentHeroLocale = uiLocale;

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

    if (this.consumePendingReferenceDeepLink(courses)) {
      return;
    }

    if (this.toolView) {
      if (this.activeTool === 'translator') {
        const toolBodyHtml = this.renderTranslatorToolHtml(copy, uiLocale);
        this.innerHTML = `
          ${this.renderHeaderHtml()}
          <ion-content fullscreen class="home-journey secret-content">
            ${toolBodyHtml}
          </ion-content>
        `;

        this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
          const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
          setAppLocale(nextLocale);
          window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
        });
        this.querySelector('#tool-back-btn')?.addEventListener('click', () => {
          this.toolView = false;
          this.activeTool = '';
          this.expandedToolItemId = null;
          this.toolFilter = 'featured';
          this.render();
        });

        const inputEl = this.querySelector('#translator-input');
        const submitEl = this.querySelector('#translator-submit-btn');
        if (inputEl) {
          inputEl.addEventListener('input', () => {
            this.translatorInput = inputEl.value;
          });
          inputEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            this.translatorInput = inputEl.value;
            this.submitTranslator(uiLocale);
          });
        }
        submitEl?.addEventListener('click', (event) => {
          event.preventDefault();
          this.translatorInput = inputEl ? inputEl.value : this.translatorInput;
          this.submitTranslator(uiLocale);
        });

        const contentListEl = this.querySelector('#tool-content-list');
        if (contentListEl) {
          contentListEl.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            const playZone = target.closest('.tool-expr-play-zone');
            if (playZone) {
              const text = String(playZone.getAttribute('data-play-text') || '').trim();
              const playLang = String(playZone.getAttribute('data-play-lang') || '').trim() || 'en';
              if (text) {
                contentListEl.querySelectorAll('.tool-expr-play-zone.is-playing').forEach((el) => el.classList.remove('is-playing'));
                playZone.classList.add('is-playing');
                this.speakHeroNarration(text, playLang)
                  .catch(() => {})
                  .finally(() => playZone.classList.remove('is-playing'));
              }
              return;
            }

            const conjBtn = target.closest('.conj-btn');
            if (conjBtn) {
              const verbName = conjBtn.getAttribute('data-verb');
              if (verbName) this.openConjugationSheet(verbName, uiLocale);
            }
          });
        }

        this.updateHeaderRewards();
        return;
      }

      if (this.activeTool === 'articles' || this.activeTool === 'cheatsheets') {
        const ARTICLE_UNIT_CODES = new Set([10053, 10054, 10055, 10056]);
        const specialCourses = getReferenceSpecialCourses();
        const articlesCourse = specialCourses.find((c) => c.typeCourse === 2) || null;
        const allUnits = articlesCourse ? (articlesCourse.unidades || []) : [];
        const units = this.activeTool === 'articles'
          ? allUnits.filter((u) => ARTICLE_UNIT_CODES.has(u.code))
          : allUnits.filter((u) => !ARTICLE_UNIT_CODES.has(u.code));
        const toolTitle = this.activeTool === 'articles'
          ? (copy.toolArticles || 'Articles')
          : (copy.toolCheatSheets || 'Cheat sheets');
        const toolBodyHtml = this.renderArticlesToolHtml(units, toolTitle, copy, uiLocale);
        this.innerHTML = `
          ${this.renderHeaderHtml()}
          <ion-content fullscreen class="home-journey secret-content">
            ${toolBodyHtml}
          </ion-content>
        `;
        this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
          const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
          setAppLocale(nextLocale);
          window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
        });
        this.querySelector('#tool-back-btn')?.addEventListener('click', () => {
          if (this.activeArticleLessonCode !== null) {
            this.activeArticleLessonCode = null;
          } else {
            this.toolView = false;
            this.activeTool = '';
          }
          this.render();
        });
        this.querySelector('#tool-content-list')?.addEventListener('click', (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          const lessonItem = target.closest('.articles-lesson-item');
          if (lessonItem) {
            this.activeArticleLessonCode = Number(lessonItem.getAttribute('data-lesson-code'));
            this.render();
          }
        });
        this.updateHeaderRewards();
        return;
      }

      const toolData = this.toolsDataCache[this.activeTool];
      if (!toolData) {
        this.innerHTML = `
          ${this.renderHeaderHtml()}
          <ion-content fullscreen class="home-journey secret-content">
            <div class="journey-shell reference-shell tool-view-shell">
              <div class="tool-view-header">
                <button class="tool-back-btn" id="tool-back-btn">
                  <ion-icon name="arrow-back" aria-hidden="true"></ion-icon>
                  <span>${this.escapeHtml(copy.backToList)}</span>
                </button>
              </div>
              <div class="tool-loading">${this.escapeHtml(copy.loading)}</div>
            </div>
          </ion-content>
        `;
        this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
          const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
          setAppLocale(nextLocale);
          window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
        });
        this.querySelector('#tool-back-btn')?.addEventListener('click', () => {
          this.toolView = false;
          this.activeTool = '';
          this.expandedToolItemId = null;
          this.render();
        });
        this.updateHeaderRewards();
        this.loadToolData(this.activeTool)
          .then(() => { if (this.isConnected) this.render(); })
          .catch((err) => console.warn('[tools] data load failed', err));
        return;
      }

      let toolBodyHtml = '';
      switch (this.activeTool) {
        case 'translator':
          toolBodyHtml = this.renderTranslatorToolHtml(copy, uiLocale);
          break;
        case 'expressions':
          toolBodyHtml = this.renderExpressionsToolHtml(toolData, copy, uiLocale);
          break;
        case 'proverbs':
          toolBodyHtml = this.renderProverbsToolHtml(toolData, copy, uiLocale);
          break;
        case 'regverbs':
          toolBodyHtml = this.renderVerbsToolHtml(toolData.regverbs, copy, uiLocale);
          break;
        case 'irregverbs':
          toolBodyHtml = this.renderVerbsToolHtml(toolData.irregverbs, copy, uiLocale);
          break;
        case 'quotes':
          toolBodyHtml = this.renderQuotesToolHtml(toolData, copy, uiLocale);
          break;
        case 'phrasalverbs':
          toolBodyHtml = this.renderPhrasalVerbsToolHtml(toolData, copy, uiLocale);
          break;
        case 'vocabs':
          toolBodyHtml = this.renderVocabsToolHtml(toolData, copy, uiLocale);
          break;
        default:
          break;
      }

      this.innerHTML = `
        ${this.renderHeaderHtml()}
        <ion-content fullscreen class="home-journey secret-content">
          ${toolBodyHtml}
        </ion-content>
      `;

      this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
        const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
        setAppLocale(nextLocale);
        window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
      });
      this.querySelector('#tool-back-btn')?.addEventListener('click', () => {
        this.toolView = false;
        this.activeTool = '';
        this.expandedToolItemId = null;
        this.toolFilter = 'featured';
        this.activeArticleUnitCode = null;
        this.activeArticleLessonCode = null;
        this.render();
      });
      this.querySelectorAll('[data-tool-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextFilter = String(btn.getAttribute('data-tool-filter') || '').trim();
          if (!nextFilter || this.toolFilter === nextFilter) return;
          this.toolFilter = nextFilter;
          this.expandedToolItemId = null;
          this.render();
        });
      });
      this.querySelectorAll('.tool-letter-nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const letter = btn.getAttribute('data-tool-letter');
          const sectionEl = this.querySelector(`#tool-section-${letter}`);
          if (!sectionEl) return;
          const ionContent = this.querySelector('ion-content');
          if (ionContent && typeof ionContent.getScrollElement === 'function') {
            ionContent.getScrollElement().then((scrollEl) => {
              if (!scrollEl) return;
              const stickyHeaderEl = this.querySelector('.tool-sticky-header');
              const stickyBottom = stickyHeaderEl ? stickyHeaderEl.getBoundingClientRect().bottom : 0;
              const targetTop = scrollEl.scrollTop + sectionEl.getBoundingClientRect().top - stickyBottom - 8;
              scrollEl.scrollTo({ top: targetTop, behavior: 'smooth' });
            }).catch(() => {});
          }
        });
      });
      const contentListEl = this.querySelector('#tool-content-list');
      if (contentListEl) {
        contentListEl.addEventListener('click', (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;

          // Play zone (name/translation/example) → play audio
          const playZone = target.closest('.tool-expr-play-zone');
          if (playZone) {
            const text = String(playZone.getAttribute('data-play-text') || '').trim();
            const playLang = String(playZone.getAttribute('data-play-lang') || '').trim() || 'en';
            if (text) {
              contentListEl.querySelectorAll('.tool-expr-play-zone.is-playing').forEach((el) => el.classList.remove('is-playing'));
              playZone.classList.add('is-playing');
              this.speakHeroNarration(text, playLang)
                .catch(() => {})
                .finally(() => playZone.classList.remove('is-playing'));
            }
            return;
          }

          // Conjugate button → open bottom sheet
          const conjBtn = target.closest('.conj-btn');
          if (conjBtn) {
            const verbName = conjBtn.getAttribute('data-verb');
            if (verbName) this.openConjugationSheet(verbName, uiLocale);
            return;
          }

          // Expand button → toggle in-place
          const expandBtn = target.closest('.tool-expr-expand-btn');
          if (expandBtn) {
            const itemEl = expandBtn.closest('.tool-expr-item');
            if (!itemEl) return;
            const id = Number(itemEl.getAttribute('data-tool-item-id'));
            const isOpen = itemEl.classList.contains('is-open');
            // Close any currently open item
            const prevOpen = contentListEl.querySelector('.tool-expr-item.is-open');
            if (prevOpen && prevOpen !== itemEl) {
              prevOpen.classList.remove('is-open');
              prevOpen.querySelector('.tool-expr-example')?.remove();
              const prevChevron = prevOpen.querySelector('.tool-expr-chevron');
              if (prevChevron) prevChevron.setAttribute('name', 'chevron-down');
            }
            if (isOpen) {
              itemEl.classList.remove('is-open');
              itemEl.querySelector('.tool-expr-example')?.remove();
              const chevron = itemEl.querySelector('.tool-expr-chevron');
              if (chevron) chevron.setAttribute('name', 'chevron-down');
              this.expandedToolItemId = null;
            } else {
              itemEl.classList.add('is-open');
              const chevron = itemEl.querySelector('.tool-expr-chevron');
              if (chevron) chevron.setAttribute('name', 'chevron-up');
              const expandHtml = this.buildToolExpandHtml(id, toolData, uiLocale);
              if (expandHtml) {
                const exDiv = document.createElement('div');
                exDiv.className = 'tool-expr-example';
                exDiv.innerHTML = expandHtml;
                itemEl.appendChild(exDiv);
              }
              this.expandedToolItemId = id;
            }
          }
        });
      }
      // Vocab image skeleton handling
      if (this.activeTool === 'vocabs') {
        this.querySelectorAll('.tool-vocab-img').forEach((img) => {
          if (img.classList.contains('is-loaded')) return;
          const skeleton = img.previousElementSibling;
          const applyLoaded = () => {
            img.classList.add('is-loaded');
            this.vocabImageCache.add(img.src);
            if (skeleton) skeleton.classList.add('is-hidden');
          };
          if (img.complete && img.naturalWidth > 0) {
            applyLoaded();
          } else {
            img.addEventListener('load', applyLoaded, { once: true });
            img.addEventListener('error', () => {
              img.style.display = 'none';
            }, { once: true });
          }
        });
      }

      this.updateHeaderRewards();
      return;
    }

    const progressSnapshot = this.buildReferenceProgressSnapshot(courses);
    const referenceTestsLoadInfo = getReferenceTestsLoadInfo();
    const canSyncReferenceAwards = referenceTestsLoadInfo.status === 'ok';
    if (canSyncReferenceAwards) {
      this.syncReferenceUnitRewardsFromSnapshot(progressSnapshot, courses, {
        uiLocale,
        showPopup: Boolean(this.pendingReferenceUnitRewardPopup) && !this.pendingReferenceCourseBadgePopup,
        syncRemote: true,
        reason:
          this.pendingReferenceUnitRewardPopup && this.pendingReferenceUnitRewardPopup.reason
            ? this.pendingReferenceUnitRewardPopup.reason
            : 'reference-progress-refresh'
      });
      this.pendingReferenceUnitRewardPopup = null;
      this.syncReferenceCourseBadgesFromSnapshot(progressSnapshot, courses, {
        uiLocale,
        showPopup: Boolean(this.pendingReferenceCourseBadgePopup),
        syncRemote: true,
        reason:
          this.pendingReferenceCourseBadgePopup && this.pendingReferenceCourseBadgePopup.reason
            ? this.pendingReferenceCourseBadgePopup.reason
            : 'reference-progress-refresh'
      });
      this.pendingReferenceCourseBadgePopup = null;
    }

    const { course: selectedCourse, unit: selectedUnit, lesson: selectedLesson } = resolveReferenceSelection(
      getReferenceSelection()
    );
    if (!selectedCourse || !selectedUnit || !selectedLesson) return;

    const selectedCourseCode = String(selectedCourse.code);
    const selectedUnitCode = String(selectedUnit.code);
    const selectedLessonCode = String(selectedLesson.code);

    if (!this._accordionInitialized) {
      this._accordionInitialized = true;
      this.expandedCourseCode = selectedCourseCode;
      this.expandedUnitCode = selectedUnitCode;
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
      const doOpen = () => {
        this.expandedCourseCode = String(lessonRef.courseCode);
        this.expandedUnitCode = String(lessonRef.unitCode);
        this.referenceLessonTab = this.lessonView ? this.getActiveReferenceLessonTab() : 'content';
        this.referenceLessonTabScrollTop = { content: 0, tests: 0 };
        this.lessonView = true;
        setReferenceSelection({
          courseCode: String(lessonRef.courseCode),
          unitCode: String(lessonRef.unitCode),
          lessonCode: String(lessonRef.lessonCode)
        });
        this.render();
      };
      if (!this.lessonView) {
        const ionContent = this.querySelector('ion-content');
        if (ionContent && typeof ionContent.getScrollElement === 'function') {
          ionContent.getScrollElement().then((el) => {
            this._savedScrollTop = el ? el.scrollTop : 0;
            doOpen();
          }).catch(() => {
            this._savedScrollTop = 0;
            doOpen();
          });
        } else {
          this._savedScrollTop = 0;
          doOpen();
        }
      } else {
        doOpen();
      }
    };

    const accordionMarkup = courses
      .map((course) => {
        const courseCode = String(course.code);
        const isCourseOpen = courseCode === this.expandedCourseCode;
        const courseTitle = this.getText(course, 'display', uiLocale) || `Course ${courseCode}`;
        const courseSubtitle = this.getSecondaryDisplay(course, uiLocale);
        const courseProgress = progressSnapshot.courses[courseCode] || {
          percent: 0,
          tone: 'neutral'
        };
        const units = Array.isArray(course.unidades) ? course.unidades : [];
        const unitsMarkup = units
          .map((unit) => {
            const unitCode = String(unit.code);
            const isUnitOpen = isCourseOpen && unitCode === this.expandedUnitCode;
            const unitTitle = this.getText(unit, 'display', uiLocale) || `Unit ${unitCode}`;
            const unitSubtitle = this.getSecondaryDisplay(unit, uiLocale);
            const unitProgress =
              progressSnapshot.units[this.getReferenceUnitProgressKey(courseCode, unitCode)] || {
                percent: 0,
                tone: 'neutral'
              };
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
                      const lessonProgress =
                        progressSnapshot.lessons[
                          this.getReferenceLessonProgressKey(courseCode, unitCode, lessonCode)
                        ] || { percent: 0, tone: 'neutral' };
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
                            ${
                              lessonSubtitle
                                ? `<div class="module-sub reference-lesson-sub">${this.escapeHtml(lessonSubtitle)}</div>`
                                : ''
                            }
                          </div>
                          ${this.renderReferenceLessonDots(lessonProgress)}
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
                    ${this.renderReferenceProgressPill(unitProgress.percent, unitProgress.tone, {
                      compact: true,
                      ariaLabel: `${unitTitle}: ${unitProgress.percent}%`
                    })}
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
                ${this.renderReferenceProgressPill(courseProgress.percent, courseProgress.tone, {
                  compact: true,
                  extraClass: 'is-course',
                  ariaLabel: `${courseTitle}: ${courseProgress.percent}%`
                })}
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
      this.getText(selectedUnit, 'display', uiLocale)
    ]
      .map((part) => this.escapeHtml(part))
      .join(' · ');
    const activeLessonTab = this.getActiveReferenceLessonTab();

    if (this.lessonView) {
      this.innerHTML = `
        ${this.renderHeaderHtml()}
        <ion-content fullscreen class="home-journey secret-content">
          <div class="journey-shell reference-shell reference-shell--lesson">
            <div class="reference-lesson-sticky">
              <div class="reference-lesson-topbar">
                <button class="reference-back-btn" type="button" id="reference-back-btn">
                  <ion-icon name="chevron-back"></ion-icon>
                  <span>${this.escapeHtml(copy.backToList)}</span>
                </button>
                <div class="reference-lesson-topbar-main">
                  <div class="reference-lesson-title">${this.escapeHtml(
                    this.getText(selectedLesson, 'display', uiLocale) || `Lesson ${selectedLessonCode}`
                  )}</div>
                  <div class="reference-lesson-breadcrumb">${selectedPath}</div>
                </div>
              </div>
              <div class="profile-segmented-tabs reference-lesson-tabs" role="tablist" aria-label="${this.escapeHtml(
                copy.selectedLesson
              )}">
                <button
                  type="button"
                  class="profile-segmented-btn reference-lesson-tab ${activeLessonTab === 'content' ? 'active' : ''}"
                  id="reference-tab-content"
                  data-reference-lesson-tab="content"
                  role="tab"
                  aria-selected="${activeLessonTab === 'content' ? 'true' : 'false'}"
                  aria-controls="reference-content-panel"
                >
                  ${this.escapeHtml(copy.lessonTabContent)}
                </button>
                <button
                  type="button"
                  class="profile-segmented-btn reference-lesson-tab ${activeLessonTab === 'tests' ? 'active' : ''}"
                  id="reference-tab-tests"
                  data-reference-lesson-tab="tests"
                  role="tab"
                  aria-selected="${activeLessonTab === 'tests' ? 'true' : 'false'}"
                  aria-controls="reference-tests-panel"
                >
                  ${this.escapeHtml(copy.lessonTabTests)}
                </button>
              </div>
            </div>

            <div class="reference-lesson-stage" id="reference-lesson-stage">
              <section
                class="reference-lesson-panel reference-lesson-panel--content"
                id="reference-content-panel"
                role="tabpanel"
                aria-labelledby="reference-tab-content"
                ${activeLessonTab === 'content' ? '' : 'hidden'}
              >
                ${
                  lessonContent
                    ? `<div class="reference-markdown" id="reference-markdown-content">${this.renderMarkdownFallbackHtml(
                        lessonContent
                      )}</div>`
                    : `<div class="reference-empty">${this.escapeHtml(copy.noContent)}</div>`
                }
              </section>
              <section
                class="reference-lesson-panel reference-lesson-panel--tests"
                id="reference-tests-panel"
                role="tabpanel"
                aria-labelledby="reference-tab-tests"
                ${activeLessonTab === 'tests' ? '' : 'hidden'}
              >
                <div id="reference-tests-section"></div>
              </section>
            </div>

            <div class="reference-lesson-nav">
              <button class="reference-nav-btn reference-nav-btn--prev ${prevLessonRef ? '' : 'is-hidden'}" type="button" id="reference-prev-btn">
                <ion-icon name="chevron-back"></ion-icon>
                <span>${prevLessonRef ? this.escapeHtml(this.getText(
                  courses.flatMap(c => c.unidades || []).flatMap(u => u.lecciones || []).find(l => String(l.code) === prevLessonRef.lessonCode) || {},
                  'display', uiLocale
                ) || copy.prev) : ''}</span>
              </button>
              <button class="reference-nav-btn reference-nav-btn--next ${nextLessonRef ? '' : 'is-hidden'}" type="button" id="reference-next-btn">
                <span>${nextLessonRef ? this.escapeHtml(this.getText(
                  courses.flatMap(c => c.unidades || []).flatMap(u => u.lecciones || []).find(l => String(l.code) === nextLessonRef.lessonCode) || {},
                  'display', uiLocale
                ) || copy.next) : ''}</span>
                <ion-icon name="chevron-forward"></ion-icon>
              </button>
            </div>
          </div>
        </ion-content>
      `;
    } else {
      const toolsEnabled = this.isReferenceToolsEnabled();
      const activeMainTab = toolsEnabled ? this.referenceMainTab : 'courses';
      const heroSubtitle = toolsEnabled && activeMainTab === 'tools'
        ? copy.toolsSubtitle
        : (copy.subtitle || '');
      const toolItems = [
        { key: 'translator',   label: copy.toolTranslator,   icon: 'language-outline',     iconBg: '#e0f2fe', iconColor: '#0369a1' },
        { key: 'vocabs',       label: copy.toolVocabulary,   icon: 'book-outline',         iconBg: '#dcfce7', iconColor: '#15803d' },
        { key: 'expressions',  label: copy.toolExpressions,  icon: 'chatbubbles-outline',  iconBg: '#dbeafe', iconColor: '#1d4ed8' },
        { key: 'proverbs',     label: copy.toolProverbs,     icon: 'bulb-outline',         iconBg: '#fef9c3', iconColor: '#a16207' },
        { key: 'quotes',       label: copy.toolQuotes,       icon: 'reader-outline',       iconBg: '#f3e8ff', iconColor: '#7e22ce' },
        { key: 'regverbs',     label: copy.toolRegVerbs,     icon: 'create-outline',       iconBg: '#e0e7ff', iconColor: '#4338ca' },
        { key: 'irregverbs',   label: copy.toolIrregVerbs,   icon: 'shuffle-outline',      iconBg: '#ffedd5', iconColor: '#c2410c' },
        { key: 'phrasalverbs', label: copy.toolPhrasalVerbs, icon: 'link-outline',          iconBg: '#fce7f3', iconColor: '#be185d' },
        { key: 'cheatsheets', label: copy.toolCheatSheets, icon: 'document-text-outline',  iconBg: '#f0fdf4', iconColor: '#15803d' },
        { key: 'articles',    label: copy.toolArticles,    icon: 'newspaper-outline',      iconBg: '#ecfdf5', iconColor: '#059669' }
      ];
      const segmentedControlHtml = toolsEnabled ? `
        <div class="profile-segmented-tabs reference-main-tabs" style="margin: -8px 0;">
          <button class="profile-segmented-btn${activeMainTab === 'courses' ? ' active' : ''}" data-reference-main-tab="courses">${this.escapeHtml(copy.tabCourses)}</button>
          <button class="profile-segmented-btn${activeMainTab === 'tools' ? ' active' : ''}" data-reference-main-tab="tools">${this.escapeHtml(copy.tabTools)}</button>
        </div>` : '';
      const toolsListHtml = toolsEnabled && activeMainTab === 'tools' ? `
        <div class="reference-tools-list">
          ${toolItems.map(item => `
            <div class="reference-tool-item" data-reference-tool="${this.escapeHtml(item.key)}">
              <div class="reference-tool-icon-wrap" style="background:${item.iconBg}">
                <ion-icon name="${this.escapeHtml(item.icon)}" style="color:${item.iconColor}" aria-hidden="true"></ion-icon>
              </div>
              <span class="reference-tool-label">${this.escapeHtml(item.label)}</span>
              <ion-icon name="chevron-forward" class="reference-tool-chevron" aria-hidden="true"></ion-icon>
            </div>`).join('')}
        </div>` : '';
      const mainContentHtml = toolsEnabled && activeMainTab === 'tools'
        ? toolsListHtml
        : `<div class="journey-accordion reference-accordion">${accordionMarkup}</div>`;
      this.innerHTML = `
        ${this.renderHeaderHtml()}
        <ion-content fullscreen class="home-journey secret-content">
          <div class="journey-shell reference-shell">
            <section class="journey-plan-card onboarding-intro-card reference-hero-card">
              <span class="journey-plan-mascot-wrap" aria-hidden="true">
                <img id="reference-hero-mascot" class="onboarding-intro-cat" src="${heroMascotSrc}" alt="">
              </span>
              <div class="journey-plan-body">
                <p class="onboarding-intro-bubble journey-plan-bubble reference-hero-bubble hero-playable-bubble"><span class="journey-plan-bubble-text">${this.escapeHtml(heroSubtitle)}</span></p>
              </div>
            </section>

            ${segmentedControlHtml}

            ${mainContentHtml}
          </div>
        </ion-content>
      `;
    }

    this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
      const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
      setAppLocale(nextLocale);
      if (window.varGlobal && typeof window.varGlobal === 'object') {
        window.varGlobal.locale = nextLocale;
      }
      window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
    });
    this.updateHeaderRewards();

    if (this.lessonView) {
      // ── Lesson view listeners ──
      if (lessonContent) {
        this.enhanceMarkdownWithMarked(lessonContent, markdownRenderToken);
      }
      this.renderReferenceTestsSection(uiLocale);
      this.applyReferenceLessonTabUi(activeLessonTab);
      this.startReferenceLessonCompletionTimer({
        courseCode: selectedCourseCode,
        unitCode: selectedUnitCode,
        lessonCode: selectedLessonCode
      });

      this.querySelector('#reference-back-btn')?.addEventListener('click', () => {
        const savedScroll = this._savedScrollTop || 0;
        this.lessonView = false;
        this.render();
        if (savedScroll > 0) {
          const ionContent = this.querySelector('ion-content');
          if (ionContent && typeof ionContent.getScrollElement === 'function') {
            ionContent.getScrollElement().then((el) => {
              if (el) el.scrollTop = savedScroll;
            }).catch(() => {});
          }
        }
      });

      this.querySelector('#reference-prev-btn')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (prevLessonRef) openLesson(prevLessonRef);
      });

      this.querySelector('#reference-next-btn')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (nextLessonRef) openLesson(nextLessonRef);
      });

      this.querySelectorAll('[data-reference-lesson-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          const nextTab =
            String(button.getAttribute('data-reference-lesson-tab') || '').trim() === 'tests'
              ? 'tests'
              : 'content';
          if (this.referenceLessonTab === nextTab) return;
          this.switchReferenceLessonTab(nextTab);
        });
      });

      // ── Floating hints + swipe + tap edge ──
      const lessonCardEl = this.querySelector('#reference-lesson-stage');
      const floatingHintsEl = this.querySelector('.reference-page-hints');
      const ionContentEl = this.querySelector('ion-content');
      const hasDirectionalHints = Boolean(prevLessonRef || nextLessonRef);
      const SWIPE_DRAG_THRESHOLD = 10;
      const SWIPE_COMMIT_THRESHOLD = 56;
      const SWIPE_VERTICAL_RATIO = 1.2;
      const TAP_EDGE_ZONE_RATIO = 0.25;
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
        if (!viewportHeight) return false;
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        return visibleHeight / viewportHeight >= 0.5;
      };
      const isInteractiveTarget = (target) => {
        if (!(target instanceof Element)) return false;
        return Boolean(
          target.closest(
            'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-action]'
          )
        );
      };
      if (floatingHintsEl && hasDirectionalHints && lessonCardEl) {
        const applyVisibility = (visible) => {
          floatingHintsEl.classList.toggle('is-card-visible', Boolean(visible));
        };
        const observer = new IntersectionObserver(
          () => { applyVisibility(isLessonCardVisible()); },
          { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
        );
        observer.observe(lessonCardEl);
        this._floatingHintsObserver = observer;
        applyVisibility(isLessonCardVisible());
      }
      ionContentEl?.addEventListener('touchstart', (event) => {
        if (!event.touches || event.touches.length !== 1) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (isInteractiveTarget(target)) return;
        const touch = event.touches[0];
        swipeTouchActive = true;
        swipeTouchHorizontal = false;
        swipeTouchBlocked = false;
        swipeTouchStartX = touch.clientX;
        swipeTouchStartY = touch.clientY;
        swipeTouchCurrentX = touch.clientX;
      }, { passive: true });
      ionContentEl?.addEventListener('touchmove', (event) => {
        if (!swipeTouchActive || !event.touches || event.touches.length !== 1) return;
        const touch = event.touches[0];
        const dx = touch.clientX - swipeTouchStartX;
        const dy = touch.clientY - swipeTouchStartY;
        if (!swipeTouchHorizontal && !swipeTouchBlocked) {
          if (Math.abs(dx) < SWIPE_DRAG_THRESHOLD && Math.abs(dy) < SWIPE_DRAG_THRESHOLD) return;
          if (Math.abs(dx) < Math.abs(dy) * SWIPE_VERTICAL_RATIO) { swipeTouchBlocked = true; return; }
          swipeTouchHorizontal = true;
        }
        if (!swipeTouchHorizontal) return;
        swipeTouchCurrentX = touch.clientX;
        if (event.cancelable) event.preventDefault();
      }, { passive: false });
      ionContentEl?.addEventListener('touchend', () => {
        if (!swipeTouchActive) return;
        swipeTouchActive = false;
        if (!swipeTouchHorizontal) { swipeTouchBlocked = false; return; }
        const dx = swipeTouchCurrentX - swipeTouchStartX;
        const absDx = Math.abs(dx);
        swipeTouchHorizontal = false;
        swipeTouchBlocked = false;
        if (absDx < SWIPE_COMMIT_THRESHOLD) { suppressTapUntil = Date.now() + 180; return; }
        suppressTapUntil = Date.now() + 420;
        if (dx > 0) { if (prevLessonRef) openLesson(prevLessonRef); return; }
        if (nextLessonRef) openLesson(nextLessonRef);
      }, { passive: true });
      ionContentEl?.addEventListener('touchcancel', () => {
        if (!swipeTouchActive) return;
        swipeTouchActive = false;
        swipeTouchHorizontal = false;
        swipeTouchBlocked = false;
        suppressTapUntil = Date.now() + 120;
      }, { passive: true });
      ionContentEl?.addEventListener('click', (event) => {
        if (Date.now() < suppressTapUntil) return;
        const target = event && event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (isInteractiveTarget(target)) return;
        const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
        if (selection && !selection.isCollapsed && String(selection).trim()) return;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        if (!viewportWidth) return;
        const clientX = Number.isFinite(event.clientX) ? event.clientX : viewportWidth / 2;
        const leftEdgeLimit = viewportWidth * TAP_EDGE_ZONE_RATIO;
        const rightEdgeLimit = viewportWidth * (1 - TAP_EDGE_ZONE_RATIO);
        if (clientX <= leftEdgeLimit) { if (prevLessonRef) openLesson(prevLessonRef); return; }
        if (clientX < rightEdgeLimit) return;
        if (nextLessonRef) openLesson(nextLessonRef);
      });
    } else {
      // ── List view listeners ──
      const toolsEnabled = this.isReferenceToolsEnabled();
      const activeMainTab = toolsEnabled ? this.referenceMainTab : 'courses';
      this.currentHeroMessage = toolsEnabled && activeMainTab === 'tools'
        ? copy.toolsSubtitle
        : (copy.subtitle || '');
      this.currentHeroLocale = uiLocale;
      this.querySelector('.reference-hero-card')?.addEventListener('click', (event) => {
        if (this.isEventInHeaderZone(event)) return;
        const target = event && event.target instanceof Element ? event.target : null;
        if (!target) return;
        const inNarrationZone = target.closest('.journey-plan-mascot-wrap, .onboarding-intro-bubble, .reference-hero-bubble, .journey-plan-bubble');
        if (!inNarrationZone) return;
        this.playHeroNarration(true).catch(() => {});
      });

      this.querySelectorAll('[data-reference-main-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          const nextTab = String(button.getAttribute('data-reference-main-tab') || '').trim();
          if (!nextTab || this.referenceMainTab === nextTab) return;
          this.referenceMainTab = nextTab;
          this.render();
        });
      });

      this.querySelectorAll('[data-reference-tool]').forEach((itemEl) => {
        itemEl.addEventListener('click', () => {
          const tool = String(itemEl.getAttribute('data-reference-tool') || '').trim();
          if (!tool) return;
          this.toolView = true;
          this.activeTool = tool;
          this.expandedToolItemId = null;
          this.toolFilter = 'featured';
          this.activeArticleUnitCode = null;
          this.activeArticleLessonCode = null;
          this.render();
        });
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
            const units = course && Array.isArray(course.unidades) ? course.unidades : [];
            this.expandedUnitCode = units.length ? String(units[0].code) : '';
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
}

if (!customElements.get('page-reference')) {
  customElements.define('page-reference', PageReference);
}
