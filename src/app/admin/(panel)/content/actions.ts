'use server';
import { revalidatePath } from 'next/cache';
import { adminOrError } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { ActionResult } from '@/lib/types';
import { uploadImage } from '@/lib/uploads';

const refreshSite = () => revalidatePath('/', 'layout');
const text = (f: FormData, k: string, max = 5000) => { const v = String(f.get(k) ?? '').trim().slice(0, max); return v || null; };
const url = (v: string | null) => (v && /^https:\/\//.test(v) ? v : null);

async function upsert(supabase: Awaited<ReturnType<typeof adminOrError>> & { ok: true }, rows: Record<string, unknown>) {
  const { error } = await supabase.supabase.from('site_settings')
    .upsert(Object.entries(rows).map(([key, value]) => ({ key, value: value ?? null, updated_by: supabase.user.id, updated_at: new Date().toISOString() })));
  return error;
}

export async function saveSiteContentAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const brand = text(f, 'brand_name', 60);
  if (!brand) return { ok: false, error: 'Brand name is required.' };
  for (const k of ['instagram', 'youtube']) if (text(f, k) && !url(text(f, k))) return { ok: false, error: `${k} link must start with https://` };
  const testimonials = (text(f, 'testimonials', 8000) ?? '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0])
    .map(([quote, name, sample]) => ({ quote, name: name || 'Anonymous', sample: /sample/i.test(sample ?? '') }));
  const error = await upsert(a, {
    'brand.name': brand, 'brand.tagline': text(f, 'tagline', 120) ?? '',
    'contact.email': text(f, 'email', 200) ?? '', 'contact.phone': text(f, 'phone', 30) ?? '', 'contact.whatsapp': text(f, 'whatsapp', 30),
    'social.instagram': url(text(f, 'instagram')), 'social.youtube': url(text(f, 'youtube')),
    'home.hero_title': text(f, 'hero_title', 120) ?? '', 'home.hero_subtitle': text(f, 'hero_subtitle', 300) ?? '',
    'home.announcement': text(f, 'announcement', 200), 'about.body': text(f, 'about', 10000) ?? '',
    'home.show_testimonials': f.get('show_testimonials') === 'on', 'home.testimonials': testimonials,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: 'Website content saved.' };
}

export async function saveLegalAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const error = await upsert(a, {
    'legal.privacy': text(f, 'privacy', 30000), 'legal.terms': text(f, 'terms', 30000), 'legal.cancellation': text(f, 'cancellation', 30000),
    ...(f.get('bump') === 'on' ? { 'booking.policy_version': `v${new Date().toISOString().slice(0, 10)}` } : {}),
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: 'Policies saved.' };
}

export async function uploadBrandImageAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const which = f.get('which') === 'logo' ? 'brand.logo_path' : 'home.hero_image';
  if (f.get('remove') === '1') { const e = await upsert(a, { [which]: null }); if (e) return { ok: false, error: friendlyError(e) }; refreshSite(); return { ok: true, message: 'Removed.' }; }
  const up = await uploadImage(a.supabase, f.get('file') as File, 'brand');
  if (!up.ok) return up;
  const error = await upsert(a, { [which]: up.path });
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: 'Image updated.' };
}

export async function saveFaqAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const id = String(f.get('id') ?? '');
  const row = { question: text(f, 'question', 300), answer: text(f, 'answer', 4000), display_order: Number(f.get('display_order')) || 0, is_published: f.get('is_published') === 'on' };
  if (!row.question || !row.answer) return { ok: false, error: 'Question and answer are required.' };
  const { error } = id ? await a.supabase.from('faqs').update(row).eq('id', id) : await a.supabase.from('faqs').insert(row);
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: id ? 'FAQ saved.' : 'FAQ added.' };
}

export async function deleteFaqAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const { error } = await a.supabase.from('faqs').delete().eq('id', String(f.get('id')));
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: 'FAQ deleted.' };
}

export async function addGalleryImageAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const up = await uploadImage(a.supabase, f.get('file') as File, 'gallery');
  if (!up.ok) return up;
  const { error } = await a.supabase.from('gallery_images').insert({ storage_path: up.path, caption: text(f, 'caption', 200), display_order: Number(f.get('display_order')) || 0 });
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: 'Photo added.' };
}

export async function updateGalleryImageAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const id = String(f.get('id'));
  if (f.get('delete') === '1') {
    const { data } = await a.supabase.from('gallery_images').delete().eq('id', id).select('storage_path').single();
    if (data) await a.supabase.storage.from('trek-images').remove([data.storage_path]);
    refreshSite();
    return { ok: true, message: 'Photo deleted.' };
  }
  const { error } = await a.supabase.from('gallery_images').update({
    caption: text(f, 'caption', 200), display_order: Number(f.get('display_order')) || 0, is_published: f.get('is_published') === 'on',
  }).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error) };
  refreshSite();
  return { ok: true, message: 'Saved.' };
}
