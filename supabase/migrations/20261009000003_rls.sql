-- =====================================================================
-- 0003 ROW LEVEL SECURITY + GRANTS
-- Browser roles: anon (visitors), authenticated (customers + admins).
-- service_role (server only) bypasses RLS.
-- Writes to bookings/payments happen ONLY through functions.
-- =====================================================================

-- Enable RLS everywhere
alter table public.profiles               enable row level security;
alter table public.admin_users            enable row level security;
alter table public.treks                  enable row level security;
alter table public.scheduled_trips        enable row level security;
alter table public.bookings               enable row level security;
alter table public.booking_admin_notes    enable row level security;
alter table public.participants           enable row level security;
alter table public.payments               enable row level security;
alter table public.refunds                enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.cancellation_requests  enable row level security;
alter table public.admin_audit_log        enable row level security;
alter table public.email_log              enable row level security;
alter table public.webhook_events         enable row level security;
alter table public.contact_messages       enable row level security;
alter table public.rate_limits            enable row level security;
alter table public.site_settings          enable row level security;
alter table public.faqs                   enable row level security;
alter table public.gallery_images         enable row level security;

-- Start from zero: Supabase grants broad table rights by default.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------- public content (read-only for visitors) ----------
grant select on public.treks, public.scheduled_trips, public.public_trips,
                public.faqs, public.gallery_images, public.site_settings to anon, authenticated;

create policy treks_public_read on public.treks for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
create policy trips_public_read on public.scheduled_trips for select to anon, authenticated
  using (exists (select 1 from public.treks k where k.id = trek_id and k.status = 'published')
         or (select public.is_admin()));
create policy faqs_public_read on public.faqs for select to anon, authenticated
  using (is_published or (select public.is_admin()));
create policy gallery_public_read on public.gallery_images for select to anon, authenticated
  using (is_published or (select public.is_admin()));
-- settings under "private." are never shown to visitors
create policy settings_public_read on public.site_settings for select to anon, authenticated
  using (key not like 'private.%' or (select public.is_admin()));

-- managers edit content (deletes on treks/trips are blocked by FKs once bookings exist)
grant insert, update, delete on public.treks, public.scheduled_trips, public.faqs,
                                public.gallery_images, public.site_settings to authenticated;
create policy treks_manage    on public.treks           for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy trips_manage    on public.scheduled_trips for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy faqs_manage     on public.faqs            for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy gallery_manage  on public.gallery_images  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy settings_manage on public.site_settings   for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
-- the seat counter is owned by the booking engine, never typed in by hand:
-- replace table-level insert/update on trips with column lists that exclude seats_reserved
revoke insert on public.scheduled_trips from authenticated;
grant insert (trek_id, trip_date, reporting_time, return_time, meeting_point, capacity,
              price_override_paise, booking_deadline, status, notes) on public.scheduled_trips to authenticated;
revoke update on public.scheduled_trips from authenticated;
grant update (trip_date, reporting_time, return_time, meeting_point, capacity,
              price_override_paise, booking_deadline, status, notes) on public.scheduled_trips to authenticated;

-- ---------- profiles ----------
grant select, update (full_name, phone) on public.profiles to authenticated;
create policy profiles_own_read   on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_own_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- admin_users: readable by admins, never writable from the browser ----------
grant select on public.admin_users to authenticated;
create policy admin_users_read on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------- bookings & participants: owner or admin may read; no direct writes ----------
grant select on public.bookings, public.participants to authenticated;
create policy bookings_read on public.bookings for select to authenticated
  using (customer_user_id = (select auth.uid()) or (select public.is_admin()));
create policy participants_read on public.participants for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
                  and (b.customer_user_id = (select auth.uid()) or (select public.is_admin()))));

-- ---------- payments / refunds: owner sees own; admins see all ----------
grant select on public.payments, public.refunds to authenticated;
create policy payments_read on public.payments for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_user_id = (select auth.uid())));
create policy refunds_read on public.refunds for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.payments p join public.bookings b on b.id = p.booking_id
                                               where p.id = payment_id and b.customer_user_id = (select auth.uid())));

-- ---------- cancellation requests: owner sees own; admins all ----------
grant select on public.cancellation_requests to authenticated;
create policy cancel_read on public.cancellation_requests for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_user_id = (select auth.uid())));

-- ---------- admin-only reads ----------
grant select on public.booking_admin_notes, public.booking_status_history, public.admin_audit_log,
                public.email_log, public.contact_messages to authenticated;
create policy notes_admin    on public.booking_admin_notes    for select to authenticated using ((select public.is_admin()));
create policy history_admin  on public.booking_status_history for select to authenticated using ((select public.is_admin()));
create policy audit_admin    on public.admin_audit_log        for select to authenticated using ((select public.is_manager()));
create policy email_admin    on public.email_log              for select to authenticated using ((select public.is_admin()));
create policy contact_admin  on public.contact_messages       for select to authenticated using ((select public.is_admin()));
grant update (status) on public.contact_messages to authenticated;
create policy contact_admin_update on public.contact_messages for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- webhook_events, rate_limits: no browser access at all (RLS on, no policies)

-- ---------- function access ----------
-- helpers used inside policies / by the app
grant execute on function public.is_admin(), public.is_manager(), public.get_setting(text, jsonb)
  to anon, authenticated;
grant execute on function public.trip_booking_deadline(public.scheduled_trips),
                          public.trip_starts_at(public.scheduled_trips) to anon, authenticated;

-- signed-in customers
grant execute on function public.request_cancellation(uuid, text),
                          public.update_my_booking_contact(uuid, text, text, text),
                          public.claim_my_guest_bookings(),
                          public.refund_preview(uuid) to authenticated;

-- admins (each function re-checks is_admin / is_manager itself)
grant execute on function public.admin_set_booking_status(uuid, public.booking_status, text),
                          public.admin_record_manual_payment(uuid, integer, text, text, text),
                          public.admin_record_refund(uuid, integer, text, text, text),
                          public.admin_add_booking_note(uuid, text),
                          public.admin_reject_cancellation(uuid, text),
                          public.admin_complete_trip(uuid),
                          public.admin_cancel_trip(uuid, text) to authenticated;

-- NOT granted to browser roles (server/service_role only):
--   create_booking, get_booking_for_guest, request_cancellation_guest,
--   create_online_payment, record_verified_online_payment, mark_online_payment_failed,
--   mark_refund_processed, check_rate_limit, recompute_payment_status, gen_booking_reference
