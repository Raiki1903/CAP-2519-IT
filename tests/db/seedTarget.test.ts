/**
 * Tests the demo seed's safety checks: which database URL and which password prisma/seed.ts accepts before it connects.
 * Covers prisma/seedTarget.ts parseSeedTarget and readSeedPassword. No server, no database.
 * Fixtures: made-up URLs and passwords only.
 */
import { describe, expect, it } from "vitest";
import { MIN_SEED_PASSWORD_LENGTH, parseSeedTarget, readSeedPassword, SeedRefused } from "../../prisma/seedTarget";

describe("parseSeedTarget", () => {
  it("accepts a MySQL database on localhost or 127.0.0.1, with any database name", () => {
    expect(parseSeedTarget("mysql://root:fake-password@localhost:3307/AdRIC_DB_dev")).toEqual({
      host: "localhost",
      port: 3307,
      user: "root",
      password: "fake-password",
      database: "AdRIC_DB_dev",
    });
    expect(parseSeedTarget("mysql://root:fake-password@127.0.0.1/demo").port).toBe(3306);
  });

  it("refuses when SEED_DATABASE_URL is not set, and says the seed never reads .env", () => {
    expect(() => parseSeedTarget(undefined)).toThrow(/SEED_DATABASE_URL is not set.*never reads \.env/);
    expect(() => parseSeedTarget("")).toThrow(SeedRefused);
  });

  it("refuses any host but localhost or 127.0.0.1, so it cannot reach a shared database", () => {
    expect(() => parseSeedTarget("mysql://root:fake-password@db.example.test:3306/AdRIC_DB")).toThrow(/localhost or 127\.0\.0\.1/);
    expect(() => parseSeedTarget("mysql://root:fake-password@10.0.0.5:3306/AdRIC_DB")).toThrow(SeedRefused);
  });

  it("refuses text that is not a URL, a URL that is not MySQL, no database name, and no user or password", () => {
    expect(() => parseSeedTarget("not a url")).toThrow(SeedRefused);
    expect(() => parseSeedTarget("postgres://root:fake-password@localhost:5432/demo")).toThrow(/mysql:\/\//);
    expect(() => parseSeedTarget("mysql://root:fake-password@localhost:3306/")).toThrow(/name a database/);
    expect(() => parseSeedTarget("mysql://root:fake-password@localhost:3306/demo;drop")).toThrow(SeedRefused);
    expect(() => parseSeedTarget("mysql://root@localhost:3306/demo")).toThrow(/user name and a password/);
  });

  it("never puts the URL, the host, or the password in its message", () => {
    const secret = "fake-secret-value";
    try {
      parseSeedTarget(`mysql://root:${secret}@db.example.test:3306/AdRIC_DB`);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain("db.example.test");
    }
  });
});

describe("readSeedPassword", () => {
  it("refuses a missing or short password without printing it, and accepts one long enough", () => {
    expect(() => readSeedPassword(undefined)).toThrow(/SEED_PASSWORD is not set/);
    expect(() => readSeedPassword("")).toThrow(SeedRefused);

    const short = "x".repeat(MIN_SEED_PASSWORD_LENGTH - 1);
    try {
      readSeedPassword(short);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SeedRefused);
      expect((error as Error).message).not.toContain(short);
    }

    expect(readSeedPassword("y".repeat(MIN_SEED_PASSWORD_LENGTH))).toBe("y".repeat(MIN_SEED_PASSWORD_LENGTH));
  });
});
