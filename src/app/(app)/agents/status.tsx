import { Badge } from '@/components/ui/badge';

const text: Record<string, string> = { setup: 'Waiting for first contact', active: 'Active', error: 'Error', revoked: 'Disconnected' };
const tone: Record<string, 'secondary' | 'outline' | 'destructive'> = { setup: 'outline', active: 'secondary', error: 'destructive', revoked: 'outline' };

export function AgentStatus({ status }: { status: string }) {
  return <Badge variant={tone[status] ?? 'outline'}>{text[status] ?? status}</Badge>;
}
