#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OUTPUT_DIR="${MFA_OUTPUT_DIR:-"${SCRIPT_DIR}/output"}"
TRAINING_DATA="${MFA_TRAINING_DATA:-"${REPO_ROOT}/www/js/data/training-data.json"}"
ITEMS_JSON="${OUTPUT_DIR}/items.json"

CONDA_BIN="${CONDA_BIN:-/opt/miniconda3/condabin/conda}"
MFA_ENV="${MFA_ENV:-aligner}"
MFA_OVERWRITE="${MFA_OVERWRITE:-1}"
SAY_FORCE="${SAY_FORCE:-0}"
MFA_TEMP_DIR="${MFA_TEMP_DIR:-"${OUTPUT_DIR}/tmp-$(date +%s)"}"

if [[ ! -x "${CONDA_BIN}" ]]; then
  echo "conda not found at ${CONDA_BIN}"
  echo "Set CONDA_BIN to your conda path or install Miniconda."
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

node "${SCRIPT_DIR}/buildSpeakItems.js" "${TRAINING_DATA}" "${ITEMS_JSON}"

if [[ "${SAY_FORCE}" == "1" ]]; then
  node "${SCRIPT_DIR}/generateSayCorpus.js" "${ITEMS_JSON}" "${OUTPUT_DIR}" --force
else
  node "${SCRIPT_DIR}/generateSayCorpus.js" "${ITEMS_JSON}" "${OUTPUT_DIR}"
fi

if [[ "${MFA_OVERWRITE}" == "1" ]]; then
  "${CONDA_BIN}" run -n "${MFA_ENV}" mfa align \
    --overwrite \
    --temporary_directory "${MFA_TEMP_DIR}" \
    "${OUTPUT_DIR}/corpus" \
    english_us_arpa \
    english_us_arpa \
    "${OUTPUT_DIR}/aligned"
else
  "${CONDA_BIN}" run -n "${MFA_ENV}" mfa align \
    --temporary_directory "${MFA_TEMP_DIR}" \
    "${OUTPUT_DIR}/corpus" \
    english_us_arpa \
    english_us_arpa \
    "${OUTPUT_DIR}/aligned"
fi

node "${SCRIPT_DIR}/generateVisemes.js" "${OUTPUT_DIR}/aligned" "${OUTPUT_DIR}/visemes"
node "${SCRIPT_DIR}/generateWords.js" "${OUTPUT_DIR}/aligned" "${OUTPUT_DIR}/words"
node "${SCRIPT_DIR}/generateSyllables.js" "${OUTPUT_DIR}/words" "${OUTPUT_DIR}/syllables"
node "${SCRIPT_DIR}/generateSentenceList.js" "${OUTPUT_DIR}/visemes" "${OUTPUT_DIR}"

echo "Pipeline complete: ${OUTPUT_DIR}"
echo "Temp directory: ${MFA_TEMP_DIR}"
