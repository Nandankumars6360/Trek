import type { Metadata } from 'next';
import { Card } from '@/components/ui';
import { getSettings } from '@/lib/settings';
import { ContactForm } from './contact-form';

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } };
export const dynamic = 'force-dynamic';

export default async function Contact() {
  const s = await getSettings();
  return (
    <div className="container-x grid max-w-5xl gap-8 py-12 lg:grid-cols-[1fr_2fr]">
      <div>
        <h1 className="text-4xl">Contact us</h1>
        <p className="mt-3 text-charcoal-600">Questions about a trek, a booking or a group trip? We&apos;re happy to help.</p>
        <ul className="mt-6 space-y-3 text-sm">
          {s.phone && <li><span className="block text-xs text-charcoal-600">Phone</span><a className="font-semibold hover:underline" href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a></li>}
          {s.whatsapp && <li><span className="block text-xs text-charcoal-600">WhatsApp</span><a className="font-semibold hover:underline" href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`}>{s.whatsapp}</a></li>}
          {s.email && <li><span className="block text-xs text-charcoal-600">Email</span><a className="font-semibold hover:underline" href={`mailto:${s.email}`}>{s.email}</a></li>}
          {s.instagram && <li><span className="block text-xs text-charcoal-600">Instagram</span><a className="font-semibold hover:underline" href={s.instagram} target="_blank" rel="noopener noreferrer">{s.instagram.replace(/^https?:\/\/(www\.)?/, '')}</a></li>}
        </ul>
      </div>
      <Card className="relative p-6 sm:p-8"><ContactForm /></Card>
    </div>
  );
}
