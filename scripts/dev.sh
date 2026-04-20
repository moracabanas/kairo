#!/bin/bash
set -e

echo "=== Starting Kairo Development Environment ==="

# Step 1: Start docker-compose services
# These are the core infrastructure services that Supabase CLI doesn't manage
echo ""
echo ">>> [1/4] Starting docker-compose services (timescale, mosquitto, timesfm, clearml_agent)..."
docker-compose up -d
echo "    Docker-compose services started."

# Step 2: Wait for TimescaleDB to be healthy
# TimescaleDB is critical for time-series data - we must ensure it's ready before proceeding
echo ""
echo ">>> [2/4] Waiting for TimescaleDB to be healthy..."
until docker-compose exec timescale pg_isready -U postgres > /dev/null 2>&1; do
    echo "    Waiting for TimescaleDB..."
    sleep 2
done
echo "    TimescaleDB is healthy."

# Step 3: Start Supabase CLI
# Supabase CLI manages: gotrue (auth), postgrest (REST API), studio (Admin UI), inbucket (SMTP), and postgres with pgmq
echo ""
echo ">>> [3/4] Starting Supabase CLI..."
supabase local start
echo "    Supabase CLI started."

# Step 4: Show status of all services
echo ""
echo ">>> [4/4] Service Status"
echo ""
echo "=== Docker Compose Services ==="
docker-compose ps
echo ""
echo "=== Supabase CLI Services ==="
supabase local status
echo ""
echo "=== Development Environment Ready ==="
echo "    TimescaleDB:  localhost:5432"
echo "    Mosquitto:    localhost:1883"
echo "    Supabase:     http://localhost:54323 (Studio)"
echo "    GoTrue Auth:  http://localhost:9999"
