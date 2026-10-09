import type { Metadata } from 'next';
import { TextPage } from '@/components/site/text-page';
import { LEGAL_DEFAULTS } from '@/lib/legal-defaults';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Terms & Conditions', alternates: { canonical: '/terms' } };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Terms & Conditions" text={s.legal.terms ?? LEGAL_DEFAULTS.terms} />;
}
