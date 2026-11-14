import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  // Only manage our tables; auth.* belongs to Supabase.
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
  dbCredentials: { url: process.env.DIRECT_URL ?? '' },
});
