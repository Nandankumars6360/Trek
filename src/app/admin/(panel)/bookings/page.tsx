import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Table, Td, qs } from '@/components/admin/admin-ui';
import { Badge, Input, Pagination, Select, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Bookings' };
const PER = 25;
const SORTS: Record<string, [string, boolean]> = {
  new: ['created_at', false], old: ['created_at', true], trip: ['trip_date', true], trip_desc: ['trip_date', false],
  amount: ['total_paise', false], name: ['customer_name', true],
};

export default async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const f = { q: sp.q?.trim().slice(0, 100), trek: sp.trek, date: sp.date, status: sp.status, payment: sp.payment, sort: sp.sort, requests: sp.requests };
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase.from('admin_booking_list').select('*', { count: 'exact' });
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, ' ');
    query = query.or(`reference.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term.replace(/\s/g, '')}%`);
  }
  if (f.trek && /^[0-9a-f-]{36}$/.test(f.trek)) query = query.eq('trek_id', f.trek);
  if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) query = query.eq('trip_date', f.date);
  if (f.status && ['pending', 'confirmed', 'cancelled', 'completed'].includes(f.status)) query = query.eq('status', f.status);
  if (f.payment && ['unpaid', 'pending', 'paid', 'partially_refunded', 'refunded'].includes(f.payment)) query = query.eq('payment_status', f.payment);
  if (f.requests === 'open') {
    const { data: req } = await supabase.from('cancellation_requests').select('booking_id').eq('status', 'open');
    query = query.in('id', (req ?? []).map((r) => r.booking_id).concat('00000000-0000-0000-0000-000000000000'));
  }
  const [col, asc] = SORTS[f.sort ?? 'new'] ?? SORTS.new;
  const [{ data, count, error }, { data: treks }] = await Promise.all([
    query.order(col, { ascending: asc }).range((page - 1) * PER, page * PER - 1),
    supabase.from('treks').select('id, name').order('name'),
  ]);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER));
  const exportFilters = { trek: f.trek, date: f.date, status: f.status, payment: f.payment, q: f.q };

  return (
    <>
      <PageHeader title="Bookings">
        <a href={`/api/admin/export${qs({ type: 'bookings' }, exportFilters)}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Export CSV</a>
        <a href={`/api/admin/export${qs({ type: 'participants' }, exportFilters)}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Export participants</a>
      </PageHeader>

      <form method="get" className="mb-5 grid gap-2 rounded-xl2 border border-sand-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-7">
        <Input name="q" defaultValue={f.q} placeholder="Name, email, phone, reference" className="lg:col-span-2" aria-label="Search" />
        <Select name="trek" defaultValue={f.trek ?? ''} aria-label="Trek"><option value="">All treks</option>{(treks ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Input type="date" name="date" defaultValue={f.date} aria-label="Trip date" />
        <Select name="status" defaultValue={f.status ?? ''} aria-label="Status"><option value="">Any status</option>{['pending', 'confirmed', 'cancelled', 'completed'].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Select name="payment" defaultValue={f.payment ?? ''} aria-label="Payment"><option value="">Any payment</option>{['unpaid', 'pending', 'paid', 'partially_refunded', 'refunded'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>
        <Select name="sort" defaultValue={f.sort ?? 'new'} aria-label="Sort">
          <option value="new">Newest first</option><option value="old">Oldest first</option><option value="trip">Trip date ↑</option>
          <option value="trip_desc">Trip date ↓</option><option value="amount">Amount</option><option value="name">Name</option>
        </Select>
        <div className="flex gap-2 lg:col-span-7">
          <button className={buttonClass({ variant: 'forest', size: 'sm' })}>Filter</button>
          <Link href="/admin/bookings" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Clear</Link>
          <Link href="/admin/bookings?requests=open" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Cancellation requests</Link>
        </div>
      </form>

      {error && <p className="mb-3 text-sm text-red-700">Could not load bookings.</p>}
      <p className="mb-2 text-sm text-charcoal-600">{count ?? 0} booking(s)</p>
      <Table head={['Reference', 'Customer', 'Trek', 'Trip date', 'People', 'Status', 'Payment', 'Total', 'Booked', '']} empty={!data?.length}>
        {(data ?? []).map((b) => (
          <tr key={b.id} className="hover:bg-sand-50">
            <Td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-forest-700 hover:underline">{b.reference}</Link></Td>
            <Td>{b.customer_name}<div className="text-xs text-charcoal-600">{b.customer_email}<br />{b.customer_phone}</div></Td>
            <Td>{b.trek_name}</Td>
            <Td className="whitespace-nowrap">{formatDate(b.trip_date)}</Td>
            <Td>{b.participant_count}</Td>
            <Td><Badge value={b.status} /></Td>
            <Td><Badge value={b.payment_status} /><div className="text-xs text-charcoal-600">{formatINR(b.paid_paise)} paid</div></Td>
            <Td>{formatINR(b.total_paise)}</Td>
            <Td className="text-xs">{formatDateTime(b.created_at)}</Td>
            <Td><Link href={`/admin/bookings/${b.id}`} className="text-sm font-semibold text-forest-700 hover:underline">Open</Link></Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/bookings${qs(f, { page: String(p) })}`} />
    </>
  );
}
