/**
 * Registration API: sign-ups stored as Pending accounts.
 * Covers POST /api/auth/register-request, and that POST /api/auth/register and the Lab Head's old sign-up routes are
 * gone. Workflow: account sign-up.
 * Fixtures: the seeded accounts (for duplicate checks) and the TEST lab (LAB). A second lab and the applicants are
 * invented here.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { ID_NUMBER_MESSAGE, SIGN_UP_EMAIL_MESSAGE } from "../../shared/constants/signUp";
import { isPasswordHash, verifyPassword } from "../../server/shared/services/passwords";
import { LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const DEFAULT_PASSWORD = "test-password-applicant";
const asLabHead = as(USERS.labHead);
const SENT = { success: true, message: "Your sign-up was sent. The IT Admin will review it. You can log in once it is approved." };
const TAKEN = "An account with this email or ID number already exists. Ask the IT Admin.";
const SECOND_LAB = { centerId: 2, name: "Test Second Lab", shortCode: "TEST2" };

beforeAll(async () => {
  await db.research_centers.create({
    data: { center_id: SECOND_LAB.centerId, name: SECOND_LAB.name, short_code: SECOND_LAB.shortCode, location: "LAGUNA" },
  });
});

let applicantCount = 0;

/** A new, unique applicant with a DLSU email and one lab. Id numbers start at 91000001, clear of the seeded accounts. */
function applicant(extra: Record<string, unknown> = {}) {
  applicantCount += 1;
  return {
    firstName: "Test",
    lastName: `Applicant ${applicantCount}`,
    email: `test.applicant.${applicantCount}@dlsu.edu.ph`,
    idNumber: 91000000 + applicantCount,
    userType: "STUDENT",
    password: DEFAULT_PASSWORD,
    centerIds: [LAB.centerId],
    ...extra,
  };
}

const accountsWithEmail = (email: string) => db.users.count({ where: { email } });

describe("POST /api/auth/register-request", () => {
  it("answers 201 and stores a Pending account with no role, linked to the labs asked for, with the email in lower case", async () => {
    const body = applicant({ email: "Test.Mixed.Case@DLSU.edu.ph", userType: "FACULTY", centerIds: [LAB.centerId, SECOND_LAB.centerId] });

    const res = await api.post("/api/auth/register-request", body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(SENT);
    const row = await db.users.findUniqueOrThrow({ where: { email: "test.mixed.case@dlsu.edu.ph" }, include: { user_roles: true, user_centers: true } });
    expect(row).toMatchObject({ first_name: body.firstName, last_name: body.lastName, id_number: body.idNumber, user_type: "FACULTY", account_status: "PENDING" });
    expect(row.email).toBe("test.mixed.case@dlsu.edu.ph");
    expect(row.user_roles).toEqual([]);
    expect(row.user_centers.map((uc) => uc.center_id).sort()).toEqual([LAB.centerId, SECOND_LAB.centerId]);
  });

  it("stores only the password's hash, and answers neither the password nor a hash (C-03, C-04)", async () => {
    const plain = "test-password-in-the-row";
    const body = applicant({ password: plain });

    const res = await api.post("/api/auth/register-request", body);

    expect(JSON.stringify(res.body)).not.toContain(plain);
    expect(JSON.stringify(res.body)).not.toContain("scrypt$");
    const { password } = await db.users.findUniqueOrThrow({ where: { email: body.email } });
    expect(isPasswordHash(password)).toBe(true);
    expect(await verifyPassword(plain, password)).toBe(true);
  });

  it("accepts an ID number sent as text, and the same lab twice as one link", async () => {
    const body = applicant({ centerIds: [LAB.centerId, LAB.centerId] });

    const res = await api.post("/api/auth/register-request", { ...body, idNumber: String(body.idNumber) });

    expect(res.status).toBe(201);
    const row = await db.users.findUniqueOrThrow({ where: { email: body.email }, include: { user_centers: true } });
    expect(row.id_number).toBe(body.idNumber);
    expect(row.user_centers).toHaveLength(1);
  });

  it("does not read a role from the body: the account stays without one", async () => {
    const body = applicant({ role: "IT_ADMIN", requestedRole: "Admin" });

    expect((await api.post("/api/auth/register-request", body)).status).toBe(201);

    const row = await db.users.findUniqueOrThrow({ where: { email: body.email }, include: { user_roles: true } });
    expect(row.user_roles).toEqual([]);
  });

  it.each([
    ["an email outside DLSU", { email: "test.applicant@example.test" }, SIGN_UP_EMAIL_MESSAGE],
    ["an email that is only the domain", { email: "@dlsu.edu.ph" }, SIGN_UP_EMAIL_MESSAGE],
    ["an ID number of 7 digits", { idNumber: 9100001 }, ID_NUMBER_MESSAGE],
    ["an ID number of 9 digits", { idNumber: 910000001 }, ID_NUMBER_MESSAGE],
    ["an ID number starting with 0", { idNumber: "01234567" }, ID_NUMBER_MESSAGE],
    ["an ID number with letters", { idNumber: "1234567A" }, ID_NUMBER_MESSAGE],
    ["an unknown user type", { userType: "ADMIN" }, "Choose Student, Faculty, or Staff as your user type."],
    ["no user type", { userType: undefined }, "Choose Student, Faculty, or Staff as your user type."],
    ["no labs", { centerIds: [] }, "Choose at least one lab."],
    ["no lab list", { centerIds: undefined }, "Choose at least one lab."],
    ["a lab id as text", { centerIds: ["1"] }, "Choose at least one lab."],
    ["an unknown lab", { centerIds: [LAB.centerId, 999999] }, "One of the labs you chose is not a known lab."],
    ["no password", { password: undefined }, "Password must be at least 8 characters long."],
    ["a password of 7 characters", { password: "x".repeat(7) }, "Password must be at least 8 characters long."],
    ["a password of 129 characters", { password: "x".repeat(129) }, "Password must be at most 128 characters long."],
    ["a password that is not a string", { password: 12345678 }, "Password must be at least 8 characters long."],
    ["no first name", { firstName: undefined }, "Missing required registration fields."],
    ["a last name of spaces", { lastName: "   " }, "Missing required registration fields."],
    ["no email", { email: undefined }, "Missing required registration fields."],
    ["no ID number", { idNumber: undefined }, "Missing required registration fields."],
  ])("answers 400 for %s, and stores nothing", async (_label, change, message) => {
    const body = applicant(change);

    const res = await api.post("/api/auth/register-request", body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await db.users.count({ where: { last_name: body.lastName } })).toBe(0);
  });

  it("answers 201 for a password of 8 and of 128 characters", async () => {
    const shortest = await api.post("/api/auth/register-request", applicant({ password: "x".repeat(8) }));
    const longest = await api.post("/api/auth/register-request", applicant({ password: "x".repeat(128) }));

    expect([shortest.status, longest.status]).toEqual([201, 201]);
  });

  it("answers 409 for an email an account has, in any letter case, and keeps one account (issue #14)", async () => {
    const first = applicant();
    expect((await api.post("/api/auth/register-request", first)).status).toBe(201);

    const again = await api.post("/api/auth/register-request", applicant({ email: ` ${first.email.toUpperCase()} ` }));

    expect(again.status).toBe(409);
    expect(again.body).toEqual({ success: false, error: TAKEN });
    expect(await accountsWithEmail(first.email)).toBe(1);
  });

  it("answers 409 for an ID number an account has (issue #81)", async () => {
    const res = await api.post("/api/auth/register-request", applicant({ idNumber: USERS.custodianA.idNumber }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: TAKEN });
  });

  it("stores one account when the same sign-up is sent twice at once (issues #14, #81)", async () => {
    const body = applicant();

    const answers = await Promise.all([api.post("/api/auth/register-request", body), api.post("/api/auth/register-request", body)]);

    expect(answers.map((a) => a.status).sort()).toEqual([201, 409]);
    expect(await accountsWithEmail(body.email)).toBe(1);
  });
});

describe("the Lab Head's sign-up routes (removed in Batch 2b)", () => {
  it.each([
    ["GET", "/api/auth/pending-registrations"],
    ["POST", "/api/auth/approve-registration"],
    ["POST", "/api/auth/reject-registration"],
  ])("answer 404 to %s %s, even for a Lab Head, and create no account", async (method, path) => {
    const body = applicant({ requestId: "REG-000000" });

    const res = method === "GET" ? await asLabHead.get(path) : await asLabHead.post(path, body);

    expect(res.status).toBe(404);
    expect(await accountsWithEmail(body.email)).toBe(0);
  });
});

describe("POST /api/auth/register (deleted, issue #70)", () => {
  it("answers 404 for a Lab Head with a full body, and creates no account", async () => {
    const body = applicant({ password: "test-password-direct" });

    const res = await asLabHead.post("/api/auth/register", body);

    expect(res.status).toBe(404);
    expect(await accountsWithEmail(body.email)).toBe(0);
  });
});
