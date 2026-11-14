// Error codes shared by server actions and MCP tools (technical-design-document.md §11).
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type ErrorBody = { code: ErrorCode; message: string; details?: Record<string, unknown> };

/** Map anything thrown to a safe, client-facing error. Unknown errors never leak internals. */
export function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof AppError) return { code: err.code, message: err.message, details: err.details };
  console.error('[internal]', err instanceof Error ? err.message : err);
  return { code: 'INTERNAL', message: 'Something went wrong. Please retry.', details: { retryable: true } };
}

export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found or no access.`);
