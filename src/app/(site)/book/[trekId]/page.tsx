import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getTrekById } from '@/lib/data/public';
import { isRazorpayConfigured, isSupabaseConfigured } from '@/lib/env';
import { difficultyLabel } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { BookingForm } from './booking-form';

export const metadata: Metadata = { title: 'Book', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function BookPage({ params, searchParams }: {
  params: Promise<{ trekId: string }>; searchParams: Promise<{ trip?: string }>;
}) {
  const [{ trekId }, { trip }] = await Promise.all([params, searchParams]);
  const r = await getTrekById(trekId);
  if (!r) notFound();
  const { trek, trips } = r;
  const settings = await getSettings();
  const user = isSupabaseConfigured ? (await getSessionUser()).user : null;
  const open = trips.filter((t) => t.availability === 'open');

  const cancellationSummary = [...(trek.refund_rules ?? [])].sort((a, b) => b.hours_before - a.hours_before)
    .map((x) => `${x.hours_before}+ hours before reporting: ${x.refund_percent}% refund`);
  if (cancellationSummary.length) cancellationSummary.push('Later than that: no refund');

  return (
    <div className="container-x max-w-3xl py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-charcoal-600"><Link href={`/treks/${trek.slug}`} className="hover:underline">← {trek.name}</Link></nav>
      <h1 className="mt-3 text-4xl">Book {trek.name}</h1>
      <p className="mt-2 text-charcoal-600">{trek.destination} · {difficultyLabel[trek.difficulty]} · no account needed</p>
      <div className="mt-8">
        <BookingForm
          trekName={trek.name}
          trips={open.map((t) => ({ id: t.trip_id, date: t.trip_date, reporting: t.reporting_time, returnTime: t.return_time, seatsLeft: t.seats_left, pricePaise: t.price_paise }))}
          preselectTrip={trip}
          minPeople={trek.min_participants_per_booking}
          maxPeople={trek.max_participants_per_booking}
          mealsOffered={trek.meals_offered}
          cancellationSummary={cancellationSummary}
          onlineAvailable={settings.onlinePaymentsEnabled && isRazorpayConfigured()}
          requireApproval={settings.requireApproval}
          prefill={{ name: (user?.user_metadata?.full_name as string | undefined) ?? undefined, email: user?.email ?? undefined }}
        />
      </div>
    </div>
  );
}
