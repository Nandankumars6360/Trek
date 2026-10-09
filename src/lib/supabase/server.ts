import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { publicEnv, serverEnv } from '@/lib/env';

/** Client acting as the signed-in visitor (or anon). RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component: middleware refreshes the session instead
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS — server code only, never sent to the browser. */
export function createServiceClient() {
  const key = serverEnv().serviceRoleKey;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createPlainClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anonymous client without cookies — safe for cached public pages. */
export function createPublicClient() {
  return createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
