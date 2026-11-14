import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Link } from '@/server/db/schema';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export type TaskFieldValues = {
  title?: string;
  instructions?: string;
  expectedResult?: string;
  links?: Link[];
  repository?: string | null;
  branch?: string | null;
  requireReview?: boolean;
};

/** Shared create/edit fields. Links are one per line: "label | https://…" or a bare URL. */
export function TaskFields({ values = {}, prefix }: { values?: TaskFieldValues; prefix: string }) {
  const id = (n: string) => `${prefix}-${n}`;
  const linksText = (values.links ?? []).map((l) => (l.label ? `${l.label} | ${l.url}` : l.url)).join('\n');
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={id('title')}>Title</Label>
        <Input id={id('title')} name="title" defaultValue={values.title} required maxLength={200} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id('instructions')}>Instructions</Label>
        <Textarea id={id('instructions')} name="instructions" defaultValue={values.instructions} rows={4} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id('expectedResult')}>Expected result</Label>
        <Textarea id={id('expectedResult')} name="expectedResult" defaultValue={values.expectedResult} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={id('repository')}>Repository</Label>
          <Input id={id('repository')} name="repository" defaultValue={values.repository ?? ''} placeholder="acme/web" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id('branch')}>Branch</Label>
          <Input id={id('branch')} name="branch" defaultValue={values.branch ?? ''} placeholder="main" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id('links')}>Links (one per line: label | URL)</Label>
        <Textarea id={id('links')} name="links" defaultValue={linksText} rows={2} placeholder="Spec | https://…" />
      </div>
      <div className="flex items-center gap-2">
        <input type="hidden" name="requireReviewField" value="1" />
        <input
          id={id('requireReview')}
          name="requireReview"
          type="checkbox"
          defaultChecked={values.requireReview ?? true}
          className="size-4 accent-primary"
        />
        <Label htmlFor={id('requireReview')}>Require my review before Done</Label>
      </div>
    </>
  );
}

export function AgentSelect({
  agents, name, id, defaultValue, emptyLabel = 'Unassigned',
}: { agents: { id: string; name: string }[]; name: string; id: string; defaultValue?: string | null; emptyLabel?: string }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ''} className={selectClass}>
      <option value="">{emptyLabel}</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

export function NativeSelect({ id, name, defaultValue, options }: { id: string; name: string; defaultValue?: string; options: { value: string; label: string }[] }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} className={selectClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
