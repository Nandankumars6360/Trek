'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { adminOrError } from '@/lib/auth';
import { sendBookingEmail } from '@/lib/email/booking-emails';
import { friendlyError } from '@/lib/errors';
import { formatDate, formatTime } from '@/lib/format';
import type { ActionResult } from '@/lib/types';
import { fieldErrors, tripSchema } from '@/lib/validation';

const refresh = () => { revalidatePath('/admin/trips'); revalidatePath('/treks'); revalidatePath('/'); };

export async function createTripAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const p = tripSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { ok: false, error: 'Please fix the fields.', fieldErrors: fieldErrors(p.error) };
  const { error } = await a.supabase.from('scheduled_trips').insert(p.data);
  if (error) return { ok: false, error: error.code === '23505' ? 'This trek already has a trip on that date and time.' : friendlyError(error) };
  refresh();
  return { ok: true, message: 'Trip date added.' };
}

export async function updateTripAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const id = String(f.get('id'));
  const p = tripSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { ok: false, error: 'Please fix the fields.', fieldErrors: fieldErrors(p.error) };
  const { data: before } = await a.supabase.from('scheduled_trips').select('trip_date, reporting_time, return_time, meeting_point').eq('id', id).single();
  if (!before) return { ok: false, error: 'Trip not found.' };
  // trek_id and status are not editable here (status changes go through complete/cancel)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { trek_id, ...patch } = p.data;
  const { error } = await a.supabase.from('scheduled_trips').update(patch).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error) };

  const changes: string[] = [];
  if (before.trip_date !== patch.trip_date) changes.push(`Date: ${formatDate(before.trip_date)} → ${formatDate(patch.trip_date)}`);
  if ((before.reporting_time ?? '').slice(0, 5) !== (patch.reporting_time ?? '')) changes.push(`Reporting time: ${formatTime(patch.reporting_time) ?? 'to be confirmed'}`);
  if ((before.return_time ?? '').slice(0, 5) !== (patch.return_time ?? '')) changes.push(`Return time: ${formatTime(patch.return_time) ?? 'to be confirmed'}`);
  if ((before.meeting_point ?? null) !== patch.meeting_point) changes.push(`Meeting point: ${patch.meeting_point ?? 'default for this trek'}`);

  let msg = 'Trip saved.';
  if (changes.length && f.get('notify') === 'on') {
    const { data: bookings } = await a.supabase.from('bookings').select('id').eq('scheduled_trip_id', id).in('status', ['pending', 'confirmed']);
    const ids = (bookings ?? []).map((b) => b.id);
    after(async () => { for (const b of ids) await sendBookingEmail(b, 'schedule_changed', { changes }); });
    msg += ` Notifying ${ids.length} booking(s) about the change.`;
  }
  refresh();
  return { ok: true, message: msg };
}

export async function completeTripAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const { data, error } = await a.supabase.rpc('admin_complete_trip', { p_trip: String(f.get('id')) });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh();
  return { ok: true, message: `Trip completed; ${data} booking(s) marked completed.` };
}

export async function cancelTripAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const reason = String(f.get('reason') ?? '').trim();
  if (reason.length < 3) return { ok: false, error: 'Give a reason — it is emailed to participants.' };
  const { data, error } = await a.supabase.rpc('admin_cancel_trip', { p_trip: String(f.get('id')), p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  const ids = ((data ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : (r as Record<string, string>).admin_cancel_trip ?? Object.values(r as object)[0])) as string[];
  after(async () => { for (const b of ids) await sendBookingEmail(b, 'trip_cancelled', { reason }); });
  refresh();
  return { ok: true, message: `Trip cancelled. ${ids.length} booking(s) cancelled and being emailed. Record refunds on each booking.` };
}
