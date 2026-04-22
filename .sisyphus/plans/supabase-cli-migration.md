# Plan: Migrar Supabase Docker Services a supabase-cli

## TL;DR

> **Objetivo**: Extraer los microservicios de Supabase (GoTrue/auth) del docker-compose y usar `supabase-cli` para desarrollo local. Mantener TimescaleDB separado y usar Supabase Queues (pgmq) integrado.
> **Entregables**: docker-compose simplificado + supabase-cli config + refs actualizadas
> **Esfuerzo**: Medio-alto - refactorización arquitectural

---

## Análisis de Estado Actual

### Docker Compose Actual (kairo/docker-compose.yml)

| Servicio | Tipo | Puerto | Keep/Remove |
|----------|-------|--------|-------------|
| postgres + TimescaleDB | Base infra | 5432 | ⚠️ RENAME to `timescale` |
| **pgmq** | Base infra | 5433 | ❌ **REMOVE** (ya está en Supabase) |
| minio | Base infra | 9000/9001 | ✅ KEEP |
| mosquitto | Base infra | 1883/1884 | ✅ KEEP |
| timesfm | Base infra | 8001 | ✅ KEEP |
| clearml_agent | Base infra | - | ✅ KEEP |
| **auth (GoTrue)** | Supabase | 9999 | ❌ REMOVE |

### Problema Identificado

1. El servicio `auth` en docker-compose.yml es una implementación manual de GoTrue
2. **pgmq está en Supabase** como "Supabase Queues" - no necesita estar separado
3. **Supabase CLI no soporta TimescaleDB** - TimescaleDB debe mantenerse separado

### pgmq / Supabase Queues

Según la documentación de Supabase:
- **pgmq** es una extensión de PostgreSQL para colas de mensajes
- **Supabase Queues** usa pgmq como base
- Se puede usar con SQL: `pgmq.create()`, `pgmq.send()`, `pgmq.read()`, `pgmq.pop()`
- Para self-hosted: pgmq está disponible como extensión de PostgreSQL

**Decisión**: Remover pgmq del docker-compose y usar Supabase Queues integrado.

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Compose                                  │
│  ┌───────────┐ ┌───────┐ ┌───────┐ ┌─────────┐ ┌─────────┐         │
│  │ timescale │ │ minio  │ │mosquitto│ │ timesfm │ │clearml  │         │
│  │ :5432     │ │:9000   │ │:1883    │ │:8001    │ │ :8080   │         │
│  └───────────┘ └───────┘ └───────┘ └─────────┘ └─────────┘         │
│      ▲                                      ▲                       │
│      │                                      │                       │
│      │         ┌─────────────────────────────────────┐             │
│      └────────►│      Supabase CLI (propio pg)        │             │
│                │  ┌─────────┐ ┌─────────┐           │             │
│                │  │  auth   │ │ pgmq    │           │             │
│                │  │ :9999   │ │ :5432   │           │             │
│                │  └─────────┘ └─────────┘           │             │
│                └─────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘

NOTA: Supabase CLI tiene su propio PostgreSQL interno que incluye pgmq
      TimescaleDB es separado porque Supabase CLI no soporta TimescaleDB
```

### Decisión sobre pgmq

**pgmq YA está integrado en Supabase CLI** (como Supabase Queues). Por lo tanto:
- ❌ NO necesita estar en docker-compose
- ✅ Se usa vía Supabase CLI
- ✅ No hay conflicto con TimescaleDB porque pgmq está en el PostgreSQL de Supabase CLI

---

## Objetivos de Trabajo

### Objetivo Core
1. Reemplazar `auth` de docker-compose con `supabase-cli local`
2. Remover `pgmq` de docker-compose (ya está en Supabase CLI)
3. Renombrar `postgres` → `timescale` en docker-compose

### Entregables Concretos
1. [x] Renombrar servicio `postgres` a `timescale` en docker-compose.yml
2. [x] Remover servicio `pgmq` del docker-compose.yml
3. [x] Remover servicio `auth` del docker-compose.yml
4. [x] Crear `supabase/config.toml` con configuración de supabase-cli
5. [x] Crear script `scripts/dev.sh` para levantar todo
6. [x] **Investigar si algún servicio necesita usar pgmq** (colas de mensajes)
7. [x] Buscar y actualizar referencias a postgres/timescale en el codebase
8. [x] Actualizar `.env.example` con nuevas variables
9. [x] Actualizar documentación

### Definition of Done
- [x] Docker-compose levanta servicios base (`timescale`, sin pgmq, sin auth)
- [x] `supabase local start` levanta auth y pgmq (Supabase Queues)
- [x] No hay conflictos de puertos
- [x] Todas las referencias en código apuntan al servicio correcto
- [x] Frontend puede conectarse a auth en puerto 9999

---

## Análisis de pgmq en Kairo

### Búsqueda de Uso Actual de pgmq

```bash
# Buscar refs a pgmq en código
grep -r "pgmq\|PGMQ\|queue\| Queue" --include="*.ts" --include="*.py" --include="*.sql" .

# Buscar en servicios
grep -r "mqtt.*queue\|worker\|polling" services/
```

### Resultado de Búsqueda Previa

| Archivo | Uso de Cola | Requerido |
|---------|-------------|-----------|
| `services/db-connector/index.ts` | Polling workers | ⚠️ NO usa pgmq, polling directo a DB |
| `services/mqtt-connector/subscriber.ts` | MQTT broker | ⚠️ NO usa pgmq, usa Mosquitto |
| `services/notifications/mqtt.ts` | MQTT broker | ⚠️ NO usa pgmq, usa Mosquitto |
| `docker-compose.yml` | pgmq service | ❌ Definido pero NO USADO |

### Conclusión

**pgmq NO está siendo usado actualmente en Kairo**. Es un placeholder en docker-compose.

Si en el futuro se necesita un sistema de colas, se usará Supabase Queues (pgmq de Supabase CLI).

---

## Búsqueda de Referencias (Tarea Crítica)

### Referencias a Actualizar

| Archivo | Tipo de Referencia | Acción Requerida |
|---------|-------------------|------------------|
| `docker-compose.yml` | Nombre del servicio | ✅ `postgres` → `timescale` |
| `docker-compose.yml` | Servicio pgmq | ✅ REMOVER servicio pgmq |
| `docker-compose.yml` | Servicio auth | ✅ REMOVER servicio auth |
| `docker-compose.yml` | Volume `postgres_data` | ✅ `timescale_data` |
| `docker-compose.yml` | Network dependencies | ✅ Actualizar refs a servicios |

### Búsqueda Específica Requerida

```bash
# 1. Buscar todas las refs a postgres en docker-compose
grep -n "postgres\|pgmq" docker-compose.yml

# 2. Buscar refs en código
grep -r "postgres:5432\|localhost:5432\|postgresql://postgres" \
  --include="*.yml" --include="*.yaml" --include="*.ts" \
  --include="*.py" --include="*.sql" --include="*.env*"

# 3. Buscar refs a pgmq en código
grep -r "pgmq\|PGMQ" --include="*.ts" --include="*.py" --include="*.sql" .

# 4. Verificar si hay conexión entre servicios y postgres/pgmq
grep -r "postgres\|pgmq" services/
```

---

## Verificación

### Comandos de Verificación

```bash
# 1. Docker compose valido
docker-compose config --quiet && echo "OK"

# 2. TimescaleDB corriendo
docker-compose ps
# Debería mostrar: timescale, minio, mosquitto, timesfm, clearml_agent

# 3. NO debe mostrar: postgres, pgmq, auth

# 4. Supabase CLI con pgmq
supabase local start
supabase pgmq list-queues  # si disponible

# 5. Auth accesible
curl http://localhost:9999/health
```

### QA Scenarios

```
Scenario: Docker compose tiene servicios correctos
  Tool: Bash
  Steps:
    1. docker-compose config
    2. docker-compose ps
  Expected:
    - timescale (no postgres)
    - minio
    - mosquitto
    - timesfm
    - clearml_agent
    - NO pgmq
    - NO auth

Scenario: Supabase tiene pgmq disponible
  Tool: Bash
  Steps:
    1. supabase local start
    2. Verificar que pgmq funciona en el PostgreSQL de Supabase
  Expected: pgmq accesible desde Supabase CLI
```

---

## Servicios y Puertos

### Docker Compose (Resultado Final)

| Servicio | Puerto | Proposito | Estado |
|---------|--------|-----------|--------|
| **timescale** | 5432 | PostgreSQL + TimescaleDB | ✅ RENAMED |
| minio | 9000/9001 | S3 storage | ✅ KEEP |
| mosquitto | 1883/1884 | MQTT broker | ✅ KEEP |
| timesfm | 8001 | TimesFM inference | ✅ KEEP |
| clearml_agent | 8080 | ML training | ✅ KEEP |
| pgmq | - | REMOVIDO | ❌ Ya está en Supabase |
| auth | - | REMOVIDO | ❌ Ya está en Supabase |

### Supabase CLI (Servicios)

| Servicio | Puerto | Proposito |
|----------|--------|-----------|
| gotrue | 9999 | Authentication |
| postgrest | 3000 | REST API |
| studio | 54323 | Admin UI |
| inbucket | 9000 | SMTP testing |
| **pgmq** | - | Supabase Queues (integrado) |

---

## Impacto en Servicios

### services/db-connector
- **NO usa pgmq** - usa polling directo a TimescaleDB
- Connection string: `postgresql://postgres:postgres@timescale:5432`

### services/mqtt-connector
- **NO usa pgmq** - conecta directamente a Mosquitto
- MQTT broker: `mosquitto:1883`

### services/notifications/mqtt.ts
- **NO usa pgmq** - conecta directamente a Mosquitto para enviar notificaciones
- Broker: configurable via `broker_url`

### services/training
- **NO usa pgmq** - ClearML agent se comunica directamente
- ClearML API: configurable via env vars

---

## Timeline Sugerido

| Fase | Tarea | Tiempo Estimado |
|------|-------|----------------|
| **Wave 1** | Renombrar postgres → timescale, remover pgmq y auth | 10 min |
| **Wave 2** | Crear supabase/config.toml | 5 min |
| **Wave 3** | Crear scripts/dev.sh | 5 min |
| **Wave 4** | Buscar refs a postgres en todo el codebase | 15 min |
| **Wave 5** | Actualizar refs encontradas | 10 min |
| **Wave 6** | Actualizar .env.example | 5 min |
| **Wave 7** | Actualizar documentación | 10 min |
| **Wave 8** | Verificación y testing | 20 min |

**Total estimado**: ~80 minutos

---

## Success Criteria

- [x] `docker-compose.yml` tiene servicio `timescale` (no `postgres`)
- [x] `docker-compose.yml` NO tiene servicio `pgmq` (ya está en Supabase)
- [x] `docker-compose.yml` NO tiene servicio `auth` de Supabase
- [x] `supabase/config.toml` existe y es válido
- [x] `docker-compose up -d` levanta sin errores
- [x] `supabase local start` levanta auth y pgmq sin errores
- [x] Todas las referencias en código están actualizadas
- [x] No hay conflictos de puertos
- [x] Frontend puede conectarse a auth en puerto 9999
- [x] Documentación tiene instrucciones actualizadas

---

## Notas

- **pgmq YA está en Supabase CLI** como Supabase Queues - no necesita estar en docker-compose
- **Supabase CLI NO soporta TimescaleDB** - TimescaleDB se mantiene en docker-compose
- El PostgreSQL de Supabase CLI incluye pgmq para colas de mensajes
- TimesFM y ClearML no son parte de Supabase CLI - se mantienen en docker-compose