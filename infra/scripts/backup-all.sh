#!/usr/bin/env sh
set -eu

ROOT_DIR="${1:-/opt/falconarena-deploy}"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +%F-%H%M%S)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/infra/docker-compose/.env"

mkdir -p "$BACKUP_DIR"

echo "Creating full FalconArena backup set for $TIMESTAMP"

sh "$ROOT_DIR/infra/scripts/backup-db.sh" "$ROOT_DIR" "$TIMESTAMP"
sh "$ROOT_DIR/infra/scripts/backup-storage.sh" "$ROOT_DIR" "$TIMESTAMP"

DB_FILE="$BACKUP_DIR/falconarena-db-$TIMESTAMP.sql"
STORAGE_FILE="$BACKUP_DIR/falconarena-storage-$TIMESTAMP.tar.gz"
MANIFEST_FILE="$BACKUP_DIR/falconarena-backup-$TIMESTAMP.manifest.txt"

DB_SIZE="$(wc -c < "$DB_FILE" | tr -d ' ')"
STORAGE_SIZE="$(wc -c < "$STORAGE_FILE" | tr -d ' ')"
DB_SHA="$(sha256sum "$DB_FILE" | awk '{print $1}')"
STORAGE_SHA="$(sha256sum "$STORAGE_FILE" | awk '{print $1}')"

{
  echo "timestamp=$TIMESTAMP"
  echo "root_dir=$ROOT_DIR"
  echo "compose_file=$COMPOSE_FILE"
  echo "env_file=$ENV_FILE"
  echo "db_file=$(basename "$DB_FILE")"
  echo "db_size_bytes=$DB_SIZE"
  echo "db_sha256=$DB_SHA"
  echo "storage_file=$(basename "$STORAGE_FILE")"
  echo "storage_size_bytes=$STORAGE_SIZE"
  echo "storage_sha256=$STORAGE_SHA"
} > "$MANIFEST_FILE"

echo "Created:"
echo "  $DB_FILE"
echo "  $STORAGE_FILE"
echo "  $MANIFEST_FILE"
