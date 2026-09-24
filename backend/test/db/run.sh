#!/usr/bin/env bash
# Lunelle database test harness.
#
# Default mode (no Docker needed): creates a throwaway database on the local
# Postgres reachable via the usual PG* env vars, installs a stub `auth` schema
# and the Supabase roles, applies every file in supabase/migrations/ in order
# (each in its own transaction), then runs every backend/test/db/*.test.sql in
# order. The database is dropped on exit, pass or fail.
#
# Supabase mode: set LUNELLE_DB_URL to a database where `supabase db reset` has
# already applied the migrations (e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres).
# The harness then skips creation, stubbing and migration and only runs the tests.
#
# Usage:  npm run test:db        (from backend/)
#         bash backend/test/db/run.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$HERE/../../../supabase/migrations"
export PGOPTIONS='-c client_min_messages=warning'

run_tests() {
  local target=("$@")
  local file
  for file in "$HERE"/*.test.sql; do
    echo "== $(basename "$file")"
    psql -X -q -v ON_ERROR_STOP=1 "${target[@]}" -f "$file"
  done
}

if [ -n "${LUNELLE_DB_URL:-}" ]; then
  echo "Running against existing database (migrations assumed applied)"
  run_tests "$LUNELLE_DB_URL"
  echo "ALL DB TESTS PASSED"
  exit 0
fi

DB="lunelle_dbtest_$$"
CREATED_ROLES=""

cleanup() {
  psql -X -q -d postgres -c "drop database if exists ${DB};" >/dev/null || true
  local r
  for r in $CREATED_ROLES; do
    psql -X -q -d postgres -c "drop role if exists ${r};" >/dev/null || true
  done
}
trap cleanup EXIT

# Roles are cluster-wide. Create only the missing ones and remember them for cleanup.
for r in anon authenticated service_role; do
  if [ "$(psql -X -qtA -d postgres -c "select 1 from pg_roles where rolname='${r}'")" != "1" ]; then
    if [ "$r" = "service_role" ]; then
      psql -X -q -d postgres -c "create role ${r} nologin bypassrls;"
    else
      psql -X -q -d postgres -c "create role ${r} nologin;"
    fi
    CREATED_ROLES="$CREATED_ROLES $r"
  fi
done

psql -X -q -d postgres -c "create database ${DB};"
echo "== stub auth schema"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/stub_auth.sql"

echo "== migrations"
for m in "$MIGRATIONS_DIR"/*.sql; do
  echo "   $(basename "$m")"
  psql -X -q -v ON_ERROR_STOP=1 -1 -d "$DB" -f "$m"
done

run_tests -d "$DB"
echo "ALL DB TESTS PASSED"
