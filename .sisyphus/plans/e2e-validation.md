# Plan: E2E Validation con Docker Stack

## TL;DR

> **Objective**: Validar el MVP completo ejecutando tests E2E con la infraestructura real (PostgreSQL, TimescaleDB, TimesFM, ClearML, MinIO, Mosquitto)

> **Deliverables**:
> - Docker stack corriendo completamente
> - Migrations aplicadas
> - E2E tests ejecutados
> - Reporte de resultados

---

## Context

El MVP de Kairo esta ~95% completo. La arquitectura core esta terminada pero no se ha validado con la infraestructura real. Los E2E tests existentes (auth, user-management, signal-import, prediction, training) requieren el stack completo para ejecutarse.

## Work Objectives

### Core Objective
Ejecutar la validacion E2E del MVP usando Docker Compose para levantar toda la infraestructura.

### Concrete Deliverables
1. Docker stack corriendo sin errores
2. Database migrations aplicadas
3. E2E tests completados
4. Reporte de coverage y issues encontrados

### Definition of Done
- [ ] `docker-compose up -d` corre sin errores
- [ ] PostgreSQL + TimescaleDB accesibles
- [ ] TimesFM service respondiendo
- [ ] ClearML agent registrado
- [ ] MinIO accesible
- [ ] Mosquitto (MQTT) corriendo
- [ ] Auth (GoTrue) funcionando
- [ ] Al menos 1 E2E test pasando end-to-end

---

## Execution Strategy

### Wave 1: Docker Stack Verification
1.1. Verificar docker-compose.yml esta completo
1.2. Levantar servicios con `docker-compose up -d`
1.3. Verificar logs de cada servicio
1.4. Fix any startup issues

### Wave 2: Database Setup
2.1. Aplicar migrations de `supabase/migrations/`
2.2. Verificar tablas creadas correctamente
2.3. Verificar RLS policies funcionando
2.4. Insertar datos de test si necesarios

### Wave 3: Service Integration Tests
3.1. Test TimesFM service
3.2. Test MQTT broker connection
3.3. Test MinIO connectivity
3.4. Test auth service

### Wave 4: E2E Tests
4.1. Configurar Playwright para usar Docker URLs
4.2. Ejecutar auth E2E test
4.3. Ejecutar signal-import E2E test
4.4. Documentar resultados

---

## TODOs

- [ ] 1. Verificar docker-compose.yml tiene todos los servicios necesarios

  **What to do**:
  - Leer docker-compose.yml actual
  - Identificar servicios: postgres, pgmq, minio, mosquitto, auth (gotrue), timesfm, clearml
  - Verificar puertos mapeados correctamente
  - Verificar variables de entorno necesarias

  **QA Scenarios**:
  ```
  Scenario: Docker compose validation
    Tool: Bash
    Steps:
      1. cd /Users/alberto/kairo && cat docker-compose.yml
      2. Verificar servicios listados
      3. docker-compose config --quiet (debe retornar 0)
    Expected: docker-compose.yml es valido y tiene todos los servicios
  ```

- [ ] 2. Levantar Docker stack completo

  **What to do**:
  - Ejecutar `docker-compose up -d`
  - Esperar a que todos los servicios esten healthy
  - Verificar logs con `docker-compose logs --tail=50`

  **QA Scenarios**:
  ```
  Scenario: Docker stack startup
    Tool: Bash
    Steps:
      1. docker-compose up -d
      2. sleep 30
      3. docker-compose ps (todos los servicios deben estar running)
      4. docker-compose logs postgres | grep "database system is ready"
    Expected: Todos los servicios corriendo, postgres listo

  Scenario: Individual service health
    Tool: Bash
    Steps:
      1. curl http://localhost:5432 (postgres)
      2. curl http://localhost:9000 (minio)
      3. curl http://localhost:1883 (mosquitto)
      4. curl http://localhost:8001/health (timesfm)
    Expected: Servicios respondiendo
  ```

- [ ] 3. Aplicar database migrations

  **What to do**:
  - Conectar a PostgreSQL
  - Ejecutar migrations en orden: 001-008
  - Verificar tablas creadas

  **QA Scenarios**:
  ```
  Scenario: Migrations applied
    Tool: Bash
    Steps:
      1. PGPASSWORD=postgres psql -h localhost -U postgres -c "\dt" (ver tablas)
      2. PGPASSWORD=postgres psql -h localhost -U postgres -c "\dt notification_channels"
      3. PGPASSWORD=postgres psql -h localhost -U postgres -c "\dt events"
      4. PGPASSWORD=postgres psql -h localhost -U postgres -c "\dt training_jobs"
    Expected: Todas las tablas existen
  ```

- [ ] 4. Test TimesFM service

  **What to do**:
  - Enviar request de inferencia a TimesFM
  - Verificar respuesta

  **QA Scenarios**:
  ```
  Scenario: TimesFM inference
    Tool: Bash (curl)
    Preconditions: TimesFM corriendo en puerto 8001
    Steps:
      1. curl -X POST http://localhost:8001/predict \
         -H "Content-Type: application/json" \
         -d '{"signal_id":"test","context":[1,2,3],"forecast_length":24,"context_length":512,"frequency":3600}'
      2. Verificar status 200 y respuesta tiene forecast array
    Expected: TimesFM devuelve prediccion valida
  ```

- [ ] 5. Configurar y ejecutar E2E tests

  **What to do**:
  - Configurar playwright con URLs de Docker
  - Ejecutar tests sequentially o en paralelo
  - Documentar resultados

  **QA Scenarios**:
  ```
  Scenario: Playwright E2E - Auth flow
    Tool: Playwright
    Preconditions: Docker stack corriendo, app en puerto 3000
    Steps:
      1. npx playwright test auth.spec.ts
      2. Verificar test pasa
    Expected: Login funciona end-to-end

  Scenario: Playwright E2E - Signal import
    Tool: Playwright
    Preconditions: Docker stack corriendo
    Steps:
      1. npx playwright test signal-import.spec.ts
      2. Verificar al menos 1 test pasando
    Expected: Signal import funciona
  ```

---

## Success Criteria

### Verification Commands
```bash
docker-compose ps  # Todos running
curl http://localhost:8001/health  # TimesFM ok
PGPASSWORD=postgres psql -h localhost -U postgres -c "SELECT 1"  # DB ok
npx playwright test --reporter=line  # Tests pasando
```

### Final Checklist
- [ ] Docker stack 100% operativo
- [ ] Todos los servicios accesibles
- [ ] Database con schema correcto
- [ ] Al menos 1 E2E test pasando
- [ ] Issues documentados (si hay)

---

## Blockers Conocidos

1. **Supabase CLI** - GoTrue auth service requiere supabase-cli para desarrollar localmente
2. **TimesFM model** - Modelo necesita ser bajado/preparado antes de usar
3. **ClearML credentials** - Se requieren credenciales de ClearML para agent registration

---

## Nota

Este plan valida la integracion completa. Si los tests fallan, los fixes seran necesarios antes de declarar el MVP completo.