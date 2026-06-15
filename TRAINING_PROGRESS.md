# Gestión del progreso de Training

Este documento describe cómo se almacena, sincroniza y restaura el progreso del usuario en el tab Training (sesiones de pronunciación).

---

## 1. Qué se guarda

El progreso se compone de cuatro tipos de datos:

| Dato | Descripción |
|------|-------------|
| **Word scores** | Puntuación por palabra para cada sesión (`session_id → word → {percent, ts}`) |
| **Phrase scores** | Puntuación de la frase completa por sesión (`session_id → {percent, ts}`) |
| **Session rewards** | Trofeos de módulo ganados (`module:id → {qty, ts}`) |
| **Badges** | Badges de ruta ganados (`route:id → {ts}`) |

---

## 2. Almacenamiento local (localStorage)

Todo el progreso vive en **localStorage**. Las claves son:

| Clave | Contenido |
|-------|-----------|
| `appv5:speak-word-scores` | Objeto con scores por palabra |
| `appv5:speak-phrase-scores` | Objeto con scores por frase |
| `appv5:speak-session-rewards` | Trofeos ganados |
| `appv5:speak-badges` | Badges ganados |
| `appv5:speak-events` | Cola de eventos pendientes de sync (máx. 500) |
| `appv5:speak-sync-owner` | `user:{id}` del último sync completado |
| `appv5:speak-sync-ts` | ISO timestamp del último sync exitoso |
| `appv5:speak-local-owner` | `device:{uuid}` del dispositivo actual |
| `appv5:speak-sync-conflict` | Estado de conflicto detectado entre local y remoto |

Adicionalmente, los mismos datos se mantienen en memoria en `window.r34lp0w3r.speakWordScores`, `.speakPhraseScores`, `.speakSessionRewards` y `.speakBadges`. Las lecturas de la UI usan la copia en memoria; el localStorage es la persistencia en disco.

---

## 3. Cuándo se escribe un score

El ciclo de escritura ocurre en `speak.js → finalizeRecording()`:

```
Usuario termina grabación
  └─ finalizeRecording()
       ├─ setStoredWordResult()   →  memoria + localStorage (síncrono)
       ├─ setStoredPhraseResult() →  memoria + localStorage (síncrono)
       └─ queueSpeakEvent()      →  añade evento a la cola localStorage
                                     └─ scheduleSpeakSync()  →  timer 4s
```

Los scores se escriben en localStorage **síncronamente** en el mismo frame que finaliza la grabación. El progreso local nunca se pierde salvo que localStorage esté lleno (cuota del browser).

---

## 4. Sincronización con el backend

### Arquitectura: event sourcing

Cada cambio genera un **evento** que se encola en `appv5:speak-events`. El backend recibe batches de eventos y los aplica. El servidor devuelve los IDs que ha procesado ("acked") y el cliente los elimina de la cola. Si el sync falla, los eventos permanecen en la cola y se reintentarán en el siguiente sync.

### Cuándo se lanza el sync

| Trigger | Mecanismo | Notas |
|---------|-----------|-------|
| Score grabado | Debounce 4s | Normal, baja prioridad |
| Al salir de la sesión (back, continue, swipe) | `flushSpeakSync` — inmediato | Cancela el timer pendiente |
| Al terminar summary y continuar | `flushSpeakSync` — inmediato | |
| Badge o trofeo ganado | `flushSpeakSync` — inmediato | Incluye snapshot completo |
| App pasa a background | `flushSpeakSync` — inmediato | Cancela timer pendiente |
| Pantalla oculta (visibilitychange) | `flushSpeakSync` — inmediato | |
| Recuperación de red (online event) | Sync con snapshot si vacío | |

### `window.flushSpeakSync(reason)`

Función central para sincronización forzada (definida en `init.js`):
1. Cancela el timer de debounce si estaba activo
2. Llama a `syncSpeakProgress({ force: true, includeSnapshot: true })`
3. El `force: true` bypasea el guard de in-flight

### El payload del sync

```json
{
  "owner": "user:12345",
  "events": [ ...batch de hasta 200 eventos... ],
  "strategy": "merge",
  "user_id": 12345,
  "token": "jwt...",
  "timestamp": 1749123456,
  "snapshot": { ...scores completos, si aplica... }
}
```

El `snapshot` se incluye siempre en syncs forzados (awards, salida de sesión, background). En syncs de debounce solo se incluye si hay cambio de owner o si el servidor no tiene datos.

### Guards del sync

- **in-flight**: `speakSyncInFlight` impide syncs concurrentes salvo `force: true`. Tiene un safety timeout de 30s para reset automático si el flag queda stuck.
- **offline**: Si `navigator.onLine === false` el sync retorna sin hacer fetch.
- **sin owner**: Si el usuario no está autenticado (`user:id` no disponible) el sync no se realiza.
- **sin endpoint**: Si `window.trainingStateConfig.syncEndpoint` no está configurado, no hay sync.

---

## 5. Restauración al hacer login

Al autenticar un usuario, si el progreso local está vacío, se intenta restaurar del backend:

```
maybeRestoreSpeakProgressOnLogin(userId)
  ├─ Busca snapshot remoto para "user:{userId}"   → si existe, aplica (replace)
  └─ Si no, busca snapshot para "device:{uuid}"  → si existe, aplica (replace)
```

Esto cubre el caso de usuario que cambia de dispositivo o reinstala la app.

---

## 6. Cómo se muestra el progreso en la UI

La pantalla Training (tab home) lee los scores de `window.r34lp0w3r.speakWordScores` y `.speakPhraseScores` directamente. Estos son los mismos objetos que están en localStorage. La lógica de cálculo está en `home.js`:

- `hasSessionAttempts(session)` → true si algún word/phrase score > 0
- `getSessionPercent(session)` → media de word scores + phrase score
- `getScoreTone(percent)` → `'good'` (≥umbral) / `'okay'` / `'bad'` / `'neutral'` (sin intentar)

El conteo de sesiones completadas en cada módulo incluye las de tone `good` y `okay` (no solo `good`).

---

## 7. Escenarios de posible pérdida de progreso

| Escenario | Estado actual | Mitigación |
|-----------|--------------|------------|
| App cerrada < 4s tras terminar sesión | Sync inmediato al salir, no depende del timer | ✅ Resuelto |
| App cerrada durante sync en vuelo | Los eventos quedan en cola, se reintentarán | ✅ Eventos persistidos |
| localStorage lleno | Score no se persiste en disco, fallo silencioso | ⚠️ No detectado activamente |
| Cambio de dispositivo sin login | Se restaura snapshot del dispositivo anterior si el server lo tiene | ✅ Cubierto |
| Reinstalación sin login | localStorage vacío, no hay forma de recuperar sin cuenta | ⚠️ Sin cuenta = sin backup |
| Sync parcial (ack parcial) | Los no-acked permanecen en cola, máx 500 eventos | ✅ Correcto |

---

## 8. Archivos relevantes

| Archivo | Responsabilidad |
|---------|----------------|
| `www/js/init.js` | Almacenamiento, cola de eventos, `syncSpeakProgress`, `flushSpeakSync`, restauración en login |
| `www/js/pages/speak.js` | Escritura de scores en `finalizeRecording`, trigger de sync al salir |
| `www/js/pages/home.js` | Lectura de scores para mostrar el progreso en Training |

---

## 9. Variables globales clave

```javascript
window.r34lp0w3r.speakWordScores    // {[sessionId]: {[word]: {percent, ts}}}
window.r34lp0w3r.speakPhraseScores  // {[sessionId]: {percent, ts}}
window.r34lp0w3r.speakSessionRewards // {[rewardId]: {qty, ts}}
window.r34lp0w3r.speakBadges         // {[badgeId]: {ts}}

window.syncSpeakProgress(opts)  // Sync puntual con opciones
window.flushSpeakSync(reason)   // Cancela timer + sync forzado inmediato
window.queueSpeakEvent(event)   // Encola evento y programa debounce
window.persistSpeakStores()     // Escribe memoria → localStorage
window.trainingStateConfig      // {syncEndpoint, snapshotEndpoint, ...}
```
