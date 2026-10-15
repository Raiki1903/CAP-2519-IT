/**
 * Starts the real backend (server/main.ts) as a child process aimed at the test database, and stops it.
 * Layer: test setup. Called by harness.ts. Calls testDatabase.ts, Node's child_process, and tsx's loader.
 * Used by: every API test file, which gets its own server on its own free port.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, type TestDatabaseConfig } from "./testDatabase";

const STARTUP_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 20_000;

/** The session secret every test server gets: made fresh for each test file, never the one in .env. */
export const TEST_SESSION_SECRET = randomBytes(32).toString("hex");
/** The web origin every test server gets, the default the app uses. */
export const TEST_WEB_ORIGIN = "http://localhost:5173";

/** A running backend. */
export interface RunningServer {
  /** For example http://127.0.0.1:53211, with no trailing slash. */
  baseUrl: string;
  /** The temporary working directory, where pending_registrations.json is written. (H-17) */
  workDir: string;
  /** Everything the server printed so far, for debugging a failed test. */
  output(): string;
  stop(): Promise<void>;
}

const runningChildren = new Set<ChildProcess>();
process.on("exit", () => {
  for (const child of runningChildren) child.kill();
});

async function findFreePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = probe.address() as net.AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/**
 * The child's environment: the current one minus anything that could aim it elsewhere,
 * plus every value it reads set explicitly. dotenv never overrides a variable that is already
 * set, even to an empty string, so these values win over the CCS Cloud ones in .env (C-07),
 * and the empty values below switch mail and backups off.
 */
export function buildServerEnv(config: TestDatabaseConfig, port: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(DATABASE_|MAILGUN_|BACKUP_DIR$|TEST_DATABASE_URL$)/i.test(key)) delete env[key];
  }
  return {
    ...env,
    DATABASE_HOST: config.host,
    DATABASE_PORT: String(config.port),
    DATABASE_USER: config.user,
    DATABASE_PASSWORD: config.password,
    DATABASE_NAME: config.database,
    BACKUP_DIR: "",
    MAILGUN_API_KEY: "",
    MAILGUN_DOMAIN: "",
    MAILGUN_FROM: "",
    SESSION_SECRET: TEST_SESSION_SECRET,
    WEB_ORIGIN: TEST_WEB_ORIGIN,
    PORT: String(port),
    // The server runs from a temporary folder, where tsx would not find tsconfig.json
    // and so could not resolve the @shared/* imports.
    TSX_TSCONFIG_PATH: path.join(REPO_ROOT, "tsconfig.json"),
  };
}

// An override of undefined removes the variable, to start a server without it.
function withOverrides(env: NodeJS.ProcessEnv, overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete result[key];
    else result[key] = value;
  }
  return result;
}

async function waitUntilAnswering(baseUrl: string, child: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`[tests] server/main.ts exited during startup (code ${child.exitCode}).\n${output()}`);
    }
    try {
      // Any HTTP answer means the server is listening. With no session cookie this route answers 401 without touching the database.
      await fetch(`${baseUrl}/api/auth/me`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`[tests] server/main.ts did not answer within ${STARTUP_TIMEOUT_MS / 1000} s.\n${output()}`);
}

/**
 * Starts server/main.ts on a free port with its working directory in a new temporary folder,
 * so the sign-up file it writes never lands in the repository. (H-17)
 * Run with `node --import <tsx loader>` rather than the tsx command, so there is one process to stop.
 *
 * @param config the guarded test database
 * @param envOverrides variables to set on top of buildServerEnv, or to remove with undefined
 * @returns the running server, once it answers HTTP requests
 * @throws Error when the server exits or does not answer within a minute
 */
export async function startTestServer(config: TestDatabaseConfig, envOverrides: Record<string, string | undefined> = {}): Promise<RunningServer> {
  const port = await findFreePort();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "adric-api-test-"));
  const tsxLoader = pathToFileURL(createRequire(path.join(REPO_ROOT, "package.json")).resolve("tsx")).href;

  const child = spawn(process.execPath, ["--import", tsxLoader, path.join(REPO_ROOT, "server", "main.ts")], {
    cwd: workDir,
    env: withOverrides(buildServerEnv(config, port), envOverrides),
    stdio: ["ignore", "pipe", "pipe"],
  });
  runningChildren.add(child);

  let captured = "";
  const capture = (chunk: Buffer) => {
    captured = (captured + chunk.toString()).slice(-MAX_OUTPUT_CHARS);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  const output = () => captured.split(config.password).join("<password>");

  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await exited;
    }
    runningChildren.delete(child);
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitUntilAnswering(baseUrl, child, output);
  } catch (error) {
    await stop();
    throw error;
  }
  return { baseUrl, workDir, output, stop };
}
