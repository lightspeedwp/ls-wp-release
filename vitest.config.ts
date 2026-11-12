import { defineConfig } from 'vitest/config';

// One Vitest run covers the repository's validator and helper-script tests.
// The tests keep their node:assert assertions; Vitest provides the test() and afterAll() globals.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.cjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      // Every intended production script is in the denominator, whether or not a test runs it.
      include: ['scripts/**/*.{cjs,mjs,js,ts}', 'sub-skills/**/scripts/**/*.{cjs,mjs,js,ts}'],
      // Test files only; no production script is excluded.
      exclude: ['**/tests/**']
      // No threshold is enforced yet. The agreed starting point is 80% (raise toward 90% over time).
      // The tests run most scripts as subprocesses, which V8 cannot instrument, so the gate is enabled
      // in a follow-up once the scripts are tested in-process.
    }
  }
});
