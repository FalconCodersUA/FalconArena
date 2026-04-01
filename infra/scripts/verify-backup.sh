#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: sh infra/scripts/verify-backup.sh <timestamp> [/opt/falconarena-deploy]"
  exit 1
fi

TIMESTAMP="$1"
ROOT_DIR="${2:-/opt/falconarena-deploy}"
BACKUP_DIR="$ROOT_DIR/backups"
DB_FILE="$BACKUP_DIR/falconarena-db-$TIMESTAMP.sql"
STORAGE_FILE="$BACKUP_DIR/falconarena-storage-$TIMESTAMP.tar.gz"
MANIFEST_FILE="$BACKUP_DIR/falconarena-backup-$TIMESTAMP.manifest.txt"

for file in "$DB_FILE" "$STORAGE_FILE" "$MANIFEST_FILE"; do
  if [ ! -f "$file" ]; then
    echo "Required backup file not found: $file"
    exit 1
  fi
done

if [ ! -s "$DB_FILE" ]; then
  echo "Database backup is empty: $DB_FILE"
  exit 1
fi

if [ ! -s "$STORAGE_FILE" ]; then
  echo "Storage backup is empty: $STORAGE_FILE"
  exit 1
fi

EXPECTED_DB_SHA="$(grep '^db_sha256=' "$MANIFEST_FILE" | cut -d= -f2-)"
EXPECTED_STORAGE_SHA="$(grep '^storage_sha256=' "$MANIFEST_FILE" | cut -d= -f2-)"
ACTUAL_DB_SHA="$(sha256sum "$DB_FILE" | awk '{print $1}')"
ACTUAL_STORAGE_SHA="$(sha256sum "$STORAGE_FILE" | awk '{print $1}')"

if [ "$EXPECTED_DB_SHA" != "$ACTUAL_DB_SHA" ]; then
  echo "Database backup checksum mismatch"
  exit 1
fi

if [ "$EXPECTED_STORAGE_SHA" != "$ACTUAL_STORAGE_SHA" ]; then
  echo "Storage backup checksum mismatch"
  exit 1
fi

tar -tzf "$STORAGE_FILE" >/dev/null

echo "Backup set verified successfully for timestamp $TIMESTAMP"
echo "  db:       $DB_FILE"
echo "  storage:  $STORAGE_FILE"
echo "  manifest: $MANIFEST_FILE"
