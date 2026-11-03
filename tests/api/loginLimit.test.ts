/**
 * Login by account status, the login rows of the activity log, and the failed-login limit. (issue #136)
 * Covers POST /api/auth/login. Workflow: sign-in.
 * Fixtures: the seeded accounts. Each test fails a different account, since the limit counts per email; the limit is
 * in the server's memory, and this file has its own server, so it starts empty.
 */
import { describe, expect, it } from "vitest";
import { USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, server } = useApiHarness();
const REFUSED = { success: false, error: "Invalid institutional email address or password." };
const TOO_MANY = { success: false, error: "Too many failed logins. Try again in 15 minutes." };

const logIn = (email: string, password: string) => api.post("/api/auth/login", { email, password });
const wrongPassword = (user: TestUser) => logIn(user.email, "test-password-wrong");

/** Logs in with an X-Forwarded-For header, as nginx sends it. */
const logInFrom = (address: string, user: TestUser, password: string) =>
  fetch(`${server().baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": address },
    body: JSON.stringify({ email: user.email, password }),
  });

const loginRows = (where: object = {}) =>
  db.activity_log.findMany({ where: { event_type: { in: ["LOGIN_SUCCESS", "LOGIN_FAILURE"] }, ...where }, orderBy: { log_id: "asc" } });

describe("the failed-login limit", () => {
  it("answers 429 to the 6th try after 5 failures, even with the right password, and writes no row for it", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await wrongPassword(USERS.custodianA);
      expect(res.status, `failure ${i + 1}`).toBe(401);
      expect(res.body).toEqual(REFUSED);
    }

    const sixth = await logIn(USERS.custodianA.email, USERS.custodianA.password);

    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual(TOO_MANY);
    expect(await loginRows({ target_user_id: USERS.custodianA.userId })).toHaveLength(5);
  });

  it("counts the email in any letter case and with spaces as the same key", async () => {
    for (let i = 0; i < 5; i += 1) await logIn(i % 2 ? ` ${USERS.staffIts.email.toUpperCase()} ` : USERS.staffIts.email, "test-password-wrong");

    expect((await logIn(USERS.staffIts.email, USERS.staffIts.password)).status).toBe(429);
  });

  it("does not block another email from the same address", async () => {
    const res = await logIn(USERS.staffTsg.email, USERS.staffTsg.password);

    expect(res.status).toBe(200);
  });

  it("counts an unknown email too, with the same 429, and writes no row for it", async () => {
    const before = (await loginRows()).length;

    for (let i = 0; i < 5; i += 1) expect((await logIn("test.nobody@dlsu.edu.ph", "test-password-wrong")).status).toBe(401);
    const sixth = await logIn("test.nobody@dlsu.edu.ph", "test-password-wrong");

    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual(TOO_MANY);
    expect(await loginRows()).toHaveLength(before);
  });

  it("forgets the failures after a successful login", async () => {
    for (let i = 0; i < 4; i += 1) await wrongPassword(USERS.director);
    expect((await logIn(USERS.director.email, USERS.director.password)).status).toBe(200);

    for (let i = 0; i < 4; i += 1) {
      expect((await wrongPassword(USERS.director)).status, `failure ${i + 1} after the success`).toBe(401);
    }
  });

  it("neither counts nor clears a status refusal: 4 failures, a Pending refusal, and 1 more failure block the email", async () => {
    await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { account_status: "PENDING" } });
    try {
      for (let i = 0; i < 4; i += 1) await wrongPassword(USERS.custodianB);
      for (let i = 0; i < 3; i += 1) {
        expect((await logIn(USERS.custodianB.email, USERS.custodianB.password)).status, "a refusal by status").toBe(403);
      }
      expect((await wrongPassword(USERS.custodianB)).status, "the 5th failure").toBe(401);

      expect((await logIn(USERS.custodianB.email, USERS.custodianB.password)).status).toBe(429);
    } finally {
      await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { account_status: "ACTIVE" } });
    }
  });

  it("counts by the forwarded address from nginx on this machine: another address is not blocked", async () => {
    for (let i = 0; i < 5; i += 1) await logInFrom("203.0.113.5", USERS.secretary, "test-password-wrong");

    expect((await logInFrom("203.0.113.5", USERS.secretary, USERS.secretary.password)).status).toBe(429);
    expect((await logInFrom("203.0.113.6", USERS.secretary, USERS.secretary.password)).status).toBe(200);
    expect((await logIn(USERS.secretary.email, USERS.secretary.password)).status).toBe(200);
  });
});

describe("the login rows of the activity log", () => {
  it("writes LOGIN_SUCCESS with the account as actor", async () => {
    const before = await loginRows({ event_type: "LOGIN_SUCCESS", actor_id: USERS.labHead.userId });

    expect((await logIn(USERS.labHead.email, USERS.labHead.password)).status).toBe(200);

    const rows = await loginRows({ event_type: "LOGIN_SUCCESS", actor_id: USERS.labHead.userId });
    expect(rows).toHaveLength(before.length + 1);
    expect(rows.at(-1)).toMatchObject({ actor_id: USERS.labHead.userId, target_user_id: null, details: null });
  });

  it("writes LOGIN_FAILURE for a wrong password with no actor, the account as target, and the reason", async () => {
    expect((await wrongPassword(USERS.admin)).status).toBe(401);

    expect((await loginRows({ target_user_id: USERS.admin.userId })).at(-1)).toMatchObject({ event_type: "LOGIN_FAILURE", actor_id: null, details: "Wrong password" });
  });

  it.each([
    ["PENDING", "Account pending"],
    ["REJECTED", "Account rejected"],
    ["INACTIVE", "Account inactive"],
  ] as const)("writes LOGIN_FAILURE with %s's reason for the right password on that account", async (status, reason) => {
    await db.users.update({ where: { user_id: USERS.labHead.userId }, data: { account_status: status } });
    try {
      expect((await logIn(USERS.labHead.email, USERS.labHead.password)).status).toBe(403);
    } finally {
      await db.users.update({ where: { user_id: USERS.labHead.userId }, data: { account_status: "ACTIVE" } });
    }

    expect((await loginRows({ target_user_id: USERS.labHead.userId })).at(-1)).toMatchObject({ event_type: "LOGIN_FAILURE", actor_id: null, details: reason });
  });

  it("never holds an email or a typed login name", async () => {
    const rows = await loginRows();

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.details ?? "", `row ${row.log_id}`).not.toContain("@");
      expect(row.details ?? "", `row ${row.log_id}`).not.toMatch(/example\.test|dlsu\.edu\.ph|nobody/i);
    }
  });
});
