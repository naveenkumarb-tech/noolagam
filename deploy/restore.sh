#!/bin/sh
# Replaces everything on this server with a backup, for moving to a new server or recovering from a loss.
#   deploy/restore.sh backups/database-XXXX.sql.gz backups/photos-XXXX.tar.gz
set -eu

database="$(realpath "$1")"
photos="$(realpath "$2")"
cd "$(dirname "$0")"

docker compose stop api worker
gunzip -c "$database" | docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U noolagam noolagam > /dev/null
gunzip -c "$photos" | docker compose run --rm --no-deps -T --entrypoint "" api tar -C /data/uploads -xf -
docker compose up -d
echo "Restored."
