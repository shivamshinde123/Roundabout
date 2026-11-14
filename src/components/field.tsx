import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Field({
  name, label, type = 'text', autoComplete, defaultValue,
}: { name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} autoComplete={autoComplete} defaultValue={defaultValue} required />
    </div>
  );
}
