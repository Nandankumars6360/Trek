import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isRazorpayConfigured } from '@/lib/env';
import { fetchPayment, verifyCheckoutSignature } from '@/lib/payments/razorpay';
import { recordVerifiedPayment } from '@/lib/payments/record';
import { createServiceClient } from '@/lib/supabase/server';
import type { BookingDetails } from '@/lib/types';

const Body = z.object({
  razorpay_order_id: z.string().min(5).max(64), razorpay_payment_id: z.string().min(5).max(64), razorpay_signature: z.string().min(10).max(256),
  reference: z.string().regex(/^TRK-[0-9A-Z]{10}$/), token: z.string().uuid(),
});

// Called by the browser after checkout. We never trust the browser's word:
// signature is checked, and the payment is fetched from Razorpay directly.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = p.data;

  if (!verifyCheckoutSignature(orderId, paymentId, sig)) return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });

  const db = createServiceClient();
  const { data } = await db.rpc('get_booking_for_guest', { p_reference: p.data.reference, p_token: p.data.token });
  const b = data as BookingDetails | null;
  const { data: pay } = await db.from('payments').select('booking_id').eq('provider', 'razorpay').eq('provider_order_id', orderId).maybeSingle();
  if (!b || !pay || pay.booking_id !== b.id) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  try {
    const rp = await fetchPayment(paymentId);
    if (rp.order_id !== orderId) return NextResponse.json({ error: 'Payment does not match this order.' }, { status: 400 });
    if (rp.status !== 'captured') {
      return NextResponse.json({ status: rp.status, error: 'Payment is still processing. This page will update once it completes.' }, { status: 202 });
    }
    await recordVerifiedPayment(orderId, paymentId, rp.amount, rp.method ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[payments/verify]', e);
    return NextResponse.json({ error: 'We could not confirm the payment yet. If money was debited, it will update automatically.' }, { status: 502 });
  }
}
