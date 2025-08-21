#!/bin/bash
# mongodb-backup.sh - MongoDB Backup Script  
# Automated backup script for MongoDB database with rotation

set -e

# Configuration
MONGO_HOST=${MONGO_HOST:-mongodb}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB=${MONGO_DB:-LibreChat}
BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/librechat_backup_${TIMESTAMP}"

echo "Starting MongoDB backup at $(date)"
echo "Database: ${MONGO_DB}"
echo "Host: ${MONGO_HOST}:${MONGO_PORT}"
echo "Backup path: ${BACKUP_PATH}"

# Create database backup using mongodump
mongodump \
  --host "${MONGO_HOST}:${MONGO_PORT}" \
  --db "${MONGO_DB}" \
  --out "${BACKUP_PATH}" \
  --gzip

# Verify backup directory was created
if [ -d "${BACKUP_PATH}/${MONGO_DB}" ]; then
    BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
    echo "Backup completed successfully"
    echo "Backup size: ${BACKUP_SIZE}"
else
    echo "ERROR: Backup directory was not created"
    exit 1
fi

# Create tar archive of backup
TAR_FILE="${BACKUP_PATH}.tar.gz"
tar -czf "${TAR_FILE}" -C "${BACKUP_DIR}" "librechat_backup_${TIMESTAMP}"

# Remove uncompressed backup directory
rm -rf "${BACKUP_PATH}"

echo "Backup archived to: ${TAR_FILE}"

# Clean up old backups
echo "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "librechat_backup_*.tar.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete

# List remaining backups
echo "Remaining backups:"
ls -la "${BACKUP_DIR}"/librechat_backup_*.tar.gz 2>/dev/null || echo "No backup files found"

echo "MongoDB backup completed at $(date)"
