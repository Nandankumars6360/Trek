import 'server-only';
import { publicEnv, serverEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { renderEmail, type EmailData, type EmailTemplate } from './templates';

type Transport = (msg: { to: string; subject: string; html: string; replyTo?: string }) =>
  Promise<{ ok: true; id: string } | { ok: false; error: string; retryable: boolean }>;

/** Resend REST API. Exported for tests. */
export const resendTransport: Transport = async ({ to, subject, html, replyTo }) => {
  const env = serverEnv();
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.id) return { ok: true, id: String(body.id) };
    return { ok: false, error: `${res.status}: ${body.message ?? 'rejected'}`.slice(0, 500), retryable: res.status >= 500 || res.status === 429 };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 500), retryable: true };
  }
};

const BACKOFF_MIN = [1, 5, 30, 120, 720];

/**
 * Logs the email, tries to send it, and records the real outcome.
 * Never reports "sent" unless the provider accepted it.
 */
export async function sendEmail(template: EmailTemplate, to: string, data: Omit<EmailData, 'brand' | 'siteUrl' | 'supportEmail' | 'supportPhone'>,
  opts: { bookingId?: string | null; transport?: Transport } = {}) {
  const settings = await getSettings();
  const full: EmailData = { ...data, brand: settings.brandName, siteUrl: publicEnv.siteUrl, supportEmail: settings.email, supportPhone: settings.phone };
  const { subject, html } = renderEmail(template, full);
  const db = createServiceClient();
  const env = serverEnv();

  const { data: log, error } = await db.from('email_log').insert({
    booking_id: opts.bookingId ?? null, to_email: to, template, subject, payload: full, status: 'queued',
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return { status: 'duplicate' as const };   // e.g. reminder already sent
    console.error('[email] log insert failed', error);
  }

  if (env.emailMode !== 'live' && !opts.transport) {
    console.info(`[email:log-mode] ${template} → ${to}: ${subject}`);
    if (log) await db.from('email_log').update({ status: 'skipped', attempts: 0, error: 'EMAIL_MODE=log (not sent)' }).eq('id', log.id);
    return { status: 'skipped' as const };
  }
  return attempt(log?.id ?? null, { to, subject, html }, 0, opts.transport ?? resendTransport);
}

async function attempt(logId: string | null, msg: { to: string; subject: string; html: string }, prevAttempts: number, transport: Transport) {
  const db = createServiceClient();
  const r = await transport({ ...msg, replyTo: serverEnv().emailReplyTo || undefined });
  const attempts = prevAttempts + 1;
  if (logId) {
    await db.from('email_log').update(r.ok
      ? { status: 'sent', provider_id: r.id, attempts, last_attempt_at: new Date().toISOString(), error: null, next_retry_at: null }
      : { status: 'failed', error: r.error, attempts, last_attempt_at: new Date().toISOString(),
          next_retry_at: r.retryable && attempts < BACKOFF_MIN.length ? new Date(Date.now() + BACKOFF_MIN[attempts - 1] * 60_000).toISOString() : null })
      .eq('id', logId);
  }
  if (!r.ok) console.error('[email] failed', msg.to, r.error);
  return r.ok ? { status: 'sent' as const, id: r.id } : { status: 'failed' as const, error: r.error };
}

/** Re-sends emails whose earlier attempt failed with a retryable error (called by cron). */
export async function retryFailedEmails(limit = 25) {
  if (serverEnv().emailMode !== 'live') return { retried: 0 };
  const db = createServiceClient();
  const { data } = await db.from('email_log').select('id, template, to_email, payload, attempts')
    .eq('status', 'failed').not('next_retry_at', 'is', null).lte('next_retry_at', new Date().toISOString()).limit(limit);
  let retried = 0;
  for (const row of data ?? []) {
    const { subject, html } = renderEmail(row.template as EmailTemplate, row.payload as EmailData);
    await attempt(row.id, { to: row.to_email, subject, html }, row.attempts, resendTransport);
    retried++;
  }
  return { retried };
}
