import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    </div>
  );
}
