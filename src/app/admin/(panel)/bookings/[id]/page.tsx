import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { KV, PageHeader, Section, Table, Td } from '@/components/admin/admin-ui';
import { PrintButton } from '@/components/client-ui';
import { Badge, Input, Select, Textarea } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTime, formatINR, formatPhone, formatTime, paiseToRupees, titleCase } from '@/lib/format';
import { addNoteAction, recordPaymentAction, refundAction, rejectCancellationAction, resendEmailAction, setStatusAction } from '../actions';

export const metadata: Metadata = { title: 'Booking' };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, role } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: b } = await supabase.from('bookings')
    .select('*, scheduled_trips(*, treks(id, name, slug, meeting_point, default_reporting_time, default_return_time))').eq('id', id).maybeSingle();
  if (!b) notFound();
  const [participants, payments, refunds, history, notes, requests, emails, preview] = await Promise.all([
    supabase.from('participants').select('full_name, is_primary').eq('booking_id', id).order('is_primary', { ascending: false }).order('created_at'),
    supabase.from('payments').select('*').eq('booking_id', id).order('created_at'),
    supabase.from('refunds').select('*, payments!inner(booking_id)').eq('payments.booking_id', id).order('created_at'),
    supabase.from('booking_status_history').select('*').eq('booking_id', id).order('created_at'),
    supabase.from('booking_admin_notes').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
    supabase.from('cancellation_requests').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
    supabase.from('email_log').select('template, status, error, created_at, to_email').eq('booking_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.rpc('refund_preview', { p_booking: id }),
  ]);
  const trip = b.scheduled_trips; const trek = trip.treks;
  const paid = (payments.data ?? []).filter((p) => p.status === 'captured').reduce((n, p) => n + p.amount_paise, 0);
  const refunded = (refunds.data ?? []).filter((r) => r.status === 'processed').reduce((n, r) => n + r.amount_paise, 0);
  const due = Math.max(0, b.total_paise - paid);
  const openReq = (requests.data ?? []).find((r) => r.status === 'open');
  const pv = preview.data as { refund_percent: number; refundable_paise: number; hours_before_trip: number } | null;
  const nextStatuses = b.status === 'pending' ? ['confirmed', 'cancelled'] : b.status === 'confirmed' ? ['cancelled', 'completed'] : [];

  return (
    <>
      <PageHeader title={b.reference} back={{ href: '/admin/bookings', label: 'Bookings' }}>
        <Badge value={b.status} /><Badge value={b.payment_status} /><PrintButton />
      </PageHeader>

      {openReq && (
        <div className="mb-6 rounded-xl2 border border-clay-600/30 bg-clay-100 p-5 no-print">
          <p className="font-semibold text-clay-700">Cancellation requested {formatDateTime(openReq.created_at)}</p>
          <p className="mt-1 text-sm">“{openReq.reason}”</p>
          {pv && <p className="mt-1 text-sm">Policy: {pv.refund_percent}% refund ({formatINR(pv.refundable_paise)} of {formatINR(paid)} paid), {pv.hours_before_trip} h before reporting.</p>}
          <p className="mt-2 text-xs text-charcoal-600">Approve by cancelling the booking below (then record the refund). Or reject:</p>
          <ActionForm action={rejectCancellationAction} submit="Reject request" variant="secondary" inline className="mt-2">
            <input type="hidden" name="requestId" value={openReq.id} /><input type="hidden" name="bookingId" value={id} />
            <Input name="note" placeholder="Reason shown in history" className="w-72" />
          </ActionForm>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Booking">
          <KV rows={[
            ['Trek', <Link key="t" href={`/admin/treks/${trek.id}/edit`} className="text-forest-700 hover:underline">{trek.name}</Link>],
            ['Trip date', `${formatDate(trip.trip_date)} · reporting ${formatTime(trip.reporting_time ?? trek.default_reporting_time) ?? '—'}`],
            ['Meeting point', trip.meeting_point ?? trek.meeting_point],
            ['Participants', b.participant_count],
            ['Price / person', formatINR(b.price_per_participant_paise)],
            ['Total', <b key="tot">{formatINR(b.total_paise)}</b>],
            ['Paid / refunded', `${formatINR(paid)} / ${formatINR(refunded)}`],
            ['Due', formatINR(due)],
            ['Payment mode', titleCase(b.payment_mode)],
            ['Booked', formatDateTime(b.created_at)],
            ['Policy accepted', `${b.policy_version} on ${formatDateTime(b.terms_accepted_at)}`],
            ['Account', b.customer_user_id ? 'Registered customer' : 'Guest'],
          ]} />
        </Section>
        <Section title="Customer & emergency contact">
          <KV rows={[
            ['Name', b.customer_name],
            ['Email', <a key="e" href={`mailto:${b.customer_email}`} className="text-forest-700 hover:underline">{b.customer_email}</a>],
            ['Phone', <a key="p" href={`tel:${b.customer_phone}`} className="text-forest-700 hover:underline">{formatPhone(b.customer_phone)}</a>],
            ['Emergency contact', `${b.emergency_contact_name} · ${formatPhone(b.emergency_contact_phone)}`],
            ['Food', b.food_preference ? titleCase(b.food_preference) : '—'],
            ['Health / safety', b.safety_notes ? <span key="s" className="rounded bg-clay-100 px-1.5 py-0.5">{b.safety_notes}</span> : '—'],
            ['Requests', b.special_requests],
          ]} />
          <h3 className="mt-4 text-sm font-semibold">All participants</h3>
          <ol className="mt-1 list-decimal pl-5 text-sm">{(participants.data ?? []).map((p, i) => <li key={i}>{p.full_name}{p.is_primary ? ' (booker)' : ''}</li>)}</ol>
          <Link href={`/admin/customers?email=${encodeURIComponent(b.customer_email)}`} className="mt-3 inline-block text-sm text-forest-700 hover:underline">Customer history →</Link>
        </Section>

        <Section title="Update status">
          {nextStatuses.length ? (
            <ActionForm action={setStatusAction} submit="Update status" variant="forest">
              <input type="hidden" name="bookingId" value={id} />
              <Select name="status" defaultValue={nextStatuses[0]} aria-label="New status">{nextStatuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
              <Textarea name="reason" rows={2} placeholder="Reason (required for cancel, saved in history)" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-forest-700" /> Email the customer</label>
            </ActionForm>
          ) : <p className="text-sm text-charcoal-600">This booking is {b.status}; no further status changes.</p>}
        </Section>

        <Section title="Payments">
          <Table head={['When', 'Method', 'Reference', 'Amount', 'Status', '']} empty={!payments.data?.length}>
            {(payments.data ?? []).map((p) => (
              <tr key={p.id}>
                <Td className="text-xs">{formatDateTime(p.verified_at ?? p.created_at)}</Td>
                <Td>{p.provider === 'manual' ? titleCase(p.method ?? 'manual') : `Razorpay ${p.method ?? ''}`}</Td>
                <Td className="font-mono text-xs">{p.provider_payment_id ?? p.provider_order_id ?? '—'}</Td>
                <Td>{formatINR(p.amount_paise)}</Td>
                <Td><Badge value={p.status} /></Td>
                <Td>{p.status === 'captured' && role !== 'staff' && (
                  <details><summary className="cursor-pointer text-xs font-semibold text-forest-700">Refund</summary>
                    <ActionForm action={refundAction} submit="Record refund" variant="danger" confirm="Record this refund?" className="mt-2 w-64">
                      <input type="hidden" name="bookingId" value={id} /><input type="hidden" name="paymentId" value={p.id} />
                      <Input name="amount" inputMode="decimal" placeholder="Amount ₹" defaultValue={pv ? paiseToRupees(Math.min(pv.refundable_paise, p.amount_paise)) : ''} />
                      <Input name="reason" placeholder="Reason" />
                      <p className="text-xs text-charcoal-600">{p.provider === 'razorpay' ? 'Sends the refund through Razorpay.' : 'Pay it back yourself (UPI/bank), then record it here.'}</p>
                    </ActionForm>
                  </details>)}</Td>
              </tr>
            ))}
          </Table>
          {(refunds.data ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">{refunds.data!.map((r) => <li key={r.id}>Refund {formatINR(r.amount_paise)} · <Badge value={r.status} /> · {r.reason} · {formatDateTime(r.created_at)}</li>)}</ul>
          )}
          {due > 0 && b.status !== 'cancelled' && (
            <div className="mt-5 border-t border-sand-200 pt-4">
              <h3 className="mb-2 text-sm font-semibold">Record a payment received</h3>
              <ActionForm action={recordPaymentAction} submit="Record payment" variant="forest" confirm="Record this payment? It will be logged with your name.">
                <input type="hidden" name="bookingId" value={id} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input name="amount" inputMode="decimal" defaultValue={paiseToRupees(due)} aria-label="Amount in rupees" />
                  <Select name="method" defaultValue="upi" aria-label="Method"><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></Select>
                  <Input name="reference" placeholder="UPI/UTR ref" aria-label="Transaction reference" />
                </div>
                <Input name="note" placeholder="Note (optional)" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-forest-700" /> Email a payment receipt</label>
              </ActionForm>
            </div>
          )}
        </Section>

        <Section title="Internal notes">
          <ActionForm action={addNoteAction} submit="Add note" resetOnSuccess>
            <input type="hidden" name="bookingId" value={id} />
            <Textarea name="note" rows={2} placeholder="Only admins can see notes" />
          </ActionForm>
          <ul className="mt-4 space-y-3">{(notes.data ?? []).map((n) => <li key={n.id} className="rounded-lg bg-sand-100 p-3 text-sm"><p className="whitespace-pre-line">{n.note}</p><p className="mt-1 text-xs text-charcoal-600">{formatDateTime(n.created_at)}</p></li>)}</ul>
        </Section>

        <Section title="Emails">
          <ActionForm action={resendEmailAction} submit="Send" inline>
            <input type="hidden" name="bookingId" value={id} />
            <Select name="template" aria-label="Email" className="w-60">
              <option value="booking_confirmed">Booking confirmed</option><option value="booking_received">Booking received</option>
              <option value="booking_cancelled">Booking cancelled</option><option value="reminder">Trip reminder</option>
            </Select>
          </ActionForm>
          <ul className="mt-4 space-y-1 text-sm">{(emails.data ?? []).map((e, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2"><Badge value={e.status} /> {titleCase(e.template)} → {e.to_email} · <span className="text-xs text-charcoal-600">{formatDateTime(e.created_at)}</span>{e.error && <span className="text-xs text-red-700">{e.error}</span>}</li>
          ))}</ul>
        </Section>

        <Section title="History">
          <ol className="space-y-2 text-sm">{(history.data ?? []).map((h) => (
            <li key={h.id} className="flex flex-wrap gap-2"><span className="text-xs text-charcoal-600">{formatDateTime(h.created_at)}</span>
              <span>{h.field === 'status' ? 'Status' : 'Payment'}: {h.old_value ? `${titleCase(h.old_value)} → ` : ''}<b>{titleCase(h.new_value)}</b>{h.reason ? ` — ${h.reason}` : ''}{h.changed_by ? '' : ' (system)'}</span></li>
          ))}</ol>
        </Section>
      </div>
    </>
  );
}
