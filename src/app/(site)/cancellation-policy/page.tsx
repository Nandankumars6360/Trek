import type { Metadata } from 'next';
import { TextPage } from '@/components/site/text-page';
import { LEGAL_DEFAULTS } from '@/lib/legal-defaults';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Cancellation & Refund Policy', alternates: { canonical: '/cancellation-policy' } };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Cancellation & Refund Policy" text={s.legal.cancellation ?? LEGAL_DEFAULTS.cancellation} />;
}
