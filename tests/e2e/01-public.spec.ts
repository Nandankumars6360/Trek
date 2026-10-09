import { expect, test } from '@playwright/test';

test.describe('public site', () => {
  test('home page shows real trips from the database', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your Next Adventure Starts Here.');
    await expect(page.getByText(/trip dates? open for booking/)).toBeVisible();
    await expect(page.locator('#upcoming').getByRole('link', { name: '[DEMO] Sunrise Hill Trek' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book Your Trek' }).first()).toBeVisible();
    // no invented reviews: testimonials are off by default
    await expect(page.getByText('What people said')).toHaveCount(0);
  });

  test('trek listing filters, search, empty state and clear', async ({ page }) => {
    await page.goto('/treks');
    await expect(page.getByText('2 treks found')).toBeVisible();
    await page.getByLabel('Difficulty').selectOption('moderate');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/difficulty=moderate/);
    await expect(page.getByText('1 trek found')).toBeVisible();
    await expect(page.getByRole('heading', { name: '[DEMO] Forest Ridge Trek' })).toBeVisible();

    await page.goto('/treks?q=nothing-matches-this');
    await expect(page.getByText('No treks match these filters')).toBeVisible();
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await page.waitForURL(/\/treks$/);
    await expect(page.getByText('2 treks found')).toBeVisible({ timeout: 10_000 });

    await page.goto('/treks?max=900&sort=price_asc');
    await expect(page.getByText('1 trek found')).toBeVisible();
  });

  test('trek detail page has dates, booking button and structured data', async ({ page }) => {
    await page.goto('/treks/demo-sunrise-hill');
    await expect(page.getByRole('heading', { level: 1, name: '[DEMO] Sunrise Hill Trek' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Upcoming dates' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register for This Trek' })).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)['@type']).toBe('TouristTrip');
  });

  test('unknown trek and page return 404', async ({ page }) => {
    expect((await page.goto('/treks/does-not-exist'))!.status()).toBe(404);
    expect((await page.goto('/totally-unknown'))!.status()).toBe(404);
  });

  test('contact form validates and saves', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Please fix the highlighted fields.')).toBeVisible();
    await page.getByLabel('Name').fill('E2E Visitor');
    await page.getByLabel('Email').fill('visitor@example.com');
    await page.getByLabel('Subject').fill('Group booking');
    await page.getByLabel('Message').fill('Can 20 of us come together?');
    await page.locator('input[name="privacy"]').check();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(/Your message has been sent/)).toBeVisible();
  });

  test('mobile menu opens and links work', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Explore Treks' }).click();
    await expect(page).toHaveURL(/\/treks$/);
  });

  test('search engines are kept out of private pages', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    for (const p of ['/admin', '/my-bookings', '/booking-confirmation']) expect(robots).toContain(`Disallow: ${p}`);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/treks/demo-sunrise-hill');
    expect(sitemap).not.toContain('/admin');
    const home = await request.get('/');
    expect(home.headers()['x-frame-options']).toBe('DENY');
    expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});
