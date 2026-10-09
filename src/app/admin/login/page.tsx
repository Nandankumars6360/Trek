import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoMark } from '@/components/site/mountains';
import { getAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { AdminLoginForm } from './login-form';

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLogin() {
  if (isSupabaseConfigured) {
    const { role } = await getAdmin();
    if (role) redirect('/admin/dashboard');
  }
  return (
    <main id="main" className="grid min-h-screen place-items-center bg-forest-950 px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-sand-50 p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3"><LogoMark className="size-10" /><div><p className="font-display text-xl">Admin</p><p className="text-xs text-charcoal-600">Organiser access only</p></div></div>
        <AdminLoginForm />
        <Link href="/forgot-password?admin=1" className="mt-4 block text-center text-sm text-forest-700 hover:underline">Forgot password?</Link>
      </div>
    </main>
  );
}
