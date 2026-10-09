-- =====================================================================
-- 0002 FUNCTIONS & TRIGGERS: roles, seat accounting, status rules,
-- booking engine, payments, cancellations, audit, rate limiting
-- All SECURITY DEFINER functions pin search_path = '' and qualify names.
-- =====================================================================

-- ---------- role helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users a
                 where a.user_id = (select auth.uid()) and a.is_active);
$$;

-- owner/admin (not staff): content, treks, refunds, settings
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users a
                 where a.user_id = (select auth.uid()) and a.is_active
                   and a.role in ('owner', 'admin'));
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
end $$;

create or replace function public.require_manager() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_manager() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
end $$;

-- ---------- settings ----------
create or replace function public.get_setting(p_key text, p_default jsonb default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value from public.site_settings s where s.key = p_key), p_default);
$$;

-- ---------- unguessable booking reference: TRK- + 10 Crockford base32 chars (50 bits) ----------
create or replace function public.gen_booking_reference() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  b bytea := uuid_send(gen_random_uuid());   -- crypto-random source
  out text := 'TRK-';
begin
  for i in 0..9 loop
    out := out || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

-- ---------- trip start / deadline (Asia/Kolkata) ----------
create or replace function public.trip_starts_at(t public.scheduled_trips) returns timestamptz
language sql stable set search_path = '' as $$
  select ((t.trip_date + coalesce(t.reporting_time, time '06:00'))::timestamp) at time zone 'Asia/Kolkata';
$$;

-- default deadline: 12 hours before reporting time
create or replace function public.trip_booking_deadline(t public.scheduled_trips) returns timestamptz
language sql stable set search_path = '' as $$
  select coalesce(t.booking_deadline, public.trip_starts_at(t) - interval '12 hours');
$$;

-- ---------- new auth user -> profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- seat accounting (bookings -> scheduled_trips.seats_reserved) ----------
-- Seats are held by pending, confirmed and completed bookings; cancelling releases them.
-- The CHECK (seats_reserved <= capacity) is the final overbooking guard.
create or replace function public.booking_holds_seats(s public.booking_status) returns boolean
language sql immutable set search_path = '' as $$
  select s in ('pending', 'confirmed', 'completed');
$$;

create or replace function public.trg_booking_seats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and public.booking_holds_seats(old.status) then
    update public.scheduled_trips set seats_reserved = seats_reserved - old.participant_count
     where id = old.scheduled_trip_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and public.booking_holds_seats(new.status) then
    update public.scheduled_trips set seats_reserved = seats_reserved + new.participant_count
     where id = new.scheduled_trip_id;
  end if;
  return null;
end $$;

create trigger trg_bookings_seats
  after insert or delete or update of status, participant_count, scheduled_trip_id on public.bookings
  for each row execute function public.trg_booking_seats();

-- ---------- booking integrity + status transitions ----------
create or replace function public.trg_booking_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reference <> old.reference or new.access_token <> old.access_token
     or new.idempotency_key <> old.idempotency_key or new.scheduled_trip_id <> old.scheduled_trip_id
     or new.participant_count <> old.participant_count
     or new.price_per_participant_paise <> old.price_per_participant_paise
     or new.total_paise <> old.total_paise or new.created_at <> old.created_at then
    raise exception 'IMMUTABLE_FIELD' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'pending'   and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('cancelled', 'completed'))
    ) then
      raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001',
        detail = format('%s -> %s', old.status, new.status);
    end if;
    if new.status = 'confirmed' then new.confirmed_at := now(); end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;
  return new;
end $$;

create trigger trg_bookings_guard before update on public.bookings
  for each row execute function public.trg_booking_guard();

create or replace function public.trg_booking_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(current_setting('app.change_reason', true), '');
  v_actor  uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (booking_id, field, old_value, new_value, changed_by, reason)
    values (new.id, 'status', null, new.status::text, v_actor, 'booking created');
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.booking_status_history (booking_id, field, old_value, new_value, changed_by, reason)
    values (new.id, 'status', old.status::text, new.status::text, v_actor, v_reason);
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.booking_status_history (booking_id, field, old_value, new_value, changed_by, reason)
    values (new.id, 'payment_status', old.payment_status::text, new.payment_status::text, v_actor, v_reason);
  end if;
  return null;
end $$;

create trigger trg_bookings_history after insert or update of status, payment_status on public.bookings
  for each row execute function public.trg_booking_history();

-- ---------- generic admin audit trigger ----------
create or replace function public.trg_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), lower(tg_op), tg_table_name,
          coalesce(rec ->> 'id', rec ->> 'key', rec ->> 'user_id'),
          case when tg_op = 'UPDATE' then
            (select jsonb_object_agg(k, to_jsonb(new) -> k) from jsonb_object_keys(to_jsonb(new)) k
              where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k and k <> 'updated_at')
          else null end);
  return null;
end $$;

create trigger trg_audit_treks    after insert or update or delete on public.treks           for each row execute function public.trg_audit();
create trigger trg_audit_settings after insert or update or delete on public.site_settings   for each row execute function public.trg_audit();
create trigger trg_audit_faqs     after insert or update or delete on public.faqs            for each row execute function public.trg_audit();
create trigger trg_audit_gallery  after insert or update or delete on public.gallery_images  for each row execute function public.trg_audit();
create trigger trg_audit_admins   after insert or update or delete on public.admin_users     for each row execute function public.trg_audit();
-- seats_reserved changes on every booking, so it is left out of the trips audit
create trigger trg_audit_trips after insert or delete or update of
  trek_id, trip_date, reporting_time, return_time, meeting_point, capacity,
  price_override_paise, booking_deadline, status, notes
  on public.scheduled_trips for each row execute function public.trg_audit();

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, p_details);
$$;

-- =====================================================================
-- BOOKING ENGINE  (called by the Next.js server with the service role)
-- =====================================================================
create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_key        uuid    := (p ->> 'idempotency_key')::uuid;
  v_trip_id    uuid    := (p ->> 'scheduled_trip_id')::uuid;
  v_count      integer := (p ->> 'participant_count')::integer;
  v_email      text    := lower(btrim(p ->> 'customer_email'));
  v_phone      text    := btrim(p ->> 'customer_phone');
  v_name       text    := btrim(p ->> 'customer_name');
  v_mode       public.payment_mode := coalesce(p ->> 'payment_mode', 'manual')::public.payment_mode;
  v_others     jsonb   := coalesce(p -> 'additional_participants', '[]'::jsonb);
  v_trip       public.scheduled_trips;
  v_trek       public.treks;
  v_existing   public.bookings;
  v_booking    public.bookings;
  v_price      integer;
  v_status     public.booking_status;
  v_ref        text;
  v_i          integer;
begin
  if v_key is null or v_trip_id is null then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'idempotency_key/scheduled_trip_id'; end if;
  if v_name is null or char_length(v_name) < 2 then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'customer_name'; end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'customer_email'; end if;
  if v_phone is null or v_phone !~ '^\+91[6-9][0-9]{9}$' then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'customer_phone'; end if;
  if coalesce((p ->> 'terms_accepted')::boolean, false) is false
     or coalesce((p ->> 'privacy_accepted')::boolean, false) is false then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;
  if v_count is null or v_count < 1 then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'participant_count'; end if;
  if jsonb_typeof(v_others) <> 'array' or jsonb_array_length(v_others) <> v_count - 1 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'additional_participants must list every extra person';
  end if;
  if v_mode = 'online' and coalesce((public.get_setting('payments.online_enabled', 'false'))::boolean, false) is false then
    raise exception 'ONLINE_PAYMENTS_DISABLED' using errcode = 'P0001';
  end if;

  -- Lock the trip row: concurrent bookings for the same trip queue here.
  select * into v_trip from public.scheduled_trips where id = v_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001'; end if;

  -- Duplicate submit (same idempotency key): return the original booking.
  select * into v_existing from public.bookings where idempotency_key = v_key;
  if found then
    return jsonb_build_object('booking_id', v_existing.id, 'reference', v_existing.reference,
      'access_token', v_existing.access_token, 'status', v_existing.status,
      'payment_status', v_existing.payment_status, 'total_paise', v_existing.total_paise, 'duplicate', true);
  end if;

  select * into v_trek from public.treks where id = v_trip.trek_id;
  if v_trek.status <> 'published' then raise exception 'TREK_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  if v_trip.status <> 'scheduled' then raise exception 'TRIP_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  if now() > public.trip_booking_deadline(v_trip) then raise exception 'BOOKING_CLOSED' using errcode = 'P0001'; end if;
  if v_count < v_trek.min_participants_per_booking or v_count > v_trek.max_participants_per_booking then
    raise exception 'PARTICIPANT_LIMIT' using errcode = 'P0001',
      detail = format('%s-%s per booking', v_trek.min_participants_per_booking, v_trek.max_participants_per_booking);
  end if;
  if v_count > v_trip.capacity - v_trip.seats_reserved then
    raise exception 'NOT_ENOUGH_SEATS' using errcode = 'P0001',
      detail = format('%s seat(s) left', greatest(v_trip.capacity - v_trip.seats_reserved, 0));
  end if;
  if exists (select 1 from public.bookings b where b.scheduled_trip_id = v_trip_id
              and b.customer_email = v_email and b.status in ('pending', 'confirmed')) then
    raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
  end if;

  v_price := coalesce(v_trip.price_override_paise, v_trek.price_paise);   -- price from DB only
  v_status := case
    when v_mode = 'online' then 'pending'                                 -- confirmed after verified payment
    when coalesce((public.get_setting('booking.require_approval', 'true'))::boolean, true) then 'pending'
    else 'confirmed' end;

  loop
    v_ref := public.gen_booking_reference();
    exit when not exists (select 1 from public.bookings where reference = v_ref);
  end loop;

  insert into public.bookings (
    reference, idempotency_key, customer_user_id, customer_name, customer_email, customer_phone,
    scheduled_trip_id, participant_count, price_per_participant_paise, total_paise,
    status, payment_status, payment_mode, emergency_contact_name, emergency_contact_phone,
    food_preference, safety_notes, special_requests,
    terms_accepted_at, privacy_accepted_at, policy_version, confirmed_at)
  values (
    v_ref, v_key, nullif(p ->> 'customer_user_id', '')::uuid, v_name, v_email, v_phone,
    v_trip_id, v_count, v_price, v_price * v_count,
    v_status, 'unpaid', v_mode, btrim(p ->> 'emergency_contact_name'), btrim(p ->> 'emergency_contact_phone'),
    nullif(p ->> 'food_preference', ''), nullif(btrim(p ->> 'safety_notes'), ''), nullif(btrim(p ->> 'special_requests'), ''),
    now(), now(), coalesce(p ->> 'policy_version', 'v1'),
    case when v_status = 'confirmed' then now() end)
  returning * into v_booking;

  insert into public.participants (booking_id, full_name, is_primary) values (v_booking.id, v_name, true);
  for v_i in 0 .. jsonb_array_length(v_others) - 1 loop
    if char_length(btrim(v_others ->> v_i)) < 2 then
      raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'participant name';
    end if;
    insert into public.participants (booking_id, full_name) values (v_booking.id, btrim(v_others ->> v_i));
  end loop;

  return jsonb_build_object('booking_id', v_booking.id, 'reference', v_booking.reference,
    'access_token', v_booking.access_token, 'status', v_booking.status,
    'payment_status', v_booking.payment_status, 'total_paise', v_booking.total_paise, 'duplicate', false);
end $$;

-- Full booking view for the confirmation page (guest link = reference + token).
create or replace function public.booking_details_json(b public.bookings) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'reference', b.reference, 'status', b.status, 'payment_status', b.payment_status,
    'payment_mode', b.payment_mode, 'customer_name', b.customer_name, 'customer_email', b.customer_email,
    'customer_phone', b.customer_phone, 'participant_count', b.participant_count,
    'price_per_participant_paise', b.price_per_participant_paise, 'total_paise', b.total_paise,
    'paid_paise', coalesce((select sum(amount_paise) from public.payments where booking_id = b.id and status = 'captured'), 0),
    'created_at', b.created_at,
    'participants', (select jsonb_agg(p.full_name order by p.is_primary desc, p.created_at) from public.participants p where p.booking_id = b.id),
    'trip', jsonb_build_object('id', t.id, 'date', t.trip_date,
      'reporting_time', coalesce(t.reporting_time, k.default_reporting_time),
      'return_time', coalesce(t.return_time, k.default_return_time),
      'meeting_point', coalesce(t.meeting_point, k.meeting_point), 'meeting_point_map_url', k.meeting_point_map_url,
      'status', t.status),
    'trek', jsonb_build_object('name', k.name, 'slug', k.slug, 'destination', k.destination,
      'things_to_carry', k.things_to_carry, 'safety_info', k.safety_info,
      'cancellation_policy', k.cancellation_policy),
    'open_cancellation_request', exists (select 1 from public.cancellation_requests c where c.booking_id = b.id and c.status = 'open'))
  from public.scheduled_trips t join public.treks k on k.id = t.trek_id
  where t.id = b.scheduled_trip_id;
$$;

create or replace function public.get_booking_for_guest(p_reference text, p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.bookings;
begin
  select * into v from public.bookings where reference = upper(btrim(p_reference)) and access_token = p_token;
  if not found then return null; end if;          -- same answer for wrong ref or wrong token
  return public.booking_details_json(v);
end $$;

-- ---------- refund preview from trek.refund_rules ----------
create or replace function public.refund_preview(p_booking uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  b public.bookings; t public.scheduled_trips; k public.treks;
  v_hours numeric; v_pct integer := 0; v_paid integer; r jsonb;
begin
  select * into b from public.bookings where id = p_booking;
  if not found or not (public.is_admin() or b.customer_user_id = (select auth.uid())
                       or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into t from public.scheduled_trips where id = b.scheduled_trip_id;
  select * into k from public.treks where id = t.trek_id;
  v_hours := extract(epoch from (public.trip_starts_at(t) - now())) / 3600;
  for r in select * from jsonb_array_elements(k.refund_rules) order by (value ->> 'hours_before')::numeric desc loop
    if v_hours >= (r ->> 'hours_before')::numeric then v_pct := (r ->> 'refund_percent')::integer; exit; end if;
  end loop;
  select coalesce(sum(amount_paise), 0) into v_paid from public.payments where booking_id = b.id and status = 'captured';
  return jsonb_build_object('hours_before_trip', round(v_hours, 1), 'refund_percent', v_pct,
                            'paid_paise', v_paid, 'refundable_paise', (v_paid * v_pct) / 100);
end $$;

-- =====================================================================
-- PAYMENTS
-- =====================================================================
create or replace function public.recompute_payment_status(p_booking uuid) returns public.payment_status
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings; v_paid integer; v_refunded integer; v_open boolean; v_new public.payment_status;
begin
  select * into b from public.bookings where id = p_booking for update;
  select coalesce(sum(amount_paise), 0) into v_paid from public.payments where booking_id = p_booking and status = 'captured';
  select coalesce(sum(r.amount_paise), 0) into v_refunded
    from public.refunds r join public.payments p on p.id = r.payment_id
   where p.booking_id = p_booking and r.status = 'processed';
  select exists (select 1 from public.payments where booking_id = p_booking and status = 'created') into v_open;

  v_new := case
    when v_refunded > 0 and v_refunded >= v_paid then 'refunded'
    when v_refunded > 0 then 'partially_refunded'
    when v_paid >= b.total_paise and v_paid > 0 then 'paid'
    when v_paid > 0 or v_open then 'pending'       -- part-paid or payment in progress
    else 'unpaid' end;
  if b.total_paise = 0 and v_refunded = 0 then v_new := 'paid'; end if;   -- free trek

  if v_new is distinct from b.payment_status then
    update public.bookings set payment_status = v_new where id = p_booking;
  end if;
  return v_new;
end $$;

-- Admin records cash/UPI received in person. Audited; never "trusts the browser".
create or replace function public.admin_record_manual_payment(
  p_booking uuid, p_amount_paise integer, p_method text, p_reference text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v_paid integer; v_pay public.payments;
begin
  perform public.require_admin();
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if b.status = 'cancelled' then raise exception 'BOOKING_CANCELLED' using errcode = 'P0001'; end if;
  if p_method not in ('upi', 'cash', 'bank_transfer', 'other') then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'method'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'amount'; end if;
  select coalesce(sum(amount_paise), 0) into v_paid from public.payments where booking_id = p_booking and status = 'captured';
  if v_paid + p_amount_paise > b.total_paise then raise exception 'OVERPAYMENT' using errcode = 'P0001',
    detail = format('outstanding %s paise', b.total_paise - v_paid); end if;

  insert into public.payments (booking_id, provider, provider_payment_id, amount_paise, status, method, verified_at, recorded_by, notes)
  values (p_booking, 'manual', nullif(btrim(p_reference), ''), p_amount_paise, 'captured', p_method, now(), (select auth.uid()), p_note)
  returning * into v_pay;

  perform set_config('app.change_reason', 'manual payment recorded', true);
  perform public.recompute_payment_status(p_booking);
  perform public.audit('record_manual_payment', 'bookings', p_booking::text,
    jsonb_build_object('payment_id', v_pay.id, 'amount_paise', p_amount_paise, 'method', p_method, 'reference', p_reference));
  return to_jsonb(v_pay);
end $$;

-- Online (Razorpay) order created by server -> payment row in 'created'.
create or replace function public.create_online_payment(p_booking uuid, p_order_id text, p_amount_paise integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v_pay public.payments;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if b.status = 'cancelled' then raise exception 'BOOKING_CANCELLED' using errcode = 'P0001'; end if;
  if p_amount_paise <> b.total_paise then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;
  insert into public.payments (booking_id, provider, provider_order_id, amount_paise, status)
  values (p_booking, 'razorpay', p_order_id, p_amount_paise, 'created')
  on conflict (provider, provider_order_id) where provider_order_id is not null do update set amount_paise = excluded.amount_paise
  returning * into v_pay;
  perform set_config('app.change_reason', 'online payment started', true);
  perform public.recompute_payment_status(p_booking);
  return to_jsonb(v_pay);
end $$;

-- Called only after the server verified Razorpay's signature (checkout or webhook). Idempotent.
create or replace function public.record_verified_online_payment(
  p_order_id text, p_payment_id text, p_amount_paise integer, p_method text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments; b public.bookings;
begin
  select * into v_pay from public.payments where provider = 'razorpay' and provider_payment_id = p_payment_id;
  if found then return jsonb_build_object('payment_id', v_pay.id, 'booking_id', v_pay.booking_id, 'duplicate', true); end if;

  select * into v_pay from public.payments where provider = 'razorpay' and provider_order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_amount_paise <> v_pay.amount_paise then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;

  update public.payments set provider_payment_id = p_payment_id, status = 'captured', method = p_method, verified_at = now()
   where id = v_pay.id returning * into v_pay;

  perform set_config('app.change_reason', 'online payment verified', true);
  perform public.recompute_payment_status(v_pay.booking_id);
  select * into b from public.bookings where id = v_pay.booking_id;
  if b.status = 'pending' and b.payment_status = 'paid' then
    update public.bookings set status = 'confirmed' where id = b.id;
  end if;
  return jsonb_build_object('payment_id', v_pay.id, 'booking_id', v_pay.booking_id, 'duplicate', false);
end $$;

create or replace function public.mark_online_payment_failed(p_order_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments;
begin
  update public.payments set status = 'failed' where provider = 'razorpay' and provider_order_id = p_order_id and status = 'created'
  returning * into v_pay;
  if found then
    perform set_config('app.change_reason', 'online payment failed', true);
    perform public.recompute_payment_status(v_pay.booking_id);
  end if;
end $$;

-- Refund record. For manual payments the admin refunds outside the app, then records it here.
create or replace function public.admin_record_refund(
  p_payment uuid, p_amount_paise integer, p_reason text,
  p_status text default 'processed', p_provider_refund_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments; v_done integer; v_ref public.refunds;
begin
  perform public.require_manager();
  select * into v_pay from public.payments where id = p_payment for update;
  if not found or v_pay.status <> 'captured' then raise exception 'PAYMENT_NOT_REFUNDABLE' using errcode = 'P0001'; end if;
  if p_status not in ('pending', 'processed') then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'status'; end if;
  select coalesce(sum(amount_paise), 0) into v_done from public.refunds where payment_id = p_payment and status <> 'failed';
  if p_amount_paise <= 0 or v_done + p_amount_paise > v_pay.amount_paise then
    raise exception 'REFUND_EXCEEDS_PAYMENT' using errcode = 'P0001', detail = format('refundable %s paise', v_pay.amount_paise - v_done);
  end if;
  insert into public.refunds (payment_id, amount_paise, reason, status, provider_refund_id, processed_at, created_by)
  values (p_payment, p_amount_paise, p_reason, p_status, p_provider_refund_id,
          case when p_status = 'processed' then now() end, (select auth.uid()))
  returning * into v_ref;
  perform set_config('app.change_reason', 'refund recorded', true);
  perform public.recompute_payment_status(v_pay.booking_id);
  perform public.audit('record_refund', 'payments', p_payment::text,
    jsonb_build_object('refund_id', v_ref.id, 'amount_paise', p_amount_paise, 'status', p_status));
  return to_jsonb(v_ref);
end $$;

-- Provider webhook confirms a pending refund.
create or replace function public.mark_refund_processed(p_provider_refund_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ref public.refunds; v_booking uuid;
begin
  update public.refunds set status = 'processed', processed_at = now()
   where provider_refund_id = p_provider_refund_id and status = 'pending' returning * into v_ref;
  if found then
    select booking_id into v_booking from public.payments where id = v_ref.payment_id;
    perform set_config('app.change_reason', 'refund processed', true);
    perform public.recompute_payment_status(v_booking);
  end if;
end $$;

-- =====================================================================
-- ADMIN BOOKING MANAGEMENT
-- =====================================================================
create or replace function public.admin_set_booking_status(p_booking uuid, p_status public.booking_status, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  perform public.require_admin();
  perform set_config('app.change_reason', coalesce(p_reason, ''), true);
  update public.bookings
     set status = p_status,
         cancel_reason = case when p_status = 'cancelled' then p_reason else cancel_reason end
   where id = p_booking returning * into b;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_status = 'cancelled' then
    update public.cancellation_requests set status = 'approved', resolved_by = (select auth.uid()),
           resolved_at = now(), resolution_note = coalesce(resolution_note, p_reason)
     where booking_id = p_booking and status = 'open';
  end if;
  perform public.audit('set_booking_status', 'bookings', p_booking::text,
    jsonb_build_object('status', p_status, 'reason', p_reason));
  return jsonb_build_object('id', b.id, 'status', b.status, 'payment_status', b.payment_status);
end $$;

create or replace function public.admin_add_booking_note(p_booking uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.booking_admin_notes;
begin
  perform public.require_admin();
  insert into public.booking_admin_notes (booking_id, author_id, note)
  values (p_booking, (select auth.uid()), btrim(p_note)) returning * into n;
  return to_jsonb(n);
end $$;

create or replace function public.admin_reject_cancellation(p_request uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.cancellation_requests set status = 'rejected', resolved_by = (select auth.uid()),
         resolved_at = now(), resolution_note = p_note
   where id = p_request and status = 'open';
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001'; end if;
  perform public.audit('reject_cancellation', 'cancellation_requests', p_request::text, jsonb_build_object('note', p_note));
end $$;

-- Mark all active bookings of a past trip completed and close the trip.
create or replace function public.admin_complete_trip(p_trip uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare t public.scheduled_trips; n integer;
begin
  perform public.require_admin();
  select * into t from public.scheduled_trips where id = p_trip for update;
  if not found then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if t.trip_date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'TRIP_NOT_FINISHED' using errcode = 'P0001'; end if;
  perform set_config('app.change_reason', 'trip completed', true);
  update public.bookings set status = 'completed' where scheduled_trip_id = p_trip and status = 'confirmed';
  get diagnostics n = row_count;
  update public.scheduled_trips set status = 'completed' where id = p_trip;
  return n;
end $$;

-- Cancel a trip: every active booking is cancelled (refunds recorded separately).
create or replace function public.admin_cancel_trip(p_trip uuid, p_reason text) returns setof uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_manager();
  if not exists (select 1 from public.scheduled_trips where id = p_trip) then
    raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform set_config('app.change_reason', 'trip cancelled: ' || coalesce(p_reason, ''), true);
  -- bookings first, so the trip-status guard sees no active bookings left
  return query
    update public.bookings set status = 'cancelled', cancel_reason = 'Trip cancelled by organiser: ' || coalesce(p_reason, '')
     where scheduled_trip_id = p_trip and status in ('pending', 'confirmed') returning id;
  update public.scheduled_trips set status = 'cancelled', notes = coalesce(notes || E'\n', '') || 'Cancelled: ' || coalesce(p_reason, '')
   where id = p_trip;
end $$;

-- =====================================================================
-- CUSTOMER SELF-SERVICE
-- =====================================================================
create or replace function public._request_cancellation(b public.bookings, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.scheduled_trips; r public.cancellation_requests;
begin
  if b.status not in ('pending', 'confirmed') then raise exception 'NOT_CANCELLABLE' using errcode = 'P0001'; end if;
  select * into t from public.scheduled_trips where id = b.scheduled_trip_id;
  if now() >= public.trip_starts_at(t) then raise exception 'TRIP_STARTED' using errcode = 'P0001'; end if;
  insert into public.cancellation_requests (booking_id, reason) values (b.id, left(btrim(p_reason), 1000))
  on conflict (booking_id) where status = 'open' do nothing
  returning * into r;
  if r.id is null then raise exception 'REQUEST_ALREADY_OPEN' using errcode = 'P0001'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.request_cancellation(p_booking uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and customer_user_id = (select auth.uid());
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  return public._request_cancellation(b, p_reason);
end $$;

create or replace function public.request_cancellation_guest(p_reference text, p_token uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where reference = upper(btrim(p_reference)) and access_token = p_token;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  return public._request_cancellation(b, p_reason);
end $$;

create or replace function public.update_my_booking_contact(
  p_booking uuid, p_phone text, p_emergency_name text, p_emergency_phone text) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; t public.scheduled_trips;
begin
  select * into b from public.bookings where id = p_booking and customer_user_id = (select auth.uid()) for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if b.status not in ('pending', 'confirmed') then raise exception 'NOT_EDITABLE' using errcode = 'P0001'; end if;
  select * into t from public.scheduled_trips where id = b.scheduled_trip_id;
  if now() >= public.trip_starts_at(t) then raise exception 'TRIP_STARTED' using errcode = 'P0001'; end if;
  update public.bookings set customer_phone = btrim(p_phone), emergency_contact_name = btrim(p_emergency_name),
         emergency_contact_phone = btrim(p_emergency_phone)
   where id = p_booking;
end $$;

-- After a customer verifies their email, attach their earlier guest bookings to the account.
create or replace function public.claim_my_guest_bookings() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_email text; n integer;
begin
  select lower(u.email) into v_email from auth.users u
   where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update public.bookings set customer_user_id = (select auth.uid())
   where customer_email = v_email and customer_user_id is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- RATE LIMITING (fixed window) — server only
-- =====================================================================
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- ---------- public listing view (respects RLS of the caller) ----------
create view public.public_trips with (security_invoker = true) as
select
  t.id as trip_id, t.trip_date,
  coalesce(t.reporting_time, k.default_reporting_time) as reporting_time,
  coalesce(t.return_time, k.default_return_time) as return_time,
  t.capacity, t.seats_reserved, greatest(t.capacity - t.seats_reserved, 0) as seats_left,
  coalesce(t.price_override_paise, k.price_paise) as price_paise,
  public.trip_booking_deadline(t) as booking_deadline,
  case when t.status <> 'scheduled' then t.status::text
       when t.seats_reserved >= t.capacity then 'full'
       when now() > public.trip_booking_deadline(t) then 'closed'
       else 'open' end as availability,
  k.id as trek_id, k.slug, k.name, k.destination, k.region, k.difficulty, k.distance_km,
  k.duration_hours, k.short_description, k.featured_image, k.is_featured
from public.scheduled_trips t
join public.treks k on k.id = t.trek_id
where k.status = 'published';
