import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { PageHeader, Section } from '@/components/admin/admin-ui';
import { Alert, Badge, ButtonLink } from '@/components/ui';
import { requireManager } from '@/lib/auth';
import { storagePublicUrl } from '@/lib/env';
import type { Trek } from '@/lib/types';
import { deleteTrekAction, removeTrekImageAction, setTrekStatusAction, uploadTrekImageAction } from '../../actions';
import { TrekForm } from '../../trek-form';

export const metadata: Metadata = { title: 'Edit trek' };

function ImageTile({ trekId, path, label }: { trekId: string; path: string; label?: string }) {
  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand-100"><Image src={storagePublicUrl(path)!} alt={label ?? ''} fill sizes="200px" className="object-cover" /></div>
      <ActionForm action={removeTrekImageAction} submit="Remove" variant="ghost" confirm="Remove this image?">
        <input type="hidden" name="id" value={trekId} /><input type="hidden" name="path" value={path} />
      </ActionForm>
    </div>
  );
}

export default async function EditTrek({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { supabase } = await requireManager();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from('treks').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const t = data as Trek;

  return (
    <>
      <PageHeader title={t.name} back={{ href: '/admin/treks', label: 'Treks' }}>
        <Badge value={t.status} />
        <ButtonLink href={`/admin/trips?trek=${t.id}`} variant="secondary" size="sm">Trip dates</ButtonLink>
        <ButtonLink href={`/admin/bookings?trek=${t.id}`} variant="secondary" size="sm">Registrations</ButtonLink>
        {t.status === 'published' && <Link href={`/treks/${t.slug}`} className="self-center text-sm text-forest-700 hover:underline">View live ↗</Link>}
      </PageHeader>
      {created && <Alert tone="success" className="mb-4">Trek created. Add photos and trip dates, then publish.</Alert>}

      <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Section title="Photos">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">Cover image</p>
              {t.featured_image ? <ImageTile trekId={t.id} path={t.featured_image} label="Cover" /> : <p className="text-sm text-charcoal-600">No cover yet — cards show an illustration.</p>}
              <ActionForm action={uploadTrekImageAction} submit="Upload cover" pendingText="Uploading…" className="mt-3">
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="kind" value="featured" />
                <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
              </ActionForm>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Gallery ({t.gallery_images.length}/20)</p>
              <ActionForm action={uploadTrekImageAction} submit="Add to gallery" pendingText="Uploading…" resetOnSuccess>
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="kind" value="gallery" />
                <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
              </ActionForm>
              <p className="mt-2 text-xs text-charcoal-600">JPEG, PNG, WebP or AVIF, up to 5 MB. Use photos you own or have a licence for.</p>
            </div>
          </div>
          {t.gallery_images.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{t.gallery_images.map((g) => <ImageTile key={g} trekId={t.id} path={g} />)}</div>
          )}
        </Section>
        <Section title="Visibility">
          <div className="space-y-3">
            {t.status !== 'published' && <ActionForm action={setTrekStatusAction} submit="Publish" variant="forest"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="published" /></ActionForm>}
            {t.status === 'published' && <ActionForm action={setTrekStatusAction} submit="Unpublish (draft)" variant="secondary"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="draft" /></ActionForm>}
            {t.status !== 'archived' && <ActionForm action={setTrekStatusAction} submit="Archive" variant="secondary" confirm="Archive this trek? It disappears from the site but bookings are kept."><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="archived" /></ActionForm>}
            <ActionForm action={deleteTrekAction} submit="Delete permanently" variant="ghost" confirm="Delete permanently? Only works if it has no trip dates.">
              <input type="hidden" name="id" value={t.id} />
            </ActionForm>
            <p className="text-xs text-charcoal-600">Treks with trip dates or bookings can’t be deleted — archive them to keep history.</p>
          </div>
        </Section>
      </div>
      <TrekForm trek={t} />
    </>
  );
}
