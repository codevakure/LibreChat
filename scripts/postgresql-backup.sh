#!/bin/bash
# postgresql-backup.sh - PostgreSQL Backup Script
# Automated backup script for PostgreSQL database with rotation

set -e

# Configuration
POSTGRES_HOST=${POSTGRES_HOST:-postgresql}
POSTGRES_USER=${POSTGRES_USER:-librechat_user}
POSTGRES_DB=${POSTGRES_DB:-librechat}
BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/librechat_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo "Starting PostgreSQL backup at $(date)"
echo "Database: ${POSTGRES_DB}"
echo "Host: ${POSTGRES_HOST}"
echo "User: ${POSTGRES_USER}"
echo "Backup file: ${BACKUP_FILE_GZ}"

# Create database backup
pg_dump -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --verbose \
  --no-password \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_FILE}"

# Verify backup file was created
if [ -f "${BACKUP_FILE_GZ}" ]; then
    BACKUP_SIZE=$(stat -c%s "${BACKUP_FILE_GZ}")
    echo "Backup completed successfully"
    echo "Backup size: ${BACKUP_SIZE} bytes"
else
    echo "ERROR: Backup file was not created"
    exit 1
fi

# Clean up old backups
echo "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "librechat_backup_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete

# List remaining backups
echo "Remaining backups:"
ls -la "${BACKUP_DIR}"/librechat_backup_*.sql.gz 2>/dev/null || echo "No backup files found"

echo "PostgreSQL backup completed at $(date)"
