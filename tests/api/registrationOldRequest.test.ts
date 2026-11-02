/**
 * Registration API: sign-up requests filed before passwords were hashed, which still hold plain text or nothing.
 * Covers POST /api/auth/approve-registration and POST /api/auth/reject-registration for such a request. (C-03, issue #10)
 * Fixtures: the seeded Lab Head, and invented requests written to a second server's temporary pending file before it
 * starts, since the server reads the file only once. The real pending_registrations.json is never read.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { loadTestDatabaseConfig } from "../setup/testDatabase";
import { startTestServer, type RunningServer } from "../setup/testServer";

const { db, logIn } = useApiHarness();

const REFUSED = "This request was made before passwords were protected. Decline it and ask the applicant to sign up again.";

function oldRequest(id: string, email: string, idNumber: number, password?: string) {
  return {
    id,
    firstName: "Test",
    lastName: "Old Request",
    email,
    idNumber,
    userType: "STUDENT",
    requestedRole: "Custodian",
    labAffiliation: LAB.shortCode,
    password,
    submittedAt: "Oct 11, 2026",
    status: "PENDING",
  };
}

const PLAIN_REQUEST = oldRequest("REG-100001", "old.plain@example.test", 93000001, "test-password-old-plain");
const NO_PASSWORD_REQUEST = oldRequest("REG-100002", "old.none@example.test", 93000002);

let oldServer: RunningServer;
let cookie: string;

/** Sends a Lab Head's request to the server that holds the old requests. A cookie from the harness's server works: same secret. */
async function asLabHead(method: string, urlPath: string, body?: unknown) {
  const response = await fetch(`${oldServer.baseUrl}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const pendingIds = async (): Promise<string[]> =>
  (await asLabHead("GET", "/api/auth/pending-registrations")).body.pendingRegistrations.map((r: { id: string }) => r.id);

beforeAll(async () => {
  cookie = await logIn(USERS.labHead);
  oldServer = await startTestServer(loadTestDatabaseConfig(), {}, [PLAIN_REQUEST, NO_PASSWORD_REQUEST]);
});

afterAll(async () => {
  await oldServer?.stop();
});

describe("a sign-up request filed before passwords were hashed", () => {
  it.each([
    ["a plain password", PLAIN_REQUEST],
    ["no password", NO_PASSWORD_REQUEST],
  ])("with %s: approval answers 409, creates nothing, and keeps the request", async (_, request) => {
    const res = await asLabHead("POST", "/api/auth/approve-registration", { requestId: request.id });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: REFUSED });
    expect(await db.users.count({ where: { email: request.email } })).toBe(0);
    expect(await pendingIds()).toContain(request.id);
  });

  it("does not put the plain password in the pending list", async () => {
    const res = await asLabHead("GET", "/api/auth/pending-registrations");

    expect(JSON.stringify(res.body)).not.toContain(PLAIN_REQUEST.password);
  });

  it("can still be declined", async () => {
    const res = await asLabHead("POST", "/api/auth/reject-registration", { requestId: PLAIN_REQUEST.id });

    expect(res.status).toBe(200);
    expect(await pendingIds()).not.toContain(PLAIN_REQUEST.id);
  });
});
