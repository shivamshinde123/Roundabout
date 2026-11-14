import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

config({ path: '.env.local', quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/server-only-stub.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Tests share one database and reset it between cases, so run files one at a time.
    fileParallelism: false,
  },
});
