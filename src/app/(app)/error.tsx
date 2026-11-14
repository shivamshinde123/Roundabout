'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto grid max-w-md gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold">Couldn&apos;t load this page</h1>
      <p className="text-sm text-muted-foreground">Something went wrong on our side. Your work is saved.</p>
      <div><Button onClick={reset}>Retry</Button></div>
    </div>
  );
}
