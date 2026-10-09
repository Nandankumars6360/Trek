import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/admin-ui';
import { requireManager } from '@/lib/auth';
import { TrekForm } from '../trek-form';

export const metadata: Metadata = { title: 'New trek' };

export default async function NewTrek() {
  await requireManager();
  return (
    <>
      <PageHeader title="New trek" back={{ href: '/admin/treks', label: 'Treks' }} />
      <p className="mb-4 text-sm text-charcoal-600">Save first, then add photos and trip dates. Keep it as Draft until the details are final.</p>
      <TrekForm />
    </>
  );
}
