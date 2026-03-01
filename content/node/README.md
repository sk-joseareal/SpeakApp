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
- `CONTENT_READ_TOKEN` para proteger lectura pública de contenido

## Run

```bash
npm start
```

Por defecto escucha en `:8791`.

## Dashboard

- URL local: `http://localhost:8791/`
- URL alternativa: `http://localhost:8791/dashboard`
- En producción: `https://content.speakapp.curso-ingles.com/`

Funciones incluidas:

- Cargar draft actual (`GET /content/admin/training-data`)
- Editor (MVP): alta/edición/reordenación de `routes`, `modules` y `sessions`
  - En sesiones: edición de `focus`, `sound`, `spelling(words)` y `sentence`
- Modo JSON avanzado para edición completa `{ routes, modules, sessions }`
- Validar estructura básica del JSON en cliente
- Guardar draft (`PUT /content/admin/training-data`)
- Publicar draft con nombre de release (`POST /content/admin/publish`)
- Login JWT para editores (`POST /content/admin/login`)
- Gestión de lock de draft (claim/release) para evitar pisados entre editores
- Gestión de editores (solo rol `admin`)
- Ver releases y ejecutar:
  - publicar release existente
  - restaurar draft desde release

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
- `GET /content/admin/audit?limit=100` (admin)

Lock de draft:

- `GET /content/admin/draft-lock`
- `POST /content/admin/draft-lock/claim`
- `POST /content/admin/draft-lock/release`

- `GET /content/admin/training-data`
- `PUT /content/admin/training-data`
  - Reemplaza borrador con payload completo `{ routes, modules, sessions }`.
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
- `POST /content/admin/releases/:id/publish`
  - Publica release existente (rollback rápido).
- `POST /content/admin/releases/:id/restore-draft`
  - Restaura borrador actual a partir de una release.

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

## Notas operativas

- SQLite está en `content/node/data/content.db` (por defecto).
- Usa `WAL` para mejorar concurrencia de lectura.
- Para producción: backup periódico del `.db` (por ejemplo a S3).
- El contenido de sesión ya no usa `progress/status`; al arrancar, el servidor migra automáticamente columnas legacy si existen.
- Recomendado para 2-3 editores:
  1. cada editor hace login con su usuario,
  2. toma lock antes de editar (`Tomar lock`),
  3. guarda/publica,
  4. libera lock al terminar.
