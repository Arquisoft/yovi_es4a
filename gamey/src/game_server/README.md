# game_server (HTTP API para GameY)

Este directorio contiene el **servidor HTTP** (basado en **Axum**) que expone el motor `gamey` para ser consumido desde la **webapp**.  
La API está pensada para ser **mantenible** y fácil de evolucionar cuando se integre el futuro módulo de `users`.

## Objetivos

- Exponer el motor de juego por HTTP mediante una API REST versionada (`/api/v1/...`).
- Mantener partidas activas en memoria usando **sesiones** identificadas por `game_id`.
- Soportar dos modos:
  - **HvB** (Human vs Bot)
  - **HvH** (Human vs Human)
- Recordar una configuración básica (tamaño de tablero, bot, quién empieza, etc.) por cliente.
- Permitir modo invitado hoy y migración a usuarios autenticados mañana.

---

## Conceptos clave

### Sesiones (stateful)
A diferencia de una API "stateless" (donde se envía el tablero completo en cada request), aquí el servidor mantiene el estado del juego en memoria.

- Al crear una partida, el servidor devuelve un `game_id`.
- Para jugar una jugada, la webapp envía solo `cell_id` y el `game_id`.
- El servidor aplica la jugada sobre la sesión correspondiente y devuelve el `YEN` actualizado.

### Identidad (Guest / futuro User)
Actualmente no existe módulo de usuarios, así que la identificación se basa en el header:

- `X-Client-Id`: identificador estable del navegador (guardado en localStorage en la webapp).

Esto permite:
- asociar sesiones a un "dueño" (owner)
- recordar configuración por cliente

En el futuro, cuando exista `users`, se podrá resolver `Principal::User { user_id }` y reutilizar el mismo mecanismo.

### Config "recordada"
Se almacena una configuración por `principal` (guest/user):
- `size` (tamaño del tablero)
- `starter` (quién empieza en HvB: `human`/`bot`)
- `bot_id` (solo HvB)
- `hvh_starter` (quién empieza en HvH: `player0`/`player1`)

---

## Endpoints (API v1)

### Salud
- `GET /status` → `"OK"`

### Meta (para Home)
- `GET /api/v1/meta`

Devuelve:
- versión de API
- límites de tamaño de tablero (min/max)
- lista de bots disponibles (registrados en `YBotRegistry`)

### Config recordada
- `GET /api/v1/config`
- `PUT /api/v1/config`

`PUT` valida:
- que `size` esté dentro de `[MIN_BOARD_SIZE, MAX_BOARD_SIZE]`
- si `starter=bot`, entonces `bot_id` debe existir

> Nota: el store actual es in-memory. Está diseñado para poder sustituirse por persistencia real (users/DB) en el futuro.

---

## Modo HvB (Human vs Bot)

### Crear partida
- `POST /api/v1/hvb/games`

Body (overrides opcionales):
```json
{
  "size": 7,
  "starter": "human",
  "bot_id": "random_bot"
}
```

Comportamiento:
- Parte de la config recordada y aplica overrides.
- Valida que `bot_id` exista en el registry.
- Si empieza el bot (`starter=bot`), se aplica automáticamente su primer movimiento.
- Devuelve `game_id` + `yen` + `status`.

### Obtener partida
- `GET /api/v1/hvb/games/{game_id}`

### Jugar (humano)
- `POST /api/v1/hvb/games/{game_id}/moves`

Body:
```json
{ "cell_id": 10 }
```

Comportamiento:
1. Aplica jugada humana (player 0).
2. Si no termina, el servidor calcula y aplica jugada del bot (player 1).
3. Devuelve el `yen` actualizado, el movimiento humano y el del bot, y el estado.

### Eliminar partida
- `DELETE /api/v1/hvb/games/{game_id}` → `{ "deleted": true }`

---

## Modo HvH (Human vs Human)

### Crear partida
- `POST /api/v1/hvh/games`

Comportamiento:
- Usa la config recordada (incluyendo `hvh_starter`) para decidir quién empieza.
- Inicializa `hvh_next_player` con `player0` o `player1`.

### Obtener partida
- `GET /api/v1/hvh/games/{game_id}`

Devuelve:
- `yen`
- `status` coherente con la sesión (turno actual y winner si terminó)

### Jugar
- `POST /api/v1/hvh/games/{game_id}/moves`

Body:
```json
{ "cell_id": 10 }
```

Comportamiento:
- Aplica el movimiento con el jugador del turno (`hvh_next_player`).
- Alterna el turno si la partida continúa.
- Si termina, guarda `hvh_winner` en la sesión y devuelve `Finished`.

### Eliminar partida
- `DELETE /api/v1/hvh/games/{game_id}` → `{ "deleted": true }`

---

## Errores

Las respuestas de error son consistentes:
```json
{
  "message": "Move rejected: ...",
  "code": "move_rejected"
}
```

Códigos HTTP típicos:
- `400` bad_request (input inválido)
- `404` not_found (game_id inexistente, bot desconocido, etc.)
- `409` conflict (movimiento inválido, partida ya finalizada, etc.)
- `500` internal (fallo inesperado)

---

## Estructura de archivos

- `mod.rs`  
  Router principal y registro de rutas. Define constantes como `MIN_BOARD_SIZE`, `MAX_BOARD_SIZE` y arranque del servidor.

- `state.rs`  
  Estado global (`GameServerState`): registry de bots, store de sesiones y store de config recordada.

- `auth.rs`  
  Resolución de identidad (`Principal`) desde headers. Actualmente usa `X-Client-Id` (guest) y queda preparado para futuro `users`.

- `sessions.rs`  
  `SessionStore` in-memory por `game_id`. Define `GameSession` con el `GameY` y campos extra para turnos HvH (`hvh_next_player`) y winner (`hvh_winner`).

- `dto.rs`  
  DTOs compartidos: `GameConfig`, `MetaResponse`, `GameStateResponse`, `GameStatus`, `CellMoveRequest`, etc.  
  Incluye helpers para construir `status` coherente con la sesión.

- `config.rs`  
  Endpoints `GET/PUT /api/v1/config` para consultar/guardar la configuración recordada.

- `hvb.rs`  
  Endpoints HvB: crear partida, obtener estado, jugar (`/moves`), borrar sesión.

- `hvh.rs`  
  Endpoints HvH: crear partida, obtener estado, jugar (`/moves`) con alternancia de turnos, borrar sesión.

- `error.rs`  
  Tipos y helpers de errores HTTP (`ApiErrorResponse`) para respuestas coherentes.

---

## Integración con webapp (resumen)

- La webapp debe enviar siempre `X-Client-Id` (persistido en localStorage).
- Flujo típico:
  1) `GET /api/v1/meta` (Home: límites + bots)
  2) (Opcional) `PUT /api/v1/config` (guardar size/bot/starter/hvh_starter)
  3) `POST /api/v1/hvb/games` o `POST /api/v1/hvh/games`
  4) Renderizar tablero con `yen.layout`
  5) En cada click: `POST /moves` con `{ cell_id }`

---

## Limitaciones actuales (intencionales)

- Stores son **in-memory** (sesiones y config se pierden al reiniciar).
- CORS está abierto para desarrollo; en despliegue se recomienda restringir `allow_origin`.
