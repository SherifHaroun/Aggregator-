import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/load-env.ts'],
    // Neon is a remote database; give the integration suite room.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests share one database; run files serially.
    fileParallelism: false,
  },
});
