import { ConfirmDelete } from '@/components/confirm-delete';
import { deleteAgentAction } from './actions';

export function DeleteAgent({ agent }: { agent: { id: string; name: string; status: string } }) {
  return (
    <ConfirmDelete trigger="Delete" title={`Delete ${agent.name}?`} action={deleteAgentAction} fields={{ agentId: agent.id }}>
      <p>
        Removes <strong>{agent.name}</strong> from Roundabout.
        {agent.status !== 'revoked' && ' It is disconnected first, so its token stops working right away.'}
      </p>
      <p className="text-muted-foreground">
        Past results, handoffs and history keep its name. Tasks still assigned to it show &ldquo;Agent can&apos;t access&rdquo; until you reassign them.
      </p>
    </ConfirmDelete>
  );
}
