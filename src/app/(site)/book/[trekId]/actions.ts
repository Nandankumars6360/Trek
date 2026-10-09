'use server';
import { after } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sendBookingEmail } from '@/lib/email/booking-emails';
import { friendlyError } from '@/lib/errors';
import { isRazorpayConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
import { createServiceClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { bookingSchema, fieldErrors, type BookingInput } from '@/lib/validation';

type Created = { reference: string; token: string };

export async function createBookingAction(input: BookingInput): Promise<ActionResult<Created>> {
  // 1) validate on the server (never trust the browser)
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  // 2) slow down abuse: 10 booking attempts per 10 minutes per IP
  if (!(await rateLimit('booking', 10, 600))) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' };

  const settings = await getSettings();
  if (v.paymentMode === 'online' && !(settings.onlinePaymentsEnabled && isRazorpayConfigured())) {
    return { ok: false, error: 'Online payment is not available right now. Choose pay later.' };
  }

  const { user } = await getSessionUser();

  // 3) the database function checks trek, date, deadline, capacity (with a row lock), price and duplicates
  const { data, error } = await createServiceClient().rpc('create_booking', {
    p: {
      idempotency_key: v.idempotencyKey,
      scheduled_trip_id: v.tripId,
      customer_user_id: user?.id ?? null,
      customer_name: v.customerName,
      customer_email: v.customerEmail,
      customer_phone: v.customerPhone,
      participant_count: v.participantCount,
      additional_participants: v.additionalParticipants.map((p) => p.name),
      emergency_contact_name: v.emergencyContactName,
      emergency_contact_phone: v.emergencyContactPhone,
      food_preference: v.foodPreference ?? null,
      safety_notes: v.safetyNotes || null,
      special_requests: v.specialRequests || null,
      terms_accepted: v.acceptTerms,
      privacy_accepted: v.acceptPrivacy,
      policy_version: settings.policyVersion,
      payment_mode: v.paymentMode,
    },
  });
  if (error || !data) return { ok: false, error: friendlyError(error, 'We could not save your booking. Please try again.') };

  const r = data as { booking_id: string; reference: string; access_token: string; status: string; duplicate: boolean };

  // 4) emails go out after the response, so a slow email provider never blocks the booking
  if (!r.duplicate) {
    after(async () => {
      await sendBookingEmail(r.booking_id, r.status === 'confirmed' ? 'booking_confirmed' : 'booking_received');
      if (settings.email) await sendBookingEmail(r.booking_id, 'admin_new_booking');
    });
  }
  return { ok: true, data: { reference: r.reference, token: r.access_token } };
}
