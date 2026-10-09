import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron';
import { sendBookingEmail } from '@/lib/email/booking-emails';
import { retryFailedEmails } from '@/lib/email/send';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily at 12:30 UTC (6 PM IST): reminders for tomorrow's confirmed trips, then retry failed emails.
// Reminders are de-duplicated in the database, so running this twice is safe.
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { data: trips } = await db.from('scheduled_trips').select('id').eq('trip_date', tomorrow).eq('status', 'scheduled');
  const ids = (trips ?? []).map((t) => t.id);
  let reminders = 0;
  if (ids.length) {
    const { data: bookings } = await db.from('bookings').select('id').in('scheduled_trip_id', ids).eq('status', 'confirmed');
    for (const b of bookings ?? []) {
      const r = await sendBookingEmail(b.id, 'reminder');
      if (r.status === 'sent' || r.status === 'skipped') reminders++;
    }
  }
  const retry = await retryFailedEmails(50);
  return NextResponse.json({ ok: true, date: tomorrow, reminders, retried: retry.retried });
}
