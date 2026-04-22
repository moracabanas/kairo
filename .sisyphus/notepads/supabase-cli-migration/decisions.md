# Decisions

## 2026-04-20 - Supabase CLI Migration
1. Remove `pgmq` from docker-compose (already in Supabase CLI as Supabase Queues)
2. Remove `auth` from docker-compose (use supabase-cli instead)
3. Rename `postgres` → `timescale` in docker-compose
4. Keep separate: timescale, minio, mosquitto, timesfm, clearml_agent
