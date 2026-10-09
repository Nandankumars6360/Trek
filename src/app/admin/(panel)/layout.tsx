import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { adminLogoutAction } from '../login/actions';
import { Sidebar } from './sidebar';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, role } = await requireAdmin();     // server-side check on every admin page
  const settings = await getSettings();
  const [{ count: pending }, { count: requests }, { count: messages }] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('cancellation_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  return (
    <div className="min-h-screen bg-sand-50 lg:flex">
      <Sidebar brand={settings.brandName} email={user.email ?? ''} role={role}
        badges={{ '/admin/bookings': (pending ?? 0) + (requests ?? 0), '/admin/messages': messages ?? 0 }} />
      <div className="min-w-0 flex-1">
        <div className="flex justify-end border-b border-sand-200 bg-white px-6 py-2 no-print">
          <form action={adminLogoutAction}><button className="text-sm font-semibold text-forest-700 hover:underline">Log out</button></form>
        </div>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
