'use server';
import { rateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { contactSchema, fieldErrors } from '@/lib/validation';

export async function contactAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = contactSchema.safeParse(Object.fromEntries(form));
  if (!p.success) {
    if (p.error.issues.some((i) => i.path[0] === 'website')) return { ok: true, message: 'Thanks! We will get back to you soon.' }; // honeypot: pretend success
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(p.error) };
  }
  if (!(await rateLimit('contact', 5, 3600))) return { ok: false, error: 'Too many messages. Please try again later.' };
  const { name, email, phone, subject, message } = p.data;
  const { error } = await createServiceClient().from('contact_messages').insert({ name, email, phone: phone ?? null, subject, message });
  if (error) { console.error('[contact]', error); return { ok: false, error: 'Could not send your message. Please try again.' }; }
  return { ok: true, message: 'Thanks! Your message has been sent. We usually reply within a day.' };
}
