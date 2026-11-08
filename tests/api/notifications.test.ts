/**
 * Notifications API: the notifications worked out from loans, tickets, retirements, and inspections, each for its own
 * person only, matched by user id. (#131)
 * Covers GET /api/notifications/mine.
 * Workflow: the notification bell (a Head's waiting approvals; TSG's waiting releases, returns, and receipts; the
 * deciders' waiting disposals; a borrower's due soon, overdue, and status checks; a reporter's open tickets).
 * Fixtures: the seeded loans (LOAN-1 On Loan to Custodian A on TEST-0002, due in 30 days; LOAN-2 Pending Approval from
 * Custodian B on TEST-0005, a TEST asset, so the Lab Head's), MNT-1 (Inspecting, reported by Custodian A), and the
 * accounts (USERS). The tests add rows on their own extra assets (TEST-0101 onward) and run in order; the Batch 5
 * kinds run last, so the earlier exact lists hold.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import type { Notification } from "../../shared/types/notifications";

const { db, as, api } = useApiHarness();

/** Today as yyyy-mm-dd in local time, the day the server compares return-by dates with. */
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** The yyyy-mm-dd `days` after today (negative for before). */
function dayFromToday(days: number): string {
  const d = new Date(`${localToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const mine = async (user: (typeof USERS)[keyof typeof USERS]) => {
  const res = await as(user).get("/api/notifications/mine");
  expect(res.status).toBe(200);
  return res.body.notifications as Notification[];
};

/** An extra asset with a loan of Custodian A, held (On Loan, or Return Requested) and due on the day given. */
async function heldLoan(tag: string, returnByDay: string, returnRequested = false) {
  const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId, returnBy: new Date(returnByDay) });
  if (returnRequested) {
    await db.asset_loans.update({ where: { loan_id: asset.loanId! }, data: { status: "RETURN_REQUESTED", return_requested_at: new Date() } });
  }
  return { tag, loanId: asset.loanId! };
}

describe("GET /api/notifications/mine", () => {
  it("answers 401 with no session", async () => {
    expect((await api.get("/api/notifications/mine")).status).toBe(401);
  });

  it("gives the Head of the asset's home lab one LOAN_AWAITING_APPROVAL per Pending Approval loan, and nothing else", async () => {
    const notifications = await mine(USERS.labHead);

    expect(notifications).toEqual([{
      kind: "LOAN_AWAITING_APPROVAL",
      label: "Loan request waiting for your approval",
      loanId: SEEDED_ROWS.pendingLoanId,
      assetTag: ASSETS.pendingLoan.tag,
      centerId: LAB.centerId,
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }]);
  });

  it("gives a waiting approval only to the Head of that asset's lab", async () => {
    const otherLab = await db.research_centers.create({ data: { name: "Test Lab OTHER", short_code: "OTHER", location: "MANILA", head_user_id: USERS.director.userId } });
    const otherAsset = await addExtraAsset(db, { tag: "OTHER-0001", centerId: otherLab.center_id });
    const otherLoan = await db.asset_loans.create({
      data: { asset_id: otherAsset.assetId, borrower_id: USERS.custodianB.userId, purpose: "Test other lab loan", return_by: new Date(dayFromToday(10)), status: "PENDING_APPROVAL", destination_center_id: LAB.centerId },
    });

    expect((await mine(USERS.director)).map(n => [n.kind, n.loanId])).toEqual([["LOAN_AWAITING_APPROVAL", otherLoan.loan_id]]);
    expect((await mine(USERS.labHead)).map(n => n.loanId)).not.toContain(otherLoan.loan_id);
  });

  it("gives TSG one RELEASE_WAITING per Pending Release loan and one RETURN_WAITING per Return Requested loan", async () => {
    const waitingAsset = await addExtraAsset(db, { tag: "TEST-0101" });
    const waiting = await db.asset_loans.create({
      data: { asset_id: waitingAsset.assetId, borrower_id: USERS.custodianB.userId, purpose: "Test waiting release", return_by: new Date(dayFromToday(10)), status: "PENDING_RELEASE", decided_by_id: USERS.labHead.userId, decided_at: new Date(), destination_center_id: LAB.centerId },
    });
    const returning = await heldLoan("TEST-0102", dayFromToday(20), true);

    for (const user of [USERS.staffTsg, USERS.staffIts]) {
      expect((await mine(user)).map(n => [n.kind, n.loanId, n.assetTag])).toEqual([
        ["RELEASE_WAITING", waiting.loan_id, "TEST-0101"],
        ["RETURN_WAITING", returning.loanId, "TEST-0102"],
      ]);
    }
  });

  it("gives the borrower LOAN_DUE_SOON for a held loan due today to today + 3 days, and LOAN_OVERDUE once its date has passed", async () => {
    const dueToday = await heldLoan("TEST-0201", dayFromToday(0));
    const dueInThree = await heldLoan("TEST-0202", dayFromToday(3));
    await heldLoan("TEST-0203", dayFromToday(4));
    const overdue = await heldLoan("TEST-0204", dayFromToday(-1), true);

    const kinds = (await mine(USERS.custodianA)).filter(n => n.kind.startsWith("LOAN_")).map(n => [n.kind, n.loanId, n.date]);

    expect(kinds).toEqual(expect.arrayContaining([
      ["LOAN_DUE_SOON", dueToday.loanId, dayFromToday(0)],
      ["LOAN_DUE_SOON", dueInThree.loanId, dayFromToday(3)],
      ["LOAN_OVERDUE", overdue.loanId, dayFromToday(-1)],
    ]));
    expect(kinds).toHaveLength(3);
  });

  it("matches people by user id: someone with the borrower's display name gets none of the borrower's notifications (#131)", async () => {
    await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { first_name: USERS.custodianA.firstName, last_name: USERS.custodianA.lastName } });
    try {
      expect(await mine(USERS.custodianB)).toEqual([]);
    } finally {
      await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { first_name: USERS.custodianB.firstName, last_name: USERS.custodianB.lastName } });
    }
  });

  it("gives nothing to an account none of the kinds apply to", async () => {
    for (const user of [USERS.secretary, USERS.admin]) {
      expect(await mine(user), user.lastName).toEqual([]);
    }
  });
});

describe("GET /api/notifications/mine, the Batch 5 kinds", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const of = (notifications: Awaited<ReturnType<typeof mine>>, kind: string) => notifications.filter(n => n.kind === kind);

  it("gives the holder STATUS_CHECK_DUE for an asset whose newest inspection of any type is older than 90 days, or that has none, and a Self Report clears it", async () => {
    const stale = await heldLoan("TEST-0301", dayFromToday(30));
    const staleAsset = await db.assets.findUniqueOrThrow({ where: { asset_tag: "TEST-0301" } });
    const staleAt = new Date(Date.now() - 100 * DAY_MS);
    await db.asset_inspections.create({ data: { asset_id: staleAsset.asset_id, inspected_by_id: USERS.staffTsg.userId, type: "ROUTINE", condition: "OPERATIONAL", inspected_at: staleAt } });
    const fresh = await heldLoan("TEST-0302", dayFromToday(30));
    const freshAsset = await db.assets.findUniqueOrThrow({ where: { asset_tag: "TEST-0302" } });
    await db.asset_inspections.create({ data: { asset_id: freshAsset.asset_id, inspected_by_id: USERS.staffTsg.userId, type: "LOAN_RELEASE", condition: "OPERATIONAL", inspected_at: new Date(Date.now() - 5 * DAY_MS) } });
    const never = await heldLoan("TEST-0303", dayFromToday(30));

    const checks = of(await mine(USERS.custodianA), "STATUS_CHECK_DUE");
    expect(checks.find(n => n.assetTag === "TEST-0301")).toEqual({
      kind: "STATUS_CHECK_DUE", label: "Status check due", loanId: stale.loanId, assetTag: "TEST-0301", centerId: LAB.centerId, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(checks.find(n => n.assetTag === "TEST-0303")).toMatchObject({ loanId: never.loanId });
    expect(checks.find(n => n.assetTag === "TEST-0303")!.date).toBeUndefined();
    expect(checks.map(n => n.assetTag)).not.toContain("TEST-0302");
    expect(checks.map(n => n.loanId)).not.toContain(fresh.loanId);
    for (const user of [USERS.custodianB, USERS.staffTsg, USERS.labHead]) {
      expect(of(await mine(user), "STATUS_CHECK_DUE"), user.lastName).toEqual([]);
    }

    const self = await as(USERS.custodianA).post("/api/assets/TEST-0301/inspection", { condition: "OPERATIONAL" });
    expect(self.status).toBe(200);
    expect(of(await mine(USERS.custodianA), "STATUS_CHECK_DUE").map(n => n.assetTag)).not.toContain("TEST-0301");
  });

  it("gives TSG one RECEIPT_WAITING per ticket in Pending Receipt, and the reporter one MAINTENANCE_OPEN per open ticket with its status", async () => {
    const held = await heldLoan("TEST-0311", dayFromToday(30));
    const report = await as(USERS.custodianA).post("/api/assets/TEST-0311/maintenance", { issueTypeId: 1, issueDescription: "Test: no power" });
    expect(report.status).toBe(201);
    const ticketId = report.body.maintenance.maintenanceId;

    for (const user of [USERS.staffTsg, USERS.staffIts]) {
      expect(of(await mine(user), "RECEIPT_WAITING"), user.lastName).toEqual([{
        kind: "RECEIPT_WAITING", label: "Reported issue waiting for receipt", maintenanceId: ticketId, assetTag: "TEST-0311", centerId: LAB.centerId, date: localToday(),
      }]);
    }
    const open = of(await mine(USERS.custodianA), "MAINTENANCE_OPEN");
    expect(open.map(n => [n.maintenanceId, n.statusLabel])).toEqual([[SEEDED_ROWS.repairId, "Inspecting"], [ticketId, "Pending Receipt"]]);
    expect(open[1]).toMatchObject({ label: "Your maintenance ticket", assetTag: "TEST-0311", date: localToday() });
    for (const user of [USERS.custodianB, USERS.labHead, USERS.director, USERS.secretary]) {
      const notifications = await mine(user);
      expect([...of(notifications, "RECEIPT_WAITING"), ...of(notifications, "MAINTENANCE_OPEN")], user.lastName).toEqual([]);
    }

    expect((await as(USERS.staffTsg).put(`/api/maintenance/${ticketId}/receive`, { inspection: { condition: "DEGRADED" } })).status).toBe(200);
    expect(of(await mine(USERS.staffTsg), "RECEIPT_WAITING")).toEqual([]);
    expect(of(await mine(USERS.custodianA), "MAINTENANCE_OPEN").find(n => n.maintenanceId === ticketId)!.statusLabel).toBe("Inspecting");
    // The receipt ended the loan, so the asset's status check is no longer the borrower's.
    expect(of(await mine(USERS.custodianA), "STATUS_CHECK_DUE").map(n => n.loanId)).not.toContain(held.loanId);

    expect((await as(USERS.staffTsg).put(`/api/maintenance/${ticketId}/cancel`, { remarks: "Test: works again" })).status).toBe(200);
    expect(of(await mine(USERS.custodianA), "MAINTENANCE_OPEN").map(n => n.maintenanceId)).toEqual([SEEDED_ROWS.repairId]);
  });

  it("gives the Director and the Secretary one DISPOSAL_DECISION_WAITING per Pending disposal they did not request, until it is decided", async () => {
    const byTsg = await addExtraAsset(db, { tag: "TEST-0321" });
    const request = await as(USERS.staffTsg).post(`/api/assets/${byTsg.tag}/retirement`, { reason: "Test: worn out" });
    expect(request.status).toBe(201);
    const retirementId = request.body.retirement.retirementId;
    // Only TSG can request through the API, so the Director's own request is written directly.
    const byDirector = await addExtraAsset(db, { tag: "TEST-0322", assetStatus: "PENDING_RETIREMENT" });
    const own = await db.asset_retirements.create({
      data: { asset_id: byDirector.assetId, requested_by_id: USERS.director.userId, reason: "Test: the Director's own request", status: "PENDING", previous_status: "AVAILABLE" },
    });

    const card = { kind: "DISPOSAL_DECISION_WAITING", label: "Retirement request waiting for your decision", retirementId, assetTag: "TEST-0321", centerId: LAB.centerId, date: localToday() };
    expect(of(await mine(USERS.director), "DISPOSAL_DECISION_WAITING")).toEqual([card]);
    expect(of(await mine(USERS.secretary), "DISPOSAL_DECISION_WAITING").map(n => n.retirementId)).toEqual([retirementId, own.retirement_id]);
    for (const user of [USERS.staffTsg, USERS.labHead, USERS.custodianA, USERS.admin]) {
      expect(of(await mine(user), "DISPOSAL_DECISION_WAITING"), user.lastName).toEqual([]);
    }

    expect((await as(USERS.director).put(`/api/retirements/${retirementId}/decision`, { decision: "approve" })).status).toBe(200);
    expect(of(await mine(USERS.director), "DISPOSAL_DECISION_WAITING")).toEqual([]);
    expect(of(await mine(USERS.secretary), "DISPOSAL_DECISION_WAITING").map(n => n.retirementId)).toEqual([own.retirement_id]);
  });

  it("gives TSG no MAINTENANCE_OPEN for a ticket it filed itself, only the RECEIPT_WAITING card", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0331" });
    const report = await as(USERS.staffTsg).post(`/api/assets/${asset.tag}/maintenance`, { issueTypeId: 1, issueDescription: "Test: TSG found a fault" });
    expect(report.status).toBe(201);

    const notifications = await mine(USERS.staffTsg);
    expect(of(notifications, "RECEIPT_WAITING").map(n => n.maintenanceId)).toContain(report.body.maintenance.maintenanceId);
    expect(of(notifications, "MAINTENANCE_OPEN")).toEqual([]);
  });
});
