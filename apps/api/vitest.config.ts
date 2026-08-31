import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/load-env.ts'],
    // The integration suite may run against a remote database; give it room.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests share one database; run files serially.
    fileParallelism: false,
  },
});
