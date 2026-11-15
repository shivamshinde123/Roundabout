import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted-foreground">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Button asChild className="mt-6"><Link href="/">Back to your projects</Link></Button>
    </main>
  );
}
