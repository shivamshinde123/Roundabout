import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** "Agents › Claude Code" trail for detail pages, replacing bare "← Back" text links (D-37). */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const parent = [...items].reverse().find((i) => i.href);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {parent && (
        <Link
          href={parent.href!}
          aria-label={`Back to ${parent.label}`}
          className="mr-1 inline-flex size-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:border-[#3a3a40] hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
      )}
      <ol className="flex min-w-0 items-center gap-1">
        {items.map((item, i) => (
          <li key={item.label} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />}
            {item.href ? (
              <Link href={item.href} className="rounded px-1 text-muted-foreground hover:bg-accent hover:text-foreground">{item.label}</Link>
            ) : (
              <span aria-current="page" className="truncate px-1 font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
