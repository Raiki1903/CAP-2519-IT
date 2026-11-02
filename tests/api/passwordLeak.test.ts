/**
 * No answer holds a password or a hash: the sign-up path, the session answers, and every list screen. (C-03, issue #10)
 * Covers POST /api/auth/register-request, /approve-registration, and /login, GET /api/auth/me and /pending-registrations,
 * PUT /api/auth/account, and the GET routes of every feature.
 * Fixtures: the seeded accounts and assets, and one invented applicant, approved and logged in during the first test.
 */
import { describe, expect, it } from "vitest";
import { ASSETS, LAB, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, as } = useApiHarness();

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
    const applicant = { firstName: "Test", lastName: "Leak Check", email: "leak.check@example.test", idNumber: 94000001, labAffiliation: LAB.shortCode, password: PLAIN };

    const signUp = await api.post("/api/auth/register-request", applicant);
    expect(signUp.status).toBe(200);
    expectNoSecret("sign-up", signUp.body);

    const pending = await as(USERS.labHead).get("/api/auth/pending-registrations");
    expect(pending.status).toBe(200);
    expectNoSecret("pending list", pending.body);

    const approval = await as(USERS.labHead).post("/api/auth/approve-registration", { requestId: signUp.body.registration.id });
    expect(approval.status).toBe(200);
    expectNoSecret("approval", approval.body);

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

describe("the list screens", () => {
  const custodianHistory = `/api/assets/${ASSETS.onLoan.tag}/custodian-history`;

  it.each<[string, TestUser, string]>([
    ["Staff", USERS.staffTsg, "/api/assets"],
    ["Staff", USERS.staffTsg, custodianHistory],
    ["Staff", USERS.staffTsg, "/api/asset_loans"],
    ["Staff", USERS.staffTsg, "/api/asset_repairs"],
    ["Staff", USERS.staffTsg, "/api/asset_returns"],
    ["Staff", USERS.staffTsg, "/api/asset_transfers"],
    ["Staff", USERS.staffTsg, "/api/asset_disposals"],
    ["Staff", USERS.staffTsg, "/api/asset_reports"],
    ["Staff", USERS.staffTsg, "/api/asset-reports"],
    ["Staff", USERS.staffTsg, "/api/lookups"],
    ["Staff", USERS.staffTsg, "/api/lookups/users"],
    ["Staff", USERS.staffTsg, "/api/analytics/location-status"],
    ["Staff", USERS.staffTsg, "/api/analytics/advanced/inspection-progress"],
    ["Staff", USERS.staffTsg, "/api/analytics/tsg"],
    ["Lab Head", USERS.labHead, "/api/analytics/lab-head"],
    ["Lab Head", USERS.labHead, "/api/analytics/advanced/idle-time"],
    ["Lab Head", USERS.labHead, "/api/analytics/advanced/idle-frequency"],
    ["Lab Head", USERS.labHead, "/api/analytics/advanced/loan-recommender"],
    ["Director", USERS.director, "/api/analytics/director"],
    ["Custodian", USERS.custodianA, "/api/assets"],
    ["Custodian", USERS.custodianA, "/api/asset_loans"],
    ["Custodian", USERS.custodianA, "/api/asset_transfers"],
  ])("%s, as seeded account: holds no hash at %s", async (_, user, urlPath) => {
    const res = await as(user).get(urlPath);

    expect(res.status, urlPath).toBe(200);
    expectNoSecret(urlPath, res.body);
  });
});
