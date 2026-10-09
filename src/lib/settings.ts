import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export type Settings = {
  brandName: string; tagline: string; logoPath: string | null;
  email: string; phone: string; whatsapp: string | null;
  instagram: string | null; youtube: string | null;
  heroTitle: string; heroSubtitle: string; heroImage: string | null;
  announcement: string | null; aboutBody: string;
  showTestimonials: boolean; testimonials: { quote: string; name: string; sample?: boolean }[];
  requireApproval: boolean; policyVersion: string;
  onlinePaymentsEnabled: boolean; manualInstructions: string;
  legal: { privacy: string | null; terms: string | null; cancellation: string | null };
};

const DEFAULTS: Settings = {
  brandName: 'YourBrand', tagline: 'One-day treks for college students', logoPath: null,
  email: '', phone: '', whatsapp: null, instagram: null, youtube: null,
  heroTitle: 'Your Next Adventure Starts Here.',
  heroSubtitle: 'Discover beautiful trails, meet new people, and escape your routine with unforgettable one-day trekking experiences.',
  heroImage: null, announcement: null, aboutBody: '', showTestimonials: false, testimonials: [],
  requireApproval: true, policyVersion: 'v1', onlinePaymentsEnabled: false, manualInstructions: '',
  legal: { privacy: null, terms: null, cancellation: null },
};

export const getSettings = cache(async (): Promise<Settings> => {
  if (!isSupabaseConfigured) return DEFAULTS;
  const { data, error } = await createPublicClient().from('site_settings').select('key, value');
  if (error || !data) return DEFAULTS;
  const m = new Map(data.map((r) => [r.key as string, r.value as unknown]));
  const s = <T,>(k: string, d: T): T => (m.has(k) && m.get(k) !== null ? (m.get(k) as T) : d);
  return {
    brandName: s('brand.name', DEFAULTS.brandName), tagline: s('brand.tagline', DEFAULTS.tagline),
    logoPath: s('brand.logo_path', null),
    email: s('contact.email', ''), phone: s('contact.phone', ''), whatsapp: s('contact.whatsapp', null),
    instagram: s('social.instagram', null), youtube: s('social.youtube', null),
    heroTitle: s('home.hero_title', DEFAULTS.heroTitle), heroSubtitle: s('home.hero_subtitle', DEFAULTS.heroSubtitle),
    heroImage: s('home.hero_image', null), announcement: s('home.announcement', null),
    aboutBody: s('about.body', ''), showTestimonials: s('home.show_testimonials', false),
    testimonials: s('home.testimonials', []),
    requireApproval: s('booking.require_approval', true), policyVersion: s('booking.policy_version', 'v1'),
    onlinePaymentsEnabled: s('payments.online_enabled', false), manualInstructions: s('payments.manual_instructions', ''),
    legal: { privacy: s('legal.privacy', null), terms: s('legal.terms', null), cancellation: s('legal.cancellation', null) },
  };
});
