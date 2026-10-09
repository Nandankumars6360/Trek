import { describe, expect, it } from 'vitest';
import { bookingSchema, contactSchema, normalizeIndianPhone, trekSchema, tripSchema } from '@/lib/validation';

const valid = {
  idempotencyKey: '7f1c1c1e-2b39-4c1e-9f55-3c5a3f0d8b11', tripId: '2b1c1c1e-2b39-4c1e-9f55-3c5a3f0d8b11',
  customerName: 'Asha Rao', customerEmail: 'Asha@Example.com', customerPhone: '98765 43210',
  participantCount: 2, additionalParticipants: [{ name: 'Ravi K' }],
  emergencyContactName: 'Mum', emergencyContactPhone: '+91 98123 45678',
  acceptTerms: true, acceptPrivacy: true,
} as const;

describe('Indian phone numbers', () => {
  it.each([['9876543210'], ['09876543210'], ['+919876543210'], ['+91 98765 43210'], ['91-98765-43210']])('accepts %s', (v) => {
    expect(normalizeIndianPhone(v)).toBe('+919876543210');
  });
  it.each([['12345'], ['5876543210'], ['98765432101'], ['+1 202 555 0100'], ['abcdefghij']])('rejects %s', (v) => {
    expect(normalizeIndianPhone(v)).toBeNull();
  });
});

describe('booking form', () => {
  it('accepts a valid booking and normalises email + phones', () => {
    const r = bookingSchema.parse(valid);
    expect(r.customerEmail).toBe('asha@example.com');
    expect(r.customerPhone).toBe('+919876543210');
    expect(r.emergencyContactPhone).toBe('+919812345678');
    expect(r.paymentMode).toBe('manual');
  });
  it('requires a name for every extra participant', () => {
    const r = bookingSchema.safeParse({ ...valid, participantCount: 3 });
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.path[0] === 'additionalParticipants')).toBe(true);
  });
  it('requires both consents', () => {
    expect(bookingSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, acceptPrivacy: false }).success).toBe(false);
  });
  it('rejects empty name, bad email, bad phone and too many people', () => {
    expect(bookingSchema.safeParse({ ...valid, customerName: ' ' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, customerEmail: 'not-an-email' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, customerPhone: '12345' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, participantCount: 21 }).success).toBe(false);
  });
  it('emergency contact must differ from the booker', () => {
    expect(bookingSchema.safeParse({ ...valid, emergencyContactPhone: valid.customerPhone }).success).toBe(false);
  });
  it('drops any price or status the browser tries to send', () => {
    const r = bookingSchema.parse({ ...valid, price_paise: 1, total_paise: 1, status: 'confirmed' } as never);
    expect(r).not.toHaveProperty('price_paise');
    expect(r).not.toHaveProperty('status');
  });
});

describe('admin trek form', () => {
  const base = { name: 'Sunrise Hill', slug: 'sunrise-hill', destination: 'Hill', difficulty: 'easy', price_paise: '899', min_participants_per_booking: '1', max_participants_per_booking: '6', status: 'draft' };
  it('converts rupees to paise and parses lists, itinerary and refund rules', () => {
    const r = trekSchema.parse({ ...base, price_paise: '1,099.50', inclusions: 'Guide\n\nSnacks\n', itinerary: '04:00 | Start\nSummit', refund_rules: '72h: 100%\n24h=50' });
    expect(r.price_paise).toBe(109950);
    expect(r.inclusions).toEqual(['Guide', 'Snacks']);
    expect(r.itinerary).toEqual([{ time: '04:00', title: 'Start' }, { time: '', title: 'Summit' }]);
    expect(r.refund_rules).toEqual([{ hours_before: 72, refund_percent: 100 }, { hours_before: 24, refund_percent: 50 }]);
  });
  it('rejects bad slugs, refund rules over 100% and min > max', () => {
    expect(trekSchema.safeParse({ ...base, slug: 'Bad Slug!' }).success).toBe(false);
    expect(trekSchema.safeParse({ ...base, refund_rules: '24h: 150%' }).success).toBe(false);
    expect(trekSchema.safeParse({ ...base, min_participants_per_booking: '5', max_participants_per_booking: '2' }).success).toBe(false);
  });
  it('trip deadline is read as India time', () => {
    const r = tripSchema.parse({ trek_id: '2b1c1c1e-2b39-4c1e-9f55-3c5a3f0d8b11', trip_date: '2026-11-01', capacity: '20', booking_deadline: '2026-10-31T18:00' });
    expect(r.booking_deadline).toBe('2026-10-31T12:30:00.000Z');
  });
});

describe('contact form', () => {
  it('needs privacy consent and catches the honeypot', () => {
    const ok = { name: 'A B', email: 'a@b.co', subject: 'Hello', message: 'Hello there', privacy: 'on' };
    expect(contactSchema.safeParse(ok).success).toBe(true);
    expect(contactSchema.safeParse({ ...ok, privacy: undefined }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, website: 'http://spam' }).success).toBe(false);
  });
});
