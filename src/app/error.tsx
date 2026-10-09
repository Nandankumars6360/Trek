'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="main" className="container-x max-w-xl py-24 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      <p className="mt-3 text-charcoal-600">Please try again. If it keeps happening, contact us.{error.digest ? ` (ref ${error.digest})` : ''}</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </main>
  );
}
