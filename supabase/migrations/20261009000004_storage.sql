-- =====================================================================
-- 0004 STORAGE: public image bucket, manager-only uploads
-- Only JPEG/PNG/WebP/AVIF, max 5 MB. Server also re-validates uploads.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trek-images', 'trek-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy trek_images_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'trek-images');

create policy trek_images_manager_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'trek-images' and (select public.is_manager())
              and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'avif'));

create policy trek_images_manager_update on storage.objects for update to authenticated
  using (bucket_id = 'trek-images' and (select public.is_manager()))
  with check (bucket_id = 'trek-images' and (select public.is_manager()));

create policy trek_images_manager_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trek-images' and (select public.is_manager()));
