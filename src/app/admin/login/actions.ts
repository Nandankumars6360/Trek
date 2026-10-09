'use server';
import { redirect } from 'next/navigation';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { loginSchema } from '@/lib/validation';

export async function adminLoginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = loginSchema.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!p.success) return { ok: false, error: 'Enter your email and password (8+ characters).' };

  // 10 tries per IP and 5 per account every 15 minutes
  if (!(await rateLimit('admin-login', 10, 900)) || !(await rateLimit('admin-login-email', 5, 900, p.data.email))) {
    return { ok: false, error: 'Too many attempts. Wait 15 minutes and try again.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(p.data);
  if (error || !data.user) return { ok: false, error: 'Incorrect email or password.' };

  // signing in is not enough: the account must be in admin_users and active
  const { data: admin } = await supabase.from('admin_users').select('is_active').eq('user_id', data.user.id).maybeSingle();
  if (!admin?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: 'This account does not have admin access.' };
  }
  redirect('/admin/dashboard');
}

export async function adminLogoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
