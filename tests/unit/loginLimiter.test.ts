/**
 * Tests the failed-login limit on its own, with a test clock: the 5 failures, the 15-minute window and block, the
 * clear, the key, the pruning, and the 10,000-key cap. (issue #136)
 * Covers server/shared/services/loginLimiter.ts. No server, no database.
 * Fixtures: none. The limiter is reset before each test.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  isLoginBlocked,
  loginKey,
  recordLoginFailure,
  resetLoginLimiter,
  trackedLoginKeyCount,
} from "../../server/shared/services/loginLimiter";

const T0 = 1_800_000_000_000;
const MINUTE = 60_000;
const KEY = "test.user@dlsu.edu.ph|127.0.0.1";

function fail(times: number, at: number, key = KEY): void {
  for (let i = 0; i < times; i += 1) recordLoginFailure(key, at);
}

beforeEach(() => {
  resetLoginLimiter();
});

describe("loginLimiter", () => {
  it("blocks a key at its 5th failure, not at its 4th", () => {
    fail(4, T0);
    expect(isLoginBlocked(KEY, T0)).toBe(false);

    fail(1, T0);
    expect(isLoginBlocked(KEY, T0)).toBe(true);
  });

  it("counts only failures within the last 15 minutes", () => {
    fail(4, T0);
    fail(1, T0 + 15 * MINUTE);

    expect(isLoginBlocked(KEY, T0 + 15 * MINUTE)).toBe(false);
  });

  it("keeps the block for 15 minutes, then lifts it and starts the count again", () => {
    fail(5, T0);

    expect(isLoginBlocked(KEY, T0 + 15 * MINUTE - 1)).toBe(true);
    expect(isLoginBlocked(KEY, T0 + 15 * MINUTE)).toBe(false);
    fail(4, T0 + 16 * MINUTE);
    expect(isLoginBlocked(KEY, T0 + 16 * MINUTE)).toBe(false);
  });

  it("forgets a key's failures when it is cleared", () => {
    fail(4, T0);
    clearLoginFailures(KEY);
    fail(4, T0);

    expect(isLoginBlocked(KEY, T0)).toBe(false);
  });

  it("keeps keys apart: another email or another address is not blocked", () => {
    fail(5, T0);

    expect(isLoginBlocked("test.other@dlsu.edu.ph|127.0.0.1", T0)).toBe(false);
    expect(isLoginBlocked("test.user@dlsu.edu.ph|10.0.0.2", T0)).toBe(false);
  });

  it("makes the key from the trimmed, lower-case email and the address", () => {
    expect(loginKey("  Test.User@DLSU.edu.ph ", "127.0.0.1")).toBe(KEY);
    expect(loginKey("test.user@dlsu.edu.ph", undefined)).toBe("test.user@dlsu.edu.ph|");
  });

  it("prunes expired keys when it next counts a failure", () => {
    fail(1, T0, "a|1");
    fail(1, T0, "b|1");
    fail(1, T0 + 16 * MINUTE, "c|1");

    expect(trackedLoginKeyCount()).toBe(1);
  });

  it("keeps at most 10,000 keys, dropping the one used longest ago", () => {
    for (let i = 0; i < 10_000; i += 1) recordLoginFailure(`key-${i}|1`, T0);
    fail(1, T0, "key-0|1");
    recordLoginFailure("new|1", T0);

    expect(trackedLoginKeyCount()).toBe(10_000);
    fail(3, T0, "key-0|1");
    expect(isLoginBlocked("key-0|1", T0), "kept, with its 2 failures: used again lately").toBe(true);
    fail(4, T0, "key-1|1");
    expect(isLoginBlocked("key-1|1", T0), "dropped, so its earlier failure no longer counts").toBe(false);
  });
});
