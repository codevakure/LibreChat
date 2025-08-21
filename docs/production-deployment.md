# Production Deployment Guide

This guide covers deploying LibreChat with multi-database support in production environments.

## Overview

LibreChat now supports both MongoDB and PostgreSQL databases with comprehensive health monitoring, performance optimization, and production-ready configurations.

## Prerequisites

- Docker & Docker Compose
- At least 4GB RAM
- 20GB+ disk space
- Domain name with SSL certificate (recommended)

## Quick Start

### 1. Choose Your Database

```bash
# For PostgreSQL (recommended for new deployments)
./scripts/production-deployment.sh postgresql

# For MongoDB (existing LibreChat users)
./scripts/production-deployment.sh mongodb

# Interactive mode (guided setup)
./scripts/production-deployment.sh
```

### 2. Configuration

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` with your production settings:
```bash
# Database Configuration
DATABASE_TYPE=postgresql  # or mongodb
DATABASE_URL=postgresql://user:password@postgres:5432/librechat

# Production Settings
NODE_ENV=production
LOG_LEVEL=info
SESSION_SECRET=your-super-secret-session-key

# Security
ALLOW_REGISTRATION=false
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# Monitoring
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
```

### 3. Deploy

```bash
# Start production services
docker-compose -f docker-compose.production.yml up -d

# Check service health
curl http://localhost:3080/health
```

## Database-Specific Configurations

### PostgreSQL Production Setup

```yaml
# docker-compose.postgresql.production.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: librechat
      POSTGRES_USER: librechat
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    command: |
      postgres
      -c max_connections=200
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=4MB
      -c maintenance_work_mem=64MB
```

**Performance Tuning:**
- Connection pooling enabled (max 20 connections)
- Prepared statement caching
- Query performance monitoring
- Automatic slow query detection

### MongoDB Production Setup

```yaml
# docker-compose.mongodb.production.yml
services:
  mongodb:
    image: mongo:7-jammy
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - mongodb_data:/data/db
      - ./backups:/backups
    command: mongod --auth --replSet rs0
```

**MongoDB Configuration:**
- Replica set for high availability
- Authentication enabled
- Automated backups
- Index optimization

## Health Monitoring

### Health Check Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Basic health status | Simple up/down status |
| `/health/detailed` | Comprehensive health | Full system diagnostics |
| `/health/database` | Database-specific health | Connection & performance metrics |
| `/health/search` | Search engine health | MeiliSearch status |
| `/health/system` | System resources | Memory, CPU, disk usage |
| `/health/readiness` | Kubernetes readiness | Ready for traffic |
| `/health/liveness` | Kubernetes liveness | Service is alive |
| `/health/metrics` | Prometheus metrics | Performance metrics |

### Monitoring Integration

**Prometheus Configuration:**
```yaml
scrape_configs:
  - job_name: 'librechat'
    static_configs:
      - targets: ['librechat:3080']
    metrics_path: '/health/metrics'
    scrape_interval: 15s
```

**Kubernetes Health Checks:**
```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3080
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Backup & Recovery

### Automated Backups

PostgreSQL backups run automatically:
```bash
# Manual backup
./scripts/postgresql-backup.sh

# Restore from backup
docker exec -i postgres pg_restore -U librechat -d librechat < backup.sql
```

MongoDB backups:
```bash
# Manual backup
./scripts/mongodb-backup.sh

# Restore from backup
docker exec -i mongodb mongorestore --db librechat /backups/latest
```

### Backup Retention

- Daily backups retained for 7 days
- Weekly backups retained for 4 weeks
- Monthly backups retained for 6 months

## Performance Optimization

### Database Performance

**PostgreSQL:**
- Connection pooling (20 max connections)
- Prepared statement caching
- Query performance monitoring
- Automatic VACUUM and ANALYZE

**MongoDB:**
- Compound indexes on frequently queried fields
- Read preference secondary for analytics
- Connection pooling
- Write concern majority

### Application Performance

- Gzip compression enabled
- Static asset caching
- Session store optimization
- Memory usage monitoring

### System Resources

**Recommended Specifications:**

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| Memory | 4GB | 8GB+ |
| Storage | 20GB SSD | 100GB+ SSD |
| Network | 100Mbps | 1Gbps |

## Security Considerations

### Database Security

- Database authentication enabled
- Network isolation with Docker networks
- Regular security updates
- Encrypted connections (SSL/TLS)

### Application Security

- HTTPS enforced in production
- Secure session configuration
- CSRF protection enabled
- Rate limiting implemented

### Environment Security

```bash
# Secure file permissions
chmod 600 .env
chmod +x scripts/*.sh

# Regular updates
docker-compose pull
docker-compose up -d --remove-orphans
```

## Scaling & Load Balancing

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  librechat:
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### Load Balancer Configuration

**Nginx:**
```nginx
upstream librechat {
    server librechat_1:3080;
    server librechat_2:3080;
    server librechat_3:3080;
}

server {
    listen 443 ssl;
    location / {
        proxy_pass http://librechat;
        proxy_set_header Host $host;
    }
    
    location /health {
        access_log off;
        proxy_pass http://librechat;
    }
}
```

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check database health
curl http://localhost:3080/health/database

# View database logs
docker-compose logs postgres  # or mongodb
```

**Performance Issues:**
```bash
# Check system metrics
curl http://localhost:3080/health/system

# Monitor container resources
docker stats
```

**Health Check Failures:**
```bash
# Detailed health report
curl http://localhost:3080/health/detailed

# Check application logs
docker-compose logs librechat
```

### Log Analysis

```bash
# Application logs
docker-compose logs -f librechat

# Database performance logs
docker-compose logs postgres | grep "slow query"

# System metrics
curl http://localhost:3080/health/metrics
```

## Maintenance

### Regular Maintenance Tasks

1. **Daily:**
   - Monitor health dashboards
   - Check backup completion
   - Review error logs

2. **Weekly:**
   - Update Docker images
   - Review performance metrics
   - Clean up old backups

3. **Monthly:**
   - Security updates
   - Database optimization
   - Capacity planning review

### Update Process

```bash
# 1. Backup current state
./scripts/postgresql-backup.sh  # or mongodb-backup.sh

# 2. Pull latest images
docker-compose pull

# 3. Update with zero downtime
docker-compose up -d --remove-orphans

# 4. Verify health
curl http://localhost:3080/health/detailed
```

## Support & Resources

- **Documentation:** [LibreChat Docs](https://docs.librechat.ai)
- **Community:** [Discord](https://discord.librechat.ai)
- **Issues:** [GitHub Issues](https://github.com/danny-avila/LibreChat/issues)
- **Performance Monitoring:** Built-in health endpoints
- **Metrics Integration:** Prometheus-compatible metrics

For additional support with production deployments, consult the community resources or review the comprehensive health monitoring data available through the `/health/*` endpoints.
