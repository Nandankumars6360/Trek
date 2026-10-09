import 'server-only';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
}

/** Fixed-window limiter backed by Postgres (works across serverless instances). */
export async function rateLimit(bucket: string, max: number, windowSeconds: number, key?: string) {
  const id = `${bucket}:${key ?? (await clientIp())}`;
  try {
    const { data, error } = await createServiceClient().rpc('check_rate_limit', {
      p_key: id, p_max: max, p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error('[rate-limit] failed open', e);
    return true; // never lock real customers out because the limiter failed
  }
}
