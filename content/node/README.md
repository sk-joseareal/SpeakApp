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

Opcional: definir token admin (`CONTENT_ADMIN_TOKEN`) para proteger endpoints de edición.

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
- Editor guiado (MVP): alta/edición/reordenación de `routes`, `modules` y `sessions`
  - En sesiones: edición de `focus`, `progress`, `status`, `sound`, `spelling(words)` y `sentence`
- Modo JSON avanzado para edición completa `{ routes, modules, sessions }`
- Validar estructura básica del JSON en cliente
- Guardar draft (`PUT /content/admin/training-data`)
- Publicar draft con nombre de release (`POST /content/admin/publish`)
- Ver releases y ejecutar:
  - publicar release existente
  - restaurar draft desde release

Si `CONTENT_ADMIN_TOKEN` está activo, introduce el token en el campo “Admin token”; el dashboard lo enviará como header `x-content-token`.

## Endpoints

### Público

- `GET /content/health`
- `GET /content/training-data`
  - Devuelve release publicada.
  - Si no hay release publicada, devuelve borrador live.
  - `?preview=1` devuelve live preview (requiere token admin si está habilitado).

### Admin (requiere token si `CONTENT_ADMIN_TOKEN` no está vacío)

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

## Auth admin

Enviar token en uno de estos formatos:

- Header `x-content-token: <token>`
- Header `Authorization: Bearer <token>`

## Ejemplos

Importar JSON actual y publicar:

```bash
curl -X POST 'http://localhost:8791/content/admin/import/training-json' \
  -H 'Content-Type: application/json' \
  -H 'x-content-token: YOUR_TOKEN' \
  -d '{"publish":true,"releaseName":"initial-import"}'
```

Obtener contenido publicado:

```bash
curl 'http://localhost:8791/content/training-data'
```

Publicar un release existente:

```bash
curl -X POST 'http://localhost:8791/content/admin/releases/3/publish' \
  -H 'x-content-token: YOUR_TOKEN'
```

## Notas operativas

- SQLite está en `content/node/data/content.db` (por defecto).
- Usa `WAL` para mejorar concurrencia de lectura.
- Para producción: backup periódico del `.db` (por ejemplo a S3).
