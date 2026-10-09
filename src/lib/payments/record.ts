import 'server-only';
import { sendBookingEmail } from '@/lib/email/booking-emails';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Records a payment that has ALREADY been verified with Razorpay
 * (checkout signature + payment fetch, or a signed webhook). Idempotent.
 */
export async function recordVerifiedPayment(orderId: string, paymentId: string, amountPaise: number, method: string | null) {
  const db = createServiceClient();
  const { data, error } = await db.rpc('record_verified_online_payment', {
    p_order_id: orderId, p_payment_id: paymentId, p_amount_paise: amountPaise, p_method: method,
  });
  if (error) throw error;
  const r = data as { booking_id: string; duplicate: boolean };
  if (!r.duplicate) {
    await sendBookingEmail(r.booking_id, 'payment_received', { amountPaise });
    const { data: b } = await db.from('bookings').select('status').eq('id', r.booking_id).single();
    if (b?.status === 'confirmed') await sendBookingEmail(r.booking_id, 'booking_confirmed');
  }
  return r;
}
