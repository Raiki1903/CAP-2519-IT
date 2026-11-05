/**
 * Loans API: the loan request, cancel, the Lab Head's approve and decline, and the old loan list.
 * Covers POST /api/assets/:tag/loans, PUT /api/loans/:id/cancel, /approve, /decline, /release, /return-request,
 * /receive, and GET /api/loans.
 * Workflow: borrowing (a Researcher requests, the home lab's Head approves or declines, the borrower may cancel while
 * the loan waits, TSG releases it with a Loan Release inspection, the borrower asks to return, and TSG receives it
 * with a Return inspection).
 * Fixtures: the seeded loans (LOAN-1 On Loan on TEST-0002, LOAN-2 Pending Approval on TEST-0005), the seeded assets
 * in each state, and the accounts (USERS). The list tests run first. The write tests use their own extra assets
 * (TEST-0101 onward, see extraAssets.ts) and change no seeded row; the H-08 test puts LOAN-2 back to pending.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);
const asCustodianB = as(USERS.custodianB);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);

const FORBIDDEN = "Your role is not allowed to do this.";
const NO_LAB_HEAD = "This lab has no Lab Head yet. Ask the IT Admin to set one.";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today as yyyy-mm-dd in local time, the date the server compares a return-by date with. */
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

/** What a loan request sends: the borrower's own lab, a room, the return-by date, and the purpose. */
const requestBody = (extra: Record<string, unknown> = {}) => ({
  destinationCenterId: LAB.centerId,
  destinationRoom: "Test Room 1",
  returnBy: inDays(14),
  purpose: "Test loan purpose",
  ...extra,
});

const assetStatus = async (assetId: number) => (await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } })).status;
const loanRow = (loanId: number) => db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } });

/** Files a loan request through the API, signed in as the borrower, and answers the new loan's id. */
async function requestLoan(tag: string, borrower: TestUser = USERS.custodianA, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await as(borrower).post(`/api/assets/${tag}/loans`, requestBody(extra));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.loan.loanId;
}

/** A new asset with a loan of Custodian A in Pending Approval, filed through the API. */
async function pendingLoanOn(tag: string) {
  const asset = await addExtraAsset(db, { tag });
  return { asset, loanId: await requestLoan(tag) };
}

/** A new asset with a loan of Custodian A approved by the Lab Head, so it waits in Pending Release. */
async function pendingReleaseOn(tag: string) {
  const { asset, loanId } = await pendingLoanOn(tag);
  expect((await asLabHead.put(`/api/loans/${loanId}/approve`, {})).status).toBe(200);
  return { asset, loanId };
}

/** A lab of its own, with the Head given, and one Available asset in it. */
async function otherLab(code: string, headUserId: number | null) {
  const lab = await db.research_centers.create({ data: { name: `Test Lab ${code}`, short_code: code, location: "MANILA", head_user_id: headUserId } });
  const asset = await addExtraAsset(db, { tag: `${code}-0001`, centerId: lab.center_id });
  return { lab, asset };
}

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/loans (today's list shape)", () => {
  it("lists every loan newest first, with the destination lab from destination_center_id and the purpose as stored", async () => {
    const res = await asLabHead.get("/api/loans");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loans.map((l: { id: string }) => l.id)).toEqual([`LOAN-${SEEDED_ROWS.pendingLoanId}`, `LOAN-${SEEDED_ROWS.approvedLoanId}`]);
    expect(res.body.loans[0]).toMatchObject({
      loanId: SEEDED_ROWS.pendingLoanId,
      assetId: ASSETS.pendingLoan.tag,
      asset: ASSETS.pendingLoan.name,
      assetName: ASSETS.pendingLoan.name,
      borrower_id: USERS.custodianB.userId,
      borrower: USERS.custodianB.fullName,
      purpose: "Test purpose: pending loan",
      destinationLab: LAB.shortCode,
      status: "Pending",
      location: "Manila",
      lab: LAB.shortCode,
    });
    expect(res.body.loans[1]).toMatchObject({ assetId: ASSETS.onLoan.tag, borrower: USERS.custodianA.fullName, status: "Approved" });
    expect(typeof res.body.loans[0].requestedOn).toBe("string");
    expect(typeof res.body.loans[0].dueDate).toBe("string");
  });

  it("sends a loan that names no destination lab with no destinationLab", async () => {
    const plain = await db.asset_loans.create({
      data: { asset_id: ASSETS.disposed.assetId, borrower_id: USERS.custodianA.userId, purpose: "Test purpose without a lab", requested_at: new Date("2026-01-10"), return_by: new Date("2026-01-20"), status: "DECLINED" },
    });
    try {
      const res = await asLabHead.get("/api/loans");

      const listed = res.body.loans.find((l: { loanId: number }) => l.loanId === plain.loan_id);
      expect(listed).toMatchObject({ purpose: "Test purpose without a lab", status: "Declined" });
      expect(listed.destinationLab).toBeUndefined();
    } finally {
      await db.asset_loans.delete({ where: { loan_id: plain.loan_id } });
    }
  });

  it("writes nothing while some loan is pending", async () => {
    const before = await db.asset_loans.count();

    await asLabHead.get("/api/loans");

    expect(await db.asset_loans.count()).toBe(before);
  });

  it("writes nothing when no loan is pending, and lists only the real loans (H-08 fixed)", async () => {
    const pendingIds = (await db.asset_loans.findMany({ where: { status: "PENDING_APPROVAL" }, select: { loan_id: true } })).map((l) => l.loan_id);
    await db.asset_loans.updateMany({ where: { loan_id: { in: pendingIds } }, data: { status: "DECLINED" } });
    try {
      const before = await db.asset_loans.findMany({ select: { loan_id: true }, orderBy: { loan_id: "asc" } });

      const res = await asLabHead.get("/api/loans");

      expect(res.status).toBe(200);
      expect(res.body.loans.some((l: { status: string }) => l.status === "Pending")).toBe(false);
      expect(res.body.loans).toHaveLength(before.length);
      expect(await db.asset_loans.findMany({ select: { loan_id: true }, orderBy: { loan_id: "asc" } })).toEqual(before);
    } finally {
      await db.asset_loans.updateMany({ where: { loan_id: { in: pendingIds } }, data: { status: "PENDING_APPROVAL" } });
    }
  });
});

describe("POST /api/assets/:tag/loans", () => {
  it("answers 201 with a loan in Pending Approval for the session user, with the destination lab and room, and leaves the asset Available", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0101" });

    const res = await asCustodianB.post(`/api/assets/${asset.tag}/loans`, requestBody({ returnBy: inDays(10) }));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.loan).toMatchObject({
      asset: { assetId: asset.assetId, tag: asset.tag, name: asset.name },
      borrower: { userId: USERS.custodianB.userId, name: USERS.custodianB.fullName },
      status: "PENDING_APPROVAL",
      statusLabel: "Pending Approval",
      purpose: "Test loan purpose",
      project: null,
      destinationLab: { centerId: LAB.centerId, code: LAB.shortCode },
      destinationRoom: "Test Room 1",
      returnBy: inDays(10),
      decidedBy: null,
      releasedBy: null,
      releaseInspection: null,
      returnInspection: null,
      closedAt: null,
      isOverdue: false,
    });
    const row = await loanRow(res.body.loan.loanId);
    expect(row).toMatchObject({ borrower_id: USERS.custodianB.userId, purpose: "Test loan purpose", destination_center_id: LAB.centerId, destination_room: "Test Room 1" });
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "AVAILABLE", holder: null, openLoan: { status: "PENDING_APPROVAL" } });
  });

  it("ignores a borrower id or name in the body: the loan is the session user's (issue #32)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0102" });

    const loanId = await requestLoan(asset.tag, USERS.custodianA, { borrowerId: USERS.custodianB.userId, borrower: USERS.custodianB.fullName });

    expect((await loanRow(loanId)).borrower_id).toBe(USERS.custodianA.userId);
  });

  it("accepts a return-by date of today", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0103" });

    const loanId = await requestLoan(asset.tag, USERS.custodianA, { returnBy: localToday() });

    expect((await loanRow(loanId)).return_by.toISOString().slice(0, 10)).toBe(localToday());
  });

  it("answers 400 for a lab that is not one of the borrower's, and writes nothing", async () => {
    const { lab } = await otherLab("NOTMINE", USERS.staffIts.userId);
    const asset = await addExtraAsset(db, { tag: "TEST-0104" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/loans`, requestBody({ destinationCenterId: lab.center_id }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Pick one of your own labs.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("answers 400 for a return-by date before today, and writes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0105" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/loans`, requestBody({ returnBy: inDays(-2) }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("The return-by date cannot be in the past.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it.each([
    ["purpose", { purpose: "   " }, "Write the purpose of the loan."],
    ["returnBy", { returnBy: undefined }, "Pick a return-by date."],
    ["destinationCenterId", { destinationCenterId: undefined }, "Pick one of your own labs."],
    ["destinationRoom over 100 characters", { destinationRoom: "x".repeat(101) }, "destinationRoom can be at most 100 characters."],
    ["an unknown project", { projectId: 999999 }, "Pick a project from the list."],
  ])("answers 400 for %s, and writes nothing", async (_what, extra, message) => {
    const before = await db.asset_loans.count();

    const res = await asCustodian.post(`/api/assets/${ASSETS.available.tag}/loans`, requestBody(extra));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect(await db.asset_loans.count()).toBe(before);
  });

  it("answers 403 to the account that heads a lab, with the personal account sentence, and writes nothing", async () => {
    const res = await asLabHead.post(`/api/assets/${ASSETS.available.tag}/loans`, requestBody());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: "Use your personal account to borrow." });
    expect(await db.asset_loans.count({ where: { asset_id: ASSETS.available.assetId } })).toBe(0);
  });

  it.each([USERS.staffTsg, USERS.admin, USERS.director, USERS.secretary])("answers 403 to $lastName, and writes nothing", async (user) => {
    const res = await as(user).post(`/api/assets/${ASSETS.available.tag}/loans`, requestBody());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: FORBIDDEN });
    expect(await db.asset_loans.count({ where: { asset_id: ASSETS.available.assetId } })).toBe(0);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asCustodian.post("/api/assets/NOPE-9999/loans", requestBody());

    expect(res.status).toBe(404);
  });

  it.each([ASSETS.onLoan, ASSETS.inRepair, ASSETS.disposed])("answers 409 for $tag, which is $listStatus, and writes nothing", async (asset) => {
    const before = await db.asset_loans.count({ where: { asset_id: asset.assetId } });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/loans`, requestBody());

    expect(res.status).toBe(409);
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(before);
  });

  it("answers 409 while a loan already waits for approval, and names it (issue #25)", async () => {
    const res = await asCustodian.post(`/api/assets/${ASSETS.pendingLoan.tag}/loans`, requestBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${ASSETS.pendingLoan.tag} already has a loan in Pending Approval (LOAN-${SEEDED_ROWS.pendingLoanId}).`);
  });

  it("answers 409 while the asset is Pending Retirement, and writes nothing (issue #54)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0106", assetStatus: "PENDING_RETIREMENT" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/loans`, requestBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TEST-0106 is Pending Retirement and cannot be requested for a loan.");
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("answers 409 when the asset's lab has no Head, and writes nothing", async () => {
    const { asset } = await otherLab("NOHEADREQ", null);

    const res = await asCustodian.post(`/api/assets/${asset.tag}/loans`, requestBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(NO_LAB_HEAD);
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("gives one loan to two requests for one asset at the same moment: one 201, one 409", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0107" });
    await asCustodianB.get("/api/auth/me");

    const results = await Promise.all([
      asCustodian.post(`/api/assets/${asset.tag}/loans`, requestBody()),
      asCustodianB.post(`/api/assets/${asset.tag}/loans`, requestBody()),
    ]);

    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await db.asset_loans.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });
});

describe("PUT /api/loans/:id/cancel", () => {
  it("cancels the borrower's request from Pending Approval: Cancelled, closed, the asset Available", async () => {
    const { asset, loanId } = await pendingLoanOn("TEST-0201");

    const res = await asCustodian.put(`/api/loans/${loanId}/cancel`, {});

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ loanId, status: "CANCELLED", statusLabel: "Cancelled" });
    expect(res.body.loan.closedAt).not.toBeNull();
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
  });

  it("cancels from Pending Release too, and the borrower sees the Head only as hidden", async () => {
    const { asset, loanId } = await pendingReleaseOn("TEST-0202");

    const res = await asCustodian.put(`/api/loans/${loanId}/cancel`, {});

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ status: "CANCELLED", decidedBy: { hidden: true } });
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
    expect(await requestLoan(asset.tag)).toBeGreaterThan(loanId);
  });

  it("answers 403 to someone who is not the borrower, and leaves the loan as it was", async () => {
    const { loanId } = await pendingLoanOn("TEST-0203");

    const res = await asCustodianB.put(`/api/loans/${loanId}/cancel`, {});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Only the borrower can cancel this loan.");
    expect((await loanRow(loanId)).status).toBe("PENDING_APPROVAL");
  });

  it("answers 409 for a loan already On Loan, and leaves it as it was", async () => {
    const res = await asCustodian.put(`/api/loans/${SEEDED_ROWS.approvedLoanId}/cancel`, {});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`Loan ${SEEDED_ROWS.approvedLoanId} is On Loan, so it can no longer be cancelled.`);
    expect((await loanRow(SEEDED_ROWS.approvedLoanId)).status).toBe("ON_LOAN");
  });

  it("answers 400 for an id that is not a number, and 404 for an unknown loan", async () => {
    expect((await asCustodian.put("/api/loans/LOAN-1/cancel", {})).status).toBe(400);
    expect((await asCustodian.put("/api/loans/999999/cancel", {})).status).toBe(404);
  });
});

describe("PUT /api/loans/:id/approve and /decline", () => {
  it("approve: Pending Release with who decided and the remarks; the asset stays Available, held by nobody, and takes no second request", async () => {
    const { asset, loanId } = await pendingLoanOn("TEST-0301");

    const res = await asLabHead.put(`/api/loans/${loanId}/approve`, { decisionRemarks: "  Test approval remark  " });

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({
      status: "PENDING_RELEASE",
      statusLabel: "Pending Release",
      decidedBy: { userId: USERS.labHead.userId, name: USERS.labHead.fullName },
      decisionRemarks: "Test approval remark",
      closedAt: null,
      isOverdue: false,
    });
    expect(res.body.loan.decidedAt).not.toBeNull();
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: null, openLoan: { loanId, status: "PENDING_RELEASE" } });

    const second = await asCustodianB.post(`/api/assets/${asset.tag}/loans`, requestBody());
    expect(second.status).toBe(409);
    expect(second.body.error).toBe(`${asset.tag} already has a loan in Pending Release (LOAN-${loanId}).`);
  });

  it("decline: Declined and closed, with who decided and the remarks; the asset stays Available and takes a new request", async () => {
    const { asset, loanId } = await pendingLoanOn("TEST-0302");

    const res = await asLabHead.put(`/api/loans/${loanId}/decline`, { decisionRemarks: "Test decline reason" });

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ status: "DECLINED", decidedBy: { userId: USERS.labHead.userId }, decisionRemarks: "Test decline reason" });
    expect(res.body.loan.closedAt).not.toBeNull();
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
    expect(await requestLoan(asset.tag, USERS.custodianB)).toBeGreaterThan(loanId);
  });

  it("decline answers 400 without remarks, and leaves the loan as it was", async () => {
    const { loanId } = await pendingLoanOn("TEST-0303");

    const res = await asLabHead.put(`/api/loans/${loanId}/decline`, { decisionRemarks: "  " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Write the reason for declining.");
    expect((await loanRow(loanId)).status).toBe("PENDING_APPROVAL");
  });

  it.each(["approve", "decline"])("%s answers 409 for a loan that is not Pending Approval, and changes nothing", async (step) => {
    const { loanId } = await pendingReleaseOn(`TEST-031${step === "approve" ? 1 : 2}`);

    const res = await asLabHead.put(`/api/loans/${loanId}/${step}`, { decisionRemarks: "Test remark" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`Loan ${loanId} is Pending Release, so it can no longer be decided.`);
    expect((await loanRow(loanId)).status).toBe("PENDING_RELEASE");
  });

  it("approve answers 409 when the asset is no longer Available; decline still closes the loan", async () => {
    const { asset, loanId } = await pendingLoanOn("TEST-0304");
    await db.assets.update({ where: { asset_id: asset.assetId }, data: { status: "MAINTENANCE" } });

    const approve = await asLabHead.put(`/api/loans/${loanId}/approve`, {});
    expect(approve.status).toBe(409);
    expect(approve.body.error).toBe("TEST-0304 is Maintenance and cannot have a loan approved.");
    expect((await loanRow(loanId)).status).toBe("PENDING_APPROVAL");

    const decline = await asLabHead.put(`/api/loans/${loanId}/decline`, { decisionRemarks: "Test: in maintenance" });
    expect(decline.status).toBe(200);
    expect((await loanRow(loanId)).status).toBe("DECLINED");
  });

  it("lets exactly one of an approval and a cancel at the same moment win; the other answers 409", async () => {
    const { loanId } = await pendingLoanOn("TEST-0305");

    const [approve, cancel] = await Promise.all([
      asLabHead.put(`/api/loans/${loanId}/approve`, {}),
      asCustodian.put(`/api/loans/${loanId}/cancel`, {}),
    ]);

    expect([approve.status, cancel.status].sort()).toEqual([200, 409]);
    expect((await loanRow(loanId)).status).toBe(approve.status === 200 ? "PENDING_RELEASE" : "CANCELLED");
  });

  it("answers 404 for an unknown loan, and 400 for an id that is not a number", async () => {
    expect((await asLabHead.put("/api/loans/999999/approve", {})).status).toBe(404);
    expect((await asLabHead.put("/api/loans/LOAN-1/decline", { decisionRemarks: "Test" })).status).toBe(400);
  });
});

/** What TSG sends to release or receive: one inspection. */
const inspectionBody = (extra: Record<string, unknown> = {}) => ({
  inspection: { condition: "OPERATIONAL", healthScore: 80, remarks: "Test inspection remark", ...extra },
});

const inspectionsOf = (assetId: number, type: "LOAN_RELEASE" | "RETURN") => db.asset_inspections.findMany({ where: { asset_id: assetId, type } });

describe("PUT /api/loans/:id/release", () => {
  it("TSG releases: a Loan Release inspection by TSG, the loan and the asset On Loan, held by the borrower at the destination", async () => {
    const { asset, loanId } = await pendingReleaseOn("TEST-0401");

    const res = await asStaff.put(`/api/loans/${loanId}/release`, inspectionBody());

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({
      status: "ON_LOAN",
      statusLabel: "On Loan",
      releasedBy: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName },
      releaseInspection: {
        type: "LOAN_RELEASE",
        typeLabel: "Loan Release",
        inspectedBy: { userId: USERS.staffTsg.userId },
        condition: "OPERATIONAL",
        conditionLabel: "Operational",
        healthScore: 80,
        remarks: "Test inspection remark",
        metrics: [],
      },
      isOverdue: false,
    });
    expect(res.body.loan.releasedAt).not.toBeNull();
    const [inspection] = await inspectionsOf(asset.assetId, "LOAN_RELEASE");
    expect(inspection).toMatchObject({ inspected_by_id: USERS.staffTsg.userId, condition: "OPERATIONAL" });
    expect((await loanRow(loanId)).release_inspection_id).toBe(inspection.inspection_id);
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
    expect(await listedAsset(asset.tag)).toMatchObject({
      holder: { userId: USERS.custodianA.userId },
      currentLocation: `${LAB.shortCode}, Test Room 1`,
      condition: "OPERATIONAL",
    });
  });

  it.each([USERS.custodianA, USERS.labHead, USERS.secretary, USERS.admin])("answers 403 to $lastName, and writes nothing", async (user) => {
    const { asset, loanId } = await pendingReleaseOn(`TEST-041${user.userId}`);

    const res = await as(user).put(`/api/loans/${loanId}/release`, inspectionBody());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(FORBIDDEN);
    expect((await loanRow(loanId)).status).toBe("PENDING_RELEASE");
    expect(await inspectionsOf(asset.assetId, "LOAN_RELEASE")).toHaveLength(0);
  });

  it("answers 409 for a loan that is not Pending Release, and writes nothing", async () => {
    const { asset, loanId } = await pendingLoanOn("TEST-0402");

    const res = await asStaff.put(`/api/loans/${loanId}/release`, inspectionBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`Loan ${loanId} is Pending Approval, so it can no longer be released.`);
    expect(await inspectionsOf(asset.assetId, "LOAN_RELEASE")).toHaveLength(0);
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
  });

  it("answers 409 when the asset is no longer Available, and writes nothing", async () => {
    const { asset, loanId } = await pendingReleaseOn("TEST-0403");
    await db.assets.update({ where: { asset_id: asset.assetId }, data: { status: "MISSING" } });

    const res = await asStaff.put(`/api/loans/${loanId}/release`, inspectionBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TEST-0403 is Missing and cannot be released on a loan.");
    expect((await loanRow(loanId)).status).toBe("PENDING_RELEASE");
    expect(await inspectionsOf(asset.assetId, "LOAN_RELEASE")).toHaveLength(0);
  });

  it("gives one release to two at the same moment: one 200, one 409, and one inspection", async () => {
    const { asset, loanId } = await pendingReleaseOn("TEST-0404");
    const asStaffIts = as(USERS.staffIts);
    await asStaffIts.get("/api/auth/me");

    const results = await Promise.all([
      asStaff.put(`/api/loans/${loanId}/release`, inspectionBody()),
      asStaffIts.put(`/api/loans/${loanId}/release`, inspectionBody()),
    ]);

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await inspectionsOf(asset.assetId, "LOAN_RELEASE")).toHaveLength(1);
  });

  it("files the metric values of the asset's category, each flagged by its rule", async () => {
    const { asset, loanId } = await pendingReleaseOn("TEST-0405");
    await db.assets.update({ where: { asset_id: asset.assetId }, data: { category: "CPU" } });

    const res = await asStaff.put(`/api/loans/${loanId}/release`, inspectionBody({ metrics: [{ metricId: 3, value: 65 }, { metricId: 1, value: 50 }] }));

    expect(res.status).toBe(200);
    expect(res.body.loan.releaseInspection.metrics).toEqual([
      { metricId: 1, metricKey: "CPU_LOAD_TEMP", name: "CPU load temperature", unit: "°C", value: 50, flagged: false },
      { metricId: 3, metricKey: "BATTERY_CAPACITY", name: "Battery capacity", unit: "% of design", value: 65, flagged: true },
    ]);
    const [inspection] = await inspectionsOf(asset.assetId, "LOAN_RELEASE");
    expect(await db.asset_inspection_metrics.count({ where: { inspection_id: inspection.inspection_id } })).toBe(2);
  });

  it("answers 400 for a metric the asset's category does not measure, and writes nothing", async () => {
    const { asset, loanId } = await pendingReleaseOn("TEST-0406");

    const res = await asStaff.put(`/api/loans/${loanId}/release`, inspectionBody({ metrics: [{ metricId: 1, value: 40 }] }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("That measurement does not apply to this asset.");
    expect((await loanRow(loanId)).status).toBe("PENDING_RELEASE");
    expect(await inspectionsOf(asset.assetId, "LOAN_RELEASE")).toHaveLength(0);
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
  });

  it.each([
    ["no inspection", {}, "Missing required field: inspection."],
    ["an unknown condition", inspectionBody({ condition: "BROKEN" }), "Pick the condition of the inspection from the list."],
    ["metrics that are not a list", inspectionBody({ metrics: { metricId: 1, value: 1 } }), "metrics must be a list of { metricId, value }."],
    ["the same metric twice", inspectionBody({ metrics: [{ metricId: 3, value: 80 }, { metricId: 3, value: 81 }] }), "Send each metric only once."],
  ])("answers 400 for %s, and changes nothing", async (_what, body, message) => {
    const res = await asStaff.put(`/api/loans/${SEEDED_ROWS.pendingLoanId}/release`, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect((await loanRow(SEEDED_ROWS.pendingLoanId)).status).toBe("PENDING_APPROVAL");
  });

  it("answers 404 for an unknown loan", async () => {
    expect((await asStaff.put("/api/loans/999999/release", inspectionBody())).status).toBe(404);
  });
});

/** A new asset with a loan of Custodian A released by TSG, so it is On Loan and held by Custodian A. */
async function onLoanOn(tag: string) {
  const { asset, loanId } = await pendingReleaseOn(tag);
  expect((await asStaff.put(`/api/loans/${loanId}/release`, inspectionBody())).status).toBe(200);
  return { asset, loanId };
}

describe("PUT /api/loans/:id/return-request", () => {
  it("the borrower asks to return: Return Requested with the time and the remarks; the asset stays On Loan, held by the borrower", async () => {
    const { asset, loanId } = await onLoanOn("TEST-0501");

    const res = await asCustodian.put(`/api/loans/${loanId}/return-request`, { remarks: "  Test: done with it  " });

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ status: "RETURN_REQUESTED", statusLabel: "Return Requested", remarks: "Test: done with it", closedAt: null });
    expect(res.body.loan.returnRequestedAt).not.toBeNull();
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: { userId: USERS.custodianA.userId }, currentLocation: `${LAB.shortCode}, Test Room 1` });
  });

  it("answers 403 to someone who is not the borrower, and leaves the loan as it was", async () => {
    const { loanId } = await onLoanOn("TEST-0502");

    const res = await asCustodianB.put(`/api/loans/${loanId}/return-request`, {});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Only the borrower can ask to return this loan.");
    expect((await loanRow(loanId)).status).toBe("ON_LOAN");
  });

  it("answers 409 for a loan that is not On Loan, and leaves it as it was", async () => {
    const { loanId } = await pendingReleaseOn("TEST-0503");

    const res = await asCustodian.put(`/api/loans/${loanId}/return-request`, {});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`Loan ${loanId} is Pending Release, so a return cannot be requested.`);
    expect((await loanRow(loanId)).status).toBe("PENDING_RELEASE");
  });

  it("answers 400 for remarks over 255 characters, and leaves the loan as it was", async () => {
    const { loanId } = await onLoanOn("TEST-0504");

    const res = await asCustodian.put(`/api/loans/${loanId}/return-request`, { remarks: "x".repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Remarks must be at most 255 characters.");
    expect((await loanRow(loanId)).status).toBe("ON_LOAN");
  });
});

describe("PUT /api/loans/:id/receive", () => {
  const maintenanceOf = (assetId: number) => db.asset_maintenance.findMany({ where: { asset_id: assetId } });

  it("receives a Return Requested loan: a Return inspection by TSG, the loan Returned and closed, the asset Available at home", async () => {
    const { asset, loanId } = await onLoanOn("TEST-0601");
    expect((await asCustodian.put(`/api/loans/${loanId}/return-request`, {})).status).toBe(200);

    const res = await asStaff.put(`/api/loans/${loanId}/receive`, inspectionBody({ condition: "MINOR_DRIFT", remarks: "Test: a small scratch" }));

    expect(res.status).toBe(200);
    expect(res.body.maintenance).toBeUndefined();
    expect(res.body.loan).toMatchObject({
      status: "RETURNED",
      receivedBy: { userId: USERS.staffTsg.userId },
      returnInspection: { type: "RETURN", condition: "MINOR_DRIFT", remarks: "Test: a small scratch", inspectedBy: { userId: USERS.staffTsg.userId } },
      isOverdue: false,
    });
    expect(res.body.loan.closedAt).not.toBeNull();
    expect(res.body.loan.returnRequestedAt).not.toBeNull();
    const [inspection] = await inspectionsOf(asset.assetId, "RETURN");
    expect((await loanRow(loanId)).return_inspection_id).toBe(inspection.inspection_id);
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: null, currentLocation: LAB.shortCode, condition: "MINOR_DRIFT" });
    expect(await maintenanceOf(asset.assetId)).toHaveLength(0);
  });

  it("receives a walk-in return straight from On Loan, with no return request recorded", async () => {
    const { asset, loanId } = await onLoanOn("TEST-0602");

    const res = await asStaff.put(`/api/loans/${loanId}/receive`, inspectionBody());

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ status: "RETURNED", returnRequestedAt: null });
    expect(await assetStatus(asset.assetId)).toBe("AVAILABLE");
  });

  it("with return damage: a Return Damage ticket in Inspecting, received by TSG and triggered by the Return inspection; the asset in Maintenance", async () => {
    const { asset, loanId } = await onLoanOn("TEST-0603");

    const res = await asStaff.put(`/api/loans/${loanId}/receive`, {
      ...inspectionBody({ condition: "DEGRADED" }),
      returnDamage: { issueTypeId: 1, issueDescription: "Test: the screen is cracked" },
    });

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe("RETURNED");
    const [ticket] = await maintenanceOf(asset.assetId);
    const [inspection] = await inspectionsOf(asset.assetId, "RETURN");
    expect(ticket).toMatchObject({
      type: "RETURN_DAMAGE",
      status: "INSPECTING",
      reported_by_id: USERS.staffTsg.userId,
      received_by_id: USERS.staffTsg.userId,
      trigger_inspection_id: inspection.inspection_id,
      issue_type_id: 1,
      issue_description: "Test: the screen is cracked",
    });
    expect(ticket.received_at).not.toBeNull();
    expect(res.body.maintenance).toMatchObject({ repairId: ticket.maintenance_id, assetId: asset.tag, statusLabel: "Inspection Phase", acknowledged: true });
    expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
    expect(await listedAsset(asset.tag)).toMatchObject({ holder: null, currentLocation: "TSG Office" });
  });

  it("answers 400 for an unknown issue type, and writes nothing", async () => {
    const { asset, loanId } = await onLoanOn("TEST-0604");

    const res = await asStaff.put(`/api/loans/${loanId}/receive`, { ...inspectionBody(), returnDamage: { issueTypeId: 999, issueDescription: "Test damage" } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Pick an issue type from the list.");
    expect((await loanRow(loanId)).status).toBe("ON_LOAN");
    expect(await inspectionsOf(asset.assetId, "RETURN")).toHaveLength(0);
    expect(await maintenanceOf(asset.assetId)).toHaveLength(0);
    expect(await assetStatus(asset.assetId)).toBe("ON_LOAN");
  });

  it.each([
    ["no issue type", { issueDescription: "Test damage" }, "Pick an issue type from the list."],
    ["no description", { issueTypeId: 1, issueDescription: " " }, "Describe the damage."],
  ])("answers 400 for return damage with %s, and changes nothing", async (_what, returnDamage, message) => {
    const res = await asStaff.put(`/api/loans/${SEEDED_ROWS.approvedLoanId}/receive`, { ...inspectionBody(), returnDamage });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect((await loanRow(SEEDED_ROWS.approvedLoanId)).status).toBe("ON_LOAN");
  });

  it.each([
    ["Pending Release", "TEST-0611"],
    ["Returned", "TEST-0612"],
  ])("answers 409 for a loan in %s, and writes nothing", async (label, tag) => {
    const { asset, loanId } = label === "Returned" ? await onLoanOn(tag) : await pendingReleaseOn(tag);
    if (label === "Returned") expect((await asStaff.put(`/api/loans/${loanId}/receive`, inspectionBody())).status).toBe(200);
    const inspectionsBefore = (await inspectionsOf(asset.assetId, "RETURN")).length;

    const res = await asStaff.put(`/api/loans/${loanId}/receive`, inspectionBody());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`Loan ${loanId} is ${label}, so it cannot be received.`);
    expect(await inspectionsOf(asset.assetId, "RETURN")).toHaveLength(inspectionsBefore);
  });

  it("gives one receipt to two at the same moment: one 200, one 409, and one Return inspection", async () => {
    const { asset, loanId } = await onLoanOn("TEST-0605");
    const asStaffIts = as(USERS.staffIts);
    await asStaffIts.get("/api/auth/me");

    const results = await Promise.all([
      asStaff.put(`/api/loans/${loanId}/receive`, inspectionBody()),
      asStaffIts.put(`/api/loans/${loanId}/receive`, inspectionBody()),
    ]);

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await inspectionsOf(asset.assetId, "RETURN")).toHaveLength(1);
  });

  it.each([USERS.custodianA, USERS.labHead, USERS.secretary, USERS.admin])("answers 403 to $lastName, and writes nothing", async (user) => {
    const before = await db.asset_inspections.count({ where: { type: "RETURN" } });

    const res = await as(user).put(`/api/loans/${SEEDED_ROWS.approvedLoanId}/receive`, inspectionBody());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(FORBIDDEN);
    expect((await loanRow(SEEDED_ROWS.approvedLoanId)).status).toBe("ON_LOAN");
    expect(await db.asset_inspections.count({ where: { type: "RETURN" } })).toBe(before);
  });

  it("answers 404 for an unknown loan", async () => {
    expect((await asStaff.put("/api/loans/999999/receive", inspectionBody())).status).toBe(404);
  });
});

describe("the replaced loan routes", () => {
  it("answer 404: POST /api/assets/:tag/borrow, PUT /api/loans/:id/decision, POST /api/assets/:tag/return, and GET /api/asset_returns", async () => {
    expect((await asCustodian.post(`/api/assets/${ASSETS.available.tag}/borrow`, { purpose: "Test", dueDate: inDays(5) })).status).toBe(404);
    expect((await asLabHead.put(`/api/loans/${SEEDED_ROWS.pendingLoanId}/decision`, { decision: "approve" })).status).toBe(404);
    expect((await asStaff.post(`/api/assets/${ASSETS.onLoan.tag}/return`, { condition: "OPERATIONAL" })).status).toBe(404);
    expect((await asStaff.get("/api/asset_returns")).status).toBe(404);
    expect((await loanRow(SEEDED_ROWS.approvedLoanId)).status).toBe("ON_LOAN");
  });
});
