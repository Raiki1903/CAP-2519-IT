/**
 * The IT Admin's account management after sign-up (module 6): the users list and its filters.
 * Covers GET /api/users with status, role, centerId, and q. Workflow: account management.
 * Fixtures: the seeded accounts and LAB (headed by the Lab Head). Each test makes the accounts it changes, so the
 * seeded ones stay as seeded.
 */
import type { users_account_status } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../../server/shared/services/passwords";
import { LAB, ROLE_IDS, USERS, type RoleName } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const asItAdmin = as(USERS.admin);
const FORBIDDEN = "Your role is not allowed to do this.";
const PASSWORD = "test-password-managed";

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
  return { userId: row.user_id, email: row.email, lastName: row.last_name };
}

const idsOf = (res: { body: any }): number[] => res.body.users.map((u: { userId: number }) => u.userId);

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
      role: "RESEARCHER", accountStatus: "ACTIVE", labs: [{ centerId: LAB.centerId, code: LAB.shortCode }], headOf: { centerId: LAB.centerId, code: LAB.shortCode },
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

describe("who may use the account management endpoints", () => {
  const routes: [string, string][] = [["GET", "/api/users"]];
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
