import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type AdminRole = 'owner' | 'admin' | 'staff';

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();   // verified with the auth server
  return { supabase, user };
});

export const getAdmin = cache(async () => {
  const { supabase, user } = await getSessionUser();
  if (!user) return { supabase, user: null, role: null as AdminRole | null };
  const { data } = await supabase.from('admin_users').select('role, is_active').eq('user_id', user.id).maybeSingle();
  const role = data?.is_active ? (data.role as AdminRole) : null;
  return { supabase, user, role };
});

/** Use at the top of every admin page and server action. */
export async function requireAdmin() {
  const a = await getAdmin();
  if (!a.user) redirect('/admin/login');
  if (!a.role) redirect('/access-denied');
  return a as { supabase: typeof a.supabase; user: NonNullable<typeof a.user>; role: AdminRole };
}

export async function requireManager() {
  const a = await requireAdmin();
  if (a.role === 'staff') redirect('/access-denied');
  return a;
}

/** For actions that return errors instead of redirecting. */
export async function adminOrError(manager = false) {
  const a = await getAdmin();
  if (!a.user || !a.role || (manager && a.role === 'staff')) return { ok: false as const, error: 'You are not allowed to do that.' };
  return { ok: true as const, ...a, user: a.user, role: a.role };
}
