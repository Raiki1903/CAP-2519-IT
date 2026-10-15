/**
 * Session and roles: the login cookie, logout, requireAuth (401), requireRole (403), CORS, and the startup check.
 * Covers every route of the approved 13b role table (docs/phase-1c-restructure/02-restructure-log.md, "Route role table"),
 * POST /api/auth/login and POST /api/auth/logout, and the SESSION_SECRET check in server/config/env.ts.
 * Workflow: every signed-in screen; the table is the specification, so this file restates it on purpose.
 * Fixtures: the seeded accounts (USERS) and ROLE_IDS. Requests use ids and tags that do not exist and empty bodies, so an
 * allowed request is refused by its handler (400 or 404) and writes nothing. The role-change test puts Custodian B's role back;
 * the deleted-account test creates and removes its own account.
 */
import { describe, expect, it } from "vitest";
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_LIFETIME_SECONDS } from "../../server/shared/services/session";
import { ROLE_IDS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness, type ApiClient } from "../setup/harness";
import { loadTestDatabaseConfig } from "../setup/testDatabase";
import { startTestServer, TEST_SESSION_SECRET, TEST_WEB_ORIGIN } from "../setup/testServer";

const { api, db, as, logIn, withCookie, server } = useApiHarness();

const NOT_LOGGED_IN = "Please log in to continue.";
const SESSION_ENDED = "Your session has ended. Please log in again.";
const FORBIDDEN = "Your role is not allowed to do this.";

type Role = "Staff" | "LabHead" | "Custodian" | "AdRICDirector";
const S: Role = "Staff", L: Role = "LabHead", C: Role = "Custodian", D: Role = "AdRICDirector";
const ANY: Role[] = [S, L, C, D];
const ACCOUNT: Record<Role, TestUser> = { Staff: USERS.staffTsg, LabHead: USERS.labHead, Custodian: USERS.custodianA, AdRICDirector: USERS.director };

/** The approved 13b role table: [row, method, path, roles]. Paths use ids and tags no row has. */
const ROUTES: [number, string, string, Role[]][] = [
  [3, "GET", "/api/auth/pending-registrations", [L]],
  [4, "POST", "/api/auth/approve-registration", [L]],
  [5, "POST", "/api/auth/reject-registration", [L]],
  [6, "GET", "/api/auth/me", ANY],
  [7, "PUT", "/api/auth/account", ANY],
  [8, "POST", "/api/auth/register", [L]],
  [9, "GET", "/api/assets", ANY],
  [10, "GET", "/api/assets/NOPE-9999/custodian-history", ANY],
  [11, "POST", "/api/assets", [S]],
  [12, "PUT", "/api/assets/NOPE-9999", [S]],
  [13, "DELETE", "/api/assets/NOPE-9999", [S]],
  [14, "POST", "/api/assets/NOPE-9999/disposal", [S]],
  [15, "GET", "/api/asset_disposals", [S, D, L]],
  [16, "PUT", "/api/asset_disposals/999999/decision", [D]],
  [17, "POST", "/api/assets/NOPE-9999/inspection", [C, S]],
  [18, "GET", "/api/asset_reports", [S, D]],
  [19, "GET", "/api/asset-reports", [S]],
  [20, "GET", "/api/asset_loans", ANY],
  [21, "POST", "/api/assets/NOPE-9999/borrow", [C]],
  [22, "PUT", "/api/asset_loans/999999/decision", [L]],
  [23, "POST", "/api/assets/NOPE-9999/repair", [C, L, S]],
  [24, "GET", "/api/asset_repairs", ANY],
  [25, "PUT", "/api/asset_repairs/999999", [S]],
  [26, "PUT", "/api/asset_repairs/999999/status", [S]],
  [27, "POST", "/api/assets/NOPE-9999/return", [S]],
  [28, "GET", "/api/asset_returns", [S]],
  [29, "POST", "/api/assets/NOPE-9999/transfer", [C]],
  [30, "GET", "/api/asset_transfers", ANY],
  [31, "PUT", "/api/asset_transfers/999999/decision", [L]],
  [32, "PUT", "/api/asset_transfers/999999/accept", [C]],
  [33, "GET", "/api/analytics/director", [D]],
  [34, "GET", "/api/analytics/lab-head", [L]],
  [35, "GET", "/api/analytics/tsg", [S]],
  [36, "GET", "/api/analytics/location-status", [S]],
  [37, "GET", "/api/analytics/advanced/inspection-progress", [S]],
  [38, "GET", "/api/analytics/advanced/idle-time", [L]],
  [39, "GET", "/api/analytics/advanced/idle-frequency", [L]],
  [40, "GET", "/api/analytics/advanced/loan-recommender", [L]],
];

function send(client: ApiClient, method: string, path: string) {
  if (method === "GET") return client.get(path);
  if (method === "DELETE") return client.delete(path);
  return method === "POST" ? client.post(path, {}) : client.put(path, {});
}

const rawLogin = (user: TestUser) =>
  fetch(`${server().baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

const cookieFor = (token: string) => `${SESSION_COOKIE_NAME}=${token}`;
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe("POST /api/auth/login: the session cookie", () => {
  it("sets an HttpOnly, SameSite=Lax cookie for 8 hours, with no Secure flag, holding the user id, the expiry, a nonce, and a signature", async () => {
    const before = nowSeconds();
    const res = await rawLogin(USERS.labHead);

    expect(res.status).toBe(200);
    const headers = res.headers.getSetCookie();
    expect(headers).toHaveLength(1);
    const [pair, ...attributes] = headers[0].split("; ");
    expect(attributes).toEqual(["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=28800"]);
    const match = pair.match(new RegExp(`^${SESSION_COOKIE_NAME}=(\\d+)\\.(\\d+)\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$`));
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(USERS.labHead.userId);
    expect(Number(match![2]) - before).toBeGreaterThanOrEqual(SESSION_LIFETIME_SECONDS - 1);
    expect(Number(match![2]) - before).toBeLessThanOrEqual(SESSION_LIFETIME_SECONDS + 1);
  });

  it("sets no cookie when the login is refused", async () => {
    const res = await fetch(`${server().baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: USERS.labHead.email, password: "not-the-password" }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie, refuses it afterwards, and a new login works", async () => {
    const cookie = await logIn(USERS.custodianB);
    expect((await withCookie(cookie).get("/api/assets")).status).toBe(200);

    const res = await fetch(`${server().baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(res.headers.getSetCookie()).toEqual([`${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`]);

    const after = await withCookie(cookie).get("/api/assets");
    expect(after.status).toBe(401);
    expect(after.body).toEqual({ success: false, error: SESSION_ENDED });

    const again = await logIn(USERS.custodianB);
    expect((await withCookie(again).get("/api/assets")).status).toBe(200);
  });

  it("ends only its own cookie: two logins of the same user get different cookies, and the other keeps working", async () => {
    const first = await logIn(USERS.custodianB);
    const second = await logIn(USERS.custodianB);
    expect(first).not.toBe(second);

    await withCookie(first).post("/api/auth/logout");
    expect((await withCookie(first).get("/api/assets")).status).toBe(401);
    expect((await withCookie(second).get("/api/assets")).status).toBe(200);
  });

  it("answers 200 with no cookie, so a logout never fails", async () => {
    const res = await api.post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe("requireAuth: who gets a 401", () => {
  it("refuses a request with no cookie, with a message that asks to log in", async () => {
    const res = await api.get("/api/assets");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: NOT_LOGGED_IN });
  });

  it("refuses a cookie whose user id was changed (an attempt to become someone else)", async () => {
    const cookie = await logIn(USERS.custodianA);
    const forged = cookie.replace(`=${USERS.custodianA.userId}.`, `=${USERS.director.userId}.`);
    expect(forged).not.toBe(cookie);

    const res = await withCookie(forged).get("/api/analytics/director");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: SESSION_ENDED });
  });

  it("refuses a cookie whose expiry was pushed later, and one whose signature was changed", async () => {
    const cookie = await logIn(USERS.custodianA);
    const [, userId, expiresAt, signature] = cookie.match(/=(\d+)\.(\d+)\.(.+)$/)!;
    const later = cookieFor(`${userId}.${Number(expiresAt) + 3600}.${signature}`);
    const resigned = cookieFor(`${userId}.${expiresAt}.${signature.slice(0, -2)}${signature.endsWith("AA") ? "BB" : "AA"}`);

    expect((await withCookie(later).get("/api/assets")).status).toBe(401);
    expect((await withCookie(resigned).get("/api/assets")).status).toBe(401);
  });

  it("refuses a cookie signed with another secret", async () => {
    const token = signSessionToken(USERS.director.userId, nowSeconds() + 3600, "a-different-secret-that-is-long-enough-0123456789");

    expect((await withCookie(cookieFor(token)).get("/api/assets")).status).toBe(401);
  });

  it("refuses an expired cookie, even with a valid signature", async () => {
    const token = signSessionToken(USERS.staffTsg.userId, nowSeconds() - 1, TEST_SESSION_SECRET);
    const res = await withCookie(cookieFor(token)).get("/api/assets");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: SESSION_ENDED });
  });

  it("refuses a validly signed cookie for an account that does not exist, and text that is no token at all", async () => {
    const token = signSessionToken(999999, nowSeconds() + 3600, TEST_SESSION_SECRET);

    expect((await withCookie(cookieFor(token)).get("/api/assets")).status).toBe(401);
    expect((await withCookie(`${SESSION_COOKIE_NAME}=not-a-token`).get("/api/assets")).status).toBe(401);
    expect((await withCookie("some_other_cookie=1").get("/api/assets")).body.error).toBe(NOT_LOGGED_IN);
  });

  it("refuses the cookie of an account deleted after login", async () => {
    const temp = await db.users.create({
      data: { first_name: "Test", last_name: "Temporary", email: "temporary@example.test", password: "test-password-temporary", id_number: 90009999, user_type: "STUDENT" },
    });
    try {
      const cookie = await logIn({ ...USERS.custodianA, userId: temp.user_id, email: temp.email, password: "test-password-temporary" });
      expect((await withCookie(cookie).get("/api/assets")).status).toBe(200);

      await db.users.delete({ where: { user_id: temp.user_id } });
      expect((await withCookie(cookie).get("/api/assets")).status).toBe(401);
    } finally {
      await db.users.deleteMany({ where: { user_id: temp.user_id } });
    }
  });
});

describe("requireRole: the role is read from the database on every request", () => {
  it("gives a session the new role at its next request after the account's role changes", async () => {
    const cookie = await logIn(USERS.custodianB);
    expect((await withCookie(cookie).get("/api/auth/pending-registrations")).status).toBe(403);

    await db.user_roles.updateMany({ where: { user_id: USERS.custodianB.userId }, data: { role_id: ROLE_IDS.LAB_HEAD } });
    try {
      expect((await withCookie(cookie).get("/api/auth/pending-registrations")).status).toBe(200);
    } finally {
      await db.user_roles.updateMany({ where: { user_id: USERS.custodianB.userId }, data: { role_id: ROLE_IDS.CUSTODIAN } });
    }
    expect((await withCookie(cookie).get("/api/auth/pending-registrations")).status).toBe(403);
  });

  it.each([USERS.admin, USERS.staffIts, USERS.secretary])(
    "treats the $role account as Staff: it passes a Staff check and nothing more",
    async (user) => {
      const client = as(user);

      expect((await client.post("/api/assets", {})).status).toBe(400);
      expect((await client.get("/api/analytics/tsg")).status).toBe(200);
      const labHeadOnly = await client.get("/api/auth/pending-registrations");
      expect(labHeadOnly.status).toBe(403);
      expect(labHeadOnly.body).toEqual({ success: false, error: FORBIDDEN });
      expect((await client.get("/api/analytics/director")).status).toBe(403);
    },
  );
});

describe("every route of the approved role table", () => {
  it.each(ROUTES)("row %i: %s %s answers 401 with no session, 403 for the other roles, and lets its roles through", async (_row, method, path, roles) => {
    const anonymous = await send(api, method, path);
    expect(anonymous.status, "no session").toBe(401);
    expect(anonymous.body).toEqual({ success: false, error: NOT_LOGGED_IN });

    for (const role of ANY) {
      const res = await send(as(ACCOUNT[role]), method, path);
      if (roles.includes(role)) {
        expect([401, 403], `${role} is allowed`).not.toContain(res.status);
        expect(res.status, `${role} reaches the handler`).toBeLessThan(500);
      } else {
        expect(res.status, `${role} is refused`).toBe(403);
        expect(res.body).toEqual({ success: false, error: FORBIDDEN });
      }
    }
  });

  it("keeps the three public routes open with no session", async () => {
    expect((await api.post("/api/auth/login", {})).status).toBe(400);
    expect((await api.post("/api/auth/register-request", {})).status).toBe(400);
    expect((await api.post("/api/auth/logout")).status).toBe(200);
  });

  it("answers a body it cannot read, and an unknown path, before any session check", async () => {
    const bad = await fetch(`${server().baseUrl}/api/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("BAD_REQUEST");

    const unknown = await api.get("/api/no-such-path");
    expect(unknown.status).toBe(404);
    const oldAnalytics = await api.get("/api/analytics/dashboard");
    expect(oldAnalytics.status).toBe(404);
  });
});

describe("CORS", () => {
  const preflight = (origin: string) =>
    fetch(`${server().baseUrl}/api/assets`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
    });

  it("lets the web app's origin call with credentials", async () => {
    const res = await preflight(TEST_WEB_ORIGIN);

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(TEST_WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");

    const cookie = await logIn(USERS.staffTsg);
    const get = await fetch(`${server().baseUrl}/api/assets`, { headers: { Origin: TEST_WEB_ORIGIN, Cookie: cookie } });
    expect(get.status).toBe(200);
    expect(get.headers.get("access-control-allow-origin")).toBe(TEST_WEB_ORIGIN);
    expect(get.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it.each(["https://elsewhere.example", "http://127.0.0.1:5173", "http://localhost:3000"])(
    "gives %s no Access-Control-Allow-Origin, so a browser keeps the answer from that page",
    async (origin) => {
      const res = await preflight(origin);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();

      const get = await fetch(`${server().baseUrl}/api/assets`, { headers: { Origin: origin } });
      expect(get.headers.get("access-control-allow-origin")).toBeNull();
    },
  );
});

describe("startup: SESSION_SECRET is required", () => {
  it.each([
    ["missing", undefined, /Missing required environment variable\(s\): SESSION_SECRET/],
    ["shorter than 32 characters", "too-short", /SESSION_SECRET must be at least 32 characters/],
  ])("stops the server before it listens when the secret is %s", async (_label, secret, message) => {
    await expect(startTestServer(loadTestDatabaseConfig(), { SESSION_SECRET: secret })).rejects.toThrow(message);
  });
});
