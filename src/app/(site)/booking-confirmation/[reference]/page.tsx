import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, ButtonLink, Card } from '@/components/ui';
import { PrintButton } from '@/components/client-ui';
import { CancelRequestForm } from '@/components/site/cancel-request-form';
import { PayButton } from '@/components/site/pay-button';
import { loadBookingForVisitor } from '@/lib/data/booking';
import { isRazorpayConfigured } from '@/lib/env';
import { formatDate, formatINR, formatPhone, formatTime } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { requestCancellationGuest } from './actions';

export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Confirmation({ params, searchParams }: {
  params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; new?: string }>;
}) {
  const [{ reference }, { t, new: isNew }] = await Promise.all([params, searchParams]);
  const found = await loadBookingForVisitor(reference, t);
  if (!found) notFound();
  const { booking: b, token } = found;
  const s = await getSettings();
  const due = Math.max(0, b.total_paise - b.paid_paise);
  const active = b.status === 'pending' || b.status === 'confirmed';
  const tripStarted = new Date(`${b.trip.date}T${b.trip.reporting_time ?? '06:00'}+05:30`) <= new Date();
  const canPayOnline = active && due > 0 && b.payment_mode === 'online' && s.onlinePaymentsEnabled && isRazorpayConfigured();

  return (
    <div className="container-x max-w-3xl py-12">
      {isNew && <Alert tone="success" className="mb-6 no-print">Booking saved! We&apos;ve emailed the details to {b.customer_email}. Keep this page&apos;s link — it&apos;s your access to the booking.</Alert>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-clay-600">Booking reference</p>
          <h1 className="font-mono text-3xl tracking-wide sm:text-4xl">{b.reference}</h1>
        </div>
        <div className="flex gap-2"><Badge value={b.status} /><Badge value={b.payment_status} /></div>
      </div>

      <Card className="mt-8 divide-y divide-sand-200">
        {([
          ['Name', b.customer_name], ['Trek', b.trek.name], ['Destination', b.trek.destination],
          ['Date', formatDate(b.trip.date)],
          ['Reporting time', formatTime(b.trip.reporting_time) ?? 'Shared before the trip'],
          ['Return (approx.)', formatTime(b.trip.return_time) ?? '—'],
          ['Meeting point', b.trip.meeting_point ?? 'Shared before the trip'],
          ['Participants', `${b.participant_count} — ${b.participants.join(', ')}`],
          ['Total', formatINR(b.total_paise)], ['Paid', formatINR(b.paid_paise)], ['Amount payable', formatINR(due)],
          ['Contact on file', `${b.customer_email} · ${formatPhone(b.customer_phone)}`],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-3 px-5 py-3 text-sm"><span className="text-charcoal-600">{k}</span><span className="col-span-2 font-medium">{v}</span></div>
        ))}
        {b.trip.meeting_point_map_url && (
          <div className="px-5 py-3 text-sm"><a href={b.trip.meeting_point_map_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 hover:underline">Open meeting point in Maps →</a></div>
        )}
      </Card>

      {b.trip.status === 'cancelled' && <Alert tone="error" className="mt-6">This trip was cancelled by the organisers. We&apos;ll contact you about the refund.</Alert>}
      {b.status === 'pending' && <Alert tone="warn" className="mt-6">Your booking is pending. You&apos;ll get an email when it&apos;s confirmed.</Alert>}

      {canPayOnline && (
        <section className="mt-8 no-print">
          <h2 className="text-2xl">Payment</h2>
          <div className="mt-3"><PayButton reference={b.reference} token={token} amountLabel={formatINR(due)} brand={s.brandName}
            prefill={{ name: b.customer_name, email: b.customer_email, contact: b.customer_phone }} /></div>
        </section>
      )}
      {active && due > 0 && b.payment_mode === 'manual' && s.manualInstructions && (
        <section className="mt-8 rounded-xl2 bg-sand-100 p-6">
          <h2 className="text-xl">How to pay</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-charcoal-900">{s.manualInstructions}</p>
          <p className="mt-2 text-xs text-charcoal-600">Mention your reference <b>{b.reference}</b>. Payment status updates once our team verifies it.</p>
        </section>
      )}

      {b.trek.things_to_carry?.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl">What to carry</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-charcoal-600">{b.trek.things_to_carry.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      )}
      {b.trek.safety_info && <section className="mt-6"><h2 className="text-xl">Safety</h2><p className="mt-2 whitespace-pre-line text-sm text-charcoal-600">{b.trek.safety_info}</p></section>}

      <div className="mt-8 flex flex-wrap gap-3 no-print">
        <PrintButton />
        <ButtonLink href="/contact" variant="secondary" size="sm">Contact the organiser</ButtonLink>
        <ButtonLink href={`/treks/${b.trek.slug}#cancellation`} variant="ghost" size="sm">Cancellation terms</ButtonLink>
      </div>

      <section className="mt-10 rounded-xl2 border border-sand-200 bg-white p-6 no-print">
        <h2 className="text-xl">Need to cancel?</h2>
        <p className="mt-1 text-sm text-charcoal-600">
          Refunds follow the <Link href="/cancellation-policy" className="underline">cancellation policy</Link>. Our team reviews every request and replies by email.
        </p>
        <div className="mt-4">
          {!active ? <p className="text-sm text-charcoal-600">This booking is {b.status}.</p>
            : tripStarted ? <p className="text-sm text-charcoal-600">The trip has started, so it can no longer be cancelled online.</p>
            : b.open_cancellation_request ? <Alert tone="info">Your cancellation request is being reviewed.</Alert>
            : <CancelRequestForm action={requestCancellationGuest} hidden={{ reference: b.reference, token }} />}
        </div>
      </section>
    </div>
  );
}
