import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

// prepare: false is required by Supabase's transaction pooler (port 6543).
// Reuse one client across hot reloads in dev so connections don't pile up.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const pg = globalForDb.pg ?? postgres(url, { prepare: false });
if (process.env.NODE_ENV !== 'production') globalForDb.pg = pg;

export const db = drizzle(pg, { schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
