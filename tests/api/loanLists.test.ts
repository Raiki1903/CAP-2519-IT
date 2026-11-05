/**
 * Loans API: the loan lists in the Loan shape, the Accountability Form data, and the clearance record.
 * Covers GET /api/loans?status=, GET /api/loans/mine, GET /api/loans/lab-requests,
 * GET /api/loans/:id/accountability-form, and POST /api/users/:id/clearance-record.
 * Workflow: TSG's Releases and Returns lists, a Researcher's own loans, a Lab Head's requests, the printed
 * Accountability Form, and clearance (manuscript OUT5).
 * Fixtures: the seeded loans (LOAN-1 On Loan to Custodian A on TEST-0002, LOAN-2 Pending Approval from Custodian B on
 * TEST-0005) and the accounts (USERS). Each test adds loans on its own extra assets (TEST-0101 onward) through the API;
 * the tests run in order and later ones count what earlier ones added.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { LAB, SEEDED_ROWS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);
const asCustodianB = as(USERS.custodianB);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);

const FORBIDDEN = "Your role is not allowed to do this.";
const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
const inspection = { inspection: { condition: "OPERATIONAL", remarks: "Test inspection remark" } };

/** How far a loan made by loanAt goes. */
type Stage = "PENDING_APPROVAL" | "PENDING_RELEASE" | "ON_LOAN" | "RETURN_REQUESTED" | "RETURNED";

/**
 * Takes a new asset through the loan steps by the API, as each step's own account, up to the stage asked for.
 *
 * @returns the asset and the loan id
 */
async function loanAt(tag: string, stage: Stage, borrower: TestUser = USERS.custodianA) {
  const asset = await addExtraAsset(db, { tag });
  const requested = await as(borrower).post(`/api/assets/${tag}/loans`, {
    destinationCenterId: LAB.centerId, returnBy: inDays(10), purpose: `Test purpose for ${tag}`,
  });
  expect(requested.status, JSON.stringify(requested.body)).toBe(201);
  const loanId: number = requested.body.loan.loanId;
  const steps: [Stage, () => Promise<{ status: number }>][] = [
    ["PENDING_RELEASE", () => asLabHead.put(`/api/loans/${loanId}/approve`, {})],
    ["ON_LOAN", () => asStaff.put(`/api/loans/${loanId}/release`, inspection)],
    ["RETURN_REQUESTED", () => as(borrower).put(`/api/loans/${loanId}/return-request`, {})],
    ["RETURNED", () => asStaff.put(`/api/loans/${loanId}/receive`, inspection)],
  ];
  const order: Stage[] = ["PENDING_APPROVAL", ...steps.map(([s]) => s)];
  for (const [step, run] of steps) {
    if (order.indexOf(step) > order.indexOf(stage)) break;
    expect((await run()).status, `${tag} ${step}`).toBe(200);
  }
  return { asset, loanId };
}

const ids = (loans: { loanId: number }[]) => loans.map(l => l.loanId);

describe("GET /api/loans?status= (TSG)", () => {
  it("lists the loans in the statuses asked, oldest request first, in the Loan shape", async () => {
    const first = await loanAt("TEST-0101", "PENDING_RELEASE");
    const second = await loanAt("TEST-0102", "RETURN_REQUESTED");

    const res = await asStaff.get("/api/loans?status=RETURN_REQUESTED,PENDING_RELEASE");

    expect(res.status).toBe(200);
    expect(ids(res.body.loans)).toEqual([first.loanId, second.loanId]);
    expect(res.body.loans[0]).toMatchObject({
      status: "PENDING_RELEASE",
      statusLabel: "Pending Release",
      asset: { tag: "TEST-0101" },
      borrower: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
      destinationLab: { centerId: LAB.centerId, code: LAB.shortCode },
    });
    expect(res.body.loans[1].releaseInspection).toMatchObject({ type: "LOAN_RELEASE" });
  });

  it("answers 400 for an unknown status", async () => {
    const res = await asStaff.get("/api/loans?status=ON_LOAN,LOST");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Unknown loan status: LOST.");
  });

  it.each([USERS.custodianA, USERS.labHead, USERS.director, USERS.secretary])("answers 403 to $lastName", async (user) => {
    const res = await as(user).get("/api/loans?status=PENDING_RELEASE");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(FORBIDDEN);
  });
});

describe("GET /api/loans/mine", () => {
  it("holds only the caller's own loans, newest request first", async () => {
    await loanAt("TEST-0201", "PENDING_APPROVAL", USERS.custodianB);

    const res = await asCustodianB.get("/api/loans/mine");

    expect(res.status).toBe(200);
    expect(res.body.loans.length).toBeGreaterThanOrEqual(2);
    expect(res.body.loans.every((l: { borrower: { userId: number } }) => l.borrower.userId === USERS.custodianB.userId)).toBe(true);
    const times = res.body.loans.map((l: { requestedAt: string }) => l.requestedAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(ids(res.body.loans)).toContain(SEEDED_ROWS.pendingLoanId);
    expect(ids((await asCustodian.get("/api/loans/mine")).body.loans)).not.toContain(SEEDED_ROWS.pendingLoanId);
  });

  it("filters by ?status=", async () => {
    const res = await asCustodian.get("/api/loans/mine?status=PENDING_RELEASE");

    expect(res.status).toBe(200);
    expect(res.body.loans.map((l: { asset: { tag: string } }) => l.asset.tag)).toEqual(["TEST-0101"]);
  });
});

describe("GET /api/loans/lab-requests", () => {
  it("lists only the loans on assets of the lab the caller heads, oldest first, with ?status= optional", async () => {
    const otherLab = await db.research_centers.create({ data: { name: "Test Lab OTHER", short_code: "OTHER", location: "MANILA" } });
    const otherAsset = await addExtraAsset(db, { tag: "OTHER-0001", centerId: otherLab.center_id });
    const otherLoan = await db.asset_loans.create({
      data: { asset_id: otherAsset.assetId, borrower_id: USERS.custodianA.userId, purpose: "Test other lab loan", return_by: new Date(inDays(5)), status: "PENDING_APPROVAL", destination_center_id: LAB.centerId },
    });

    const all = await asLabHead.get("/api/loans/lab-requests");
    const pending = await asLabHead.get("/api/loans/lab-requests?status=PENDING_APPROVAL");

    expect(all.status).toBe(200);
    expect(ids(all.body.loans)).not.toContain(otherLoan.loan_id);
    expect(ids(all.body.loans)).toEqual(expect.arrayContaining([SEEDED_ROWS.approvedLoanId, SEEDED_ROWS.pendingLoanId]));
    const times = all.body.loans.map((l: { requestedAt: string }) => l.requestedAt);
    expect([...times].sort()).toEqual(times);
    expect(pending.body.loans.length).toBeGreaterThan(0);
    expect(pending.body.loans.every((l: { status: string }) => l.status === "PENDING_APPROVAL")).toBe(true);
    expect(ids(pending.body.loans)).not.toContain(otherLoan.loan_id);
  });

  it.each([USERS.custodianA, USERS.staffTsg])("answers 403 to $lastName, who heads no lab", async (user) => {
    const res = await as(user).get("/api/loans/lab-requests");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("You do not head a lab.");
  });
});

describe("GET /api/loans/:id/accountability-form", () => {
  it("gives the borrower the loan, the asset, the Responsible Person with their email, and the release inspection", async () => {
    const { asset, loanId } = await loanAt("TEST-0301", "ON_LOAN");

    const res = await asCustodian.get(`/api/loans/${loanId}/accountability-form`);

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ loanId, status: "ON_LOAN" });
    expect(res.body.asset).toMatchObject({ tag: asset.tag, name: asset.name, holder: { userId: USERS.custodianA.userId } });
    expect(res.body.asset).toHaveProperty("manufacturer");
    expect(res.body.asset).toHaveProperty("serialNumber");
    expect(res.body.borrower).toEqual({
      userId: USERS.custodianA.userId,
      name: USERS.custodianA.fullName,
      idNumber: USERS.custodianA.idNumber,
      email: USERS.custodianA.email,
      labs: [{ centerId: LAB.centerId, code: LAB.shortCode }],
    });
    expect(res.body.releaseInspection).toMatchObject({ type: "LOAN_RELEASE", condition: "OPERATIONAL" });
  });

  it("gives it to the home lab's Head and to TSG, who see who released it", async () => {
    const { loanId } = await loanAt("TEST-0302", "ON_LOAN");

    for (const client of [asLabHead, asStaff]) {
      const res = await client.get(`/api/loans/${loanId}/accountability-form`);
      expect(res.status).toBe(200);
      expect(res.body.loan.releasedBy).toEqual({ userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName });
    }
  });

  it.each([USERS.custodianB, USERS.director])("answers 403 to $lastName", async (user) => {
    const res = await as(user).get(`/api/loans/${SEEDED_ROWS.approvedLoanId}/accountability-form`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Only the borrower, the Head of the asset's lab, and TSG can see this Accountability Form.");
  });

  it("answers 409 before the release", async () => {
    const { loanId } = await loanAt("TEST-0303", "PENDING_RELEASE");

    const res = await asCustodian.get(`/api/loans/${loanId}/accountability-form`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("This loan has not been released yet.");
  });

  it("answers 404 for an unknown loan", async () => {
    expect((await asStaff.get("/api/loans/999999/accountability-form")).status).toBe(404);
  });
});

describe("POST /api/users/:id/clearance-record", () => {
  const printedRows = () => db.activity_log.findMany({ where: { event_type: "CLEARANCE_RECORD_PRINTED", target_user_id: USERS.custodianB.userId } });
  const record = { released: 0, waiting: 0, cancelled: 0 };

  it("shows a person with an open loan as not cleared, lists their handed-over and waiting loans newest first, and logs one row", async () => {
    record.released = (await loanAt("TEST-0401", "ON_LOAN", USERS.custodianB)).loanId;
    record.cancelled = (await loanAt("TEST-0402", "PENDING_RELEASE", USERS.custodianB)).loanId;
    expect((await asCustodianB.put(`/api/loans/${record.cancelled}/cancel`, {})).status).toBe(200);
    record.waiting = (await loanAt("TEST-0403", "PENDING_RELEASE", USERS.custodianB)).loanId;

    const res = await asStaff.post(`/api/users/${USERS.custodianB.userId}/clearance-record`, {});

    expect(res.status).toBe(200);
    expect(res.body.person).toEqual({
      userId: USERS.custodianB.userId,
      name: USERS.custodianB.fullName,
      idNumber: USERS.custodianB.idNumber,
      labs: [{ centerId: LAB.centerId, code: LAB.shortCode }],
    });
    expect(res.body.cleared).toBe(false);
    expect(ids(res.body.loans)).toEqual([record.waiting, record.released]);
    expect(res.body.loans[1].releaseInspection).toMatchObject({ type: "LOAN_RELEASE" });
    const rows = await printedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: USERS.staffTsg.userId, target_user_id: USERS.custodianB.userId, details: null });
  });

  it("shows the person as cleared once nothing is open, with the return in the list", async () => {
    expect((await asStaff.put(`/api/loans/${record.released}/receive`, inspection)).status).toBe(200);
    expect((await asCustodianB.put(`/api/loans/${record.waiting}/cancel`, {})).status).toBe(200);

    const res = await asStaff.post(`/api/users/${USERS.custodianB.userId}/clearance-record`, {});

    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(true);
    expect(ids(res.body.loans)).toEqual([record.released]);
    expect(res.body.loans[0]).toMatchObject({ status: "RETURNED", returnInspection: { type: "RETURN" } });
    expect(await printedRows()).toHaveLength(2);
  });

  it.each([USERS.custodianA, USERS.labHead, USERS.director, USERS.secretary])("answers 403 to $lastName, and logs nothing", async (user) => {
    const before = (await printedRows()).length;

    const res = await as(user).post(`/api/users/${USERS.custodianB.userId}/clearance-record`, {});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(FORBIDDEN);
    expect(await printedRows()).toHaveLength(before);
  });

  it("answers 404 for an unknown person, and 400 for an id that is not a number", async () => {
    expect((await asStaff.post("/api/users/999999/clearance-record", {})).status).toBe(404);
    expect((await asStaff.post("/api/users/abc/clearance-record", {})).status).toBe(400);
  });
});
