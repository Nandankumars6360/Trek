import Link from 'next/link';
import { Input, Select, buttonClass } from '@/components/ui';
import type { TrekFilters } from '@/lib/data/public';
import { todayIST } from '@/lib/format';

// Plain GET form: works without JavaScript, results are shareable URLs.
export function TrekSearch({ values = {}, compact = false }: { values?: TrekFilters; compact?: boolean }) {
  const active = Object.entries(values).some(([k, v]) => v && k !== 'page' && k !== 'sort');
  return (
    <form action="/treks" method="get" role="search" aria-label="Search treks"
      className={compact
        ? 'grid gap-3 rounded-xl2 border border-sand-200 bg-white/95 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]'
        : 'grid gap-3 rounded-xl2 border border-sand-200 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4'}>
      <div className={compact ? '' : 'sm:col-span-2'}>
        <label htmlFor="q" className="sr-only">Search</label>
        <Input id="q" name="q" defaultValue={values.q} placeholder="Search trek or destination" />
      </div>
      {!compact && (
        <div className="sm:col-span-2">
          <label htmlFor="location" className="sr-only">Location</label>
          <Input id="location" name="location" defaultValue={values.location} placeholder="Location / region" />
        </div>
      )}
      <div>
        <label htmlFor="difficulty" className="sr-only">Difficulty</label>
        <Select id="difficulty" name="difficulty" defaultValue={values.difficulty ?? ''}>
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="difficult">Difficult</option>
        </Select>
      </div>
      <div>
        <label htmlFor="from" className={compact ? 'sr-only' : 'mb-1 block text-xs font-semibold text-charcoal-600'}>From date</label>
        <Input id="from" name="from" type="date" min={todayIST()} defaultValue={values.from} aria-label="From date" />
      </div>
      {!compact && (
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-semibold text-charcoal-600">To date</label>
          <Input id="to" name="to" type="date" min={todayIST()} defaultValue={values.to} />
        </div>
      )}
      <div className={compact ? '' : 'grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1'}>
        {compact ? (
          <>
            <label htmlFor="max" className="sr-only">Max price</label>
            <Input id="max" name="max" type="number" min={0} step={50} inputMode="numeric" defaultValue={values.max} placeholder="Max ₹" />
          </>
        ) : (
          <>
            <div>
              <label htmlFor="min" className="mb-1 block text-xs font-semibold text-charcoal-600">Min ₹</label>
              <Input id="min" name="min" type="number" min={0} step={50} inputMode="numeric" defaultValue={values.min} />
            </div>
            <div>
              <label htmlFor="max" className="mb-1 block text-xs font-semibold text-charcoal-600">Max ₹</label>
              <Input id="max" name="max" type="number" min={0} step={50} inputMode="numeric" defaultValue={values.max} />
            </div>
          </>
        )}
      </div>
      {!compact && (
        <div>
          <label htmlFor="sort" className="mb-1 block text-xs font-semibold text-charcoal-600">Sort by</label>
          <Select id="sort" name="sort" defaultValue={values.sort ?? 'date'}>
            <option value="date">Upcoming date</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name</option>
          </Select>
        </div>
      )}
      <div className={compact ? 'flex' : 'flex items-end gap-2 sm:col-span-2 lg:col-span-1'}>
        <button type="submit" className={buttonClass({ variant: 'forest' }) + ' w-full'}>Search</button>
        {!compact && active && <Link href="/treks" className={buttonClass({ variant: 'ghost' })}>Clear</Link>}
      </div>
    </form>
  );
}
