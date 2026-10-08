/**
 * Loans API: the borrow request, the loan list, and the Lab Head's decision.
 * Covers POST /api/assets/:tag/borrow, GET /api/asset_loans, PUT /api/asset_loans/:id/decision.
 * Workflow: borrowing (Custodian files a request, Lab Head approves or declines, custody moves on approval).
 * Fixtures: the seeded loans (LOAN-1 approved on TEST-0002, LOAN-2 pending on TEST-0005), the seeded assets in
 * each state, and the accounts (USERS). The list tests run first. The write tests use their own extra assets
 * (TEST-0101 onward, see extraAssets.ts) and change no seeded row; the H-08 test puts LOAN-2 back and removes LOAN-9.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

const DAY_MS = 24 * 60 * 60 * 1000;
/** The loan id and asset name GET /api/asset_loans invents. (H-08) */
const INVENTED_LOAN_ID = 9;
const INVENTED_ASSET_NAME = "ASUS TUF Gaming A15";

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

/** What LoanForm sends: the borrower's typed name, the destination lab, the purpose, and the due date. */
const borrowBody = (borrower: TestUser | string, extra: Record<string, unknown> = {}) => ({
  borrower: typeof borrower === "string" ? borrower : borrower.fullName,
  lab: LAB.shortCode,
  purpose: "Test borrow purpose",
  dueDate: inDays(14),
  ...extra,
});

const recordCount = (assetId: number) => db.asset_records.count({ where: { asset_id: assetId } });

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

/** Files a borrow request through the API and answers the new loan's id. */
async function requestLoan(tag: string, borrower: TestUser, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await api.post(`/api/assets/${tag}/borrow`, borrowBody(borrower, extra));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.loan.loan_id;
}

async function listedAsset(tag: string) {
  const res = await api.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_loans", () => {
  it("lists every loan newest first, with the destination lab moved out of the purpose", async () => {
    const res = await api.get("/api/asset_loans");

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
      data: { asset_id: ASSETS.disposed.assetId, borrower_id: USERS.custodianA.userId, purpose: "Test purpose without a lab", due_date: new Date("2026-01-20"), status: "declined" },
    });
    try {
      const res = await api.get("/api/asset_loans");

      const listed = res.body.loans.find((l: { loanId: number }) => l.loanId === plain.loan_id);
      expect(listed).toMatchObject({ purpose: "Test purpose without a lab", status: "Declined" });
      expect(listed.destinationLab).toBeUndefined();
    } finally {
      await db.asset_loans.delete({ where: { loan_id: plain.loan_id } });
    }
  });

  it("writes nothing while some loan is pending", async () => {
    const before = await db.asset_loans.count();

    await api.get("/api/asset_loans");

    expect(await db.asset_loans.count()).toBe(before);
  });

  it("inserts a pending loan with id 9 for the first asset and first student when no loan is pending, and names its asset ASUS TUF Gaming A15 (known defect H-08)", async () => {
    const pendingIds = (await db.asset_loans.findMany({ where: { status: "pending" }, select: { loan_id: true } })).map((l) => l.loan_id);
    await db.asset_loans.updateMany({ where: { loan_id: { in: pendingIds } }, data: { status: "declined" } });
    try {
      const before = await db.asset_loans.count();

      const res = await api.get("/api/asset_loans");

      expect(res.status).toBe(200);
      expect(res.body.loans[0]).toMatchObject({
        id: `LOAN-${INVENTED_LOAN_ID}`,
        assetId: ASSETS.available.tag,
        asset: INVENTED_ASSET_NAME,
        assetName: INVENTED_ASSET_NAME,
        borrower: USERS.custodianA.fullName,
        purpose: "Graphics & AI Performance Testing",
        status: "Pending",
      });
      expect(await db.asset_loans.findUniqueOrThrow({ where: { loan_id: INVENTED_LOAN_ID } })).toMatchObject({
        asset_id: ASSETS.available.assetId,
        borrower_id: USERS.custodianA.userId,
        status: "pending",
      });
      expect(await db.asset_loans.count()).toBe(before + 1);

      await api.get("/api/asset_loans");
      expect(await db.asset_loans.count()).toBe(before + 1);
    } finally {
      await db.asset_loans.deleteMany({ where: { loan_id: INVENTED_LOAN_ID } });
      await db.asset_loans.updateMany({ where: { loan_id: { in: pendingIds } }, data: { status: "pending" } });
    }
  });
});

describe("POST /api/assets/:tag/borrow", () => {
  it("files a pending loan under the borrower found by typed name, with the destination lab written into the purpose, and leaves custody alone", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0101" });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loan).toMatchObject({
      asset_id: asset.assetId,
      borrower_id: USERS.custodianB.userId,
      purpose: `Destination Lab: ${LAB.shortCode}\n\nTest borrow purpose`,
      status: "pending",
    });
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "pending" } })).toBe(1);
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "Active", custodian: USERS.admin.fullName });
  });

  it("stores the purpose as typed when no lab is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0102" });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB, { lab: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.loan.purpose).toBe("Test borrow purpose");
  });

  it("drops a leading 'Dr.' from the typed name before matching it", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0103" });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(`Dr. ${USERS.custodianA.fullName}`));

    expect(res.body.loan.borrower_id).toBe(USERS.custodianA.userId);
  });

  it("files the loan under user 1 when the typed name matches nobody (known defect H-10)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0104" });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody("Nobody Known"));

    expect(res.status).toBe(200);
    expect(res.body.loan.borrower_id).toBe(USERS.admin.userId);
  });

  it.each(["borrower", "purpose", "dueDate"])("answers 400 without %s, and writes nothing", async (field) => {
    const before = await db.asset_loans.count();

    const res = await api.post(`/api/assets/${ASSETS.available.tag}/borrow`, borrowBody(USERS.custodianB, { [field]: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_loans.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.post("/api/assets/TEST-9999/borrow", borrowBody(USERS.custodianB));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/assets/:tag/borrow: one pending request per asset (issue #25)", () => {
  it("rejects a second custodian request on the same asset with 409 (issue #25)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0111" });

    const first = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));
    expect(first.status).toBe(200);

    const second = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));
    expect(second.status).toBe(409);
    expect(second.body.error).toContain(`LOAN-${first.body.loan.loan_id}`);

    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "pending" } })).toBe(1);
  });

  it("answers 409 for the seeded asset whose loan request is still pending", async () => {
    const res = await api.post(`/api/assets/${ASSETS.pendingLoan.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(`LOAN-${SEEDED_ROWS.pendingLoanId}`);
  });

  it("answers 409 for an asset with a pending transfer request", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0112", custodianId: USERS.custodianA.userId });
    const transfer = await db.asset_transfers.create({
      data: { asset_id: asset.assetId, from_custodian_id: USERS.custodianA.userId, to_custodian_id: USERS.custodianB.userId, justification: "Test pending transfer", status: "pending" },
    });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(`TRF-${transfer.transfer_id}`);
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it.each([ASSETS.onLoan, ASSETS.inRepair, ASSETS.disposed])("answers 409 for $tag, which is $listStatus, and writes nothing", async (asset) => {
    const before = await db.asset_loans.count({ where: { asset_id: asset.assetId } });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianB));

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(before);
  });
});

describe("PUT /api/asset_loans/:id/decision", () => {
  it("approve: marks the loan approved and adds an ON_LOAN record under the borrower at the destination lab, keeping the home lab and condition", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0121", condition: "OPERATIONAL" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB, { lab: "CeLT" });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_loans/${loanId}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, loan: { loan_id: loanId, status: "approved" } });
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } })).status).toBe("approved");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore + 1);
    expect(await newestRecord(asset.assetId)).toMatchObject({
      status: "ON_LOAN",
      current_custodian: USERS.custodianB.userId,
      location: LAB.homeLocation,
      current_location: `Laguna${LOCATION_SEPARATOR}CeLT`,
      asset_condition: "OPERATIONAL",
    });
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "On Loan", custodian: USERS.custodianB.fullName });
  });

  it("approve: writes a Manila destination for a lab not on the Laguna list", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0122" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB, { lab: "TESTX" });

    await api.put(`/api/asset_loans/${loanId}/decision`, { decision: "approve" });

    expect((await newestRecord(asset.assetId)).current_location).toBe(`Manila${LOCATION_SEPARATOR}TESTX`);
  });

  it("approve: keeps the asset's current location when the request named no lab", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0123", currentLocation: `Manila${LOCATION_SEPARATOR}Test Elsewhere` });
    const loanId = await requestLoan(asset.tag, USERS.custodianB, { lab: undefined });

    await api.put(`/api/asset_loans/${loanId}/decision`, { decision: "approve" });

    expect((await newestRecord(asset.assetId)).current_location).toBe(`Manila${LOCATION_SEPARATOR}Test Elsewhere`);
  });

  it("decline: marks the loan declined and leaves custody alone", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0124" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_loans/${loanId}/decision`, { decision: "decline" });

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe("declined");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "Active", custodian: USERS.admin.fullName });
  });

  it("after an approval the asset is on loan, so a new borrow request answers 409 (issue #25)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0125" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);
    await api.put(`/api/asset_loans/${loanId}/decision`, { decision: "approve" });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(409);
  });

  it("after a decline the asset takes a new borrow request", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0126" });
    const loanId = await requestLoan(asset.tag, USERS.custodianB);
    await api.put(`/api/asset_loans/${loanId}/decision`, { decision: "decline" });

    const res = await api.post(`/api/assets/${asset.tag}/borrow`, borrowBody(USERS.custodianA));

    expect(res.status).toBe(200);
  });

  it.each(["approve", "decline"])("answers 400 to %s on a loan that is already decided, and changes nothing", async (decision) => {
    const recordsBefore = await recordCount(ASSETS.onLoan.assetId);

    const res = await api.put(`/api/asset_loans/${SEEDED_ROWS.approvedLoanId}/decision`, { decision });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been approved/);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } })).status).toBe("approved");
    expect(await recordCount(ASSETS.onLoan.assetId)).toBe(recordsBefore);
  });

  it.each([
    { decision: "reject", why: "the word LabHeadAnalyticsView sends (restructure log note)" },
    { decision: "approved", why: "a status, not a decision" },
    { decision: undefined, why: "no decision" },
  ])("answers 400 for $decision, $why, and leaves the loan pending", async ({ decision }) => {
    const res = await api.put(`/api/asset_loans/${SEEDED_ROWS.pendingLoanId}/decision`, { decision });

    expect(res.status).toBe(400);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.pendingLoanId } })).status).toBe("pending");
  });

  it("answers 400 for an id that is not a number, such as the LOAN-n id the list shows", async () => {
    const res = await api.put(`/api/asset_loans/LOAN-${SEEDED_ROWS.pendingLoanId}/decision`, { decision: "approve" });

    expect(res.status).toBe(400);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.pendingLoanId } })).status).toBe("pending");
  });

  it("answers 404 for an unknown id", async () => {
    const res = await api.put("/api/asset_loans/9999/decision", { decision: "approve" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
