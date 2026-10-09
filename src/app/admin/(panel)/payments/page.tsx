import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Table, Td, qs } from '@/components/admin/admin-ui';
import { Badge, Input, Pagination, Select, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime, formatINR, titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'Payments' };
const PER = 50;

export default async function Payments({ searchParams }: { searchParams: Promise<{ status?: string; provider?: string; from?: string; to?: string; page?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  let q = supabase.from('payments').select('*, bookings(reference, customer_name)', { count: 'exact' });
  if (sp.status && ['created', 'captured', 'failed'].includes(sp.status)) q = q.eq('status', sp.status);
  if (sp.provider && ['manual', 'razorpay'].includes(sp.provider)) q = q.eq('provider', sp.provider);
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) q = q.gte('created_at', `${sp.from}T00:00:00+05:30`);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) q = q.lte('created_at', `${sp.to}T23:59:59+05:30`);
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  const captured = (data ?? []).filter((p) => p.status === 'captured').reduce((n, p) => n + p.amount_paise, 0);
  const f = { status: sp.status, provider: sp.provider, from: sp.from, to: sp.to };

  return (
    <>
      <PageHeader title="Payments"><a href={`/api/admin/export${qs({ type: 'payments' }, f)}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Export CSV</a></PageHeader>
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Select name="status" defaultValue={sp.status ?? ''} className="w-40" aria-label="Status"><option value="">Any status</option><option value="captured">Captured</option><option value="created">Started</option><option value="failed">Failed</option></Select>
        <Select name="provider" defaultValue={sp.provider ?? ''} className="w-40" aria-label="Provider"><option value="">Any method</option><option value="manual">Manual</option><option value="razorpay">Razorpay</option></Select>
        <Input type="date" name="from" defaultValue={sp.from} className="w-40" aria-label="From" /><Input type="date" name="to" defaultValue={sp.to} className="w-40" aria-label="To" />
        <button className={buttonClass({ variant: 'forest', size: 'sm' })}>Filter</button>
      </form>
      <p className="mb-2 text-sm text-charcoal-600">{count ?? 0} payment(s) · captured on this page: <b>{formatINR(captured)}</b>. Only captured (verified) payments count as money collected.</p>
      <Table head={['When', 'Booking', 'Provider', 'Reference', 'Amount', 'Status', 'Verified']} empty={!data?.length}>
        {(data ?? []).map((p) => (
          <tr key={p.id}>
            <Td className="text-xs">{formatDateTime(p.created_at)}</Td>
            <Td><Link href={`/admin/bookings/${p.booking_id}`} className="font-mono text-forest-700 hover:underline">{p.bookings?.reference}</Link><div className="text-xs">{p.bookings?.customer_name}</div></Td>
            <Td>{p.provider === 'manual' ? `Manual · ${titleCase(p.method ?? '')}` : `Razorpay${p.method ? ` · ${p.method}` : ''}`}</Td>
            <Td className="font-mono text-xs">{p.provider_payment_id ?? p.provider_order_id ?? '—'}</Td>
            <Td>{formatINR(p.amount_paise)}</Td><Td><Badge value={p.status} /></Td><Td className="text-xs">{formatDateTime(p.verified_at)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil((count ?? 0) / PER))} hrefFor={(p) => `/admin/payments${qs(f, { page: String(p) })}`} />
    </>
  );
}
