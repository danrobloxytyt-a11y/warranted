#!/bin/bash
# Safely snapshots warranted.db using SQLite's built-in backup API (not a
# plain file copy — this matters because the database runs in WAL mode,
# so the .db file alone can be missing recent writes that are still sitting
# in the -wal file. sqlite3 .backup handles that correctly even while the
# bot is running and writing to it.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$PROJECT_DIR/warranted.db"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[$(date)] No database found at $DB_PATH, skipping backup."
  exit 0
fi

if ! command -v sqlite3 &> /dev/null; then
  echo "[$(date)] ERROR: sqlite3 CLI not installed. Run: sudo apt install -y sqlite3"
  exit 1
fi

sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/warranted-$TIMESTAMP.db'"
echo "[$(date)] Backed up to backups/warranted-$TIMESTAMP.db"

# Delete backups older than RETENTION_DAYS to keep the folder from growing forever.
find "$BACKUP_DIR" -name "warranted-*.db" -mtime +$RETENTION_DAYS -delete

COUNT=$(find "$BACKUP_DIR" -name "warranted-*.db" | wc -l)
echo "[$(date)] Backup complete. $COUNT backup(s) retained."
