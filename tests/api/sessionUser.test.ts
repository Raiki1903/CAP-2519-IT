/**
 * The session user (step 13c): what a Custodian may see of other people, and the checks that need to know who is asking.
 * Covers GET /api/loans, GET /api/assets, GET /api/assets/:tag/history (other people's names hidden from a Custodian,
 * D2; nobody named for an asset nobody holds; no id numbers or emails), and the acting user of a Staff repair ticket and of a
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

/** The row with this display id, as the JSON came back (untyped, like res.body). */
const byId = (rows: { id: string }[], id: string): any => rows.find((r) => r.id === id);

describe("GET /api/loans: names for a Custodian (D2)", () => {
  it("leaves another borrower's name out but keeps borrower_id, and keeps the caller's own name", async () => {
    const res = await asCustodianA.get("/api/loans");

    expect(res.status).toBe(200);
    const others = byId(res.body.loans, `LOAN-${SEEDED_ROWS.pendingLoanId}`);
    expect(others).not.toHaveProperty("borrower");
    expect(others.borrower_id).toBe(USERS.custodianB.userId);
    const own = byId(res.body.loans, `LOAN-${SEEDED_ROWS.approvedLoanId}`);
    expect(own).toMatchObject({ borrower_id: USERS.custodianA.userId, borrower: USERS.custodianA.fullName });
  });

  it("sends every borrower's name to a Lab Head, as before", async () => {
    const res = await asLabHead.get("/api/loans");

    expect(byId(res.body.loans, `LOAN-${SEEDED_ROWS.pendingLoanId}`).borrower).toBe(USERS.custodianB.fullName);
    expect(byId(res.body.loans, `LOAN-${SEEDED_ROWS.approvedLoanId}`).borrower).toBe(USERS.custodianA.fullName);
  });
});

describe("GET /api/assets: names for a Custodian (D2) and the placeholder custodian", () => {
  it("keeps the caller's own asset's holder, and marks someone else's asset hidden with no name", async () => {
    const othersAsset = await addExtraAsset(db, { tag: "TEST-0811", status: "ON_LOAN", custodianId: USERS.custodianB.userId });

    const assets = (await asCustodianA.get("/api/assets")).body.assets;

    const own = byId(assets, ASSETS.onLoan.tag);
    expect(own.custodian).toBe(USERS.custodianA.fullName);
    expect(own.holder).toEqual({ userId: USERS.custodianA.userId, name: USERS.custodianA.fullName });
    expect(own).not.toHaveProperty("custodianHidden");
    const others = byId(assets, othersAsset.tag);
    expect(others).not.toHaveProperty("custodian");
    expect(others.custodianHidden).toBe(true);
    expect(others.holder).toEqual({ hidden: true });
    expect(JSON.stringify(others)).not.toContain(USERS.custodianB.lastName);
  });

  it("sends a Custodian their own custodianId, and none for another holder's asset (issue #32)", async () => {
    const othersAsset = await addExtraAsset(db, { tag: "TEST-0861", status: "ON_LOAN", custodianId: USERS.custodianB.userId });

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

  it("leaves other people out of a Custodian's reports and disposal details", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0812" });
    await db.asset_inspections.create({ data: { asset_id: asset.assetId, inspected_by_id: USERS.custodianA.userId, type: "SELF_REPORT", condition: "PERFECT", remarks: "Test own report" } });

    const assets = (await asCustodianA.get("/api/assets")).body.assets;

    const inspected = byId(assets, ASSETS.inspected.tag);
    expect(inspected.asset_reports.map((r: { reportedBy?: string }) => r.reportedBy)).toEqual([undefined]);
    expect(byId(assets, asset.tag).asset_reports.map((r: { reportedBy?: string }) => r.reportedBy)).toEqual([USERS.custodianA.fullName]);
    const disposed = byId(assets, ASSETS.disposed.tag);
    expect(disposed.disposalDetails).not.toHaveProperty("decommissionedBy");
    expect(disposed.disposalDetails).not.toHaveProperty("lastCustodian");

    const forStaff = byId((await asStaff.get("/api/assets")).body.assets, ASSETS.inspected.tag);
    expect(forStaff.asset_reports.map((r: { reportedBy?: string }) => r.reportedBy)).toEqual([USERS.staffTsg.fullName]);
  });
});

describe("GET /api/assets/:tag/history: no id numbers or emails, and names for a Custodian (answer 6)", () => {
  it("gives a Custodian their own name and hides everyone else", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0821", status: "ON_LOAN", custodianId: USERS.custodianB.userId });
    await db.asset_inspections.create({ data: { asset_id: asset.assetId, inspected_by_id: USERS.custodianA.userId, type: "SELF_REPORT", condition: "PERFECT", remarks: "Test own report" } });

    const res = await asCustodianA.get(`/api/assets/${asset.tag}/history`);

    expect(res.status).toBe(200);
    const actors = res.body.events.map((e: { kind: string; actor: unknown }) => [e.kind, e.actor]);
    expect(actors).toContainEqual(["LOAN_REQUESTED", { hidden: true }]);
    expect(actors).toContainEqual(["INSPECTION", { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName }]);
    expect(JSON.stringify(res.body)).not.toContain(USERS.custodianB.lastName);
  });

  it("sends every role the names only: no email and no id number", async () => {
    for (const asViewer of [asStaff, asLabHead, as(USERS.director)]) {
      const res = await asViewer.get(`/api/assets/${ASSETS.onLoan.tag}/history`);

      expect(res.status).toBe(200);
      expect(res.body.events[0].actor).toEqual({ userId: USERS.custodianA.userId, name: USERS.custodianA.fullName });
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(USERS.custodianA.email);
      expect(text).not.toContain(String(USERS.custodianA.idNumber));
    }
  });
});

describe("Who acted, where the body used to say", () => {
  it("files a ticket Staff open under the Staff member, not the asset's custodian (answer 7)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0841", custodianId: USERS.custodianA.userId });

    const res = await asStaff.post(`/api/assets/${asset.tag}/maintenance`, { reportedBy: USERS.custodianA.fullName, issueTypeId: 1, issueDescription: "Test fault from Staff" });

    expect(res.status).toBe(201);
    expect(res.body.maintenance.reportedBy.userId).toBe(USERS.staffTsg.userId);
  });

  it("records the Staff member who receives a return as the one who received it, and keeps the borrower", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0851", status: "ON_LOAN", custodianId: USERS.custodianB.userId });

    const res = await asStaff.put(`/api/loans/${asset.loanId}/receive`, { inspection: { condition: "OPERATIONAL" }, returnedBy: USERS.custodianA.fullName });

    expect(res.status).toBe(200);
    expect(res.body.loan.borrower.userId).toBe(USERS.custodianB.userId);
    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: asset.loanId! } })).received_by_id).toBe(USERS.staffTsg.userId);
  });
});
