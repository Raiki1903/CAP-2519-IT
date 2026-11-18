/**
 * Tests the seed's safety checks: which database URL, mode, password and admin email prisma/seed.ts accepts before it connects.
 * Covers prisma/seedTarget.ts parseSeedTarget, readSeedPassword, readSeedMode, readSeedAdminEmail and readAdminPassword.
 * No server, no database.
 * Fixtures: made-up URLs, emails and passwords only.
 */
import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@shared/constants/passwords";
import {
  MIN_SEED_PASSWORD_LENGTH, parseSeedTarget, readAdminPassword, readSeedAdminEmail, readSeedMode, readSeedPassword, SeedRefused,
} from "../../prisma/seedTarget";

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

describe("readSeedMode", () => {
  it("means the demo seed when not set or `demo`, and the base setup for `base`", () => {
    expect(readSeedMode(undefined)).toBe("demo");
    expect(readSeedMode("demo")).toBe("demo");
    expect(readSeedMode("base")).toBe("base");
  });

  it("refuses every other value, an empty one and another case included, without repeating it", () => {
    for (const value of ["", "BASE", "Demo", " base", "wrong"]) {
      expect(() => readSeedMode(value), JSON.stringify(value)).toThrow(SeedRefused);
    }
    expect(() => readSeedMode("made-up-mode")).toThrow(/SEED_MODE must be demo or base/);
    try {
      readSeedMode("made-up-mode");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("made-up-mode");
    }
  });
});

describe("readSeedAdminEmail", () => {
  it("trims the email and puts it in lower case", () => {
    expect(readSeedAdminEmail("  Made.Up@DLSU.edu.ph ")).toBe("made.up@dlsu.edu.ph");
    expect(readSeedAdminEmail("a@dlsu.edu.ph")).toBe("a@dlsu.edu.ph");
  });

  it("refuses a missing email, a blank one, another domain, and the domain alone", () => {
    for (const value of [undefined, "", "   ", "made.up@example.com", "made.up@dlsu.edu.ph.example.com", "@dlsu.edu.ph", "  @DLSU.edu.ph "]) {
      expect(() => readSeedAdminEmail(value), JSON.stringify(value)).toThrow(SeedRefused);
    }
  });

  it("refuses an email longer than the column holds, and never prints the email", () => {
    expect(() => readSeedAdminEmail(`${"a".repeat(244)}@dlsu.edu.ph`)).toThrow(/at most 255 characters/);
    try {
      readSeedAdminEmail("made.up@example.com");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("made.up");
    }
  });
});

describe("readAdminPassword", () => {
  it("accepts the shortest and the longest password the app accepts", () => {
    expect(readAdminPassword("y".repeat(MIN_PASSWORD_LENGTH))).toBe("y".repeat(MIN_PASSWORD_LENGTH));
    expect(readAdminPassword("y".repeat(MAX_PASSWORD_LENGTH))).toBe("y".repeat(MAX_PASSWORD_LENGTH));
  });

  it("refuses a missing, too short or too long password, without printing it", () => {
    expect(() => readAdminPassword(undefined)).toThrow(/SEED_PASSWORD is not set/);
    expect(() => readAdminPassword("")).toThrow(SeedRefused);
    for (const value of ["x".repeat(MIN_PASSWORD_LENGTH - 1), "x".repeat(MAX_PASSWORD_LENGTH + 1)]) {
      try {
        readAdminPassword(value);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(SeedRefused);
        expect((error as Error).message).not.toContain(value);
      }
    }
  });
});
