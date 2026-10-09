import 'server-only';
import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env';

const API = 'https://api.razorpay.com/v1';

function auth() {
  const e = serverEnv();
  return 'Basic ' + Buffer.from(`${e.razorpayKeyId}:${e.razorpayKeySecret}`).toString('base64');
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = serverEnv().razorpayKeySecret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature = HMAC_SHA256(raw body, webhook_secret) */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = serverEnv().razorpayWebhookSecret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

export async function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  const res = await fetch(`${API}/orders`, {
    method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Razorpay order failed: ${body?.error?.description ?? res.status}`);
  return body as { id: string; amount: number; currency: string };
}

export async function fetchPayment(paymentId: string) {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: auth() }, signal: AbortSignal.timeout(15_000) });
  const body = await res.json();
  if (!res.ok) throw new Error(`Razorpay fetch failed: ${body?.error?.description ?? res.status}`);
  return body as { id: string; order_id: string; amount: number; status: string; method: string; captured: boolean };
}

export async function createRefund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, notes }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Razorpay refund failed: ${body?.error?.description ?? res.status}`);
  return body as { id: string; status: string };
}
