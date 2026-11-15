import { Trash2 } from 'lucide-react';
import type { MenuItem } from '@/components/action-menu';
import { deleteAgentAction } from './actions';

/** The "Delete agent" item for an agent's ⋯ menu (D-28, D-33). */
export function deleteAgentItem(agent: { id: string; name: string; status: string }): MenuItem {
  return {
    label: 'Delete agent', icon: <Trash2 />, title: `Delete ${agent.name}?`, submitLabel: 'Delete', destructive: true,
    action: deleteAgentAction,
    body: (
      <div className="grid gap-2 text-sm">
        <input type="hidden" name="agentId" value={agent.id} />
        <p>
          Removes <strong>{agent.name}</strong> from Roundabout.
          {agent.status !== 'revoked' && ' It is disconnected first, so its token stops working right away.'}
        </p>
        <p className="text-muted-foreground">
          Past results, handoffs and history keep its name. Tasks still assigned to it show &ldquo;Agent can&apos;t access&rdquo; until you reassign them.
        </p>
      </div>
    ),
  };
}
