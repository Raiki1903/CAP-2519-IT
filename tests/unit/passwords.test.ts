/**
 * Tests the password helper: the stored format, and what verifyPassword and isPasswordHash accept.
 * Covers server/shared/services/passwords.ts. No server, no database. (C-03, issue #10)
 * Fixtures: made-up passwords only.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH, hashPassword, isPasswordHash, verifyPassword } from "../../server/shared/services/passwords";

const PLAIN = "made-up-Password-1";

/** The parts of a stored hash, with its salt and key as byte counts. */
function partsOf(hash: string) {
  const [scheme, N, r, p, salt, key] = hash.split("$");
  return { scheme, N: Number(N), r: Number(r), p: Number(p), saltBytes: Buffer.from(salt, "base64").length, keyBytes: Buffer.from(key, "base64").length };
}

describe("hashPassword", () => {
  it("writes the scrypt$N$r$p$salt$key format with the agreed parameters", async () => {
    const hash = await hashPassword(PLAIN);

    expect(partsOf(hash)).toEqual({ scheme: "scrypt", N: 32768, r: 8, p: 1, saltBytes: 16, keyBytes: 64 });
    expect(hash).not.toContain(PLAIN);
    expect(hash.length).toBeLessThanOrEqual(255);
  });

  it("gives different strings for the same password", async () => {
    expect(await hashPassword(PLAIN)).not.toBe(await hashPassword(PLAIN));
  });
});

describe("verifyPassword", () => {
  it("is true for the right password", async () => {
    expect(await verifyPassword(PLAIN, await hashPassword(PLAIN))).toBe(true);
  });

  it("is false for a wrong password, a different letter case, and an empty string", async () => {
    const hash = await hashPassword(PLAIN);

    expect(await verifyPassword("not-the-password", hash)).toBe(false);
    expect(await verifyPassword(PLAIN.toUpperCase(), hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("is false, and does not throw, for a stored value that is not a valid hash", async () => {
    const hash = await hashPassword(PLAIN);
    const malformed = [
      PLAIN,
      "",
      null,
      undefined,
      12345,
      "scrypt$",
      hash.slice(0, -10),
      hash.replace("scrypt$", "bcrypt$"),
      hash.replace("$32768$", "$32767$"),
      hash.replace("$32768$", "$2147483648$"),
    ];

    for (const stored of malformed) {
      expect(await verifyPassword(PLAIN, stored), String(stored)).toBe(false);
    }
  });

  it("does not accept a plain stored password that equals what was typed", async () => {
    expect(await verifyPassword(PLAIN, PLAIN)).toBe(false);
  });

  it("is false, and does not throw, for a password that is not a string", async () => {
    const hash = await hashPassword(PLAIN);

    for (const plain of [undefined, null, 12345678, { length: 8 }, [PLAIN]]) {
      expect(await verifyPassword(plain, hash), JSON.stringify(plain)).toBe(false);
    }
  });

  it("uses the parameters in the stored string, so they can change later without breaking old hashes", async () => {
    const salt = randomBytes(16);
    const key = scryptSync(PLAIN, salt, 64, { N: 1024, r: 4, p: 2 });
    const olderHash = `scrypt$1024$4$2$${salt.toString("base64")}$${key.toString("base64")}`;

    expect(await verifyPassword(PLAIN, olderHash)).toBe(true);
    expect(await verifyPassword("not-the-password", olderHash)).toBe(false);
  });
});

describe("isPasswordHash", () => {
  it("is true for what hashPassword writes", async () => {
    expect(isPasswordHash(await hashPassword(PLAIN))).toBe(true);
  });

  it("is false for plain text, near misses, and anything that is not a string", async () => {
    const hash = await hashPassword(PLAIN);

    for (const value of [PLAIN, "", "scrypt$", "scrypt$32768$8$1$$", hash.slice(0, -10), `${hash}$extra`, null, undefined, 7, {}]) {
      expect(isPasswordHash(value), String(value)).toBe(false);
    }
  });

  it("is false for a hash that asks for more memory than the limit", async () => {
    const hash = await hashPassword(PLAIN);

    expect(isPasswordHash(hash.replace("$32768$", "$4194304$"))).toBe(false);
  });
});

describe("DUMMY_PASSWORD_HASH", () => {
  it("has the same parameters and sizes as a real hash, so a dummy verify takes the same time", async () => {
    expect(partsOf(DUMMY_PASSWORD_HASH)).toEqual(partsOf(await hashPassword(PLAIN)));
    expect(isPasswordHash(DUMMY_PASSWORD_HASH)).toBe(true);
  });

  it("matches no password", async () => {
    expect(await verifyPassword(PLAIN, DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
