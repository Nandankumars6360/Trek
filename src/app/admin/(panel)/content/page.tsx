import type { Metadata } from 'next';
import Image from 'next/image';
import { ActionForm } from '@/components/admin/action-form';
import { PageHeader, Section } from '@/components/admin/admin-ui';
import { Field, Input, Textarea } from '@/components/ui';
import { requireManager } from '@/lib/auth';
import { storagePublicUrl } from '@/lib/env';
import { LEGAL_DEFAULTS } from '@/lib/legal-defaults';
import { getSettings } from '@/lib/settings';
import { addGalleryImageAction, deleteFaqAction, saveFaqAction, saveLegalAction, saveSiteContentAction, updateGalleryImageAction, uploadBrandImageAction } from './actions';

export const metadata: Metadata = { title: 'Content' };

export default async function Content() {
  const { supabase } = await requireManager();
  const s = await getSettings();
  const [{ data: faqs }, { data: gallery }] = await Promise.all([
    supabase.from('faqs').select('*').order('display_order'),
    supabase.from('gallery_images').select('*').order('display_order'),
  ]);
  const testimonials = s.testimonials.map((t) => `${t.quote} | ${t.name}${t.sample ? ' | sample' : ''}`).join('\n');
  const I = (label: string, name: string, value: string | null | undefined, hint?: string, type = 'text') =>
    <Field label={label} htmlFor={name} hint={hint}><Input id={name} name={name} type={type} defaultValue={value ?? ''} /></Field>;

  return (
    <>
      <PageHeader title="Website content" />
      <div className="space-y-6">
        <Section title="Brand, contact & home page">
          <ActionForm action={saveSiteContentAction} submit="Save content" variant="forest">
            <div className="grid gap-4 md:grid-cols-2">
              {I('Brand name', 'brand_name', s.brandName)}
              {I('Tagline', 'tagline', s.tagline)}
              {I('Contact email', 'email', s.email, 'Also receives new-booking alerts.', 'email')}
              {I('Contact phone', 'phone', s.phone)}
              {I('WhatsApp number', 'whatsapp', s.whatsapp, 'With country code, e.g. +91 98765 43210')}
              {I('Instagram link', 'instagram', s.instagram, 'https://instagram.com/…', 'url')}
              {I('YouTube link', 'youtube', s.youtube, undefined, 'url')}
              {I('Announcement bar', 'announcement', s.announcement, 'Leave blank to hide.')}
              {I('Hero headline', 'hero_title', s.heroTitle)}
              <Field label="Hero text" htmlFor="hero_subtitle"><Textarea id="hero_subtitle" name="hero_subtitle" rows={2} defaultValue={s.heroSubtitle} /></Field>
              <Field label="About page" htmlFor="about" className="md:col-span-2" hint="Blank line = new paragraph. A short first line becomes a heading.">
                <Textarea id="about" name="about" rows={6} defaultValue={s.aboutBody} />
              </Field>
              <Field label="Testimonials" htmlFor="testimonials" className="md:col-span-2" hint="One per line: quote | name. Add “| sample” to label it as sample content. Only publish real reviews you have permission to use.">
                <Textarea id="testimonials" name="testimonials" rows={4} defaultValue={testimonials} />
              </Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_testimonials" defaultChecked={s.showTestimonials} className="accent-forest-700" /> Show testimonials on the home page</label>
            </div>
          </ActionForm>
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          {([['logo', 'Logo', s.logoPath], ['hero', 'Hero photo', s.heroImage]] as const).map(([which, label, path]) => (
            <Section key={which} title={label}>
              {path ? <div className="relative mb-3 h-40 overflow-hidden rounded-xl bg-sand-100"><Image src={storagePublicUrl(path)!} alt="" fill sizes="400px" className="object-contain" /></div>
                : <p className="mb-3 text-sm text-charcoal-600">{which === 'logo' ? 'Using the built-in mark.' : 'Using the built-in illustration.'}</p>}
              <ActionForm action={uploadBrandImageAction} submit="Upload" pendingText="Uploading…">
                <input type="hidden" name="which" value={which} />
                <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
              </ActionForm>
              {path && <ActionForm action={uploadBrandImageAction} submit="Remove" variant="ghost" className="mt-2"><input type="hidden" name="which" value={which} /><input type="hidden" name="remove" value="1" /></ActionForm>}
            </Section>
          ))}
        </div>

        <Section title="FAQs">
          <div className="space-y-4">
            {(faqs ?? []).map((q) => (
              <details key={q.id} className="rounded-xl border border-sand-200 p-4">
                <summary className="cursor-pointer font-semibold">{q.question}{!q.is_published && <span className="ml-2 text-xs text-charcoal-600">(hidden)</span>}</summary>
                <div className="mt-3 space-y-3">
                  <ActionForm action={saveFaqAction} submit="Save">
                    <input type="hidden" name="id" value={q.id} />
                    <Input name="question" defaultValue={q.question} aria-label="Question" />
                    <Textarea name="answer" defaultValue={q.answer} rows={3} aria-label="Answer" />
                    <div className="flex items-center gap-4 text-sm"><label>Order <Input name="display_order" type="number" defaultValue={q.display_order} className="inline w-20" /></label>
                      <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={q.is_published} className="accent-forest-700" /> Published</label></div>
                  </ActionForm>
                  <ActionForm action={deleteFaqAction} submit="Delete" variant="ghost" confirm="Delete this FAQ?"><input type="hidden" name="id" value={q.id} /></ActionForm>
                </div>
              </details>
            ))}
            <div className="rounded-xl bg-sand-100 p-4">
              <p className="mb-2 text-sm font-semibold">Add FAQ</p>
              <ActionForm action={saveFaqAction} submit="Add FAQ" resetOnSuccess>
                <Input name="question" placeholder="Question" aria-label="New question" />
                <Textarea name="answer" placeholder="Answer" rows={3} aria-label="New answer" />
                <input type="hidden" name="display_order" value={(faqs?.length ?? 0) + 1} /><input type="hidden" name="is_published" value="on" />
              </ActionForm>
            </div>
          </div>
        </Section>

        <Section title="Gallery">
          <ActionForm action={addGalleryImageAction} submit="Add photo" pendingText="Uploading…" resetOnSuccess inline>
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
            <Input name="caption" placeholder="Caption (also used as alt text)" className="w-72" />
          </ActionForm>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(gallery ?? []).map((g) => (
              <div key={g.id} className="space-y-2">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-sand-100"><Image src={storagePublicUrl(g.storage_path)!} alt={g.caption ?? ''} fill sizes="200px" className="object-cover" /></div>
                <ActionForm action={updateGalleryImageAction} submit="Save">
                  <input type="hidden" name="id" value={g.id} />
                  <Input name="caption" defaultValue={g.caption ?? ''} aria-label="Caption" />
                  <div className="flex items-center gap-2 text-xs"><Input name="display_order" type="number" defaultValue={g.display_order} className="w-16" aria-label="Order" />
                    <label className="flex items-center gap-1"><input type="checkbox" name="is_published" defaultChecked={g.is_published} className="accent-forest-700" /> Shown</label></div>
                </ActionForm>
                <ActionForm action={updateGalleryImageAction} submit="Delete" variant="ghost" confirm="Delete this photo?"><input type="hidden" name="id" value={g.id} /><input type="hidden" name="delete" value="1" /></ActionForm>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Policies">
          <ActionForm action={saveLegalAction} submit="Save policies" variant="forest">
            <p className="text-sm text-charcoal-600">Plain text. Blank line = new paragraph; a short first line becomes a heading. The starter text is a template — have it reviewed.</p>
            <Field label="Privacy Policy" htmlFor="privacy"><Textarea id="privacy" name="privacy" rows={8} defaultValue={s.legal.privacy ?? LEGAL_DEFAULTS.privacy} /></Field>
            <Field label="Terms & Conditions" htmlFor="terms"><Textarea id="terms" name="terms" rows={8} defaultValue={s.legal.terms ?? LEGAL_DEFAULTS.terms} /></Field>
            <Field label="Cancellation & Refund Policy" htmlFor="cancellation"><Textarea id="cancellation" name="cancellation" rows={8} defaultValue={s.legal.cancellation ?? LEGAL_DEFAULTS.cancellation} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bump" className="accent-forest-700" /> These are material changes — record a new policy version on future bookings (current: {s.policyVersion})</label>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
