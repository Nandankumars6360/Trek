'use server';
import { revalidatePath } from 'next/cache';
import { friendlyError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

export async function requestCancellationGuest(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const reference = String(form.get('reference') ?? '');
  const token = String(form.get('token') ?? '');
  const reason = String(form.get('reason') ?? '').trim().slice(0, 1000);
  if (!(await rateLimit('cancel', 5, 3600))) return { ok: false, error: 'Too many requests. Try again later.' };
  if (reason.length < 3) return { ok: false, error: 'Tell us briefly why you want to cancel.' };
  const { error } = await createServiceClient().rpc('request_cancellation_guest', { p_reference: reference, p_token: token, p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/booking-confirmation/${reference}`);
  return { ok: true, message: 'Cancellation request sent. We will email you once it is reviewed.' };
}
