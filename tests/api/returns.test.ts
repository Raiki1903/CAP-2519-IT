/**
 * Returns API: finalizing a return and the list of returns.
 * Covers POST /api/assets/:tag/return, and that GET /api/asset_returns is gone.
 * Workflow: returning a borrowed asset (TSG records the condition, the loan closes, the asset is Available again).
 * Fixtures: the seeded approved loan LOAN-1 on TEST-0002, the accounts (USERS). The list tests run first and remove
 * the rows they add. The write tests return TEST-0002 (its loan LOAN-1 closes, H-04) and otherwise use their own extra assets
 * (TEST-0201 onward, see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asStaff = as(USERS.staffTsg);

/** What ReturnForm sends: who returned it, the condition, and the inspection notes. */
const returnBody = (extra: Record<string, unknown> = {}) => ({
  returnedBy: USERS.custodianA.fullName, // not read since 13c
  condition: "OPERATIONAL",
  comments: "Test return comment",
  ...extra,
});

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_returns", () => {
  it("is gone with its table: 404", async () => {
    const res = await asStaff.get("/api/asset_returns");

    expect(res.status).toBe(404);
  });
});

describe("POST /api/assets/:tag/return", () => {
  it("closes the held loan as Returned, files a Return inspection with the condition, and puts the asset back to Available at home", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0201", status: "ON_LOAN", custodianId: USERS.custodianA.userId, homeRoom: "Test Room 2" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loan).toMatchObject({ loan_id: asset.loanId, asset_id: asset.assetId, borrower_id: USERS.custodianA.userId, status: "RETURNED" });
    expect(res.body.referenceNumber).toBe(`LOAN-${asset.loanId}`);

    const loan = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: asset.loanId! } });
    expect(loan).toMatchObject({ status: "RETURNED", received_by_id: USERS.staffTsg.userId, remarks: "Test return comment" });
    expect(loan.closed_at).not.toBeNull();
    const inspection = await db.asset_inspections.findUniqueOrThrow({ where: { inspection_id: loan.return_inspection_id! } });
    expect(inspection).toMatchObject({ asset_id: asset.assetId, type: "RETURN", condition: "OPERATIONAL", inspected_by_id: USERS.staffTsg.userId, remarks: "Test return comment" });

    expect(await listedAsset(asset.tag)).toMatchObject({ status: "AVAILABLE", holder: null, currentLocation: `${LAB.shortCode}, Test Room 2`, condition: "OPERATIONAL" });
    expect((await listedAsset(asset.tag)).custodian, "nobody holds it: no name").toBeUndefined();
  });

  it("finalizing a return closes the asset's loan, and the loan list shows it as Returned (issue #99, H-04 fixed)", async () => {
    const res = await asStaff.post(`/api/assets/${ASSETS.onLoan.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } })).status).toBe("RETURNED");
    const loans = await asStaff.get("/api/loans");
    expect(loans.body.loans.find((l: { loanId: number }) => l.loanId === SEEDED_ROWS.approvedLoanId).status).toBe("Returned");
    const listed = await listedAsset(ASSETS.onLoan.tag);
    expect(listed.status).toBe("AVAILABLE");
    expect(listed.dueDate).toBeUndefined();
  });

  it("closes only the held loan, and leaves the asset's other loans and other assets' loans alone (issue #99)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0251", status: "ON_LOAN", custodianId: USERS.custodianA.userId });
    const other = await addExtraAsset(db, { tag: "TEST-0252", status: "ON_LOAN", custodianId: USERS.custodianB.userId });
    const declined = await db.asset_loans.create({
      data: {
        asset_id: asset.assetId,
        borrower_id: USERS.custodianB.userId,
        purpose: "Test purpose: an older declined loan",
        requested_at: new Date("2026-03-01T09:00:00Z"),
        return_by: new Date("2026-12-01T00:00:00Z"),
        status: "DECLINED",
      },
    });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    const statusOf = async (loanId: number) => (await db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } })).status;
    expect(await statusOf(asset.loanId!)).toBe("RETURNED");
    expect(await statusOf(declined.loan_id)).toBe("DECLINED");
    expect(await statusOf(other.loanId!)).toBe("ON_LOAN");
  });

  it("a refused return (409) leaves the asset's loan as it was (issue #99)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0254", status: "MAINTENANCE" });
    const held = await db.asset_loans.create({
      data: {
        asset_id: asset.assetId,
        borrower_id: USERS.custodianA.userId,
        purpose: "Test purpose: loan on an asset in maintenance",
        return_by: new Date("2026-12-01T00:00:00Z"),
        status: "ON_LOAN",
      },
    });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(409);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: held.loan_id } })).status).toBe("ON_LOAN");
  });

  it.each([
    { condition: "MINOR_DRIFT", tag: "TEST-0211" },
    { condition: "CRITICAL_DEFECT", tag: "TEST-0212" },
  ])(
    "stores $condition on the return and the Return inspection (on the schema.prisma database; H-21 cannot be reproduced here)",
    async ({ condition, tag }) => {
      const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId });

      const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ condition }));

      expect(res.status).toBe(200);
      expect(res.body.loan.status).toBe("RETURNED");
      expect((await listedAsset(asset.tag)).condition).toBe(condition);
    },
  );

  it("stores no comment when none is sent, and the inspection gets a fixed remark", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0221", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ comments: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.loan.remarks).toBeNull();
    const loan = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: asset.loanId! } });
    expect(loan.remarks).toBeNull();
    expect((await db.asset_inspections.findUniqueOrThrow({ where: { inspection_id: loan.return_inspection_id! } })).remarks).toBe("Return inspection.");
  });

  it("takes the inspection text as the comment when no comment is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0222", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ comments: undefined, inspection: "Test inspection note" }));

    expect(res.body.loan.remarks).toBe("Test inspection note");
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: asset.loanId! } })).remarks).toBe("Test inspection note");
  });

  it.each([
    { returnedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0231" },
    { returnedBy: undefined, case: "no name", tag: "TEST-0232" },
  ])("files the return under the loan's borrower for $case, not under user 1 (H-10 fixed)", async ({ returnedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianB.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ returnedBy }));

    expect(res.status).toBe(200);
    expect(res.body.loan.borrower_id).toBe(USERS.custodianB.userId);
  });

  it.each([
    { case: "retired", tag: "TEST-0241", status: "DISPOSED" as const, message: "TEST-0241 is Retired, so there is nothing to return." },
    { case: "in maintenance", tag: "TEST-0242", status: "MAINTENANCE" as const, message: "TEST-0242 is Maintenance, so there is nothing to return." },
    { case: "Available", tag: "TEST-0243", status: "ACTIVE" as const, message: "TEST-0243 is Available, so there is nothing to return." },
  ])("answers 409 for an asset that is $case, and writes nothing (issue #51)", async ({ tag, status, message }) => {
    const asset = await addExtraAsset(db, { tag, status });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "RETURNED" } })).toBe(0);
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("answers 409 for an asset On Loan with no loan to close (old data), and writes nothing (issue #51)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0244", status: "ON_LOAN" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TEST-0244 has no loan to close, so there is nothing to return.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "RETURNED" } })).toBe(0);
  });

  it("answers 409 to a second return of the same asset, and writes nothing more (a stale request, issue #51)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0245", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const first = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());
    const second = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ condition: "DEGRADED" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("TEST-0245 is Available, so there is nothing to return.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId, status: "RETURNED" } })).toBe(1);
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it.each([
    { condition: undefined, case: "no condition" },
    { condition: "Broken", case: "a condition outside the five" },
    { condition: "operational", case: "a condition in lower case" },
    { condition: "MINOR DRIFT", case: "the stored spelling with a space" },
  ])("answers 400 for $case, and writes nothing", async ({ condition }) => {
    const returnsBefore = await db.asset_loans.count({ where: { status: "RETURNED" } });
    const inspectionsBefore = await db.asset_inspections.count();

    const res = await asStaff.post(`/api/assets/${ASSETS.onLoan.tag}/return`, returnBody({ condition }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_loans.count({ where: { status: "RETURNED" } })).toBe(returnsBefore);
    expect(await db.asset_inspections.count()).toBe(inspectionsBefore);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.post("/api/assets/TEST-9999/return", returnBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
