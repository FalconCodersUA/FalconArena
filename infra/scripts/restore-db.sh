#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: sh infra/scripts/restore-db.sh <backup-file> [/opt/falconarena-deploy]"
  exit 1
fi

BACKUP_FILE="$1"
ROOT_DIR="${2:-/opt/falconarena-deploy}"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/infra/docker-compose/.env"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Restoring PostgreSQL from: $BACKUP_FILE"
cat "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -lc 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "Restore completed"
