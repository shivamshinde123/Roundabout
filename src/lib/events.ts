/** Human wording for activity events, shared by task history and the project activity feed. */
export function describeEvent(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'task.created': return 'created the task';
    case 'task.edited': return `edited ${(data.fields as string[] | undefined)?.join(', ') ?? 'the task'}`;
    case 'task.status_changed': return `moved it from ${data.from} to ${data.to}`;
    case 'task.moved_board': return 'moved it to another board';
    case 'task.assigned': return data.toAgentId ? 'assigned it' : 'unassigned it';
    case 'task.accepted': return 'accepted it';
    case 'task.reassigned': return data.toAgentId ? 'reassigned it' : 'moved it back to Backlog';
    case 'task.reopened': return 'reopened it';
    case 'handoff.proposed': return 'proposed a handoff';
    case 'handoff.accepted': return 'accepted the handoff';
    case 'handoff.declined': return 'declined the handoff';
    case 'handoff.cancelled': return 'cancelled the handoff';
    case 'handoff.superseded': return 'superseded the handoff';
    case 'blocker.reported': return 'reported a blocker';
    case 'blocker.resolved': return 'resolved a blocker';
    case 'result.submitted': return `submitted a result: ${data.summary ?? ''}`;
    case 'review.approved': return 'approved the result';
    case 'review.changes_requested': return 'requested changes';
    case 'task.completed': return 'completed the task';
    case 'message.posted': return data.kind === 'update' ? 'posted an update' : data.kind === 'question' ? 'asked a question' : 'posted a message';
    case 'agent.connected': return 'connected an agent';
    case 'agent.access_changed': return "changed an agent's access";
    case 'agent.revoked': return 'disconnected an agent';
    case 'agent.token_rotated': return 'reconnected an agent';
    case 'project.created': return 'created the project';
    case 'board.created': return `added the board ${data.name ?? ''}`.trim();
    default: return type.replace('.', ' ').replace('_', ' ');
  }
}
