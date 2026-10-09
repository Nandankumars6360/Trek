import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { AuthForm } from '@/components/site/auth-forms';
import { guestLookupAction, loginAction } from '../actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container-x grid max-w-5xl gap-8 py-12 md:grid-cols-2">
      <Card className="p-6 sm:p-8">
        <h1 className="text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-charcoal-600">See your bookings and trip instructions.</p>
        <div className="mt-6">
          <AuthForm action={loginAction} submit="Sign in" pendingText="Signing in…" hidden={{ next: next ?? '/my-bookings' }}
            fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }, { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }]} />
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-forest-700 hover:underline">Forgot password?</Link>
          <Link href="/signup" className="font-semibold text-forest-700 hover:underline">Create account</Link>
        </div>
      </Card>
      <Card className="bg-sand-100 p-6 sm:p-8">
        <h2 className="text-2xl">Booked as a guest?</h2>
        <p className="mt-2 text-sm text-charcoal-600">Enter your booking reference and email. We&apos;ll send the secure booking link to that email.</p>
        <div className="mt-6">
          <AuthForm action={guestLookupAction} submit="Email me my booking link" pendingText="Checking…"
            fields={[{ name: 'reference', label: 'Booking reference', autoComplete: 'off', hint: 'Looks like TRK-7K3QX9MZ2A' }, { name: 'email', label: 'Email used for booking', type: 'email', autoComplete: 'email' }]} />
        </div>
      </Card>
    </div>
  );
}
