import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false, // Run tests sequentially to avoid DB test collisions
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
