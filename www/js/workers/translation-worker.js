// @type module — must be loaded as Worker(..., { type: 'module' })
import { pipeline, env } from '../../vendor/transformers/transformers.min.js';

// Resolve paths relative to this worker file
const VENDOR_URL = new URL('../../vendor/transformers/', import.meta.url).href;
const MODELS_URL = new URL('../../assets/models/', import.meta.url).href;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODELS_URL;
env.useBrowserCache = false;
env.useFSCache = false;
env.useCustomCache = false;
env.backends.onnx.wasm.wasmPaths = VENDOR_URL;
env.backends.onnx.wasm.proxy = false;  // already in a worker
env.backends.onnx.wasm.numThreads = 1; // safer in WebView

let translator = null;
let loadError = null;
let loading = false;

async function loadModel() {
  if (loading || translator) return;
  loading = true;
  try {
    translator = await pipeline('translation', 'opus-mt-es-en', {
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
      local_files_only: true,
    });
    loading = false;
    self.postMessage({ type: 'ready' });
  } catch (err) {
    loading = false;
    loadError = err?.stack || err?.message || String(err);
    self.postMessage({ type: 'load_error', error: loadError });
  }
}

self.addEventListener('message', async ({ data }) => {
  const { type, id, text } = data;

  if (type === 'load') {
    loadModel();
    return;
  }

  if (type === 'translate') {
    if (loadError) {
      self.postMessage({ type: 'error', id, error: loadError });
      return;
    }
    if (!translator) {
      self.postMessage({ type: 'error', id, error: 'model_not_ready' });
      return;
    }
    try {
      const out = await translator(text, { max_new_tokens: 256 });
      const translatedText = String(out?.[0]?.translation_text || '').trim();
      self.postMessage({ type: 'result', id, translatedText });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err.message || String(err) });
    }
  }
});
