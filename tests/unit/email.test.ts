import { beforeEach, describe, expect, it, vi } from 'vitest';

// in-memory stand-in for the email_log table
const log: Record<string, Record<string, unknown>> = {};
let n = 0;
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => { const id = `log-${++n}`; log[id] = { ...row }; return { data: { id }, error: null }; } }),
      }),
      update: (patch: Record<string, unknown>) => ({ eq: async (_: string, id: string) => { Object.assign(log[id], patch); return { error: null }; } }),
    }),
  }),
}));
vi.mock('@/lib/settings', () => ({
  getSettings: async () => ({ brandName: 'TestBrand', email: 'team@example.com', phone: '+91 90000 00000' }),
}));

const data = { name: 'Asha', reference: 'TRK-ABCDEFGHJK', link: 'https://x/y', trekName: 'Hill <b>', tripDate: '2026-11-01', participants: 2, totalPaise: 179800 };

describe('sending email', () => {
  beforeEach(() => { for (const k of Object.keys(log)) delete log[k]; vi.unstubAllEnvs(); });

  it('does not send (and says so) when sending is switched off', async () => {
    vi.stubEnv('EMAIL_MODE', 'log');
    const { sendEmail } = await import('@/lib/email/send');
    const r = await sendEmail('booking_received', 'a@b.co', data);
    expect(r.status).toBe('skipped');
    expect(Object.values(log)[0].status).toBe('skipped');
  });

  it('records a provider rejection as failed with a retry time — never as sent', async () => {
    vi.stubEnv('EMAIL_MODE', 'live'); vi.stubEnv('RESEND_API_KEY', 'k'); vi.stubEnv('EMAIL_FROM', 'x@y.co');
    const { sendEmail } = await import('@/lib/email/send');
    const transport = vi.fn(async () => ({ ok: false as const, error: '500: provider down', retryable: true }));
    const r = await sendEmail('booking_confirmed', 'a@b.co', data, { transport });
    expect(r.status).toBe('failed');
    const row = Object.values(log)[0];
    expect(row.status).toBe('failed');
    expect(row.error).toBe('500: provider down');
    expect(row.attempts).toBe(1);
    expect(row.next_retry_at).toBeTruthy();
  });

  it('does not schedule retries for permanent rejections', async () => {
    const { sendEmail } = await import('@/lib/email/send');
    const transport = vi.fn(async () => ({ ok: false as const, error: '422: invalid recipient', retryable: false }));
    await sendEmail('booking_confirmed', 'bad', data, { transport });
    expect(Object.values(log)[0].next_retry_at).toBeNull();
  });

  it('marks sent only after the provider accepts, and escapes user text', async () => {
    const { sendEmail } = await import('@/lib/email/send');
    const transport = vi.fn(async (msg: { html: string }) => ({ ok: true as const, id: `em_${msg.html.length > 0 ? 123 : 0}` }));
    const r = await sendEmail('booking_confirmed', 'a@b.co', data, { transport });
    expect(r).toEqual({ status: 'sent', id: 'em_123' });
    expect(Object.values(log)[0]).toMatchObject({ status: 'sent', provider_id: 'em_123' });
    const html = transport.mock.calls[0][0].html;
    expect(html).toContain('Hill &lt;b&gt;');
    expect(html).not.toContain('Hill <b>');
    expect(html).toContain('TRK-ABCDEFGHJK');
  });

  it('a network error in the real transport is reported as retryable failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k'); vi.stubEnv('EMAIL_FROM', 'x@y.co');
    const { resendTransport } = await import('@/lib/email/send');
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNRESET'); }) as never;
    try {
      expect(await resendTransport({ to: 'a@b.co', subject: 's', html: 'h' })).toEqual({ ok: false, error: 'ECONNRESET', retryable: true });
    } finally { globalThis.fetch = orig; }
  });
});
