import type { Metadata } from 'next';
import { PageHeader, Section, Stat, Table, Td } from '@/components/admin/admin-ui';
import { Alert, Input, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatINR, todayIST } from '@/lib/format';

export const metadata: Metadata = { title: 'Reports' };

type Report = {
  by_date: { day: string; bookings: number; participants: number | null; cancelled: number }[];
  by_trek: { trek_name: string; bookings: number; participants: number; confirmed: number; pending: number; cancelled: number; booking_value_paise: number }[];
  status: Record<string, number>; participants: number; payments_paise: number; refunds_paise: number;
  payments_by_provider: Record<string, number>; repeat_customers: { email: string; name: string; bookings: number }[];
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : todayIST();
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc('admin_report', { p_from: from, p_to: to });
  const r = data as Report | null;
  const maxDay = Math.max(1, ...(r?.by_date ?? []).map((d) => d.bookings));
  const exp = (kind: string) => `/api/admin/export?type=report_${kind}&from=${from}&to=${to}`;

  return (
    <>
      <PageHeader title="Reports">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-xs">From<Input type="date" name="from" defaultValue={from} className="mt-1 w-40" /></label>
          <label className="text-xs">To<Input type="date" name="to" defaultValue={to} className="mt-1 w-40" /></label>
          <button className={buttonClass({ variant: 'forest', size: 'sm' })}>Run</button>
        </form>
      </PageHeader>
      {error && <Alert tone="error">{error.message.includes('date range') ? 'Pick a valid date range.' : 'Could not run the report.'}</Alert>}
      {r && (
        <div className="space-y-6">
          <p className="text-sm text-charcoal-600">{formatDate(from)} – {formatDate(to)}. Money figures use verified payments and processed refunds only; booking value is shown separately.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Bookings" value={Object.values(r.status).reduce((a, b) => a + b, 0)} />
            <Stat label="Participants" value={r.participants} />
            <Stat label="Confirmed" value={r.status.confirmed + r.status.completed} hint={`${r.status.pending} pending`} />
            <Stat label="Cancelled" value={r.status.cancelled} />
            <Stat label="Collected" value={formatINR(r.payments_paise)} hint={Object.entries(r.payments_by_provider).map(([k, v]) => `${k} ${formatINR(v)}`).join(' · ')} />
            <Stat label="Refunded" value={formatINR(r.refunds_paise)} hint={`net ${formatINR(r.payments_paise - r.refunds_paise)}`} />
          </div>

          <Section title="Registrations by date" actions={<a href={exp('by_date')} className="text-sm font-semibold text-forest-700 hover:underline">CSV</a>}>
            {r.by_date.length ? (
              <ul className="space-y-1">{r.by_date.map((d) => (
                <li key={d.day} className="grid grid-cols-[110px_1fr_120px] items-center gap-3 text-sm">
                  <span className="text-charcoal-600">{formatDate(d.day, { weekday: undefined })}</span>
                  <span className="h-3 rounded-full bg-forest-500" style={{ width: `${(d.bookings / maxDay) * 100}%` }} aria-hidden />
                  <span>{d.bookings} bookings{d.cancelled ? ` · ${d.cancelled} cxl` : ''}</span>
                </li>
              ))}</ul>
            ) : <p className="text-sm text-charcoal-600">No bookings in this range.</p>}
          </Section>

          <Section title="By trek" actions={<a href={exp('by_trek')} className="text-sm font-semibold text-forest-700 hover:underline">CSV</a>}>
            <Table head={['Trek', 'Bookings', 'Participants', 'Confirmed', 'Pending', 'Cancelled', 'Booking value']} empty={!r.by_trek.length}>
              {r.by_trek.map((t) => (
                <tr key={t.trek_name}><Td>{t.trek_name}</Td><Td>{t.bookings}</Td><Td>{t.participants}</Td><Td>{t.confirmed}</Td><Td>{t.pending}</Td><Td>{t.cancelled}</Td><Td>{formatINR(t.booking_value_paise)}</Td></tr>
              ))}
            </Table>
          </Section>

          <Section title="Repeat customers (all time)" actions={<a href={exp('repeat')} className="text-sm font-semibold text-forest-700 hover:underline">CSV</a>}>
            <Table head={['Name', 'Email', 'Bookings']} empty={!r.repeat_customers.length}>
              {r.repeat_customers.map((c) => <tr key={c.email}><Td>{c.name}</Td><Td>{c.email}</Td><Td>{c.bookings}</Td></tr>)}
            </Table>
          </Section>
        </div>
      )}
    </>
  );
}
