import Link from 'next/link';
import Image from 'next/image';
import { getSettings } from '@/lib/settings';
import { getSessionUser } from '@/lib/auth';
import { isSupabaseConfigured, storagePublicUrl } from '@/lib/env';
import { buttonClass } from '@/components/ui';
import { MobileNav } from './mobile-nav';
import { LogoMark } from './mountains';

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/treks', label: 'Explore Treks' },
  { href: '/#upcoming', label: 'Upcoming Trips' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
];

export async function Header() {
  const s = await getSettings();
  const user = isSupabaseConfigured ? (await getSessionUser()).user : null;
  const logo = storagePublicUrl(s.logoPath);
  const account = user ? { href: '/my-bookings', label: 'My Bookings' } : { href: '/login', label: 'Login' };

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200/70 bg-sand-50/90 backdrop-blur">
      {s.announcement && (
        <div className="bg-forest-900 px-4 py-2 text-center text-xs font-medium text-sand-50">{s.announcement}</div>
      )}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${s.brandName} home`}>
          {logo ? <Image src={logo} alt="" width={36} height={36} className="size-9 rounded-full object-cover" /> : <LogoMark className="size-9" />}
          <span className="font-display text-xl font-semibold text-forest-950">{s.brandName}</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 text-sm font-medium text-charcoal-600 hover:bg-sand-100 hover:text-forest-950">{n.label}</Link>
          ))}
          <Link href={account.href} className="rounded-full px-3 py-2 text-sm font-medium text-charcoal-600 hover:bg-sand-100 hover:text-forest-950">{account.label}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/register" className={buttonClass({ size: 'sm' }) + ' hidden sm:inline-flex'}>Book Your Trek</Link>
          <MobileNav items={[...NAV, account]} />
        </div>
      </div>
    </header>
  );
}
