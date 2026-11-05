/**
 * Maintenance API: reporting an issue, TSG's receipt, start, stage change and completion, cancelling, and the ticket list.
 * Covers POST /api/assets/:tag/maintenance, GET /api/maintenance, PUT /api/maintenance/:id/receive, /start, /stage,
 * /complete and /cancel, and that the old PUT /api/maintenance/:id and /:id/status are gone.
 * Workflow: maintenance (the holder, the home lab's Head, or TSG reports an issue with an issue type; the asset stays
 * where it is until TSG receives it with a Maintenance inspection, which ends a held loan; TSG repairs it or sends it to
 * External Service, an asset under warranty only with a reason; TSG completes it Resolved or Beyond Repair; the reporter
 * or TSG cancels).
 * Fixtures: the seeded ticket MNT-1 (Inspecting, reported by Custodian A, received by Staff TSG) on TEST-0003, in
 * Maintenance, under warranty until 2027-06-01; the issue types in LOOKUPS; LAB, headed by the Lab Head. The list tests
 * run first. Every write test uses its own extra asset (TEST-0401 onward, see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOOKUPS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);
const asStaff = as(USERS.staffTsg);

const ISSUE_TYPE = LOOKUPS.issueTypes[0];
const NOT_THE_HOLDER = "Only the person who holds this asset can report an issue on it.";

/** A report body with the first seeded issue type. */
const reportBody = (issueDescription: string, extra: Record<string, unknown> = {}) => ({ issueTypeId: ISSUE_TYPE.issueTypeId, issueDescription, ...extra });

/** A receive body with a Maintenance inspection. */
const receiveBody = (extra: Record<string, unknown> = {}) => ({ inspection: { condition: "DEGRADED", remarks: "Test: screen flickers", ...extra } });

const ticketRow = (maintenanceId: number) => db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: maintenanceId } });
const assetStatus = async (assetId: number) => (await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } })).status;
const loanRow = (loanId: number) => db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } });

/** An asset On Loan to Custodian A, with a Pending Receipt ticket Custodian A reported. */
async function reportedOnLoan(tag: string) {
  const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId });
  const res = await asCustodian.post(`/api/assets/${tag}/maintenance`, reportBody(`Test fault on ${tag}`));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { asset, maintenanceId: res.body.maintenance.maintenanceId as number };
}

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { tag: string }) => a.tag === tag);
}

describe("GET /api/maintenance", () => {
  it("lists the seeded ticket in the Maintenance shape and in the row shape today's screens read", async () => {
    const res = await asStaff.get("/api/maintenance");

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0]).toMatchObject({
      maintenanceId: SEEDED_ROWS.repairId,
      asset: { assetId: ASSETS.inRepair.assetId, tag: ASSETS.inRepair.tag, name: ASSETS.inRepair.name, warrantyExpiry: "2027-06-01" },
      type: "BORROWER_REPORT",
      typeLabel: "Borrower Report",
      status: "INSPECTING",
      statusLabel: "Inspecting",
      issueType: null,
      issueDescription: "Test repair: the lens does not focus",
      reportedBy: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
      receivedBy: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName },
      underWarranty: true,
      completedBy: null,
      triggerInspection: null,
    });
    expect(res.body.repairs[0]).toMatchObject({
      id: "MNT-1",
      repairId: SEEDED_ROWS.repairId,
      assetId: ASSETS.inRepair.tag,
      reportedBy: USERS.custodianA.fullName,
      progressStatus: "Inspecting",
      statusLabel: "Inspecting",
      acknowledged: true,
    });
  });

  it("shows each role only its tickets: all for TSG, the Director and the Secretary, the lab's for its Head, the reporter's own for a Researcher", async () => {
    for (const user of [USERS.staffTsg, USERS.director, USERS.secretary, USERS.labHead, USERS.custodianA]) {
      const res = await as(user).get("/api/maintenance");
      expect(res.status, user.fullName).toBe(200);
      expect(res.body.tickets.map((t: { maintenanceId: number }) => t.maintenanceId), user.fullName).toEqual([SEEDED_ROWS.repairId]);
    }
    const other = await as(USERS.custodianB).get("/api/maintenance");
    expect(other.body.tickets).toEqual([]);
    expect(other.body.repairs).toEqual([]);
  });

  it("answers 403 to the IT Admin", async () => {
    const res = await as(USERS.admin).get("/api/maintenance");

    expect(res.status).toBe(403);
  });

  it("hides the TSG member's name from the Researcher who reported it", async () => {
    const res = await asCustodian.get("/api/maintenance");

    expect(res.body.tickets[0].reportedBy).toEqual({ userId: USERS.custodianA.userId, name: USERS.custodianA.fullName });
    expect(res.body.tickets[0].receivedBy).toEqual({ hidden: true });
  });

  it("filters by ?status= and ?type=, and answers 400 for an unknown value", async () => {
    expect((await asStaff.get("/api/maintenance?status=INSPECTING,REPAIRING")).body.tickets).toHaveLength(1);
    expect((await asStaff.get("/api/maintenance?status=PENDING_RECEIPT")).body.tickets).toHaveLength(0);
    expect((await asStaff.get("/api/maintenance?type=TSG_MAINTENANCE")).body.tickets).toHaveLength(0);

    const status = await asStaff.get("/api/maintenance?status=FIXED");
    expect(status.status).toBe(400);
    expect(status.body.error).toBe("Unknown maintenance status: FIXED.");
    expect((await asStaff.get("/api/maintenance?type=URGENT")).status).toBe(400);
  });
});

describe("POST /api/assets/:tag/maintenance: report an issue", () => {
  it("lets the holder report: a Borrower Report in Pending Receipt with the issue type; the asset and the loan do not change", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0401", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test: battery drains in an hour"));

    expect(res.status).toBe(201);
    expect(res.body.maintenance).toMatchObject({
      asset: { tag: asset.tag },
      type: "BORROWER_REPORT",
      status: "PENDING_RECEIPT",
      statusLabel: "Pending Receipt",
      issueType: { issueTypeId: ISSUE_TYPE.issueTypeId, key: ISSUE_TYPE.key, name: ISSUE_TYPE.name, suggestedAction: ISSUE_TYPE.suggestedAction },
      issueDescription: "Test: battery drains in an hour",
      reportedBy: { userId: USERS.custodianA.userId },
      receivedBy: null,
      underWarranty: false,
    });
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
    expect((await loanRow(asset.loanId!)).status).toBe("ON_LOAN");
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: { userId: USERS.custodianA.userId } });
  });

  it("lets the Head of the asset's home lab report a Borrower Report, and TSG a TSG Maintenance ticket", async () => {
    const byHead = await addExtraAsset(db, { tag: "TEST-0402" });
    const byTsg = await addExtraAsset(db, { tag: "TEST-0403" });

    const head = await as(USERS.labHead).post(`/api/assets/${byHead.tag}/maintenance`, reportBody("Test: fan noise"));
    const tsg = await asStaff.post(`/api/assets/${byTsg.tag}/maintenance`, reportBody("Test: yearly cleaning"));

    expect(head.status).toBe(201);
    expect(head.body.maintenance).toMatchObject({ type: "BORROWER_REPORT", reportedBy: { userId: USERS.labHead.userId } });
    expect(tsg.status).toBe(201);
    expect(tsg.body.maintenance).toMatchObject({ type: "TSG_MAINTENANCE", typeLabel: "TSG Maintenance", reportedBy: { userId: USERS.staffTsg.userId } });
    expect(await assetStatus(byTsg.assetId)).toBe("AVAILABLE");
  });

  it("files the ticket under the session user, whatever reporter the body names (issue #32)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0404" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test fault", { reportedBy: USERS.labHead.fullName, reportedById: USERS.labHead.userId }));

    expect(res.body.maintenance.reportedBy.userId).toBe(USERS.staffTsg.userId);
  });

  it("answers 403 to a Researcher who does not hold the asset, and writes nothing", async () => {
    const onLoan = await addExtraAsset(db, { tag: "TEST-0405", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    for (const tag of [onLoan.tag, ASSETS.available.tag]) {
      const res = await as(USERS.custodianB).post(`/api/assets/${tag}/maintenance`, reportBody("Test: not mine"));
      expect(res.status, tag).toBe(403);
      expect(res.body.error).toBe(NOT_THE_HOLDER);
    }
    expect(await db.asset_maintenance.count({ where: { asset_id: { in: [onLoan.assetId, ASSETS.available.assetId] } } })).toBe(0);
  });

  it("answers 403 to the Head of another lab", async () => {
    const lab = await db.research_centers.create({ data: { name: "Test Lab MNTLAB", short_code: "MNTLAB", location: "MANILA" } });
    const asset = await addExtraAsset(db, { tag: "MNTLAB-0001", centerId: lab.center_id });

    const res = await as(USERS.labHead).post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test: other lab"));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("This asset belongs to another lab. Only that lab's Head can report an issue on it.");
  });

  it.each([
    { body: { issueTypeId: 999, issueDescription: "Test fault" }, error: "Pick an issue type from the list.", case: "an unknown issue type" },
    { body: { issueDescription: "Test fault" }, error: "Pick an issue type from the list.", case: "no issue type" },
    { body: { issueTypeId: ISSUE_TYPE.issueTypeId, issueDescription: "   " }, error: "Describe the issue.", case: "a description of only spaces" },
    { body: { issueTypeId: ISSUE_TYPE.issueTypeId, issueDescription: "x".repeat(2001) }, error: "issueDescription can be at most 2000 characters.", case: "a description over 2,000 characters" },
  ])("answers 400 for $case, and writes nothing", async ({ body, error }) => {
    const before = await db.asset_maintenance.count();

    const res = await asStaff.post(`/api/assets/${ASSETS.available.tag}/maintenance`, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(await db.asset_maintenance.count()).toBe(before);
  });

  it("answers 409 to a second report while a ticket is open, naming it", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0406");

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test: a different fault"));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${asset.tag} already has an open maintenance ticket (MNT-${maintenanceId}).`);
    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("gives one ticket for two reports sent at once: one 201, one 409", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0407", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const results = await Promise.all([
      asCustodian.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test: first")),
      asCustodian.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test: second")),
    ]);

    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("takes the same description again once the first ticket is closed: the in-memory repeat check is gone (M-07, #65)", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0408");
    expect((await asCustodian.put(`/api/maintenance/${maintenanceId}/cancel`, {})).status).toBe(200);

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, reportBody(`Test fault on ${asset.tag}`));

    expect(res.status).toBe(201);
  });

  it.each([
    { status: "DISPOSED" as const, label: "Retired", tag: "TEST-0409" },
    { status: "MAINTENANCE" as const, label: "Maintenance", tag: "TEST-0410" },
  ])("answers 409 for an asset that is $label (the lifecycle guard)", async ({ status, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, status });

    const res = await asStaff.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test fault"));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${tag} is ${label} and cannot take a maintenance ticket.`);
    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.post("/api/assets/TEST-9999/maintenance", reportBody("Test fault"));

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/maintenance/:id/receive", () => {
  it("files a Maintenance inspection, moves the ticket to Inspecting, puts the asset in Maintenance at the TSG Office, and ends the held loan", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0421");

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/receive`, receiveBody());

    expect(res.status).toBe(200);
    expect(res.body.maintenance).toMatchObject({
      status: "INSPECTING",
      receivedBy: { userId: USERS.staffTsg.userId },
      triggerInspection: { type: "MAINTENANCE", typeLabel: "Maintenance", condition: "DEGRADED", remarks: "Test: screen flickers", inspectedBy: { userId: USERS.staffTsg.userId } },
    });
    expect(res.body.maintenance.receivedAt).not.toBeNull();
    const ticket = await ticketRow(maintenanceId);
    expect(ticket.trigger_inspection_id).toBe(res.body.maintenance.triggerInspection.inspectionId);
    expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
    const loan = await loanRow(asset.loanId!);
    expect(loan.status).toBe("ENDED_BY_MAINTENANCE");
    expect(loan.closed_at).not.toBeNull();
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: null, currentLocation: "TSG Office", condition: "DEGRADED" });
  });

  it("leaves a loan waiting for approval as it is: its approval is refused by the guard, and it can still be declined (section 3.7)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0422" });
    const waiting = await db.asset_loans.create({
      data: { asset_id: asset.assetId, borrower_id: USERS.custodianB.userId, purpose: "Test purpose: waiting", return_by: new Date(Date.now() + 14 * 86400000), status: "PENDING_APPROVAL", destination_center_id: LAB.centerId },
    });
    const filed = await asStaff.post(`/api/assets/${asset.tag}/maintenance`, reportBody("Test fault"));

    expect((await asStaff.put(`/api/maintenance/${filed.body.maintenance.maintenanceId}/receive`, receiveBody())).status).toBe(200);
    expect((await loanRow(waiting.loan_id)).status).toBe("PENDING_APPROVAL");

    const approve = await as(USERS.labHead).put(`/api/loans/${waiting.loan_id}/approve`, {});
    expect(approve.status).toBe(409);
    expect(approve.body.error).toBe(`${asset.tag} is Maintenance and cannot have a loan approved.`);
    const decline = await as(USERS.labHead).put(`/api/loans/${waiting.loan_id}/decline`, { decisionRemarks: "Test: the asset is in repair" });
    expect(decline.status).toBe(200);
    expect((await loanRow(waiting.loan_id)).status).toBe("DECLINED");
  });

  it("answers 409 for a ticket that is not Pending Receipt", async () => {
    const res = await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}/receive`, receiveBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("MNT-1 is Inspecting, so it cannot be received.");
  });

  it("answers 400 without an inspection, or with a metric the asset does not measure, and writes nothing", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0423");

    const none = await asStaff.put(`/api/maintenance/${maintenanceId}/receive`, {});
    const metric = await asStaff.put(`/api/maintenance/${maintenanceId}/receive`, receiveBody({ metrics: [{ metricId: LOOKUPS.metrics[0].metricId, value: 60 }] }));

    expect(none.status).toBe(400);
    expect(none.body.error).toBe("Missing required field: inspection.");
    expect(metric.status).toBe(400);
    expect(metric.body.error).toBe("That measurement does not apply to this asset.");
    expect((await ticketRow(maintenanceId)).status).toBe("PENDING_RECEIPT");
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(0);
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
  });

  it("gives one winner when TSG receives while the reporter cancels", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0424");

    const [received, cancelled] = await Promise.all([
      asStaff.put(`/api/maintenance/${maintenanceId}/receive`, receiveBody()),
      asCustodian.put(`/api/maintenance/${maintenanceId}/cancel`, {}),
    ]);

    expect([received.status, cancelled.status].filter(s => s === 200)).toHaveLength(1);
    const ticket = await ticketRow(maintenanceId);
    if (received.status === 200) {
      expect(cancelled.status).toBe(403);
      expect(ticket.status).toBe("INSPECTING");
      expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
    } else {
      expect(received.status).toBe(409);
      expect(ticket.status).toBe("CANCELLED");
      expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
    }
  });

  it("answers 400 for an id that is not a number, such as MNT-1, and 404 for an unknown id", async () => {
    const bad = await asStaff.put("/api/maintenance/MNT-1/receive", receiveBody());
    const unknown = await asStaff.put("/api/maintenance/999999/receive", receiveBody());

    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("Invalid maintenance id.");
    expect(unknown.status).toBe(404);
  });
});

describe("PUT /api/maintenance/:id/cancel", () => {
  it("lets the reporter cancel a Pending Receipt ticket, with remarks; the asset stays with its holder", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0441");

    const res = await asCustodian.put(`/api/maintenance/${maintenanceId}/cancel`, { remarks: "Test: it works again" });

    expect(res.status).toBe(200);
    expect(res.body.maintenance).toMatchObject({ status: "CANCELLED", statusLabel: "Cancelled", resolutionRemarks: "Test: it works again", completedBy: { userId: USERS.custodianA.userId } });
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
    expect((await loanRow(asset.loanId!)).status).toBe("ON_LOAN");
  });

  it("lets TSG cancel a Pending Receipt ticket, and refuses another Researcher with 403", async () => {
    const { maintenanceId } = await reportedOnLoan("TEST-0442");

    const other = await as(USERS.custodianB).put(`/api/maintenance/${maintenanceId}/cancel`, {});
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("Only the person who reported this issue, or TSG, can cancel it.");

    const tsg = await asStaff.put(`/api/maintenance/${maintenanceId}/cancel`, {});
    expect(tsg.status).toBe(200);
    expect(tsg.body.maintenance.completedBy.userId).toBe(USERS.staffTsg.userId);
  });

  it("refuses the reporter once TSG has received the asset (403); TSG cancels it and the asset is Available back home", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0443");
    await asStaff.put(`/api/maintenance/${maintenanceId}/receive`, receiveBody());

    const reporter = await asCustodian.put(`/api/maintenance/${maintenanceId}/cancel`, {});
    expect(reporter.status).toBe(403);
    expect(reporter.body.error).toBe("Only TSG can cancel a ticket once the asset is received.");

    const tsg = await asStaff.put(`/api/maintenance/${maintenanceId}/cancel`, { remarks: "Test: no fault found" });
    expect(tsg.status).toBe(200);
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: null, currentLocation: LAB.shortCode });
    expect((await loanRow(asset.loanId!)).status).toBe("ENDED_BY_MAINTENANCE");
  });

  it("answers 409 for a ticket that is already Cancelled", async () => {
    const { maintenanceId } = await reportedOnLoan("TEST-0444");
    await asStaff.put(`/api/maintenance/${maintenanceId}/cancel`, {});

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/cancel`, {});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`MNT-${maintenanceId} is Cancelled, so it cannot be cancelled.`);
  });

  it("shows a cancelled ticket in the asset's history as cancelled by that person, not completed", async () => {
    const { asset, maintenanceId } = await reportedOnLoan("TEST-0445");
    await asStaff.put(`/api/maintenance/${maintenanceId}/cancel`, { remarks: "Test: reported by mistake" });

    const res = await asStaff.get(`/api/assets/${asset.tag}/history`);

    const closing = res.body.events.filter((e: { maintenanceId?: number }) => e.maintenanceId === maintenanceId).at(-1);
    expect(closing).toMatchObject({
      kind: "MAINTENANCE_CANCELLED",
      label: "Maintenance cancelled by",
      actor: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName },
      details: "Test: reported by mistake",
    });
    expect(res.body.events.map((e: { kind: string }) => e.kind)).not.toContain("MAINTENANCE_COMPLETED");
  });
});

/**
 * An asset with a ticket TSG reported and received (Inspecting), under warranty until a year from now when `warranty`
 * is true, else with no warranty.
 */
async function receivedTicket(tag: string, warranty: boolean) {
  const asset = await addExtraAsset(db, { tag, warrantyExpiry: warranty ? new Date(Date.now() + 365 * 86400000) : undefined });
  const filed = await asStaff.post(`/api/assets/${tag}/maintenance`, reportBody(`Test fault on ${tag}`));
  const maintenanceId = filed.body.maintenance.maintenanceId as number;
  expect((await asStaff.put(`/api/maintenance/${maintenanceId}/receive`, receiveBody())).status).toBe(200);
  return { asset, maintenanceId };
}

const UNDER_WARRANTY = "This asset is under warranty. Send it to the warranty holder, or write why TSG repairs it.";
const NAME_PROVIDER = "Name the provider: the warranty holder or the repair shop.";
const completeBody = (outcome: string, extra: Record<string, unknown> = {}) => ({
  outcome,
  resolutionRemarks: "Test: replaced the fan",
  inspection: { condition: "OPERATIONAL", remarks: "Test: runs cool" },
  ...extra,
});

describe("PUT /api/maintenance/:id/start and /stage: the warranty rule (CAP1DEF 5)", () => {
  it("refuses Repairing on an asset under warranty without a reason (400), and keeps the reason when one is written", async () => {
    const { maintenanceId } = await receivedTicket("TEST-0461", true);
    expect((await asStaff.get(`/api/maintenance?status=INSPECTING`)).body.tickets.find((t: { maintenanceId: number }) => t.maintenanceId === maintenanceId).underWarranty).toBe(true);

    const refused = await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING" });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe(UNDER_WARRANTY);
    expect((await ticketRow(maintenanceId)).status).toBe("INSPECTING");

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING", warrantyOverrideReason: "Test: the seller closed" });
    expect(res.status).toBe(200);
    expect(res.body.maintenance).toMatchObject({ status: "REPAIRING", statusLabel: "Repairing", underWarranty: true, warrantyOverrideReason: "Test: the seller closed" });
  });

  it("sends a warranty asset to External Service with a provider, and needs the provider (400)", async () => {
    const { asset, maintenanceId } = await receivedTicket("TEST-0462", true);

    const none = await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "EXTERNAL_SERVICE" });
    expect(none.status).toBe(400);
    expect(none.body.error).toBe(NAME_PROVIDER);

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "EXTERNAL_SERVICE", provider: "Test Seller Inc." });
    expect(res.status).toBe(200);
    expect(res.body.maintenance).toMatchObject({ status: "EXTERNAL_SERVICE", provider: "Test Seller Inc." });
    expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
  });

  it("lets TSG repair an asset with no warranty without a reason", async () => {
    const { maintenanceId } = await receivedTicket("TEST-0463", false);

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING" });

    expect(res.status).toBe(200);
    expect(res.body.maintenance).toMatchObject({ status: "REPAIRING", underWarranty: false, warrantyOverrideReason: null });
  });

  it("answers 409 to a start on a ticket that is not Inspecting, and 400 to an unknown stage", async () => {
    const { maintenanceId } = await reportedOnLoan("TEST-0464");

    const pending = await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING" });
    expect(pending.status).toBe(409);
    expect(pending.body.error).toBe(`MNT-${maintenanceId} is Pending Receipt, so it cannot be started.`);
    const stage = await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}/start`, { stage: "FIXED" });
    expect(stage.status).toBe(400);
    expect(stage.body.error).toBe("Pick the stage: REPAIRING or EXTERNAL_SERVICE.");
  });

  it("moves Repairing to External Service with a provider, and back to Repairing on the stored warranty reason", async () => {
    const { maintenanceId } = await receivedTicket("TEST-0465", true);
    await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING", warrantyOverrideReason: "Test: urgent" });

    const noProvider = await asStaff.put(`/api/maintenance/${maintenanceId}/stage`, { stage: "EXTERNAL_SERVICE" });
    expect(noProvider.status).toBe(400);
    expect(noProvider.body.error).toBe(NAME_PROVIDER);
    const out = await asStaff.put(`/api/maintenance/${maintenanceId}/stage`, { stage: "EXTERNAL_SERVICE", provider: "Test Repair Shop" });
    expect(out.status).toBe(200);
    expect(out.body.maintenance).toMatchObject({ status: "EXTERNAL_SERVICE", provider: "Test Repair Shop" });

    const back = await asStaff.put(`/api/maintenance/${maintenanceId}/stage`, { stage: "REPAIRING" });
    expect(back.status).toBe(200);
    expect(back.body.maintenance.status).toBe("REPAIRING");
  });

  it("refuses a move back to Repairing on a warranty asset with no stored reason (400)", async () => {
    const { maintenanceId } = await receivedTicket("TEST-0466", true);
    await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "EXTERNAL_SERVICE", provider: "Test Seller Inc." });

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/stage`, { stage: "REPAIRING" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(UNDER_WARRANTY);
    expect((await ticketRow(maintenanceId)).status).toBe("EXTERNAL_SERVICE");
  });

  it("answers 409 to a stage change from Inspecting, or to the stage the ticket is already in", async () => {
    const { maintenanceId } = await receivedTicket("TEST-0467", false);

    const inspecting = await asStaff.put(`/api/maintenance/${maintenanceId}/stage`, { stage: "REPAIRING" });
    expect(inspecting.status).toBe(409);
    expect(inspecting.body.error).toBe(`MNT-${maintenanceId} is Inspecting, so it cannot be moved to another stage.`);

    await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING" });
    const same = await asStaff.put(`/api/maintenance/${maintenanceId}/stage`, { stage: "REPAIRING" });
    expect(same.status).toBe(409);
    expect(same.body.error).toBe(`MNT-${maintenanceId} is already Repairing.`);
  });
});

describe("PUT /api/maintenance/:id/complete", () => {
  it("Resolved: files the completion inspection, closes the ticket, and puts the asset back to Available at home", async () => {
    const { asset, maintenanceId } = await receivedTicket("TEST-0481", false);
    await asStaff.put(`/api/maintenance/${maintenanceId}/start`, { stage: "REPAIRING" });

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/complete`, completeBody("RESOLVED"));

    expect(res.status).toBe(200);
    expect(res.body.maintenance).toMatchObject({
      status: "RESOLVED",
      statusLabel: "Resolved",
      completedBy: { userId: USERS.staffTsg.userId },
      resolutionRemarks: "Test: replaced the fan",
      completionInspection: { type: "MAINTENANCE", condition: "OPERATIONAL", remarks: "Test: runs cool" },
    });
    expect((await ticketRow(maintenanceId)).completion_inspection_id).toBe(res.body.maintenance.completionInspection.inspectionId);
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
    expect(await listedAsset(asset.tag)).toMatchObject({ currentLocation: LAB.shortCode, condition: "OPERATIONAL" });

    const history = await asStaff.get(`/api/assets/${asset.tag}/history`);
    expect(history.body.events.find((e: { kind: string }) => e.kind === "MAINTENANCE_COMPLETED")).toMatchObject({ label: "Maintenance completed (Resolved) by", actor: { userId: USERS.staffTsg.userId } });
  });

  it("Beyond Repair: closes the ticket straight from Inspecting and keeps the asset in Maintenance", async () => {
    const { asset, maintenanceId } = await receivedTicket("TEST-0482", false);

    const res = await asStaff.put(`/api/maintenance/${maintenanceId}/complete`, completeBody("BEYOND_REPAIR", { inspection: { condition: "CRITICAL_DEFECT" } }));

    expect(res.status).toBe(200);
    expect(res.body.maintenance.status).toBe("BEYOND_REPAIR");
    expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
    expect(await listedAsset(asset.tag)).toMatchObject({ currentLocation: "TSG Office", condition: "CRITICAL_DEFECT" });
  });

  it.each([
    { body: completeBody("RESOLVED", { inspection: undefined }), error: "Missing required field: inspection.", case: "no inspection" },
    { body: completeBody("RESOLVED", { resolutionRemarks: " " }), error: "Write the resolution remarks.", case: "no remarks" },
    { body: completeBody("FIXED"), error: "Pick the outcome: RESOLVED or BEYOND_REPAIR.", case: "an unknown outcome" },
  ])("answers 400 for $case, and writes nothing", async ({ body, error }) => {
    const before = await db.asset_inspections.count();

    const res = await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}/complete`, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(await db.asset_inspections.count()).toBe(before);
    expect((await ticketRow(SEEDED_ROWS.repairId)).status).toBe("INSPECTING");
  });

  it("answers 409 to a ticket that is Pending Receipt or already completed", async () => {
    const { maintenanceId: pending } = await reportedOnLoan("TEST-0483");
    const { maintenanceId: done } = await receivedTicket("TEST-0484", false);
    await asStaff.put(`/api/maintenance/${done}/complete`, completeBody("RESOLVED"));

    const first = await asStaff.put(`/api/maintenance/${pending}/complete`, completeBody("RESOLVED"));
    const second = await asStaff.put(`/api/maintenance/${done}/complete`, completeBody("RESOLVED"));

    expect(first.status).toBe(409);
    expect(first.body.error).toBe(`MNT-${pending} is Pending Receipt, so it cannot be completed.`);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe(`MNT-${done} is Resolved, so it cannot be completed.`);
  });
});

describe("the old ticket update routes", () => {
  it("answer 404: PUT /api/maintenance/:id and PUT /api/maintenance/:id/status are gone (H-06)", async () => {
    expect((await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}`, { progressStatus: "Inspection Phase" })).status).toBe(404);
    expect((await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}/status`, { progressStatus: "Inspection Phase" })).status).toBe(404);
    expect((await ticketRow(SEEDED_ROWS.repairId)).status).toBe("INSPECTING");
  });
});
