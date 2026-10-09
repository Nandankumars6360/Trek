// Fires many bookings at the same moment to prove seats can't be oversold
// and that a double-clicked submit creates only one booking.
// Needs: npm i pg   (uses PGHOST/PGPORT/PGUSER env, database trek_test)
import pg from 'pg';

const pool = new pg.Pool({ database: 'trek_test', max: 50 });
const asServer = async (sql, params) => {
  const c = await pool.connect();
  try {
    await c.query("set role service_role; set request.jwt.claims = '{\"role\":\"service_role\"}'");
    return await c.query(sql, params);
  } finally { c.release(); }
};

let failed = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : info}`); if (!ok) failed++; };

const { rows: [trip] } = await pool.query(`
  select t.id, t.capacity from public.scheduled_trips t join public.treks k on k.id = t.trek_id
  where k.slug = 'demo-sunrise-hill' order by trip_date offset 2 limit 1`);

// 1) 45 people race for 30 seats
const attempts = 45;
const results = await Promise.allSettled(Array.from({ length: attempts }, (_, i) =>
  asServer(`select public.create_booking(test.payload($1, $2))`, [trip.id, `race${i}@example.com`])));
const ok = results.filter(r => r.status === 'fulfilled').length;
const full = results.filter(r => r.status === 'rejected' && /NOT_ENOUGH_SEATS/.test(r.reason.message)).length;
const other = results.filter(r => r.status === 'rejected' && !/NOT_ENOUGH_SEATS/.test(r.reason.message));
const { rows: [after] } = await pool.query(`select seats_reserved,
  (select coalesce(sum(participant_count),0) from public.bookings where scheduled_trip_id = $1 and status <> 'cancelled') as counted
  from public.scheduled_trips where id = $1`, [trip.id]);
check(ok === trip.capacity, `${attempts} concurrent bookings -> exactly ${trip.capacity} succeed`, `got ${ok}`);
check(full === attempts - trip.capacity, `the other ${attempts - trip.capacity} get NOT_ENOUGH_SEATS`, `got ${full}; other errors: ${other.map(o => o.reason.message).join(', ')}`);
check(after.seats_reserved === trip.capacity && Number(after.counted) === trip.capacity, 'seat counter matches real bookings', JSON.stringify(after));

// 2) same form submitted 10 times at once (double/triple click, retries)
const { rows: [trip2] } = await pool.query(`
  select t.id from public.scheduled_trips t join public.treks k on k.id = t.trek_id
  where k.slug = 'demo-sunrise-hill' order by trip_date offset 1 limit 1`);
const { rows: [{ p }] } = await pool.query(`select test.payload($1, 'clicker@example.com', 2) as p`, [trip2.id]);
const dup = await Promise.allSettled(Array.from({ length: 10 }, () =>
  asServer(`select public.create_booking($1::jsonb) as r`, [p])));
const refs = new Set(dup.filter(d => d.status === 'fulfilled').map(d => d.value.rows[0].r.reference));
const { rows: [{ n }] } = await pool.query(`select count(*)::int as n from public.bookings where customer_email = 'clicker@example.com'`);
check(dup.every(d => d.status === 'fulfilled'), '10 identical submits all return cleanly',
      dup.filter(d => d.status === 'rejected').map(d => d.reason.message).join(', '));
check(refs.size === 1 && n === 1, 'only one booking created, same reference returned', `refs=${refs.size} rows=${n}`);

await pool.end();
console.log(failed ? `${failed} concurrency check(s) FAILED` : 'concurrency: all passed');
process.exit(failed ? 1 : 0);
