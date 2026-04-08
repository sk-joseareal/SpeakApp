# SpeakApp Content Service (SQLite)

Servicio desacoplado para gestionar el contenido de `SpeakApp` (routes/modules/sessions) con SQLite.

## Objetivo del MVP

- Mantener el contenido separado del backend de usuarios/login.
- Servir un endpoint compatible con el formato actual (`training-data.json`).
- Permitir flujo editorial básico:
  1. importar/editar borrador,
  2. publicar release,
  3. rollback a release anterior.

## Setup

```bash
cd content/node
npm install
```

Crear env:

```bash
cp ../.env.example ../.env
```

Configuración recomendada para edición multiusuario:

- `CONTENT_JWT_SECRET` (obligatorio para login de editores por email/password)
- `CONTENT_EDITOR_SEED_EMAIL` + `CONTENT_EDITOR_SEED_PASSWORD` (crea primer admin automáticamente si no hay usuarios)
- `CONTENT_APP_USERS_MYSQL_HOST`, `CONTENT_APP_USERS_MYSQL_PORT`, `CONTENT_APP_USERS_MYSQL_USER`, `CONTENT_APP_USERS_MYSQL_PASSWORD`, `CONTENT_APP_USERS_MYSQL_DATABASE` para habilitar el panel `App Users` directamente contra la RDS legacy
- `CONTENT_APP_USERS_MYSQL_CONNECTION_LIMIT` para ajustar el pool de conexiones
- `CONTENT_APP_USERS_UPSTREAM_URL` + `CONTENT_APP_USERS_UPSTREAM_TOKEN` + `CONTENT_APP_USERS_UPSTREAM_AVATAR_RESET_PATH` si quieres que el botón `Reset` del avatar delegue la regeneración compatible al `backendV4`
- Alternativamente, el servicio acepta `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB`
- `CONTENT_READ_TOKEN` para proteger lectura pública de contenido
- `CONTENT_TTS_ALIGNED_ENDPOINT` + `CONTENT_TTS_ALIGNED_TOKEN` para generar/verificar audios Polly por release
- Ajuste de ráfaga/reintentos en generación: `CONTENT_TTS_ALIGNED_CONCURRENCY`, `CONTENT_TTS_ALIGNED_RETRY_MAX_ATTEMPTS`, `CONTENT_TTS_ALIGNED_RETRY_BASE_DELAY_MS`, `CONTENT_TTS_ALIGNED_RETRY_MAX_DELAY_MS`

## Run

```bash
npm start
```

Por defecto escucha en `:8791`.

## Dashboard

- URL local: `http://localhost:8791/`
- URL alternativa: `http://localhost:8791/dashboard`
- En producción: `https://content.curso-ingles.com/`
- Guía de onboarding de uso: `content/node/DASHBOARD_ONBOARDING.md`

Funciones incluidas:

- Cargar draft actual (`GET /content/admin/training-data`)
- Editor (MVP): alta/edición/reordenación de `routes`, `modules` y `sessions`
  - En sesiones: edición de `focus`, `sound`, `spelling(words)` y `sentence`
- Modo JSON avanzado para edición completa `{ routes, modules, sessions }`
- Editor JSON de copys de app (`{ es, en }`) para revisión rápida (sin versionado)
- Validar estructura básica del JSON en cliente
- Guardar draft (`PUT /content/admin/training-data`)
- Publicar draft con nombre de release (`POST /content/admin/publish`)
- Login JWT para editores (`POST /content/admin/login`)
- Gestión de lock de draft (claim/release) para evitar pisados entre editores
- Gestión de editores (solo rol `admin`)
- Gestión MVP de `App Users` (solo rol `admin`) contra MySQL legacy/RDS
- Ver releases y ejecutar:
  - publicar release existente
  - restaurar draft desde release
  - verificar audios por release
  - generar audios por release publicada

El dashboard usa login por editor (JWT).

## Endpoints

### Público

- `GET /content/health`
- `GET /content/training-data`
  - Devuelve release publicada.
  - Si no hay release publicada, devuelve borrador live.
  - Si `CONTENT_READ_TOKEN` está definido, requiere token de lectura.
  - `?preview=1` devuelve live preview (requiere JWT de editor).

### Admin (requiere JWT de editor)

Auth/usuarios:

- `POST /content/admin/login`
- `GET /content/admin/me`
- `GET /content/admin/editors` (admin)
- `POST /content/admin/editors` (admin)
- `PUT /content/admin/editors/:id` (admin)
- `DELETE /content/admin/editors/:id` (admin)
- `GET /content/admin/app-users/status` (admin)
- `GET /content/admin/app-users?query=&limit=20` (admin)
- `GET /content/admin/app-users/:id` (admin)
- `PUT /content/admin/app-users/:id` (admin)
- `DELETE /content/admin/app-users/:id` (admin)
- `GET /content/admin/audit?limit=100` (admin)

Lock de draft:

- `GET /content/admin/draft-lock`
- `POST /content/admin/draft-lock/claim`
- `POST /content/admin/draft-lock/release`

- `GET /content/admin/training-data`
- `PUT /content/admin/training-data`
  - Reemplaza borrador con payload completo `{ routes, modules, sessions }`.
- `GET /content/admin/app-copy`
  - Lee JSON de copys de app guardado en servidor (`settings.app_copy_json`).
- `PUT /content/admin/app-copy`
  - Guarda JSON de copys de app (requiere raíz `{ es: {...}, en: {...} }`).
- `POST /content/admin/import/training-json`
  - Importa desde `payload` o desde fichero.
  - Body opcional:
    - `payload`: objeto `{ routes, modules, sessions }`
    - `filePath`: ruta a JSON (si no se pasa, usa `www/js/data/training-data.json`)
    - `replace`: `true|false` (default `true`)
    - `publish`: `true|false` (default `false`)
    - `releaseName`: nombre release al publicar
- `POST /content/admin/publish`
  - Crea release desde borrador y la publica.
- `GET /content/admin/releases?limit=30`
  - Query opcional: `include_tts_summary=1` para incluir cobertura de audios por release.
- `POST /content/admin/releases/:id/publish`
  - Publica release existente (rollback rápido).
- `POST /content/admin/releases/:id/restore-draft`
  - Restaura borrador actual a partir de una release.
- `POST /content/admin/releases/:id/tts/verify`
  - Verifica cobertura de audios TTS para hints EN/ES de la release.
  - Body opcional: `locales` (`["en","es"]`), `engine`, `checkRemote` (`true|false`).
- `POST /content/admin/releases/:id/tts/generate`
  - Genera audios TTS faltantes/desactualizados para una release publicada.
  - Body opcional: `locales`, `engine`, `force`, `checkRemote`, `maxItems`.

### Panel `App Users`

El dashboard incluye un panel `App Users` orientado a sustituir la antigua interfaz de administración de usuarios app/web accediendo directamente a la RDS legacy desde `content/node`.

Se habilita solo si existe configuración MySQL (`CONTENT_APP_USERS_MYSQL_*` o `MYSQL_*`). El panel expone estas rutas admin:

- `GET /content/admin/app-users?query=&limit=20`
- `GET /content/admin/app-users/:id`
- `PUT /content/admin/app-users/:id`
- `POST /content/admin/app-users/:id/avatar/reset`
  - Requiere `CONTENT_APP_USERS_UPSTREAM_URL` apuntando al `backendV4` para regenerar un avatar PNG de iniciales compatible con app/web legacy.
- `DELETE /content/admin/app-users/:id`
  - Hoy responde `501`: el borrado real sigue pendiente porque requiere archivado consistente en `deleted_users` y tablas espejo de progreso.

Campos MVP gestionados en el panel:

- Editables: `first_name`, `last_name`, `name`, `is_active`, `expires_date`, `locale`, `lc`, `birthdate`, `sex`, `avatar_file_name`
- Solo lectura: `id`, `email`, `premium`, `image`, `section_progress_count`, `test_progress_count`, `created_at`, `updated_at`

Notas operativas:

- `premium` se deriva de `expires_date`; no hay columna `premium` en la tabla `users`.
- `email` queda en solo lectura porque la base legacy no garantiza unicidad.
- `is_active` se mapea a `banneduntil`; al desactivar además se invalida `token`.
- `avatar_file_name` es editable como source manual; el botón `Reset` genera un PNG de iniciales en S3 vía `backendV4`.
- El progreso sigue siendo solo lectura y se resume desde `user_actions`.

## Auth editores (JWT)

Si defines `CONTENT_JWT_SECRET`, el flujo recomendado es:

1. Crear primer admin con variables seed (`CONTENT_EDITOR_SEED_*`) o vía SQL.
2. Login: `POST /content/admin/login` con `email` y `password`.
3. Usar `Authorization: Bearer <jwt>` en endpoints admin.

Roles:

- `editor`: leer/editar draft.
- `publisher`: además publicar/restaurar releases.
- `admin`: además gestión de editores/auditoría.

En endpoints de escritura, si existe lock activo de otro editor, el servidor devuelve `409 draft_locked_by_other`.

## Auth lectura (opcional)

Si defines `CONTENT_READ_TOKEN`, el endpoint público `GET /content/training-data` exigirá uno de:

- Header `x-content-read-token: <token>`
- Header `x-rt-token: <token>`
- Header `Authorization: Bearer <token>`

## Ejemplos

Importar JSON actual y publicar:

```bash
curl -X POST 'http://localhost:8791/content/admin/import/training-json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -d '{"publish":true,"releaseName":"initial-import"}'
```

Obtener contenido publicado:

```bash
curl 'http://localhost:8791/content/training-data'
```

Publicar un release existente:

```bash
curl -X POST 'http://localhost:8791/content/admin/releases/3/publish' \
  -H 'Authorization: Bearer YOUR_JWT'
```

Verificar audios de una release:

```bash
curl -X POST 'http://localhost:8791/content/admin/releases/3/tts/verify' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"checkRemote":true}'
```

Generar audios de una release publicada:

```bash
curl -X POST 'http://localhost:8791/content/admin/releases/3/tts/generate' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Notas operativas

- SQLite está en `content/node/data/content.db` (por defecto).
- Usa `WAL` para mejorar concurrencia de lectura.
- Para producción: backup periódico del `.db` (por ejemplo a S3).
- El contenido de sesión ya no usa `progress/status`; al arrancar, el servidor migra automáticamente columnas legacy si existen.
- El panel `App Users` no sustituye todavía auth/login/perfil de la app: administra una parte segura del modelo directamente sobre la RDS legacy.
- Recomendado para 2-3 editores:
  1. cada editor hace login con su usuario,
  2. toma lock antes de editar (`Tomar lock`),
  3. guarda/publica,
  4. libera lock al terminar.
