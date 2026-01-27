# Database Migrations

This directory contains SQL migration scripts for the Promissio Rights and Royalties Management application.

## Migration Files

Migrations are plain SQL files that are executed in alphanumeric order. Each migration file follows the naming convention:

```
XXXX_description.sql
```

Where:
- `XXXX` is a four-digit number (e.g., `0001`, `0002`)
- `description` is a brief description of the migration

## Current Migrations

### 0001_initial_schema.sql
Creates the initial database schema including:
- `sessions` table for express-session management
- `users` table with role-based access control
- `contracts` table for IP licensing contracts
- `royalties` table for royalty calculations
- `audit_logs` table for audit trail
- All necessary indexes and constraints

### 0002_add_content_catalog_and_contract_updates.sql
Adds content catalog functionality and updates contracts table:
- `content_items` table for catalog of Films, TV Series, TBN FAST, TBN Linear, WoF FAST
- `contract_content` junction table for many-to-many contract-content linking
- New contract columns: `auto_renew`, `royalty_type`, `flat_fee_amount`, `reporting_frequency`, `payment_terms`, `minimum_payment`, `parent_contract_id`
- Makes `end_date` nullable for auto-renew contracts
- Updates status constraint to include "In Perpetuity"
- Adds performance indexes on commonly queried columns

## Running Migrations

### Automatic (Docker)
Migrations run automatically when the Docker container starts via `init-db.sh`.

### Manual Execution
```bash
# Run all migrations
./migrations/run-migrations.sh

# Or from Docker container
docker-compose exec app /app/migrations/run-migrations.sh
```

## Creating New Migrations

1. Create a new SQL file with the next number:
   ```bash
   touch migrations/0002_your_migration_name.sql
   ```

2. Add your SQL statements:
   ```sql
   -- 0002_your_migration_name.sql
   -- Description of what this migration does
   
   ALTER TABLE users ADD COLUMN new_field VARCHAR;
   CREATE INDEX idx_users_new_field ON users(new_field);
   ```

3. Run migrations:
   ```bash
   ./migrations/run-migrations.sh
   ```

## Migration Best Practices

1. **Idempotent Migrations**: Use `IF NOT EXISTS` and `IF EXISTS` clauses:
   ```sql
   CREATE TABLE IF NOT EXISTS new_table (...);
   ALTER TABLE users ADD COLUMN IF NOT EXISTS new_field VARCHAR;
   ```

2. **Transaction Safety**: Each migration file runs in a single transaction. If any statement fails, the entire migration rolls back.

3. **Backward Compatibility**: Consider backward compatibility when modifying existing tables.

4. **Testing**: Always test migrations on a development database first.

5. **Documentation**: Include comments in migration files explaining what changes are being made and why.

## Schema Reference

The canonical schema is defined in `shared/schema.ts` using Drizzle ORM. Migration files should match this schema definition.

## Troubleshooting

### Migration Fails
1. Check the error message in the application logs
2. Verify SQL syntax
3. Ensure the migration is idempotent
4. Check that referenced tables/columns exist

### Reset Database (Development Only)
```bash
# WARNING: This deletes all data
docker-compose down -v
docker-compose up -d
```

### Manual SQL Execution
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U promissio -d promissio_db

# Run SQL commands
\dt  # List tables
\d users  # Describe users table
```
