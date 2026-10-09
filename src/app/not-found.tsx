import Link from 'next/link';
import { buttonClass } from '@/components/ui';
import { MountainScene } from '@/components/site/mountains';

export default function NotFound() {
  return (
    <main id="main" className="relative grid min-h-[80vh] place-items-center overflow-hidden px-4 text-center">
      <MountainScene className="absolute inset-0 -z-10 size-full opacity-70" />
      <div className="rounded-xl2 bg-sand-50/90 p-8 backdrop-blur">
        <p className="text-sm font-bold uppercase tracking-widest text-clay-600">404</p>
        <h1 className="mt-2 text-4xl">This trail doesn&apos;t exist</h1>
        <p className="mt-3 text-charcoal-600">The page may have moved, or the link is incomplete.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className={buttonClass()}>Home</Link>
          <Link href="/treks" className={buttonClass({ variant: 'secondary' })}>Explore treks</Link>
        </div>
      </div>
    </main>
  );
}
