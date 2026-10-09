'use server';
import { revalidatePath } from 'next/cache';
import { friendlyError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { normalizeIndianPhone } from '@/lib/validation';

// These run as the signed-in customer: the database only lets them touch their own bookings.
export async function requestCancellationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const reason = String(form.get('reason') ?? '').trim();
  if (reason.length < 3) return { ok: false, error: 'Tell us briefly why you want to cancel.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_cancellation', { p_booking: String(form.get('bookingId')), p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/my-bookings');
  return { ok: true, message: 'Cancellation request sent.' };
}

export async function updateContactAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const phone = normalizeIndianPhone(String(form.get('phone') ?? ''));
  const ePhone = normalizeIndianPhone(String(form.get('emergencyPhone') ?? ''));
  const eName = String(form.get('emergencyName') ?? '').trim();
  if (!phone || !ePhone) return { ok: false, error: 'Enter valid 10-digit Indian mobile numbers.' };
  if (eName.length < 2) return { ok: false, error: 'Enter the emergency contact name.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_my_booking_contact', {
    p_booking: String(form.get('bookingId')), p_phone: phone, p_emergency_name: eName, p_emergency_phone: ePhone,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/my-bookings');
  return { ok: true, message: 'Contact details updated.' };
}
