/**
 * The session user (step 13c): what a Custodian may see of other people, and the checks that need to know who is asking.
 * Covers GET /api/asset_loans, GET /api/asset_transfers, GET /api/assets, GET /api/assets/:tag/custodian-history
 * (other people's names hidden from a Custodian, D2; the placeholder custodian never named; no id numbers; emails for a
 * Lab Head only), POST
 * /api/assets/:tag/transfer (only the current custodian), and the acting user of a Staff repair ticket and of a
 * return of an asset nobody holds.
 * Fixtures: the seeded accounts and assets; extra assets TEST-0801 onward (see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { ASSETS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { addExtraAsset } from "../setup/extraAssets";

const { db, as } = useApiHarness();
const asCustodianA = as(USERS.custodianA);
const asCustodianB = as(USERS.custodianB);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);

const NOT_THE_HOLDER = "Only the asset's current custodian can request its transfer.";

/** The row with this display id, as the JSON came back (untyped, like res.body). */
const byId = (rows: { id: string }[], id: string): any => rows.find((r) => r.id === id);

describe("GET /api/asset_loans: names for a Custodian (D2)", () => {
  it("leaves another borrower's name out but keeps borrower_id, and keeps the caller's own name", async () => {
    const res = await asCustodianA.get("/api/asset_loans");

    expect(res.status).toBe(200);
    const others = byId(res.body.loans, `LOAN-${SEEDED_ROWS.pendingLoanId}`);
    expect(others).not.toHaveProperty("borrower");
    expect(others.borrower_id).toBe(USERS.custodianB.userId);
    const own = byId(res.body.loans, `LOAN-${SEEDED_ROWS.approvedLoanId}`);
    expect(own).toMatchObject({ borrower_id: USERS.custodianA.userId, borrower: USERS.custodianA.fullName });
  });

  it("sends every borrower's name to a Lab Head, as before", async () => {
    const res = await asLabHead.get("/api/asset_loans");

    expect(byId(res.body.loans, `LOAN-${SEEDED_ROWS.pendingLoanId}`).borrower).toBe(USERS.custodianB.fullName);
    expect(byId(res.body.loans, `LOAN-${SEEDED_ROWS.approvedLoanId}`).borrower).toBe(USERS.custodianA.fullName);
  });
});

describe("GET /api/asset_transfers: names for a Custodian (D2)", () => {
  it("shows a participant all three names and emails, from either side, and hides them from anyone else", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0801", custodianId: USERS.custodianA.userId });
    const fromA = await db.asset_transfers.create({
      data: { asset_id: asset.assetId, from_custodian_id: USERS.custodianA.userId, to_custodian_id: USERS.custodianB.userId, justification: "Test transfer A to B", status: "declined" },
    });
    const notA = await db.asset_transfers.create({
      data: { asset_id: asset.assetId, from_custodian_id: USERS.custodianB.userId, to_custodian_id: USERS.labHead.userId, justification: "Test transfer B to Lab Head", status: "declined" },
    });

    const forA = (await asCustodianA.get("/api/asset_transfers")).body.transfers;
    expect(byId(forA, `TRF-${fromA.transfer_id}`)).toMatchObject({ from: USERS.custodianA.fullName, to: USERS.custodianB.fullName, toEmail: USERS.custodianB.email });
    const hidden = byId(forA, `TRF-${notA.transfer_id}`);
    expect(hidden).not.toHaveProperty("from");
    expect(hidden).not.toHaveProperty("to");
    expect(hidden).not.toHaveProperty("toEmail");
    expect(hidden.fromCustodianId).toBe(USERS.custodianB.userId);

    const forB = (await asCustodianB.get("/api/asset_transfers")).body.transfers;
    expect(byId(forB, `TRF-${fromA.transfer_id}`)).toMatchObject({ from: USERS.custodianA.fullName, to: USERS.custodianB.fullName, toEmail: USERS.custodianB.email });

    const forLabHead = (await asLabHead.get("/api/asset_transfers")).body.transfers;
    expect(byId(forLabHead, `TRF-${notA.transfer_id}`)).toMatchObject({ from: USERS.custodianB.fullName, to: USERS.labHead.fullName, toEmail: USERS.labHead.email });
  });
});

describe("GET /api/assets: names for a Custodian (D2) and the placeholder custodian", () => {
  it("keeps the caller's own asset's custodian, and marks someone else's asset hidden with no name", async () => {
    const othersAsset = await addExtraAsset(db, { tag: "TEST-0811", custodianId: USERS.custodianB.userId });

    const assets = (await asCustodianA.get("/api/assets")).body.assets;

    const own = byId(assets, ASSETS.onLoan.tag);
    expect(own.custodian).toBe(USERS.custodianA.fullName);
    expect(own).not.toHaveProperty("custodianHidden");
    const others = byId(assets, othersAsset.tag);
    expect(others).not.toHaveProperty("custodian");
    expect(others.custodianHidden).toBe(true);
    expect(others.asset_records.map((r: { custodian?: string }) => r.custodian)).toEqual([undefined]);
  });

  it("sends a Custodian their own custodianId, and none for another holder's asset (issue #32)", async () => {
    const othersAsset = await addExtraAsset(db, { tag: "TEST-0861", custodianId: USERS.custodianB.userId });

    const assets = (await asCustodianA.get("/api/assets")).body.assets;

    expect(byId(assets, ASSETS.onLoan.tag).custodianId).toBe(USERS.custodianA.userId);
    expect(byId(assets, othersAsset.tag)).not.toHaveProperty("custodianId");
  });

  it("names no one for an asset the placeholder holds, for a Custodian and for Staff, with no hidden mark", async () => {
    for (const client of [asCustodianA, asStaff]) {
      const available = byId((await client.get("/api/assets")).body.assets, ASSETS.available.tag);
      expect(available).not.toHaveProperty("custodian");
      expect(available).not.toHaveProperty("custodianHidden");
    }
  });

  it("leaves other people out of a Custodian's reports, transfers, and disposal details", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0812", custodianId: USERS.custodianA.userId });
    const transfer = await db.asset_transfers.create({
      data: { asset_id: ASSETS.inspected.assetId, from_custodian_id: USERS.custodianB.userId, to_custodian_id: USERS.labHead.userId, justification: "Test old transfer", status: "declined" },
    });
    await db.asset_reports.create({ data: { asset_id: asset.assetId, reported_by_id: USERS.custodianA.userId, report_condition: "PERFECT", report_remarks: "Test own report" } });

    const assets = (await asCustodianA.get("/api/assets")).body.assets;

    const inspected = byId(assets, ASSETS.inspected.tag);
    expect(inspected.asset_reports.map((r: { reportedBy?: string }) => r.reportedBy)).toEqual([undefined]);
    const nested = inspected.asset_transfers.find((t: { transfer_id: number }) => t.transfer_id === transfer.transfer_id);
    expect(nested).not.toHaveProperty("from");
    expect(nested).not.toHaveProperty("to");
    expect(byId(assets, asset.tag).asset_reports.map((r: { reportedBy?: string }) => r.reportedBy)).toEqual([USERS.custodianA.fullName]);
    const disposed = byId(assets, ASSETS.disposed.tag);
    expect(disposed.disposalDetails).not.toHaveProperty("decommissionedBy");
    expect(disposed.disposalDetails.lastCustodian).toBe("No Custodian");

    const forStaff = byId((await asStaff.get("/api/assets")).body.assets, ASSETS.inspected.tag);
    expect(forStaff.asset_reports.map((r: { reportedBy?: string }) => r.reportedBy)).toEqual([USERS.staffTsg.fullName]);
  });
});

describe("GET /api/assets/:tag/custodian-history: no id numbers, and names for a Custodian (answer 6)", () => {
  it("gives a Custodian the name of their own entries, hides other holders, and names the placeholder for no one", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0821", custodianId: USERS.custodianB.userId });
    await db.asset_records.create({
      data: { asset_id: asset.assetId, status: "ON_LOAN", asset_condition: "PERFECT", location: "Manila", current_custodian: USERS.custodianA.userId, date_logged: new Date("2026-05-01T09:00:00Z") },
    });

    const res = await asCustodianA.get(`/api/assets/${asset.tag}/custodian-history`);

    expect(res.status).toBe(200);
    const [other, own] = res.body.custodianHistory;
    expect(other).not.toHaveProperty("custodianName");
    expect(other).not.toHaveProperty("custodianEmail");
    expect(other.custodianHidden).toBe(true);
    expect(own).toMatchObject({ custodianName: USERS.custodianA.fullName });
    expect(own).not.toHaveProperty("custodianEmail");
    expect(own).not.toHaveProperty("custodianHidden");

    const placeholder = (await asCustodianA.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`)).body.custodianHistory[0];
    expect(placeholder).not.toHaveProperty("custodianName");
    expect(placeholder).not.toHaveProperty("custodianHidden");
  });

  it("sends a Lab Head every holder's name and email, and no id number", async () => {
    const res = await asLabHead.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);

    expect(res.body.custodianHistory[1]).toMatchObject({ custodianName: USERS.custodianA.fullName, custodianEmail: USERS.custodianA.email });
    for (const entry of res.body.custodianHistory) expect(entry).not.toHaveProperty("custodianId");
  });

  it("sends no email to Staff or the Director, only the names (01C 4.2)", async () => {
    for (const asViewer of [asStaff, as(USERS.director)]) {
      const res = await asViewer.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);

      expect(res.status).toBe(200);
      expect(res.body.custodianHistory[1]).toMatchObject({ custodianName: USERS.custodianA.fullName });
      for (const entry of res.body.custodianHistory) expect(entry).not.toHaveProperty("custodianEmail");
    }
  });
});

describe("POST /api/assets/:tag/transfer: only the current custodian (answer 3)", () => {
  it("answers 403 to a Custodian who does not hold the asset, and writes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0831", custodianId: USERS.custodianB.userId });
    const before = await db.asset_transfers.count();

    const res = await asCustodianA.post(`/api/assets/${asset.tag}/transfer`, { toEmail: USERS.labHead.email, reason: "Test not mine" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: NOT_THE_HOLDER });
    expect(await db.asset_transfers.count()).toBe(before);
  });

  it("refuses an asset the placeholder holds (nobody holds it) the same way", async () => {
    const res = await asCustodianA.post(`/api/assets/${ASSETS.available.tag}/transfer`, { toEmail: USERS.custodianB.email, reason: "Test pool asset" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NOT_THE_HOLDER);
  });

  it("files the transfer from the holder, the session user", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0832", custodianId: USERS.custodianB.userId });

    const res = await asCustodianB.post(`/api/assets/${asset.tag}/transfer`, { toEmail: USERS.custodianA.email, reason: "Test mine" });

    expect(res.status).toBe(200);
    expect(res.body.transfer).toMatchObject({ from_custodian_id: USERS.custodianB.userId, to_custodian_id: USERS.custodianA.userId });
  });
});

describe("Who acted, where the body used to say", () => {
  it("files a ticket Staff open under the Staff member, not the asset's custodian (answer 7)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0841", custodianId: USERS.custodianA.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/repair`, { reportedBy: USERS.custodianA.fullName, description: "Test fault from Staff" });

    expect(res.status).toBe(200);
    expect(res.body.repair.reported_by_id).toBe(USERS.staffTsg.userId);
  });

  it("records the Staff member as returner of an asset on loan under the placeholder, since nobody holds it", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0851", status: "ON_LOAN", custodianId: USERS.admin.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/return`, { condition: "OPERATIONAL" });

    expect(res.status).toBe(200);
    expect(res.body.return.returned_by_id).toBe(USERS.staffTsg.userId);
  });
});
