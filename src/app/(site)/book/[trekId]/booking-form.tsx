'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form';
import type { z } from 'zod';
import { Alert, Button, Field, Input, Select, Textarea, cn } from '@/components/ui';
import { Spinner } from '@/components/client-ui';
import { formatDate, formatINR, formatTime } from '@/lib/format';
import { bookingSchema, FOOD_PREFS } from '@/lib/validation';
import { createBookingAction } from './actions';

type In = z.input<typeof bookingSchema>;
type Out = z.output<typeof bookingSchema>;

export type TripOption = { id: string; date: string; reporting: string | null; returnTime: string | null; seatsLeft: number; pricePaise: number };

const FOOD_LABEL: Record<string, string> = { veg: 'Vegetarian', non_veg: 'Non-vegetarian', vegan: 'Vegan', jain: 'Jain' };

export function BookingForm(props: {
  trekName: string; trips: TripOption[]; preselectTrip?: string; minPeople: number; maxPeople: number;
  mealsOffered: boolean; cancellationSummary: string[]; onlineAvailable: boolean; requireApproval: boolean;
  prefill: { name?: string; email?: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'review'>('details');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);   // same key for every retry of this form

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(bookingSchema),
    mode: 'onTouched',
    defaultValues: {
      idempotencyKey, tripId: props.trips.some((t) => t.id === props.preselectTrip) ? props.preselectTrip : props.trips[0]?.id ?? '',
      customerName: props.prefill.name ?? '', customerEmail: props.prefill.email ?? '', customerPhone: '',
      participantCount: props.minPeople, additionalParticipants: Array.from({ length: props.minPeople - 1 }, () => ({ name: '' })),
      emergencyContactName: '', emergencyContactPhone: '', foodPreference: '', safetyNotes: '', specialRequests: '',
      acceptTerms: false as unknown as true, acceptPrivacy: false as unknown as true, paymentMode: 'manual',
    },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'additionalParticipants' });

  const count = Number(watch('participantCount')) || 1;
  const tripId = watch('tripId');
  const trip = props.trips.find((t) => t.id === tripId);
  const maxForTrip = Math.max(props.minPeople, Math.min(props.maxPeople, trip?.seatsLeft ?? props.maxPeople));

  useEffect(() => {        // keep one name field per extra participant
    const need = Math.max(0, count - 1);
    if (fields.length < need) for (let i = fields.length; i < need; i++) append({ name: '' }, { shouldFocus: false });
    if (fields.length > need) for (let i = fields.length - 1; i >= need; i--) remove(i);
  }, [count, fields.length, append, remove]);

  useEffect(() => { if (count > maxForTrip) setValue('participantCount', maxForTrip); }, [maxForTrip, count, setValue]);

  const err = (k: string) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], errors) as { message?: string } | undefined;
  const values = watch();

  async function submit(v: Out) {
    if (step === 'details') { setStep('review'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSubmitting(true); setServerError(null);
    try {
      const res = await createBookingAction({ ...v, idempotencyKey } as In);
      if (!res.ok) {
        setServerError(res.error);
        if (res.fieldErrors) { setStep('details'); for (const [k, m] of Object.entries(res.fieldErrors)) form.setError(k as keyof In, { message: m }); }
        return;
      }
      router.push(`/booking-confirmation/${res.data!.reference}?t=${res.data!.token}&new=1`);
    } catch {
      setServerError('Network problem. Your booking may not be saved yet — press Confirm again (you will not be charged or booked twice).');
    } finally { setSubmitting(false); }
  }

  const onInvalid = (e: FieldErrors<In>) => {
    setStep('details');
    const first = Object.keys(e)[0];
    if (first) document.querySelector<HTMLElement>(`[name^="${first}"]`)?.focus();
  };

  if (!props.trips.length) return <Alert tone="warn">No dates are open for this trek right now.</Alert>;

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} noValidate className="space-y-8">
      <ol className="flex gap-2 text-sm" aria-label="Booking steps">
        {['Your details', 'Review & confirm'].map((s, i) => (
          <li key={s} className={cn('flex-1 rounded-full px-4 py-2 text-center font-semibold',
            (i === 0 && step === 'details') || (i === 1 && step === 'review') ? 'bg-forest-900 text-sand-50' : 'bg-sand-100 text-charcoal-600')}
            aria-current={(i === 0 && step === 'details') || (i === 1 && step === 'review') ? 'step' : undefined}>{i + 1}. {s}</li>
        ))}
      </ol>

      {serverError && <Alert tone="error">{serverError}</Alert>}

      <div className={step === 'details' ? 'space-y-8' : 'hidden'}>
        <fieldset>
          <legend className="font-display text-xl">Trip date</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {props.trips.map((t) => (
              <label key={t.id} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3',
                tripId === t.id ? 'border-forest-700 ring-2 ring-forest-500/20' : 'border-sand-200')}>
                <span className="flex items-center gap-3">
                  <input type="radio" value={t.id} {...register('tripId')} className="accent-forest-700" />
                  <span><span className="block text-sm font-semibold">{formatDate(t.date)}</span>
                    <span className="block text-xs text-charcoal-600">{t.reporting ? `Reporting ${formatTime(t.reporting)}` : ''}{t.returnTime ? ` · back ~${formatTime(t.returnTime)}` : ''}</span></span>
                </span>
                <span className="text-right text-xs"><span className="block font-bold text-forest-950">{formatINR(t.pricePaise)}</span>{t.seatsLeft} left</span>
              </label>
            ))}
          </div>
          {err('tripId')?.message && <p role="alert" className="mt-1 text-xs text-red-700">{err('tripId')!.message}</p>}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-display text-xl sm:col-span-2">Your details</legend>
          <Field label="Full name" htmlFor="customerName" error={err('customerName')?.message} className="sm:col-span-2">
            <Input id="customerName" autoComplete="name" aria-invalid={!!errors.customerName} {...register('customerName')} />
          </Field>
          <Field label="Email" htmlFor="customerEmail" error={err('customerEmail')?.message} hint="Confirmation and trip details are sent here.">
            <Input id="customerEmail" type="email" autoComplete="email" aria-invalid={!!errors.customerEmail} {...register('customerEmail')} />
          </Field>
          <Field label="Mobile number" htmlFor="customerPhone" error={err('customerPhone')?.message} hint="Indian number, +91 is added automatically.">
            <div className="flex">
              <span className="grid place-items-center rounded-l-xl border border-r-0 border-sand-200 bg-sand-100 px-3 text-sm text-charcoal-600">+91</span>
              <Input id="customerPhone" type="tel" inputMode="numeric" autoComplete="tel-national" className="rounded-l-none"
                aria-invalid={!!errors.customerPhone} {...register('customerPhone')} placeholder="98765 43210" />
            </div>
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-xl">Participants</legend>
          <Field label="Number of people (including you)" htmlFor="participantCount" error={err('participantCount')?.message}
            hint={`${props.minPeople}–${maxForTrip} per booking for this date.`}>
            <Select id="participantCount" {...register('participantCount', { valueAsNumber: true })} className="max-w-40">
              {Array.from({ length: maxForTrip - props.minPeople + 1 }, (_, i) => props.minPeople + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          {fields.map((f, i) => (
            <Field key={f.id} label={`Participant ${i + 2} full name`} htmlFor={`p${i}`} error={err(`additionalParticipants.${i}.name`)?.message}>
              <Input id={`p${i}`} aria-invalid={!!errors.additionalParticipants?.[i]?.name} {...register(`additionalParticipants.${i}.name` as const)} />
            </Field>
          ))}
          {err('additionalParticipants')?.message && <p role="alert" className="text-xs text-red-700">{err('additionalParticipants')!.message}</p>}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 font-display text-xl sm:col-span-2">Emergency contact</legend>
          <p className="-mt-1 text-sm text-charcoal-600 sm:col-span-2">Someone not on the trek (e.g. a parent) we can call if something goes wrong.</p>
          <Field label="Name" htmlFor="emergencyContactName" error={err('emergencyContactName')?.message}>
            <Input id="emergencyContactName" aria-invalid={!!errors.emergencyContactName} {...register('emergencyContactName')} />
          </Field>
          <Field label="Mobile number" htmlFor="emergencyContactPhone" error={err('emergencyContactPhone')?.message}>
            <Input id="emergencyContactPhone" type="tel" inputMode="numeric" aria-invalid={!!errors.emergencyContactPhone} {...register('emergencyContactPhone')} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-xl">A few more things</legend>
          {props.mealsOffered && (
            <Field label="Food preference" htmlFor="foodPreference">
              <Select id="foodPreference" {...register('foodPreference')} className="max-w-60">
                <option value="">No preference</option>
                {FOOD_PREFS.map((f) => <option key={f} value={f}>{FOOD_LABEL[f]}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Health or safety information (optional)" htmlFor="safetyNotes" error={err('safetyNotes')?.message}
            hint="Only if the trek leader needs to know (e.g. asthma, a recent injury). Seen only by our trip team and never shared.">
            <Textarea id="safetyNotes" rows={2} {...register('safetyNotes')} />
          </Field>
          <Field label="Special requests (optional)" htmlFor="specialRequests" error={err('specialRequests')?.message}>
            <Textarea id="specialRequests" rows={2} {...register('specialRequests')} />
          </Field>
          {props.onlineAvailable && (
            <div role="radiogroup" aria-label="Payment" className="grid gap-2 sm:grid-cols-2">
              {[['online', 'Pay online now', 'UPI, cards, net banking via Razorpay'], ['manual', 'Pay later', 'Pay by UPI/cash; we confirm after checking']].map(([v, t, d]) => (
                <label key={v} className={cn('cursor-pointer rounded-xl border bg-white p-3', values.paymentMode === v ? 'border-forest-700 ring-2 ring-forest-500/20' : 'border-sand-200')}>
                  <input type="radio" value={v} {...register('paymentMode')} className="mr-2 accent-forest-700" /><b className="text-sm">{t}</b>
                  <span className="block pl-5 text-xs text-charcoal-600">{d}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-xl2 bg-sand-100 p-5">
          <legend className="sr-only">Agreements</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...register('acceptTerms')} className="mt-1 size-4 accent-forest-700" aria-invalid={!!errors.acceptTerms} />
            <span>I accept the <Link href="/terms" target="_blank" className="font-semibold underline">Terms &amp; Conditions</Link> and the <Link href="/cancellation-policy" target="_blank" className="font-semibold underline">Cancellation &amp; Refund Policy</Link>, and I&apos;ll follow the trek leader&apos;s instructions.</span>
          </label>
          {err('acceptTerms')?.message && <p role="alert" className="pl-7 text-xs text-red-700">{err('acceptTerms')!.message}</p>}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...register('acceptPrivacy')} className="mt-1 size-4 accent-forest-700" aria-invalid={!!errors.acceptPrivacy} />
            <span>I agree to the <Link href="/privacy" target="_blank" className="font-semibold underline">Privacy Policy</Link>. My details are used only to organise this trip.</span>
          </label>
          {err('acceptPrivacy')?.message && <p role="alert" className="pl-7 text-xs text-red-700">{err('acceptPrivacy')!.message}</p>}
        </fieldset>

        <Button type="submit" size="lg" className="w-full sm:w-auto">Review booking →</Button>
      </div>

      {step === 'review' && trip && (
        <section aria-labelledby="summary" className="space-y-6">
          <h2 id="summary" className="text-2xl">Booking summary</h2>
          <dl className="divide-y divide-sand-200 rounded-xl2 border border-sand-200 bg-white text-sm">
            {([
              ['Trek', props.trekName],
              ['Date', `${formatDate(trip.date)}${trip.reporting ? ` · reporting ${formatTime(trip.reporting)}` : ''}`],
              ['Booked by', `${values.customerName} · ${values.customerEmail}`],
              ['Participants', [values.customerName, ...(values.additionalParticipants ?? []).map((p) => p.name)].join(', ')],
              ['Price per person', formatINR(trip.pricePaise)],
              ['Total', formatINR(trip.pricePaise * count)],
              ['Payment', values.paymentMode === 'online' ? 'Pay online on the next screen' : 'Unpaid — pay later (instructions on the next screen)'],
              ['Booking status', props.requireApproval || values.paymentMode === 'online' ? 'Pending until confirmed' : 'Confirmed on booking'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-3 px-5 py-3"><dt className="text-charcoal-600">{k}</dt><dd className={cn('col-span-2', k === 'Total' && 'text-lg font-bold text-forest-950')}>{v}</dd></div>
            ))}
          </dl>
          <p className="text-xs text-charcoal-600">The final amount is calculated by our server from the current price.</p>
          {props.cancellationSummary.length > 0 && (
            <div className="rounded-xl2 bg-sand-100 p-5 text-sm">
              <p className="font-semibold">Cancellation terms</p>
              <ul className="mt-2 space-y-1 text-charcoal-600">{props.cancellationSummary.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep('details')} disabled={submitting}>← Edit details</Button>
            <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner />}{submitting ? 'Booking…' : 'Confirm booking'}
            </Button>
          </div>
        </section>
      )}
    </form>
  );
}
