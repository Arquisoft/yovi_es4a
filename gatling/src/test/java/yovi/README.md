# Gatling YOVI — Java DSL

Pruebas de rendimiento para YOVI usando Gatling con Java DSL.

## Estructura

```
src/test/java/yovi/
├── Config.java             ← URLs, credenciales, parámetros de carga
├── Requests.java           ← Cadenas reutilizables (todos los endpoints)
├── SmokeSimulation.java    ← 1 usuario, verifica que todo responde
├── LoadSimulation.java     ← Carga realista con 3 perfiles de usuario
└── StressSimulation.java   ← Escalones 5→10→20→40→60 usuarios
```

## Integrar en el demo existente

Si ya tienes `gatling-maven-plugin-demo-java`, copia los ficheros `.java`
dentro de `src/test/java/` del proyecto demo. No necesitas el `pom.xml` si
el del demo ya tiene la dependencia `gatling-charts-highcharts`.

## Crear usuarios de prueba

Los usuarios deben existir en la BD y estar **verificados** antes de ejecutar:

```bash
# Crear via API
curl -s -X POST http://localhost/api/users/createuser \
  -H "Content-Type: application/json" \
  -d '{"username":"gatling_user1","password":"Password1!","email":"g1@gatling.test","profilePicture":"seniora.png"}'

curl -s -X POST http://localhost/api/users/createuser \
  -H "Content-Type: application/json" \
  -d '{"username":"gatling_user2","password":"Password1!","email":"g2@gatling.test","profilePicture":"seniora.png"}'

curl -s -X POST http://localhost/api/users/createuser \
  -H "Content-Type: application/json" \
  -d '{"username":"gatling_user3","password":"Password1!","email":"g3@gatling.test","profilePicture":"seniora.png"}'

# Verificar directamente en Mongo (sin email real)
docker exec -it mongodb mongosh yovi --eval '
  db.users.updateMany(
    {username: {$in: ["gatling_user1","gatling_user2","gatling_user3"]}},
    {$set: {verified: true}}
  )
'
```

## Ejecutar

### Smoke (siempre primero)

```bash
# Local
mvn gatling:test -Dgatling.simulationClass=yovi.SmokeSimulation

# Azure
YOVI_BASE_URL=https://yovies4a.duckdns.org \
  mvn gatling:test -Dgatling.simulationClass=yovi.SmokeSimulation
```

### Carga

```bash
# Local (10 usuarios por defecto)
mvn gatling:test -Dgatling.simulationClass=yovi.LoadSimulation

# Azure con más carga
YOVI_BASE_URL=https://yovies4a.duckdns.org \
YOVI_RAMP_USERS=30 YOVI_RAMP_SECS=30 YOVI_STEADY_SECS=60 \
  mvn gatling:test -Dgatling.simulationClass=yovi.LoadSimulation
```

### Estrés

```bash
# Local — escalones 5→10→20→40→60, 30 s cada uno
mvn gatling:test -Dgatling.simulationClass=yovi.StressSimulation

# Azure
YOVI_BASE_URL=https://yovies4a.duckdns.org \
  mvn gatling:test -Dgatling.simulationClass=yovi.StressSimulation
```

## Ver resultados

```
target/gatling/<SimulationName>-<timestamp>/index.html
```

## Umbrales configurados

| Métrica              | Smoke | Load   | Stress |
|----------------------|-------|--------|--------|
| p95 tiempo respuesta | —     | < 2 s  | < 5 s  |
| Máximo respuesta     | < 5 s | < 5 s  | < 15 s |
| Tasa de éxito        | 100%  | ≥ 95%  | ≥ 90%  |

## Notas

- Los movimientos usan coordenadas fijas `{"x":0,"y":0,"z":0}`.
  El backend puede devolver 409/422 si la casilla está ocupada — se trata
  como aceptable, el objetivo es medir rendimiento, no lógica de negocio.
- El endpoint `bot-move` con MCTS es el más costoso en CPU. En `StressSimulation`
  observa en qué escalón empieza a subir el p95 — ahí está el cuello de botella.
