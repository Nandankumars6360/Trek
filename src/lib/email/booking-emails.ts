import 'server-only';
import { publicEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import type { BookingDetails } from '@/lib/types';
import { sendEmail } from './send';
import type { EmailTemplate } from './templates';

export function bookingLink(reference: string, token: string) {
  return `${publicEnv.siteUrl}/booking-confirmation/${encodeURIComponent(reference)}?t=${encodeURIComponent(token)}`;
}

/** Loads a booking (server-side) and sends one of the booking emails. Never throws. */
export async function sendBookingEmail(bookingId: string, template: EmailTemplate, extra: { reason?: string | null; amountPaise?: number; changes?: string[] } = {}) {
  try {
    const db = createServiceClient();
    const { data: b } = await db.from('bookings').select('reference, access_token, customer_email').eq('id', bookingId).single();
    if (!b) return { status: 'failed' as const, error: 'booking not found' };
    const { data: details } = await db.rpc('get_booking_for_guest', { p_reference: b.reference, p_token: b.access_token });
    const d = details as BookingDetails | null;
    if (!d) return { status: 'failed' as const, error: 'booking not found' };
    const settings = await getSettings();
    return await sendEmail(template, template === 'admin_new_booking' ? settings.email : b.customer_email, {
      name: d.customer_name, reference: d.reference, link: bookingLink(b.reference, b.access_token),
      trekName: d.trek.name, tripDate: d.trip.date, reportingTime: d.trip.reporting_time, returnTime: d.trip.return_time,
      meetingPoint: d.trip.meeting_point, participants: d.participant_count, totalPaise: d.total_paise, paidPaise: d.paid_paise,
      paymentStatus: d.payment_status, thingsToCarry: d.trek.things_to_carry,
      manualInstructions: d.payment_mode === 'manual' && d.payment_status !== 'paid' ? settings.manualInstructions : undefined,
      ...extra,
    }, { bookingId });
  } catch (e) {
    console.error('[email] sendBookingEmail', template, e);
    return { status: 'failed' as const, error: 'unexpected error' };
  }
}
