/**
 * The one call each API test file makes: fresh seed and a fresh server before the file, cleanup after it.
 * Layer: test setup. Called by tests/api/*.test.ts. Calls db.ts, seed.ts, testServer.ts, and Node's fetch.
 * Used by: every API test file.
 */
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll } from "vitest";
import { createTestPrisma, resetDatabase } from "./db";
import { seedDatabase } from "./seed";
import { loadTestDatabaseConfig } from "./testDatabase";
import { startTestServer, type RunningServer } from "./testServer";

/** One HTTP answer: the status code and the parsed JSON body (or the raw text when it is not JSON). */
export interface ApiResponse {
  status: number;
  // The API has no shared response types yet (H-13), so tests read fields loosely.
  body: any;
}

/** Sends requests to this file's server. Paths start with "/api/". Bodies are sent as JSON. */
export interface ApiClient {
  get(path: string): Promise<ApiResponse>;
  post(path: string, body?: unknown): Promise<ApiResponse>;
  put(path: string, body?: unknown): Promise<ApiResponse>;
  delete(path: string): Promise<ApiResponse>;
}

/** What a test file gets back from useApiHarness. */
export interface ApiHarness {
  /** HTTP calls to the server started for this file. */
  api: ApiClient;
  /** Prisma on the test database, for reading back what a request wrote. */
  db: PrismaClient;
  /** The running server, for its working directory or its printed output. Available inside tests and hooks. */
  server(): RunningServer;
}

/**
 * Registers the file's setup and cleanup: before the first test, empty the test database,
 * seed the fixtures, and start the server (server/main.ts); after the last test, stop it.
 * Each file therefore starts from the same data and a server with no memory of other files
 * (the server keeps the repair duplicate guard and the sign-up list in memory).
 * Call it once, at the top of the test file.
 *
 * @throws TestDatabaseRefused when TEST_DATABASE_URL fails the guard
 */
export function useApiHarness(): ApiHarness {
  const config = loadTestDatabaseConfig();
  const db = createTestPrisma(config);
  let running: RunningServer | undefined;

  beforeAll(async () => {
    await resetDatabase(db, config);
    await seedDatabase(db);
    running = await startTestServer(config);
  });

  afterAll(async () => {
    await running?.stop();
    await db.$disconnect();
  });

  const server = (): RunningServer => {
    if (!running) throw new Error("[tests] The server is not running. Use the harness only inside tests and hooks.");
    return running;
  };

  const request = async (method: string, path: string, body?: unknown): Promise<ApiResponse> => {
    const response = await fetch(`${server().baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // Not JSON: keep the text, so a test can still show what came back.
    }
    return { status: response.status, body: parsed };
  };

  return {
    api: {
      get: (path) => request("GET", path),
      post: (path, body) => request("POST", path, body),
      put: (path, body) => request("PUT", path, body),
      delete: (path) => request("DELETE", path),
    },
    db,
    server,
  };
}
