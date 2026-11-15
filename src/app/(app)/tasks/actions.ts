'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { formAction } from '@/server/actions';
import { toErrorBody } from '@/server/errors';
import { assignTask, createTask, deleteTask, moveTaskBoard, moveTaskStatus, updateTask } from '@/server/tasks';
import { markMessagesRead, postMessage } from '@/server/messages';
import { cancelHandoff } from '@/server/handoffs';
import { resolveBlocker } from '@/server/blockers';
import { approveResult, requestChanges } from '@/server/results';
import { reassignTask, reopenTask } from '@/server/recovery';
import { parseLinkLines } from '@/lib/schemas';
import type { FormState } from '@/components/action-form';

const refresh = (projectId: string) => revalidatePath(`/projects/${projectId}`, 'layout');
const str = (form: FormData, key: string) => (form.has(key) ? String(form.get(key)) : undefined);

function taskFields(form: FormData) {
  const linksText = str(form, 'links');
  return {
    title: str(form, 'title'),
    instructions: str(form, 'instructions'),
    expectedResult: str(form, 'expectedResult'),
    repository: str(form, 'repository'),
    branch: str(form, 'branch'),
    links: linksText === undefined ? undefined : parseLinkLines(linksText),
    // Checkboxes are absent when unchecked; the hidden marker tells us the field was on the form.
    requireReview: form.has('requireReviewField') ? form.get('requireReview') === 'on' : undefined,
  };
}

export async function createTaskAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const task = await createTask(await requireOwner(), {
      ...taskFields(form),
      boardId: str(form, 'boardId'),
      status: str(form, 'status'),
      assigneeAgentId: str(form, 'assigneeAgentId') || null,
    });
    refresh(task.projectId);
    return { ok: 'Task created.' };
  });
}

export async function updateTaskAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const task = await updateTask(await requireOwner(), {
      ...taskFields(form),
      taskId: str(form, 'taskId'),
      expectedRevision: str(form, 'expectedRevision'),
    });
    refresh(task.projectId);
    return { ok: 'Saved.' };
  });
}

export async function assignTaskAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const task = await assignTask(await requireOwner(), {
      taskId: str(form, 'taskId'),
      expectedRevision: str(form, 'expectedRevision'),
      agentId: str(form, 'agentId') || null,
    });
    refresh(task.projectId);
    return { ok: task.assigneeAgentId ? 'Assigned.' : 'Unassigned.' };
  });
}

export async function moveTaskBoardAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const task = await moveTaskBoard(await requireOwner(), {
      taskId: str(form, 'taskId'),
      expectedRevision: str(form, 'expectedRevision'),
      boardId: str(form, 'boardId'),
    });
    refresh(task.projectId);
    return { ok: 'Moved.' };
  });
}

/** Called from drag-and-drop and the card's Move menu. */
export async function moveTaskStatusAction(input: { taskId: string; expectedRevision: number; to: string }) {
  try {
    const task = await moveTaskStatus(await requireOwner(), input);
    refresh(task.projectId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: toErrorBody(e).message };
  }
}

export async function postMessageAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await postMessage(await requireOwner(), {
      taskId: str(form, 'taskId'),
      body: str(form, 'body'),
      to: str(form, 'to') || undefined,
      replyTo: str(form, 'replyTo') || undefined,
    });
    revalidatePath('/projects', 'layout');
    return { ok: 'Sent.' };
  });
}

/** Called by the task panel after it opens; page rendering never writes (D-11). */
export async function markMessagesReadAction(taskId: string) {
  await markMessagesRead(await requireOwner(), taskId);
}

export async function cancelHandoffAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const { projectId } = await cancelHandoff(await requireOwner(), { handoffId: str(form, 'handoffId') });
    refresh(projectId);
    return { ok: 'Handoff cancelled.' };
  });
}

export async function resolveBlockerAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const res = await resolveBlocker(await requireOwner(), { blockerId: str(form, 'blockerId'), resolution: str(form, 'resolution') });
    refresh(res.project_id);
    return { ok: 'Blocker resolved.' };
  });
}

/** Approve from the board (drop on Done), the Move menu, or the task panel. */
export async function approveResultAction(input: { resultId: string; expectedRevision: number }) {
  try {
    const { projectId } = await approveResult(await requireOwner(), input);
    refresh(projectId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: toErrorBody(e).message };
  }
}

export async function approveResultFormAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await approveResultAction({ resultId: str(form, 'resultId') ?? '', expectedRevision: Number(str(form, 'expectedRevision')) });
  return res.ok ? { ok: 'Approved.' } : { error: res.error };
}

export async function requestChangesAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const { projectId } = await requestChanges(await requireOwner(), {
      resultId: str(form, 'resultId'),
      expectedRevision: str(form, 'expectedRevision'),
      comment: str(form, 'comment'),
    });
    refresh(projectId);
    return { ok: 'Changes requested.' };
  });
}

export async function reassignTaskAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const task = await reassignTask(await requireOwner(), {
      taskId: str(form, 'taskId'),
      expectedRevision: str(form, 'expectedRevision'),
      agentId: str(form, 'agentId') || null,
    });
    refresh(task.projectId);
    return { ok: task.assigneeAgentId ? 'Reassigned. It waits for the new agent to pick it up.' : 'Moved to Backlog.' };
  });
}

export async function reopenTaskAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const choice = str(form, 'agentId');
    const task = await reopenTask(await requireOwner(), {
      taskId: str(form, 'taskId'),
      expectedRevision: str(form, 'expectedRevision'),
      agentId: choice === 'keep' ? undefined : choice || null,
    });
    refresh(task.projectId);
    return { ok: 'Reopened.' };
  });
}

export async function deleteTaskAction(_: FormState, form: FormData): Promise<FormState> {
  let target = '';
  const state = await formAction(async () => {
    const task = await deleteTask(await requireOwner(), { taskId: str(form, 'taskId') });
    target = `/projects/${task.projectId}/boards/${task.boardId}`;
    refresh(task.projectId);
  });
  if (target) redirect(target);
  return state;
}
