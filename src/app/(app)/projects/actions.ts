'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/server/auth';
import { formAction } from '@/server/actions';
import { createBoard, createProject, renameBoard, renameProject } from '@/server/projects';
import type { FormState } from '@/components/action-form';

const fields = (form: FormData) => Object.fromEntries(form);

export async function createProjectAction(_: FormState, form: FormData): Promise<FormState> {
  let target = '';
  const state = await formAction(async () => {
    const { project, board } = await createProject(await requireOwner(), fields(form));
    target = `/projects/${project.id}/boards/${board.id}`;
  });
  if (target) {
    revalidatePath('/', 'layout'); // sidebar + board tabs live in layouts
    redirect(target);
  }
  return state;
}

export async function renameProjectAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await renameProject(await requireOwner(), fields(form));
    revalidatePath('/', 'layout');
    return { ok: 'Project renamed.' };
  });
}

export async function createBoardAction(_: FormState, form: FormData): Promise<FormState> {
  let target = '';
  const state = await formAction(async () => {
    const board = await createBoard(await requireOwner(), fields(form));
    target = `/projects/${board.projectId}/boards/${board.id}`;
  });
  if (target) {
    revalidatePath('/', 'layout'); // sidebar + board tabs live in layouts
    redirect(target);
  }
  return state;
}

export async function renameBoardAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await renameBoard(await requireOwner(), fields(form));
    revalidatePath('/', 'layout');
    return { ok: 'Board renamed.' };
  });
}
