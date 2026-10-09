#!/bin/bash
# Runs the database tests against a throwaway Postgres.
# Usage: PGHOST=/tmp PGPORT=5499 PGUSER=postgres supabase/tests/run.sh
set -e
cd "$(dirname "$0")/.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists trek_test" -c "create database trek_test"
$P -d trek_test -c "do \$\$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end \$\$;"
grep -v '^create role' tests/00_supabase_stubs.sql | $P -d trek_test
for f in migrations/*.sql; do $P -d trek_test -f "$f"; done
$P -d trek_test -f seed.sql
$P -d trek_test -f tests/10_security_and_booking.sql
node tests/concurrency.mjs
