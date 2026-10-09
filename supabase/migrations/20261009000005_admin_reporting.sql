-- =====================================================================
-- 0005 ADMIN: booking list view, dashboard stats, reports, customers,
-- customer notes, email retry data
-- =====================================================================

-- ---------- email log: keep what's needed to retry ----------
alter table public.email_log
  add column subject text,
  add column payload jsonb,
  add column next_retry_at timestamptz;
create index idx_email_retry on public.email_log (next_retry_at) where status = 'failed';
create unique index uq_email_once on public.email_log (booking_id, template)
  where template in ('reminder') and status in ('sent', 'queued', 'skipped');

-- ---------- customer notes (by email; works for guests and accounts) ----------
create table public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(email)),
  author_id   uuid references auth.users (id) on delete set null,
  note        text not null check (char_length(note) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index idx_customer_notes_email on public.customer_notes (email);
alter table public.customer_notes enable row level security;
grant select, insert on public.customer_notes to authenticated;
create policy customer_notes_read   on public.customer_notes for select to authenticated using ((select public.is_admin()));
create policy customer_notes_insert on public.customer_notes for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));
grant all on public.customer_notes to service_role;

-- ---------- booking list for admin tables (RLS of the caller applies) ----------
create view public.admin_booking_list with (security_invoker = true) as
select b.id, b.reference, b.customer_name, b.customer_email, b.customer_phone, b.customer_user_id,
       b.participant_count, b.total_paise, b.status, b.payment_status, b.payment_mode, b.created_at,
       b.scheduled_trip_id, t.trip_date, t.trek_id, k.name as trek_name, k.slug as trek_slug,
       coalesce((select sum(p.amount_paise) from public.payments p where p.booking_id = b.id and p.status = 'captured'), 0) as paid_paise
from public.bookings b
join public.scheduled_trips t on t.id = b.scheduled_trip_id
join public.treks k on k.id = t.trek_id;
grant select on public.admin_booking_list to authenticated, service_role;

-- ---------- dashboard ----------
create or replace function public.admin_dashboard_stats(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := coalesce(p_from, date '2000-01-01')::timestamp at time zone 'Asia/Kolkata';
  v_to   timestamptz := (coalesce(p_to, date '2100-01-01') + 1)::timestamp at time zone 'Asia/Kolkata';
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  r jsonb;
begin
  perform public.require_admin();
  with b as (select * from public.bookings where created_at >= v_from and created_at < v_to),
  pay as (select coalesce(sum(amount_paise), 0) s from public.payments where status = 'captured' and verified_at >= v_from and verified_at < v_to),
  ref as (select coalesce(sum(amount_paise), 0) s from public.refunds where status = 'processed' and processed_at >= v_from and processed_at < v_to)
  select jsonb_build_object(
    'total_bookings',     (select count(*) from b),
    'total_participants', (select coalesce(sum(participant_count), 0) from b where status <> 'cancelled'),
    'pending',            (select count(*) from b where status = 'pending'),
    'confirmed',          (select count(*) from b where status = 'confirmed'),
    'cancelled',          (select count(*) from b where status = 'cancelled'),
    'completed',          (select count(*) from b where status = 'completed'),
    'pending_payments',   (select count(*) from b where status in ('pending', 'confirmed') and payment_status in ('unpaid', 'pending')),
    'booking_value_paise',(select coalesce(sum(total_paise), 0) from b where status <> 'cancelled'),
    'collected_paise',    (select s from pay),
    'refunded_paise',     (select s from ref),
    'net_collected_paise',(select (select s from pay) - (select s from ref)),
    'upcoming_treks',     (select count(distinct t.trek_id) from public.scheduled_trips t join public.treks k on k.id = t.trek_id
                            where t.trip_date >= v_today and t.status = 'scheduled' and k.status = 'published'),
    'available_trips',    (select count(*) from public.scheduled_trips t join public.treks k on k.id = t.trek_id
                            where t.trip_date >= v_today and t.status = 'scheduled' and k.status = 'published'
                              and t.seats_reserved < t.capacity and now() <= public.trip_booking_deadline(t)),
    'open_cancellation_requests', (select count(*) from public.cancellation_requests where status = 'open'),
    'new_messages',       (select count(*) from public.contact_messages where status = 'new'),
    'failed_emails',      (select count(*) from public.email_log where status = 'failed')
  ) into r;
  return r;
end $$;

-- ---------- reports ----------
create or replace function public.admin_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := p_from::timestamp at time zone 'Asia/Kolkata';
  v_to   timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Kolkata';
  r jsonb;
begin
  perform public.require_admin();
  if p_from is null or p_to is null or p_from > p_to then raise exception 'INVALID_INPUT' using errcode = 'P0001', detail = 'date range'; end if;
  with b as (
    select b.*, k.name as trek_name from public.bookings b
    join public.scheduled_trips t on t.id = b.scheduled_trip_id join public.treks k on k.id = t.trek_id
    where b.created_at >= v_from and b.created_at < v_to)
  select jsonb_build_object(
    'by_date', coalesce((select jsonb_agg(x order by x.day) from (
        select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as bookings,
               sum(participant_count) filter (where status <> 'cancelled') as participants,
               count(*) filter (where status = 'cancelled') as cancelled
        from b group by 1) x), '[]'),
    'by_trek', coalesce((select jsonb_agg(x order by x.bookings desc) from (
        select trek_name, count(*) as bookings,
               coalesce(sum(participant_count) filter (where status <> 'cancelled'), 0) as participants,
               count(*) filter (where status = 'confirmed') as confirmed,
               count(*) filter (where status = 'pending') as pending,
               count(*) filter (where status = 'cancelled') as cancelled,
               coalesce(sum(total_paise) filter (where status <> 'cancelled'), 0) as booking_value_paise
        from b group by trek_name) x), '[]'),
    'status', jsonb_build_object(
        'pending', (select count(*) from b where status = 'pending'),
        'confirmed', (select count(*) from b where status = 'confirmed'),
        'completed', (select count(*) from b where status = 'completed'),
        'cancelled', (select count(*) from b where status = 'cancelled')),
    'participants', (select coalesce(sum(participant_count), 0) from b where status <> 'cancelled'),
    'payments_paise', (select coalesce(sum(amount_paise), 0) from public.payments where status = 'captured' and verified_at >= v_from and verified_at < v_to),
    'refunds_paise',  (select coalesce(sum(amount_paise), 0) from public.refunds where status = 'processed' and processed_at >= v_from and processed_at < v_to),
    'payments_by_provider', coalesce((select jsonb_object_agg(provider, s) from (
        select provider, sum(amount_paise) s from public.payments
        where status = 'captured' and verified_at >= v_from and verified_at < v_to group by provider) x), '{}'),
    'repeat_customers', coalesce((select jsonb_agg(x order by x.bookings desc) from (
        select customer_email as email, max(customer_name) as name, count(*) as bookings
        from public.bookings where status <> 'cancelled'
        group by customer_email having count(*) > 1 order by count(*) desc limit 100) x), '[]')
  ) into r;
  return r;
end $$;

-- ---------- customers (grouped by email) ----------
create or replace function public.admin_customers(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (email text, name text, phone text, user_id uuid, bookings bigint, active_bookings bigint,
               participants bigint, first_booking timestamptz, last_booking timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  with c as (
    select b.customer_email as email,
           (array_agg(b.customer_name order by b.created_at desc))[1] as name,
           (array_agg(b.customer_phone order by b.created_at desc))[1] as phone,
           max(b.customer_user_id::text)::uuid as user_id,
           count(*) as bookings,
           count(*) filter (where b.status in ('pending', 'confirmed')) as active_bookings,
           coalesce(sum(b.participant_count) filter (where b.status <> 'cancelled'), 0) as participants,
           min(b.created_at) as first_booking, max(b.created_at) as last_booking
    from public.bookings b
    group by b.customer_email)
  select c.*, count(*) over () as total_count from c
  where p_search is null or p_search = ''
     or c.email ilike '%' || p_search || '%' or c.name ilike '%' || p_search || '%' or c.phone ilike '%' || p_search || '%'
  order by c.last_booking desc
  limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end $$;

revoke all on function public.admin_dashboard_stats(date, date), public.admin_report(date, date),
                       public.admin_customers(text, integer, integer) from public, anon;
grant execute on function public.admin_dashboard_stats(date, date), public.admin_report(date, date),
                          public.admin_customers(text, integer, integer) to authenticated, service_role;

-- ---------- a trip can only be cancelled through admin_cancel_trip ----------
-- (which cancels its bookings first), never by editing the status column
create or replace function public.trg_trip_status_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and exists (
       select 1 from public.bookings where scheduled_trip_id = new.id and status in ('pending', 'confirmed')) then
    raise exception 'USE_CANCEL_TRIP' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'TRIP_ALREADY_CANCELLED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_trips_status_guard before update of status on public.scheduled_trips
  for each row execute function public.trg_trip_status_guard();
