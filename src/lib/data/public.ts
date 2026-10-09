import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { todayIST } from '@/lib/format';
import type { PublicTrip, Trek } from '@/lib/types';

export type TrekCard = Pick<Trek, 'id' | 'name' | 'slug' | 'destination' | 'region' | 'difficulty' | 'distance_km'
  | 'duration_hours' | 'short_description' | 'featured_image' | 'is_featured' | 'price_paise'> & {
  nextTrip: PublicTrip | null; openTrips: number; fromPrice: number;
};

const CARD_COLS = 'id, name, slug, destination, region, difficulty, distance_km, duration_hours, short_description, featured_image, is_featured, price_paise';

export const getUpcomingTrips = cache(async (): Promise<PublicTrip[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createPublicClient().from('public_trips').select('*')
    .gte('trip_date', todayIST()).order('trip_date').order('reporting_time').limit(500);
  if (error) throw new Error('Could not load trips');
  return (data ?? []) as PublicTrip[];
});

export const getTrekCards = cache(async (): Promise<TrekCard[]> => {
  if (!isSupabaseConfigured) return [];
  const [{ data: treks, error }, trips] = await Promise.all([
    createPublicClient().from('treks').select(CARD_COLS).eq('status', 'published').order('name'),
    getUpcomingTrips(),
  ]);
  if (error) throw new Error('Could not load treks');
  return (treks ?? []).map((t) => {
    const mine = trips.filter((x) => x.trek_id === t.id && x.availability !== 'cancelled');
    const open = mine.filter((x) => x.availability === 'open');
    return {
      ...(t as Omit<TrekCard, 'nextTrip' | 'openTrips' | 'fromPrice'>),
      nextTrip: open[0] ?? mine[0] ?? null,
      openTrips: open.length,
      fromPrice: open.length ? Math.min(...open.map((x) => x.price_paise)) : t.price_paise,
    };
  });
});

export type TrekFilters = {
  q?: string; difficulty?: string; from?: string; to?: string;
  min?: string; max?: string; sort?: string; page?: string; location?: string;
};

export const PAGE_SIZE = 9;

export async function searchTreks(f: TrekFilters) {
  const all = await getTrekCards();
  const trips = await getUpcomingTrips();
  const q = f.q?.trim().toLowerCase();
  const loc = f.location?.trim().toLowerCase();
  const min = f.min ? Number(f.min) * 100 : null;
  const max = f.max ? Number(f.max) * 100 : null;
  const dated = Boolean(f.from || f.to);

  let rows = all.filter((t) => {
    if (q && !`${t.name} ${t.destination} ${t.region ?? ''}`.toLowerCase().includes(q)) return false;
    if (loc && !`${t.destination} ${t.region ?? ''}`.toLowerCase().includes(loc)) return false;
    if (f.difficulty && t.difficulty !== f.difficulty) return false;
    if (min != null && t.fromPrice < min) return false;
    if (max != null && t.fromPrice > max) return false;
    return true;
  });

  if (dated) {
    rows = rows.flatMap((t) => {
      const inRange = trips.filter((x) => x.trek_id === t.id && x.availability === 'open'
        && (!f.from || x.trip_date >= f.from) && (!f.to || x.trip_date <= f.to));
      return inRange.length ? [{ ...t, nextTrip: inRange[0], openTrips: inRange.length }] : [];
    });
  }

  const sort = f.sort ?? 'date';
  rows.sort((a, b) => {
    if (sort === 'price_asc') return a.fromPrice - b.fromPrice;
    if (sort === 'price_desc') return b.fromPrice - a.fromPrice;
    if (sort === 'name') return a.name.localeCompare(b.name);
    const ad = a.openTrips ? a.nextTrip!.trip_date : '9999';
    const bd = b.openTrips ? b.nextTrip!.trip_date : '9999';
    return ad.localeCompare(bd) || a.name.localeCompare(b.name);
  });

  const page = Math.max(1, Number(f.page) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  return { total: rows.length, page, pages, rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export const getTrekBySlug = cache(async (slug: string) => {
  if (!isSupabaseConfigured) return null;
  const { data } = await createPublicClient().from('treks').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  if (!data) return null;
  const trips = (await getUpcomingTrips()).filter((t) => t.trek_id === data.id);
  return { trek: data as Trek, trips };
});

export const getTrekById = cache(async (id: string) => {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createPublicClient().from('treks').select('*').eq('id', id).eq('status', 'published').maybeSingle();
  if (!data) return null;
  const trips = (await getUpcomingTrips()).filter((t) => t.trek_id === data.id);
  return { trek: data as Trek, trips };
});

export const getFaqs = cache(async () => {
  if (!isSupabaseConfigured) return [];
  const { data } = await createPublicClient().from('faqs').select('id, question, answer').eq('is_published', true).order('display_order');
  return (data ?? []) as { id: string; question: string; answer: string }[];
});

export const getGallery = cache(async () => {
  if (!isSupabaseConfigured) return [];
  const { data } = await createPublicClient().from('gallery_images').select('id, storage_path, caption').eq('is_published', true).order('display_order').limit(12);
  return (data ?? []) as { id: string; storage_path: string; caption: string | null }[];
});
