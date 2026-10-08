/**
 * Registration API: sign-up requests, the Lab Head's pending list and decisions, and direct registration.
 * Covers POST /api/auth/register-request, GET /api/auth/pending-registrations, POST /api/auth/approve-registration,
 * POST /api/auth/reject-registration, POST /api/auth/register. Workflow: account sign-up and approval.
 * Fixtures: the seeded accounts (for duplicate checks), the roles (ROLE_IDS), and the TEST lab (LAB). New applicants
 * are invented here. The pending list lives in the server's memory and in pending_registrations.json in its
 * temporary working folder (H-17), so this file has its own server and starts with an empty list.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAB, USERS, type RoleName } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, server } = useApiHarness();

let applicantCount = 0;

/** A new, unique applicant. Id numbers start at 91000001, clear of the seeded accounts. */
function applicant(extra: Record<string, unknown> = {}) {
  applicantCount += 1;
  return {
    firstName: "Test",
    lastName: `Applicant ${applicantCount}`,
    email: `applicant.${applicantCount}@example.test`,
    idNumber: 91000000 + applicantCount,
    ...extra,
  };
}

async function requestSignUp(extra: Record<string, unknown> = {}) {
  const body = applicant(extra);
  const res = await api.post("/api/auth/register-request", body);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { body, registration: res.body.registration };
}

const pendingIds = async (): Promise<string[]> =>
  (await api.get("/api/auth/pending-registrations")).body.pendingRegistrations.map((r: { id: string }) => r.id);

const pendingFile = (): { id: string; status: string }[] =>
  JSON.parse(fs.readFileSync(path.join(server().workDir, "pending_registrations.json"), "utf-8"));

const roleNamesOf = async (userId: number): Promise<string[]> =>
  (await db.user_roles.findMany({ where: { user_id: userId }, include: { roles: true } })).map((ur) => ur.roles.role_name);

describe("POST /api/auth/register-request", () => {
  it("answers 200 with a PENDING registration and the default role, lab, and user type", async () => {
    const body = applicant({ password: "test-password-applicant" });
    const res = await api.post("/api/auth/register-request", body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.registration).toMatchObject({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      idNumber: body.idNumber,
      userType: "STUDENT",
      requestedRole: "Custodian",
      labAffiliation: "CITe4D",
      status: "PENDING",
    });
    expect(res.body.registration.id).toMatch(/^REG-\d{6}$/);
  });

  it("writes the request to pending_registrations.json in the server's working folder, not the database (known defect H-17)", async () => {
    const { body, registration } = await requestSignUp();

    const saved = pendingFile().find((r) => r.id === registration.id);
    expect(saved).toMatchObject({ email: body.email, status: "PENDING" });
    expect(await db.users.count({ where: { email: body.email } })).toBe(0);
  });

  it("stores password123 when no password is sent (known defect C-03)", async () => {
    const { registration } = await requestSignUp();

    expect(registration.password).toBe("password123");
  });

  it("answers 400 when the first name, last name, email, or id number is missing", async () => {
    for (const missing of ["firstName", "lastName", "email", "idNumber"] as const) {
      const body: Record<string, unknown> = applicant();
      delete body[missing];
      const res = await api.post("/api/auth/register-request", body);
      expect(res.status, missing).toBe(400);
    }
  });

  it("answers 400 for an email or an id number that already belongs to an account", async () => {
    const sameEmail = await api.post("/api/auth/register-request", applicant({ email: USERS.custodianA.email }));
    const sameIdNumber = await api.post("/api/auth/register-request", applicant({ idNumber: USERS.custodianA.idNumber }));

    expect(sameEmail.status).toBe(400);
    expect(sameIdNumber.status).toBe(400);
  });
});

describe("GET /api/auth/pending-registrations", () => {
  it("lists pending requests newest first", async () => {
    const older = await requestSignUp();
    const newer = await requestSignUp();

    const res = await api.get("/api/auth/pending-registrations");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids: string[] = res.body.pendingRegistrations.map((r: { id: string }) => r.id);
    expect(ids.indexOf(newer.registration.id)).toBeLessThan(ids.indexOf(older.registration.id));
    expect(res.body.pendingRegistrations.every((r: { status: string }) => r.status === "PENDING")).toBe(true);
  });

  it("includes each applicant's password, to any caller (known defect C-04)", async () => {
    const { registration } = await requestSignUp({ password: "test-password-visible" });

    const res = await api.get("/api/auth/pending-registrations");

    const listed = res.body.pendingRegistrations.find((r: { id: string }) => r.id === registration.id);
    expect(listed.password).toBe("test-password-visible");
  });
});

describe("POST /api/auth/approve-registration", () => {
  it("creates the account with its role and lab link, and removes the request from the list and the file", async () => {
    const { body, registration } = await requestSignUp({ labAffiliation: LAB.shortCode, userType: "FACULTY", password: "test-password-approved" });

    const res = await api.post("/api/auth/approve-registration", { requestId: registration.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const created = await db.users.findUniqueOrThrow({ where: { email: body.email } });
    expect(created).toMatchObject({ first_name: body.firstName, last_name: body.lastName, id_number: body.idNumber, user_type: "FACULTY" });
    expect(await roleNamesOf(created.user_id)).toEqual(["CUSTODIAN"]);
    const links = await db.user_centers.findMany({ where: { user_id: created.user_id } });
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
    expect(await pendingIds()).not.toContain(registration.id);
    expect(pendingFile().map((r) => r.id)).not.toContain(registration.id);
  });

  it("answers with the created row, password included (known defect, 01C 4.1)", async () => {
    const { body, registration } = await requestSignUp({ labAffiliation: LAB.shortCode, password: "test-password-echoed" });

    const res = await api.post("/api/auth/approve-registration", { requestId: registration.id });

    expect(res.body.user).toMatchObject({ email: body.email, password: "test-password-echoed" });
  });

  it.each<[string, RoleName]>([
    ["Custodian", "CUSTODIAN"],
    ["Lab Head", "LAB_HEAD"],
    ["TSG", "TSG_STAFF"],
    ["ITS", "ADMIN"],
  ])("gives a request for role %s the database role %s (M-11: ITS becomes ADMIN)", async (requestedRole, expectedRole) => {
    const { body, registration } = await requestSignUp({ requestedRole, labAffiliation: LAB.shortCode });

    await api.post("/api/auth/approve-registration", { requestId: registration.id });

    const created = await db.users.findUniqueOrThrow({ where: { email: body.email } });
    expect(await roleNamesOf(created.user_id)).toEqual([expectedRole]);
  });

  it("creates a new research center for a lab it does not know, and links the account to it (new finding)", async () => {
    const { body, registration } = await requestSignUp({ labAffiliation: "Test Unknown Lab (TESTX)" });

    const res = await api.post("/api/auth/approve-registration", { requestId: registration.id });

    expect(res.status).toBe(200);
    const center = await db.research_centers.findUniqueOrThrow({ where: { short_code: "TESTX" } });
    expect(center).toMatchObject({ name: "Test Unknown Lab (TESTX)", location: "MANILA" });
    const created = await db.users.findUniqueOrThrow({ where: { email: body.email } });
    const links = await db.user_centers.findMany({ where: { user_id: created.user_id } });
    expect(links.map((l) => l.center_id)).toEqual([center.center_id]);
  });

  it("answers 404 for an unknown request id with no applicant details", async () => {
    const res = await api.post("/api/auth/approve-registration", { requestId: "REG-000000" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("creates an account with the requested role from the body alone when the request id is unknown (known defect C-05)", async () => {
    const body = applicant({ requestId: "REG-000000", requestedRole: "ITS", labAffiliation: LAB.shortCode });

    const res = await api.post("/api/auth/approve-registration", body);

    expect(res.status).toBe(200);
    const created = await db.users.findUniqueOrThrow({ where: { email: body.email as string } });
    expect(await roleNamesOf(created.user_id)).toEqual(["ADMIN"]);
  });
});

describe("POST /api/auth/reject-registration", () => {
  it("removes the request from the list and the file, and creates no account", async () => {
    const { body, registration } = await requestSignUp();

    const res = await api.post("/api/auth/reject-registration", { requestId: registration.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await pendingIds()).not.toContain(registration.id);
    expect(pendingFile().map((r) => r.id)).not.toContain(registration.id);
    expect(await db.users.count({ where: { email: body.email } })).toBe(0);
  });

  it("answers 200 for an unknown request id as well", async () => {
    const res = await api.post("/api/auth/reject-registration", { requestId: "REG-000000" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("POST /api/auth/register (no caller)", () => {
  it("creates a CUSTODIAN account at once, with no approval step (C-05 family)", async () => {
    const body = applicant({ password: "test-password-direct" });

    const res = await api.post("/api/auth/register", body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, user: { firstName: body.firstName, lastName: body.lastName, email: body.email } });
    const created = await db.users.findUniqueOrThrow({ where: { email: body.email } });
    expect(created.user_type).toBe("STUDENT");
    expect(await roleNamesOf(created.user_id)).toEqual(["CUSTODIAN"]);
    expect(await db.user_centers.count({ where: { user_id: created.user_id } })).toBe(0);
  });

  it("links the account to the lab named by centerId", async () => {
    const body = applicant({ password: "test-password-direct", centerId: LAB.centerId, userType: "FACULTY" });

    await api.post("/api/auth/register", body);

    const created = await db.users.findUniqueOrThrow({ where: { email: body.email } });
    expect(created.user_type).toBe("FACULTY");
    const links = await db.user_centers.findMany({ where: { user_id: created.user_id } });
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
  });

  it("answers 400 when any of first name, last name, email, password, or id number is missing", async () => {
    for (const missing of ["firstName", "lastName", "email", "password", "idNumber"] as const) {
      const body: Record<string, unknown> = applicant({ password: "test-password-direct" });
      delete body[missing];
      const res = await api.post("/api/auth/register", body);
      expect(res.status, missing).toBe(400);
    }
  });

  it("answers 400 for an email or an id number that already belongs to an account", async () => {
    const usersBefore = await db.users.count();
    const sameEmail = await api.post("/api/auth/register", applicant({ password: "x", email: USERS.custodianA.email }));
    const sameIdNumber = await api.post("/api/auth/register", applicant({ password: "x", idNumber: USERS.custodianA.idNumber }));

    expect(sameEmail.status).toBe(400);
    expect(sameIdNumber.status).toBe(400);
    expect(await db.users.count()).toBe(usersBefore);
  });
});
