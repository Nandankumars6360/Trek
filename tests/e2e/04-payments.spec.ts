import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { db, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const WEBHOOK_SECRET = process.env.E2E_RAZORPAY_WEBHOOK_SECRET ?? 'e2e_webhook_secret';
const sign = (body: string, secret = WEBHOOK_SECRET) => crypto.createHmac('sha256', secret).update(body).digest('hex');

let booking: { booking_id: string; reference: string; access_token: string; total_paise: number };

test.describe('online payments (Razorpay webhook path)', () => {
  test.beforeAll(async () => {
    await q(`update site_settings set value = 'true' where key = 'payments.online_enabled'`);
    const [trip] = await q<{ id: string }>(`select t.id from scheduled_trips t join treks k on k.id = t.trek_id where k.slug = 'demo-sunrise-hill' and t.status = 'scheduled' order by trip_date desc limit 1`);
    const c = await db().connect();
    try {
      await c.query('set role service_role');
      const { rows: [r] } = await c.query(`select public.create_booking(jsonb_build_object(
        'idempotency_key', gen_random_uuid(), 'scheduled_trip_id', $1::uuid, 'customer_name', 'Online Olivia', 'customer_email', 'online.olivia@example.com',
        'customer_phone', '+919833333333', 'participant_count', 1, 'additional_participants', '[]'::jsonb,
        'emergency_contact_name', 'Dad', 'emergency_contact_phone', '+919844444444', 'terms_accepted', true, 'privacy_accepted', true,
        'payment_mode', 'online')) as b`, [trip.id]);
      booking = r.b;
      await c.query(`select public.create_online_payment($1, 'order_e2e_1', $2)`, [booking.booking_id, booking.total_paise]);
    } finally { await c.query('reset role'); c.release(); }
  });
  test.afterAll(async () => { await q(`update site_settings set value = 'false' where key = 'payments.online_enabled'`); });

  test('booking waits as pending until payment is verified', async () => {
    const [b] = await q<{ status: string; payment_status: string }>(`select status, payment_status from bookings where id = $1`, [booking.booking_id]);
    expect(b).toEqual({ status: 'pending', payment_status: 'pending' });
  });

  test('a webhook with a bad signature is rejected and changes nothing', async ({ request }) => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_fake', order_id: 'order_e2e_1', amount: booking.total_paise, status: 'captured', method: 'upi' } } } });
    const res = await request.post('/api/razorpay/webhook', { data: body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(body, 'wrong-secret') } });
    expect(res.status()).toBe(400);
    const [{ n }] = await q<{ n: string }>(`select count(*) n from payments where provider_payment_id = 'pay_fake'`);
    expect(n).toBe('0');
  });

  test('a signed payment.captured webhook confirms and marks paid — once', async ({ request }) => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_e2e_1', order_id: 'order_e2e_1', amount: booking.total_paise, status: 'captured', method: 'upi' } } } });
    const headers = { 'content-type': 'application/json', 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_e2e_1' };
    const first = await request.post('/api/razorpay/webhook', { data: body, headers });
    expect(first.status()).toBe(200);
    const again = await request.post('/api/razorpay/webhook', { data: body, headers });
    expect(await again.json()).toMatchObject({ duplicate: true });

    const [b] = await q<{ status: string; payment_status: string }>(`select status, payment_status from bookings where id = $1`, [booking.booking_id]);
    expect(b).toEqual({ status: 'confirmed', payment_status: 'paid' });
    const [{ n }] = await q<{ n: string }>(`select count(*) n from payments where booking_id = $1 and status = 'captured'`, [booking.booking_id]);
    expect(n).toBe('1');
    const mails = await q<{ template: string }>(`select template from email_log where booking_id = $1 order by created_at`, [booking.booking_id]);
    expect(mails.map((m) => m.template)).toEqual(expect.arrayContaining(['payment_received', 'booking_confirmed']));
  });

  test('a wrong amount in a signed webhook is not accepted', async ({ request }) => {
    const c = await db().connect();
    try { await c.query('set role service_role'); await c.query(`select public.create_online_payment($1, 'order_e2e_2', $2)`, [booking.booking_id, booking.total_paise]); }
    catch { /* booking already paid → creating another order may be refused; that is fine */ }
    finally { await c.query('reset role'); c.release(); }
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_e2e_cheap', order_id: 'order_e2e_2', amount: 100, status: 'captured' } } } });
    const res = await request.post('/api/razorpay/webhook', { data: body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_e2e_2' } });
    expect(res.status()).toBe(500);   // refused → Razorpay will retry / flag it
    const [{ n }] = await q<{ n: string }>(`select count(*) n from payments where provider_payment_id = 'pay_e2e_cheap'`);
    expect(n).toBe('0');
  });

  test('browser "payment done" with a forged signature is refused', async ({ request }) => {
    const res = await request.post('/api/payments/verify', { data: {
      razorpay_order_id: 'order_e2e_1', razorpay_payment_id: 'pay_forged', razorpay_signature: 'f'.repeat(64),
      reference: booking.reference, token: booking.access_token } });
    expect(res.status()).toBe(400);
  });

  test('if Razorpay is unreachable, starting a payment fails gracefully', async ({ request }) => {
    const [trip] = await q<{ id: string }>(`select t.id from scheduled_trips t join treks k on k.id = t.trek_id where k.slug = 'demo-forest-ridge' and t.status = 'scheduled' order by trip_date desc limit 1`);
    const c = await db().connect();
    let b2: { reference: string; access_token: string };
    try {
      await c.query('set role service_role');
      const { rows: [r] } = await c.query(`select public.create_booking(jsonb_build_object(
        'idempotency_key', gen_random_uuid(), 'scheduled_trip_id', $1::uuid, 'customer_name', 'Net Down', 'customer_email', 'net.down@example.com',
        'customer_phone', '+919855555555', 'participant_count', 1, 'additional_participants', '[]'::jsonb,
        'emergency_contact_name', 'Dad', 'emergency_contact_phone', '+919866666666', 'terms_accepted', true, 'privacy_accepted', true, 'payment_mode', 'online')) as b`, [trip.id]);
      b2 = r.b;
    } finally { await c.query('reset role'); c.release(); }
    const res = await request.post('/api/payments/order', { data: { reference: b2!.reference, token: b2!.access_token } });
    expect([502, 503]).toContain(res.status());
    expect((await res.json()).error).toMatch(/unavailable|not available/i);
  });
});
