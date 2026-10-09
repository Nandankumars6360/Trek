import type { Metadata } from 'next';
import { EmptyState, Pagination, buttonClass } from '@/components/ui';
import { TrekCard } from '@/components/site/trek-card';
import { TrekSearch } from '@/components/site/trek-search';
import { searchTreks, type TrekFilters } from '@/lib/data/public';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Explore Treks',
  description: 'Browse one-day treks, sunrise hikes and hilltop trips. Filter by date, difficulty and price.',
  alternates: { canonical: '/treks' },
};
export const dynamic = 'force-dynamic';

const KEYS = ['q', 'location', 'difficulty', 'from', 'to', 'min', 'max', 'sort', 'page'] as const;

export default async function TreksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f: TrekFilters = {};
  for (const k of KEYS) { const v = sp[k]; if (typeof v === 'string' && v.trim()) f[k] = v.trim().slice(0, 100); }

  let result: Awaited<ReturnType<typeof searchTreks>> | null = null;
  let failed = false;
  try { result = await searchTreks(f); } catch { failed = true; }

  const hrefFor = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...f, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/treks?${q}`;
  };

  return (
    <div className="container-x py-12">
      <h1 className="text-4xl sm:text-5xl">Explore treks</h1>
      <p className="mt-3 max-w-2xl text-charcoal-600">One-day trips with same-day return. Filter by date, difficulty and budget.</p>
      <div className="mt-8"><TrekSearch values={f} /></div>

      <div className="mt-10" aria-live="polite">
        {failed ? (
          <EmptyState title="We couldn’t load treks right now">Please refresh the page in a moment.</EmptyState>
        ) : result && result.total > 0 ? (
          <>
            <p className="mb-5 text-sm text-charcoal-600">{result.total} trek{result.total === 1 ? '' : 's'} found</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.rows.map((t, i) => <TrekCard key={t.id} trek={t} index={i} />)}
            </div>
            <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
          </>
        ) : (
          <EmptyState title="No treks match these filters">
            <Link href="/treks" className={buttonClass({ variant: 'secondary', size: 'sm' }) + ' mt-3'}>Clear filters</Link>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
