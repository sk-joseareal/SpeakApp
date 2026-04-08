# SpeakApp Content Dashboard: Guía de uso para editores

Documento práctico para que cualquier persona del equipo pueda usar el dashboard sin curva técnica.

## 1) Qué es y para qué sirve

El dashboard permite gestionar el contenido de training de SpeakApp:

- Routes
- Módulos
- Sesiones
- Contenido interno de cada sesión (sound, spelling, sentence)
- Publicación y rollback de releases

La idea es trabajar en **draft**, validar, y publicar cuando esté listo.

## 2) Quién hace qué (roles)

Hay tres roles de usuario:

- `editor`: puede cargar/editar/guardar draft.
- `publisher`: además puede publicar draft y restaurar draft desde release.
- `admin`: además puede crear/gestionar usuarios editores y ver auditoría.

Regla simple:

- Si solo editas contenido, eres `editor`.
- Si también publicas en producción, necesitas `publisher`.
- Si gestionas usuarios y permisos, necesitas `admin`.

## 3) Requisitos antes de entrar

- URL dashboard: `https://content.curso-ingles.com`
- Usuario editor activo (email + password)
- El servicio debe tener `CONTENT_JWT_SECRET` configurado en backend.

## 4) Primer acceso

1. Entra en la URL del dashboard.
2. Introduce `Email editor` y `Password`.
3. Pulsa `Login`.
4. Verifica que aparece el resumen de sesión (nombre/rol).

Si falla login:

- Revisa email/password.
- Revisa que el usuario esté activo.
- Si persiste, un admin debe resetear password o activar usuario.

## 5) Qué hay en la pantalla (mapa rápido)

## Bloque de sesión

- `Login` / `Logout`
- Estado de sesión (quién eres y rol)

## Bloque de acciones de contenido

- `Health`: chequeo rápido del servicio.
- `Cargar draft`: trae el borrador actual editable.
- `Cargar público`: trae lo publicado.
- `Validar JSON`: valida la estructura del JSON.
- `Guardar draft`: guarda el contenido draft actual.
- `Publicar draft`: crea y publica una release (requiere `publisher`).

## Bloque de lock (evitar pisados entre editores)

- `Tomar lock`: reserva edición de draft para tu usuario.
- `Liberar lock`: libera el lock al terminar.
- `Refrescar lock`: actualiza el estado del lock.

Si otra persona tiene el lock, las escrituras devuelven `draft_locked_by_other`.

## Bloque de modo de edición

- `Editor`: edición por formularios (recomendado para uso diario).
- `JSON`: edición avanzada del payload completo.
- `Aplicar JSON`: aparece solo si modificaste manualmente el JSON.

## Bloque Copys app (JSON)

- `Cargar copys`: carga el JSON de copys guardado en servidor.
- `Validar copys`: valida que el JSON tenga raíz `es` y `en`.
- `Guardar copys`: persiste el JSON de copys (no crea release).
- Uso recomendado: editar aquí y luego copiar manualmente a `www/js/content/copy.js` en el repo/app.

## Bloque Editor (formulario)

Vista en 4 columnas:

- Routes
- Módulos
- Sesiones
- Contenido de sesión

## Bloque Releases

- Lista de releases recientes.
- `Publicar esta release`.
- `Restaurar a draft` (rollback de contenido de trabajo).
- `Verificar audios` (cobertura TTS EN/ES de la release).
- `Generar audios` (solo release publicada).

## Bloque Editors (solo admin)

- Crear nuevo editor.
- Cambiar rol, activar/desactivar y resetear password.

## 6) Flujo recomendado por rol

## Flujo editor (día a día)

1. Login.
2. `Tomar lock`.
3. `Cargar draft`.
4. Editar en `Editor`.
5. `Guardar draft`.
6. `Liberar lock`.

## Flujo publisher (publicación)

1. Login.
2. `Tomar lock`.
3. `Cargar draft`.
4. Revisión final.
5. `Publicar draft` (pon nombre de release claro).
6. En bloque `Releases`: `Verificar audios` y después `Generar audios`.
7. `Liberar lock`.

## Flujo admin (gestión de usuarios)

1. Login.
2. Ir a bloque `Editors`.
3. Crear usuario con rol mínimo necesario.
4. Pasar credenciales iniciales por canal seguro.
5. Pedir cambio de password al primer acceso.

## 7) Cuándo usar Editor vs JSON

Usa `Editor` en casi todos los casos.

Usa `JSON` solo cuando:

- Necesites copiar/pegar bloques grandes de contenido.
- Hagas cambios estructurales masivos.
- Quieras revisar el payload completo.

Regla práctica:

- Si dudas, usa `Editor`.

## 8) Checklist antes de publicar

- Lock tomado por ti.
- Draft cargado y guardado sin errores.
- Títulos/IDs revisados.
- Estructura route → módulo → sesión coherente.
- Contenido de sesiones revisado.
- Release name claro (ejemplo: `release-1.1.0-content-fixes`).
- Tras publicar: verificar/generar audios TTS de la release publicada.

## 9) Incidencias comunes y solución rápida

`401 unauthorized`

- No hay sesión JWT válida.
- Haz login de nuevo.

`403 forbidden`

- Tu rol no tiene permisos para esa acción.
- Pide elevación temporal o que lo ejecute un rol mayor.

`409 draft_locked_by_other`

- Otra persona tiene lock activo.
- Coordina y espera o que lo libere.

No aparece `Aplicar JSON`

- Es normal.
- Solo aparece cuando editas manualmente el textarea JSON.

## 10) Buenas prácticas de equipo

- No editar sin lock.
- Publicar con nombres de release legibles.
- Evitar cambios grandes sin guardar intermedio.
- Si hay dudas de contenido, guardar draft y pedir revisión antes de publicar.
- Mantener 1 persona publicando por ventana de cambios.

## 11) Resumen operativo

- Editar: `editor`
- Publicar: `publisher`
- Gestionar usuarios: `admin`
- Siempre con JWT + lock
