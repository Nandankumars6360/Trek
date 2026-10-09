import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Email confirmation & password-reset links land here.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') ?? '/my-bookings';
  const next = /^\/(?!\/)/.test(nextRaw) ? nextRaw : '/my-bookings';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc('claim_my_guest_bookings');
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
