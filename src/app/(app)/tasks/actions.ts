'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/server/auth';
import { formAction } from '@/server/actions';
import { toErrorBody } from '@/server/errors';
import { assignTask, createTask, moveTaskBoard, moveTaskStatus, updateTask } from '@/server/tasks';
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
