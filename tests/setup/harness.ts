/**
 * The one call each API test file makes: fresh seed and a fresh server before the file, cleanup after it.
 * Layer: test setup. Called by tests/api/*.test.ts. Calls db.ts, seed.ts, testServer.ts, and Node's fetch.
 * Used by: every API test file.
 */
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll } from "vitest";
import { SESSION_COOKIE_NAME } from "../../server/shared/services/session";
import { createTestPrisma, resetDatabase } from "./db";
import type { TestUser } from "./fixtures";
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
  /** HTTP calls to the server started for this file, with no session: what a visitor who has not logged in sends. */
  api: ApiClient;
  /**
   * HTTP calls sent with this user's session, as the web app sends them after login.
   * The first call logs the user in (POST /api/auth/login with the fixture's email and password) and the
   * session cookie is reused for every later call in the file.
   */
  as(user: TestUser): ApiClient;
  /** Logs the user in afresh, apart from the session as() reuses, and answers the cookie as "name=value". */
  logIn(user: TestUser): Promise<string>;
  /** HTTP calls sent with exactly this Cookie header, for a cookie a test made, changed, or logged out. */
  withCookie(cookie: string): ApiClient;
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

  // One login per user per file. Each file starts its own server, so a cookie never outlives its file.
  const sessionCookies = new Map<number, Promise<string>>();

  const logIn = async (user: TestUser): Promise<string> => {
    const response = await fetch(`${server().baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    if (response.status !== 200) {
      throw new Error(`[tests] Could not log in as ${user.email}: ${response.status} ${await response.text()}`);
    }
    // Node's fetch keeps no cookies, so the name=value part is kept here and sent back by hand.
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .find((pair) => pair.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (!cookie) throw new Error(`[tests] The login of ${user.email} set no ${SESSION_COOKIE_NAME} cookie.`);
    return cookie;
  };

  const sessionCookie = (user: TestUser): Promise<string> => {
    let cookie = sessionCookies.get(user.userId);
    if (!cookie) {
      cookie = logIn(user);
      sessionCookies.set(user.userId, cookie);
    }
    return cookie;
  };

  const request = async (method: string, path: string, body?: unknown, user?: TestUser | string): Promise<ApiResponse> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (typeof user === "string") headers.Cookie = user;
    else if (user) headers.Cookie = await sessionCookie(user);
    const response = await fetch(`${server().baseUrl}${path}`, {
      method,
      headers,
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

  const client = (user?: TestUser | string): ApiClient => ({
    get: (path) => request("GET", path, undefined, user),
    post: (path, body) => request("POST", path, body, user),
    put: (path, body) => request("PUT", path, body, user),
    delete: (path) => request("DELETE", path, undefined, user),
  });

  return {
    api: client(),
    as: (user) => client(user),
    logIn,
    withCookie: (cookie) => client(cookie),
    db,
    server,
  };
}
