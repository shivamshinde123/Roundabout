'use client';

import Link from 'next/link';
import { Fragment, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ActionForm, type FormState } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type MenuItem =
  | {
      label: string;
      icon?: ReactNode;
      /** A server-action form in a dialog. */
      title: string;
      submitLabel: string;
      action: (state: FormState, form: FormData) => Promise<FormState>;
      body: ReactNode;
      destructive?: boolean;
    }
  | { label: string; icon?: ReactNode; title: string; /** A dialog that manages its own form. */ content: ReactNode; destructive?: boolean }
  | { label: string; icon?: ReactNode; href: string };

const isDestructive = (item: MenuItem) => 'destructive' in item && Boolean(item.destructive);

/**
 * The "⋯" button that holds a view's secondary actions (D-33), each opening its own dialog.
 * Destructive items sit last, after a separator, in red, and their dialog says it can't be undone.
 */
export function ActionMenu({ label, items, className }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      {/* modal={false}: lets the dialog take focus right after the menu closes. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label} className={className}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {items.map((item, i) => {
            const destructive = isDestructive(item);
            const separator = destructive && i > 0 && !isDestructive(items[i - 1]);
            return (
              <Fragment key={item.label}>
                {separator && <DropdownMenuSeparator />}
                {'href' in item ? (
                  <DropdownMenuItem asChild>
                    <Link href={item.href}>{item.icon}{item.label}</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant={destructive ? 'destructive' : 'default'} onSelect={() => setOpen(i)}>
                    {item.icon}{item.label}
                  </DropdownMenuItem>
                )}
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {items.map((item, i) =>
        'href' in item ? null : (
          <Dialog key={item.label} open={open === i} onOpenChange={(o) => !o && close()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{item.title}</DialogTitle>
              </DialogHeader>
              {'content' in item ? item.content : (
                <ActionForm
                  action={item.action}
                  submitLabel={item.submitLabel}
                  submitVariant={item.destructive ? 'destructive' : 'default'}
                  onSuccess={close}
                >
                  {item.body}
                  {item.destructive && <p className="text-sm font-medium">This can&apos;t be undone.</p>}
                </ActionForm>
              )}
            </DialogContent>
          </Dialog>
        ),
      )}
    </>
  );
}
