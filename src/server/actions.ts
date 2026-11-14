import 'server-only';
import { notFound, unstable_rethrow } from 'next/navigation';
import { AppError, toErrorBody } from './errors';
import type { FormState } from '@/components/action-form';

/** Run a server-action body and turn AppErrors into form state. Lets redirect()/notFound() through. */
export async function formAction(run: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await run()) ?? undefined;
  } catch (e) {
    unstable_rethrow(e);
    return { error: toErrorBody(e).message };
  }
}

/** For pages: turn a NOT_FOUND AppError into Next's 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
}
