# Database (Phase 1)

## Apply to Supabase
1. Create a project at supabase.com (region: Mumbai).
2. **SQL Editor** → run each file in `migrations/` in order, then `seed.sql`.
   (Or with the CLI: `supabase link` → `supabase db push` → `supabase db seed`.)

## Create the first admin
1. **Authentication → Users → Add user** (your email + strong password).
2. SQL Editor:
   ```sql
   insert into public.admin_users (user_id, role)
   select id, 'owner' from auth.users where email = 'you@example.com';
   ```
Roles: `owner`/`admin` manage everything; `staff` handle bookings and payments only.
Nobody can become admin from the website.

## What's enforced in the database
- **No overselling** – trip row is locked per booking; a CHECK makes `seats_reserved > capacity` impossible.
- **Price from DB only** – the browser can't set price, total, status or payment status.
- **Double-submit safe** – same idempotency key returns the same booking.
- **Unguessable links** – reference `TRK-XXXXXXXXXX` + secret token for guest access.
- **Status rules** – pending → confirmed/cancelled → completed; every change logged with who and why.
- **Payments** – "paid" only via admin-recorded manual payment or server-verified Razorpay payment; duplicate webhooks ignored.
- **RLS** – customers see only their own bookings; admin notes, logs and contact messages are admin-only.

## Tests
See the main README → Tests.
