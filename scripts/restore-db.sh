#!/bin/bash
# Restores warranted.db from a backup file. Stops nothing for you — stop the
# bot first (sudo systemctl stop warranted-bot) so it isn't writing to the
# database while you swap it out.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
DB_PATH="$PROJECT_DIR/warranted.db"

if [ $# -eq 0 ]; then
  echo "Usage: ./scripts/restore-db.sh <backup-filename>"
  echo ""
  echo "Available backups:"
  ls -1t "$BACKUP_DIR" | grep '\.db$' || echo "  (none found)"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: $BACKUP_FILE not found."
  echo "Available backups:"
  ls -1t "$BACKUP_DIR" | grep '\.db$' || echo "  (none found)"
  exit 1
fi

if [ -f "$DB_PATH" ]; then
  SAFETY_COPY="$DB_PATH.before-restore-$(date +%Y%m%d-%H%M%S)"
  cp "$DB_PATH" "$SAFETY_COPY"
  echo "Current database saved as $(basename "$SAFETY_COPY") just in case."
fi

cp "$BACKUP_FILE" "$DB_PATH"
rm -f "$DB_PATH-wal" "$DB_PATH-shm"

echo "Restored from $1. Start the bot again with: sudo systemctl start warranted-bot"
