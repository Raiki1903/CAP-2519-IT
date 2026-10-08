/**
 * Vitest configuration for the API tests in tests/. Kept apart from vite.config.ts, which builds the web app.
 * Layer: config. Read by `npm test`. Points at tests/setup/globalSetup.ts.
 * Used by: anyone running the test suite.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/globalSetup.ts"],
    // One file at a time: every file empties and reseeds the same database.
    fileParallelism: false,
    testTimeout: 30_000,
    // Covers emptying and seeding the database and starting server.ts.
    hookTimeout: 120_000,
  },
});
