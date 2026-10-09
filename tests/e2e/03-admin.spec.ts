import { expect, test, type Page } from '@playwright/test';
import { ADMIN, STAFF, adminLogin, q } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('admin access control', () => {
  test('visitors are sent to admin login; API refuses them', async ({ page, request }) => {
    await page.goto('/admin/bookings');
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect((await request.get('/api/admin/export?type=bookings')).status()).toBe(403);
  });

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password-1');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  });

  test('staff can manage bookings but not content or settings', async ({ page }) => {
    await adminLogin(page, STAFF);
    await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Content', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: /^Bookings/ })).toBeVisible();
    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/access-denied/);
  });

  test('repeated failed sign-ins are locked out', async ({ page }) => {
    await page.goto('/admin/login');
    let lockedAt = 0;
    for (let i = 1; i <= 7 && !lockedAt; i++) {
      await page.getByLabel('Email').fill('attacker-target@example.com');
      await page.getByLabel('Password', { exact: true }).fill(`guess-number-${i}`);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('button', { name: 'Signing in…' })).toHaveCount(0);   // request finished
      const msg = page.getByRole('alert').filter({ hasText: /Incorrect email or password\.|Too many attempts/ });
      await expect(msg).toBeVisible();
      if ((await msg.textContent())?.includes('Too many')) lockedAt = i;
    }
    expect(lockedAt).toBe(6);   // 5 tries allowed per account, the 6th is blocked
  });
});

test.describe('admin workflow', () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await adminLogin(page); });   // one sign-in, shared
  test.afterAll(async () => { await page.close(); });

  test('dashboard shows live numbers from the database', async () => {
    await page.goto('/admin/dashboard');
    const [{ n }] = await q<{ n: string }>(`select count(*) n from bookings`);
    await expect(page.locator('a[href="/admin/bookings"]').filter({ hasText: 'Total bookings' })).toContainText(n);
    await expect(page.getByRole('heading', { name: 'Recent bookings' })).toBeVisible();
  });

  test('find a booking, confirm it, record payment, see history', async () => {
    const [b] = await q<{ reference: string; id: string; total_paise: number }>(`select reference, id, total_paise from bookings where customer_email = 'double.click@example.com'`);
    await page.goto('/admin/bookings');
    await page.getByLabel('Search').fill(b.reference);
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByText('1 booking(s)')).toBeVisible();
    await page.getByRole('link', { name: b.reference }).click();
    await expect(page.getByRole('heading', { name: b.reference })).toBeVisible();

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText(/Booking confirmed\./)).toBeVisible();

    await page.getByLabel('Transaction reference').fill('UTR-E2E-1');
    await page.getByRole('button', { name: 'Record payment' }).click();
    // once fully paid the form disappears and the payment shows in the table
    await expect(page.getByRole('cell', { name: 'UTR-E2E-1' })).toBeVisible();

    const [row] = await q<{ status: string; payment_status: string }>(`select status, payment_status from bookings where id = $1`, [b.id]);
    expect(row).toEqual({ status: 'confirmed', payment_status: 'paid' });
    await page.reload();
    await expect(page.getByText('UTR-E2E-1')).toBeVisible();
    await expect(page.locator('section').filter({ hasText: 'History' }).getByText('Confirmed').first()).toBeVisible();
  });

  test('cancellation request is visible and handled', async () => {
    const [b] = await q<{ id: string }>(`select b.id from bookings b join cancellation_requests c on c.booking_id = b.id where c.status = 'open' limit 1`);
    await page.goto(`/admin/bookings/${b.id}`);
    await expect(page.getByText(/Cancellation requested/)).toBeVisible();
    await page.getByPlaceholder('Reason (required for cancel, saved in history)').fill('Customer request approved');
    await page.getByLabel('New status').selectOption('cancelled');
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('This booking is cancelled; no further status changes.')).toBeVisible();
    const [r] = await q<{ status: string }>(`select status from cancellation_requests where booking_id = $1`, [b.id]);
    expect(r.status).toBe('approved');
  });

  test('CSV export contains bookings and is a valid file', async () => {
    const res = await page.request.get('/api/admin/export?type=bookings');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    const csv = await res.text();
    const [b] = await q<{ reference: string }>(`select reference from bookings where customer_email = 'double.click@example.com'`);
    expect(csv.split('\r\n')[0]).toContain('Reference,Booked at,Customer');
    expect(csv).toContain(b.reference);
    expect(csv).not.toContain('Parent Person');   // general export leaves out emergency contacts
    const part = await (await page.request.get('/api/admin/export?type=participants')).text();
    expect(part).toContain('Parent Person');     // trip-day sheet includes them
  });

  test('create a trek and a trip date without touching code', async () => {
    await page.goto('/admin/treks/new');
    await page.getByLabel('Name', { exact: true }).fill('E2E Waterfall Walk');
    await page.getByLabel('URL slug').fill('e2e-waterfall-walk');
    await page.getByLabel('Destination', { exact: true }).fill('Test Falls');
    await page.getByLabel('Price per person (₹)').fill('749');
    await page.getByLabel('Status', { exact: true }).selectOption('published');
    await page.getByLabel('Refund rules').fill('48h: 100%');
    await page.getByRole('button', { name: 'Create trek' }).click();
    await page.waitForURL(/\/admin\/treks\/.+\/edit\?created=1/);

    await page.locator('#main').getByRole('link', { name: 'Trip dates' }).click();
    await page.waitForURL(/\/admin\/trips\?trek=/);
    const date = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    await page.getByLabel('Date', { exact: true }).first().fill(date);
    await page.getByLabel('Seats (capacity)').first().fill('12');
    await page.getByRole('button', { name: 'Add date' }).click();
    await expect(page.getByText('Trip date added.')).toBeVisible();

    await page.goto('/treks/e2e-waterfall-walk');
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Waterfall Walk' })).toBeVisible();
    await expect(page.getByText('12 seats left · ₹749')).toBeVisible();
  });

  test('bad refund rules are rejected with a clear message', async () => {
    const [t] = await q<{ id: string }>(`select id from treks where slug = 'e2e-waterfall-walk'`);
    await page.goto(`/admin/treks/${t.id}/edit`);
    await page.getByLabel('Refund rules').fill('whenever: lots');
    await page.getByRole('button', { name: 'Save trek' }).click();
    await expect(page.getByText(/Bad refund rule "whenever: lots"/)).toBeVisible();
  });

  test('reports and customers pages show real data', async () => {
    await page.goto('/admin/reports');
    await expect(page.locator('section').filter({ hasText: 'By trek' }).getByText('[DEMO] Sunrise Hill Trek')).toBeVisible();
    await page.goto('/admin/customers?q=asha');
    await expect(page.getByText('asha.guest@example.com')).toBeVisible();
    await page.goto('/admin/messages');
    await expect(page.getByText('Group booking')).toBeVisible();
  });

  test('scheduled job requires the cron secret', async ({ request }) => {
    expect((await request.get('/api/cron/daily')).status()).toBe(401);
    const ok = await request.get('/api/cron/daily', { headers: { Authorization: `Bearer ${process.env.E2E_CRON_SECRET ?? 'e2e-cron-secret'}` } });
    expect(ok.status()).toBe(200);
  });
});
