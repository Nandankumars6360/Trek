import { expect, test } from '@playwright/test';
import { db, fillBooking, q, trekId } from './helpers';

test.describe.configure({ mode: 'serial' });

let reference = '';
let confirmationUrl = '';

test.describe('guest booking', () => {
  test('validates, shows a server-priced summary, and saves to the database', async ({ page }) => {
    const id = await trekId('demo-sunrise-hill');
    await page.goto(`/book/${id}`);

    // empty submit → errors, nothing saved
    await page.getByRole('button', { name: 'Review booking →' }).click();
    await expect(page.getByText('Enter at least 2 characters').first()).toBeVisible();
    await expect(page.getByText('Please accept the terms and cancellation policy')).toBeVisible();

    await fillBooking(page, { name: 'Asha Guest', email: 'asha.guest@example.com', phone: '+91 98765 43210', people: 2, extra: ['Ravi Friend'] });
    await page.getByRole('button', { name: 'Review booking →' }).click();

    const summary = page.locator('section[aria-labelledby="summary"]');
    await expect(summary.getByText('₹1,798')).toBeVisible();          // 2 × ₹899 from the DB price
    await expect(summary.getByText('Asha Guest, Ravi Friend')).toBeVisible();
    await expect(summary.getByText(/Unpaid — pay later/)).toBeVisible();
    await expect(summary.getByText(/72\+ hours before reporting: 100% refund/)).toBeVisible();

    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await page.waitForURL(/\/booking-confirmation\/TRK-[0-9A-Z]{10}\?t=/);
    confirmationUrl = page.url();
    reference = confirmationUrl.match(/TRK-[0-9A-Z]{10}/)![0];

    await expect(page.getByText('Booking saved!')).toBeVisible();
    await expect(page.getByRole('heading', { name: reference })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.getByText('Unpaid', { exact: true })).toBeVisible();

    const [row] = await q<{ total_paise: number; customer_phone: string; status: string; payment_status: string; n: string }>(
      `select b.total_paise, b.customer_phone, b.status, b.payment_status, (select count(*) from participants p where p.booking_id = b.id) n
       from bookings b where reference = $1`, [reference]);
    expect(row).toMatchObject({ total_paise: 179800, customer_phone: '+919876543210', status: 'pending', payment_status: 'unpaid', n: '2' });
  });

  test('email is logged honestly (not "sent" while sending is off)', async () => {
    await expect.poll(async () => (await q<{ status: string }>(
      `select e.status from email_log e join bookings b on b.id = e.booking_id where b.reference = $1 and e.template = 'booking_received'`, [reference]))[0]?.status,
    { timeout: 10_000 }).toBe('skipped');
  });

  test('booking page needs the secret link', async ({ page }) => {
    expect((await page.goto(`/booking-confirmation/${reference}`))!.status()).toBe(404);
    expect((await page.goto(`/booking-confirmation/${reference}?t=00000000-0000-4000-8000-000000000000`))!.status()).toBe(404);
    expect((await page.goto(`/booking-confirmation/TRK-AAAAAAAAAA?t=${new URL(confirmationUrl).searchParams.get('t')}`))!.status()).toBe(404);
    expect((await page.goto(confirmationUrl))!.status()).toBe(200);
  });

  test('double-clicking confirm creates only one booking', async ({ page }) => {
    await page.goto(`/book/${await trekId('demo-sunrise-hill')}`);
    await fillBooking(page, { name: 'Double Clicker', email: 'double.click@example.com' });
    await page.getByRole('button', { name: 'Review booking →' }).click();
    await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeEnabled();
    // three clicks in the same instant, before the button can disable itself
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Confirm booking'))!;
      b.click(); b.click(); b.click();
    });
    await page.waitForURL(/booking-confirmation/);
    const [{ n }] = await q<{ n: string }>(`select count(*) n from bookings where customer_email = 'double.click@example.com'`);
    expect(n).toBe('1');
  });

  test('same person cannot book the same date twice', async ({ page }) => {
    await page.goto(`/book/${await trekId('demo-sunrise-hill')}`);
    await fillBooking(page, { name: 'Asha Again', email: 'asha.guest@example.com' });
    await page.getByRole('button', { name: 'Review booking →' }).click();
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByText('You already have a booking for this date with this email.')).toBeVisible();
  });

  test('seats taken while the form is open → clear error, no overbooking', async ({ page }) => {
    const id = await trekId('demo-forest-ridge');
    const [trip] = await q<{ id: string }>(`select id from scheduled_trips where trek_id = $1 order by trip_date limit 1`, [id]);
    await q(`update scheduled_trips set capacity = 3 where id = $1`, [trip.id]);
    await page.goto(`/book/${id}?trip=${trip.id}`);
    await fillBooking(page, { name: 'Late Larry', email: 'late.larry@example.com', people: 3 });
    await page.getByRole('button', { name: 'Review booking →' }).click();

    // someone else grabs 2 seats first (through the real booking engine)
    await db().query(`set role service_role; select public.create_booking(jsonb_build_object(
      'idempotency_key', gen_random_uuid(), 'scheduled_trip_id', $1::uuid, 'customer_name', 'Fast Fiona', 'customer_email', 'fast@example.com',
      'customer_phone', '+919811111111', 'participant_count', 2, 'additional_participants', '["Fiona Friend"]'::jsonb,
      'emergency_contact_name', 'Mum', 'emergency_contact_phone', '+919822222222', 'terms_accepted', true, 'privacy_accepted', true)); reset role;`.replace(/\$1/g, `'${trip.id}'`));

    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByText(/Not enough seats left on this date. \(1 seat\(s\) left\)/)).toBeVisible();
    const [s] = await q<{ seats_reserved: number; capacity: number }>(`select seats_reserved, capacity from scheduled_trips where id = $1`, [trip.id]);
    expect(s.seats_reserved).toBeLessThanOrEqual(s.capacity);
  });

  test('guest can request cancellation from the booking page', async ({ page }) => {
    await page.goto(confirmationUrl);
    await page.getByLabel('Reason for cancelling').fill('Exam got rescheduled');
    await page.getByRole('button', { name: 'Request cancellation' }).click();
    await expect(page.getByText(/Cancellation request sent|cancellation request is being reviewed/)).toBeVisible();
    const [r] = await q<{ status: string }>(`select c.status from cancellation_requests c join bookings b on b.id = c.booking_id where b.reference = $1`, [reference]);
    expect(r.status).toBe('open');
  });

  test('guest lookup never reveals the booking, it emails the link', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Booking reference').fill(reference);
    await page.getByLabel('Email used for booking').fill('wrong@example.com');
    await page.getByRole('button', { name: 'Email me my booking link' }).click();
    await expect(page.getByText(/If that reference matches the email/)).toBeVisible();
    await expect(page.getByText(reference)).toHaveCount(0);
  });
});

test.describe('customer account', () => {
  test('signing up claims earlier guest bookings; other customers cannot see them', async ({ page, browser }) => {
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Asha Guest');
    await page.getByLabel('Email').fill('asha.guest@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Asha-Pass-123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL('**/my-bookings');
    await expect(page.getByText(reference)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trip instructions' }).first()).toBeVisible();

    // a different signed-in customer
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await other.goto('/signup');
    await other.getByLabel('Full name').fill('Other Person');
    await other.getByLabel('Email').fill('other.person@example.com');
    await other.getByLabel('Password', { exact: true }).fill('Other-Pass-123!');
    await other.getByRole('button', { name: 'Create account' }).click();
    await other.waitForURL('**/my-bookings');
    await expect(other.getByText(reference)).toHaveCount(0);
    expect((await other.goto(`/booking-confirmation/${reference}`))!.status()).toBe(404);
    // customers are not admins
    await other.goto('/admin/dashboard');
    await expect(other).toHaveURL(/access-denied/);
    expect((await other.request.get('/api/admin/export?type=bookings')).status()).toBe(403);
    await ctx.close();
  });
});
