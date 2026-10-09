-- Database tests: run with  supabase/tests/run.sh
-- Each check prints PASS/FAIL; the run fails if any check fails.
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------- tiny test framework ----------
create schema test;
create table test.vars (k text primary key, v text);
create table test.results (id serial, name text, ok boolean, info text);
grant usage on schema test to anon, authenticated, service_role;
grant all on all tables in schema test to anon, authenticated, service_role;
grant all on all sequences in schema test to anon, authenticated, service_role;

create function test.ok(p_ok boolean, p_name text, p_info text default null) returns void
language sql as $$ insert into test.results (name, ok, info) values (p_name, coalesce(p_ok, false), p_info) $$;

-- runs p_sql as the CURRENT role and passes when the error message contains p_expected
create function test.throws(p_sql text, p_expected text, p_name text) returns void
language plpgsql as $$
declare msg text;
begin
  begin
    execute p_sql;
    perform test.ok(false, p_name, 'no error raised');
  exception when others then
    msg := sqlerrm;
    perform test.ok(position(p_expected in msg) > 0, p_name, msg);
  end;
end $$;

create function test.v(p_k text) returns text language sql as $$ select v from test.vars where k = p_k $$;
create function test.set(p_k text, p_v text) returns void language sql as
  $$ insert into test.vars values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
grant execute on all functions in schema test to anon, authenticated, service_role;

-- booking payload builder
create function test.payload(p_trip uuid, p_email text, p_count int default 1, p_extra jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'scheduled_trip_id', p_trip,
    'customer_name', 'Test Person', 'customer_email', p_email, 'customer_phone', '+919876543210',
    'participant_count', p_count,
    'additional_participants', (select coalesce(jsonb_agg('Friend ' || i), '[]') from generate_series(1, p_count - 1) i),
    'emergency_contact_name', 'Parent Name', 'emergency_contact_phone', '+919812345678',
    'terms_accepted', true, 'privacy_accepted', true, 'policy_version', 'v1') || p_extra
$$;
grant execute on function test.payload(uuid, text, int, jsonb) to anon, authenticated, service_role;

-- ---------- fixtures ----------
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.com', now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'owner@example.com', now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'staff@example.com', now());
insert into public.admin_users (user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'staff');

select test.set('sunrise_trip', (select t.id::text from public.scheduled_trips t join public.treks k on k.id = t.trek_id
                                  where k.slug = 'demo-sunrise-hill' order by trip_date limit 1));
select test.set('forest_trip',  (select t.id::text from public.scheduled_trips t join public.treks k on k.id = t.trek_id
                                  where k.slug = 'demo-forest-ridge' order by trip_date limit 1));
select test.set('sunrise_trip2', (select t.id::text from public.scheduled_trips t join public.treks k on k.id = t.trek_id
                                  where k.slug = 'demo-sunrise-hill' order by trip_date offset 1 limit 1));
select test.ok((select count(*) = 1 from public.profiles where email = 'alice@example.com'), 'profile auto-created for new auth user');

-- =====================================================================
-- 1. VISITOR (anon)
-- =====================================================================
set role anon; set request.jwt.claims = '{"role":"anon"}';
select test.ok((select count(*) = 2 from public.treks), 'anon sees published treks');
select test.ok((select count(*) = 6 from public.public_trips), 'anon sees public trips view');
select test.ok((select count(*) = 0 from public.site_settings where key like 'private.%'), 'anon cannot see private settings');
select test.throws('select * from public.bookings', 'permission denied', 'anon cannot read bookings');
select test.throws($$select public.create_booking(test.payload('$$ || test.v('sunrise_trip') || $$', 'x@example.com'))$$,
                   'permission denied', 'anon cannot call create_booking directly');
select test.throws($$insert into public.treks (name, slug, destination, price_paise) values ('Hack', 'hack', 'x', 1)$$,
                   'permission denied', 'anon cannot create treks');
select test.throws($$select public.get_booking_for_guest('TRK-X', gen_random_uuid())$$, 'permission denied', 'anon cannot call guest lookup directly');
select test.throws($$select public.admin_set_booking_status(gen_random_uuid(), 'confirmed', null)$$, 'permission denied', 'anon cannot call admin functions');
reset role;

-- =====================================================================
-- 2. BOOKING ENGINE (server / service_role)
-- =====================================================================
set role service_role; set request.jwt.claims = '{"role":"service_role"}';

-- a normal 3-person booking; the client tries to sneak in a cheaper price
select test.set('p1', test.payload(test.v('sunrise_trip')::uuid, 'Guest1@Example.com', 3,
                 '{"price_paise": 1, "total_paise": 1, "status": "confirmed", "payment_status": "paid"}')::text);
select test.set('b1', public.create_booking(test.v('p1')::jsonb)::text);
select test.ok(test.v('b1')::jsonb ->> 'reference' ~ '^TRK-[0-9A-HJKMNP-TV-Z]{10}$', 'reference is unguessable TRK-XXXXXXXXXX', test.v('b1')::jsonb ->> 'reference');
select test.ok((test.v('b1')::jsonb ->> 'total_paise')::int = 3 * 89900, 'total uses DB price, ignores browser price', test.v('b1')::jsonb ->> 'total_paise');
select test.ok(test.v('b1')::jsonb ->> 'status' = 'pending' and test.v('b1')::jsonb ->> 'payment_status' = 'unpaid',
               'browser cannot set status/payment_status');
select test.ok((select seats_reserved = 3 from public.scheduled_trips where id = test.v('sunrise_trip')::uuid), 'seats reserved = 3');
select test.ok((select count(*) = 3 from public.participants where booking_id = (test.v('b1')::jsonb ->> 'booking_id')::uuid), '3 participants saved');
select test.ok((select customer_email = 'guest1@example.com' from public.bookings where id = (test.v('b1')::jsonb ->> 'booking_id')::uuid), 'email normalised to lowercase');

-- duplicate submit with the same idempotency key
select test.set('b1dup', public.create_booking(test.v('p1')::jsonb)::text);
select test.ok((test.v('b1dup')::jsonb ->> 'duplicate')::boolean and test.v('b1dup')::jsonb ->> 'reference' = test.v('b1')::jsonb ->> 'reference',
               'same idempotency key returns original booking');
select test.ok((select seats_reserved = 3 from public.scheduled_trips where id = test.v('sunrise_trip')::uuid), 'duplicate submit reserves no extra seats');

-- validation
select test.throws(format($$select public.create_booking(test.payload(%L, 'guest1@example.com'))$$, test.v('sunrise_trip')), 'ALREADY_BOOKED', 'same email cannot book same trip twice');
select test.throws(format($$select public.create_booking(test.payload(%L, 'g7@example.com', 7))$$, test.v('sunrise_trip')), 'PARTICIPANT_LIMIT', 'max participants per booking enforced');
select test.throws(format($$select public.create_booking(test.payload(%L, 'g8@example.com', 2, '{"additional_participants": []}'))$$, test.v('sunrise_trip')), 'INVALID_INPUT', 'every extra participant must be named');
select test.throws(format($$select public.create_booking(test.payload(%L, 'g9@example.com', 1, '{"terms_accepted": false}'))$$, test.v('sunrise_trip')), 'CONSENT_REQUIRED', 'terms consent required');
select test.throws(format($$select public.create_booking(test.payload(%L, 'g10@example.com', 1, '{"customer_phone": "12345"}'))$$, test.v('sunrise_trip')), 'INVALID_INPUT', 'invalid phone rejected');
select test.throws(format($$select public.create_booking(test.payload(%L, 'not-an-email'))$$, test.v('sunrise_trip')), 'INVALID_INPUT', 'invalid email rejected');
select test.throws(format($$select public.create_booking(test.payload(%L, 'g11@example.com', 1, '{"payment_mode": "online"}'))$$, test.v('sunrise_trip')), 'ONLINE_PAYMENTS_DISABLED', 'online payment refused while disabled');
select test.throws($$select public.create_booking(test.payload(gen_random_uuid(), 'g12@example.com'))$$, 'TRIP_NOT_FOUND', 'unknown trip rejected');

-- capacity: forest trip has 20 seats, max 4 per booking
select public.create_booking(test.payload(test.v('forest_trip')::uuid, 'f' || i || '@example.com', 4)) from generate_series(1, 5) i;
select test.ok((select seats_reserved = 20 from public.scheduled_trips where id = test.v('forest_trip')::uuid), 'trip filled to capacity (20)');
select test.throws(format($$select public.create_booking(test.payload(%L, 'f6@example.com', 1))$$, test.v('forest_trip')), 'NOT_ENOUGH_SEATS', 'full trip refuses more bookings');
select test.ok((select availability = 'full' from public.public_trips where trip_id = test.v('forest_trip')::uuid), 'public view shows trip as full');
select test.throws(format($$update public.scheduled_trips set seats_reserved = 21 where id = %L$$, test.v('forest_trip')), 'trip_not_overbooked', 'DB constraint blocks overbooking even for the server');

-- guest lookup
select test.ok(public.get_booking_for_guest(test.v('b1')::jsonb ->> 'reference', (test.v('b1')::jsonb ->> 'access_token')::uuid) ->> 'reference'
               = test.v('b1')::jsonb ->> 'reference', 'guest lookup works with reference + token');
select test.ok(public.get_booking_for_guest(test.v('b1')::jsonb ->> 'reference', gen_random_uuid()) is null, 'guest lookup with wrong token returns nothing');

-- closed / unpublished
update public.scheduled_trips set booking_deadline = now() - interval '1 minute' where id = test.v('sunrise_trip2')::uuid;
select test.throws(format($$select public.create_booking(test.payload(%L, 'late@example.com'))$$, test.v('sunrise_trip2')), 'BOOKING_CLOSED', 'booking after deadline refused');
update public.scheduled_trips set booking_deadline = null where id = test.v('sunrise_trip2')::uuid;

-- rate limiting
select test.ok(public.check_rate_limit('test:1.2.3.4', 3, 60) and public.check_rate_limit('test:1.2.3.4', 3, 60)
               and public.check_rate_limit('test:1.2.3.4', 3, 60) and not public.check_rate_limit('test:1.2.3.4', 3, 60),
               'rate limit allows 3 then blocks the 4th');

-- a booking owned by Alice (signed-in customer)
select test.set('ba', public.create_booking(test.payload(test.v('sunrise_trip')::uuid, 'alice@example.com', 1,
                 '{"customer_user_id":"aaaaaaaa-0000-0000-0000-000000000001"}'))::text);
-- an unclaimed guest booking made with Bob's email on another trip
select public.create_booking(test.payload(test.v('sunrise_trip2')::uuid, 'bob@example.com'));
reset role;

-- =====================================================================
-- 3. CUSTOMERS (authenticated, not admin)
-- =====================================================================
set role authenticated; set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select test.ok((select count(*) = 1 from public.bookings), 'Alice sees only her own booking');
select test.ok((select count(*) = 1 from public.participants), 'Alice sees only her own participants');
select test.ok((select count(*) = 0 from public.booking_admin_notes), 'Alice cannot read admin notes');
select test.ok((select count(*) = 0 from public.admin_users) and not public.is_admin(), 'Alice is not an admin');
select test.throws(format($$update public.bookings set status = 'confirmed' where id = %L$$, test.v('ba')::jsonb ->> 'booking_id'), 'permission denied', 'customer cannot update bookings directly');
select test.throws($$insert into public.admin_users (user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000001', 'owner')$$, 'permission denied', 'customer cannot make themself admin');
select test.throws(format($$select public.admin_set_booking_status(%L, 'confirmed', null)$$, test.v('ba')::jsonb ->> 'booking_id'), 'NOT_AUTHORIZED', 'customer cannot call admin functions');
update public.treks set price_paise = 1;   -- RLS matches 0 rows for non-managers
select test.ok((select count(*) = 0 from public.treks where price_paise = 1), 'customer edit of treks changes nothing');
select test.ok((public.request_cancellation((test.v('ba')::jsonb ->> 'booking_id')::uuid, 'Exam clash') ->> 'status') = 'open', 'Alice can request cancellation of her booking');
select test.throws(format($$select public.request_cancellation(%L, 'again')$$, test.v('ba')::jsonb ->> 'booking_id'), 'REQUEST_ALREADY_OPEN', 'only one open cancellation request');
select public.update_my_booking_contact((test.v('ba')::jsonb ->> 'booking_id')::uuid, '+919000000001', 'New Contact', '+919000000002');
select test.ok((select customer_phone = '+919000000001' from public.bookings where id = (test.v('ba')::jsonb ->> 'booking_id')::uuid), 'Alice can update her contact details');
select test.ok((public.refund_preview((test.v('ba')::jsonb ->> 'booking_id')::uuid) ->> 'refund_percent')::int = 100, 'refund preview: 100% a week before trip');

set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select test.ok((select count(*) = 0 from public.bookings), 'Bob cannot see Alice''s booking');
select test.throws(format($$select public.request_cancellation(%L, 'mine now')$$, test.v('ba')::jsonb ->> 'booking_id'), 'BOOKING_NOT_FOUND', 'Bob cannot cancel Alice''s booking');
select test.throws(format($$select public.update_my_booking_contact(%L, '+919000000009', 'Bob', '+919000000008')$$, test.v('ba')::jsonb ->> 'booking_id'), 'BOOKING_NOT_FOUND', 'Bob cannot edit Alice''s booking');
select test.throws(format($$select public.refund_preview(%L)$$, test.v('ba')::jsonb ->> 'booking_id'), 'NOT_AUTHORIZED', 'Bob cannot see Alice''s refund preview');
select test.throws($$select public.admin_dashboard_stats()$$, 'NOT_AUTHORIZED', 'customer cannot read dashboard stats');
select test.throws($$select * from public.admin_customers(null, 50, 0)$$, 'NOT_AUTHORIZED', 'customer cannot list customers');
select test.throws($$insert into public.customer_notes (email, note, author_id) values ('x@y.co', 'hi', 'aaaaaaaa-0000-0000-0000-000000000002')$$, 'row-level security', 'customer cannot write customer notes');
select test.ok(public.claim_my_guest_bookings() = 1, 'Bob claims his earlier guest booking after verifying email');
select test.ok((select count(*) = 1 from public.bookings), 'Bob now sees his claimed booking');
reset role;

-- =====================================================================
-- 4. ADMINS
-- =====================================================================
set role authenticated; set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';  -- staff
select test.ok((select count(*) >= 8 from public.bookings), 'staff can read all bookings');
select test.set('b1id', test.v('b1')::jsonb ->> 'booking_id');
select test.ok((public.admin_set_booking_status(test.v('b1id')::uuid, 'confirmed', 'checked ID') ->> 'status') = 'confirmed', 'staff confirms a booking');
select test.ok((select confirmed_at is not null from public.bookings where id = test.v('b1id')::uuid), 'confirmed_at stamped');
select test.ok((public.admin_record_manual_payment(test.v('b1id')::uuid, 100000, 'upi', 'UTR111', 'part') ->> 'status') = 'captured', 'staff records partial UPI payment');
select test.ok((select payment_status = 'pending' from public.bookings where id = test.v('b1id')::uuid), 'part-paid shows payment pending');
select test.throws(format($$select public.admin_record_manual_payment(%L, 999999, 'upi', 'UTR112')$$, test.v('b1id')), 'OVERPAYMENT', 'cannot record more than the amount due');
select test.set('pay2', (public.admin_record_manual_payment(test.v('b1id')::uuid, 3 * 89900 - 100000, 'cash', null) ->> 'id'));
select test.ok((select payment_status = 'paid' from public.bookings where id = test.v('b1id')::uuid), 'fully paid shows paid');
select test.throws(format($$select public.admin_record_refund(%L, 1000, 'x')$$, test.v('pay2')), 'NOT_AUTHORIZED', 'staff cannot record refunds');
select public.admin_add_booking_note(test.v('b1id')::uuid, 'Called parent, all good');
select test.ok((select count(*) = 1 from public.booking_admin_notes where booking_id = test.v('b1id')::uuid), 'staff adds internal note');
update public.treks set price_paise = 1;   -- staff: RLS matches 0 rows
select test.ok((select count(*) = 0 from public.treks where price_paise = 1), 'staff edit of treks affects nothing');
reset role;

set role authenticated; set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';  -- owner
select test.ok((public.admin_record_refund(test.v('pay2')::uuid, 10000, 'goodwill') ->> 'status') = 'processed', 'owner records a partial refund');
select test.ok((select payment_status = 'partially_refunded' from public.bookings where id = test.v('b1id')::uuid), 'payment status -> partially_refunded');
select test.throws(format($$select public.admin_record_refund(%L, 99999999, 'too much')$$, test.v('pay2')), 'REFUND_EXCEEDS_PAYMENT', 'refund cannot exceed payment');
select test.ok((select count(*) >= 4 from public.booking_status_history where booking_id = test.v('b1id')::uuid), 'status history recorded');
select test.ok((select changed_by = 'aaaaaaaa-0000-0000-0000-000000000004' and reason = 'checked ID' from public.booking_status_history
                 where booking_id = test.v('b1id')::uuid and new_value = 'confirmed'), 'history records who confirmed and why');

-- status rules
select public.admin_set_booking_status((test.v('ba')::jsonb ->> 'booking_id')::uuid, 'cancelled', 'customer request');
select test.ok((select status = 'approved' from public.cancellation_requests where booking_id = (test.v('ba')::jsonb ->> 'booking_id')::uuid), 'cancelling approves the open request');
select test.throws(format($$select public.admin_set_booking_status(%L, 'confirmed', null)$$, test.v('ba')::jsonb ->> 'booking_id'), 'INVALID_STATUS_TRANSITION', 'cancelled booking cannot be re-confirmed');
select test.ok((select seats_reserved = 3 from public.scheduled_trips where id = test.v('sunrise_trip')::uuid), 'cancelling released Alice''s seat');

-- trek / trip management
update public.treks set short_description = 'Edited by owner' where slug = 'demo-sunrise-hill';
select test.ok((select count(*) = 1 from public.admin_audit_log where entity = 'treks' and action = 'update'
                 and actor_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'trek edit written to audit log');
select test.throws($$delete from public.treks where slug = 'demo-sunrise-hill'$$, 'foreign key', 'trek with trips cannot be deleted (archive instead)');
select test.throws(format($$update public.scheduled_trips set seats_reserved = 0 where id = %L$$, test.v('forest_trip')), 'permission denied', 'admin cannot hand-edit seat counter');
select test.throws(format($$update public.scheduled_trips set capacity = 5 where id = %L$$, test.v('forest_trip')), 'trip_not_overbooked', 'capacity cannot drop below booked seats');
select test.throws(format($$update public.scheduled_trips set status = 'cancelled' where id = %L$$, test.v('sunrise_trip')), 'USE_CANCEL_TRIP', 'trip with bookings can only be cancelled via Cancel trip');
select test.ok((public.admin_dashboard_stats() ->> 'total_bookings')::int >= 8, 'owner gets dashboard stats');
select test.ok(jsonb_array_length(public.admin_report(current_date - 1, current_date) -> 'by_trek') >= 1, 'owner gets report by trek');
select test.ok((select count(*) >= 5 from public.admin_customers(null, 50, 0)), 'owner lists customers');
select test.throws($$select public.admin_report(current_date, current_date - 5)$$, 'INVALID_INPUT', 'report rejects reversed date range');
select test.ok((select count(*) = 5 from public.admin_cancel_trip(test.v('forest_trip')::uuid, 'Heavy rain alert')), 'cancelling a trip cancels its 5 bookings');
select test.ok((select seats_reserved = 0 from public.scheduled_trips where id = test.v('forest_trip')::uuid), 'cancelled trip releases all seats');
select test.throws(format($$select public.create_booking(test.payload(%L, 'z@example.com'))$$, test.v('forest_trip')), 'permission denied', 'admins also cannot call create_booking from the browser');
reset role;

-- =====================================================================
-- 5. ONLINE PAYMENTS (server)
-- =====================================================================
update public.site_settings set value = 'true' where key = 'payments.online_enabled';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select test.set('bo', public.create_booking(test.payload(test.v('sunrise_trip2')::uuid, 'online@example.com', 2, '{"payment_mode":"online"}'))::text);
select test.set('boid', test.v('bo')::jsonb ->> 'booking_id');
select test.throws(format($$select public.create_online_payment(%L, 'order_1', 100)$$, test.v('boid')), 'AMOUNT_MISMATCH', 'order amount must equal server total');
select public.create_online_payment(test.v('boid')::uuid, 'order_1', 2 * 89900);
select test.ok((select payment_status = 'pending' from public.bookings where id = test.v('boid')::uuid), 'order created -> payment pending');
select test.ok((select status = 'pending' from public.bookings where id = test.v('boid')::uuid), 'returning from checkout alone does not confirm');
select test.throws($$select public.record_verified_online_payment('order_1', 'pay_1', 100)$$, 'AMOUNT_MISMATCH', 'verified amount must match order');
select test.ok(not (public.record_verified_online_payment('order_1', 'pay_1', 2 * 89900) ->> 'duplicate')::boolean, 'verified payment recorded');
select test.ok((public.record_verified_online_payment('order_1', 'pay_1', 2 * 89900) ->> 'duplicate')::boolean, 'duplicate webhook ignored');
select test.ok((select count(*) = 1 from public.payments where provider_payment_id = 'pay_1'), 'only one payment row');
select test.ok((select status = 'confirmed' and payment_status = 'paid' from public.bookings where id = test.v('boid')::uuid), 'verified payment confirms booking');
reset role;

-- ---------- report ----------
\set QUIET 0
\pset format aligned
\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name,
       case when ok then '' else coalesce(info, '') end as info
from test.results order by id;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from test.results;
do $$ begin
  if exists (select 1 from test.results where not ok) then raise exception 'SOME TESTS FAILED'; end if;
end $$;
