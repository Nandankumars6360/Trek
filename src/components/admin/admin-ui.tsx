import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

export function PageHeader({ title, children, back }: { title: string; children?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && <Link href={back.href} className="text-sm text-charcoal-600 hover:underline">← {back.label}</Link>}
        <h1 className="text-3xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: string; href?: string; tone?: 'warn' }) {
  const body = (
    <div className={cn('rounded-xl2 border bg-white p-4', tone === 'warn' ? 'border-clay-600/30' : 'border-sand-200', href && 'hover:border-forest-500')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-600">{label}</p>
      <p className="mt-1 font-display text-3xl text-forest-950">{value}</p>
      {hint && <p className="text-xs text-charcoal-600">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl2 border border-sand-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-sand-100 text-xs uppercase tracking-wider text-charcoal-600">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-sand-200">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-charcoal-600">Nothing here yet.</p>}
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('px-4 py-3 align-top', className)}>{children}</td>;

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl2 border border-sand-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg">{title}</h2>{actions}</div>
      {children}
    </section>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-sand-200 text-sm">
      {rows.map(([k, v]) => <div key={k} className="grid grid-cols-3 gap-3 py-2"><dt className="text-charcoal-600">{k}</dt><dd className="col-span-2 break-words">{v ?? '—'}</dd></div>)}
    </dl>
  );
}

/** Builds a querystring that keeps existing filters. */
export function qs(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}
