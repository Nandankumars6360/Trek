import 'server-only';
import { getSessionUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { BookingDetails } from '@/lib/types';

const REF = /^TRK-[0-9A-Z]{10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a booking only if the visitor proves access:
 *  - guest: reference + secret token from their email/link, or
 *  - signed-in owner: RLS lets them read their own booking.
 * Wrong reference and wrong token look identical (no enumeration).
 */
export async function loadBookingForVisitor(reference: string, token?: string | null) {
  const ref = decodeURIComponent(reference).toUpperCase();
  if (!REF.test(ref)) return null;
  const db = createServiceClient();

  if (token && UUID.test(token)) {
    const { data } = await db.rpc('get_booking_for_guest', { p_reference: ref, p_token: token });
    return data ? { booking: data as BookingDetails, token } : null;
  }

  const { supabase, user } = await getSessionUser();
  if (!user) return null;
  const { data: own } = await supabase.from('bookings').select('access_token').eq('reference', ref).maybeSingle();
  if (!own) return null;
  const { data } = await db.rpc('get_booking_for_guest', { p_reference: ref, p_token: own.access_token });
  return data ? { booking: data as BookingDetails, token: own.access_token as string } : null;
}
