# Supabase CLI Migration - Learnings

## Decisions
- pgmq NOT used in Kairo code - just placeholder in docker-compose
- TimescaleDB must stay separate from Supabase CLI (not supported)
- Supabase CLI uses its own PostgreSQL with pgmq built-in
- Services take DB config via constructor injection - no hardcoded postgres:5432

## Completed Changes
1. docker-compose.yml: renamed postgres→timescale, removed pgmq and auth services
2. supabase/config.toml: created with project_id=kairo-local-dev, major_version=15
3. scripts/dev.sh: created startup script
4. .env.example: added TIMESCALE_HOST, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
5. README.md: created with architecture documentation

## pgmq Analysis
- pgmq NOT used in Kairo code
- No code references postgres:5432 for message queues
- Services (db-connector, mqtt-connector, prediction-scheduler) use constructor injection
- Supabase functions use localhost:54321/54322 (Supabase CLI ports)

## Conventions
- Service naming: `postgres` → `timescale`
- pgmq removed (it's in Supabase CLI as Supabase Queues)
- auth removed (it's in Supabase CLI as GoTrue)

## Gotchas
- Supabase CLI does NOT support TimescaleDB - keep separate
- GoTrue auth runs on port 9999 via supabase-cli
- Old docker containers may still be running - need `docker-compose down && up` to refresh

## Config Updates (2026-04-20)
- supabase/config.toml exists and is valid for `supabase local start`
- project_id set to "kairo-local-dev"
- major_version set to 15 (Supabase CLI standard)
- Services enabled: api, db, realtime, studio, inbucket, storage, auth, edge_runtime, analytics

## .env.example Updates
- Renamed `POSTGRES_HOST=postgres` → `TIMESCALE_HOST=timescale` (docker-compose service name)
- Added `SUPABASE_URL=http://localhost:54321` (Supabase CLI API)
- Added `SUPABASE_SERVICE_ROLE_KEY=` (placeholder for Supabase CLI)
- Removed docker auth vars (GOTRUE_*, SMTP_*, OAuth providers) - now handled by Supabase CLI
- Kept POSTGRES_* vars for TimescaleDB backward compatibility
- Added section headers to separate docker-compose vs Supabase CLI vars
- Deprecated vars commented out at bottom for reference

## Startup Script
- Created `scripts/dev.sh` - orchestrates docker-compose + supabase-cli startup
- Order: docker-compose up → wait for TimescaleDB → supabase local start → status
- Shows all service endpoints after startup

## Documentation (2026-04-20)
- No existing architecture documentation found in README.md or DESIGN.md
- DESIGN.md contains only design system tokens, no architecture docs
- Created root-level README.md with architecture overview
- docker-compose.yml already reflected new architecture with comments
- Architecture documented:
  - docker-compose: timescale, minio, mosquitto, timesfm, clearml_agent
  - Supabase CLI: gotrue (9999), postgrest (3001), studio (54323), pgmq (built-in)
- Development setup steps: docker-compose up -d → supabase local start
