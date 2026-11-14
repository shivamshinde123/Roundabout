'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Close control for the task panel; Esc also closes it and returns focus to the card's link. */
export function ClosePanel({ taskId }: { taskId: string }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
      router.push(path, { scroll: false });
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-link="${taskId}"]`)?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, path, taskId]);
  return (
    <Link href={path} scroll={false} aria-label="Close task" className="rounded p-1 hover:bg-muted">
      <X className="size-4" aria-hidden />
    </Link>
  );
}
