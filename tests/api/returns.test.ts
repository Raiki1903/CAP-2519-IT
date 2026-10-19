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

const { db, as } = useApiHarness();
const asStaff = as(USERS.staffTsg);

/** What ReturnForm sends: who returned it, the condition, and the inspection notes. */
const returnBody = (extra: Record<string, unknown> = {}) => ({
  returnedBy: USERS.custodianA.fullName, // not read since 13c
  condition: "OPERATIONAL",
  comments: "Test return comment",
  ...extra,
});

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_returns", () => {
  it("answers an empty list when nothing has been returned", async () => {
    const res = await asStaff.get("/api/asset_returns");

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
      const res = await asStaff.get("/api/asset_returns");

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
  it("records the return and puts the asset back in the pool: ACTIVE, the reported condition, the placeholder custodian (user 1), back at its home lab", async () => {
    const asset = await addExtraAsset(db, {
      tag: "TEST-0201",
      status: "ON_LOAN",
      custodianId: USERS.custodianA.userId,
      currentLocation: `Laguna${LOCATION_SEPARATOR}CeLT`,
    });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

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
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "Active" });
    expect((await listedAsset(asset.tag)).custodian, "nobody holds it: no name").toBeUndefined();
  });

  it("finalizing a return leaves the loan open (known defect H-04)", async () => {
    const res = await asStaff.post(`/api/assets/${ASSETS.onLoan.tag}/return`, returnBody());

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

      const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ condition }));

      expect(res.status).toBe(200);
      expect(res.body.return.condition).toBe(condition);
      expect((await newestRecord(asset.assetId)).asset_condition).toBe(condition);
    },
  );

  it("keeps the earlier remarks when no comment is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0221", status: "ON_LOAN", remarks: "Test earlier remark" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ comments: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.return.comments).toBeNull();
    expect((await newestRecord(asset.assetId)).Asset_Remarks).toBe("Test earlier remark");
  });

  it("takes the inspection text as the comment when no comment is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0222", status: "ON_LOAN" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ comments: undefined, inspection: "Test inspection note" }));

    expect(res.body.return.comments).toBe("Test inspection note");
    expect((await newestRecord(asset.assetId)).Asset_Remarks).toBe("Test inspection note");
  });

  it.each([
    { returnedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0231" },
    { returnedBy: undefined, case: "no name", tag: "TEST-0232" },
  ])("files the return under the asset's current custodian for $case, not under user 1 (H-10 fixed)", async ({ returnedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianB.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ returnedBy }));

    expect(res.status).toBe(200);
    expect(res.body.return.returned_by_id).toBe(USERS.custodianB.userId);
  });

  it.each([
    { case: "disposed", tag: "TEST-0241", status: "DISPOSED" as const, message: "TEST-0241 is disposed and cannot be returned." },
    {
      case: "under maintenance",
      tag: "TEST-0242",
      status: "MAINTENANCE" as const,
      message: "TEST-0242 is under maintenance and cannot be returned until its repair is finished.",
    },
    { case: "Active in the pool", tag: "TEST-0243", status: "ACTIVE" as const, message: "TEST-0243 is not out with anyone, so there is nothing to return." },
  ])("answers 409 for an asset that is $case, and writes nothing (issue #51)", async ({ tag, status, message }) => {
    const asset = await addExtraAsset(db, { tag, status });
    const before = await newestRecord(asset.assetId);

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await db.asset_returns.count({ where: { asset_id: asset.assetId } })).toBe(0);
    expect(await newestRecord(asset.assetId)).toEqual(before);
  });

  it("answers 409 for an asset with no record, and writes nothing (issue #51)", async () => {
    const asset = await db.assets.create({ data: { asset_tag: "TEST-0244", name: "Test Asset Without Records", category: "DEV_KIT" } });

    const res = await asStaff.post(`/api/assets/${asset.asset_tag}/return`, returnBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TEST-0244 is not out with anyone, so there is nothing to return.");
    expect(await db.asset_returns.count({ where: { asset_id: asset.asset_id } })).toBe(0);
    expect(await db.asset_records.count({ where: { asset_id: asset.asset_id } })).toBe(0);
  });

  it("answers 409 to a second return of the same asset, and writes nothing more (a stale request, issue #51)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0245", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const first = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());
    const afterFirst = await newestRecord(asset.assetId);
    const second = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody({ condition: "DEGRADED" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("TEST-0245 is not out with anyone, so there is nothing to return.");
    expect(await db.asset_returns.count({ where: { asset_id: asset.assetId } })).toBe(1);
    expect(await newestRecord(asset.assetId)).toEqual(afterFirst);
  });

  it("accepts an Active asset a custodian holds, and files the return under that custodian (issue #51)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0246", status: "ACTIVE", custodianId: USERS.custodianA.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, returnBody());

    expect(res.status).toBe(200);
    expect(res.body.return.returned_by_id).toBe(USERS.custodianA.userId);
    expect(await newestRecord(asset.assetId)).toMatchObject({ status: "ACTIVE", current_custodian: USERS.admin.userId });
  });

  it.each([
    { condition: undefined, case: "no condition" },
    { condition: "Broken", case: "a condition outside the five" },
    { condition: "operational", case: "a condition in lower case" },
    { condition: "MINOR DRIFT", case: "the stored spelling with a space" },
  ])("answers 400 for $case, and writes nothing", async ({ condition }) => {
    const returnsBefore = await db.asset_returns.count();
    const recordsBefore = await db.asset_records.count();

    const res = await asStaff.post(`/api/assets/${ASSETS.available.tag}/return`, returnBody({ condition }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_returns.count()).toBe(returnsBefore);
    expect(await db.asset_records.count()).toBe(recordsBefore);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.post("/api/assets/TEST-9999/return", returnBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
