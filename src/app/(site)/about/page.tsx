import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui';
import { TextPage } from '@/components/site/text-page';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'About Us', alternates: { canonical: '/about' } };
export const dynamic = 'force-dynamic';

export default async function About() {
  const s = await getSettings();
  return (
    <>
      <TextPage title={`About ${s.brandName}`} text={s.aboutBody || `${s.brandName} runs one-day treks for college students — early starts, small groups and home the same evening.`} />
      <div className="container-x max-w-3xl"><ButtonLink href="/treks">Explore treks</ButtonLink></div>
    </>
  );
}
