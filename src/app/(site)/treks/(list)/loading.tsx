import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="container-x py-12" aria-busy="true" aria-label="Loading treks">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="mt-8 h-32 w-full" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96" />)}
      </div>
    </div>
  );
}
