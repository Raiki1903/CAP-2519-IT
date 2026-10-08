/**
 * Transfers API: the transfer request, the transfer list, the recipient's decision, and the unused accept step.
 * Covers POST /api/assets/:tag/transfer, GET /api/asset_transfers, PUT /api/asset_transfers/:id/decision,
 * PUT /api/asset_transfers/:id/accept.
 * Workflow: custodianship transfer (the holder names a recipient by email, the recipient approves or declines,
 * custody moves on approval).
 * Fixtures: the seeded assets in each state (the seed has no transfers), LOAN-2 pending on TEST-0005, the accounts
 * (USERS). The list tests run first and remove the rows they add. The write tests use their own extra assets
 * (TEST-0301 onward, see extraAssets.ts) and change no seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

const EFFECTIVE_DATE = "2026-11-02";

/** What TransferForm sends: the recipient's email, the reason, the destination lab, and the effective date. */
const transferBody = (to: TestUser, extra: Record<string, unknown> = {}) => ({
  toEmail: to.email,
  reason: "Test transfer reason",
  lab: "CeLT",
  effectiveDate: EFFECTIVE_DATE,
  ...extra,
});

const recordCount = (assetId: number) => db.asset_records.count({ where: { asset_id: assetId } });

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

const transferStatus = async (transferId: number) => (await db.asset_transfers.findUniqueOrThrow({ where: { transfer_id: transferId } })).status;

/** Files a transfer request through the API and answers the new transfer's id. */
async function requestTransfer(tag: string, to: TestUser, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await api.post(`/api/assets/${tag}/transfer`, transferBody(to, extra));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.transfer.transfer_id;
}

async function listedAsset(tag: string) {
  const res = await api.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_transfers", () => {
  it("answers an empty list when there are no transfers", async () => {
    const res = await api.get("/api/asset_transfers");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, transfers: [] });
  });

  describe("with one transfer in each status", () => {
    const seededTransfer = (status: string, requestedOn: string, justification = `Test transfer ${status}`) =>
      db.asset_transfers.create({
        data: {
          asset_id: ASSETS.inspected.assetId,
          from_custodian_id: USERS.custodianA.userId,
          to_custodian_id: USERS.custodianB.userId,
          justification,
          status,
          requested_on: new Date(requestedOn),
        },
      });

    async function withTransfers(check: (ids: Record<string, number>) => Promise<void>) {
      const rows = [
        await seededTransfer("pending", "2026-06-04T09:00:00Z", "Destination Lab: CeLT\n\nTest transfer pending"),
        await seededTransfer("pending_approver", "2026-06-03T09:00:00Z"),
        await seededTransfer("declined", "2026-06-02T09:00:00Z"),
        await seededTransfer("approved", "2026-06-01T09:00:00Z"),
      ];
      try {
        await check(Object.fromEntries(rows.map((r) => [r.status, r.transfer_id])));
      } finally {
        await db.asset_transfers.deleteMany({ where: { transfer_id: { in: rows.map((r) => r.transfer_id) } } });
      }
    }

    it("lists them newest first with the fields the screens read, the destination lab moved out of the justification", async () => {
      await withTransfers(async (ids) => {
        const res = await api.get("/api/asset_transfers");

        expect(res.status).toBe(200);
        expect(res.body.transfers.map((t: { id: string }) => t.id)).toEqual(
          ["pending", "pending_approver", "declined", "approved"].map((s) => `TRF-${ids[s]}`),
        );
        expect(res.body.transfers[0]).toMatchObject({
          transferId: ids.pending,
          assetId: ASSETS.inspected.tag,
          asset: ASSETS.inspected.name,
          from: USERS.custodianA.fullName,
          fromCustodianId: USERS.custodianA.userId,
          to: USERS.custodianB.fullName,
          justification: "Test transfer pending",
          destinationLab: "CeLT",
          status: "Pending",
          location: "Manila",
          lab: LAB.shortCode,
        });
        expect(typeof res.body.transfers[0].requestedOn).toBe("string");
        expect(res.body.transfers[2]).toMatchObject({ status: "Declined", justification: "Test transfer declined" });
        expect(res.body.transfers[2].destinationLab).toBeUndefined();
        expect(res.body.transfers[3].status).toBe("Approved");
      });
    });

    it("includes the recipient's email, for any caller (known issue, 01C 4.3)", async () => {
      await withTransfers(async () => {
        const res = await api.get("/api/asset_transfers");

        expect(res.body.transfers[0].toEmail).toBe(USERS.custodianB.email);
      });
    });

    it("shows a transfer stuck in pending_approver as Pending (M-12)", async () => {
      await withTransfers(async (ids) => {
        const res = await api.get("/api/asset_transfers");

        const stuck = res.body.transfers.find((t: { transferId: number }) => t.transferId === ids.pending_approver);
        expect(stuck.status).toBe("Pending");
      });
    });
  });
});

describe("POST /api/assets/:tag/transfer", () => {
  it("files a pending transfer from the asset's current custodian to the recipient found by email, and leaves custody alone", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0301", custodianId: USERS.custodianA.userId });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.post(`/api/assets/${asset.tag}/transfer`, transferBody(USERS.custodianB));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transfer).toMatchObject({
      asset_id: asset.assetId,
      from_custodian_id: USERS.custodianA.userId,
      to_custodian_id: USERS.custodianB.userId,
      status: "pending",
    });
    expect(await db.asset_transfers.count({ where: { asset_id: asset.assetId, status: "pending" } })).toBe(1);
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "Active", custodian: USERS.custodianA.fullName });
  });

  it("packs the destination lab into the justification and stores the effective date nowhere (known defect H-19)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0302" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);

    const row = await db.asset_transfers.findUniqueOrThrow({ where: { transfer_id: transferId } });
    expect(row.justification).toBe("Destination Lab: CeLT\n\nTest transfer reason");
    expect(JSON.stringify(row)).not.toContain(EFFECTIVE_DATE);
  });

  it("stores the reason as typed when no lab is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0303" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB, { lab: undefined });

    expect((await db.asset_transfers.findUniqueOrThrow({ where: { transfer_id: transferId } })).justification).toBe("Test transfer reason");
  });

  it.each(["toEmail", "reason"])("answers 400 without %s, and writes nothing", async (field) => {
    const before = await db.asset_transfers.count();

    const res = await api.post(`/api/assets/${ASSETS.available.tag}/transfer`, transferBody(USERS.custodianB, { [field]: undefined }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_transfers.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.post("/api/assets/TEST-9999/transfer", transferBody(USERS.custodianB));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("answers 404 for an email that matches no account, and writes nothing", async () => {
    const before = await db.asset_transfers.count();

    const res = await api.post(`/api/assets/${ASSETS.available.tag}/transfer`, transferBody(USERS.custodianB, { toEmail: "nobody@example.test" }));

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("nobody@example.test");
    expect(await db.asset_transfers.count()).toBe(before);
  });
});

describe("POST /api/assets/:tag/transfer: one pending request per asset (issue #25)", () => {
  it("rejects a second transfer request on the same asset with 409 (issue #25)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0311", custodianId: USERS.custodianA.userId });

    const first = await api.post(`/api/assets/${asset.tag}/transfer`, transferBody(USERS.custodianB));
    expect(first.status).toBe(200);

    const second = await api.post(`/api/assets/${asset.tag}/transfer`, transferBody(USERS.labHead));
    expect(second.status).toBe(409);
    expect(second.body.error).toContain(`TRF-${first.body.transfer.transfer_id}`);

    expect(await db.asset_transfers.count({ where: { asset_id: asset.assetId, status: "pending" } })).toBe(1);
  });

  it("accepts an asset that is on loan, as a transfer from its borrower", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0312", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await api.post(`/api/assets/${asset.tag}/transfer`, transferBody(USERS.custodianB));

    expect(res.status).toBe(200);
    expect(res.body.transfer.from_custodian_id).toBe(USERS.custodianA.userId);
  });

  it("answers 409 for the seeded asset whose loan request is still pending", async () => {
    const res = await api.post(`/api/assets/${ASSETS.pendingLoan.tag}/transfer`, transferBody(USERS.custodianB));

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(`LOAN-${SEEDED_ROWS.pendingLoanId}`);
  });

  it.each([ASSETS.inRepair, ASSETS.disposed])("answers 409 for $tag, which is $listStatus, and writes nothing", async (asset) => {
    const res = await api.post(`/api/assets/${asset.tag}/transfer`, transferBody(USERS.custodianB));

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(await db.asset_transfers.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });
});

describe("PUT /api/asset_transfers/:id/decision", () => {
  it("approve: marks the transfer approved and adds an ON_LOAN record under the recipient at the destination lab, keeping the home lab and condition", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0321", custodianId: USERS.custodianA.userId, condition: "DEGRADED" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, transfer: { transfer_id: transferId, status: "approved" } });
    expect(await transferStatus(transferId)).toBe("approved");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore + 1);
    expect(await newestRecord(asset.assetId)).toMatchObject({
      status: "ON_LOAN",
      current_custodian: USERS.custodianB.userId,
      location: LAB.homeLocation,
      current_location: `Laguna${LOCATION_SEPARATOR}CeLT`,
      asset_condition: "DEGRADED",
    });
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "On Loan", custodian: USERS.custodianB.fullName });
  });

  it("approve: keeps the asset's current location when the request named no lab", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0322", currentLocation: `Manila${LOCATION_SEPARATOR}Test Elsewhere` });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB, { lab: undefined });

    await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "approve" });

    expect((await newestRecord(asset.assetId)).current_location).toBe(`Manila${LOCATION_SEPARATOR}Test Elsewhere`);
  });

  it("decline: marks the transfer declined and leaves custody alone", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0323", custodianId: USERS.custodianA.userId });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "decline" });

    expect(res.status).toBe(200);
    expect(res.body.transfer.status).toBe("declined");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "Active", custodian: USERS.custodianA.fullName });
  });

  it("answers 400 on a transfer that is already decided, and changes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0324" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);
    await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "approve" });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "decline" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been approved/);
    expect(await transferStatus(transferId)).toBe("approved");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
  });

  it.each([
    { decision: "reject", why: "the word disposals use" },
    { decision: "accept", why: "the name of the other route" },
    { decision: undefined, why: "no decision" },
  ])("answers 400 for $decision, $why, and leaves the transfer pending", async ({ decision }) => {
    const transfer = await db.asset_transfers.create({
      data: { asset_id: ASSETS.inspected.assetId, from_custodian_id: USERS.custodianA.userId, to_custodian_id: USERS.custodianB.userId, justification: "Test word check", status: "pending" },
    });
    try {
      const res = await api.put(`/api/asset_transfers/${transfer.transfer_id}/decision`, { decision });

      expect(res.status).toBe(400);
      expect(await transferStatus(transfer.transfer_id)).toBe("pending");
    } finally {
      await db.asset_transfers.delete({ where: { transfer_id: transfer.transfer_id } });
    }
  });

  it("answers 400 for an id that is not a number, such as the TRF-n id the list shows", async () => {
    const res = await api.put("/api/asset_transfers/TRF-1/decision", { decision: "approve" });

    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown id", async () => {
    const res = await api.put("/api/asset_transfers/9999/decision", { decision: "approve" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/asset_transfers/:id/accept", () => {
  it("sets the transfer to pending_approver and appends the remarks to the justification", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0331" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);

    const res = await api.put(`/api/asset_transfers/${transferId}/accept`, { remarks: "Test destination remark" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      transfer: { status: "pending_approver", justification: "Destination Lab: CeLT\n\nTest transfer reason\n[Destination Remarks]: Test destination remark" },
    });
    expect(await transferStatus(transferId)).toBe("pending_approver");
  });

  it("leaves the justification as it is when no remarks are sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0332" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB, { lab: undefined });

    const res = await api.put(`/api/asset_transfers/${transferId}/accept`, {});

    expect(res.status).toBe(200);
    expect(res.body.transfer.justification).toBe("Test transfer reason");
  });

  it("leaves the transfer stuck: afterwards the decision answers 400 (known defect M-12)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0333" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);
    await api.put(`/api/asset_transfers/${transferId}/accept`, {});

    const res = await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "approve" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been pending_approver/);
    expect(await transferStatus(transferId)).toBe("pending_approver");
  });

  it("lets the asset take a second transfer request once the first is pending_approver, because the issue #25 guard counts only 'pending' (new finding, M-12 family)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0334" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);
    await api.put(`/api/asset_transfers/${transferId}/accept`, {});

    const res = await api.post(`/api/assets/${asset.tag}/transfer`, transferBody(USERS.labHead));

    expect(res.status).toBe(200);
    expect(await db.asset_transfers.count({ where: { asset_id: asset.assetId, status: { in: ["pending", "pending_approver"] } } })).toBe(2);
  });

  it("changes a transfer in any status, even an approved one, back to pending_approver (new finding, M-12 family)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0335" });
    const transferId = await requestTransfer(asset.tag, USERS.custodianB);
    await api.put(`/api/asset_transfers/${transferId}/decision`, { decision: "approve" });

    const res = await api.put(`/api/asset_transfers/${transferId}/accept`, {});

    expect(res.status).toBe(200);
    expect(await transferStatus(transferId)).toBe("pending_approver");
    expect((await newestRecord(asset.assetId)).status).toBe("ON_LOAN");
  });

  it("answers 404 for an unknown id", async () => {
    const res = await api.put("/api/asset_transfers/9999/accept", {});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("answers 500 with the raw Prisma error for an id that is not a number (known defect H-16)", async () => {
    const res = await api.put("/api/asset_transfers/TRF-1/accept", {});

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/prisma\.asset_transfers\.findUnique/);
  });
});
