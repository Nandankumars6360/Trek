import type { MetadataRoute } from 'next';
import { publicEnv, isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/server';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const pages = ['', '/treks', '/about', '/contact', '/faq', '/privacy', '/terms', '/cancellation-policy']
    .map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 }));
  if (!isSupabaseConfigured) return pages;
  const { data } = await createPublicClient().from('treks').select('slug, updated_at').eq('status', 'published');
  return [...pages, ...(data ?? []).map((t) => ({ url: `${base}/treks/${t.slug}`, lastModified: t.updated_at, changeFrequency: 'weekly' as const, priority: 0.8 }))];
}
