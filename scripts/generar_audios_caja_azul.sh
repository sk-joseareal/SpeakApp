RT_TOKEN="ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50"
TTS_ENDPOINT="https://realtime.curso-ingles.com/realtime/tts/aligned"

gen () {
  local locale="$1"
  local text="$2"
  curl -sS -X POST "$TTS_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -H "x-rt-token: $RT_TOKEN" \
    -d "$(jq -nc --arg text "$text" --arg locale "$locale" '{text:$text,locale:$locale}')" \
  | jq '{ok, locale, text, cached, hash, audio_url, words_url}'
}

# Training (2 líneas por idioma)
#gen en-US "This is your plan to sound like a native."
#gen en-US "Tap this card to hear it again."
#gen es-ES "Este es tu plan para sonar como nativo."
#gen es-ES "Toca esta tarjeta para escucharlo otra vez."

# Lab
#gen en-US "Write your own phrase or longer text and practice freely."
#gen es-ES "Escribe tu frase o texto y practica pronunciacion libre."

# Referencia
gen en-US "Explora cursos, unidades y lecciones para consultar contenido."
gen es-ES "Browse courses, units, and lessons to review content."

