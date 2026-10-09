import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { AuthForm } from '@/components/site/auth-forms';
import { signupAction } from '../actions';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default function Signup() {
  return (
    <div className="container-x max-w-md py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-3xl">Create an account</h1>
        <p className="mt-2 text-sm text-charcoal-600">Optional — you can book without one. An account lets you see all your bookings in one place.</p>
        <div className="mt-6">
          <AuthForm action={signupAction} submit="Create account" pendingText="Creating…" fields={[
            { name: 'fullName', label: 'Full name', autoComplete: 'name' },
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters.' },
          ]} />
        </div>
        <p className="mt-4 text-sm">Already have an account? <Link href="/login" className="font-semibold text-forest-700 hover:underline">Sign in</Link></p>
      </Card>
    </div>
  );
}
