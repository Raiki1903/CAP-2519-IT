/**
 * Vitest configuration for the API tests in tests/. Kept apart from vite.config.ts, which builds the web app.
 * Layer: config. Read by `npm test`. Points at tests/setup/globalSetup.ts, and resolves @shared as the app does.
 * Used by: anyone running the test suite.
 */
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The same @shared alias as vite.config.ts and tsconfig.json, so a test can import a server module that uses it.
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "./shared") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/globalSetup.ts"],
    // One file at a time: every file empties and reseeds the same database.
    fileParallelism: false,
    testTimeout: 30_000,
    // Covers emptying and seeding the database and starting the server.
    hookTimeout: 120_000,
  },
});
