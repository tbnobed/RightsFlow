# Docker Deployment Guide

This guide explains how to deploy the Promissio Rights and Royalties Management application using Docker and Docker Compose.

## Architecture

The application automatically switches database drivers based on the environment:
- **Development**: Uses Neon serverless PostgreSQL driver (WebSocket-based)
- **Production/Docker**: Uses standard `pg` PostgreSQL driver for better compatibility and performance

The build process creates optimized production bundles without Vite dependencies.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- At least 2GB of available RAM
- At least 5GB of available disk space

### Installing Docker

If you don't have Docker installed, use the provided installation script:

```bash
# Run the installation script (requires sudo)
sudo bash install-docker.sh
```

This script automatically detects your OS (Ubuntu, Debian, CentOS, Fedora) and installs:
- Docker Engine
- Docker Compose Plugin
- All necessary dependencies

After installation, log out and back in for group permissions to take effect.

## Quick Start

1. **Clone the repository and navigate to the project directory**

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables**
   Edit the `.env` file and set these **required** values:
   
   ```bash
   # Generate a secure SESSION_SECRET (REQUIRED - no default allowed)
   SESSION_SECRET=$(openssl rand -hex 32)
   
   # Set a strong database password
   POSTGRES_PASSWORD=your_secure_database_password_here
   
   # Optionally customize admin credentials
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=your_secure_admin_password
   ```
   
   Your complete `.env` file should look like:
   ```env
   POSTGRES_USER=promissio
   POSTGRES_PASSWORD=your_secure_database_password_here
   POSTGRES_DB=promissio_db
   DATABASE_URL=postgresql://promissio:your_secure_database_password_here@postgres:5432/promissio_db
   SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=SecurePassword123!
   ```

4. **Build and start the services**
   ```bash
   docker-compose up -d
   ```
   
   The application will automatically:
   - Wait for PostgreSQL to be ready
   - Create the database if it doesn't exist
   - Run database migrations
   - Create the admin user
   - Start the web server

5. **Access the application**
   Open your browser and navigate to: `http://localhost:5000`
   
   **Default Admin Credentials:**
   - Email: `admin@example.com` (or your configured `ADMIN_EMAIL`)
   - Password: `admin123` (or your configured `ADMIN_PASSWORD`)
   
   ⚠️ **Important**: Change the admin password immediately after first login!

## Troubleshooting Docker Issues

### "SESSION_SECRET is using a default/placeholder value"
This security feature prevents running with insecure defaults. Fix:
```bash
# Generate a secure secret
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
# Restart
docker-compose restart app
```

### "database does not exist"
The init-db.sh script should handle this automatically. If you see this error:
```bash
# Restart the services
docker-compose down
docker-compose up -d
```

## Configuration

### Environment Variables

The application requires the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `APP_PORT` | External port for the application | `5000` |
| `POSTGRES_USER` | PostgreSQL username | `promissio` |
| `POSTGRES_PASSWORD` | PostgreSQL password | *Required* |
| `POSTGRES_DB` | PostgreSQL database name | `promissio_db` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `DATABASE_URL` | Full database connection string | *Auto-configured* |
| `SESSION_SECRET` | Secret key for session encryption | *Required* |
| `ADMIN_EMAIL` | Default admin user email | `admin@example.com` |
| `ADMIN_PASSWORD` | Default admin user password | `admin123` |
| `ADMIN_FIRST_NAME` | Default admin first name | `System` |
| `ADMIN_LAST_NAME` | Default admin last name | `Administrator` |

### Generating Secure Secrets

For production deployments, generate strong random secrets:

```bash
# Generate SESSION_SECRET (64 characters)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Docker Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Application only
docker-compose logs -f app

# Database only
docker-compose logs -f postgres
```

### Restart services
```bash
docker-compose restart
```

### Stop and remove volumes (WARNING: Deletes all data)
```bash
docker-compose down -v
```

## Database Management

### Run migrations
```bash
docker-compose exec app npm run db:push
```

### Access PostgreSQL CLI
```bash
docker-compose exec postgres psql -U promissio -d promissio_db
```

### Expose PostgreSQL Port (for debugging)
By default, PostgreSQL is not exposed to the host for security reasons. To access it during local development:

1. Uncomment the ports mapping in `docker-compose.yml`:
   ```yaml
   ports:
     - "${POSTGRES_PORT:-5432}:5432"
   ```
2. Restart services: `docker-compose restart postgres`

### Backup database
```bash
docker-compose exec postgres pg_dump -U promissio promissio_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore database
```bash
cat backup_file.sql | docker-compose exec -T postgres psql -U promissio promissio_db
```

## Production Deployment

### Security Checklist

- [ ] Change default `POSTGRES_PASSWORD`
- [ ] Generate strong `SESSION_SECRET` (minimum 32 characters)
- [ ] Update database credentials in `DATABASE_URL`
- [ ] Configure firewall to restrict database access
- [ ] Use HTTPS/TLS for external connections
- [ ] Set up regular database backups
- [ ] Monitor application logs
- [ ] Keep Docker images updated

**Important**: The application enforces secret validation in production mode:
- `SESSION_SECRET` must be set and at least 32 characters
- Default/placeholder secrets will cause the application to fail at startup
- This prevents accidentally running production with insecure defaults

### Reverse Proxy Setup (Nginx)

For production, it's recommended to use a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Health Monitoring

The application provides a health check endpoint:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

## Troubleshooting

### Application won't start

1. Check logs: `docker-compose logs app`
2. Verify database is healthy: `docker-compose ps`
3. Ensure environment variables are set correctly
4. Check port 5000 is not already in use: `lsof -i :5000`

### Database connection errors

1. Check database is running: `docker-compose ps postgres`
2. Verify `DATABASE_URL` format is correct
3. Ensure database has completed initialization
4. Check database logs: `docker-compose logs postgres`

### Cannot access application

1. Verify containers are running: `docker-compose ps`
2. Check firewall rules
3. Ensure port 5000 is exposed: `docker-compose port app 5000`
4. Review application logs for errors

### Out of disk space

1. Remove unused images: `docker image prune -a`
2. Remove unused volumes: `docker volume prune`
3. Clean build cache: `docker builder prune`

## Updating the Application

1. Pull latest changes from repository
2. Rebuild images: `docker-compose build --no-cache`
3. Stop old containers: `docker-compose down`
4. Start new containers: `docker-compose up -d`
5. Run migrations if needed: `docker-compose exec app npm run db:push`

## Scaling

To run multiple application instances:

```bash
docker-compose up -d --scale app=3
```

Note: You'll need to configure a load balancer for this setup.

## Support

For issues or questions, please refer to the main application documentation or contact support.
