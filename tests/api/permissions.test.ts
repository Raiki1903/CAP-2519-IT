/**
 * Permission helpers: an Active account, the database roles a step needs, the Head of the asset's home lab for a loan
 * decision, and no deciding of one's own retirement request.
 * Covers requireActive, requireAnyRole and its named checks (server/shared/middleware/permissions.ts), and
 * resolveLoanApprover, requireHomeLabHead, and notSameActor (server/shared/services/permissions.ts), through the
 * loan, return, maintenance, retirement, and inspection routes.
 * Fixtures: the seeded accounts and LAB (headed by the Lab Head). Each test adds its own lab or asset (TEST-0901
 * onward, OTHERLAB) and removes what another test in the file would count.
 */
import { describe, expect, it } from "vitest";
import { signSessionToken, SESSION_COOKIE_NAME } from "../../server/shared/services/session";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { TEST_SESSION_SECRET } from "../setup/testServer";

const { db, as, withCookie } = useApiHarness();

const FORBIDDEN = "Your role is not allowed to do this.";
const NOT_ACTIVE = "This account is not active. Contact the IT Admin.";
const NO_LAB_HEAD = "This lab has no Lab Head yet. Ask the IT Admin to set one.";

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** A lab of its own with one Available asset and a loan in Pending Approval on it. */
async function otherLabWithPendingLoan(code: string, headUserId: number | null) {
  const lab = await db.research_centers.create({ data: { name: `Test Lab ${code}`, short_code: code, location: "MANILA", head_user_id: headUserId } });
  const asset = await addExtraAsset(db, { tag: `${code}-0001`, centerId: lab.center_id });
  const loan = await db.asset_loans.create({
    data: { asset_id: asset.assetId, borrower_id: USERS.custodianA.userId, purpose: "Test purpose: other lab", return_by: inDays(14), status: "PENDING_APPROVAL" },
  });
  return { lab, asset, loan };
}

describe("the Head of the asset's home lab decides its loans", () => {
  it("answers 403 to the Head of another lab, and leaves the loan and the asset as they were", async () => {
    const { loan, asset } = await otherLabWithPendingLoan("OTHERLAB", USERS.secretary.userId);

    const res = await as(USERS.labHead).put(`/api/loans/${loan.loan_id}/decision`, { decision: "approve" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("This asset belongs to another lab. Only that lab's Head can decide its loans.");
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loan.loan_id } })).status).toBe("PENDING_APPROVAL");
    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: asset.assetId } })).status).toBe("AVAILABLE");
  });

  it("answers 409 for an asset of a lab with no Head yet, approve or decline", async () => {
    const { loan } = await otherLabWithPendingLoan("NOHEAD", null);

    for (const decision of ["approve", "decline"]) {
      const res = await as(USERS.labHead).put(`/api/loans/${loan.loan_id}/decision`, { decision });

      expect(res.status, decision).toBe(409);
      expect(res.body.error).toBe(NO_LAB_HEAD);
    }
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loan.loan_id } })).status).toBe("PENDING_APPROVAL");
  });
});

describe("the IT Admin has no asset steps", () => {
  it.each([
    ["POST", `/api/assets/${ASSETS.onLoan.tag}/return`, { condition: "OPERATIONAL" }],
    ["POST", `/api/assets/${ASSETS.available.tag}/maintenance`, { description: "Test fault from the IT Admin" }],
    ["PUT", "/api/maintenance/1", { progressStatus: "Inspection Phase" }],
    ["POST", `/api/assets/${ASSETS.available.tag}/retirement`, { breakdownReasons: "Test", disposalPathway: "Test" }],
    ["PUT", "/api/retirements/1/decision", { decision: "reject" }],
    ["POST", `/api/assets/${ASSETS.available.tag}/inspection`, { reportCondition: "PERFECT" }],
    ["POST", `/api/assets/${ASSETS.available.tag}/borrow`, { purpose: "Test", dueDate: "2030-01-01" }],
    ["PUT", "/api/loans/2/decision", { decision: "approve" }],
  ])("answers 403 to %s %s, and writes nothing", async (method, path, body) => {
    const client = as(USERS.admin);
    const before = await Promise.all([db.asset_loans.count(), db.asset_maintenance.count(), db.asset_retirements.count(), db.asset_inspections.count()]);

    const res = method === "POST" ? await client.post(path, body) : await client.put(path, body);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: FORBIDDEN });
    expect(await Promise.all([db.asset_loans.count(), db.asset_maintenance.count(), db.asset_retirements.count(), db.asset_inspections.count()])).toEqual(before);
  });
});

describe("only an Active account acts", () => {
  it.each(["PENDING", "INACTIVE"] as const)("answers 403 to a %s account's session on every step, even a list", async (status) => {
    await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { account_status: status } });
    try {
      // A cookie made here: the account cannot log in, and a cookie from before would be remembered as Active.
      const token = signSessionToken(USERS.custodianB.userId, Math.floor(Date.now() / 1000) + 3600, TEST_SESSION_SECRET);
      const client = withCookie(`${SESSION_COOKIE_NAME}=${token}`);

      for (const res of [
        await client.get("/api/assets"),
        await client.post(`/api/assets/${ASSETS.available.tag}/borrow`, { purpose: "Test", dueDate: "2030-01-01" }),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ success: false, error: NOT_ACTIVE });
      }
    } finally {
      await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { account_status: "ACTIVE" } });
    }
  });
});

describe("the person who requested a retirement does not decide it", () => {
  it("answers 403 to the Secretary deciding their own request, and leaves it pending; the Director may decide it", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0901", assetStatus: "PENDING_RETIREMENT" });
    const disposal = await db.asset_retirements.create({
      data: { asset_id: asset.assetId, requested_by_id: USERS.secretary.userId, reason: "Test own request", status: "PENDING", previous_status: "AVAILABLE" },
    });

    const own = await as(USERS.secretary).put(`/api/retirements/${disposal.retirement_id}/decision`, { decision: "approve" });
    expect(own.status).toBe(403);
    expect(own.body.error).toBe("You requested this retirement, so someone else must decide it.");
    expect((await db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: disposal.retirement_id } })).status).toBe("PENDING");

    const other = await as(USERS.director).put(`/api/retirements/${disposal.retirement_id}/decision`, { decision: "approve" });
    expect(other.status).toBe(200);
  });

  it("lets the Secretary decide someone else's request", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0902" });
    const filed = await as(USERS.staffTsg).post(`/api/assets/${asset.tag}/retirement`, { breakdownReasons: "Test", disposalPathway: "Test" });

    const res = await as(USERS.secretary).put(`/api/retirements/${filed.body.disposal.retirement_id}/decision`, { decision: "reject" });

    expect(res.status).toBe(200);
    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: asset.assetId } })).status).toBe("AVAILABLE");
  });
});

describe("the session knows the lab an account heads", () => {
  it("gives /me the lab the Lab Head heads, and null to everyone else", async () => {
    expect((await as(USERS.labHead).get("/api/auth/me")).body.user.headOf).toEqual({ centerId: LAB.centerId, code: LAB.shortCode });
    expect((await as(USERS.custodianA).get("/api/auth/me")).body.user.headOf).toBeNull();
  });
});
