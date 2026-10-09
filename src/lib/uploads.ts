import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BYTES = 5 * 1024 * 1024;

/** Detects the real file type from its first bytes — the browser-supplied type and name are not trusted. */
export function sniffImage(bytes: Uint8Array): { ext: string; mime: string } | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { ext: 'png', mime: 'image/png' };
  const ascii = (s: number, e: number) => String.fromCharCode(...bytes.slice(s, e));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return { ext: 'avif', mime: 'image/avif' };
  return null;
}

export async function uploadImage(supabase: SupabaseClient, file: File, folder: string) {
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: 'Choose an image file.' };
  if (file.size > MAX_BYTES) return { ok: false as const, error: 'Image must be 5 MB or smaller.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false as const, error: 'Only JPEG, PNG, WebP or AVIF images are allowed.' };
  const path = `${folder.replace(/[^\w-]/g, '')}/${randomUUID()}.${kind.ext}`;
  // runs as the signed-in admin: storage policies allow uploads for managers only
  const { error } = await supabase.storage.from('trek-images').upload(path, bytes, { contentType: kind.mime, upsert: false, cacheControl: '31536000' });
  if (error) return { ok: false as const, error: 'Upload failed. Check you have permission and try again.' };
  return { ok: true as const, path };
}
