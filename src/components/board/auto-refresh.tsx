'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Re-render server data every ~10 s and when the window regains focus (D-8). */
export function AutoRefresh({ everyMs = 10_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = window.setInterval(tick, everyMs);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [router, everyMs]);
  return null;
}
