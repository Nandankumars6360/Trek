#!/bin/bash
# Local Supabase-compatible stack for end-to-end tests:
#   PostgreSQL + Supabase Auth (GoTrue) + PostgREST + a tiny gateway on :54321.
# Needs: a running Postgres with trust auth (PGHOST/PGPORT/PGUSER), and the
# `auth` and `postgrest` release binaries in $BIN.
set -euo pipefail
cd "$(dirname "$0")/../../.."
BIN=${BIN:?set BIN to the folder with auth/ and postgrest}
DB=${E2E_DB:-trek_e2e}
SECRET=${JWT_SECRET:-e2e-super-secret-jwt-token-with-at-least-32-characters}
LOGS=${LOGS:-/tmp/trek-e2e}
mkdir -p "$LOGS"
P="psql -v ON_ERROR_STOP=1 -q"

$P -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
$P -d $DB <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login password 'auth' noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth;
SQL

export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://$PGUSER@127.0.0.1:$PGPORT/$DB?sslmode=disable&search_path=auth"
export GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://localhost:54321/auth/v1
export GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_URI_ALLOW_LIST='http://localhost:3000/**'
export GOTRUE_JWT_SECRET=$SECRET GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn
(cd "$BIN/auth" && ./auth migrate > "$LOGS/auth-migrate.log" 2>&1)

$P -d $DB <<'SQL'
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.extension(name text) returns text language sql immutable as $$ select reverse(split_part(reverse(name), '.', 1)) $$;
SQL
for f in supabase/migrations/*.sql; do $P -d $DB -f "$f"; done
$P -d $DB -f supabase/seed.sql

nohup bash -c "cd '$BIN/auth' && exec ./auth serve" > "$LOGS/auth.log" 2>&1 &
echo $! > "$LOGS/auth.pid"

cat > "$LOGS/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:auth@127.0.0.1:$PGPORT/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = 3001
EOF
nohup "$BIN/postgrest" "$LOGS/postgrest.conf" > "$LOGS/postgrest.log" 2>&1 &
echo $! > "$LOGS/postgrest.pid"

nohup node tests/e2e/stack/gateway.mjs > "$LOGS/gateway.log" 2>&1 &
echo $! > "$LOGS/gateway.pid"

node tests/e2e/stack/jwt.mjs "$SECRET" > "$LOGS/keys.env"
for i in $(seq 1 30); do
  curl -fs http://127.0.0.1:54321/auth/v1/health > /dev/null 2>&1 && curl -fs http://127.0.0.1:54321/rest/v1/ -H "apikey: x" > /dev/null 2>&1 && break
  sleep 1
done
echo "stack up — keys in $LOGS/keys.env"
