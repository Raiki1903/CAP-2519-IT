/**
 * Disposals API: the disposal request, the disposal list, and the Director's decision.
 * Covers POST /api/assets/:tag/retirement, GET /api/retirements, PUT /api/retirements/:id/decision.
 * Workflow: decommissioning (Staff files a request and the asset goes to Pending Retirement; the AdRIC Director approves
 * it, and the asset is Retired, or rejects it, and the asset gets its status back).
 * Fixtures: the seeded approved disposal DISP-1 by Staff TSG on TEST-0004, the accounts (USERS). The list tests run
 * first and remove the rows they add. The write tests use their own extra assets (TEST-0601 onward, see
 * extraAssets.ts) and change no seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asDirector = as(USERS.director);
const asStaff = as(USERS.staffTsg);

/**
 * What DisposalFormDialog sent before: who files it (not read since 13c), a typed last custodian (not read since issue
 * #12), the reasons, the pathway, and the target date.
 */
const disposalBody = (extra: Record<string, unknown> = {}) => ({
  requestedBy: USERS.staffTsg.fullName,
  lastCustodian: "Test Typed Custodian",
  breakdownReasons: "Test breakdown: the screen is cracked",
  disposalPathway: "Test pathway: recycle",
  decommissionDate: "2026-12-01",
  ...extra,
});

const assetStatus = async (assetId: number) => (await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } })).status;

const disposalStatus = async (disposalId: number) => (await db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: disposalId } })).status;

/** Files a disposal request through the API and answers the new disposal's id. */
async function requestDisposal(tag: string, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await asStaff.post(`/api/assets/${tag}/retirement`, disposalBody(extra));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.disposal.retirement_id;
}

/** Writes a pending disposal straight to the test database, as a row filed before the issue #54 guard would be. */
async function addOldPendingDisposal(assetId: number): Promise<number> {
  const row = await db.asset_retirements.create({
    data: { asset_id: assetId, requested_by_id: USERS.staffTsg.userId, reason: "Test old pending disposal", status: "PENDING", previous_status: "AVAILABLE" },
  });
  return row.retirement_id;
}

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/retirements", () => {
  it("lists the seeded disposal with the fields the Director's queue reads", async () => {
    const res = await asStaff.get("/api/retirements");

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

  it("lists disposals newest first, and shows Approved and Completed as Approved and Denied as Rejected", async () => {
    const statuses = ["PENDING", "DENIED", "APPROVED"] as const;
    const rows = [];
    for (const [index, status] of statuses.entries()) {
      rows.push(
        await db.asset_retirements.create({
          data: {
            asset_id: ASSETS.available.assetId,
            requested_by_id: USERS.staffIts.userId,
            reason: `Test disposal ${status}`,
            status,
            requested_at: new Date(`2026-06-0${index + 1}T09:00:00Z`),
          },
        }),
      );
    }
    try {
      const res = await asStaff.get("/api/retirements");

      expect(res.body.disposals.map((d: { disposalId: number }) => d.disposalId)).toEqual([
        rows[2].retirement_id,
        rows[1].retirement_id,
        rows[0].retirement_id,
        SEEDED_ROWS.disposalId,
      ]);
      expect(res.body.disposals.map((d: { status: string }) => d.status)).toEqual(["Approved", "Rejected", "Pending", "Approved"]);
      expect(res.body.disposals[2]).toMatchObject({ assetId: ASSETS.available.tag, requestedBy: USERS.staffIts.fullName });
    } finally {
      await db.asset_retirements.deleteMany({ where: { retirement_id: { in: rows.map((r) => r.retirement_id) } } });
    }
  });
});

describe("POST /api/assets/:tag/retirement", () => {
  it("files a pending disposal under the session user and puts the asset in Pending Retirement, keeping its status before (issue #32 fixed)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0601" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, disposalBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disposal).toMatchObject({ asset_id: asset.assetId, requested_by_id: USERS.staffTsg.userId, status: "PENDING", previous_status: "AVAILABLE" });
    expect(await db.asset_retirements.count({ where: { asset_id: asset.assetId, status: "PENDING" } })).toBe(1);
    const listed = await listedAsset(asset.tag);
    expect(listed).toMatchObject({ status: "PENDING_RETIREMENT", statusLabel: "Pending Retirement" });
    expect(listed.disposalDetails).toBeUndefined();
  });

  it("packs the pathway, target date, and justification into one reason text (known defect M-13)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0602" });
    const disposalId = await requestDisposal(asset.tag);

    const row = await db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: disposalId } });
    expect(row.reason).toBe(
      "Disposal Pathway: Test pathway: recycle\n" +
        "Target Decommission Date: 2026-12-01\n" +
        "\n" +
        "Breakdown Justification:\n" +
        "Test breakdown: the screen is cracked",
    );
  });

  it("leaves out the last custodian line, whatever the body sends, and the date line when none is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0603" });
    const disposalId = await requestDisposal(asset.tag, { decommissionDate: undefined });

    const row = await db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: disposalId } });
    expect(row.reason).toBe("Disposal Pathway: Test pathway: recycle\n\nBreakdown Justification:\nTest breakdown: the screen is cracked");
  });

  it.each([
    { requestedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0604" },
    { requestedBy: undefined, case: "no name", tag: "TEST-0605" },
  ])("files the disposal under the session user for $case, not under user 1 (H-10 fixed)", async ({ requestedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, disposalBody({ requestedBy }));

    expect(res.status).toBe(200);
    expect(res.body.disposal.requested_by_id).toBe(USERS.staffTsg.userId);
  });

  it.each([
    { assetStatus: "MAINTENANCE" as const, tag: "TEST-0606" },
    { assetStatus: "MISSING" as const, tag: "TEST-0607" },
  ])("accepts an asset that is $assetStatus, and keeps that status to give back on a denial", async ({ assetStatus, tag }) => {
    const asset = await addExtraAsset(db, { tag, assetStatus });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, disposalBody());

    expect(res.status).toBe(200);
    expect(res.body.disposal.previous_status).toBe(assetStatus);
  });

  it.each([
    { status: "ON_LOAN" as const, label: "On Loan", tag: "TEST-0611" },
    { status: "DISPOSED" as const, label: "Retired", tag: "TEST-0613" },
  ])("answers 409 for an asset that is $label, and writes nothing (issue #54)", async ({ status, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, status, custodianId: status === "ON_LOAN" ? USERS.custodianA.userId : undefined });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, disposalBody());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: `${tag} is ${label} and cannot be requested for retirement.` });
    expect(await db.asset_retirements.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("answers 409 to a second disposal request while one is pending, and writes nothing (issue #54)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0614" });

    await requestDisposal(asset.tag);
    const second = await asStaff.post(`/api/assets/${asset.tag}/retirement`, disposalBody());

    expect(second.status).toBe(409);
    expect(second.body.error).toBe("TEST-0614 is Pending Retirement and cannot be requested for retirement.");
    expect(await db.asset_retirements.count({ where: { asset_id: asset.assetId, status: "PENDING" } })).toBe(1);
  });

  it("answers 409 for an asset with a loan waiting for approval, and writes nothing (issue #54)", async () => {
    const before = await db.asset_retirements.count();

    const res = await asStaff.post(`/api/assets/${ASSETS.pendingLoan.tag}/retirement`, disposalBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${ASSETS.pendingLoan.tag} already has a loan in Pending Approval (LOAN-${SEEDED_ROWS.pendingLoanId}).`);
    expect(await db.asset_retirements.count()).toBe(before);
  });

  it.each(["breakdownReasons", "disposalPathway"])("answers 400 without %s, and writes nothing", async (field) => {
    const before = await db.asset_retirements.count();

    const res = await asStaff.post(`/api/assets/${ASSETS.available.tag}/retirement`, disposalBody({ [field]: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_retirements.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.post("/api/assets/TEST-9999/retirement", disposalBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/retirements/:id/decision", () => {
  it("approve: completes the disposal, with who decided and completed it, and retires the asset", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0621", condition: "DEGRADED" });
    const disposalId = await requestDisposal(asset.tag);

    const res = await asDirector.put(`/api/retirements/${disposalId}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, disposal: { retirement_id: disposalId, status: "COMPLETED" } });
    const row = await db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: disposalId } });
    expect(row).toMatchObject({ status: "COMPLETED", decided_by_id: USERS.director.userId, completed_by_id: USERS.director.userId });
    expect(row.decided_at).not.toBeNull();
    expect(await assetStatus(asset.assetId)).toBe("RETIRED");
  });

  it("approve: the asset list then shows it Retired, with details read back out of the reason text (M-13)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0622" });
    const disposalId = await requestDisposal(asset.tag);

    await asDirector.put(`/api/retirements/${disposalId}/decision`, { decision: "approve" });

    const listed = await listedAsset(asset.tag);
    expect(listed).toMatchObject({ status: "RETIRED", currentLocation: null });
    expect(listed.disposalDetails).toMatchObject({
      disposalPathway: "Test pathway: recycle",
      breakdownReasons: "Test breakdown: the screen is cracked",
      lastCustodian: "No Custodian",
      decommissionedBy: USERS.staffTsg.fullName,
    });
  });

  it.each([
    { status: "ON_LOAN" as const, label: "On Loan", tag: "TEST-0623" },
    { status: "MAINTENANCE" as const, label: "Maintenance", tag: "TEST-0626" },
  ])("approve: answers 409 for an old pending disposal on an asset that is $label, and writes nothing (issue #28)", async ({ status, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, status, custodianId: USERS.custodianB.userId });
    const disposalId = await addOldPendingDisposal(asset.assetId);
    const before = await assetStatus(asset.assetId);

    const res = await asDirector.put(`/api/retirements/${disposalId}/decision`, { decision: "approve" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: `${tag} is ${label} and cannot have its retirement decided.` });
    expect(await disposalStatus(disposalId)).toBe("PENDING");
    expect(await assetStatus(asset.assetId)).toBe(before);
  });

  it("approving the second of two old pending disposals answers 409: the asset is retired once (issue #28)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0624", assetStatus: "PENDING_RETIREMENT" });
    const first = await addOldPendingDisposal(asset.assetId);
    const second = await addOldPendingDisposal(asset.assetId);

    const answers = [
      await asDirector.put(`/api/retirements/${first}/decision`, { decision: "approve" }),
      await asDirector.put(`/api/retirements/${second}/decision`, { decision: "approve" }),
    ];

    expect(answers.map((a) => a.status)).toEqual([200, 409]);
    expect(answers[1].body.error).toBe("TEST-0624 is Retired and cannot have its retirement decided.");
    expect(await disposalStatus(second)).toBe("PENDING");
  });

  it("reject: still works on an asset that is no longer Pending Retirement, and leaves its status (issue #28)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0628", status: "DISPOSED" });
    const disposalId = await addOldPendingDisposal(asset.assetId);

    const res = await asDirector.put(`/api/retirements/${disposalId}/decision`, { decision: "reject" });

    expect(res.status).toBe(200);
    expect(await disposalStatus(disposalId)).toBe("DENIED");
    expect(await assetStatus(asset.assetId)).toBe("RETIRED");
  });

  it("reject: denies the disposal, with who decided, and gives the asset back its status from before", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0625", assetStatus: "MAINTENANCE" });
    const disposalId = await requestDisposal(asset.tag);

    const res = await asDirector.put(`/api/retirements/${disposalId}/decision`, { decision: "reject" });

    expect(res.status).toBe(200);
    expect(res.body.disposal.status).toBe("DENIED");
    expect((await db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: disposalId } })).decided_by_id).toBe(USERS.director.userId);
    expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
  });

  it("answers 400 on a disposal that is already decided, and changes nothing", async () => {

    const res = await asDirector.put(`/api/retirements/${SEEDED_ROWS.disposalId}/decision`, { decision: "reject" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/is Completed, so it can no longer be decided/);
    expect(await disposalStatus(SEEDED_ROWS.disposalId)).toBe("COMPLETED");
    expect(await assetStatus(ASSETS.disposed.assetId)).toBe("RETIRED");
  });

  it.each([
    { decision: "decline", why: "the word loans and transfers use" },
    { decision: "approved", why: "the stored status" },
    { decision: undefined, why: "no decision" },
  ])("answers 400 for $decision, $why, and leaves the disposal pending", async ({ decision }) => {
    const disposal = await db.asset_retirements.create({
      data: { asset_id: ASSETS.available.assetId, requested_by_id: USERS.staffTsg.userId, reason: "Test word check", status: "PENDING" },
    });
    try {
      const res = await asDirector.put(`/api/retirements/${disposal.retirement_id}/decision`, { decision });

      expect(res.status).toBe(400);
      expect(await disposalStatus(disposal.retirement_id)).toBe("PENDING");
    } finally {
      await db.asset_retirements.delete({ where: { retirement_id: disposal.retirement_id } });
    }
  });

  it("answers 400 for an id that is not a number, such as the DISP-n id the list shows", async () => {
    const res = await asDirector.put("/api/retirements/DISP-1/decision", { decision: "approve" });

    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown id", async () => {
    const res = await asDirector.put("/api/retirements/9999/decision", { decision: "approve" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
