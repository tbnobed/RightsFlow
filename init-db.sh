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

# Run Drizzle migrations using npx to ensure it finds drizzle-kit
npx drizzle-kit push

echo "Database initialization complete!"
