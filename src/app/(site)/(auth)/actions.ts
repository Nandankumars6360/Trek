'use server';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/send';
import { bookingLink } from '@/lib/email/booking-emails';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { fieldErrors, guestLookupSchema, loginSchema, signupSchema } from '@/lib/validation';

const safeNext = (n: unknown) => (typeof n === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(n) && !n.startsWith('/admin') ? n : '/my-bookings');

export async function loginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = loginSchema.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!p.success) return { ok: false, error: 'Check your email and password.', fieldErrors: fieldErrors(p.error) };
  if (!(await rateLimit('login', 10, 900)) || !(await rateLimit('login-email', 5, 900, p.data.email))) {
    return { ok: false, error: 'Too many sign-in attempts. Wait 15 minutes and try again.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(p.data);
  if (error) return { ok: false, error: error.message.includes('confirm') ? 'Please confirm your email first (check your inbox).' : 'Incorrect email or password.' };
  await supabase.rpc('claim_my_guest_bookings');
  redirect(safeNext(form.get('next')));
}

export async function signupAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = signupSchema.safeParse({ email: form.get('email'), password: form.get('password'), fullName: form.get('fullName') });
  if (!p.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(p.error) };
  if (!(await rateLimit('signup', 5, 3600))) return { ok: false, error: 'Too many sign-ups from this network. Try again later.' };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email, password: p.data.password,
    options: { data: { full_name: p.data.fullName }, emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/my-bookings` },
  });
  if (error) return { ok: false, error: error.message.includes('already') ? 'An account with this email already exists. Try signing in.' : 'Could not create the account. Please try again.' };
  if (data.session) { await supabase.rpc('claim_my_guest_bookings'); redirect('/my-bookings'); }
  return { ok: true, message: 'Check your email to confirm your account. Your earlier bookings with this email will appear once you sign in.' };
}

export async function forgotPasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const admin = form.get('admin') === '1';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter a valid email.' };
  if (!(await rateLimit('reset', 5, 3600))) return { ok: false, error: 'Too many requests. Try again later.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/reset-password${admin ? '?admin=1' : ''}` });
  return { ok: true, message: 'If an account exists for that email, a reset link is on its way.' };   // same answer either way
}

export async function resetPasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
  if (password !== form.get('confirm')) return { ok: false, error: 'Passwords do not match.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'This reset link has expired. Request a new one.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: 'Could not update the password. Try a different one.' };
  redirect(form.get('admin') === '1' ? '/admin/dashboard' : '/my-bookings');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/** Guest lookup: we never show the booking here — we email the secure link to the address on file. */
export async function guestLookupAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = guestLookupSchema.safeParse({ reference: form.get('reference'), email: form.get('email') });
  if (!p.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(p.error) };
  if (!(await rateLimit('lookup', 5, 3600))) return { ok: false, error: 'Too many lookups. Try again later.' };
  const db = createServiceClient();
  const { data: b } = await db.from('bookings').select('id, reference, access_token, customer_email, customer_name')
    .eq('reference', p.data.reference).eq('customer_email', p.data.email).maybeSingle();
  if (b) {
    await sendEmail('booking_link', b.customer_email, {
      name: b.customer_name, reference: b.reference, link: bookingLink(b.reference, b.access_token),
      trekName: '', tripDate: '', participants: 0, totalPaise: 0,
    }, { bookingId: b.id });
  }
  return { ok: true, message: 'If that reference matches the email, we have sent the booking link to it.' };
}
