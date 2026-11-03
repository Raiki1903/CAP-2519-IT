/**
 * No answer holds a password or a hash: the sign-up path, the session answers, and every list screen. (C-03, issue #10)
 * Covers POST /api/auth/register-request and /login, GET /api/auth/me, PUT /api/auth/account, and the GET routes of
 * every feature.
 * Fixtures: the seeded accounts and assets, the roles, and one invented applicant, made Active and logged in during
 * the first test.
 */
import { describe, expect, it } from "vitest";
import { ASSETS, LAB, ROLE_IDS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, as, db, server } = useApiHarness();

const PLAIN = "test-password-leak-check";
const SEEDED_PASSWORDS = Object.values(USERS).map((u) => u.password);

function expectNoSecret(label: string, body: unknown): void {
  const text = JSON.stringify(body);
  expect(text, label).not.toContain("scrypt$");
  expect(text, label).not.toContain(PLAIN);
  for (const password of SEEDED_PASSWORDS) expect(text, label).not.toContain(password);
}

describe("the sign-up path and the session answers", () => {
  it("hold neither the password nor a hash", async () => {
    const applicant = { firstName: "Test", lastName: "Leak Check", email: "test.leak.check@dlsu.edu.ph", idNumber: 94000001, userType: "STUDENT", centerIds: [LAB.centerId], password: PLAIN };

    const signUp = await api.post("/api/auth/register-request", applicant);
    expect(signUp.status).toBe(201);
    expectNoSecret("sign-up", signUp.body);

    const { user_id: userId } = await db.users.update({ where: { email: applicant.email }, data: { account_status: "ACTIVE" } });
    await db.user_roles.create({ data: { user_id: userId, role_id: ROLE_IDS.RESEARCHER } });

    const login = await api.post("/api/auth/login", { email: applicant.email, password: PLAIN });
    expect(login.status).toBe(200);
    expectNoSecret("login", login.body);

    const newUser: TestUser = { ...USERS.custodianA, userId: login.body.user.userId, email: applicant.email, password: PLAIN };
    const me = await as(newUser).get("/api/auth/me");
    expect(me.status).toBe(200);
    expectNoSecret("/me", me.body);

    const account = await as(newUser).put("/api/auth/account", { firstName: "Test", lastName: "Leak Check" });
    expect(account.status).toBe(200);
    expectNoSecret("account", account.body);
  });
});

describe("the server's own output", () => {
  /** Waits for a line to reach the captured output, since the child's output arrives a little after its answer. */
  async function outputOnceItHas(text: string): Promise<string> {
    for (let attempt = 0; attempt < 40 && !server().output().includes(text); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(server().output()).toContain(text);
    return server().output();
  }

  it("holds no part of a password sent in a body that cannot be parsed", async () => {
    const res = await fetch(`${server().baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: `{"password": ${PLAIN}}`,
    });
    expect(res.status).toBe(400);

    const output = await outputOnceItHas("request body could not be read");
    expect(output).not.toContain(PLAIN.slice(0, 8));
  });
});

describe("the list screens", () => {
  const custodianHistory = `/api/assets/${ASSETS.onLoan.tag}/history`;

  it.each<[string, TestUser, string]>([
    ["Staff", USERS.staffTsg, "/api/assets"],
    ["Staff", USERS.staffTsg, custodianHistory],
    ["Staff", USERS.staffTsg, "/api/loans"],
    ["Staff", USERS.staffTsg, "/api/maintenance"],
    ["Staff", USERS.staffTsg, "/api/retirements"],
    ["Staff", USERS.staffTsg, "/api/inspections"],
    ["Staff", USERS.staffTsg, "/api/inspections/log"],
    ["Staff", USERS.staffTsg, "/api/lookups"],
    ["Staff", USERS.staffTsg, "/api/analytics/location-status"],
    ["Staff", USERS.staffTsg, "/api/analytics/advanced/inspection-progress"],
    ["Staff", USERS.staffTsg, "/api/analytics/tsg"],
    ["Lab Head", USERS.labHead, "/api/analytics/lab-head"],
    ["Lab Head", USERS.labHead, "/api/analytics/advanced/idle-time"],
    ["Lab Head", USERS.labHead, "/api/analytics/advanced/idle-frequency"],
    ["Lab Head", USERS.labHead, "/api/analytics/advanced/loan-recommender"],
    ["Director", USERS.director, "/api/analytics/director"],
    ["Custodian", USERS.custodianA, "/api/assets"],
    ["Custodian", USERS.custodianA, "/api/loans"],
  ])("%s, as seeded account: holds no hash at %s", async (_, user, urlPath) => {
    const res = await as(user).get(urlPath);

    expect(res.status, urlPath).toBe(200);
    expectNoSecret(urlPath, res.body);
  });
});
