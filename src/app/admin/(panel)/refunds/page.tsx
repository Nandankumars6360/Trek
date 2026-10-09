import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Table, Td } from '@/components/admin/admin-ui';
import { Badge, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime, formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Refunds' };

export default async function Refunds() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('refunds').select('*, payments(provider, booking_id, bookings(reference, customer_name))').order('created_at', { ascending: false }).limit(200);
  return (
    <>
      <PageHeader title="Refunds"><a href="/api/admin/export?type=refunds" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Export CSV</a></PageHeader>
      <p className="mb-3 text-sm text-charcoal-600">To refund, open the booking and use “Refund” on the payment. Razorpay refunds update automatically when processed.</p>
      <Table head={['Requested', 'Booking', 'Provider', 'Amount', 'Reason', 'Status', 'Processed']} empty={!data?.length}>
        {(data ?? []).map((r) => (
          <tr key={r.id}>
            <Td className="text-xs">{formatDateTime(r.created_at)}</Td>
            <Td><Link href={`/admin/bookings/${r.payments?.booking_id}`} className="font-mono text-forest-700 hover:underline">{r.payments?.bookings?.reference}</Link><div className="text-xs">{r.payments?.bookings?.customer_name}</div></Td>
            <Td>{r.payments?.provider}</Td><Td>{formatINR(r.amount_paise)}</Td><Td>{r.reason}</Td><Td><Badge value={r.status} /></Td><Td className="text-xs">{formatDateTime(r.processed_at)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
