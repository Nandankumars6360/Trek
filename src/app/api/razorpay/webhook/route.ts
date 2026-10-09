import { NextResponse } from 'next/server';
import { isRazorpayConfigured } from '@/lib/env';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { recordVerifiedPayment } from '@/lib/payments/record';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Payload = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; method?: string; status: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
  };
};

// Razorpay → us. Signed with the webhook secret; each event processed at most once.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') ?? '';
  if (!verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: 'bad signature' }, { status: 400 });

  let body: Payload;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const eventId = req.headers.get('x-razorpay-event-id') ?? `${body.event}:${body.payload.payment?.entity.id ?? body.payload.refund?.entity.id}`;

  const db = createServiceClient();
  await db.from('webhook_events').upsert({ provider: 'razorpay', event_id: eventId, event_type: body.event }, { onConflict: 'provider,event_id', ignoreDuplicates: true });
  const { data: ev } = await db.from('webhook_events').select('processed_at').eq('provider', 'razorpay').eq('event_id', eventId).single();
  if (ev?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const pay = body.payload.payment?.entity;
    if ((body.event === 'payment.captured' || body.event === 'order.paid') && pay?.status === 'captured') {
      await recordVerifiedPayment(pay.order_id, pay.id, pay.amount, pay.method ?? null);
    } else if (body.event === 'payment.failed' && pay) {
      await db.rpc('mark_online_payment_failed', { p_order_id: pay.order_id });
    } else if (body.event === 'refund.processed' && body.payload.refund) {
      await db.rpc('mark_refund_processed', { p_provider_refund_id: body.payload.refund.entity.id });
    }
    await db.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'razorpay').eq('event_id', eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[razorpay webhook]', body.event, e);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });   // Razorpay retries
  }
}
