import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, ButtonLink, Card } from '@/components/ui';
import { TrekPlaceholder } from '@/components/site/mountains';
import { getTrekBySlug } from '@/lib/data/public';
import { publicEnv, storagePublicUrl } from '@/lib/env';
import { difficultyLabel, formatDate, formatINR, formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await getTrekBySlug((await params).slug);
  if (!r) return { title: 'Trek not found', robots: { index: false } };
  const img = storagePublicUrl(r.trek.featured_image);
  return {
    title: r.trek.name,
    description: r.trek.short_description ?? `${r.trek.name} — one-day trek to ${r.trek.destination}.`,
    alternates: { canonical: `/treks/${r.trek.slug}` },
    openGraph: { title: r.trek.name, description: r.trek.short_description ?? undefined, images: img ? [img] : undefined },
  };
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-lg">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-charcoal-600">
        {items.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-forest-500">•</span>{x}</li>)}
      </ul>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return <div><h3 className="text-lg">{title}</h3><p className="mt-2 whitespace-pre-line text-sm text-charcoal-600">{text}</p></div>;
}

export default async function TrekDetail({ params }: { params: Promise<{ slug: string }> }) {
  const r = await getTrekBySlug((await params).slug);
  if (!r) notFound();
  const { trek, trips } = r;
  const visible = trips; // cancelled/full/closed dates stay visible but can't be booked
  const open = trips.filter((t) => t.availability === 'open');
  const cover = storagePublicUrl(trek.featured_image);
  const gallery = (trek.gallery_images ?? []).map(storagePublicUrl).filter(Boolean) as string[];

  const facts = [
    ['Difficulty', difficultyLabel[trek.difficulty]],
    ['Distance', trek.distance_km ? `${Number(trek.distance_km)} km` : null],
    ['Duration', trek.duration_hours ? `${Number(trek.duration_hours)} hours` : null],
    ['Elevation', trek.elevation_m ? `${trek.elevation_m} m` : null],
    ['Reporting', formatTime(trek.default_reporting_time)],
    ['Return (approx.)', formatTime(trek.default_return_time)],
    ['Minimum age', trek.min_age ? `${trek.min_age}+` : null],
  ].filter(([, v]) => v) as [string, string][];

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TouristTrip', name: trek.name,
    description: trek.short_description ?? trek.description ?? undefined,
    touristType: 'Trekking', url: `${publicEnv.siteUrl}/treks/${trek.slug}`, image: cover ?? undefined,
    itinerary: { '@type': 'Place', name: trek.destination },
    offers: open.map((t) => ({
      '@type': 'Offer', price: (t.price_paise / 100).toFixed(2), priceCurrency: 'INR', availability: 'https://schema.org/InStock',
      validThrough: t.booking_deadline, url: `${publicEnv.siteUrl}/book/${trek.id}?trip=${t.trip_id}`,
    })),
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="relative h-72 overflow-hidden bg-sand-100 sm:h-[26rem]">
        {cover ? <Image src={cover} alt={trek.name} fill priority sizes="100vw" className="object-cover" /> : <TrekPlaceholder seed={trek.name.length} className="size-full" />}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/70 to-transparent" />
        <div className="container-x absolute inset-x-0 bottom-0 pb-8">
          <nav aria-label="Breadcrumb" className="mb-3 text-xs text-sand-100"><Link href="/treks" className="hover:underline">Treks</Link> / {trek.name}</nav>
          <Badge value={trek.difficulty} />
          <h1 className="mt-2 text-4xl text-sand-50 sm:text-5xl">{trek.name}</h1>
          <p className="mt-1 text-sand-100">{trek.destination}{trek.region ? `, ${trek.region}` : ''}</p>
        </div>
      </div>

      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <dl className="grid grid-cols-2 gap-4 rounded-xl2 border border-sand-200 bg-white p-5 sm:grid-cols-4">
            {facts.map(([k, v]) => <div key={k}><dt className="text-xs text-charcoal-600">{k}</dt><dd className="font-semibold text-forest-950">{v}</dd></div>)}
          </dl>

          {trek.description && <div className="prose-site max-w-none whitespace-pre-line text-charcoal-600">{trek.description}</div>}

          {gallery.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Photo gallery">
              {gallery.map((g) => (
                <li key={g} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand-100">
                  <Image src={g} alt={`${trek.name} photo`} fill loading="lazy" sizes="(min-width:640px) 33vw, 50vw" className="object-cover" />
                </li>
              ))}
            </ul>
          )}

          {trek.itinerary?.length > 0 && (
            <div>
              <h2 className="text-2xl">Itinerary</h2>
              <ol className="mt-4 space-y-3 border-l-2 border-moss-300 pl-5">
                {trek.itinerary.map((s, i) => (
                  <li key={i}><p className="text-sm font-semibold text-clay-600">{s.time}</p><p className="text-charcoal-900">{s.title}</p>{s.details && <p className="text-sm text-charcoal-600">{s.details}</p>}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-8 sm:grid-cols-2">
            <List title="What's included" items={trek.inclusions} />
            <List title="Not included" items={trek.exclusions} />
            <List title="Things to carry" items={trek.things_to_carry} />
            <Block title="Fitness & age guidance" text={trek.fitness_guidance} />
            <Block title="Safety instructions" text={trek.safety_info} />
            <Block title="Weather" text={trek.weather_info} />
            <Block title="Meeting point" text={trek.meeting_point} />
            {trek.leader_name && <Block title={`Trek leader: ${trek.leader_name}`} text={trek.leader_bio ?? ''} />}
          </div>

          <div id="cancellation" className="rounded-xl2 bg-sand-100 p-6">
            <h2 className="text-xl">Cancellation & refunds</h2>
            {trek.cancellation_policy && <p className="mt-2 whitespace-pre-line text-sm text-charcoal-600">{trek.cancellation_policy}</p>}
            {trek.refund_rules?.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-charcoal-900">
                {[...trek.refund_rules].sort((a, b) => b.hours_before - a.hours_before).map((r) => (
                  <li key={r.hours_before}>Cancel {r.hours_before}+ hours before reporting: <b>{r.refund_percent}% refund</b></li>
                ))}
                <li>Later than that: no refund</li>
              </ul>
            )}
            <Link href="/cancellation-policy" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">Full policy →</Link>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <p className="text-xs text-charcoal-600">Price per person</p>
            <p className="text-3xl font-bold text-forest-950">{formatINR(open[0]?.price_paise ?? trek.price_paise)}</p>
            <h2 className="mt-6 text-lg">Upcoming dates</h2>
            {visible.length ? (
              <ul className="mt-3 space-y-2">
                {visible.map((t) => (
                  <li key={t.trip_id} className="flex items-center justify-between gap-3 rounded-xl border border-sand-200 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{formatDate(t.trip_date)}</p>
                      <p className="text-xs text-charcoal-600">
                        {t.availability === 'open' ? `${t.seats_left} seats left · ${formatINR(t.price_paise)}` : <Badge value={t.availability} />}
                      </p>
                    </div>
                    {t.availability === 'open'
                      ? <ButtonLink href={`/book/${trek.id}?trip=${t.trip_id}`} size="sm">Book</ButtonLink>
                      : <span className="text-xs text-charcoal-600">Unavailable</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-charcoal-600">No dates scheduled yet.</p>}
            {open.length > 0
              ? <ButtonLink href={`/book/${trek.id}`} size="lg" className="mt-6 w-full">Register for This Trek</ButtonLink>
              : <p className="mt-6 rounded-xl bg-sand-100 p-3 text-center text-sm text-charcoal-600">Booking is not open for this trek right now.</p>}
          </Card>
        </aside>
      </div>
    </article>
  );
}
