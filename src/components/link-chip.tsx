import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

/** Shared look for links that aren't buttons (D-39): a quiet bordered chip instead of underlined text. */
export const chipClass =
  'inline-flex max-w-full items-center gap-1 truncate rounded-md border bg-muted px-1.5 py-0.5 align-middle text-xs text-foreground transition-colors hover:border-primary/60';

/** A link that leaves Roundabout (a PR, a doc), marked with an external-link icon. */
export function ExternalChip({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={chipClass}>
      <ExternalLink aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A link to a task inside Roundabout. */
export function TaskChip({ href, title }: { href: string; title: string }) {
  return <Link href={href} className={chipClass}><span className="truncate">{title}</span></Link>;
}

/** In-sentence link on the auth pages: accent colour, underline only on hover. */
export const textLinkClass = 'font-medium text-[#a5adf0] hover:text-white hover:underline';
