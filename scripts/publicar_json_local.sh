export CONTENT_EDITOR_EMAIL=""
export CONTENT_EDITOR_PASSWORD=""
scripts/publish-content.sh \
  --base-url "https://content.curso-ingles.com" \
  --json "www/js/data/training-data.json" \
  --release-name "release-hints-es-$(date +%Y%m%d-%H%M)"
