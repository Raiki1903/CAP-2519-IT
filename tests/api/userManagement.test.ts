/**
 * The IT Admin's account management after sign-up (module 6): the users list and its filters, changing an
 * account's role and labs, setting a lab's Head, deactivating and reactivating an account, and anonymizing one.
 * Covers GET /api/users with status, role, centerId, and q, PUT /api/users/:userId/role,
 * PUT /api/users/:userId/labs, PUT /api/research-centers/:centerId/head, PUT /api/users/:userId/deactivate,
 * PUT /api/users/:userId/reactivate, and PUT /api/users/:userId/anonymize, and that an Inactive or anonymized account
 * cannot log in. Workflow: account management and the Data Privacy Act.
 * Fixtures: the seeded accounts and LAB (headed by the Lab Head). A second lab (TEST2) is made here, each Head test
 * makes labs of its own (HEAD1 onward), and each loan a test needs gets an extra asset (TEST-0801 onward). Each test
 * makes the accounts it changes, so the seeded ones stay as seeded; the Lab Head only gets steps that leave it as it was.
 */
import type { activity_log_event_type, asset_loans_status, users_account_status } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../server/shared/services/passwords";
import { signSessionToken, SESSION_COOKIE_NAME } from "../../server/shared/services/session";
import { addExtraAsset } from "../setup/extraAssets";
import { LAB, ROLE_IDS, USERS, type RoleName } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { TEST_SESSION_SECRET } from "../setup/testServer";

const { api, db, as, withCookie } = useApiHarness();
const asItAdmin = as(USERS.admin);
const FORBIDDEN = "Your role is not allowed to do this.";
const NOT_ACTIVE = "This account is not active. Contact the IT Admin.";
const PASSWORD = "test-password-managed";
const SECOND_LAB = { centerId: 2, name: "Test Second Lab", shortCode: "TEST2" };

beforeAll(async () => {
  await db.research_centers.create({
    data: { center_id: SECOND_LAB.centerId, name: SECOND_LAB.name, short_code: SECOND_LAB.shortCode, location: "LAGUNA" },
  });
});

let accountCount = 0;

/**
 * Makes an account straight in the database, as the IT Admin's steps find it.
 *
 * @returns its id, email, and last name
 */
async function makeAccount(options: { status?: users_account_status; role?: RoleName | null; centerIds?: number[]; lastName?: string; photo?: string } = {}) {
  accountCount += 1;
  const role = options.role === undefined ? "RESEARCHER" : options.role;
  const centerIds = options.centerIds ?? (role === "RESEARCHER" ? [LAB.centerId] : []);
  const row = await db.users.create({
    data: {
      first_name: "Test",
      last_name: options.lastName ?? `Managed ${accountCount}`,
      email: `test.managed.${accountCount}@dlsu.edu.ph`,
      password: await hashPassword(PASSWORD),
      id_number: 94000000 + accountCount,
      user_type: "STUDENT",
      account_status: options.status ?? "ACTIVE",
      user_img: options.photo ?? null,
    },
  });
  if (role) await db.user_roles.create({ data: { user_id: row.user_id, role_id: ROLE_IDS[role] } });
  if (centerIds.length > 0) await db.user_centers.createMany({ data: centerIds.map((centerId) => ({ user_id: row.user_id, center_id: centerId })) });
  return { userId: row.user_id, email: row.email, lastName: row.last_name, idNumber: row.id_number };
}

let loanCount = 0;

/** Gives the account a loan in this status, on an extra asset of its own (TEST-0801 onward). */
async function giveLoan(userId: number, status: asset_loans_status) {
  loanCount += 1;
  const asset = await addExtraAsset(db, { tag: `TEST-${String(800 + loanCount).padStart(4, "0")}` });
  return db.asset_loans.create({
    data: { asset_id: asset.assetId, borrower_id: userId, purpose: "Test purpose: managed account", return_by: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), status },
  });
}

const idsOf = (res: { body: any }): number[] => res.body.users.map((u: { userId: number }) => u.userId);
const logRowsFor = (userId: number, eventType: activity_log_event_type) =>
  db.activity_log.findMany({ where: { target_user_id: userId, event_type: eventType }, orderBy: { log_id: "asc" } });

describe("GET /api/users with filters", () => {
  it("with no filter, lists every account but the Pending ones, by last name, with no password or photo", async () => {
    const pending = await makeAccount({ status: "PENDING", role: null });
    const inactive = await makeAccount({ status: "INACTIVE", photo: "data:image/png;base64,VGVzdCBwaG90bw==" });

    const res = await asItAdmin.get("/api/users");

    expect(res.status).toBe(200);
    const ids = idsOf(res);
    expect(ids).not.toContain(pending.userId);
    expect(ids).toContain(inactive.userId);
    const seededByName = [USERS.admin, USERS.custodianA, USERS.custodianB, USERS.director, USERS.labHead, USERS.secretary, USERS.staffIts, USERS.staffTsg];
    expect(ids.filter((id) => seededByName.some((u) => u.userId === id))).toEqual(seededByName.map((u) => u.userId));
    expect(JSON.stringify(res.body)).not.toMatch(/password|user_?img|photo|scrypt\$|VGVzdCBwaG90bw/i);
    expect(res.body.users.find((u: { userId: number }) => u.userId === USERS.labHead.userId)).toMatchObject({
      role: "RESEARCHER", accountStatus: "ACTIVE", anonymizedAt: null, labs: [{ centerId: LAB.centerId, code: LAB.shortCode }], headOf: { centerId: LAB.centerId, code: LAB.shortCode },
    });
  });

  it("filters by status", async () => {
    const inactive = await makeAccount({ status: "INACTIVE" });
    const rejected = await makeAccount({ status: "REJECTED", role: null });

    const res = await asItAdmin.get("/api/users?status=INACTIVE");

    expect(res.status).toBe(200);
    expect(idsOf(res)).toContain(inactive.userId);
    expect(idsOf(res)).not.toContain(rejected.userId);
    expect(res.body.users.every((u: { accountStatus: string }) => u.accountStatus === "INACTIVE")).toBe(true);
  });

  it("filters by role", async () => {
    const res = await asItAdmin.get("/api/users?role=TSG_STAFF");

    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([USERS.staffIts.userId, USERS.staffTsg.userId]);
  });

  it("filters by lab, and by status, role and lab together", async () => {
    const inactiveMember = await makeAccount({ status: "INACTIVE" });

    const all = await asItAdmin.get(`/api/users?centerId=${LAB.centerId}`);
    const activeResearchers = await asItAdmin.get(`/api/users?status=ACTIVE&role=RESEARCHER&centerId=${LAB.centerId}`);

    expect(all.status).toBe(200);
    expect(idsOf(all)).toEqual(expect.arrayContaining([USERS.labHead.userId, USERS.custodianA.userId, USERS.custodianB.userId, inactiveMember.userId]));
    expect(idsOf(all)).not.toContain(USERS.admin.userId);
    expect(idsOf(activeResearchers)).toContain(USERS.custodianA.userId);
    expect(idsOf(activeResearchers)).not.toContain(inactiveMember.userId);
  });

  it("searches the full name, email and ID number, in any case, and takes % and _ as plain text", async () => {
    const byName = await asItAdmin.get("/api/users?q=" + encodeURIComponent("test CUSTODIAN a"));
    const byEmail = await asItAdmin.get("/api/users?q=staff.its");
    const byIdNumber = await asItAdmin.get(`/api/users?q=${String(USERS.staffTsg.idNumber).slice(1)}`);
    const wildcard = await asItAdmin.get("/api/users?q=" + encodeURIComponent("%"));
    const blank = await asItAdmin.get("/api/users?q=" + encodeURIComponent("   "));

    expect(idsOf(byName)).toEqual([USERS.custodianA.userId]);
    expect(idsOf(byEmail)).toEqual([USERS.staffIts.userId]);
    expect(idsOf(byIdNumber)).toEqual([USERS.staffTsg.userId]);
    expect(idsOf(wildcard)).toEqual([]);
    expect(idsOf(blank)).toContain(USERS.admin.userId);
  });

  it("lists Pending sign-ups by name when another filter comes with status=PENDING", async () => {
    const later = await makeAccount({ status: "PENDING", role: null, lastName: "Pending Alpha" });
    const earlier = await makeAccount({ status: "PENDING", role: null, lastName: "Pending Zulu" });

    const approvals = await asItAdmin.get("/api/users?status=PENDING");
    const searched = await asItAdmin.get("/api/users?status=PENDING&q=Pending");

    expect(idsOf(approvals).indexOf(later.userId)).toBeLessThan(idsOf(approvals).indexOf(earlier.userId));
    expect(idsOf(searched)).toEqual([later.userId, earlier.userId]);
  });
});

describe("PUT /api/users/:userId/role", () => {
  it("gives an Active Researcher one new role, and writes ROLE_CHANGED with the IT Admin as actor", async () => {
    const { userId, email } = await makeAccount();

    const res = await asItAdmin.put(`/api/users/${userId}/role`, { role: "TSG_STAFF" });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId, role: "TSG_STAFF", roleLabel: "TSG Staff", accountStatus: "ACTIVE" });
    const roles = await db.user_roles.findMany({ where: { user_id: userId }, include: { roles: true } });
    expect(roles.map((ur) => ur.roles.role_name)).toEqual(["TSG_STAFF"]);
    const logs = await logRowsFor(userId, "ROLE_CHANGED");
    expect(logs).toMatchObject([{ actor_id: USERS.admin.userId, details: "From RESEARCHER to TSG_STAFF" }]);
    expect(logs[0].details).not.toContain(email);
  });

  it("changes the role of an Inactive account too", async () => {
    const { userId } = await makeAccount({ status: "INACTIVE", role: "TSG_STAFF" });

    const res = await asItAdmin.put(`/api/users/${userId}/role`, { role: "ADRIC_SECRETARY" });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: "ADRIC_SECRETARY", accountStatus: "INACTIVE" });
  });

  it.each([
    ["a Pending sign-up", { status: "PENDING", role: null }, "This sign-up is still pending. Decide it on the Approvals page."],
    ["a Rejected sign-up", { status: "REJECTED", role: null }, "This sign-up was rejected and can't be changed."],
  ] as const)("answers 409 for %s, and changes nothing", async (_label, options, message) => {
    const { userId } = await makeAccount(options);

    const res = await asItAdmin.put(`/api/users/${userId}/role`, { role: "RESEARCHER" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await db.user_roles.count({ where: { user_id: userId } })).toBe(0);
    expect(await logRowsFor(userId, "ROLE_CHANGED")).toEqual([]);
  });

  it("answers 400 to make an account with no lab a Researcher, and gives the role once it has a lab", async () => {
    const { userId } = await makeAccount({ role: "TSG_STAFF", centerIds: [] });

    const refused = await asItAdmin.put(`/api/users/${userId}/role`, { role: "RESEARCHER" });

    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({ success: false, error: "Choose at least one lab for a Researcher." });
    const roles = await db.user_roles.findMany({ where: { user_id: userId }, include: { roles: true } });
    expect(roles.map((ur) => ur.roles.role_name)).toEqual(["TSG_STAFF"]);
    expect(await logRowsFor(userId, "ROLE_CHANGED")).toEqual([]);

    await asItAdmin.put(`/api/users/${userId}/labs`, { centerIds: [LAB.centerId] });
    const given = await asItAdmin.put(`/api/users/${userId}/role`, { role: "RESEARCHER" });

    expect(given.status).toBe(200);
    expect(given.body.user).toMatchObject({ role: "RESEARCHER", labs: [{ centerId: LAB.centerId }] });
  });

  it("answers 409 for an anonymized account", async () => {
    const { userId } = await makeAccount({ status: "INACTIVE" });
    await db.users.update({ where: { user_id: userId }, data: { anonymized_at: new Date() } });

    const res = await asItAdmin.put(`/api/users/${userId}/role`, { role: "TSG_STAFF" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: "This account is anonymized and can't be changed." });
  });

  it("answers 409 \"Change the lab's Head first.\" for the account that heads a lab, unless the role stays Researcher", async () => {
    const refused = await asItAdmin.put(`/api/users/${USERS.labHead.userId}/role`, { role: "TSG_STAFF" });
    const kept = await asItAdmin.put(`/api/users/${USERS.labHead.userId}/role`, { role: "RESEARCHER" });

    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ success: false, error: "Change the lab's Head first." });
    expect(kept.status).toBe(200);
    expect(kept.body.user).toMatchObject({ role: "RESEARCHER", headOf: { centerId: LAB.centerId } });
  });

  it("answers 400 for the IT Admin's own account, 400 for a bad role, and 404 for no such account", async () => {
    const own = await asItAdmin.put(`/api/users/${USERS.admin.userId}/role`, { role: "RESEARCHER" });
    const badRole = await asItAdmin.put(`/api/users/${USERS.custodianB.userId}/role`, { role: "LAB_HEAD" });
    const missing = await asItAdmin.put("/api/users/999999/role", { role: "RESEARCHER" });

    expect(own.status).toBe(400);
    expect(own.body).toEqual({ success: false, error: "You can't change your own account here." });
    expect(badRole.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: "No account has this id." });
    const adminRoles = await db.user_roles.findMany({ where: { user_id: USERS.admin.userId }, include: { roles: true } });
    expect(adminRoles.map((ur) => ur.roles.role_name)).toEqual(["IT_ADMIN"]);
  });
});

describe("PUT /api/users/:userId/labs", () => {
  it("replaces a Researcher's labs, and writes LABS_CHANGED with the new codes", async () => {
    const { userId } = await makeAccount();

    const res = await asItAdmin.put(`/api/users/${userId}/labs`, { centerIds: [SECOND_LAB.centerId, LAB.centerId, LAB.centerId] });

    expect(res.status).toBe(200);
    expect(res.body.user.labs).toEqual([{ centerId: LAB.centerId, code: LAB.shortCode }, { centerId: SECOND_LAB.centerId, code: SECOND_LAB.shortCode }]);
    expect(await logRowsFor(userId, "LABS_CHANGED")).toMatchObject([{ actor_id: USERS.admin.userId, details: "TEST, TEST2" }]);
  });

  it("lets another role have no lab, and the log row says none", async () => {
    const { userId } = await makeAccount({ role: "TSG_STAFF", centerIds: [LAB.centerId] });

    const res = await asItAdmin.put(`/api/users/${userId}/labs`, { centerIds: [] });

    expect(res.status).toBe(200);
    expect(res.body.user.labs).toEqual([]);
    expect((await logRowsFor(userId, "LABS_CHANGED"))[0].details).toBe("none");
  });

  it.each([
    ["a Researcher with no labs", [], "Choose at least one lab for a Researcher."],
    ["an unknown lab", [LAB.centerId, 999999], "One of the labs you chose is not a known lab."],
  ])("answers 400 for %s, and the labs stay", async (_label, centerIds, message) => {
    const { userId } = await makeAccount();

    const res = await asItAdmin.put(`/api/users/${userId}/labs`, { centerIds });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
    expect((await db.user_centers.findMany({ where: { user_id: userId } })).map((uc) => uc.center_id)).toEqual([LAB.centerId]);
    expect(await logRowsFor(userId, "LABS_CHANGED")).toEqual([]);
  });

  it("answers 400 when the labs are missing or not ids", async () => {
    const missing = await asItAdmin.put(`/api/users/${USERS.custodianB.userId}/labs`, {});
    const notIds = await asItAdmin.put(`/api/users/${USERS.custodianB.userId}/labs`, { centerIds: ["1"] });

    expect(missing.status).toBe(400);
    expect(notIds.body).toEqual({ success: false, error: "The labs must be a list of lab ids." });
  });

  it("answers 409 when the lab the account heads is left out, and the account keeps it", async () => {
    const res = await asItAdmin.put(`/api/users/${USERS.labHead.userId}/labs`, { centerIds: [SECOND_LAB.centerId] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: "Change the lab's Head first." });
    expect((await db.user_centers.findMany({ where: { user_id: USERS.labHead.userId } })).map((uc) => uc.center_id)).toEqual([LAB.centerId]);
  });

  it("answers 409 for a Pending sign-up, and 400 for the IT Admin's own account", async () => {
    const { userId } = await makeAccount({ status: "PENDING", role: null, centerIds: [LAB.centerId] });

    const pending = await asItAdmin.put(`/api/users/${userId}/labs`, { centerIds: [SECOND_LAB.centerId] });
    const own = await asItAdmin.put(`/api/users/${USERS.admin.userId}/labs`, { centerIds: [LAB.centerId] });

    expect(pending.status).toBe(409);
    expect(own.status).toBe(400);
    expect(await db.user_centers.count({ where: { user_id: USERS.admin.userId } })).toBe(0);
  });
});

describe("PUT /api/research-centers/:centerId/head", () => {
  let labCount = 0;

  /** A lab of its own, with no Head. */
  async function makeLab() {
    labCount += 1;
    const lab = await db.research_centers.create({ data: { name: `Test Head Lab ${labCount}`, short_code: `HEAD${labCount}`, location: "MANILA" } });
    return { centerId: lab.center_id, code: lab.short_code };
  }

  const headOf = async (centerId: number) => (await db.research_centers.findUniqueOrThrow({ where: { center_id: centerId } })).head_user_id;
  const setHead = (centerId: number, userId: number | null) => asItAdmin.put(`/api/research-centers/${centerId}/head`, { userId });

  it("makes an Active Researcher member the Head, and writes HEAD_CHANGED with the new Head as target", async () => {
    const lab = await makeLab();
    const member = await makeAccount({ centerIds: [lab.centerId] });

    const res = await setHead(lab.centerId, member.userId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, lab: { centerId: lab.centerId, code: lab.code, headUserId: member.userId } });
    expect(await headOf(lab.centerId)).toBe(member.userId);
    expect(await logRowsFor(member.userId, "HEAD_CHANGED")).toMatchObject([{ actor_id: USERS.admin.userId, details: `${lab.code}: none to Test ${member.lastName}` }]);
  });

  it("replaces the old Head in the same step, and then leaves the lab with no Head", async () => {
    const lab = await makeLab();
    const first = await makeAccount({ centerIds: [lab.centerId] });
    const second = await makeAccount({ centerIds: [lab.centerId] });
    await setHead(lab.centerId, first.userId);

    const replaced = await setHead(lab.centerId, second.userId);

    expect(replaced.status).toBe(200);
    expect(await headOf(lab.centerId)).toBe(second.userId);
    const list = await asItAdmin.get(`/api/users?centerId=${lab.centerId}`);
    expect(list.body.users.find((u: { userId: number }) => u.userId === first.userId).headOf).toBeNull();
    expect((await logRowsFor(second.userId, "HEAD_CHANGED"))[0].details).toBe(`${lab.code}: Test ${first.lastName} to Test ${second.lastName}`);

    const cleared = await setHead(lab.centerId, null);

    expect(cleared.status).toBe(200);
    expect(cleared.body.lab.headUserId).toBeNull();
    expect(await headOf(lab.centerId)).toBeNull();
    expect((await logRowsFor(second.userId, "HEAD_CHANGED")).map((row) => row.details)).toEqual([
      `${lab.code}: Test ${first.lastName} to Test ${second.lastName}`,
      `${lab.code}: Test ${second.lastName} to none`,
    ]);
  });

  it.each([
    ["not a member of the lab", { status: "ACTIVE", role: "RESEARCHER", inLab: false }, (code: string) => `The new Head must be a member of ${code}.`],
    ["not a Researcher", { status: "ACTIVE", role: "TSG_STAFF", inLab: true }, () => "The new Head must be a Researcher account."],
    ["Inactive", { status: "INACTIVE", role: "RESEARCHER", inLab: true }, () => "The new Head must be an Active account."],
  ] as const)("answers 400 when the person is %s, and the lab keeps no Head", async (_label, options, message) => {
    const lab = await makeLab();
    const person = await makeAccount({ status: options.status, role: options.role, centerIds: options.inLab ? [lab.centerId] : [] });

    const res = await setHead(lab.centerId, person.userId);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message(lab.code) });
    expect(await headOf(lab.centerId)).toBeNull();
    expect(await logRowsFor(person.userId, "HEAD_CHANGED")).toEqual([]);
  });

  it("answers 409 when the person already heads another lab", async () => {
    const [headed, other] = [await makeLab(), await makeLab()];
    const person = await makeAccount({ centerIds: [headed.centerId, other.centerId] });
    await setHead(headed.centerId, person.userId);

    const res = await setHead(other.centerId, person.userId);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: `This account already heads ${headed.code}.` });
    expect(await headOf(other.centerId)).toBeNull();
  });

  it("sets the same person as Head of two labs at once only once: one 200, one 409, never 500", async () => {
    const [labX, labY] = [await makeLab(), await makeLab()];
    const person = await makeAccount({ centerIds: [labX.centerId, labY.centerId] });

    const answers = await Promise.all([setHead(labX.centerId, person.userId), setHead(labY.centerId, person.userId)]);

    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect(await db.research_centers.count({ where: { head_user_id: person.userId } })).toBe(1);
    expect(await logRowsFor(person.userId, "HEAD_CHANGED")).toHaveLength(1);
  });

  it("answers 404 for no such lab or account, and 400 for a bad lab id or body", async () => {
    const lab = await makeLab();

    const noLab = await setHead(999999, USERS.custodianA.userId);
    const noAccount = await setHead(lab.centerId, 999999);
    const badId = await asItAdmin.put("/api/research-centers/abc/head", { userId: null });
    const noBody = await asItAdmin.put(`/api/research-centers/${lab.centerId}/head`, {});

    expect(noLab.status).toBe(404);
    expect(noLab.body).toEqual({ success: false, error: "No lab has this id." });
    expect(noAccount.status).toBe(404);
    expect(badId.status).toBe(400);
    expect(noBody.status).toBe(400);
    expect(noBody.body).toEqual({ success: false, error: "Send userId: the new Head's account id, or null for no Head." });
  });
});

describe("PUT /api/users/:userId/deactivate and /reactivate", () => {
  const deactivate = (userId: number) => asItAdmin.put(`/api/users/${userId}/deactivate`);
  const reactivate = (userId: number) => asItAdmin.put(`/api/users/${userId}/reactivate`);

  it("deactivates an Active account with no open loan: Inactive, decided by the IT Admin, a USER_DEACTIVATED row", async () => {
    const { userId } = await makeAccount();
    await giveLoan(userId, "RETURNED");

    const res = await deactivate(userId);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId, accountStatus: "INACTIVE" });
    expect(await db.users.findUniqueOrThrow({ where: { user_id: userId } })).toMatchObject({ account_status: "INACTIVE", status_decided_by_id: USERS.admin.userId });
    expect(await logRowsFor(userId, "USER_DEACTIVATED")).toMatchObject([{ actor_id: USERS.admin.userId }]);
  });

  it("refuses the Inactive account on its next request (403) and at login (403 with the Inactive message)", async () => {
    const { userId, email } = await makeAccount();
    expect((await api.post("/api/auth/login", { email, password: PASSWORD })).status).toBe(200);
    await deactivate(userId);

    // A cookie the server has never seen, as an open session looks once the 60-second session cache has passed.
    // The server runs in its own process, so the test cannot clear its cache.
    const token = signSessionToken(userId, Math.floor(Date.now() / 1000) + 3600, TEST_SESSION_SECRET);
    const next = await withCookie(`${SESSION_COOKIE_NAME}=${token}`).get("/api/assets");
    const login = await api.post("/api/auth/login", { email, password: PASSWORD });

    expect(next.status).toBe(403);
    expect(next.body).toEqual({ success: false, error: NOT_ACTIVE });
    expect(login.status).toBe(403);
    expect(login.body).toEqual({ success: false, error: NOT_ACTIVE });
  });

  it.each(["PENDING_APPROVAL", "PENDING_RELEASE", "ON_LOAN", "RETURN_REQUESTED"] as const)(
    "answers 409 while the account has a loan in %s, and the account stays Active",
    async (status) => {
      const { userId } = await makeAccount();
      await giveLoan(userId, status);

      const res = await deactivate(userId);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, error: "This account still has an open loan or loan request." });
      expect((await db.users.findUniqueOrThrow({ where: { user_id: userId } })).account_status).toBe("ACTIVE");
      expect(await logRowsFor(userId, "USER_DEACTIVATED")).toEqual([]);
    },
  );

  it("answers 409 for the account that heads a lab, 409 for one not Active, and 400 for the IT Admin's own", async () => {
    const inactive = await makeAccount({ status: "INACTIVE" });

    const head = await deactivate(USERS.labHead.userId);
    const notActive = await deactivate(inactive.userId);
    const own = await deactivate(USERS.admin.userId);

    expect(head.status).toBe(409);
    expect(head.body).toEqual({ success: false, error: "Change the lab's Head first." });
    expect(notActive.status).toBe(409);
    expect(notActive.body).toEqual({ success: false, error: "Only an Active account can be deactivated." });
    expect(own.status).toBe(400);
    expect(own.body).toEqual({ success: false, error: "You can't change your own account here." });
    expect((await db.users.findUniqueOrThrow({ where: { user_id: USERS.labHead.userId } })).account_status).toBe("ACTIVE");
  });

  it("reactivates an Inactive account, which can log in again, and writes USER_REACTIVATED", async () => {
    const { userId, email } = await makeAccount();
    await deactivate(userId);

    const res = await reactivate(userId);

    expect(res.status).toBe(200);
    expect(res.body.user.accountStatus).toBe("ACTIVE");
    expect(await logRowsFor(userId, "USER_REACTIVATED")).toMatchObject([{ actor_id: USERS.admin.userId }]);
    expect((await api.post("/api/auth/login", { email, password: PASSWORD })).status).toBe(200);
  });

  it("answers 409 to reactivate an account that is not Inactive, or is anonymized, and 404 for no such account", async () => {
    const anonymized = await makeAccount({ status: "INACTIVE" });
    await db.users.update({ where: { user_id: anonymized.userId }, data: { anonymized_at: new Date() } });

    const active = await reactivate(USERS.custodianA.userId);
    const gone = await reactivate(anonymized.userId);
    const missing = await reactivate(999999);

    expect(active.status).toBe(409);
    expect(active.body).toEqual({ success: false, error: "Only an Inactive account can be reactivated." });
    expect(gone.status).toBe(409);
    expect(gone.body).toEqual({ success: false, error: "This account is anonymized and can't be reactivated." });
    expect(missing.status).toBe(404);
    expect((await db.users.findUniqueOrThrow({ where: { user_id: anonymized.userId } })).account_status).toBe("INACTIVE");
  });
});

describe("PUT /api/users/:userId/anonymize", () => {
  const anonymize = (userId: number) => asItAdmin.put(`/api/users/${userId}/anonymize`);

  it("replaces each personal field, removes the photo and the labs, and keeps the loans and the log rows", async () => {
    const person = await makeAccount({ centerIds: [LAB.centerId, SECOND_LAB.centerId], photo: "data:image/png;base64,VGVzdCBwaG90bw==" });
    const loan = await giveLoan(person.userId, "RETURNED");
    await asItAdmin.put(`/api/users/${person.userId}/deactivate`);

    const res = await anonymize(person.userId);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      userId: person.userId, firstName: "Former", lastName: "researcher", email: `anonymized-${person.userId}@invalid`, idNumber: null, accountStatus: "INACTIVE", labs: [],
    });
    const stored = await db.users.findUniqueOrThrow({ where: { user_id: person.userId } });
    expect(res.body.user.anonymizedAt).toBe(stored.anonymized_at!.toISOString());
    const listed = await asItAdmin.get("/api/users?status=INACTIVE&q=Former");
    expect(listed.body.users.find((u: { userId: number }) => u.userId === person.userId).anonymizedAt).toBe(res.body.user.anonymizedAt);
    const row = await db.users.findUniqueOrThrow({ where: { user_id: person.userId }, include: { user_roles: true } });
    expect(row).toMatchObject({ first_name: "Former", last_name: "researcher", email: `anonymized-${person.userId}@invalid`, id_number: null, password: "", user_img: null });
    expect(row.anonymized_at).toBeInstanceOf(Date);
    expect(row.user_roles).toHaveLength(1);
    expect(await db.user_centers.count({ where: { user_id: person.userId } })).toBe(0);
    expect(await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loan.loan_id } })).toMatchObject({ borrower_id: person.userId, status: "RETURNED" });
    expect(await logRowsFor(person.userId, "USER_DEACTIVATED")).toHaveLength(1);
    const logs = await logRowsFor(person.userId, "USER_ANONYMIZED");
    expect(logs).toMatchObject([{ actor_id: USERS.admin.userId }]);
    expect(JSON.stringify(logs)).not.toContain(person.email);
  });

  it("leaves no way to log in, and frees the email and ID number for a new sign-up", async () => {
    const person = await makeAccount({ status: "INACTIVE" });
    await anonymize(person.userId);

    const oldEmail = await api.post("/api/auth/login", { email: person.email, password: PASSWORD });
    const newEmail = await api.post("/api/auth/login", { email: `anonymized-${person.userId}@invalid`, password: "" });
    const anyPassword = await api.post("/api/auth/login", { email: `anonymized-${person.userId}@invalid`, password: PASSWORD });
    const signUpAgain = await api.post("/api/auth/register-request", {
      firstName: "Test", lastName: "Returning", email: person.email, idNumber: person.idNumber, userType: "STUDENT", password: PASSWORD, centerIds: [LAB.centerId],
    });

    expect(oldEmail.status).toBe(401);
    // Login refuses an empty password before it looks at any account.
    expect(newEmail.status).toBe(400);
    expect(anyPassword.status).toBe(401);
    expect(signUpAgain.status, JSON.stringify(signUpAgain.body)).toBe(201);
  });

  it("anonymizes a Rejected sign-up", async () => {
    const { userId } = await makeAccount({ status: "REJECTED", role: null });

    const res = await anonymize(userId);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: "Former", accountStatus: "REJECTED" });
  });

  it.each([
    ["Active", { status: "ACTIVE", role: "RESEARCHER" }, "Only an Inactive or Rejected account can be anonymized."],
    ["Pending", { status: "PENDING", role: null }, "Only an Inactive or Rejected account can be anonymized."],
  ] as const)("answers 409 for an %s account, and changes nothing", async (_label, options, message) => {
    const person = await makeAccount(options);

    const res = await anonymize(person.userId);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await db.users.findUniqueOrThrow({ where: { user_id: person.userId } })).toMatchObject({ email: person.email, anonymized_at: null });
  });

  it("answers 409 for an account that is not cleared, and keeps its data", async () => {
    const person = await makeAccount({ status: "INACTIVE" });
    await giveLoan(person.userId, "ON_LOAN");

    const res = await anonymize(person.userId);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: "This account still has unreturned equipment, so it is not cleared." });
    expect((await db.users.findUniqueOrThrow({ where: { user_id: person.userId } })).email).toBe(person.email);
    expect(await logRowsFor(person.userId, "USER_ANONYMIZED")).toEqual([]);
  });

  it("answers 409 a second time, 400 for the IT Admin's own account, and 404 for no such account", async () => {
    const { userId } = await makeAccount({ status: "INACTIVE" });
    expect((await anonymize(userId)).status).toBe(200);

    const again = await anonymize(userId);
    const own = await anonymize(USERS.admin.userId);
    const missing = await anonymize(999999);

    expect(again.status).toBe(409);
    expect(again.body).toEqual({ success: false, error: "This account is already anonymized." });
    expect(own.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(await logRowsFor(userId, "USER_ANONYMIZED")).toHaveLength(1);
  });
});

describe("who may use the account management endpoints", () => {
  const target = USERS.custodianB.userId;
  const routes: [string, string][] = [
    ["GET", "/api/users"],
    ["PUT", `/api/users/${target}/role`],
    ["PUT", `/api/users/${target}/labs`],
    ["PUT", `/api/research-centers/${LAB.centerId}/head`],
    ["PUT", `/api/users/${target}/deactivate`],
    ["PUT", `/api/users/${target}/reactivate`],
    ["PUT", `/api/users/${target}/anonymize`],
  ];
  const send = (client: ReturnType<typeof as> | typeof api, method: string, path: string) =>
    method === "GET" ? client.get(path) : client.put(path, {});

  it("answers 401 to every route with no session", async () => {
    for (const [method, path] of routes) {
      expect((await send(api, method, path)).status, `${method} ${path}`).toBe(401);
    }
  });

  it.each([USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])("answers 403 to $lastName on every route", async (user) => {
    for (const [method, path] of routes) {
      const res = await send(as(user), method, path);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body).toEqual({ success: false, error: FORBIDDEN });
    }
  });
});
