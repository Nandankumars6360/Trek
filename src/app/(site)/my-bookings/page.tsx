import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, ButtonLink, Card, EmptyState } from '@/components/ui';
import { CancelRequestForm } from '@/components/site/cancel-request-form';
import { ContactUpdateForm } from '@/components/site/contact-update-form';
import { getSessionUser } from '@/lib/auth';
import { formatDate, formatINR, todayIST } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { logoutAction } from '../(auth)/actions';
import { requestCancellationAction, updateContactAction } from './actions';

export const metadata: Metadata = { title: 'My bookings', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Row = {
  id: string; reference: string; access_token: string; status: string; payment_status: string; participant_count: number;
  total_paise: number; customer_phone: string; emergency_contact_name: string; emergency_contact_phone: string;
  scheduled_trips: { trip_date: string; treks: { name: string; slug: string } };
  cancellation_requests: { status: string }[];
};

export default async function MyBookings() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect('/login?next=/my-bookings');
  const s = await getSettings();
  const { data, error } = await supabase.from('bookings')
    .select('id, reference, access_token, status, payment_status, participant_count, total_paise, customer_phone, emergency_contact_name, emergency_contact_phone, scheduled_trips(trip_date, treks(name, slug)), cancellation_requests(status)')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const today = todayIST();
  const upcoming = rows.filter((r) => r.scheduled_trips.trip_date >= today && r.status !== 'cancelled');
  const past = rows.filter((r) => !upcoming.includes(r));

  const BookingCard = ({ r, editable }: { r: Row; editable: boolean }) => {
    const openReq = r.cancellation_requests.some((c) => c.status === 'open');
    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-charcoal-600">{r.reference}</p>
            <Link href={`/treks/${r.scheduled_trips.treks.slug}`} className="font-display text-xl hover:underline">{r.scheduled_trips.treks.name}</Link>
            <p className="text-sm text-charcoal-600">{formatDate(r.scheduled_trips.trip_date)} · {r.participant_count} people · {formatINR(r.total_paise)}</p>
          </div>
          <div className="flex gap-2"><Badge value={r.status} /><Badge value={r.payment_status} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/booking-confirmation/${r.reference}?t=${r.access_token}`} size="sm" variant="secondary">Trip instructions</ButtonLink>
          <ButtonLink href="/contact" size="sm" variant="ghost">Contact support</ButtonLink>
        </div>
        {editable && (
          <details className="mt-4 rounded-xl bg-sand-100 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Update contact details or cancel</summary>
            <div className="mt-4 space-y-6">
              <ContactUpdateForm action={updateContactAction} bookingId={r.id} phone={r.customer_phone} emergencyName={r.emergency_contact_name} emergencyPhone={r.emergency_contact_phone} />
              {openReq ? <p className="text-sm text-charcoal-600">Cancellation request under review.</p>
                : <CancelRequestForm action={requestCancellationAction} hidden={{ bookingId: r.id }} />}
            </div>
          </details>
        )}
      </Card>
    );
  };

  return (
    <div className="container-x max-w-4xl py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">My bookings</h1>
          <p className="mt-1 text-sm text-charcoal-600">Signed in as {user.email}</p>
        </div>
        <form action={logoutAction}><button className="text-sm font-semibold text-forest-700 hover:underline">Sign out</button></form>
      </div>
      {error && <p className="mt-6 text-sm text-red-700">Could not load bookings. Please refresh.</p>}
      <section className="mt-8 space-y-4">
        <h2 className="text-2xl">Upcoming</h2>
        {upcoming.length ? upcoming.map((r) => <BookingCard key={r.id} r={r} editable={r.status === 'pending' || r.status === 'confirmed'} />)
          : <EmptyState title="No upcoming treks"><Link href="/treks" className="font-semibold text-forest-700 hover:underline">Find your next one →</Link></EmptyState>}
      </section>
      {past.length > 0 && (
        <section className="mt-12 space-y-4">
          <h2 className="text-2xl">Past &amp; cancelled</h2>
          {past.map((r) => <BookingCard key={r.id} r={r} editable={false} />)}
        </section>
      )}
      <p className="mt-10 text-sm text-charcoal-600">Questions? {s.phone ? `Call ${s.phone} or ` : ''}<Link href="/contact" className="underline">contact us</Link>.</p>
    </div>
  );
}
