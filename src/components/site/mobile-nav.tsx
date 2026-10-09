'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui';

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full border border-sand-200 bg-white text-forest-900">
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-sand-50 px-4 pb-10 pt-4">
          <nav aria-label="Mobile" className="flex flex-col">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className="border-b border-sand-200 py-4 font-display text-2xl text-forest-950">{n.label}</Link>
            ))}
          </nav>
          <Link href="/register" className={buttonClass({ size: 'lg' }) + ' mt-6 w-full'}>Book Your Trek</Link>
        </div>
      )}
    </div>
  );
}
