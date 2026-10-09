import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Table, Td } from '@/components/admin/admin-ui';
import { Badge, ButtonLink, Select, buttonClass } from '@/components/ui';
import { requireManager } from '@/lib/auth';
import { formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Treks' };

export default async function Treks({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireManager();
  const { status } = await searchParams;
  let q = supabase.from('treks').select('id, name, slug, destination, difficulty, price_paise, status, is_featured, updated_at, scheduled_trips(id, trip_date, status)').order('updated_at', { ascending: false });
  if (status && ['draft', 'published', 'archived'].includes(status)) q = q.eq('status', status);
  else q = q.neq('status', 'archived');
  const { data } = await q;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Treks"><ButtonLink href="/admin/treks/new" variant="forest" size="sm">+ New trek</ButtonLink></PageHeader>
      <form method="get" className="mb-4 flex gap-2">
        <Select name="status" defaultValue={status ?? ''} className="w-56" aria-label="Status">
          <option value="">Active (draft + published)</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
        </Select>
        <button className={buttonClass({ variant: 'secondary', size: 'sm' })}>Show</button>
      </form>
      <Table head={['Trek', 'Difficulty', 'Price', 'Upcoming dates', 'Status', '']} empty={!data?.length}>
        {(data ?? []).map((t) => {
          const upcoming = (t.scheduled_trips ?? []).filter((x: { trip_date: string; status: string }) => x.trip_date >= today && x.status === 'scheduled').length;
          return (
            <tr key={t.id} className="hover:bg-sand-50">
              <Td><Link href={`/admin/treks/${t.id}/edit`} className="font-semibold text-forest-700 hover:underline">{t.name}</Link>{t.is_featured && <span className="ml-2 text-xs text-clay-600">★ featured</span>}<div className="text-xs text-charcoal-600">{t.destination}</div></Td>
              <Td><Badge value={t.difficulty} /></Td>
              <Td>{formatINR(t.price_paise)}</Td>
              <Td><Link href={`/admin/trips?trek=${t.id}`} className="hover:underline">{upcoming} upcoming</Link></Td>
              <Td><Badge value={t.status} /></Td>
              <Td className="space-x-3 whitespace-nowrap text-sm">
                <Link href={`/admin/treks/${t.id}/edit`} className="text-forest-700 hover:underline">Edit</Link>
                <Link href={`/admin/bookings?trek=${t.id}`} className="text-forest-700 hover:underline">Registrations</Link>
                {t.status === 'published' && <Link href={`/treks/${t.slug}`} className="text-forest-700 hover:underline">View ↗</Link>}
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
