#!/bin/bash
# Run database migrations in order
set -e

echo "Running database migrations..."

# Extract connection details from DATABASE_URL or use environment variables
DB_HOST="${PGHOST:-postgres}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-${POSTGRES_DB:-promissio_db}}"
DB_USER="${PGUSER:-${POSTGRES_USER:-promissio}}"
DB_PASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD}}"

# Set PGPASSWORD for psql commands
export PGPASSWORD="$DB_PASSWORD"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run each migration file in order
for migration_file in "$SCRIPT_DIR"/*.sql; do
  if [ -f "$migration_file" ]; then
    echo "Running migration: $(basename "$migration_file")"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration_file"
    echo "Completed: $(basename "$migration_file")"
  fi
done

echo "All migrations completed successfully!"
