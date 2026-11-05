/**
 * Notifications API: the notifications worked out from loans, each for its own person only, matched by user id. (#131)
 * Covers GET /api/notifications/mine.
 * Workflow: the notification bell (a Head's waiting approvals, TSG's waiting releases and returns, a borrower's due
 * soon and overdue loans).
 * Fixtures: the seeded loans (LOAN-1 On Loan to Custodian A on TEST-0002, due in 30 days; LOAN-2 Pending Approval from
 * Custodian B on TEST-0005, a TEST asset, so the Lab Head's) and the accounts (USERS). The tests add loans on their own
 * extra assets (TEST-0101 onward) and run in order.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

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
  return res.body.notifications as { kind: string; label: string; loanId?: number; assetTag?: string; centerId?: number; date?: string }[];
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

    const kinds = (await mine(USERS.custodianA)).map(n => [n.kind, n.loanId, n.date]);

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
