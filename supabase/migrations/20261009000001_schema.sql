-- =====================================================================
-- 0001 SCHEMA: types, tables, constraints, indexes
-- Money is stored as integer paise. Times are Asia/Kolkata wall-clock.
-- =====================================================================

-- ---------- Enums ----------
create type public.difficulty_level as enum ('easy', 'moderate', 'difficult');
create type public.trek_status      as enum ('draft', 'published', 'archived');
create type public.trip_status      as enum ('scheduled', 'completed', 'cancelled');  -- "full" is derived from seats
create type public.booking_status   as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.payment_status   as enum ('unpaid', 'pending', 'paid', 'partially_refunded', 'refunded');
create type public.payment_mode     as enum ('manual', 'online');
create type public.admin_role       as enum ('owner', 'admin', 'staff');

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- profiles ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  email       text,
  phone       text check (phone is null or phone ~ '^\+91[6-9][0-9]{9}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- admin_users (only writable from SQL editor / service role) ----------
create table public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.admin_role not null default 'admin',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- treks ----------
create table public.treks (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(name) between 3 and 120),
  slug                    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  destination             text not null check (char_length(destination) <= 160),
  region                  text,
  short_description       text check (char_length(short_description) <= 300),
  description             text,
  difficulty              public.difficulty_level not null default 'easy',
  distance_km             numeric(6,2) check (distance_km is null or distance_km > 0),
  duration_hours          numeric(5,2) check (duration_hours is null or duration_hours > 0),
  elevation_m             integer check (elevation_m is null or elevation_m >= 0),
  price_paise             integer not null check (price_paise >= 0),
  featured_image          text,
  gallery_images          jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery_images) = 'array'),
  itinerary               jsonb not null default '[]'::jsonb check (jsonb_typeof(itinerary) = 'array'),
  inclusions              text[] not null default '{}',
  exclusions              text[] not null default '{}',
  things_to_carry         text[] not null default '{}',
  fitness_guidance        text,
  min_age                 integer check (min_age is null or min_age between 0 and 100),
  safety_info             text,
  weather_info            text,
  meeting_point           text,
  meeting_point_map_url   text check (meeting_point_map_url is null or meeting_point_map_url ~ '^https://'),
  default_reporting_time  time,
  default_return_time     time,
  leader_name             text,
  leader_bio              text,
  meals_offered           boolean not null default false,
  cancellation_policy     text,
  -- e.g. [{"hours_before":72,"refund_percent":100},{"hours_before":24,"refund_percent":50}]
  refund_rules            jsonb not null default '[]'::jsonb check (jsonb_typeof(refund_rules) = 'array'),
  min_participants_per_booking integer not null default 1 check (min_participants_per_booking >= 1),
  max_participants_per_booking integer not null default 6 check (max_participants_per_booking between 1 and 20),
  is_featured             boolean not null default false,
  status                  public.trek_status not null default 'draft',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (min_participants_per_booking <= max_participants_per_booking)
);
create index idx_treks_status on public.treks (status);
create trigger trg_treks_updated before update on public.treks
  for each row execute function public.set_updated_at();

-- ---------- scheduled_trips ----------
create table public.scheduled_trips (
  id                    uuid primary key default gen_random_uuid(),
  trek_id               uuid not null references public.treks (id) on delete restrict,
  trip_date             date not null,
  reporting_time        time,
  return_time           time,
  meeting_point         text,                    -- overrides trek.meeting_point when set
  capacity              integer not null check (capacity between 1 and 500),
  seats_reserved        integer not null default 0 check (seats_reserved >= 0),
  price_override_paise  integer check (price_override_paise is null or price_override_paise >= 0),
  booking_deadline      timestamptz,
  status                public.trip_status not null default 'scheduled',
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint trip_not_overbooked check (seats_reserved <= capacity),
  unique (trek_id, trip_date, reporting_time)
);
create index idx_trips_trek on public.scheduled_trips (trek_id);
create index idx_trips_date on public.scheduled_trips (trip_date);
create trigger trg_trips_updated before update on public.scheduled_trips
  for each row execute function public.set_updated_at();

-- ---------- bookings ----------
create table public.bookings (
  id                          uuid primary key default gen_random_uuid(),
  reference                   text not null unique,              -- unguessable, e.g. TRK-7K3QX9MZ2A
  access_token                uuid not null unique default gen_random_uuid(),  -- for guest links
  idempotency_key             uuid not null unique,              -- duplicate-submit guard
  customer_user_id            uuid references auth.users (id) on delete set null,
  customer_name               text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_email              text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and customer_email = lower(customer_email)),
  customer_phone              text not null check (customer_phone ~ '^\+91[6-9][0-9]{9}$'),
  scheduled_trip_id           uuid not null references public.scheduled_trips (id) on delete restrict,
  participant_count           integer not null check (participant_count between 1 and 20),
  price_per_participant_paise integer not null check (price_per_participant_paise >= 0),
  total_paise                 integer not null check (total_paise >= 0),
  status                      public.booking_status not null default 'pending',
  payment_status              public.payment_status not null default 'unpaid',
  payment_mode                public.payment_mode not null default 'manual',
  emergency_contact_name      text not null check (char_length(btrim(emergency_contact_name)) between 2 and 120),
  emergency_contact_phone     text not null check (emergency_contact_phone ~ '^\+91[6-9][0-9]{9}$'),
  food_preference             text check (food_preference is null or food_preference in ('veg', 'non_veg', 'vegan', 'jain')),
  safety_notes                text check (char_length(safety_notes) <= 1000),     -- optional, restricted
  special_requests            text check (char_length(special_requests) <= 1000),
  terms_accepted_at           timestamptz not null,
  privacy_accepted_at         timestamptz not null,
  policy_version              text not null,
  confirmed_at                timestamptz,
  cancelled_at                timestamptz,
  cancel_reason               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint total_matches check (total_paise = price_per_participant_paise * participant_count)
);
create index idx_bookings_trip      on public.bookings (scheduled_trip_id);
create index idx_bookings_user      on public.bookings (customer_user_id);
create index idx_bookings_email     on public.bookings (customer_email);
create index idx_bookings_phone     on public.bookings (customer_phone);
create index idx_bookings_status    on public.bookings (status, payment_status);
create index idx_bookings_created   on public.bookings (created_at desc);
-- one active booking per email per trip (stops accidental double registrations)
create unique index uq_active_booking_per_email on public.bookings (scheduled_trip_id, customer_email)
  where status in ('pending', 'confirmed');
create trigger trg_bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

-- internal notes live apart from bookings so customers can never read them
create table public.booking_admin_notes (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null,
  note        text not null check (char_length(note) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index idx_notes_booking on public.booking_admin_notes (booking_id);

-- ---------- participants ----------
create table public.participants (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 2 and 120),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_participants_booking on public.participants (booking_id);

-- ---------- payments ----------
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id) on delete restrict,
  provider              text not null check (provider in ('manual', 'razorpay')),
  provider_order_id     text,
  provider_payment_id   text,                         -- razorpay pay_xxx, or manual UPI/UTR ref
  amount_paise          integer not null check (amount_paise > 0),
  currency              text not null default 'INR' check (currency = 'INR'),
  status                text not null check (status in ('created', 'captured', 'failed')),
  method                text,                         -- upi / cash / card / netbanking (never card numbers)
  verified_at           timestamptz,
  recorded_by           uuid references auth.users (id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  unique (provider, provider_payment_id),
  check (status <> 'captured' or verified_at is not null)
);
create index idx_payments_booking on public.payments (booking_id);
create unique index uq_payments_order on public.payments (provider, provider_order_id) where provider_order_id is not null;

-- ---------- refunds ----------
create table public.refunds (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references public.payments (id) on delete restrict,
  amount_paise        integer not null check (amount_paise > 0),
  reason              text,
  status              text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  provider_refund_id  text unique,
  processed_at        timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index idx_refunds_payment on public.refunds (payment_id);

-- ---------- booking_status_history ----------
create table public.booking_status_history (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  field       text not null check (field in ('status', 'payment_status')),
  old_value   text,
  new_value   text not null,
  changed_by  uuid,
  reason      text,
  created_at  timestamptz not null default now()
);
create index idx_history_booking on public.booking_status_history (booking_id, created_at);

-- ---------- cancellation_requests ----------
create table public.cancellation_requests (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  reason        text check (char_length(reason) <= 1000),
  status        text not null default 'open' check (status in ('open', 'approved', 'rejected')),
  resolved_by   uuid references auth.users (id) on delete set null,
  resolution_note text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index uq_open_cancel_request on public.cancellation_requests (booking_id) where status = 'open';

-- ---------- admin audit log ----------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_created on public.admin_audit_log (created_at desc);

-- ---------- email log ----------
create table public.email_log (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid references public.bookings (id) on delete set null,
  to_email         text not null,
  template         text not null,
  status           text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_id      text,
  error            text,
  attempts         integer not null default 0,
  last_attempt_at  timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_email_status on public.email_log (status, created_at);

-- ---------- payment webhook dedupe ----------
create table public.webhook_events (
  provider      text not null,
  event_id      text not null,
  event_type    text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  primary key (provider, event_id)
);

-- ---------- contact messages ----------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or phone ~ '^\+91[6-9][0-9]{9}$'),
  subject     text not null check (char_length(subject) between 2 and 200),
  message     text not null check (char_length(message) between 5 and 4000),
  status      text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at  timestamptz not null default now()
);

-- ---------- rate limits ----------
create table public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          integer not null
);

-- ---------- content ----------
create table public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.faqs (
  id            uuid primary key default gen_random_uuid(),
  question      text not null,
  answer        text not null,
  display_order integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.gallery_images (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,
  caption       text,
  display_order integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);
