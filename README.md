# Trek booking website

One-day trek bookings for college students: public site, guest + account bookings, admin panel, emails, optional Razorpay.

**Stack:** Next.js 15 · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage) · Resend · Razorpay · Vercel

---

## 1. Run it locally
```bash
npm install
cp .env.example .env.local      # fill in Supabase values (step 2)
npm run dev                     # http://localhost:3000
```

## 2. Create the Supabase project
1. supabase.com → **New project** → region **Mumbai (ap-south-1)**.
2. **Project Settings → API**: copy *Project URL*, *anon/publishable key*, *service_role/secret key* into `.env.local`.

## 3. Apply the database
**SQL Editor** → run each file in `supabase/migrations/` **in order**, then `supabase/seed.sql`.
Or with the CLI: `npx supabase link --project-ref <ref>` → `npx supabase db push` → run `seed.sql` in the SQL editor.

The seed adds settings, starter FAQs and two **[DEMO]** treks. Archive the demo treks before launch.

## 4. Configure authentication
**Authentication → URL Configuration**
- Site URL: `https://yourdomain.in` (local: `http://localhost:3000`)
- Redirect URLs: `https://yourdomain.in/auth/callback`, `http://localhost:3000/auth/callback`

**Authentication → Providers → Email**: keep *Confirm email* ON.
**Authentication → SMTP**: add Resend SMTP (host `smtp.resend.com`, port 465, user `resend`, password = API key). Supabase's built-in mailer only sends a few emails per hour.

## 5. Create the first admin (only way to get admin access)
1. **Authentication → Users → Add user** → your email + strong password, *Auto confirm*.
2. SQL Editor:
```sql
insert into public.admin_users (user_id, role)
select id, 'owner' from auth.users where email = 'you@yourdomain.in';
```
3. Sign in at `/admin/login`.

**Add another admin:** create their user the same way, then run the insert with role `admin` (everything except team) or `staff` (bookings & payments only). Remove access: `update public.admin_users set is_active = false where user_id = '…';`

## 6. Email (Resend)
1. resend.com → **Domains** → add and verify your domain (DNS records).
2. Create an API key → set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_MODE=live`.

With `EMAIL_MODE=log` nothing is sent; emails are logged as *skipped*. Failed emails show in **Admin → Settings** and retry automatically.

## 7. Online payments (optional, Razorpay)
1. Razorpay dashboard → complete KYC → **API Keys** (start in **Test mode**).
2. **Webhooks → Add**: URL `https://yourdomain.in/api/razorpay/webhook`, events `payment.captured`, `payment.failed`, `refund.processed`, set a secret.
3. Set `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, redeploy.
4. **Admin → Settings** → turn on *Online payments*.

Without Razorpay the site works with **pay later**: customers pay by UPI/cash and you record it on the booking page.

## 8. Deploy to Vercel
1. Push this folder to a GitHub repo (`.env*` files are git-ignored).
2. vercel.com → **Add New Project** → import the repo.
3. Add every variable from `.env.example` (Production + Preview). Set `NEXT_PUBLIC_SITE_URL` to your real URL.
4. Deploy. `vercel.json` sets the Mumbai region and a daily job at 6 PM IST (trip reminders + email retries), which uses `CRON_SECRET`.

## 9. Custom domain
Vercel → **Project → Settings → Domains** → add `yourdomain.in` → add the DNS records it shows at your registrar.
Then update: `NEXT_PUBLIC_SITE_URL`, Supabase Site/Redirect URLs, Razorpay webhook URL. Redeploy.

## 10. Backups & monitoring
- **Backups:** Supabase Pro includes daily backups. On the free plan, export regularly: `npx supabase db dump -f backup.sql` (and `--data-only` for data).
- **Logs:** Vercel → *Logs* (app errors), Supabase → *Logs* (database/auth).
- **In the app:** Admin → Settings shows failed emails and which integrations are configured.

---

## Tests
| Command | What it checks |
|---|---|
| `npm run typecheck` / `npm run lint` | Types and code quality |
| `npm test` | Unit: validation, CSV safety, payment signatures, email failure handling, upload sniffing |
| `npm run test:db` | Database: security rules, booking engine, payments, 45-way booking race (needs local PostgreSQL 16) |
| `npm run test:e2e` | Browser end-to-end against a local Supabase-compatible stack — see `tests/e2e/README.md` |

Last results: **34 unit · 97 database · 34 end-to-end — all passing.**

## Production checklist
- [ ] Demo treks archived; real treks, dates, meeting points and refund rules entered
- [ ] Policies in **Admin → Content** replaced and reviewed (starter text is a template)
- [ ] Brand name, contact details, logo and hero photo set (use photos you own or license)
- [ ] First owner created; nobody else has admin rows they shouldn't
- [ ] `EMAIL_MODE=live`, domain verified in Resend, Supabase SMTP set
- [ ] Razorpay in **Live** mode keys + webhook (or online payments left off)
- [ ] `NEXT_PUBLIC_SITE_URL` and Supabase redirect URLs use your domain
- [ ] `CRON_SECRET` set; a test booking made end to end on the live site
- [ ] Backups planned

## Troubleshooting
| Problem | Fix |
|---|---|
| Yellow "Setup needed" bar | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` missing — add and redeploy |
| "permission denied" errors | A migration was skipped — rerun the files in order |
| Signed in but `/admin` says access denied | Your user isn't in `admin_users` (step 5) |
| Confirmation / reset links go to localhost | Fix Site URL + Redirect URLs (step 4) |
| No emails arrive | `EMAIL_MODE=live`? Domain verified? Check Admin → Settings → Failed emails |
| Payment taken but booking still pending | Check Razorpay webhook URL/secret and its delivery log; it retries automatically |
| Images don't upload | Use JPEG/PNG/WebP/AVIF under 5 MB; only owner/admin can upload |
| "Too many attempts" | Rate limit — wait 15 minutes |

## Project layout
```
src/app/(site)/      public pages, booking, account
src/app/admin/       admin login + panel
src/app/api/         payments, webhook, CSV export, daily job
src/lib/             data access, validation, email, payments, auth guards
supabase/migrations/ schema, functions, row-level security, storage
tests/               unit, e2e
```
