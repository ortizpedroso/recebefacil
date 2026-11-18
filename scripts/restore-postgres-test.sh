#!/bin/sh
set -eu
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Defina DATABASE_URL." >&2
  exit 1
fi
dump="${1:?informe o arquivo do pg_dump}"
target="${2:-recebefacil_restore_test}"
base="${DATABASE_URL%%\?*}"
query="${DATABASE_URL#"$base"}"
server="${base%/*}"
admin="$server/postgres$query"
restored="$server/$target$query"
psql "$admin" -c "drop database if exists ${target}"
psql "$admin" -c "create database ${target}"
pg_restore --no-owner --dbname="$restored" "$dump"
psql "$restored" -c "select count(*) from organizations"
psql "$admin" -c "drop database ${target}"
echo "restauracao conferida"
