'use server';
import { revalidatePath } from 'next/cache';
import { adminOrError } from '@/lib/auth';
import { sendBookingEmail } from '@/lib/email/booking-emails';
import type { EmailTemplate } from '@/lib/email/templates';
import { friendlyError } from '@/lib/errors';
import { isRazorpayConfigured } from '@/lib/env';
import { rupeesToPaise } from '@/lib/format';
import { createRefund } from '@/lib/payments/razorpay';
import type { ActionResult } from '@/lib/types';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const done = (id: string, message: string): ActionResult => { revalidatePath(`/admin/bookings/${id}`); revalidatePath('/admin/bookings'); return { ok: true, message }; };

export async function setStatusAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const id = s(f, 'bookingId'), status = s(f, 'status'), reason = s(f, 'reason') || null;
  if (!['confirmed', 'cancelled', 'completed'].includes(status)) return { ok: false, error: 'Pick a status.' };
  if (status === 'cancelled' && !reason) return { ok: false, error: 'Add a reason for cancelling.' };
  const { error } = await a.supabase.rpc('admin_set_booking_status', { p_booking: id, p_status: status, p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  let note = '';
  if (f.get('notify') === 'on' && status !== 'completed') {
    const r = await sendBookingEmail(id, status === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled', { reason });
    note = r.status === 'sent' ? ' Email sent.' : r.status === 'skipped' ? ' Email logged (sending is off).' : ' Email FAILED — see email log.';
  }
  return done(id, `Booking ${status}.${note}`);
}

export async function recordPaymentAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const id = s(f, 'bookingId');
  const amount = rupeesToPaise(s(f, 'amount'));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter the amount received in rupees.' };
  const { error } = await a.supabase.rpc('admin_record_manual_payment', {
    p_booking: id, p_amount_paise: amount, p_method: s(f, 'method'), p_reference: s(f, 'reference') || null, p_note: s(f, 'note') || null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  if (f.get('notify') === 'on') await sendBookingEmail(id, 'payment_received', { amountPaise: amount });
  return done(id, 'Payment recorded.');
}

export async function addNoteAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const note = s(f, 'note');
  if (!note) return { ok: false, error: 'Write a note first.' };
  const { error } = await a.supabase.rpc('admin_add_booking_note', { p_booking: s(f, 'bookingId'), p_note: note.slice(0, 2000) });
  if (error) return { ok: false, error: friendlyError(error) };
  return done(s(f, 'bookingId'), 'Note added.');
}

const RESENDABLE: EmailTemplate[] = ['booking_received', 'booking_confirmed', 'booking_cancelled', 'reminder'];

export async function resendEmailAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const t = s(f, 'template') as EmailTemplate;
  if (!RESENDABLE.includes(t)) return { ok: false, error: 'Pick an email.' };
  const r = await sendBookingEmail(s(f, 'bookingId'), t);
  revalidatePath(`/admin/bookings/${s(f, 'bookingId')}`);
  if (r.status === 'sent') return { ok: true, message: 'Email sent.' };
  if (r.status === 'skipped') return { ok: true, message: 'Logged only — email sending is off (EMAIL_MODE=log).' };
  if (r.status === 'duplicate') return { ok: false, error: 'This reminder was already sent.' };
  return { ok: false, error: `Email failed: ${'error' in r ? r.error : 'unknown'}` };
}

export async function rejectCancellationAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc('admin_reject_cancellation', { p_request: s(f, 'requestId'), p_note: s(f, 'note') || 'Not eligible' });
  if (error) return { ok: false, error: friendlyError(error) };
  return done(s(f, 'bookingId'), 'Request rejected.');
}

export async function refundAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;          // owners/admins only
  const bookingId = s(f, 'bookingId'), paymentId = s(f, 'paymentId');
  const amount = rupeesToPaise(s(f, 'amount'));
  const reason = s(f, 'reason');
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter the refund amount in rupees.' };
  if (!reason) return { ok: false, error: 'Add a reason.' };

  const { data: pay } = await a.supabase.from('payments').select('provider, provider_payment_id, status, amount_paise').eq('id', paymentId).single();
  if (!pay || pay.status !== 'captured') return { ok: false, error: 'This payment cannot be refunded.' };
  const { data: prior } = await a.supabase.from('refunds').select('amount_paise, status').eq('payment_id', paymentId);
  const already = (prior ?? []).filter((r) => r.status !== 'failed').reduce((n, r) => n + r.amount_paise, 0);
  if (already + amount > pay.amount_paise) return { ok: false, error: `Refund is larger than the amount left to refund (${(pay.amount_paise - already) / 100} ₹).` };

  if (pay.provider === 'razorpay') {
    if (!isRazorpayConfigured()) return { ok: false, error: 'Razorpay is not configured.' };
    // limits checked above (and again inside the DB function); Razorpay moves the money
    try {
      const rf = await createRefund(pay.provider_payment_id!, amount, { booking_id: bookingId, reason: reason.slice(0, 200) });
      const { error } = await a.supabase.rpc('admin_record_refund', {
        p_payment: paymentId, p_amount_paise: amount, p_reason: reason,
        p_status: rf.status === 'processed' ? 'processed' : 'pending', p_provider_refund_id: rf.id,
      });
      if (error) return { ok: false, error: `Razorpay refund ${rf.id} created but not recorded: ${friendlyError(error)}. Record it manually.` };
      return done(bookingId, rf.status === 'processed' ? 'Refund processed.' : 'Refund started with Razorpay; it will update when processed.');
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  // manual payments: you pay the money back yourself, then record it here
  const { error } = await a.supabase.rpc('admin_record_refund', { p_payment: paymentId, p_amount_paise: amount, p_reason: reason, p_status: 'processed', p_provider_refund_id: null });
  if (error) return { ok: false, error: friendlyError(error) };
  return done(bookingId, 'Refund recorded.');
}
