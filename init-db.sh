#!/bin/bash
# Database initialization script for Docker
set -e

echo "Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to be ready
until PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d postgres -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up - checking if database exists"

# Check if database exists, create if it doesn't
PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" | grep -q 1 || \
PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB"

echo "Database ready - running migrations"

# Set environment variables for migration script
export PGHOST=postgres
export PGPORT=5432
export PGDATABASE=$POSTGRES_DB
export PGUSER=$POSTGRES_USER
export PGPASSWORD=$POSTGRES_PASSWORD

# Run SQL migrations
if [ -f "/app/migrations/run-migrations.sh" ]; then
  echo "Running SQL migrations..."
  /app/migrations/run-migrations.sh
else
  echo "Warning: Migration script not found, attempting drizzle-kit push as fallback"
  npx drizzle-kit push --force
fi

echo "Database initialization complete!"
