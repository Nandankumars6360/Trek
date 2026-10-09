'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminOrError } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { ActionResult } from '@/lib/types';
import { uploadImage } from '@/lib/uploads';
import { fieldErrors, trekSchema } from '@/lib/validation';

const refresh = (slug?: string) => { revalidatePath('/admin/treks'); revalidatePath('/treks'); revalidatePath('/'); if (slug) revalidatePath(`/treks/${slug}`); };

export async function saveTrekAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const id = String(f.get('id') ?? '');
  const p = trekSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { ok: false, error: 'Please fix the fields listed below.', fieldErrors: fieldErrors(p.error) };
  const row = p.data;
  if (id) {
    const { error } = await a.supabase.from('treks').update(row).eq('id', id);
    if (error) return { ok: false, error: error.code === '23505' ? 'That slug is already used by another trek.' : friendlyError(error) };
    refresh(row.slug);
    return { ok: true, message: 'Trek saved.' };
  }
  const { data, error } = await a.supabase.from('treks').insert(row).select('id').single();
  if (error) return { ok: false, error: error.code === '23505' ? 'That slug is already used by another trek.' : friendlyError(error) };
  refresh(row.slug);
  redirect(`/admin/treks/${data.id}/edit?created=1`);
}

export async function setTrekStatusAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const status = String(f.get('status'));
  if (!['draft', 'published', 'archived'].includes(status)) return { ok: false, error: 'Invalid status' };
  const { data, error } = await a.supabase.from('treks').update({ status }).eq('id', String(f.get('id'))).select('slug').single();
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(data.slug);
  return { ok: true, message: `Trek ${status}.` };
}

export async function uploadTrekImageAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const id = String(f.get('id'));
  const kind = f.get('kind') === 'gallery' ? 'gallery' : 'featured';
  const up = await uploadImage(a.supabase, f.get('file') as File, `treks-${id.slice(0, 8)}`);
  if (!up.ok) return up;
  const { data: t } = await a.supabase.from('treks').select('slug, gallery_images').eq('id', id).single();
  if (!t) return { ok: false, error: 'Trek not found' };
  const patch = kind === 'featured' ? { featured_image: up.path } : { gallery_images: [...(t.gallery_images ?? []), up.path].slice(0, 20) };
  const { error } = await a.supabase.from('treks').update(patch).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(t.slug); revalidatePath(`/admin/treks/${id}/edit`);
  return { ok: true, message: 'Image uploaded.' };
}

export async function removeTrekImageAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const id = String(f.get('id')), path = String(f.get('path'));
  const { data: t } = await a.supabase.from('treks').select('slug, featured_image, gallery_images').eq('id', id).single();
  if (!t) return { ok: false, error: 'Trek not found' };
  const patch = t.featured_image === path ? { featured_image: null } : { gallery_images: (t.gallery_images as string[]).filter((g) => g !== path) };
  const { error } = await a.supabase.from('treks').update(patch).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error) };
  await a.supabase.storage.from('trek-images').remove([path]);
  refresh(t.slug); revalidatePath(`/admin/treks/${id}/edit`);
  return { ok: true, message: 'Image removed.' };
}

export async function deleteTrekAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const { error } = await a.supabase.from('treks').delete().eq('id', String(f.get('id')));
  if (error) return { ok: false, error: error.code === '23503' ? 'This trek has trip dates or bookings, so it can’t be deleted. Archive it instead.' : friendlyError(error) };
  refresh();
  redirect('/admin/treks');
}
