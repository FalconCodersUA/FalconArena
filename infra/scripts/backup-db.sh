#!/usr/bin/env sh
set -eu

ROOT_DIR="${1:-/opt/falconarena-deploy}"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/infra/docker-compose/.env"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +%F-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/falconarena-db-$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup: $BACKUP_FILE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_FILE"

echo "Done: $BACKUP_FILE"
