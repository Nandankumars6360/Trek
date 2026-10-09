import pg from 'pg';
import type { Page } from '@playwright/test';

export const ADMIN = { email: 'e2e-owner@example.com', password: 'Owner-Pass-123!' };
export const STAFF = { email: 'e2e-staff@example.com', password: 'Staff-Pass-123!' };

let pool: pg.Pool | null = null;
/** Direct DB access for assertions (as the database owner). */
export function db() {
  pool ??= new pg.Pool({ database: process.env.E2E_DB ?? 'trek_e2e', max: 3 });
  return pool;
}
export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db().query(sql, params)).rows as T[];
}

export async function trekId(slug: string) {
  return (await q<{ id: string }>('select id from public.treks where slug = $1', [slug]))[0].id;
}

/** Fills the public booking form (step 1). */
export async function fillBooking(page: Page, o: { name: string; email: string; phone?: string; people?: number; extra?: string[] }) {
  await page.getByLabel('Full name', { exact: true }).fill(o.name);
  await page.getByLabel('Email').fill(o.email);
  await page.getByLabel('Mobile number').first().fill(o.phone ?? '9876543210');
  if (o.people && o.people > 1) {
    await page.getByLabel('Number of people (including you)').selectOption(String(o.people));
    for (let i = 0; i < o.people - 1; i++) await page.getByLabel(`Participant ${i + 2} full name`).fill(o.extra?.[i] ?? `Friend ${i + 1}`);
  }
  await page.locator('#emergencyContactName').fill('Parent Person');
  await page.locator('#emergencyContactPhone').fill('9812345678');
  await page.locator('input[name="acceptTerms"]').check();
  await page.locator('input[name="acceptPrivacy"]').check();
}

export async function adminLogin(page: Page, who = ADMIN) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/admin/dashboard');
}
