import { getAppLocale, setAppLocale } from '../state.js';
import { renderAppHeader } from '../components/app-header.js';
import {
  ensureReferenceData,
  getLocalizedMapField,
  getReferenceCourses,
  getReferenceSelection,
  resolveReferenceSelection,
  setReferenceSelection
} from '../data/reference-data.js';
import {
  ensureReferenceTestsData,
  getLocalizedReferenceTestValue,
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
const HERO_MASCOT_FRAME_COUNT = 9;
const HERO_MASCOT_REST_FRAME = HERO_MASCOT_FRAME_COUNT - 1;
const HERO_MASCOT_FRAME_INTERVAL_MS = 150;
const BROWSER_AUTONARRATION_EXTRA_DELAY_MS = 120;
const REFERENCE_ALIGNED_CACHE_MAX_ITEMS = 80;
const REFERENCE_HERO_AUTONARRATION_PLAYED_KEY = 'appv5:reference-hero-auto-narration-played';
const REFERENCE_TESTS_ENABLED_KEY = 'appv5:reference-tests-enabled';
const REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX = 'appv5:reference-tests-progress';
const REFERENCE_TEST_REWARD_ENTRY_PREFIX = 'reference-test';
const REFERENCE_TEST_DIAMOND_REWARD_QTY = 1;
const REFERENCE_TEST_DIAMOND_REWARD_LABEL = 'diamonds';
const REFERENCE_TEST_DIAMOND_REWARD_ICON = 'diamond';

let markedParseFnPromise = null;

class PageReference extends HTMLElement {
  constructor() {
    super();
    this.state = {
      localeOverride: ''
    };
    this.expandedCourseCode = '';
    this.expandedUnitCode = '';
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
      this.ensureReferenceTestsPersistenceLoaded(true);
      if (this.querySelector('#reference-tests-section')) {
        this.renderReferenceTestsSection(this.getUiLocale());
      }
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
    this._referenceTestsToggleHandler = () => {
      if (!this.isConnected) return;
      this.render();
    };
    window.addEventListener('app:reference-tests-enabled-change', this._referenceTestsToggleHandler);
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
    if (this._referenceTestsToggleHandler) {
      window.removeEventListener('app:reference-tests-enabled-change', this._referenceTestsToggleHandler);
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
    const nextLocale = getNextLocaleCode(currentLocale);
    const tabTitle = getReferenceCopy(currentLocale).title;
    return renderAppHeader({ title: tabTitle, rewardBadgesId: 'reference-reward-badges', nextLocale: nextLocale.toUpperCase() });
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

  isReferenceTestsEnabled() {
    if (
      window.r34lp0w3r &&
      Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'referenceTestsEnabled')
    ) {
      return Boolean(window.r34lp0w3r.referenceTestsEnabled);
    }
    try {
      const raw = String(localStorage.getItem(REFERENCE_TESTS_ENABLED_KEY) || '')
        .trim()
        .toLowerCase();
      return ['1', 'true', 'on', 'yes'].includes(raw);
    } catch (err) {
      return false;
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
                  ? `${copy.testsAnswerPlaceholder || 'Answer'} ${index + 1}`
                  : copy.testsAnswerPlaceholder || 'Answer'
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
                    ? `${copy.testsAnswerPlaceholder || 'Answer'} ${index + 1}`
                    : copy.testsAnswerPlaceholder || 'Answer'
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
    const state = this.getReferenceTestState(testKey);
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
    const state = this.getReferenceTestState(testKey);
    const evaluation = this.evaluateReferenceTest(test, testKey);
    const answeredCount = questions.reduce((count, question) => {
      const questionCode = String(question && question.code ? question.code : '');
      return count + (this.hasReferenceQuestionResponse(question, state.responses[questionCode]) ? 1 : 0);
    }, 0);
    const total = evaluation.total;
    const checked = Boolean(state.checked);
    const correctCount = checked ? evaluation.correctCount : 0;
    const completed = Boolean(checked && total > 0 && correctCount === total);
    const progressCount = checked ? correctCount : answeredCount;
    return {
      checked,
      completed,
      answeredCount,
      correctCount,
      total,
      progressCount,
      progressRatio: total > 0 ? Math.max(0, Math.min(1, progressCount / total)) : 0
    };
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
    if (value >= 80) return 'good';
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
    const rewardStore =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : (window.r34lp0w3r.speakSessionRewards = {});
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
    if (typeof window.persistSpeakStores === 'function') {
      window.persistSpeakStores();
    }
    if (typeof window.queueSpeakEvent === 'function') {
      window.queueSpeakEvent({
        type: 'session_reward',
        session_id: entryId,
        rewardQty: REFERENCE_TEST_DIAMOND_REWARD_QTY,
        rewardLabel: REFERENCE_TEST_DIAMOND_REWARD_LABEL,
        rewardIcon: REFERENCE_TEST_DIAMOND_REWARD_ICON,
        ts: now,
        reason: options.reason || 'reference-test-complete'
      });
    }
    if (typeof window.notifySpeakStoresChange === 'function') {
      window.notifySpeakStoresChange();
    } else {
      window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
    }
    return {
      entryId,
      rewardQty: REFERENCE_TEST_DIAMOND_REWARD_QTY,
      rewardLabel: REFERENCE_TEST_DIAMOND_REWARD_LABEL,
      rewardIcon: REFERENCE_TEST_DIAMOND_REWARD_ICON
    };
  }

  renderReferenceTestQuestion(question, testKey, testState, result, copy, uiLocale) {
    const questionCode = String(question.code || '');
    const questionLabel = this.formatReferenceCopy(copy.testsQuestionLabel || 'Question {n}', {
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
                  copy.testsTapWords || 'Tap the words in order to build the answer.'
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
                  result.correct ? copy.testsCorrect || 'Correct' : copy.testsIncorrect || 'Incorrect'
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
                  <strong>${this.escapeHtml(copy.testsYourAnswer || 'Your answer')}</strong>
                  <span>${this.escapeHtml(result.userDisplay || copy.testsNoAnswer || 'No answer')}</span>
                </div>
                <div class="reference-test-feedback-row">
                  <strong>${this.escapeHtml(copy.testsCorrectAnswer || 'Correct answer')}</strong>
                  <span>${this.escapeHtml(result.correctDisplay || copy.testsNoAnswer || 'No answer')}</span>
                </div>
                ${
                  explanation
                    ? `<div class="reference-test-explanation"><strong>${this.escapeHtml(
                        copy.testsExplanation || 'Explanation'
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
    const { copy, loadInfo, lessonItems, unitItems, allItems, activeItem } = context;

    if (loadInfo.status === 'loading' && !allItems.length) {
      sectionEl.innerHTML = `
        <div class="reference-tests-shell">
          <div class="pill">${this.escapeHtml(copy.testsTitle || 'Tests')}</div>
          <div class="reference-empty">${this.escapeHtml(copy.testsLoading || 'Loading tests...')}</div>
        </div>
      `;
      return;
    }

    if (loadInfo.status === 'error' && !allItems.length) {
      sectionEl.innerHTML = `
        <div class="reference-tests-shell">
          <div class="pill">${this.escapeHtml(copy.testsTitle || 'Tests')}</div>
          <div class="reference-empty">${this.escapeHtml(copy.testsLoadError || 'Reference tests could not be loaded.')}</div>
        </div>
      `;
      return;
    }

    if (!allItems.length) {
      sectionEl.innerHTML = `
        <div class="reference-tests-shell">
          <div class="pill">${this.escapeHtml(copy.testsTitle || 'Tests')}</div>
          <div class="reference-empty">${this.escapeHtml(copy.testsEmpty || 'No tests are available for this lesson or unit.')}</div>
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
    const activeProgress = activeTest ? this.getReferenceTestProgress(activeTest, activeTestKey) : null;
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
                const itemProgress = this.getReferenceTestProgress(item.test, itemKey);
                const questionsLabel = this.formatReferenceCopy(copy.testsQuestions || '{n} questions', {
                  n: Array.isArray(item.test.questions) ? item.test.questions.length : 0
                });
                const progressLabel = `${itemProgress.checked ? itemProgress.correctCount : itemProgress.answeredCount}/${itemProgress.total}`;
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
                    <span class="reference-test-chip-score">${this.escapeHtml(progressLabel)}</span>
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
        <div class="pill">${this.escapeHtml(copy.testsTitle || 'Tests')}</div>
        <div class="reference-tests-head">
          <div>
            <h4 class="reference-tests-title">${this.escapeHtml(copy.testsTitle || 'Tests')}</h4>
            <p class="reference-tests-subtitle">${this.escapeHtml(
              copy.testsSubtitle || 'Answer the tests linked to this lesson and unit.'
            )}</p>
          </div>
        </div>
        ${renderItemGroup(copy.lessonTests || 'Lesson tests', lessonItems)}
        ${renderItemGroup(copy.unitTests || 'Unit tests', unitItems)}
        ${
          activeTest
            ? `
              <div class="reference-test-card">
                <div class="reference-test-card-head">
                  <div class="pill">${this.escapeHtml(copy.testsSelectedTest || 'Selected test')}</div>
                  <div class="reference-test-card-meta">${this.escapeHtml(
                    this.formatReferenceCopy(copy.testsQuestions || '{n} questions', {
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
                          copy.testsWordBank || 'Word bank'
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
                        `${copy.testsResult || 'Result'} · ${
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
                            copy.testsQuestionLabel || 'Question {n}',
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
                  )}">${this.escapeHtml(copy.testsCheck || 'Check answers')}</button>
                  <button type="button" class="reference-test-btn" data-action="reset-reference-test" data-test-key="${this.escapeHtml(
                    activeTestKey
                  )}">${this.escapeHtml(copy.testsReset || 'Reset')}</button>
                </div>
              </div>
            `
            : `<div class="reference-empty">${this.escapeHtml(copy.testsPickOne || 'Select a test to get started.')}</div>`
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
        const previousProgress = this.getReferenceTestProgress(activeItem.test, testKey);
        state.checked = true;
        state.lastCheckedAt = Date.now();
        const nextProgress = this.getReferenceTestProgress(activeItem.test, testKey);
        const percent = nextProgress.total > 0 ? (nextProgress.correctCount / nextProgress.total) * 100 : 0;
        const tone = this.getReferenceScoreTone(percent);
        if (!previousProgress.completed && nextProgress.completed) {
          this.awardDiamondForReferenceTest(testKey, { reason: 'reference-test-complete' });
        }
        this.playReferenceResultSound(tone);
        this.persistReferenceTestsState();
        this.renderReferenceTestsSection(uiLocale);
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
    const forceNarration = Boolean(options && options.forceNarration);
    const narrationDelayMs =
      typeof options.narrationDelayMs === 'number'
        ? options.narrationDelayMs
        : this.getAutoNarrationDelay(95);
    const baseLocale = this.getBaseLocale();
    const uiLocale = this.getUiLocale(baseLocale);
    const tabsCopy = getTabsCopy(uiLocale);
    const copy = getReferenceCopy(uiLocale);
    const heroMascotSrc = this.getHeroMascotSrc();
    const referenceTestsEnabled = this.isReferenceTestsEnabled();
    this.ensureReferenceTestsPersistenceLoaded();

    if (referenceTestsEnabled && !this._loadingReferenceTests && !this._referenceTestsLoadAttempted) {
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
                <p class="onboarding-intro-bubble journey-plan-bubble reference-hero-bubble">${this.escapeHtml(copy.subtitle)}</p>
              </div>
            </section>
            <section class="reference-content-card">
              <div class="reference-empty">${this.escapeHtml(copy.loading)}</div>
            </section>
          </div>
        </ion-content>
      `;

      this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
        const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
        setAppLocale(nextLocale);
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
        this.scheduleHeroNarration(0, true);
      });
      this.updateHeaderRewards();
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
          <section class="journey-plan-card onboarding-intro-card reference-hero-card">
            <span class="journey-plan-mascot-wrap" aria-hidden="true">
              <img id="reference-hero-mascot" class="onboarding-intro-cat" src="${heroMascotSrc}" alt="">
            </span>
            <div class="journey-plan-body">
              <p class="onboarding-intro-bubble journey-plan-bubble reference-hero-bubble">${this.escapeHtml(copy.subtitle)}</p>
            </div>
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
            ${referenceTestsEnabled ? `<div id="reference-tests-section"></div>` : ''}
            <div class="reference-page-hints" aria-hidden="true">
              <span class="reference-page-hint reference-page-hint-prev ${prevLessonRef ? 'is-visible' : ''}"></span>
              <span class="reference-page-hint reference-page-hint-next ${nextLessonRef ? 'is-visible' : ''}"></span>
            </div>
          </section>
        </div>
      </ion-content>
    `;

    this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
      const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
      setAppLocale(nextLocale);
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
      this.scheduleHeroNarration(0, true);
    });
    this.updateHeaderRewards();
    this.currentHeroMessage = copy.subtitle;
    this.currentHeroLocale = uiLocale;
    this.scheduleHeroNarration(narrationDelayMs, forceNarration);
    if (lessonContent) {
      this.enhanceMarkdownWithMarked(lessonContent, markdownRenderToken);
    }
    if (referenceTestsEnabled) {
      this.renderReferenceTestsSection(uiLocale);
    }
    const lessonCardEl = this.querySelector('.reference-content-card');
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
          'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-action], #reference-tests-section, .reference-tests-shell, .reference-test-card'
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
        () => {
          applyVisibility(isLessonCardVisible());
        },
        { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
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
      const leftEdgeLimit = viewportWidth * TAP_EDGE_ZONE_RATIO;
      const rightEdgeLimit = viewportWidth * (1 - TAP_EDGE_ZONE_RATIO);
      if (clientX <= leftEdgeLimit) {
        if (!prevLessonRef) return;
        openLesson(prevLessonRef);
        return;
      }
      if (clientX < rightEdgeLimit) return;
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

if (!customElements.get('page-reference')) {
  customElements.define('page-reference', PageReference);
}
