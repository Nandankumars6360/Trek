'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui';

const ITEMS = [
  ['/admin/dashboard', 'Dashboard'], ['/admin/bookings', 'Bookings'], ['/admin/trips', 'Trip dates'],
  ['/admin/treks', 'Treks'], ['/admin/customers', 'Customers'], ['/admin/payments', 'Payments'],
  ['/admin/refunds', 'Refunds'], ['/admin/reports', 'Reports'], ['/admin/messages', 'Messages'],
  ['/admin/content', 'Content', true], ['/admin/settings', 'Settings', true],
] as const;

export function Sidebar({ brand, email, role, badges }: { brand: string; email: string; role: string; badges: Record<string, number> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const items = ITEMS.filter(([, , mgr]) => !mgr || role !== 'staff');
  return (
    <>
      <div className="flex items-center justify-between bg-forest-950 px-4 py-3 text-sand-50 lg:hidden">
        <span className="font-display text-lg">{brand} admin</span>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="admin-nav" className="rounded-lg border border-white/20 px-3 py-1.5 text-sm">Menu</button>
      </div>
      <div className="lg:w-60 lg:shrink-0 lg:bg-forest-950">
      <aside id="admin-nav" className={cn('bg-forest-950 text-sand-100 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto', open ? 'block' : 'hidden')}>
        <div className="hidden px-5 py-6 lg:block"><p className="font-display text-xl text-sand-50">{brand}</p><p className="text-xs text-moss-300">Admin</p></div>
        <nav aria-label="Admin" className="flex flex-col gap-0.5 px-3 pb-4">
          {items.map(([href, label]) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm', active ? 'bg-white/10 font-semibold text-sand-50' : 'text-sand-200/80 hover:bg-white/5')}>
                {label}
                {badges[href] ? <span className="rounded-full bg-clay-600 px-2 text-xs text-white">{badges[href]}</span> : null}
              </Link>
            );
          })}
          <Link href="/" className="mt-3 rounded-lg px-3 py-2 text-sm text-sand-200/60 hover:bg-white/5">View website ↗</Link>
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-xs text-sand-200/70"><p className="truncate">{email}</p><p className="capitalize">{role}</p></div>
      </aside>
      </div>
    </>
  );
}
