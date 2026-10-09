// Central place for configuration. Secrets are read only on the server.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
};

export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export function serverEnv() {
  if (typeof window !== 'undefined') throw new Error('serverEnv() called in the browser');
  const resendKey = process.env.RESEND_API_KEY ?? '';
  const mode = (process.env.EMAIL_MODE ?? (resendKey ? 'live' : 'log')) as 'live' | 'log';
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    resendKey,
    emailFrom: process.env.EMAIL_FROM ?? '',
    emailReplyTo: process.env.EMAIL_REPLY_TO ?? '',
    // "log" = never send; emails are recorded as skipped and printed to the server log
    emailMode: mode === 'live' && resendKey && process.env.EMAIL_FROM ? 'live' : 'log',
    razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
    cronSecret: process.env.CRON_SECRET ?? '',
  };
}

export function isRazorpayConfigured() {
  const e = serverEnv();
  return Boolean(e.razorpayKeyId && e.razorpayKeySecret && e.razorpayWebhookSecret);
}

export function storagePublicUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/trek-images/${path.replace(/^\/+/, '')}`;
}
