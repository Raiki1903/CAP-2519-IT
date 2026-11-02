/**
 * Tests that the error logs hold neither a password nor a hash, by spying on console.error. (C-03, issue #10)
 * Covers server/shared/middleware/errorHandler.ts, the pending file's load in server/features/auth/auth.repository.ts,
 * the error text of prisma/seed.ts, and hidePasswordHashes in server/shared/services/passwords.ts. No server, no database.
 * Fixtures: made-up passwords, a made-up hash, and a damaged pending file in a temporary folder. The real file is never read.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspect } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../server/shared/middleware/errorHandler";
import { hashPassword, hidePasswordHashes } from "../../server/shared/services/passwords";

const PLAIN = "made-up-secret";

vi.mock("../../server/config/prisma", () => ({ prisma: {} }));

// Only the client is replaced, so the real prisma/seed.ts runs up to its first query, which fails.
const seedQueryError = vi.hoisted(() => ({ current: new Error("not set") }));
vi.mock("@prisma/client", async (original) => ({
  ...(await original<typeof import("@prisma/client")>()),
  PrismaClient: class {
    $queryRaw = () => Promise.reject(seedQueryError.current);
    $disconnect = async () => {};
  },
}));

let consoleError: ReturnType<typeof vi.spyOn>;

/** Everything console.error was given, as it would print. */
const logged = (): string =>
  consoleError.mock.calls.flat().map((part: unknown) => (typeof part === "string" ? part : inspect(part))).join(" ");

function expectNoSecret(text: string): void {
  expect(text).not.toContain(PLAIN);
  expect(text).not.toContain("scrypt$");
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("hidePasswordHashes", () => {
  it("hides a whole hash, and a hash cut off part way, and keeps the text around it", async () => {
    const hash = await hashPassword(PLAIN);

    expect(hidePasswordHashes(`before password: "${hash}" after`)).toBe('before password: "<hidden>" after');
    expect(hidePasswordHashes(`cut ${hash.slice(0, 30)}`)).toBe("cut <hidden>");
    expect(hidePasswordHashes("no hash here")).toBe("no hash here");
  });
});

describe("errorHandler", () => {
  const req = { method: "POST", originalUrl: "/api/auth/login" } as Request;
  const res = () => {
    const response = { headersSent: false, status: vi.fn(() => response), json: vi.fn(() => response) };
    return response as unknown as Response;
  };
  const next = vi.fn() as NextFunction;

  it("logs a body that could not be read by method, URL, and type only", () => {
    const parseError = Object.assign(new SyntaxError(`Unexpected token 'm', ..."assword": ${PLAIN}"... is not valid JSON and scrypt$32768$8$1$abc`), {
      type: "entity.parse.failed",
      status: 400,
    });

    errorHandler(parseError, req, res(), next);

    expectNoSecret(logged());
    expect(logged()).toContain("POST /api/auth/login");
    expect(logged()).toContain("entity.parse.failed");
  });

  it("hides a hash in a failure it logs in full, as a Prisma error can quote one, and keeps the rest", async () => {
    const hash = await hashPassword(PLAIN);
    const prismaError = Object.assign(new Error(`Invalid value for user_type in data: { password: "${hash}" }`), { meta: { quoted: hash } });

    errorHandler(prismaError, req, res(), next);

    expectNoSecret(logged());
    expect(logged()).toContain("POST /api/auth/login failed");
    expect(logged()).toContain("Invalid value for user_type");
  });
});

describe("the pending file's load error", () => {
  it.each([
    ["a password", `{"password": ${PLAIN}}`],
    ["a hash", `{"password": scrypt$1$2}`],
  ])("logs only the error's name when the damaged file quotes %s", async (_, damaged) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "adric-pending-log-"));
    fs.writeFileSync(path.join(folder, "pending_registrations.json"), damaged, "utf-8");
    vi.spyOn(process, "cwd").mockReturnValue(folder);
    try {
      await import("../../server/features/auth/auth.repository");

      expectNoSecret(logged());
      expect(logged()).toContain("SyntaxError");
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("the demo seed's error text", () => {
  it("hides a hash a database error quotes, as well as the password", async () => {
    const hash = await hashPassword(PLAIN);
    seedQueryError.current = new Error(`Invalid call with password: "${hash}" and ${PLAIN}`);
    vi.stubEnv("SEED_DATABASE_URL", "mysql://root:fake-db-password@localhost:3306/AdRIC_DB_dev");
    vi.stubEnv("SEED_PASSWORD", PLAIN);
    const exited = new Promise<void>((resolve) => {
      vi.spyOn(process, "exit").mockImplementation((() => resolve()) as () => never);
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../../prisma/seed");
    await exited;

    expectNoSecret(logged());
    expect(logged()).toContain("[seed] Failed");
  });
});
