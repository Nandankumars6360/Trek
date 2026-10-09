import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { titleCase } from '@/lib/format';

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

const btnBase = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2';
const btnVariants = {
  primary: 'bg-clay-600 text-white hover:bg-clay-700',
  forest: 'bg-forest-900 text-sand-50 hover:bg-forest-700',
  secondary: 'border border-forest-900/20 bg-white text-forest-900 hover:bg-sand-100',
  ghost: 'text-forest-900 hover:bg-sand-100',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};
const btnSizes = { sm: 'px-3.5 py-1.5 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
type BtnStyle = { variant?: keyof typeof btnVariants; size?: keyof typeof btnSizes };

export function buttonClass({ variant = 'primary', size = 'md' }: BtnStyle = {}) {
  return cn(btnBase, btnVariants[variant], btnSizes[size]);
}

export function Button({ variant, size, className, ...p }: ComponentProps<'button'> & BtnStyle) {
  return <button {...p} className={cn(buttonClass({ variant, size }), className)} />;
}

export function ButtonLink({ variant, size, className, ...p }: ComponentProps<typeof Link> & BtnStyle) {
  return <Link {...p} className={cn(buttonClass({ variant, size }), className)} />;
}

const fieldBase = 'w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-sm text-charcoal-900 placeholder:text-stone-400 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20 aria-[invalid=true]:border-red-600';

export function Input({ className, ...p }: ComponentProps<'input'>) {
  return <input {...p} className={cn(fieldBase, className)} />;
}
export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea {...p} className={cn(fieldBase, 'min-h-24', className)} />;
}
export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select {...p} className={cn(fieldBase, 'pr-8', className)} />;
}

export function Field({ label, htmlFor, error, hint, children, className }: {
  label: string; htmlFor: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-charcoal-900">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-charcoal-600">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cn('rounded-xl2 border border-sand-200 bg-white shadow-card', className)} />;
}

export function Alert({ tone = 'info', children, className }: { tone?: 'info' | 'success' | 'error' | 'warn'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'bg-moss-100 text-forest-900 border-moss-300',
    success: 'bg-moss-100 text-forest-900 border-forest-500/40',
    error: 'bg-red-50 text-red-800 border-red-200',
    warn: 'bg-clay-100 text-clay-700 border-clay-600/30',
  };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>{children}</div>;
}

const statusTone: Record<string, string> = {
  pending: 'bg-clay-100 text-clay-700', confirmed: 'bg-moss-100 text-forest-900', completed: 'bg-sand-200 text-charcoal-900',
  cancelled: 'bg-red-50 text-red-800', unpaid: 'bg-sand-200 text-charcoal-900', paid: 'bg-moss-100 text-forest-900',
  partially_refunded: 'bg-clay-100 text-clay-700', refunded: 'bg-sand-200 text-charcoal-900',
  open: 'bg-moss-100 text-forest-900', full: 'bg-red-50 text-red-800', closed: 'bg-sand-200 text-charcoal-900',
  scheduled: 'bg-moss-100 text-forest-900', draft: 'bg-sand-200 text-charcoal-900', published: 'bg-moss-100 text-forest-900',
  archived: 'bg-sand-200 text-charcoal-600', easy: 'bg-moss-100 text-forest-900', moderate: 'bg-clay-100 text-clay-700',
  difficult: 'bg-red-50 text-red-800', sent: 'bg-moss-100 text-forest-900', failed: 'bg-red-50 text-red-800',
  skipped: 'bg-sand-200 text-charcoal-600', queued: 'bg-sand-200 text-charcoal-600', captured: 'bg-moss-100 text-forest-900',
  created: 'bg-sand-200 text-charcoal-600', processed: 'bg-moss-100 text-forest-900', new: 'bg-clay-100 text-clay-700',
  read: 'bg-sand-200 text-charcoal-600', resolved: 'bg-moss-100 text-forest-900', approved: 'bg-moss-100 text-forest-900',
  rejected: 'bg-red-50 text-red-800',
};
const statusLabel: Record<string, string> = { pending: 'Pending', unpaid: 'Unpaid', open: 'Seats open', full: 'Full', closed: 'Booking closed' };

export function Badge({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusTone[value] ?? 'bg-sand-200 text-charcoal-900', className)}>
      {label ?? statusLabel[value] ?? titleCase(value)}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl2 border border-dashed border-sand-200 bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-xl text-forest-950">{title}</p>
      {children && <div className="mt-2 text-sm text-charcoal-600">{children}</div>}
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2 text-sm">
      {page > 1 ? <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={hrefFor(page - 1)}>← Previous</Link> : <span />}
      <span className="px-3 text-charcoal-600">Page {page} of {pages}</span>
      {page < pages ? <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={hrefFor(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-clay-600">{eyebrow}</p>}
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-charcoal-600">{children}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-sand-200/70', className)} />;
}
