import { NextResponse } from 'next/server';
import { z } from 'zod';
import { friendlyError } from '@/lib/errors';
import { isRazorpayConfigured, serverEnv } from '@/lib/env';
import { createOrder } from '@/lib/payments/razorpay';
import { rateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
import { createServiceClient } from '@/lib/supabase/server';
import type { BookingDetails } from '@/lib/types';

const Body = z.object({ reference: z.string().regex(/^TRK-[0-9A-Z]{10}$/), token: z.string().uuid() });

// Starts an online payment. The amount always comes from the database.
export async function POST(req: Request) {
  if (!isRazorpayConfigured() || !(await getSettings()).onlinePaymentsEnabled) {
    return NextResponse.json({ error: 'Online payment is not available.' }, { status: 503 });
  }
  if (!(await rateLimit('pay-order', 10, 600))) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const db = createServiceClient();
  const { data } = await db.rpc('get_booking_for_guest', { p_reference: parsed.data.reference, p_token: parsed.data.token });
  const b = data as BookingDetails | null;
  if (!b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (!['pending', 'confirmed'].includes(b.status) || b.payment_mode !== 'online') return NextResponse.json({ error: 'This booking cannot be paid online.' }, { status: 409 });
  if (b.paid_paise > 0) return NextResponse.json({ error: 'This booking is already paid.' }, { status: 409 });

  try {
    const order = await createOrder(b.total_paise, b.reference, { booking_id: b.id, reference: b.reference });
    const { error } = await db.rpc('create_online_payment', { p_booking: b.id, p_order_id: order.id, p_amount_paise: b.total_paise });
    if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 409 });
    return NextResponse.json({ orderId: order.id, amount: order.amount, keyId: serverEnv().razorpayKeyId });
  } catch (e) {
    console.error('[payments/order]', e);
    return NextResponse.json({ error: 'Payment provider is unavailable. Please try again.' }, { status: 502 });
  }
}
