'use server';
import { revalidatePath } from 'next/cache';
import { adminOrError } from '@/lib/auth';
import { retryFailedEmails } from '@/lib/email/send';
import { friendlyError } from '@/lib/errors';
import { isRazorpayConfigured } from '@/lib/env';
import type { ActionResult } from '@/lib/types';

export async function saveBookingSettingsAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(true); if (!a.ok) return a;
  const online = f.get('online_enabled') === 'on';
  if (online && !isRazorpayConfigured()) return { ok: false, error: 'Add the Razorpay keys (see README) before turning on online payments.' };
  const rows = [
    { key: 'booking.require_approval', value: f.get('require_approval') === 'on' },
    { key: 'payments.online_enabled', value: online },
    { key: 'payments.manual_instructions', value: String(f.get('manual_instructions') ?? '').trim().slice(0, 1000) },
  ].map((r) => ({ ...r, updated_by: a.user.id, updated_at: new Date().toISOString() }));
  const { error } = await a.supabase.from('site_settings').upsert(rows);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved.' };
}

export async function retryEmailsAction(): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const r = await retryFailedEmails(50);
  revalidatePath('/admin/settings');
  return { ok: true, message: `Retried ${r.retried} email(s).` };
}
