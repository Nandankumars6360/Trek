import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Stat, Table, Td } from '@/components/admin/admin-ui';
import { Alert, Badge, Input, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

type Stats = Record<string, number>;
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const from = isDate(sp.from), to = isDate(sp.to);
  const [{ data: stats, error }, { data: recent }] = await Promise.all([
    supabase.rpc('admin_dashboard_stats', { p_from: from ?? null, p_to: to ?? null }),
    supabase.from('admin_booking_list').select('*').order('created_at', { ascending: false }).limit(10),
  ]);
  const s = (stats ?? {}) as Stats;
  const range = from || to ? `${from ? formatDate(from) : 'start'} – ${to ? formatDate(to) : 'today'}` : 'All time';

  return (
    <>
      <PageHeader title="Dashboard">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs">From<Input type="date" name="from" defaultValue={from} className="mt-1 w-40" /></label>
          <label className="text-xs">To<Input type="date" name="to" defaultValue={to} className="mt-1 w-40" /></label>
          <button className={buttonClass({ variant: 'forest', size: 'sm' })}>Apply</button>
          {(from || to) && <Link href="/admin/dashboard" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Clear</Link>}
        </form>
      </PageHeader>
      {error && <Alert tone="error">Could not load statistics.</Alert>}
      <p className="mb-3 text-sm text-charcoal-600">Booking figures: <b>{range}</b> (by booking date). Trips: live.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total bookings" value={s.total_bookings ?? 0} href="/admin/bookings" />
        <Stat label="Participants" value={s.total_participants ?? 0} hint="excl. cancelled" />
        <Stat label="Pending" value={s.pending ?? 0} href="/admin/bookings?status=pending" tone={s.pending ? 'warn' : undefined} />
        <Stat label="Confirmed" value={s.confirmed ?? 0} href="/admin/bookings?status=confirmed" />
        <Stat label="Cancelled" value={s.cancelled ?? 0} href="/admin/bookings?status=cancelled" />
        <Stat label="Pending payments" value={s.pending_payments ?? 0} href="/admin/bookings?payment=unpaid" tone={s.pending_payments ? 'warn' : undefined} />
        <Stat label="Collected (verified)" value={formatINR(s.net_collected_paise)} hint={`${formatINR(s.collected_paise)} in − ${formatINR(s.refunded_paise)} refunded`} href="/admin/payments" />
        <Stat label="Booking value" value={formatINR(s.booking_value_paise)} hint="not money collected" />
        <Stat label="Upcoming treks" value={s.upcoming_treks ?? 0} href="/admin/trips" />
        <Stat label="Trips open to book" value={s.available_trips ?? 0} href="/admin/trips" />
      </div>
      {(s.open_cancellation_requests > 0 || s.new_messages > 0 || s.failed_emails > 0) && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {s.open_cancellation_requests > 0 && <Link className="rounded-full bg-clay-100 px-3 py-1 font-semibold text-clay-700" href="/admin/bookings?requests=open">{s.open_cancellation_requests} cancellation request(s)</Link>}
          {s.new_messages > 0 && <Link className="rounded-full bg-clay-100 px-3 py-1 font-semibold text-clay-700" href="/admin/messages">{s.new_messages} new message(s)</Link>}
          {s.failed_emails > 0 && <Link className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-800" href="/admin/settings#emails">{s.failed_emails} failed email(s)</Link>}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-xl">Recent bookings</h2>
      <Table head={['Reference', 'Customer', 'Trek / date', 'People', 'Status', 'Payment', 'Total', 'Booked']} empty={!recent?.length}>
        {(recent ?? []).map((b) => (
          <tr key={b.id} className="hover:bg-sand-50">
            <Td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-forest-700 hover:underline">{b.reference}</Link></Td>
            <Td>{b.customer_name}<div className="text-xs text-charcoal-600">{b.customer_email}<br />{b.customer_phone}</div></Td>
            <Td>{b.trek_name}<div className="text-xs text-charcoal-600">{formatDate(b.trip_date)}</div></Td>
            <Td>{b.participant_count}</Td>
            <Td><Badge value={b.status} /></Td>
            <Td><Badge value={b.payment_status} /></Td>
            <Td>{formatINR(b.total_paise)}</Td>
            <Td className="text-xs">{formatDateTime(b.created_at)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
