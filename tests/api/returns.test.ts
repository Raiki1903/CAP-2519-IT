/**
 * Returns API: finalizing a return and the list of returns.
 * Covers POST /api/assets/:tag/return, GET /api/asset_returns.
 * Workflow: returning a borrowed asset (TSG or ITS records the condition, the asset goes back to the pool).
 * Fixtures: the seeded approved loan LOAN-1 on TEST-0002, the accounts (USERS). The list tests run first and remove
 * the rows they add. The write tests return TEST-0002 (for H-04) and otherwise use their own extra assets
 * (TEST-0201 onward, see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

/** What ReturnForm sends: who returned it, the condition, and the inspection notes. */
const returnBody = (extra: Record<string, unknown> = {}) => ({
  returnedBy: USERS.custodianA.fullName,
  condition: "OPERATIONAL",
  comments: "Test return comment",
  ...extra,
});

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

async function listedAsset(tag: string) {
  const res = await api.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_returns", () => {
  it("answers an empty list when nothing has been returned", async () => {
    const res = await api.get("/api/asset_returns");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, returns: [] });
  });

  it("lists returns newest first, with the asset and the person who returned it", async () => {
    const older = await db.asset_returns.create({
      data: {
        asset_id: ASSETS.inspected.assetId,
        returned_by_id: USERS.custodianA.userId,
        condition: "OPERATIONAL",
        reference_number: "TEST-RET-OLDER",
        returned_on: new Date("2026-05-01T09:00:00Z"),
      },
    });
    const newer = await db.asset_returns.create({
      data: {
        asset_id: ASSETS.onLoan.assetId,
        returned_by_id: USERS.custodianB.userId,
        condition: "DEGRADED",
        reference_number: "TEST-RET-NEWER",
        returned_on: new Date("2026-06-01T09:00:00Z"),
      },
    });
    try {
      const res = await api.get("/api/asset_returns");

      expect(res.status).toBe(200);
      expect(res.body.returns.map((r: { id: string }) => r.id)).toEqual([`RET-${newer.return_id}`, `RET-${older.return_id}`]);
      expect(res.body.returns[0]).toMatchObject({
        returnId: newer.return_id,
        assetId: ASSETS.onLoan.tag,
        asset: ASSETS.onLoan.name,
        returnedBy: USERS.custodianB.fullName,
        condition: "DEGRADED",
        referenceNumber: "TEST-RET-NEWER",
      });
      expect(typeof res.body.returns[0].returnedOn).toBe("string");
    } finally {
      await db.asset_returns.deleteMany({ where: { return_id: { in: [older.return_id, newer.return_id] } } });
    }
  });
});

describe("POST /api/assets/:tag/return", () => {
  it("records the return and puts the asset back in the pool: ACTIVE, the reported condition, user 1, back at its home lab", async () => {
    const asset = await addExtraAsset(db, {
      tag: "TEST-0201",
      status: "ON_LOAN",
      custodianId: USERS.custodianA.userId,
      currentLocation: `Laguna${LOCATION_SEPARATOR}CeLT`,
    });

    const res = await api.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.return).toMatchObject({
      asset_id: asset.assetId,
      returned_by_id: USERS.custodianA.userId,
      condition: "OPERATIONAL",
      comments: "Test return comment",
    });
    expect(res.body.return.reference_number).toMatch(/^CLR-/);
    expect(await db.asset_returns.count({ where: { asset_id: asset.assetId } })).toBe(1);
    expect(await newestRecord(asset.assetId)).toMatchObject({
      status: "ACTIVE",
      asset_condition: "OPERATIONAL",
      current_custodian: USERS.admin.userId,
      location: LAB.homeLocation,
      current_location: LAB.homeLocation,
      Asset_Remarks: "Test return comment",
    });
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "Active", custodian: USERS.admin.fullName });
  });

  it("finalizing a return leaves the loan open (known defect H-04)", async () => {
    const res = await api.post(`/api/assets/${ASSETS.onLoan.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } })).status).toBe("approved");
    const listed = await listedAsset(ASSETS.onLoan.tag);
    expect(listed.status).toBe("Active");
    expect(listed.dueDate).toBeUndefined();
  });

  it.each([
    { condition: "MINOR_DRIFT", tag: "TEST-0211" },
    { condition: "CRITICAL_DEFECT", tag: "TEST-0212" },
  ])(
    "stores $condition on the return and the record (on the schema.prisma database; H-21 cannot be reproduced here)",
    async ({ condition, tag }) => {
      const asset = await addExtraAsset(db, { tag, status: "ON_LOAN" });

      const res = await api.post(`/api/assets/${asset.tag}/return`, returnBody({ condition }));

      expect(res.status).toBe(200);
      expect(res.body.return.condition).toBe(condition);
      expect((await newestRecord(asset.assetId)).asset_condition).toBe(condition);
    },
  );

  it("keeps the earlier remarks when no comment is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0221", status: "ON_LOAN", remarks: "Test earlier remark" });

    const res = await api.post(`/api/assets/${asset.tag}/return`, returnBody({ comments: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.return.comments).toBeNull();
    expect((await newestRecord(asset.assetId)).Asset_Remarks).toBe("Test earlier remark");
  });

  it("takes the inspection text as the comment when no comment is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0222", status: "ON_LOAN" });

    const res = await api.post(`/api/assets/${asset.tag}/return`, returnBody({ comments: undefined, inspection: "Test inspection note" }));

    expect(res.body.return.comments).toBe("Test inspection note");
    expect((await newestRecord(asset.assetId)).Asset_Remarks).toBe("Test inspection note");
  });

  it.each([
    { returnedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0231" },
    { returnedBy: undefined, case: "no name", tag: "TEST-0232" },
  ])("files the return under user 1 for $case (known defect H-10)", async ({ returnedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag, status: "ON_LOAN" });

    const res = await api.post(`/api/assets/${asset.tag}/return`, returnBody({ returnedBy }));

    expect(res.status).toBe(200);
    expect(res.body.return.returned_by_id).toBe(USERS.admin.userId);
  });

  it("accepts a return for an asset that is not on loan, and makes a disposed asset ACTIVE again (known defect H-05)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0241", status: "DISPOSED" });

    const res = await api.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    expect((await newestRecord(asset.assetId)).status).toBe("ACTIVE");
    expect((await listedAsset(asset.tag)).status).toBe("Active");
  });

  it.each([
    { condition: undefined, case: "no condition" },
    { condition: "Broken", case: "a condition outside the five" },
    { condition: "operational", case: "a condition in lower case" },
    { condition: "MINOR DRIFT", case: "the stored spelling with a space" },
  ])("answers 400 for $case, and writes nothing", async ({ condition }) => {
    const returnsBefore = await db.asset_returns.count();
    const recordsBefore = await db.asset_records.count();

    const res = await api.post(`/api/assets/${ASSETS.available.tag}/return`, returnBody({ condition }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_returns.count()).toBe(returnsBefore);
    expect(await db.asset_records.count()).toBe(recordsBefore);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.post("/api/assets/TEST-9999/return", returnBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
