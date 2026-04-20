# Kairo

Time series analysis SaaS platform.

## Architecture

Kairo uses a split architecture between docker-compose and Supabase CLI:

### docker-compose Services (Infrastructure)

| Service | Port | Description |
|---------|------|-------------|
| timescale | 5432 | TimescaleDB (PostgreSQL with TimescaleDB extension) |
| mosquitto | 1883/1884 | MQTT broker for IoT data ingestion |
| timesfm | 8001 | TimesFM inference service for forecasting |
| clearml-server | 8080/8081 | ClearML server (API/Web UI) |
| clearml_agent | - | ClearML agent (worker for training) |

### Supabase CLI Services (Application Layer)

Supabase CLI provides built-in services via `supabase local start`:

| Service | Port | Description |
|---------|------|-------------|
| gotrue | 9999 | Authentication (GoTrue) |
| postgrest | 3001 | REST API for database |
| studio | 54323 | Database management UI |
| pgmq | (built-in) | Message queue (Supabase Queues) |
| storage | 54321 | S3-compatible object storage (buckets: models, artifacts) |

### Development Setup

```bash
# 1. Start infrastructure services
docker-compose up -d

# 2. Start Supabase CLI services (auth, API, studio)
supabase local start
```

### Key Architecture Decisions

1. **TimescaleDB separate from Supabase**: Supabase CLI does not support TimescaleDB extension, so it runs as a standalone docker-compose service.

2. **Auth via Supabase CLI**: GoTrue (auth) is provided by `supabase local start` on port 9999.

3. **pgmq via Supabase CLI**: Message queuing is built into Supabase CLI's PostgreSQL as Supabase Queues.

4. **No separate auth/pgmq/minio containers**: These were removed from docker-compose and are now managed by Supabase CLI.

5. **Storage via Supabase CLI**: S3-compatible object storage is provided by `supabase local start` with buckets for models and artifacts.
