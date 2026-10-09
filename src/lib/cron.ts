import 'server-only';
import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env';

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". */
export function isCronAuthorized(req: Request) {
  const secret = serverEnv().cronSecret;
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  return Boolean(secret) && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
