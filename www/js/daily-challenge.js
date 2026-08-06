import { ensureReferenceTestsData } from './data/reference-tests.js';
import { updateAppHeaderRewards } from './components/app-header.js';

const ENABLED_KEY    = 'appv5:daily-challenge-enabled';
const LAST_DATE_KEY  = 'appv5:daily-challenge-last';
const STREAK_KEY     = 'appv5:daily-challenge-streak';
const MAX_KEY        = 'appv5:daily-challenge-max-streak';
const QUESTION_COUNT = 5;

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
};

// ── Feature flag ───────────────────────────────────────────────────────────
export function isDailyChallengeEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
export function setDailyChallengeEnabled(enabled) {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('app:daily-challenge-enabled-change', { detail: { enabled: Boolean(enabled) } }));
}

// ── State ──────────────────────────────────────────────────────────────────
export function getDailyChallengeState() {
  try {
    const lastDate  = localStorage.getItem(LAST_DATE_KEY);
    const streak    = Math.max(0, parseInt(localStorage.getItem(STREAK_KEY) || '0', 10));
    const maxStreak = Math.max(0, parseInt(localStorage.getItem(MAX_KEY)    || '0', 10));
    return { lastDate, streak, maxStreak, completedToday: lastDate === todayStr() };
  } catch {
    return { lastDate: null, streak: 0, maxStreak: 0, completedToday: false };
  }
}

function recordComplete() {
  const today     = todayStr();
  const yesterday = yesterdayStr();
  try {
    const s = getDailyChallengeState();
    if (s.completedToday) return s;
    const streak    = s.lastDate === yesterday ? s.streak + 1 : 1;
    const maxStreak = Math.max(s.maxStreak, streak);
    localStorage.setItem(LAST_DATE_KEY, today);
    localStorage.setItem(STREAK_KEY,    String(streak));
    localStorage.setItem(MAX_KEY,       String(maxStreak));
    // Award trophy via shared reward store
    window.r34lp0w3r = window.r34lp0w3r || {};
    window.r34lp0w3r.speakSessionRewards = window.r34lp0w3r.speakSessionRewards || {};
    const key = `daily-challenge:${today}`;
    if (!window.r34lp0w3r.speakSessionRewards[key]) {
      window.r34lp0w3r.speakSessionRewards[key] = {
        rewardQty: 1, rewardLabel: 'trophy', rewardIcon: 'trophy',
        ts: Date.now(), source: 'daily-challenge'
      };
      updateAppHeaderRewards(document);
    }
    window.dispatchEvent(new CustomEvent('app:daily-challenge-complete', { detail: { streak, maxStreak } }));
    return { lastDate: today, streak, maxStreak, completedToday: true };
  } catch { return getDailyChallengeState(); }
}

// ── Question selection ─────────────────────────────────────────────────────
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = Math.abs(seed | 0) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    [a[i], a[s % (i + 1)]] = [a[s % (i + 1)], a[i]];
  }
  return a;
}

function collectQuestions(data) {
  const out = [];
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (Array.isArray(obj.questions) && obj.code) {
      for (const q of obj.questions) {
        const ia = String(q.interaction || '').trim();
        if (ia === 'multiple_choice' && Array.isArray(q.options) && q.options.length >= 2)
          out.push(q);
        else if (ia === 'reorder_words' && String(q.text || '').includes('/'))
          out.push(q);
      }
    }
    for (const v of Object.values(obj)) walk(v);
  }
  walk(data);
  return out;
}

export async function getDailyChallengeQuestions() {
  const data = await ensureReferenceTestsData();
  const all  = collectQuestions(data);
  const seed = parseInt(todayStr().replace(/-/g, ''), 10);
  return seededShuffle(all, seed).slice(0, QUESTION_COUNT);
}

// ── Evaluation ─────────────────────────────────────────────────────────────
function normalizeAns(v) {
  return String(v || '').normalize('NFKC')
    .replace(/[.,!?;:()"[\]{}]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function evaluate(question, response) {
  const ia = String(question.interaction || '').trim();
  if (ia === 'multiple_choice') {
    const sel = String(response || '').trim();
    return Boolean(sel) && Boolean((question.options || []).find(o => o.correct && String(o.code) === sel));
  }
  if (ia === 'reorder_words') {
    const tokens = Array.isArray(response) ? response : [];
    if (!tokens.length) return false;
    const userNorm = normalizeAns(tokens.join(' '));
    const accepted = Array.isArray(question.answer?.accepted) ? question.answer.accepted : [];
    return accepted.some(a => normalizeAns(a) === userNorm);
  }
  return false;
}

// ── Modal UI ───────────────────────────────────────────────────────────────
export function openDailyChallengeModal({ questions, locale, copy = {}, onClose } = {}) {
  const isEs = String(locale || '').startsWith('es');
  const t = (es, en) => isEs ? es : en;

  // per-question state
  const responses   = questions.map(() => null);
  // for reorder_words: original token order from text
  const sourcePools = questions.map(q =>
    String(q.interaction || '') === 'reorder_words'
      ? String(q.text || '').split('/').map(s => s.trim()).filter(Boolean)
      : null
  );

  let phase      = 'question'; // 'question' | 'feedback' | 'result'
  let idx        = 0;
  const results  = Array(questions.length).fill(null);

  const overlay = document.createElement('div');
  overlay.className = 'dc-overlay';
  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); onClose?.(); };

  // ── renderers ──
  function dots() {
    return `<div class="dc-progress">${questions.map((_, i) => {
      let cls = 'dc-dot';
      if (phase === 'result' || i < idx) cls += results[i]?.correct ? ' is-correct' : ' is-incorrect';
      else if (i === idx)                cls += ' is-active';
      return `<span class="${cls}"></span>`;
    }).join('')}</div>`;
  }

  function questionHTML() {
    const q  = questions[idx];
    const ia = String(q.interaction || '').trim();
    const r  = responses[idx];
    const hasR = ia === 'multiple_choice' ? Boolean(r) : (Array.isArray(r) && r.length > 0);

    let body = '';

    if (ia === 'multiple_choice') {
      const sel = String(r || '');
      body = `
        <p class="dc-question-text">${esc(q.text || '')}</p>
        <div class="dc-options">
          ${(q.options || []).map(o => `
            <button class="dc-option${sel === String(o.code) ? ' is-selected' : ''}"
              data-action="dc-option" data-code="${esc(String(o.code || ''))}">
              ${esc(o.text || '')}
            </button>`).join('')}
        </div>`;
    } else if (ia === 'reorder_words') {
      const placed = Array.isArray(r) ? r : [];
      const pool   = sourcePools[idx] || [];
      const usage  = new Map();
      placed.forEach(tk => usage.set(tk, (usage.get(tk) || 0) + 1));
      const slots  = pool.map(tk => {
        const u = usage.get(tk) || 0;
        if (u > 0) { usage.set(tk, u - 1); return { token: tk, hidden: true }; }
        return { token: tk, hidden: false };
      });
      body = `
        <p class="dc-question-label">${esc(t('Ordena las palabras', 'Order the words'))}</p>
        <div class="dc-reorder-answer${placed.length ? '' : ' is-empty'}">
          ${placed.length
            ? placed.map((tk, i) => `<button class="dc-token is-answer" data-action="dc-remove" data-idx="${i}">${esc(tk)}</button>`).join('')
            : `<span class="dc-reorder-ph">${esc(t('Toca las palabras en orden', 'Tap the words in order'))}</span>`}
        </div>
        <div class="dc-reorder-pool">
          ${slots.map(s => s.hidden
            ? `<span class="dc-token is-ph" aria-hidden="true">${esc(s.token)}</span>`
            : `<button class="dc-token" data-action="dc-add" data-token="${esc(s.token)}">${esc(s.token)}</button>`
          ).join('')}
        </div>`;
    }

    return `
      ${dots()}
      <button class="dc-close" type="button" data-action="dc-close">&#x2715;</button>
      <div class="dc-question-num">${esc(t(`Pregunta ${idx + 1} de ${questions.length}`, `Question ${idx + 1} of ${questions.length}`))}</div>
      <div class="dc-body">${body}</div>
      <div class="dc-footer">
        <button class="dc-btn-primary${hasR ? '' : ' is-disabled'}" data-action="dc-confirm" ${hasR ? '' : 'disabled'}>
          ${esc(t('Confirmar', 'Confirm'))}
        </button>
      </div>`;
  }

  function feedbackHTML() {
    const q        = questions[idx];
    const ia       = String(q.interaction || '').trim();
    const ok       = results[idx]?.correct;
    const isLast   = idx === questions.length - 1;
    const accepted = Array.isArray(q.answer?.accepted) ? q.answer.accepted[0] : '';
    const expl     = q.explanation ? (q.explanation[isEs ? 'es' : 'en'] || q.explanation.en || q.explanation.es || '') : '';

    return `
      ${dots()}
      <div class="dc-feedback ${ok ? 'is-correct' : 'is-incorrect'}">
        <div class="dc-feedback-icon">${ok ? '✓' : '✗'}</div>
        <div class="dc-feedback-label">${esc(ok ? t('¡Correcto!', 'Correct!') : t('Incorrecto', 'Incorrect'))}</div>
        ${!ok && accepted ? `
          <div class="dc-feedback-answer">
            <span class="dc-feedback-answer-lbl">${esc(t('Respuesta correcta', 'Correct answer'))}</span>
            <span class="dc-feedback-answer-val">${esc(accepted)}</span>
          </div>` : ''}
        ${expl ? `<p class="dc-feedback-expl">${esc(expl)}</p>` : ''}
      </div>
      <div class="dc-footer">
        <button class="dc-btn-primary" data-action="dc-next">
          ${esc(isLast ? t('Ver resultado', 'See result') : t('Siguiente', 'Next'))}
        </button>
      </div>`;
  }

  function resultHTML() {
    const correct = results.filter(r => r?.correct).length;
    const state   = getDailyChallengeState();
    return `
      ${dots()}
      <div class="dc-result">
        <div class="dc-result-trophy">🏆</div>
        <div class="dc-result-score">${correct}<span class="dc-result-total">/${questions.length}</span></div>
        <div class="dc-result-label">${esc(t('Reto completado', 'Challenge complete'))}</div>
        ${state.streak > 0 ? `
          <div class="dc-result-streak">
            🔥 ${esc(state.streak === 1
              ? t('¡Primer día!', 'First day!')
              : t(`${state.streak} días seguidos`, `${state.streak}-day streak`))}
          </div>` : ''}
      </div>
      <div class="dc-footer">
        <button class="dc-btn-primary" data-action="dc-close">
          ${esc(t('Cerrar', 'Close'))}
        </button>
      </div>`;
  }

  function render() {
    overlay.innerHTML =
      phase === 'result'   ? resultHTML() :
      phase === 'feedback' ? feedbackHTML() :
                             questionHTML();
    bindEvents();
  }

  function confirm() {
    const q  = questions[idx];
    const ia = String(q.interaction || '').trim();
    const r  = responses[idx];
    if (ia === 'multiple_choice' && !r) return;
    if (ia === 'reorder_words' && (!Array.isArray(r) || !r.length)) return;
    results[idx] = { correct: evaluate(q, r) };
    phase = 'feedback';
    render();
  }

  function next() {
    if (idx === questions.length - 1) {
      recordComplete();
      phase = 'result';
    } else {
      idx++;
      phase = 'question';
    }
    render();
  }

  function bindEvents() {
    overlay.onclick = (e) => {
      const el  = e.target instanceof Element ? e.target.closest('[data-action]') : null;
      if (!el) return;
      const act = el.getAttribute('data-action');
      if (act === 'dc-close')    { close(); return; }
      if (act === 'dc-confirm')  { confirm(); return; }
      if (act === 'dc-next')     { next(); return; }
      if (act === 'dc-option')   { responses[idx] = el.getAttribute('data-code') || ''; render(); return; }
      if (act === 'dc-add') {
        const tk = el.getAttribute('data-token') || '';
        responses[idx] = [...(Array.isArray(responses[idx]) ? responses[idx] : []), tk];
        render(); return;
      }
      if (act === 'dc-remove') {
        const i = parseInt(el.getAttribute('data-idx') || '0', 10);
        const arr = Array.isArray(responses[idx]) ? responses[idx].slice() : [];
        arr.splice(i, 1);
        responses[idx] = arr;
        render(); return;
      }
    };
  }

  render();
  return { close };
}
