-- =====================================================================
-- SEED: default settings, starter FAQs, and clearly labelled DEMO treks.
-- Demo treks use placeholder logistics on purpose: replace them in the
-- admin panel (or archive them) before going live.
-- =====================================================================

insert into public.site_settings (key, value) values
  ('brand.name',              '"YourBrand"'),
  ('brand.tagline',           '"One-day treks for college students"'),
  ('brand.logo_path',         'null'),
  ('contact.email',           '"hello@example.com"'),
  ('contact.phone',           '"+91 00000 00000"'),
  ('contact.whatsapp',        'null'),
  ('social.instagram',        'null'),
  ('social.youtube',          'null'),
  ('home.hero_title',         '"Your Next Adventure Starts Here."'),
  ('home.hero_subtitle',      '"Discover beautiful trails, meet new people, and escape your routine with unforgettable one-day trekking experiences."'),
  ('home.announcement',       'null'),
  ('home.show_testimonials',  'false'),
  ('about.body',              '"Write your story here from Admin → Content."'),
  ('booking.require_approval','true'),
  ('booking.policy_version',  '"v1"'),
  ('payments.online_enabled', 'false'),
  ('payments.manual_instructions', '"Pay by UPI to <your UPI ID> and share the transaction ID on WhatsApp. Your seat is confirmed once we verify the payment."')
on conflict (key) do nothing;

insert into public.faqs (question, answer, display_order) values
  ('What is included in the trek price?', 'Edit this answer in Admin → Content → FAQs.', 1),
  ('What should participants carry?',     'Each trek page lists what to carry. Edit this answer in Admin → Content → FAQs.', 2),
  ('Is the trek suitable for beginners?', 'Each trek shows its difficulty level. Edit this answer in Admin → Content → FAQs.', 3),
  ('What happens if weather conditions are unsafe?', 'Edit this answer in Admin → Content → FAQs.', 4),
  ('What is the cancellation policy?',    'See the Cancellation & Refund Policy page. Edit this answer in Admin → Content → FAQs.', 5),
  ('Are meals and transportation included?', 'Edit this answer in Admin → Content → FAQs.', 6),
  ('How can a participant contact the organizers?', 'Use the Contact page or the phone number in the footer.', 7);

with demo as (
  insert into public.treks (name, slug, destination, region, short_description, description, difficulty,
    distance_km, duration_hours, price_paise, inclusions, exclusions, things_to_carry,
    meeting_point, default_reporting_time, default_return_time, cancellation_policy, refund_rules,
    max_participants_per_booking, is_featured, status)
  values
   ('[DEMO] Sunrise Hill Trek', 'demo-sunrise-hill', 'Demo destination A', 'Demo region',
    'Demo listing — replace before launch.', 'Demo trek created by the seed script. Edit or archive it in Admin → Treks.',
    'easy', 8, 5, 89900, '{"Demo inclusion"}', '{"Demo exclusion"}', '{"Water","Trek shoes"}',
    'DEMO — set the real meeting point in admin', '03:30', '12:00',
    'Demo policy — set your real policy in admin.', '[{"hours_before":72,"refund_percent":100},{"hours_before":24,"refund_percent":50}]',
    6, true, 'published'),
   ('[DEMO] Forest Ridge Trek', 'demo-forest-ridge', 'Demo destination B', 'Demo region',
    'Demo listing — replace before launch.', 'Demo trek created by the seed script. Edit or archive it in Admin → Treks.',
    'moderate', 12, 8, 109900, '{"Demo inclusion"}', '{"Demo exclusion"}', '{"Water","Cap","Trek shoes"}',
    'DEMO — set the real meeting point in admin', '05:30', '17:00',
    'Demo policy — set your real policy in admin.', '[{"hours_before":72,"refund_percent":100}]',
    4, false, 'published')
  returning id, slug
)
insert into public.scheduled_trips (trek_id, trip_date, capacity)
select d.id, current_date + n, case when d.slug = 'demo-sunrise-hill' then 30 else 20 end
from demo d cross join (values (7), (14), (21)) as v(n);
