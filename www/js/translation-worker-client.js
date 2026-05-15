const WORKER_URL = new URL('./workers/translation-worker.js', import.meta.url).href;

class TranslationWorkerClient {
  constructor() {
    this._worker = null;
    this._status = 'idle'; // idle | loading | ready | error
    this._error = null;
    this._nextId = 0;
    this._pending = new Map();   // id -> { resolve, reject }
    this._readyCallbacks = [];   // waiting for model to be ready
  }

  get status() { return this._status; }
  get ready() { return this._status === 'ready'; }

  // Preload the worker + model. Safe to call multiple times.
  preload() {
    if (this._status !== 'idle') return;
    this._status = 'loading';
    try {
      this._worker = new Worker(WORKER_URL, { type: 'module' });
      this._worker.addEventListener('message', (e) => this._onMessage(e.data));
      this._worker.addEventListener('error', (e) => this._onWorkerError(e));
      this._worker.postMessage({ type: 'load' });
    } catch (err) {
      this._status = 'error';
      this._error = err.message || String(err);
      this._flushReadyCallbacks(false);
    }
  }

  // Returns a promise that resolves when the model is ready, or rejects on error.
  ensureReady() {
    if (this._status === 'ready') return Promise.resolve();
    if (this._status === 'error') return Promise.reject(new Error(this._error || 'worker_error'));
    if (this._status === 'idle') this.preload();
    return new Promise((resolve, reject) => {
      this._readyCallbacks.push({ resolve, reject });
    });
  }

  async translate(text) {
    await this.ensureReady();
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._worker.postMessage({ type: 'translate', id, text });
    });
  }

  terminate() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._status = 'idle';
    this._pending.clear();
  }

  _onMessage(data) {
    if (data.type === 'ready') {
      this._status = 'ready';
      this._flushReadyCallbacks(true);
      return;
    }
    if (data.type === 'load_error') {
      this._status = 'error';
      this._error = data.error;
      this._flushReadyCallbacks(false);
      return;
    }
    if (data.type === 'result') {
      const cb = this._pending.get(data.id);
      if (cb) { cb.resolve(data.translatedText); this._pending.delete(data.id); }
      return;
    }
    if (data.type === 'error') {
      const cb = this._pending.get(data.id);
      if (cb) { cb.reject(new Error(data.error)); this._pending.delete(data.id); }
    }
  }

  _onWorkerError(e) {
    this._status = 'error';
    this._error = e.message || 'worker_crashed';
    this._flushReadyCallbacks(false);
    for (const cb of this._pending.values()) {
      cb.reject(new Error(this._error));
    }
    this._pending.clear();
  }

  _flushReadyCallbacks(ok) {
    const cbs = this._readyCallbacks.splice(0);
    for (const cb of cbs) {
      ok ? cb.resolve() : cb.reject(new Error(this._error || 'worker_error'));
    }
  }
}

export const translationWorkerClient = new TranslationWorkerClient();
