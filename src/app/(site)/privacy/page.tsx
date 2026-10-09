import type { Metadata } from 'next';
import { TextPage } from '@/components/site/text-page';
import { LEGAL_DEFAULTS } from '@/lib/legal-defaults';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Privacy Policy" text={s.legal.privacy ?? LEGAL_DEFAULTS.privacy} />;
}
