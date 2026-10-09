import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink, EmptyState } from '@/components/ui';
import { getTrekCards } from '@/lib/data/public';
import { formatDate, formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Book a trek', alternates: { canonical: '/register' } };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const cards = (await getTrekCards().catch(() => [])).filter((c) => c.openTrips > 0)
    .sort((a, b) => a.nextTrip!.trip_date.localeCompare(b.nextTrip!.trip_date));
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-4xl">Book your trek</h1>
      <p className="mt-3 text-charcoal-600">Choose a trek to continue. You don&apos;t need an account to book.</p>
      {cards.length ? (
        <ul className="mt-8 divide-y divide-sand-200 rounded-xl2 border border-sand-200 bg-white">
          {cards.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/treks/${c.slug}`} className="font-display text-xl hover:underline">{c.name}</Link>
                <p className="text-sm text-charcoal-600">{c.destination} · next {formatDate(c.nextTrip!.trip_date, { year: undefined })} · {c.openTrips} date{c.openTrips > 1 ? 's' : ''} open</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold">{formatINR(c.fromPrice)}</span>
                <ButtonLink href={`/book/${c.id}`} size="sm">Continue</ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      ) : <div className="mt-8"><EmptyState title="No treks are open for booking right now">New dates are added regularly.</EmptyState></div>}
    </div>
  );
}
