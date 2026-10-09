// Plain, responsive HTML emails. Every value is escaped.
import { formatDate, formatINR, formatTime } from '@/lib/format';

export type EmailTemplate =
  | 'booking_received' | 'booking_confirmed' | 'booking_cancelled' | 'payment_received'
  | 'reminder' | 'schedule_changed' | 'trip_cancelled' | 'booking_link' | 'admin_new_booking';

export type EmailData = {
  brand: string; supportEmail?: string; supportPhone?: string; siteUrl: string;
  name: string; reference: string; link: string;
  trekName: string; tripDate: string; reportingTime?: string | null; returnTime?: string | null;
  meetingPoint?: string | null; participants: number; totalPaise: number; paidPaise?: number;
  paymentStatus?: string; reason?: string | null; amountPaise?: number; thingsToCarry?: string[];
  manualInstructions?: string; changes?: string[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(d: EmailData, heading: string, body: string) {
  const support = [d.supportPhone && `Call/WhatsApp ${esc(d.supportPhone)}`, d.supportEmail && esc(d.supportEmail)].filter(Boolean).join(' · ');
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#22302a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1f3d2b;color:#f4f1ea;padding:20px 24px;font-size:20px;font-weight:bold">${esc(d.brand)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px;color:#1f3d2b">${heading}</h1>
${body}
<p style="margin:24px 0 0"><a href="${esc(d.link)}" style="display:inline-block;background:#c2622d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">View booking</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#f4f1ea;font-size:12px;color:#5b6b62">Booking reference: <b>${esc(d.reference)}</b><br>${support ? `Questions? ${support}` : ''}</td></tr>
</table></td></tr></table></body></html>`;
}

function tripTable(d: EmailData) {
  const row = (k: string, v: string | null | undefined) => (v ? `<tr><td style="padding:6px 12px 6px 0;color:#5b6b62">${k}</td><td style="padding:6px 0"><b>${esc(v)}</b></td></tr>` : '');
  return `<table role="presentation" style="border-collapse:collapse;font-size:14px;margin:8px 0">
${row('Trek', d.trekName)}${row('Date', formatDate(d.tripDate))}${row('Reporting', formatTime(d.reportingTime ?? null))}
${row('Return (approx.)', formatTime(d.returnTime ?? null))}${row('Meeting point', d.meetingPoint)}
${row('Participants', String(d.participants))}${row('Total', formatINR(d.totalPaise))}</table>`;
}

const carry = (d: EmailData) => d.thingsToCarry?.length
  ? `<p style="margin:12px 0 4px"><b>What to carry</b></p><ul style="margin:0;padding-left:18px">${d.thingsToCarry.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';

export function renderEmail(t: EmailTemplate, d: EmailData): { subject: string; html: string } {
  const hi = `<p>Hi ${esc(d.name)},</p>`;
  switch (t) {
    case 'booking_received':
      return { subject: `${d.brand}: booking received — ${d.trekName}`, html: layout(d, 'We got your booking',
        `${hi}<p>Thanks for registering. Your booking is <b>pending confirmation</b>; we'll email you once it's confirmed.</p>${tripTable(d)}
        ${d.manualInstructions ? `<p style="background:#f4f1ea;padding:12px;border-radius:8px">${esc(d.manualInstructions)}</p>` : ''}`) };
    case 'booking_confirmed':
      return { subject: `${d.brand}: you're confirmed for ${d.trekName}`, html: layout(d, 'Your seat is confirmed',
        `${hi}<p>See you on the trail! Here are your trip details.</p>${tripTable(d)}${carry(d)}`) };
    case 'booking_cancelled':
      return { subject: `${d.brand}: booking cancelled — ${d.reference}`, html: layout(d, 'Booking cancelled',
        `${hi}<p>Your booking for <b>${esc(d.trekName)}</b> on ${esc(formatDate(d.tripDate))} has been cancelled.</p>
        ${d.reason ? `<p>Reason: ${esc(d.reason)}</p>` : ''}<p>If a refund applies, we'll process it as per the cancellation policy and let you know.</p>`) };
    case 'payment_received':
      return { subject: `${d.brand}: payment received — ${formatINR(d.amountPaise)}`, html: layout(d, 'Payment received',
        `${hi}<p>We received <b>${esc(formatINR(d.amountPaise))}</b> for booking ${esc(d.reference)}.</p>
        <p>Paid so far: ${esc(formatINR(d.paidPaise))} of ${esc(formatINR(d.totalPaise))}.</p>`) };
    case 'reminder':
      return { subject: `${d.brand}: your trek is tomorrow — ${d.trekName}`, html: layout(d, 'Your trek is tomorrow',
        `${hi}<p>Quick reminder of your trip details. Please report on time.</p>${tripTable(d)}${carry(d)}`) };
    case 'schedule_changed':
      return { subject: `${d.brand}: schedule update — ${d.trekName}`, html: layout(d, 'Your trip schedule changed',
        `${hi}<p>We've updated your trip:</p><ul>${(d.changes ?? []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${tripTable(d)}
        <p>If the new schedule doesn't work for you, reply or contact us to cancel.</p>`) };
    case 'trip_cancelled':
      return { subject: `${d.brand}: trip cancelled — ${d.trekName}`, html: layout(d, 'We had to cancel this trip',
        `${hi}<p>We're sorry — the <b>${esc(d.trekName)}</b> trip on ${esc(formatDate(d.tripDate))} has been cancelled.</p>
        ${d.reason ? `<p>Reason: ${esc(d.reason)}</p>` : ''}<p>We'll contact you about your refund.</p>`) };
    case 'booking_link':
      return { subject: `${d.brand}: your booking link`, html: layout(d, 'Your secure booking link',
        `${hi}<p>Someone asked for the link to booking <b>${esc(d.reference)}</b>. Use the button below to open it. If this wasn't you, ignore this email.</p>`) };
    case 'admin_new_booking':
      return { subject: `New booking ${d.reference}: ${d.name} — ${d.trekName}`, html: layout(d, 'New booking',
        `<p><b>${esc(d.name)}</b> booked ${d.participants} seat(s).</p>${tripTable(d)}`) };
  }
}
