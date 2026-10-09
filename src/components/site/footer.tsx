import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { LogoMark } from './mountains';

export async function Footer() {
  const s = await getSettings();
  const socials = [
    s.instagram && { href: s.instagram, label: 'Instagram' },
    s.youtube && { href: s.youtube, label: 'YouTube' },
    s.whatsapp && { href: `https://wa.me/${s.whatsapp.replace(/\D/g, '')}`, label: 'WhatsApp' },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer className="mt-24 bg-forest-950 text-sand-100">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-9" />
            <span className="font-display text-xl text-sand-50">{s.brandName}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-sand-200/80">{s.tagline}. Small groups, planned routes and same-day returns.</p>
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-3">
              {socials.map((x) => (
                <li key={x.label}><a href={x.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-sand-100/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">{x.label}</a></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss-300">Contact</p>
          <ul className="mt-4 space-y-2 text-sm">
            {s.email && <li><a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a></li>}
            {s.phone && <li><a href={`tel:${s.phone.replace(/\s/g, '')}`} className="hover:underline">{s.phone}</a></li>}
            <li><Link href="/contact" className="hover:underline">Contact form</Link></li>
            <li><Link href="/faq" className="hover:underline">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss-300">Policies</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/privacy" className="hover:underline">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:underline">Terms &amp; Conditions</Link></li>
            <li><Link href="/cancellation-policy" className="hover:underline">Cancellation &amp; Refund Policy</Link></li>
            <li><Link href="/about" className="hover:underline">About us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-x py-5 text-xs text-sand-200/60">© {new Date().getFullYear()} {s.brandName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
