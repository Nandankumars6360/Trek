import Image from 'next/image';
import Link from 'next/link';
import { Badge, ButtonLink } from '@/components/ui';
import { storagePublicUrl } from '@/lib/env';
import { formatDate, formatINR } from '@/lib/format';
import type { TrekCard as TrekCardT } from '@/lib/data/public';
import { TrekPlaceholder } from './mountains';

export function TrekCard({ trek, index = 0 }: { trek: TrekCardT; index?: number }) {
  const img = storagePublicUrl(trek.featured_image);
  const next = trek.nextTrip;
  const bookable = trek.openTrips > 0;
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl2 border border-sand-200 bg-white shadow-card transition-shadow hover:shadow-lg">
      <Link href={`/treks/${trek.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-sand-100" tabIndex={-1} aria-hidden>
        {img ? (
          <Image src={img} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : <TrekPlaceholder seed={index} className="size-full" />}
        <div className="absolute left-3 top-3 flex gap-2"><Badge value={trek.difficulty} /></div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-clay-600">{trek.destination}</p>
        <h3 className="mt-1 text-xl"><Link href={`/treks/${trek.slug}`} className="hover:underline">{trek.name}</Link></h3>
        {trek.short_description && <p className="mt-2 line-clamp-2 text-sm text-charcoal-600">{trek.short_description}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-charcoal-600">
          <div><dt className="sr-only">Distance</dt><dd>{trek.distance_km ? `${Number(trek.distance_km)} km` : '—'}</dd></div>
          <div><dt className="sr-only">Duration</dt><dd>{trek.duration_hours ? `${Number(trek.duration_hours)} hrs` : '—'}</dd></div>
          <div><dt className="sr-only">Next date</dt><dd>{next ? formatDate(next.trip_date, { year: undefined }) : 'No dates yet'}</dd></div>
        </dl>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-xs text-charcoal-600">{trek.openTrips > 1 ? 'From' : 'Per person'}</p>
            <p className="text-lg font-bold text-forest-950">{formatINR(trek.fromPrice)}</p>
            {next && bookable && next.seats_left <= 10 && <p className="text-xs font-semibold text-clay-700">{next.seats_left} seats left</p>}
          </div>
          <div className="flex gap-2">
            <ButtonLink href={`/treks/${trek.slug}`} variant="secondary" size="sm">Details</ButtonLink>
            {bookable && <ButtonLink href={`/book/${trek.id}`} size="sm">Book Now</ButtonLink>}
          </div>
        </div>
      </div>
    </article>
  );
}
