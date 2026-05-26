// @type module — must be loaded as Worker(..., { type: 'module' })
const TRANSFORMERS_VERSION = '3.5.1';
const TRANSFORMERS_BASE_URL =
  `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/`;
const TRANSFORMERS_JS_URL = `${TRANSFORMERS_BASE_URL}transformers.min.js`;
const OPUS_MODEL_ID = 'Xenova/opus-mt-es-en';

let translator = null;
let loadError = null;
let loading = false;
let transformersModulePromise = null;

async function loadTransformersModule() {
  if (transformersModulePromise) return transformersModulePromise;
  transformersModulePromise = import(/* webpackIgnore: true */ TRANSFORMERS_JS_URL)
    .then((module) => {
      const { env } = module;
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      env.useFSCache = false;
      env.useCustomCache = false;
      env.backends.onnx.wasm.wasmPaths = TRANSFORMERS_BASE_URL;
      env.backends.onnx.wasm.proxy = false;  // already in a worker
      env.backends.onnx.wasm.numThreads = 1; // safer in WebView
      return module;
    })
    .catch((err) => {
      transformersModulePromise = null;
      throw err;
    });
  return transformersModulePromise;
}

async function loadModel() {
  if (loading || translator) return;
  loading = true;
  try {
    const { pipeline } = await loadTransformersModule();
    translator = await pipeline('translation', OPUS_MODEL_ID, {
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
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
