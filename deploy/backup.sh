#!/bin/sh
# Saves the database and uploaded photos to deploy/backups, keeping the last 7 of each.
# Copy these off the server as well: a backup on the same disk is lost along with it.
set -eu

cd "$(dirname "$0")"
mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"

docker compose exec -T db pg_dump -U noolagam --clean --if-exists noolagam | gzip > "backups/database-$stamp.sql.gz"
docker compose exec -T api tar -C /data/uploads -cf - . | gzip > "backups/photos-$stamp.tar.gz"

for kind in database photos; do
  ls -1t backups/"$kind"-* | tail -n +8 | xargs -r rm --
done
echo "Saved backups/database-$stamp.sql.gz and backups/photos-$stamp.tar.gz"
