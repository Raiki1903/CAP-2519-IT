/**
 * Disposals API: the disposal request, the disposal list, and the Director's decision.
 * Covers POST /api/assets/:tag/disposal, GET /api/asset_disposals, PUT /api/asset_disposals/:id/decision.
 * Workflow: decommissioning (Staff files a request, the AdRIC Director approves or rejects it, the asset becomes
 * DISPOSED on approval).
 * Fixtures: the seeded approved disposal DISP-1 by Staff TSG on TEST-0004, the accounts (USERS). The list tests run
 * first and remove the rows they add. The write tests use their own extra assets (TEST-0601 onward, see
 * extraAssets.ts) and change no seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

/** What DisposalFormDialog sends: who files it, the last custodian, the reasons, the pathway, and the target date. */
const disposalBody = (extra: Record<string, unknown> = {}) => ({
  requestedBy: USERS.staffTsg.fullName,
  lastCustodian: "Test Typed Custodian",
  breakdownReasons: "Test breakdown: the screen is cracked",
  disposalPathway: "Test pathway: recycle",
  decommissionDate: "2026-12-01",
  ...extra,
});

const recordCount = (assetId: number) => db.asset_records.count({ where: { asset_id: assetId } });

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

const disposalStatus = async (disposalId: number) => (await db.asset_disposals.findUniqueOrThrow({ where: { disposal_id: disposalId } })).status;

/** Files a disposal request through the API and answers the new disposal's id. */
async function requestDisposal(tag: string, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await api.post(`/api/assets/${tag}/disposal`, disposalBody(extra));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.disposal.disposal_id;
}

async function listedAsset(tag: string) {
  const res = await api.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_disposals", () => {
  it("lists the seeded disposal with the fields the Director's queue reads", async () => {
    const res = await api.get("/api/asset_disposals");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disposals).toHaveLength(1);
    expect(res.body.disposals[0]).toMatchObject({
      id: `DISP-${SEEDED_ROWS.disposalId}`,
      disposalId: SEEDED_ROWS.disposalId,
      assetId: ASSETS.disposed.tag,
      assetName: ASSETS.disposed.name,
      requestedBy: USERS.staffTsg.fullName,
      reason: "Disposal Pathway: Test pathway\n\nBreakdown Justification:\nTest breakdown: the board is burnt",
      status: "Approved",
    });
    expect(typeof res.body.disposals[0].requestedAt).toBe("string");
  });

  it("lists disposals newest first, and shows any status other than approved or rejected as Pending (H-07 family)", async () => {
    const statuses = ["pending", "rejected", "Test unknown status"];
    const rows = [];
    for (const [index, status] of statuses.entries()) {
      rows.push(
        await db.asset_disposals.create({
          data: {
            asset_id: ASSETS.available.assetId,
            disposed_by_id: USERS.staffIts.userId,
            disposal_reason: `Test disposal ${status}`,
            status,
            disposal_date: new Date(`2026-06-0${index + 1}T09:00:00Z`),
          },
        }),
      );
    }
    try {
      const res = await api.get("/api/asset_disposals");

      expect(res.body.disposals.map((d: { disposalId: number }) => d.disposalId)).toEqual([
        rows[2].disposal_id,
        rows[1].disposal_id,
        rows[0].disposal_id,
        SEEDED_ROWS.disposalId,
      ]);
      expect(res.body.disposals.map((d: { status: string }) => d.status)).toEqual(["Pending", "Rejected", "Pending", "Approved"]);
      expect(res.body.disposals[2]).toMatchObject({ assetId: ASSETS.available.tag, requestedBy: USERS.staffIts.fullName });
    } finally {
      await db.asset_disposals.deleteMany({ where: { disposal_id: { in: rows.map((r) => r.disposal_id) } } });
    }
  });
});

describe("POST /api/assets/:tag/disposal", () => {
  it("files a pending disposal under the requester found by typed name, and leaves the asset as it is", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0601", custodianId: USERS.custodianA.userId });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.post(`/api/assets/${asset.tag}/disposal`, disposalBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disposal).toMatchObject({ asset_id: asset.assetId, disposed_by_id: USERS.staffTsg.userId, status: "pending" });
    expect(await db.asset_disposals.count({ where: { asset_id: asset.assetId, status: "pending" } })).toBe(1);
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    const listed = await listedAsset(asset.tag);
    expect(listed).toMatchObject({ status: "Active", custodian: USERS.custodianA.fullName });
    expect(listed.disposalDetails).toBeUndefined();
  });

  it("packs the pathway, last custodian, target date, and justification into one reason text (known defect M-13)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0602" });
    const disposalId = await requestDisposal(asset.tag);

    const row = await db.asset_disposals.findUniqueOrThrow({ where: { disposal_id: disposalId } });
    expect(row.disposal_reason).toBe(
      "Disposal Pathway: Test pathway: recycle\n" +
        "Last Custodian: Test Typed Custodian\n" +
        "Target Decommission Date: 2026-12-01\n" +
        "\n" +
        "Breakdown Justification:\n" +
        "Test breakdown: the screen is cracked",
    );
  });

  it("leaves out the last custodian and target date lines when they are not sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0603" });
    const disposalId = await requestDisposal(asset.tag, { lastCustodian: undefined, decommissionDate: undefined });

    const row = await db.asset_disposals.findUniqueOrThrow({ where: { disposal_id: disposalId } });
    expect(row.disposal_reason).toBe("Disposal Pathway: Test pathway: recycle\n\nBreakdown Justification:\nTest breakdown: the screen is cracked");
  });

  it.each([
    { requestedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0604" },
    { requestedBy: undefined, case: "no name", tag: "TEST-0605" },
  ])("files the disposal under user 1 for $case (known defect H-10)", async ({ requestedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag });

    const res = await api.post(`/api/assets/${asset.tag}/disposal`, disposalBody({ requestedBy }));

    expect(res.status).toBe(200);
    expect(res.body.disposal.disposed_by_id).toBe(USERS.admin.userId);
  });

  it.each([
    { status: "ON_LOAN" as const, tag: "TEST-0611" },
    { status: "MAINTENANCE" as const, tag: "TEST-0612" },
    { status: "DISPOSED" as const, tag: "TEST-0613" },
  ])("accepts a disposal request for an asset that is $status (known defect H-05)", async ({ status, tag }) => {
    const asset = await addExtraAsset(db, { tag, status });

    const res = await api.post(`/api/assets/${asset.tag}/disposal`, disposalBody());

    expect(res.status).toBe(200);
    expect(res.body.disposal.status).toBe("pending");
  });

  it("accepts a second pending disposal on the same asset (known defect H-05)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0614" });

    await requestDisposal(asset.tag);
    const second = await api.post(`/api/assets/${asset.tag}/disposal`, disposalBody());

    expect(second.status).toBe(200);
    expect(await db.asset_disposals.count({ where: { asset_id: asset.assetId, status: "pending" } })).toBe(2);
  });

  it.each(["breakdownReasons", "disposalPathway"])("answers 400 without %s, and writes nothing", async (field) => {
    const before = await db.asset_disposals.count();

    const res = await api.post(`/api/assets/${ASSETS.available.tag}/disposal`, disposalBody({ [field]: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_disposals.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.post("/api/assets/TEST-9999/disposal", disposalBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/asset_disposals/:id/decision", () => {
  it("approve: marks the disposal approved and adds a DISPOSED record carrying the disposal id, the last custodian, and the condition", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0621", custodianId: USERS.custodianA.userId, condition: "DEGRADED" });
    const disposalId = await requestDisposal(asset.tag);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_disposals/${disposalId}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, disposal: { disposal_id: disposalId, status: "approved" } });
    expect(await disposalStatus(disposalId)).toBe("approved");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore + 1);
    expect(await newestRecord(asset.assetId)).toMatchObject({
      status: "DISPOSED",
      disposal_id: disposalId,
      current_custodian: USERS.custodianA.userId,
      asset_condition: "DEGRADED",
      location: LAB.homeLocation,
      current_location: null,
      Asset_Remarks: `Decommissioned via Disposal #DISP-${disposalId}`,
    });
  });

  it("approve: the asset list then shows it Disposed, with details read back out of the reason text and the record's custodian, not the typed one (M-13)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0622", custodianId: USERS.custodianA.userId });
    const disposalId = await requestDisposal(asset.tag);

    await api.put(`/api/asset_disposals/${disposalId}/decision`, { decision: "approve" });

    const listed = await listedAsset(asset.tag);
    expect(listed.status).toBe("Disposed");
    expect(listed.disposalDetails).toMatchObject({
      disposalPathway: "Test pathway: recycle",
      breakdownReasons: "Test breakdown: the screen is cracked",
      lastCustodian: USERS.custodianA.fullName,
      decommissionedBy: USERS.staffTsg.fullName,
    });
  });

  it("approve: disposes of an asset that is on loan, under its borrower at the borrower's lab (known defect H-05)", async () => {
    const asset = await addExtraAsset(db, {
      tag: "TEST-0623",
      status: "ON_LOAN",
      custodianId: USERS.custodianB.userId,
      currentLocation: `Laguna${LOCATION_SEPARATOR}CeLT`,
    });
    const disposalId = await requestDisposal(asset.tag);

    const res = await api.put(`/api/asset_disposals/${disposalId}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(await newestRecord(asset.assetId)).toMatchObject({ status: "DISPOSED", current_custodian: USERS.custodianB.userId });
  });

  it("approving both of two pending disposals on one asset adds two DISPOSED records (known defect H-05)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0624" });
    const first = await requestDisposal(asset.tag);
    const second = await requestDisposal(asset.tag);

    const answers = [
      await api.put(`/api/asset_disposals/${first}/decision`, { decision: "approve" }),
      await api.put(`/api/asset_disposals/${second}/decision`, { decision: "approve" }),
    ];

    expect(answers.map((a) => a.status)).toEqual([200, 200]);
    expect(await db.asset_records.count({ where: { asset_id: asset.assetId, status: "DISPOSED" } })).toBe(2);
  });

  it("reject: marks the disposal rejected and leaves the asset as it is", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0625", custodianId: USERS.custodianA.userId });
    const disposalId = await requestDisposal(asset.tag);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_disposals/${disposalId}/decision`, { decision: "reject" });

    expect(res.status).toBe(200);
    expect(res.body.disposal.status).toBe("rejected");
    expect(await disposalStatus(disposalId)).toBe("rejected");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect((await listedAsset(asset.tag)).status).toBe("Active");
  });

  it("answers 400 on a disposal that is already decided, and changes nothing", async () => {
    const recordsBefore = await recordCount(ASSETS.disposed.assetId);

    const res = await api.put(`/api/asset_disposals/${SEEDED_ROWS.disposalId}/decision`, { decision: "reject" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been approved/);
    expect(await disposalStatus(SEEDED_ROWS.disposalId)).toBe("approved");
    expect(await recordCount(ASSETS.disposed.assetId)).toBe(recordsBefore);
  });

  it.each([
    { decision: "decline", why: "the word loans and transfers use" },
    { decision: "approved", why: "the stored status" },
    { decision: undefined, why: "no decision" },
  ])("answers 400 for $decision, $why, and leaves the disposal pending", async ({ decision }) => {
    const disposal = await db.asset_disposals.create({
      data: { asset_id: ASSETS.available.assetId, disposed_by_id: USERS.staffTsg.userId, disposal_reason: "Test word check", status: "pending" },
    });
    try {
      const res = await api.put(`/api/asset_disposals/${disposal.disposal_id}/decision`, { decision });

      expect(res.status).toBe(400);
      expect(await disposalStatus(disposal.disposal_id)).toBe("pending");
    } finally {
      await db.asset_disposals.delete({ where: { disposal_id: disposal.disposal_id } });
    }
  });

  it("answers 400 for an id that is not a number, such as the DISP-n id the list shows", async () => {
    const res = await api.put("/api/asset_disposals/DISP-1/decision", { decision: "approve" });

    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown id", async () => {
    const res = await api.put("/api/asset_disposals/9999/decision", { decision: "approve" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
