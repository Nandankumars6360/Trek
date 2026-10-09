import { z } from 'zod';

// Indian mobile: accepts 9876543210, 09876543210, +91 98765 43210 → "+919876543210"
export function normalizeIndianPhone(input: string) {
  const digits = input.replace(/[^\d+]/g, '').replace(/^\+?91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export const phoneSchema = z.string().trim().transform((v, ctx) => {
  const p = normalizeIndianPhone(v);
  if (!p) { ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number' }); return z.NEVER; }
  return p;
});

const name = z.string().trim().min(2, 'Enter at least 2 characters').max(120, 'Too long');
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(200);

export const FOOD_PREFS = ['veg', 'non_veg', 'vegan', 'jain'] as const;

export const bookingSchema = z.object({
  idempotencyKey: z.string().uuid(),
  tripId: z.string().uuid('Choose a trip date'),
  customerName: name,
  customerEmail: email,
  customerPhone: phoneSchema,
  participantCount: z.coerce.number().int().min(1).max(20),
  additionalParticipants: z.array(z.object({ name })).max(19),
  emergencyContactName: name,
  emergencyContactPhone: phoneSchema,
  foodPreference: z.enum(FOOD_PREFS).optional().or(z.literal('').transform(() => undefined)),
  safetyNotes: z.string().trim().max(1000).optional(),
  specialRequests: z.string().trim().max(1000).optional(),
  acceptTerms: z.literal(true, { message: 'Please accept the terms and cancellation policy' }),
  acceptPrivacy: z.literal(true, { message: 'Please accept the privacy policy' }),
  paymentMode: z.enum(['manual', 'online']).default('manual'),
}).superRefine((v, ctx) => {
  if (v.additionalParticipants.length !== v.participantCount - 1) {
    ctx.addIssue({ code: 'custom', path: ['additionalParticipants'], message: 'Add a name for every extra participant' });
  }
  if (v.emergencyContactPhone === v.customerPhone) {
    ctx.addIssue({ code: 'custom', path: ['emergencyContactPhone'], message: 'Emergency contact must be a different number' });
  }
});
export type BookingInput = z.input<typeof bookingSchema>;

export const contactSchema = z.object({
  name, email,
  phone: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return undefined;
    const p = normalizeIndianPhone(v);
    if (!p) { ctx.addIssue({ code: 'custom', message: 'Enter a valid Indian mobile number' }); return z.NEVER; }
    return p;
  }),
  subject: z.string().trim().min(2, 'Add a subject').max(200),
  message: z.string().trim().min(5, 'Message is too short').max(4000),
  privacy: z.literal('on', { message: 'Please accept the privacy policy' }),
  website: z.string().max(0).optional(), // honeypot: bots fill it, people don't see it
});

export const loginSchema = z.object({
  email,
  password: z.string().min(8, 'At least 8 characters').max(200),
});

export const signupSchema = loginSchema.extend({
  fullName: name,
});

export const guestLookupSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^TRK-[0-9A-Z]{10}$/, 'Reference looks like TRK-XXXXXXXXXX'),
  email,
});

const lines = z.string().optional().transform((v) => (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean));
const optText = z.string().trim().optional().transform((v) => (v ? v : null));
const optNum = (min = 0) => z.string().trim().optional().transform((v, ctx) => {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) { ctx.addIssue({ code: 'custom', message: 'Enter a valid number' }); return z.NEVER; }
  return n;
});
const optTime = z.string().trim().optional().transform((v, ctx) => {
  if (!v) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(v)) { ctx.addIssue({ code: 'custom', message: 'Use HH:MM' }); return z.NEVER; }
  return v.slice(0, 5);
});
const rupees = z.string().trim().transform((v, ctx) => {
  const n = Number(v.replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) { ctx.addIssue({ code: 'custom', message: 'Enter a price in rupees' }); return z.NEVER; }
  return Math.round(n * 100);
});

export const trekSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only'),
  destination: z.string().trim().min(2).max(160),
  region: optText,
  short_description: z.string().trim().max(300).optional().transform((v) => v || null),
  description: optText,
  difficulty: z.enum(['easy', 'moderate', 'difficult']),
  distance_km: optNum(0.1),
  duration_hours: optNum(0.5),
  elevation_m: optNum(0),
  price_paise: rupees,
  inclusions: lines, exclusions: lines, things_to_carry: lines,
  itinerary: lines.transform((arr) => arr.map((line) => {
    const [time, ...rest] = line.split('|');
    return rest.length ? { time: time.trim(), title: rest.join('|').trim() } : { time: '', title: line };
  })),
  fitness_guidance: optText, min_age: optNum(0), safety_info: optText, weather_info: optText,
  meeting_point: optText,
  meeting_point_map_url: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return null;
    if (!/^https:\/\//.test(v)) { ctx.addIssue({ code: 'custom', message: 'Must start with https://' }); return z.NEVER; }
    return v;
  }),
  default_reporting_time: optTime, default_return_time: optTime,
  leader_name: optText, leader_bio: optText,
  meals_offered: z.string().optional().transform((v) => v === 'on'),
  is_featured: z.string().optional().transform((v) => v === 'on'),
  cancellation_policy: optText,
  refund_rules: lines.transform((arr, ctx) => arr.map((line) => {
    const m = line.match(/^(\d+)\s*h\s*[:=]\s*(\d{1,3})\s*%?$/i);
    if (!m || Number(m[2]) > 100) { ctx.addIssue({ code: 'custom', message: `Bad refund rule "${line}". Use e.g. 72h: 100%` }); return { hours_before: 0, refund_percent: 0 }; }
    return { hours_before: Number(m[1]), refund_percent: Number(m[2]) };
  })),
  min_participants_per_booking: z.coerce.number().int().min(1).max(20),
  max_participants_per_booking: z.coerce.number().int().min(1).max(20),
  status: z.enum(['draft', 'published', 'archived']),
}).refine((v) => v.min_participants_per_booking <= v.max_participants_per_booking, {
  path: ['max_participants_per_booking'], message: 'Max must be at least the minimum',
});

export const tripSchema = z.object({
  trek_id: z.string().uuid(),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  reporting_time: optTime, return_time: optTime,
  meeting_point: optText,
  capacity: z.coerce.number().int().min(1).max(500),
  price_override_paise: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/[,₹\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) { ctx.addIssue({ code: 'custom', message: 'Enter a price in rupees' }); return z.NEVER; }
    return Math.round(n * 100);
  }),
  booking_deadline: z.string().trim().optional().transform((v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null)),
  notes: optText,
});

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
