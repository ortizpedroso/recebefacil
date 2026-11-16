#!/bin/sh
set -eu
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Defina DATABASE_URL." >&2
  exit 1
fi
dump="${1:?informe o arquivo do pg_dump}"
target="${2:-recebefacil_restore_test}"
admin="${DATABASE_URL%/*}/postgres"
psql "$admin" -c "drop database if exists ${target}"
psql "$admin" -c "create database ${target}"
pg_restore --no-owner --dbname="${DATABASE_URL%/*}/${target}" "$dump"
psql "${DATABASE_URL%/*}/${target}" -c "select count(*) from organizations"
psql "$admin" -c "drop database ${target}"
echo "restauracao conferida"
