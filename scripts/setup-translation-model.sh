#!/bin/bash
# Downloads @huggingface/transformers v3 + WASM files + Xenova/opus-mt-es-en (int8 quantized)
# Run from the speakapp root: bash scripts/setup-translation-model.sh
set -e

VENDOR_DIR="www/vendor/transformers"
MODEL_DIR="www/assets/models/opus-mt-es-en"
HF_BASE="https://huggingface.co/Xenova/opus-mt-es-en/resolve/main"
TRANSFORMERS_VERSION="3.5.1"

echo "==> Installing @huggingface/transformers@${TRANSFORMERS_VERSION} (temp)..."
npm install --no-save "@huggingface/transformers@${TRANSFORMERS_VERSION}"

echo "==> Copying JS + WASM + MJS files to ${VENDOR_DIR}..."
mkdir -p "$VENDOR_DIR"
cp "node_modules/@huggingface/transformers/dist/transformers.min.js" "$VENDOR_DIR/"
# Copy all WASM + MJS files (JSEP backend needs both)
find node_modules/@huggingface/transformers/dist -name "*.wasm" -exec cp {} "$VENDOR_DIR/" \;
find node_modules/@huggingface/transformers/dist -name "*.mjs" -exec cp {} "$VENDOR_DIR/" \;
find node_modules/onnxruntime-web/dist -name "*.wasm" -exec cp {} "$VENDOR_DIR/" \; 2>/dev/null || true
find node_modules/onnxruntime-web/dist -name "*.mjs" -exec cp {} "$VENDOR_DIR/" \; 2>/dev/null || true

echo "==> Downloading model config + tokenizer files..."
mkdir -p "$MODEL_DIR/onnx"
for file in config.json generation_config.json quantize_config.json tokenizer.json tokenizer_config.json vocab.json special_tokens_map.json source.spm target.spm; do
  echo "    $file"
  curl -sLf "$HF_BASE/$file" -o "$MODEL_DIR/$file" 2>/dev/null || echo "    (skipped $file — not found)"
done

# opus-mt is encoder-decoder — Transformers.js needs encoder + merged decoder
# Using _quantized variants (int8 weights)
echo "==> Downloading encoder_model_quantized.onnx..."
curl -L --progress-bar "$HF_BASE/onnx/encoder_model_quantized.onnx" \
  -o "$MODEL_DIR/onnx/encoder_model_quantized.onnx"

echo "==> Downloading decoder_model_merged_quantized.onnx..."
curl -L --progress-bar "$HF_BASE/onnx/decoder_model_merged_quantized.onnx" \
  -o "$MODEL_DIR/onnx/decoder_model_merged_quantized.onnx"

echo ""
echo "==> Done. Sizes:"
du -sh "$VENDOR_DIR"
du -sh "$MODEL_DIR"
