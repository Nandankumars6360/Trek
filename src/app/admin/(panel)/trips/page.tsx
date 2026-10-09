import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { PageHeader, Section, Table, Td } from '@/components/admin/admin-ui';
import { Badge, Field, Input, Select, buttonClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatINR, formatTime, paiseToRupees, todayIST } from '@/lib/format';
import { cancelTripAction, completeTripAction, createTripAction, updateTripAction } from './actions';

export const metadata: Metadata = { title: 'Trip dates' };

type Trip = {
  id: string; trek_id: string; trip_date: string; reporting_time: string | null; return_time: string | null; meeting_point: string | null;
  capacity: number; seats_reserved: number; price_override_paise: number | null; booking_deadline: string | null; status: string; notes: string | null;
  treks: { name: string; price_paise: number; default_reporting_time: string | null };
};

const toLocal = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T') : '');

function TripFields({ t, trekId }: { t?: Trip; trekId?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="trek_id" value={t?.trek_id ?? trekId} />
      <Field label="Date" htmlFor={`d-${t?.id ?? 'new'}`}><Input id={`d-${t?.id ?? 'new'}`} type="date" name="trip_date" defaultValue={t?.trip_date} required /></Field>
      <Field label="Seats (capacity)" htmlFor={`c-${t?.id ?? 'new'}`}><Input id={`c-${t?.id ?? 'new'}`} type="number" name="capacity" min={t ? Math.max(1, t.seats_reserved) : 1} max={500} defaultValue={t?.capacity ?? 25} required /></Field>
      <Field label="Reporting time" htmlFor={`r-${t?.id ?? 'new'}`} hint="Blank = trek default"><Input id={`r-${t?.id ?? 'new'}`} type="time" name="reporting_time" defaultValue={t?.reporting_time?.slice(0, 5) ?? ''} /></Field>
      <Field label="Return time" htmlFor={`rt-${t?.id ?? 'new'}`}><Input id={`rt-${t?.id ?? 'new'}`} type="time" name="return_time" defaultValue={t?.return_time?.slice(0, 5) ?? ''} /></Field>
      <Field label="Price override (₹)" htmlFor={`p-${t?.id ?? 'new'}`} hint="Blank = trek price"><Input id={`p-${t?.id ?? 'new'}`} name="price_override_paise" inputMode="decimal" defaultValue={paiseToRupees(t?.price_override_paise)} /></Field>
      <Field label="Booking deadline (IST)" htmlFor={`dl-${t?.id ?? 'new'}`} hint="Blank = 12 h before reporting"><Input id={`dl-${t?.id ?? 'new'}`} type="datetime-local" name="booking_deadline" defaultValue={toLocal(t?.booking_deadline ?? null)} /></Field>
      <Field label="Meeting point override" htmlFor={`m-${t?.id ?? 'new'}`} className="lg:col-span-2"><Input id={`m-${t?.id ?? 'new'}`} name="meeting_point" defaultValue={t?.meeting_point ?? ''} /></Field>
      <Field label="Internal notes" htmlFor={`n-${t?.id ?? 'new'}`} className="sm:col-span-2 lg:col-span-4"><Input id={`n-${t?.id ?? 'new'}`} name="notes" defaultValue={t?.notes ?? ''} /></Field>
    </div>
  );
}

export default async function Trips({ searchParams }: { searchParams: Promise<{ trek?: string; show?: string }> }) {
  const { supabase, role } = await requireAdmin();
  const { trek, show } = await searchParams;
  const today = todayIST();
  let q = supabase.from('scheduled_trips').select('*, treks(name, price_paise, default_reporting_time)');
  if (trek && /^[0-9a-f-]{36}$/.test(trek)) q = q.eq('trek_id', trek);
  q = show === 'past' ? q.lt('trip_date', today).order('trip_date', { ascending: false }) : q.gte('trip_date', today).order('trip_date');
  const [{ data }, { data: treks }] = await Promise.all([q.limit(200), supabase.from('treks').select('id, name, status').neq('status', 'archived').order('name')]);
  const trips = (data ?? []) as Trip[];
  const manager = role !== 'staff';

  return (
    <>
      <PageHeader title="Trip dates">
        <a href={`/api/admin/export?type=trips${trek ? `&trek=${trek}` : ''}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Export CSV</a>
      </PageHeader>
      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <Select name="trek" defaultValue={trek ?? ''} className="w-64" aria-label="Trek"><option value="">All treks</option>{(treks ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select name="show" defaultValue={show ?? ''} className="w-40" aria-label="When"><option value="">Upcoming</option><option value="past">Past</option></Select>
        <button className={buttonClass({ variant: 'secondary', size: 'sm' })}>Show</button>
      </form>

      {manager && (
        <Section title="Add a trip date">
          {trek ? (
            <ActionForm action={createTripAction} submit="Add date" variant="forest" resetOnSuccess><TripFields trekId={trek} /></ActionForm>
          ) : (
            <form method="get" className="flex flex-wrap items-end gap-2">
              <Select name="trek" required className="w-72" aria-label="Choose trek"><option value="">Choose a trek first…</option>{(treks ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.status === 'draft' ? ' (draft)' : ''}</option>)}</Select>
              <button className={buttonClass({ variant: 'forest', size: 'sm' })}>Continue</button>
            </form>
          )}
        </Section>
      )}

      <div className="mt-6">
        <Table head={['Date', 'Trek', 'Seats', 'Price', 'Deadline', 'Status', '']} empty={!trips.length}>
          {trips.map((t) => {
            const left = t.capacity - t.seats_reserved;
            return (
              <tr key={t.id} className="align-top">
                <Td className="whitespace-nowrap font-semibold">{formatDate(t.trip_date)}<div className="text-xs font-normal text-charcoal-600">{formatTime(t.reporting_time ?? t.treks.default_reporting_time) ?? 'time TBC'}</div></Td>
                <Td>{t.treks.name}</Td>
                <Td><b>{t.seats_reserved}</b> / {t.capacity}<div className="text-xs text-charcoal-600">{left} left</div></Td>
                <Td>{formatINR(t.price_override_paise ?? t.treks.price_paise)}{t.price_override_paise != null && <div className="text-xs text-clay-600">override</div>}</Td>
                <Td className="text-xs">{t.booking_deadline ? new Date(t.booking_deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'default'}</Td>
                <Td><Badge value={t.status === 'scheduled' && left <= 0 ? 'full' : t.status} /></Td>
                <Td className="min-w-48 space-y-1">
                  <Link href={`/admin/bookings?trek=${t.trek_id}&date=${t.trip_date}`} className="block text-sm font-semibold text-forest-700 hover:underline">Registrations</Link>
                  <a href={`/api/admin/export?type=participants&trek=${t.trek_id}&date=${t.trip_date}&status=confirmed`} className="block text-sm text-forest-700 hover:underline">Participant list CSV</a>
                  {t.status === 'scheduled' && (
                    <details>
                      <summary className="cursor-pointer text-sm text-forest-700">Edit / close</summary>
                      <div className="mt-3 w-[min(80vw,720px)] space-y-4 rounded-xl border border-sand-200 bg-sand-50 p-4">
                        {manager && (
                          <ActionForm action={updateTripAction} submit="Save changes" variant="forest">
                            <input type="hidden" name="id" value={t.id} />
                            <TripFields t={t} />
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-forest-700" /> Email participants if date, time or meeting point changes</label>
                          </ActionForm>
                        )}
                        {t.trip_date <= today && (
                          <ActionForm action={completeTripAction} submit="Mark trip completed" variant="secondary" confirm="Mark all confirmed bookings completed?"><input type="hidden" name="id" value={t.id} /></ActionForm>
                        )}
                        {manager && (
                          <ActionForm action={cancelTripAction} submit="Cancel trip" variant="danger" confirm="Cancel this trip and every booking on it? Participants will be emailed." inline>
                            <input type="hidden" name="id" value={t.id} />
                            <Input name="reason" placeholder="Reason (emailed to participants)" className="w-72" />
                          </ActionForm>
                        )}
                      </div>
                    </details>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}
