import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { PageHeader, Section, Table, Td, qs } from '@/components/admin/admin-ui';
import { Badge, Input, Pagination, Textarea, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTime, formatINR, formatPhone } from '@/lib/format';
import { addCustomerNoteAction } from './actions';

export const metadata: Metadata = { title: 'Customers' };
const PER = 50;

type C = { email: string; name: string; phone: string; user_id: string | null; bookings: number; active_bookings: number; participants: number; first_booking: string; last_booking: string; total_count: number };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; email?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  if (sp.email) {
    const email = sp.email.toLowerCase();
    const [{ data: bookings }, { data: notes }] = await Promise.all([
      supabase.from('admin_booking_list').select('*').eq('customer_email', email).order('created_at', { ascending: false }),
      supabase.from('customer_notes').select('*').eq('email', email).order('created_at', { ascending: false }),
    ]);
    const b0 = bookings?.[0];
    return (
      <>
        <PageHeader title={b0?.customer_name ?? email} back={{ href: '/admin/customers', label: 'Customers' }} />
        <p className="mb-6 text-sm text-charcoal-600">{email}{b0 ? ` · ${formatPhone(b0.customer_phone)}` : ''} · {bookings?.length ?? 0} booking(s){(bookings?.length ?? 0) > 1 ? ' · repeat customer' : ''}{b0?.customer_user_id ? ' · has account' : ' · guest'}</p>
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Table head={['Reference', 'Trek', 'Trip date', 'People', 'Status', 'Payment', 'Total']} empty={!bookings?.length}>
            {(bookings ?? []).map((b) => (
              <tr key={b.id}>
                <Td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-forest-700 hover:underline">{b.reference}</Link></Td>
                <Td>{b.trek_name}</Td><Td>{formatDate(b.trip_date)}</Td><Td>{b.participant_count}</Td>
                <Td><Badge value={b.status} /></Td><Td><Badge value={b.payment_status} /></Td><Td>{formatINR(b.total_paise)}</Td>
              </tr>
            ))}
          </Table>
          <Section title="Internal notes">
            <ActionForm action={addCustomerNoteAction} submit="Add note" resetOnSuccess>
              <input type="hidden" name="email" value={email} />
              <Textarea name="note" rows={2} placeholder="Visible to admins only" />
            </ActionForm>
            <ul className="mt-4 space-y-2">{(notes ?? []).map((n) => <li key={n.id} className="rounded-lg bg-sand-100 p-3 text-sm"><p className="whitespace-pre-line">{n.note}</p><p className="text-xs text-charcoal-600">{formatDateTime(n.created_at)}</p></li>)}</ul>
          </Section>
        </div>
      </>
    );
  }

  const { data, error } = await supabase.rpc('admin_customers', { p_search: sp.q?.trim().slice(0, 100) ?? null, p_limit: PER, p_offset: (page - 1) * PER });
  const rows = (data ?? []) as C[];
  const total = rows[0]?.total_count ?? 0;
  return (
    <>
      <PageHeader title="Customers"><a href={`/api/admin/export?type=customers${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Export CSV</a></PageHeader>
      <form method="get" className="mb-4 flex gap-2"><Input name="q" defaultValue={sp.q} placeholder="Search name, email or phone" className="max-w-sm" aria-label="Search" /><button className={buttonClass({ variant: 'forest', size: 'sm' })}>Search</button></form>
      {error && <p className="text-sm text-red-700">Could not load customers.</p>}
      <p className="mb-2 text-sm text-charcoal-600">{total} customer(s), grouped by email</p>
      <Table head={['Customer', 'Phone', 'Bookings', 'Active', 'People', 'First', 'Latest']} empty={!rows.length}>
        {rows.map((c) => (
          <tr key={c.email} className="hover:bg-sand-50">
            <Td><Link href={`/admin/customers?email=${encodeURIComponent(c.email)}`} className="font-semibold text-forest-700 hover:underline">{c.name}</Link><div className="text-xs text-charcoal-600">{c.email}</div></Td>
            <Td>{formatPhone(c.phone)}</Td>
            <Td>{c.bookings}{c.bookings > 1 && <span className="ml-2 text-xs font-semibold text-clay-600">repeat</span>}</Td>
            <Td>{c.active_bookings}</Td><Td>{c.participants}</Td>
            <Td className="text-xs">{formatDate(c.first_booking)}</Td><Td className="text-xs">{formatDate(c.last_booking)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} hrefFor={(p) => `/admin/customers${qs({ q: sp.q }, { page: String(p) })}`} />
    </>
  );
}
