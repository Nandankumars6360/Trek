import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { getFaqs } from '@/lib/data/public';

export const metadata: Metadata = { title: 'FAQ', alternates: { canonical: '/faq' } };
export const dynamic = 'force-dynamic';

export default async function Faq() {
  const faqs = await getFaqs();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) };
  return (
    <div className="container-x max-w-3xl py-12">
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <h1 className="text-4xl">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-sand-200 rounded-xl2 border border-sand-200 bg-white">
        {faqs.length ? faqs.map((f) => (
          <details key={f.id} className="group p-5">
            <summary className="cursor-pointer list-none font-semibold text-forest-950">
              <span className="flex items-center justify-between gap-4">{f.question}<span aria-hidden className="text-clay-600 transition-transform group-open:rotate-45">+</span></span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm text-charcoal-600">{f.answer}</p>
          </details>
        )) : <div className="p-5"><EmptyState title="No FAQs yet" /></div>}
      </div>
      <p className="mt-8 text-sm text-charcoal-600">Still have a question? <Link href="/contact" className="font-semibold text-forest-700 hover:underline">Contact us</Link>.</p>
    </div>
  );
}
