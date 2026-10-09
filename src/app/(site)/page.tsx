import Image from 'next/image';
import Link from 'next/link';
import { Badge, ButtonLink, EmptyState, SectionHeading, buttonClass } from '@/components/ui';
import { MountainScene } from '@/components/site/mountains';
import { TrekCard } from '@/components/site/trek-card';
import { TrekSearch } from '@/components/site/trek-search';
import { getFaqs, getGallery, getTrekCards, getUpcomingTrips } from '@/lib/data/public';
import { storagePublicUrl } from '@/lib/env';
import { formatDate, formatINR, formatTime } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const WHY = [
  ['Carefully planned adventures', 'Routes, timings and stops are worked out before we open bookings.'],
  ['Experienced trek leaders', 'Every group is led by a trek leader who knows the trail.'],
  ['Small groups', 'Each date has a fixed seat limit, so groups stay manageable.'],
  ['Safety-first approach', 'Clear reporting times, safety briefings and weather checks before we go.'],
  ['Transparent pricing', 'The price you see is what you pay, with inclusions listed on every trek.'],
  ['Friendly community', 'Meet students from other colleges who like the outdoors as much as you.'],
  ['Easy booking', 'Book in a couple of minutes — no account needed.'],
];

const STEPS = [
  ['Explore', 'Browse available treks and pick one that fits your level.'],
  ['Pick a date', 'Choose a trip date that has seats open.'],
  ['Register', 'Add your details and the friends coming with you.'],
  ['Get confirmed', 'Receive your confirmation and trip instructions by email.'],
];

export default async function Home() {
  const [settings, cards, trips, faqs, gallery] = await Promise.all([
    getSettings(), getTrekCards().catch(() => []), getUpcomingTrips().catch(() => []), getFaqs(), getGallery(),
  ]);
  const open = trips.filter((t) => t.availability === 'open');
  // starred treks first, topped up with other bookable ones so the row never looks empty
  const featured = [...cards.filter((c) => c.is_featured), ...cards.filter((c) => !c.is_featured && c.openTrips > 0)].slice(0, 6);
  const heroImg = storagePublicUrl(settings.heroImage);
  const testimonials = settings.showTestimonials ? settings.testimonials.filter((t) => t.quote) : [];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {heroImg
          ? <Image src={heroImg} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
          : <MountainScene className="absolute inset-0 -z-10 size-full" />}
        {heroImg && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-950/80 via-forest-950/40 to-forest-950/10" />}
        <div className="container-x pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div className="max-w-2xl fade-up">
            <p className={`mb-4 text-xs font-bold uppercase tracking-[0.2em] ${heroImg ? 'text-moss-300' : 'text-clay-600'}`}>{settings.tagline}</p>
            <h1 className={`text-4xl leading-[1.05] sm:text-6xl ${heroImg ? 'text-sand-50' : ''}`}>{settings.heroTitle}</h1>
            <p className={`mt-5 max-w-xl text-lg ${heroImg ? 'text-sand-100' : 'text-charcoal-600'}`}>{settings.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/treks" size="lg">Explore Treks</ButtonLink>
              <ButtonLink href="#upcoming" size="lg" variant={heroImg ? 'secondary' : 'forest'}>Upcoming Adventures</ButtonLink>
            </div>
            {open.length > 0 && (
              <p className="mt-6 inline-flex rounded-full bg-sand-50/90 px-4 py-1.5 text-sm font-semibold text-forest-900 shadow-card backdrop-blur">
                {open.length} trip date{open.length === 1 ? '' : 's'} open for booking · next on {formatDate(open[0].trip_date, { year: undefined })}
              </p>
            )}
          </div>
          <div className="mt-12 max-w-5xl"><TrekSearch compact /></div>
        </div>
      </section>

      {/* Featured treks */}
      <section className="container-x py-20" aria-labelledby="featured">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Featured" title="Treks worth waking up early for" />
          <Link href="/treks" className="mb-8 text-sm font-semibold text-forest-700 hover:underline">All treks & filters →</Link>
        </div>
        {featured.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t, i) => <TrekCard key={t.id} trek={t} index={i} />)}
          </div>
        ) : <EmptyState title="New treks coming soon">Check back shortly, or follow us for announcements.</EmptyState>}
      </section>

      {/* Why us */}
      <section className="bg-forest-950 py-20 text-sand-100">
        <div className="container-x">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-moss-300">Why choose us</p>
          <h2 className="max-w-2xl text-3xl text-sand-50 sm:text-4xl">Built for one great day outdoors</h2>
          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(([t, d]) => (
              <li key={t} className="border-t border-white/15 pt-4">
                <p className="font-display text-lg text-sand-50">{t}</p>
                <p className="mt-1.5 text-sm text-sand-200/75">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="container-x py-20">
        <SectionHeading eyebrow="How it works" title="Four steps to the trailhead" />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-xl2 border border-sand-200 bg-white p-6">
              <span className="grid size-10 place-items-center rounded-full bg-clay-100 font-display text-lg font-semibold text-clay-700">{i + 1}</span>
              <p className="mt-4 font-display text-lg text-forest-950">{t}</p>
              <p className="mt-1 text-sm text-charcoal-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Upcoming trips */}
      <section id="upcoming" className="scroll-mt-20 bg-sand-100 py-20">
        <div className="container-x">
          <SectionHeading eyebrow="Upcoming trips" title="Dates open for booking" />
          {open.length ? (
            <ul className="divide-y divide-sand-200 overflow-hidden rounded-xl2 border border-sand-200 bg-white">
              {open.slice(0, 8).map((t) => (
                <li key={t.trip_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-clay-600">{formatDate(t.trip_date)}{t.reporting_time ? ` · reporting ${formatTime(t.reporting_time)}` : ''}</p>
                    <Link href={`/treks/${t.slug}`} className="font-display text-xl text-forest-950 hover:underline">{t.name}</Link>
                    <p className="text-sm text-charcoal-600">{t.destination}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-forest-950">{formatINR(t.price_paise)}</p>
                      <p className="text-xs text-charcoal-600">{t.seats_left} of {t.capacity} seats left</p>
                    </div>
                    <ButtonLink href={`/book/${t.trek_id}?trip=${t.trip_id}`} size="sm">Book</ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No dates open right now">New dates are added regularly.</EmptyState>}
        </div>
      </section>

      {/* Testimonials: only shown when enabled in admin; sample entries are labelled */}
      {testimonials.length > 0 && (
        <section className="container-x py-20">
          <SectionHeading eyebrow="From trekkers" title="What people said" />
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.slice(0, 6).map((t, i) => (
              <figure key={i} className="rounded-xl2 border border-sand-200 bg-white p-6">
                {t.sample && <Badge value="draft" label="Sample — not a real review" className="mb-3" />}
                <blockquote className="text-charcoal-900">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-forest-700">— {t.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {gallery.length > 0 && (
        <section className="container-x py-20">
          <SectionHeading eyebrow="Gallery" title="From the trail" />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {gallery.map((g, i) => (
              <li key={g.id} className={`relative overflow-hidden rounded-xl2 bg-sand-100 ${i % 5 === 0 ? 'md:col-span-2 md:row-span-2 aspect-square' : 'aspect-square'}`}>
                <Image src={storagePublicUrl(g.storage_path)!} alt={g.caption ?? 'Trek photo'} fill loading="lazy" sizes="(min-width:768px) 25vw, 50vw" className="object-cover" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="container-x py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <SectionHeading eyebrow="FAQ" title="Good to know">
              More answers on the <Link href="/faq" className="font-semibold text-forest-700 hover:underline">FAQ page</Link>.
            </SectionHeading>
            <div className="divide-y divide-sand-200 rounded-xl2 border border-sand-200 bg-white">
              {faqs.slice(0, 6).map((f) => (
                <details key={f.id} className="group p-5">
                  <summary className="cursor-pointer list-none font-semibold text-forest-950 marker:hidden">
                    <span className="flex items-center justify-between gap-4">{f.question}<span aria-hidden className="text-clay-600 transition-transform group-open:rotate-45">+</span></span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-sm text-charcoal-600">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-x">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl2 bg-clay-600 px-8 py-10 text-white sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl text-white">Ready for the trail?</h2>
            <p className="mt-2 text-clay-100">Pick a date and book in a couple of minutes.</p>
          </div>
          <Link href="/register" className={buttonClass({ variant: 'secondary', size: 'lg' })}>Book Your Trek</Link>
        </div>
      </section>
    </>
  );
}
