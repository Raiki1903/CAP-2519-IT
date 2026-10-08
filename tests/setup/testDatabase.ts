/**
 * Test database guard: finds TEST_DATABASE_URL and refuses anything but a local database named `*_test`.
 * Layer: test setup. Called by globalSetup.ts, db.ts, and server.ts in this folder. Calls dotenv's parser.
 * Used by: every test run, before anything connects to a database.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

/** Absolute path of the repository root, resolved from this file so the working directory does not matter. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Connection details for the local test database, taken apart so each piece can be passed on separately. */
export interface TestDatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** The original URL. Only ever passed to child processes, never printed. */
  url: string;
}

/** Thrown when TEST_DATABASE_URL is missing or points somewhere the tests must not touch. */
export class TestDatabaseRefused extends Error {
  constructor(reason: string) {
    super(`Test database refused: ${reason} See tests/README.md.`);
    this.name = "TestDatabaseRefused";
  }
}

/**
 * Reads TEST_DATABASE_URL from the environment, or else from the repository's `.env`.
 * Only this one key is taken from `.env`: the rest of that file points at CCS Cloud,
 * and loading it into this process would let it leak into a child process. (C-07)
 *
 * @returns the URL, or undefined when it is not set anywhere
 */
export function readTestDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envFile = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envFile)) return undefined;
  return parse(fs.readFileSync(envFile)).TEST_DATABASE_URL || undefined;
}

/**
 * Parses a database URL and accepts it only if the host is local and the database name ends in `_test`.
 * Error messages never include the URL, the user, or the password.
 *
 * @param url a URL such as mysql://root:<password>@localhost:3306/AdRIC_DB_test
 * @returns the parsed connection details
 * @throws TestDatabaseRefused when the URL is malformed, not MySQL, not local, or not a `_test` database
 */
export function parseTestDatabaseUrl(url: string): TestDatabaseConfig {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TestDatabaseRefused("TEST_DATABASE_URL is not a valid URL.");
  }

  if (parsed.protocol !== "mysql:") {
    throw new TestDatabaseRefused("TEST_DATABASE_URL must start with mysql://.");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new TestDatabaseRefused("the host must be localhost or 127.0.0.1. The tests never run against a shared database.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  // The name is later written into SQL as an identifier, so only plain characters are accepted.
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new TestDatabaseRefused("the database name must contain only letters, digits, and underscores.");
  }
  if (!database.endsWith("_test")) {
    throw new TestDatabaseRefused(`the database name must end in "_test" (got "${database}").`);
  }

  // prisma.ts replaces an empty user or password with its hardcoded CCS Cloud values,
  // so the server would log in with the wrong account. (C-07)
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (!user || !password) {
    throw new TestDatabaseRefused("TEST_DATABASE_URL needs both a user name and a password.");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user,
    password,
    database,
    url,
  };
}

/**
 * Finds and checks TEST_DATABASE_URL. Every path to the database goes through here.
 *
 * @throws TestDatabaseRefused when the URL is missing or fails the checks in parseTestDatabaseUrl
 */
export function loadTestDatabaseConfig(): TestDatabaseConfig {
  const url = readTestDatabaseUrl();
  if (!url) {
    throw new TestDatabaseRefused("TEST_DATABASE_URL is not set, in the environment or in .env.");
  }
  return parseTestDatabaseUrl(url);
}

/** A printable name for the target database, without the user or password. */
export function describeTarget(config: TestDatabaseConfig): string {
  return `${config.host}:${config.port}/${config.database}`;
}
