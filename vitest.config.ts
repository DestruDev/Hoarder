import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for code that doesn't need React Native (currently the sync engine).
export default defineConfig({
  resolve: {
    alias: { '@': join(dirname(fileURLToPath(import.meta.url)), 'src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
