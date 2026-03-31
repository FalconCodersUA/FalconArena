#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: sh infra/scripts/restore-storage.sh <storage-archive> [/opt/falconarena-deploy]"
  exit 1
fi

ARCHIVE_FILE="$1"
ROOT_DIR="${2:-/opt/falconarena-deploy}"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/infra/docker-compose/.env"

if [ ! -f "$ARCHIVE_FILE" ]; then
  echo "Archive file not found: $ARCHIVE_FILE"
  exit 1
fi

echo "Restoring uploads from: $ARCHIVE_FILE"
cat "$ARCHIVE_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend \
  sh -lc 'mkdir -p /app && tar -xzf - -C /app'

echo "Restore completed"
