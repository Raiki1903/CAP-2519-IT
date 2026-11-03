/**
 * Loans API: the borrow request, the loan list, and the Lab Head's decision.
 * Covers POST /api/assets/:tag/borrow, GET /api/loans, PUT /api/loans/:id/decision.
 * Workflow: borrowing (Custodian files a request, Lab Head approves or declines, the asset goes On Loan on approval).
 * Fixtures: the seeded loans (LOAN-1 approved on TEST-0002, LOAN-2 pending on TEST-0005), the seeded assets in
 * each state, and the accounts (USERS). The list tests run first. The write tests use their own extra assets
 * (TEST-0101 onward, see extraAssets.ts) and change no seeded row; the H-08 test puts LOAN-2 back to pending.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);

const DAY_MS = 24 * 60 * 60 * 1000;

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

/** Today as yyyy-mm-dd in local time, the date requestLoan compares with (the tests run in the server's process). */
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** What LoanForm sends: the borrower's typed name (not read since 13c: the borrower is the session user), the destination lab, the purpose, and the due date. */
const borrowBody = (borrower: TestUser | string, extra: Record<string, unknown> = {}) => ({
  borrower: typeof borrower === "string" ? borrower : borrower.fullName,
  lab: LAB.shortCode,
  purpose: "Test borrow purpose",
  dueDate: inDays(14),
  ...extra,
});

const assetStatus = async (assetId: number) => (await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } })).status;

/** Files a borrow request through the API, signed in as the borrower, and answers the new loan's id. */
async function requestLoan(tag: string, borrower: TestUser, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await as(borrower).post(`/api/assets/${tag}/borrow`, borrowBody(borrower, extra));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.loan.loan_id;
}

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/loans", () => {
  it("lists every loan newest first, with the destination lab moved out of the purpose", async () => {
    const res = await asLabHead.get("/api/loans");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loans.map((l: { id: string }) => l.id)).toEqual([`LOAN-${SEEDED_ROWS.pendingLoanId}`, `LOAN-${SEEDED_ROWS.approvedLoanId}`]);
    expect(res.body.loans[0]).toMatchObject({
      loanId: SEEDED_ROWS.pendingLoanId,
      assetId: ASSETS.pendingLoan.tag,
      asset: ASSETS.pendingLoan.name,
      assetName: ASSETS.pendingLoan.name,
      borrower_id: USERS.custodianB.userId,
      borrower: USERS.custodianB.fullName,
      purpose: "Test purpose: pending loan",
      destinationLab: LAB.shortCode,
      status: "Pending",
      location: "Manila",
      lab: LAB.shortCode,
    });
    expect(res.body.loans[1]).toMatchObject({ assetId: ASSETS.onLoan.tag, borrower: USERS.custodianA.fullName, status: "Approved" });
    expect(typeof res.body.loans[0].requestedOn).toBe("string");
    expect(typeof res.body.loans[0].dueDate).toBe("string");
  });

  it("shows a purpose with no lab line as it is, with no destinationLab", async () => {
    const plain = await db.asset_loans.create({
      data: { asset_id: ASSETS.disposed.assetId, borrower_id: USERS.custodianA.userId, purpose: "Test purpose without a lab", requested_at: new Date("2026-01-10"), return_by: new Date("2026-01-20"), status: "DECLINED" },
    });
    try {
      const res = await asLabHead.get("/api/loans");

      const listed = res.body.loans.find((l: { loanId: number }) => l.loanId === plain.loan_id);
      expect(listed).toMatchObject({ purpose: "Test purpose without a lab", status: "Declined" });
      expect(listed.destinationLab).toBeUndefined();
    } finally {
      await db.asset_loans.delete({ where: { loan_id: plain.loan_id } });
    }
  });

  it("writes nothing while some loan is pending", async () => {
    const before = await db.asset_loans.count();

    await asLabHead.get("/api/loans");

    expect(await db.asset_loans.count()).toBe(before);
  });

  it("writes nothing when no loan is pending, and lists only the real loans (H-08 fixed)", async () => {
    const pendingIds = (await db.asset_loans.findMany({ where: { status: "PENDING_APPROVAL" }, select: { loan_id: true } })).map((l) => l.loan_id);
    await db.asset_loans.updateMany({ where: { loan_id: { in: pendingIds } }, data: { status: "DECLINED" } });
    try {
      const before = await db.asset_loans.findMany({ select: { loan_id: true }, orderBy: { loan_id: "asc" } });

      const res = await asLabHead.get("/api/loans");

      expect(res.status).toBe(200);
      expect(res.body.loans.some((l: { status: string }) => l.status === "Pending")).toBe(false);
      expect(res.body.loans).toHaveLength(before.length);
      expect(await db.asset_loans.findMany({ select: { loan_id: true }, orderBy: { loan_id: "asc" } })).toEqual(before);
    } finally {
      await db.asset_loans.updateMany({ where: { loan_id: { in: pendingIds } }, data: { status: "PENDING_APPROVAL" } });
    }
  });
});

describe("POST /api/assets/:tag/borrow", () => {
  it("files a loan in Pending Approval under the session user, with the destination lab, and leaves the asset Available (issue #32 fixed)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0101" });

    const res = await as(USERS.custodianB).post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loan).toMatchObject({
      asset_id: asset.assetId,
      borrower_id: USERS.custodianB.userId,
      purpose: `Destination Lab: ${LAB.shortCode}\n\nTest borrow purpose`,
      status: "PENDING_APPROVAL",
      destination_center_id: LAB.centerId,
    });
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "PENDING_APPROVAL" } })).toBe(1);
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "AVAILABLE", holder: null, openLoan: { status: "PENDING_APPROVAL" } });
  });

  it("answers 400 for a destination lab that is not a lab, and writes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0108" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA, { lab: "TESTX" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Pick a destination lab from the list.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("stores the purpose as typed when no lab is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0102" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB, { lab: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.loan.purpose).toBe("Test borrow purpose");
  });

  it("ignores a borrower name that names someone else: the loan is still the session user's (issue #32 fixed)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0103" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(`Dr. ${USERS.custodianB.fullName}`));

    expect(res.status).toBe(200);
    expect(res.body.loan.borrower_id).toBe(USERS.custodianA.userId);
  });

  it("files the loan under the session user when the typed name matches nobody, not under user 1 (H-10 fixed)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0104" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody("Nobody Known"));

    expect(res.status).toBe(200);
    expect(res.body.loan.borrower_id).toBe(USERS.custodianA.userId);
  });

  it("accepts a request with no borrower field, for the session user", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0105" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA, { borrower: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.loan.borrower_id).toBe(USERS.custodianA.userId);
  });

  it.each(["purpose", "dueDate"])("answers 400 without %s, and writes nothing", async (field) => {
    const before = await db.asset_loans.count();

    const res = await asCustodian.post(`/api/assets/${ASSETS.available.tag}/borrow`, borrowBody(USERS.custodianB, { [field]: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_loans.count()).toBe(before);
  });

  it("answers 400 for a due date before today, and writes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0106" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA, { dueDate: inDays(-2) }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "The due date cannot be in the past." });
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("accepts a due date of today", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0107" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA, { dueDate: localToday() }));

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe("PENDING_APPROVAL");
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asCustodian.post("/api/assets/TEST-9999/borrow", borrowBody(USERS.custodianB));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/assets/:tag/borrow: one pending request per asset (issue #25)", () => {
  it("rejects a second custodian request on the same asset with 409 (issue #25)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0111" });

    const first = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));
    expect(first.status).toBe(200);

    const second = await as(USERS.custodianB).post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));
    expect(second.status).toBe(409);
    expect(second.body.error).toContain(`LOAN-${first.body.loan.loan_id}`);

    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "PENDING_APPROVAL" } })).toBe(1);
  });

  it("answers 409 for the seeded asset whose loan request is still pending", async () => {
    const res = await asCustodian.post(`/api/assets/${ASSETS.pendingLoan.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(`LOAN-${SEEDED_ROWS.pendingLoanId}`);
  });

  it("answers 409 while the asset is Pending Retirement, and writes nothing (issue #54)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0113", assetStatus: "PENDING_RETIREMENT" });
    await db.asset_retirements.create({
      data: { asset_id: asset.assetId, requested_by_id: USERS.staffTsg.userId, reason: "Test pending disposal", status: "PENDING", previous_status: "AVAILABLE" },
    });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TEST-0113 is Pending Retirement and cannot be requested for a loan.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it.each([ASSETS.onLoan, ASSETS.inRepair, ASSETS.disposed])("answers 409 for $tag, which is $listStatus, and writes nothing", async (asset) => {
    const before = await db.asset_loans.count({ where: { asset_id: asset.assetId } });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(before);
  });
});

describe("PUT /api/loans/:id/decision", () => {
  it("approve: puts the loan and the asset On Loan, with who decided, and the borrower holds it at the destination lab", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0121", condition: "OPERATIONAL" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);

    const res = await asLabHead.put(`/api/loans/${loanId}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, loan: { loan_id: loanId, status: "ON_LOAN" } });
    const loan = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } });
    expect(loan).toMatchObject({ status: "ON_LOAN", decided_by_id: USERS.labHead.userId, closed_at: null });
    expect(loan.decided_at).not.toBeNull();
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
    expect(await listedAsset(asset.tag)).toMatchObject({
      status: "ON_LOAN",
      custodian: USERS.custodianB.fullName,
      holder: { userId: USERS.custodianB.userId, name: USERS.custodianB.fullName },
      currentLocation: LAB.shortCode,
      condition: "OPERATIONAL",
    });
  });

  it("approve: a loan with no destination lab leaves the asset at its home lab", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0123", homeRoom: "Test Room 1" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB, { lab: undefined });

    await asLabHead.put(`/api/loans/${loanId}/decision`, { decision: "approve" });

    expect((await listedAsset(asset.tag)).currentLocation).toBe(`${LAB.shortCode}, Test Room 1`);
  });

  it("decline: closes the loan as Declined, with who decided, and leaves the asset Available", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0124" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);

    const res = await asLabHead.put(`/api/loans/${loanId}/decision`, { decision: "decline" });

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe("DECLINED");
    const loan = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } });
    expect(loan.decided_by_id).toBe(USERS.labHead.userId);
    expect(loan.closed_at).not.toBeNull();
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "AVAILABLE", holder: null, openLoan: null });
  });

  it.each([
    { status: "MAINTENANCE" as const, label: "Maintenance", tag: "TEST-0127" },
    { status: "DISPOSED" as const, label: "Retired", tag: "TEST-0128" },
  ])("approve: answers 409 when the asset is $label now, and writes nothing (issue #28)", async ({ status, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, status });
    const loan = await db.asset_loans.create({
      data: { asset_id: asset.assetId, borrower_id: USERS.custodianB.userId, purpose: "Test old pending loan", return_by: new Date(inDays(30)), status: "PENDING_APPROVAL" },
    });
    const before = await assetStatus(asset.assetId);

    const res = await asLabHead.put(`/api/loans/${loan.loan_id}/decision`, { decision: "approve" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: `${tag} is ${label} and cannot be requested for a loan.` });
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loan.loan_id } })).status).toBe("PENDING_APPROVAL");
    expect(await assetStatus(asset.assetId)).toBe(before);
  });

  it("after an approval the asset is on loan, so a new borrow request answers 409 (issue #25)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0125" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);
    await asLabHead.put(`/api/loans/${loanId}/decision`, { decision: "approve" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(409);
  });

  it("after a decline the asset takes a new borrow request", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0126" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);
    await asLabHead.put(`/api/loans/${loanId}/decision`, { decision: "decline" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(200);
  });

  it.each(["approve", "decline"])("answers 400 to %s on a loan that is already decided, and changes nothing", async (decision) => {

    const res = await asLabHead.put(`/api/loans/${SEEDED_ROWS.approvedLoanId}/decision`, { decision });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/is On Loan, so it can no longer be decided/);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } })).status).toBe("ON_LOAN");
    expect(await assetStatus(ASSETS.onLoan.assetId)).toBe("ON_LOAN");
  });

  it.each([
    { decision: "reject", why: "the word LabHeadAnalyticsView sends (restructure log note)" },
    { decision: "approved", why: "a status, not a decision" },
    { decision: undefined, why: "no decision" },
  ])("answers 400 for $decision, $why, and leaves the loan pending", async ({ decision }) => {
    const res = await asLabHead.put(`/api/loans/${SEEDED_ROWS.pendingLoanId}/decision`, { decision });

    expect(res.status).toBe(400);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.pendingLoanId } })).status).toBe("PENDING_APPROVAL");
  });

  it("answers 400 for an id that is not a number, such as the LOAN-n id the list shows", async () => {
    const res = await asLabHead.put(`/api/loans/LOAN-${SEEDED_ROWS.pendingLoanId}/decision`, { decision: "approve" });

    expect(res.status).toBe(400);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.pendingLoanId } })).status).toBe("PENDING_APPROVAL");
  });

  it("answers 404 for an unknown id", async () => {
    const res = await asLabHead.put("/api/loans/9999/decision", { decision: "approve" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
