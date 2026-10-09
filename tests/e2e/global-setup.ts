import pg from 'pg';
import { ADMIN, STAFF } from './helpers';

// Creates the test owner + staff accounts through the real Auth admin API,
// then grants admin roles directly in the database (the only way to become admin).
export default async function globalSetup() {
  const url = process.env.E2E_SUPABASE_URL ?? 'http://localhost:54321';
  const key = process.env.E2E_SERVICE_KEY;
  if (!key) throw new Error('Set E2E_SERVICE_KEY (service role key of the TEST stack)');
  const pool = new pg.Pool({ database: process.env.E2E_DB ?? 'trek_e2e' });
  for (const [who, role] of [[ADMIN, 'owner'], [STAFF, 'staff']] as const) {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: who.email, password: who.password, email_confirm: true }),
    });
    if (!res.ok && res.status !== 422) throw new Error(`could not create ${who.email}: ${res.status} ${await res.text()}`);
    await pool.query(`insert into public.admin_users (user_id, role) select id, $2 from auth.users where email = $1 on conflict (user_id) do update set role = excluded.role, is_active = true`, [who.email, role]);
  }
  await pool.query(`delete from public.rate_limits`);
  await pool.end();
}
