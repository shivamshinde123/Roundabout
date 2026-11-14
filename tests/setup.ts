import { beforeEach } from 'vitest';
import { resetDb } from './helpers';

// Safety: tests truncate tables, so never run them against a remote database.
const url = new URL(process.env.DATABASE_URL ?? 'postgres://missing');
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
  throw new Error(`Refusing to run tests against non-local database host "${url.hostname}".`);
}

beforeEach(resetDb);
