/**
 * The IT Admin's sign-up endpoints: the Pending list, approve, and reject.
 * Covers GET /api/users?status=PENDING, PUT /api/users/:userId/approve, and PUT /api/users/:userId/reject, and that an
 * approved or rejected sign-up logs in as it should. Workflow: account sign-up and approval.
 * Fixtures: the seeded accounts (the IT Admin and the roles refused), the TEST lab (LAB). A second lab and the
 * applicants, who sign up through POST /api/auth/register-request, are invented here.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const asItAdmin = as(USERS.admin);
const FORBIDDEN = "Your role is not allowed to do this.";
const PASSWORD = "test-password-signup";
const SECOND_LAB = { centerId: 2, name: "Test Second Lab", shortCode: "TEST2" };

beforeAll(async () => {
  await db.research_centers.create({
    data: { center_id: SECOND_LAB.centerId, name: SECOND_LAB.name, short_code: SECOND_LAB.shortCode, location: "LAGUNA" },
  });
});

let applicantCount = 0;

/**
 * Signs a new applicant up for both labs, through the public route.
 *
 * @returns the sign-up body and the new account's id
 */
async function signUp(extra: Record<string, unknown> = {}) {
  applicantCount += 1;
  const body = {
    firstName: "Test",
    lastName: `Sign Up ${applicantCount}`,
    email: `test.signup.${applicantCount}@dlsu.edu.ph`,
    idNumber: 93000000 + applicantCount,
    userType: "STUDENT",
    password: PASSWORD,
    centerIds: [LAB.centerId, SECOND_LAB.centerId],
    ...extra,
  };
  const res = await api.post("/api/auth/register-request", body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const { user_id: userId } = await db.users.findUniqueOrThrow({ where: { email: body.email } });
  return { body, userId };
}

const statusOf = async (userId: number) => (await db.users.findUniqueOrThrow({ where: { user_id: userId } })).account_status;
const logRowsFor = (userId: number) =>
  db.activity_log.findMany({ where: { target_user_id: userId, event_type: { in: ["SIGNUP_APPROVED", "SIGNUP_REJECTED"] } }, orderBy: { log_id: "asc" } });

describe("GET /api/users?status=PENDING", () => {
  it("lists only Pending sign-ups, oldest first, in the User shape with no password", async () => {
    const older = await signUp();
    const newer = await signUp({ userType: "FACULTY" });

    const res = await asItAdmin.get("/api/users?status=PENDING");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids: number[] = res.body.users.map((u: { userId: number }) => u.userId);
    expect(ids.indexOf(older.userId)).toBeLessThan(ids.indexOf(newer.userId));
    expect(ids).not.toContain(USERS.custodianA.userId);
    expect(res.body.users.every((u: { accountStatus: string }) => u.accountStatus === "PENDING")).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/password|scrypt\$/);
    expect(res.body.users.find((u: { userId: number }) => u.userId === newer.userId)).toEqual({
      userId: newer.userId,
      firstName: newer.body.firstName,
      lastName: newer.body.lastName,
      email: newer.body.email,
      idNumber: newer.body.idNumber,
      userType: "FACULTY",
      role: null,
      roleLabel: null,
      accountStatus: "PENDING",
      labs: [{ centerId: LAB.centerId, code: LAB.shortCode }, { centerId: SECOND_LAB.centerId, code: SECOND_LAB.shortCode }],
      headOf: null,
    });
  });

  it.each([
    ["?status=pending", "Choose a status: PENDING, ACTIVE, INACTIVE, or REJECTED."],
    ["?status=PENDING&status=ACTIVE", 'Send the filter "status" once.'],
    ["?role=LAB_HEAD", "Choose a role: Researcher, TSG Staff, AdRIC Director, AdRIC Secretary, or IT Admin."],
    ["?centerId=abc", "The lab id must be a positive whole number."],
    ["?centerId=999999", "No lab has this id."],
    ["?sort=name", 'Unknown filter "sort". Use status, role, centerId, or q.'],
    [`?q=${"x".repeat(101)}`, "The search can be at most 100 characters."],
  ])("answers 400 for the query %j", async (query, message) => {
    const res = await asItAdmin.get(`/api/users${query}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
  });
});

describe("who may use the sign-up endpoints", () => {
  const routes = (userId: number): [string, string][] => [["GET", "/api/users?status=PENDING"], ["PUT", `/api/users/${userId}/approve`], ["PUT", `/api/users/${userId}/reject`]];
  const send = (client: ReturnType<typeof as> | typeof api, method: string, path: string) =>
    method === "GET" ? client.get(path) : client.put(path, { role: "RESEARCHER", centerIds: [LAB.centerId] });

  it("answers 401 to every route with no session", async () => {
    const { userId } = await signUp();

    for (const [method, path] of routes(userId)) {
      expect((await send(api, method, path)).status, `${method} ${path}`).toBe(401);
    }
    expect(await statusOf(userId)).toBe("PENDING");
  });

  it.each([USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])(
    "answers 403 to $lastName on every route, and the sign-up stays Pending",
    async (user) => {
      const { userId } = await signUp();

      for (const [method, path] of routes(userId)) {
        const res = await send(as(user), method, path);
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(res.body).toEqual({ success: false, error: FORBIDDEN });
      }
      expect(await statusOf(userId)).toBe("PENDING");
    },
  );
});

describe("PUT /api/users/:userId/approve", () => {
  it("approves a Researcher with one of the two labs asked for: Active, decided by the IT Admin, one role, a log row", async () => {
    const { body, userId } = await signUp();

    const res = await asItAdmin.put(`/api/users/${userId}/approve`, { role: "RESEARCHER", centerIds: [SECOND_LAB.centerId] });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      userId, role: "RESEARCHER", roleLabel: "Researcher", accountStatus: "ACTIVE", labs: [{ centerId: SECOND_LAB.centerId, code: SECOND_LAB.shortCode }],
    });
    const row = await db.users.findUniqueOrThrow({ where: { user_id: userId }, include: { user_roles: { include: { roles: true } }, user_centers: true } });
    expect(row).toMatchObject({ account_status: "ACTIVE", status_decided_by_id: USERS.admin.userId });
    expect(row.status_decided_at).toBeInstanceOf(Date);
    expect(row.user_roles.map((ur) => ur.roles.role_name)).toEqual(["RESEARCHER"]);
    expect(row.user_centers.map((uc) => uc.center_id)).toEqual([SECOND_LAB.centerId]);
    const logs = await logRowsFor(userId);
    expect(logs).toMatchObject([{ event_type: "SIGNUP_APPROVED", actor_id: USERS.admin.userId, details: "Role: RESEARCHER; labs: TEST2" }]);
    expect(logs[0].details).not.toContain(body.email);
  });

  it("lets the approved account log in with its password, the Researcher view, and only the approved lab", async () => {
    const { body, userId } = await signUp();
    await asItAdmin.put(`/api/users/${userId}/approve`, { role: "RESEARCHER", centerIds: [LAB.centerId] });

    const login = await api.post("/api/auth/login", { email: body.email, password: PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.role).toBe("Custodian");
    expect(login.body.user.labs.map((l: { code: string }) => l.code)).toEqual([LAB.shortCode]);
  });

  it("approves an IT Admin with no labs, who then logs in to the IT Admin view", async () => {
    const { body, userId } = await signUp();

    const res = await asItAdmin.put(`/api/users/${userId}/approve`, { role: "IT_ADMIN", centerIds: [] });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: "IT_ADMIN", roleLabel: "IT Admin", labs: [] });
    expect((await logRowsFor(userId))[0].details).toBe("Role: IT_ADMIN; labs: none");
    const login = await api.post("/api/auth/login", { email: body.email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ role: "ITAdmin", user: { labs: [] } });
  });

  it("approves a TSG account when no labs are sent at all", async () => {
    const { userId } = await signUp();

    const res = await asItAdmin.put(`/api/users/${userId}/approve`, { role: "TSG_STAFF" });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: "TSG_STAFF", labs: [] });
  });

  it.each([
    ["an unknown role", { role: "LAB_HEAD", centerIds: [LAB.centerId] }, "Choose a role: Researcher, TSG Staff, AdRIC Director, AdRIC Secretary, or IT Admin."],
    ["no role", { centerIds: [LAB.centerId] }, "Choose a role: Researcher, TSG Staff, AdRIC Director, AdRIC Secretary, or IT Admin."],
    ["a Researcher with no labs", { role: "RESEARCHER", centerIds: [] }, "Choose at least one lab for a Researcher."],
    ["a Researcher with no lab list", { role: "RESEARCHER" }, "Choose at least one lab for a Researcher."],
    ["an unknown lab", { role: "RESEARCHER", centerIds: [LAB.centerId, 999999] }, "One of the labs you chose is not a known lab."],
    ["labs that are not ids", { role: "RESEARCHER", centerIds: ["1"] }, "The labs must be a list of lab ids."],
  ])("answers 400 for %s, and the sign-up stays Pending with its labs", async (_label, body, message) => {
    const { userId } = await signUp();

    const res = await asItAdmin.put(`/api/users/${userId}/approve`, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await statusOf(userId)).toBe("PENDING");
    expect(await db.user_centers.count({ where: { user_id: userId } })).toBe(2);
    expect(await logRowsFor(userId)).toEqual([]);
  });

  it("answers 404 for an account that does not exist, and 400 for an id that is not a number", async () => {
    const missing = await asItAdmin.put("/api/users/999999/approve", { role: "RESEARCHER", centerIds: [LAB.centerId] });
    const notANumber = await asItAdmin.put("/api/users/abc/approve", { role: "RESEARCHER", centerIds: [LAB.centerId] });

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: "No account has this id." });
    expect(notANumber.status).toBe(400);
  });

  it("answers 409 for an account that is not Pending, and changes nothing", async () => {
    const res = await asItAdmin.put(`/api/users/${USERS.custodianA.userId}/approve`, { role: "IT_ADMIN", centerIds: [] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: "This sign-up is no longer pending." });
    const roles = await db.user_roles.findMany({ where: { user_id: USERS.custodianA.userId }, include: { roles: true } });
    expect(roles.map((ur) => ur.roles.role_name)).toEqual(["RESEARCHER"]);
  });

  it("approves once when two approvals are sent at once: one 200, one 409, one role, one log row", async () => {
    const { userId } = await signUp();

    const answers = await Promise.all([
      asItAdmin.put(`/api/users/${userId}/approve`, { role: "RESEARCHER", centerIds: [LAB.centerId] }),
      asItAdmin.put(`/api/users/${userId}/approve`, { role: "TSG_STAFF", centerIds: [] }),
    ]);

    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect(await db.user_roles.count({ where: { user_id: userId } })).toBe(1);
    expect(await logRowsFor(userId)).toHaveLength(1);
  });
});

describe("PUT /api/users/:userId/reject", () => {
  it("rejects with trimmed remarks: Rejected, decided by the IT Admin, no labs left, a log row with the remarks", async () => {
    const { userId } = await signUp();

    const res = await asItAdmin.put(`/api/users/${userId}/reject`, { remarks: "  Test: not a member of these labs.  " });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId, role: null, accountStatus: "REJECTED", labs: [] });
    const row = await db.users.findUniqueOrThrow({ where: { user_id: userId }, include: { user_centers: true, user_roles: true } });
    expect(row).toMatchObject({ account_status: "REJECTED", status_decided_by_id: USERS.admin.userId, user_centers: [], user_roles: [] });
    expect(await logRowsFor(userId)).toMatchObject([{ event_type: "SIGNUP_REJECTED", actor_id: USERS.admin.userId, details: "Test: not a member of these labs." }]);
  });

  it("rejects with no body, and the log row has no details", async () => {
    const { userId } = await signUp();

    const res = await asItAdmin.put(`/api/users/${userId}/reject`, undefined);

    expect(res.status).toBe(200);
    expect((await logRowsFor(userId))[0].details).toBeNull();
  });

  it("refuses the rejected account at login with 403 and its message, though the password is right", async () => {
    const { body, userId } = await signUp();
    await asItAdmin.put(`/api/users/${userId}/reject`, {});

    const login = await api.post("/api/auth/login", { email: body.email, password: PASSWORD });

    expect(login.status).toBe(403);
    expect(login.body).toEqual({ success: false, error: "Your sign-up was not approved. Contact the IT Admin." });
  });

  it("refuses a sign-up still waiting at login with 403 and its message", async () => {
    const { body } = await signUp();

    const login = await api.post("/api/auth/login", { email: body.email, password: PASSWORD });

    expect(login.status).toBe(403);
    expect(login.body).toEqual({ success: false, error: "Your sign-up is waiting for IT Admin approval." });
  });

  it("takes remarks of 255 characters, and answers 400 for 256 or for remarks that are not text", async () => {
    const { userId } = await signUp();

    const tooLong = await asItAdmin.put(`/api/users/${userId}/reject`, { remarks: "x".repeat(256) });
    const notText = await asItAdmin.put(`/api/users/${userId}/reject`, { remarks: 42 });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({ success: false, error: "Remarks must be at most 255 characters." });
    expect(notText.status).toBe(400);
    expect(await statusOf(userId)).toBe("PENDING");

    expect((await asItAdmin.put(`/api/users/${userId}/reject`, { remarks: "x".repeat(255) })).status).toBe(200);
  });

  it("answers 404 for an account that does not exist, and 409 for one already decided", async () => {
    const { userId } = await signUp();
    await asItAdmin.put(`/api/users/${userId}/approve`, { role: "RESEARCHER", centerIds: [LAB.centerId] });

    const missing = await asItAdmin.put("/api/users/999999/reject", {});
    const decided = await asItAdmin.put(`/api/users/${userId}/reject`, {});

    expect(missing.status).toBe(404);
    expect(decided.status).toBe(409);
    expect(await statusOf(userId)).toBe("ACTIVE");
  });
});
