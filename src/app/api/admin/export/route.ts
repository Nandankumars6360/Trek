import { NextResponse, type NextRequest } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { todayIST } from '@/lib/format';

export const dynamic = 'force-dynamic';

const rs = (p: number | null | undefined) => (p == null ? '' : (p / 100).toFixed(2));
const isUuid = (v?: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const isDate = (v?: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Admin-only CSV exports. Authorisation is checked here AND enforced by RLS on every query.
export async function GET(req: NextRequest) {
  const { supabase, role } = await getAdmin();
  if (!role) return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const type = p.get('type') ?? 'bookings';
  const stamp = todayIST();

  const filtered = () => {
    let q = supabase.from('admin_booking_list').select('*');
    if (isUuid(p.get('trek'))) q = q.eq('trek_id', p.get('trek')!);
    if (isDate(p.get('date'))) q = q.eq('trip_date', p.get('date')!);
    const st = p.get('status');
    if (st && ['pending', 'confirmed', 'cancelled', 'completed'].includes(st)) q = q.eq('status', st);
    const pay = p.get('payment');
    if (pay && ['unpaid', 'pending', 'paid', 'partially_refunded', 'refunded'].includes(pay)) q = q.eq('payment_status', pay);
    const term = p.get('q')?.replace(/[%,()]/g, ' ').trim();
    if (term) q = q.or(`reference.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%`);
    return q.order('trip_date').order('created_at').limit(10000);
  };

  switch (type) {
    case 'bookings': {
      const { data, error } = await filtered();
      if (error) break;
      // general export: no emergency contacts or health notes
      return csvResponse(`bookings-${stamp}.csv`, toCsv(
        ['Reference', 'Booked at', 'Customer', 'Email', 'Phone', 'Trek', 'Trip date', 'Participants', 'Status', 'Payment status', 'Payment mode', 'Total (INR)', 'Paid (INR)'],
        (data ?? []).map((b) => [b.reference, b.created_at, b.customer_name, b.customer_email, b.customer_phone, b.trek_name, b.trip_date, b.participant_count, b.status, b.payment_status, b.payment_mode, rs(b.total_paise), rs(b.paid_paise)])));
    }
    case 'participants': {
      // trip-day sheet: includes emergency contacts and safety notes because the trek lead needs them
      const { data: list, error } = await filtered();
      if (error) break;
      const ids = (list ?? []).filter((b) => b.status !== 'cancelled').map((b) => b.id);
      const [{ data: people }, { data: extra }] = await Promise.all([
        supabase.from('participants').select('booking_id, full_name, is_primary').in('booking_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('bookings').select('id, emergency_contact_name, emergency_contact_phone, food_preference, safety_notes').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      ]);
      const byId = new Map((list ?? []).map((b) => [b.id, b]));
      const ex = new Map((extra ?? []).map((b) => [b.id, b]));
      const rows = (people ?? []).sort((a, b) => (byId.get(a.booking_id)!.reference + (a.is_primary ? 0 : 1)).localeCompare(byId.get(b.booking_id)!.reference + (b.is_primary ? 0 : 1)))
        .map((pp) => { const b = byId.get(pp.booking_id)!; const e = ex.get(pp.booking_id); return [
          b.trip_date, b.trek_name, b.reference, pp.full_name, pp.is_primary ? 'Booker' : 'Guest', b.customer_phone, b.status, b.payment_status,
          e?.emergency_contact_name, e?.emergency_contact_phone, e?.food_preference, e?.safety_notes]; });
      return csvResponse(`participants-${stamp}.csv`, toCsv(['Trip date', 'Trek', 'Reference', 'Participant', 'Role', 'Booker phone', 'Status', 'Payment', 'Emergency contact', 'Emergency phone', 'Food', 'Safety notes'], rows));
    }
    case 'payments': {
      let q = supabase.from('payments').select('*, bookings(reference, customer_name)').order('created_at');
      const st = p.get('status'); if (st && ['created', 'captured', 'failed'].includes(st)) q = q.eq('status', st);
      const pr = p.get('provider'); if (pr && ['manual', 'razorpay'].includes(pr)) q = q.eq('provider', pr);
      if (isDate(p.get('from'))) q = q.gte('created_at', `${p.get('from')}T00:00:00+05:30`);
      if (isDate(p.get('to'))) q = q.lte('created_at', `${p.get('to')}T23:59:59+05:30`);
      const { data, error } = await q.limit(10000);
      if (error) break;
      return csvResponse(`payments-${stamp}.csv`, toCsv(['Created', 'Verified', 'Booking', 'Customer', 'Provider', 'Method', 'Transaction ref', 'Order ID', 'Amount (INR)', 'Status'],
        (data ?? []).map((x) => [x.created_at, x.verified_at, x.bookings?.reference, x.bookings?.customer_name, x.provider, x.method, x.provider_payment_id, x.provider_order_id, rs(x.amount_paise), x.status])));
    }
    case 'refunds': {
      const { data, error } = await supabase.from('refunds').select('*, payments(provider, bookings(reference, customer_name))').order('created_at').limit(10000);
      if (error) break;
      return csvResponse(`refunds-${stamp}.csv`, toCsv(['Created', 'Processed', 'Booking', 'Customer', 'Provider', 'Amount (INR)', 'Reason', 'Status', 'Provider refund ID'],
        (data ?? []).map((r) => [r.created_at, r.processed_at, r.payments?.bookings?.reference, r.payments?.bookings?.customer_name, r.payments?.provider, rs(r.amount_paise), r.reason, r.status, r.provider_refund_id])));
    }
    case 'customers': {
      const { data, error } = await supabase.rpc('admin_customers', { p_search: p.get('q') ?? null, p_limit: 500, p_offset: 0 });
      if (error) break;
      return csvResponse(`customers-${stamp}.csv`, toCsv(['Name', 'Email', 'Phone', 'Bookings', 'Active bookings', 'Participants', 'First booking', 'Last booking', 'Has account'],
        ((data ?? []) as Record<string, unknown>[]).map((c) => [c.name, c.email, c.phone, c.bookings, c.active_bookings, c.participants, c.first_booking, c.last_booking, c.user_id ? 'yes' : 'no'])));
    }
    case 'trips': {
      let q = supabase.from('scheduled_trips').select('*, treks(name, price_paise)').order('trip_date');
      if (isUuid(p.get('trek'))) q = q.eq('trek_id', p.get('trek')!);
      const { data, error } = await q.limit(5000);
      if (error) break;
      return csvResponse(`trips-${stamp}.csv`, toCsv(['Date', 'Trek', 'Status', 'Capacity', 'Booked', 'Left', 'Price (INR)', 'Reporting', 'Return'],
        (data ?? []).map((t) => [t.trip_date, t.treks?.name, t.status, t.capacity, t.seats_reserved, t.capacity - t.seats_reserved, rs(t.price_override_paise ?? t.treks?.price_paise), t.reporting_time, t.return_time])));
    }
    case 'report_by_date': case 'report_by_trek': case 'report_repeat': {
      if (!isDate(p.get('from')) || !isDate(p.get('to'))) return NextResponse.json({ error: 'from/to required' }, { status: 400 });
      const { data, error } = await supabase.rpc('admin_report', { p_from: p.get('from'), p_to: p.get('to') });
      if (error || !data) break;
      const r = data as Record<string, Record<string, unknown>[]>;
      if (type === 'report_by_date') return csvResponse(`report-by-date-${p.get('from')}-${p.get('to')}.csv`, toCsv(['Date', 'Bookings', 'Participants', 'Cancelled'], r.by_date.map((d) => [d.day, d.bookings, d.participants ?? 0, d.cancelled])));
      if (type === 'report_by_trek') return csvResponse(`report-by-trek-${p.get('from')}-${p.get('to')}.csv`, toCsv(['Trek', 'Bookings', 'Participants', 'Confirmed', 'Pending', 'Cancelled', 'Booking value (INR)'], r.by_trek.map((t) => [t.trek_name, t.bookings, t.participants, t.confirmed, t.pending, t.cancelled, rs(t.booking_value_paise as number)])));
      return csvResponse(`repeat-customers-${stamp}.csv`, toCsv(['Name', 'Email', 'Bookings'], r.repeat_customers.map((c) => [c.name, c.email, c.bookings])));
    }
    default:
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Export failed' }, { status: 500 });
}
