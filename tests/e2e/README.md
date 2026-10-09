# End-to-end tests

Drive a real browser through the site against a **throwaway** local stack. Never point these at production — they reset the database.

## Easiest: Supabase CLI (needs Docker)
```bash
npx supabase init                      # once; keeps the existing migrations
npx supabase start                     # local Postgres + Auth + REST
npx supabase db reset                  # applies migrations + seed
# put the printed API URL / anon key / service_role key into .env.local, EMAIL_MODE=log, CRON_SECRET=e2e-cron-secret
npm run build && npm start &
E2E_SERVICE_KEY=<service_role key> E2E_SUPABASE_URL=http://127.0.0.1:54321 \
PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres E2E_DB=postgres npm run test:e2e
```

## Without Docker (how they were run for this project)
`tests/e2e/stack/up.sh` starts PostgreSQL 16 + the Supabase Auth and PostgREST release binaries + a tiny gateway on :54321.
```bash
BIN=/path/to/binaries PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres tests/e2e/stack/up.sh
source /tmp/trek-e2e/keys.env      # ANON_KEY / SERVICE_KEY for .env.local
npm run build && npm start &
E2E_SERVICE_KEY=$SERVICE_KEY npm run test:e2e
tests/e2e/stack/down.sh
```

Optional for the payment tests: `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_e2e`, `RAZORPAY_KEY_SECRET=e2e_key_secret`, `RAZORPAY_WEBHOOK_SECRET=e2e_webhook_secret` in `.env.local` before building.
