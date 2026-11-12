import { defineConfig } from 'vitest/config';

// One Vitest run covers the repository's validator and script tests, with an 80% global coverage gate.
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
      exclude: ['**/tests/**'],
      // Global gate: `npm test` fails below 80%. This is the agreed starting point; raise it toward 90% over time.
      // The *.inprocess.test.cjs files load the real scripts with require() so V8 can see them. The older
      // subprocess tests run copies of the scripts and add no coverage.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
