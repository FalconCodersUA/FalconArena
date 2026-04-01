#!/usr/bin/env sh
set -eu

ROOT_DIR="${1:-/opt/falconarena-deploy}"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/infra/docker-compose/.env"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="${2:-$(date +%F-%H%M%S)}"
ARCHIVE_FILE="$BACKUP_DIR/falconarena-storage-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Creating uploads backup: $ARCHIVE_FILE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend \
  sh -lc 'mkdir -p /app/storage && tar -czf - -C /app storage' > "$ARCHIVE_FILE"

echo "Done: $ARCHIVE_FILE"
