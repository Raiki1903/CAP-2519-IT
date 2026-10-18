# 01. UAT Fix Log

Running record of the bug fixes before user acceptance testing (UAT) on **2026-10-21**. Code freeze: **Tuesday 2026-10-20, 6 pm**.
The restructure is complete (PR #100); its record is [../phase-1c-restructure/02-restructure-log.md](../phase-1c-restructure/02-restructure-log.md). The rules are in [../../AGENTS.md](../../AGENTS.md).

One section per fix branch, each from a fresh `main`, in two stops: stop 1 is the plan (docs only), stop 2 is the build after Raiki's answers. Each behavior change is its own commit, marked with `!`, with its tests in the same commit. Teammates fix frontend issues in parallel (#35, #47, #55, #62, #63, #88), so each section says which of their files it touches. Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

Baseline on `main` at `1ce2aaa3` (the PR #101 merge): typecheck **65** errors, `npm run build` passes, `npm test` **391** passed.

---

## Status

| Group | Branch | Issues | Status | Commits | Typecheck | Tests | Date |
|---|---|---|---|---|---|---|---|
| A | `fix/h05-state-guards` | #51, #54, #28, #53, #69 (and part of #88, if question 4 says so) | Stop 1: plan written, waiting for Raiki's answers | Plan: this docs commit | 65 (no change expected) | 391 now; 410 planned (408 without the #88 part) | 2026-10-18 |

---

## Group A: state guards (fix/h05-state-guards)

The server refuses actions that make no sense for an asset's current status. Branch `fix/h05-state-guards` from `main` at `1ce2aaa3`. No schema change: every fix reads rows that exist today.

**Commits since the restructure merge (`17e58456`):** two. `53176352` adds `AGENTS.md` and `CLAUDE.md` (docs only). `3911d83d` (issue #60, merged in PR #101) adds a `.catch` to `notifyDirector` and `notifyDecision` in `server/features/disposals/disposals.service.ts` and to `notifyDecision` in `server/features/transfers/transfers.service.ts`. Both files are in this plan, but none of the planned lines is one PR #101 changed. The comments above those three functions still say nothing catches the lookup; deleting them is in the stop 2 docs commit (section 5, commit 7).

### 1. Where the code is now, and the change

Line numbers are on `main` at `1ce2aaa3`.

#### #51: a disposed asset can be returned and comes back as ACTIVE

**Now.** `POST /api/assets/:assetTag/return` (Staff) runs `finalizeReturn` in [returns.controller.ts:19](../../server/features/returns/returns.controller.ts#L19), which checks the condition (`checkReturnInput`, 400) and calls `finalizeReturn` in [returns.service.ts:28](../../server/features/returns/returns.service.ts#L28). The service checks only that the tag exists (404), reads the newest record for the returner (line 39), and always appends an ACTIVE record under the placeholder `POOL_CUSTODIAN_ID` (`turnInRecord`, line 66). Nothing reads the status, so a Disposed asset, an asset under repair, or an asset nobody holds is "returned" and becomes Active. A second, stale request for an asset already returned is accepted the same way and writes a second return. The defect is marked at line 26 (`TODO(H-05)`).

**Change.** In the service, after the 404 check, read the newest record (the read at line 39, moved up) and refuse with **409** unless the asset is out:

| The newest record says | Answer | Message |
|---|---|---|
| ON_LOAN (held by anyone, the placeholder included) | 200, as now | |
| ACTIVE, held by a real person (not `POOL_CUSTODIAN_ID`) | 200, as now (question 1, b) | |
| ACTIVE, held by the placeholder, or no record at all | 409 | `<tag> is not out with anyone, so there is nothing to return.` |
| MAINTENANCE | 409 | `<tag> is under maintenance and cannot be returned until its repair is finished.` |
| DISPOSED | 409 | `<tag> is disposed and cannot be returned.` |

The condition check (400) still runs first, in the controller, so a bad body answers 400 as now. The returner rule and the record written are unchanged. A same-second tie between two records can still be read in the wrong order (`TODO(M-09)` stays), and the check and the write are not one atomic step (a new `TODO(H-05)`, Phase 3 triggers, like the custody request guard). The TSDoc of the controller and service gains the 409. This lands before issue #99 (Staff "Record Return"), which builds on it.

**What the screen shows.** Pending Returns (Staff), Evaluate and Finalize: the 409 message appears in the amber box under "Return Ledger Closed": "Logged locally, but couldn't reach the database to finalize this return: <message>". `ReturnForm.tsx` (lines 111 to 135) also marks the browser's request Finalized even when the server refused, so it leaves the list. The heading and the wording are wrong for a refusal. See question 5.

#### #54: disposals have no duplicate or status guard

**Now.** `POST /api/assets/:assetTag/disposal` (Staff) runs `requestDisposal` in [disposals.service.ts:28](../../server/features/disposals/disposals.service.ts#L28). After the 404 check it inserts a pending `asset_disposals` row (line 50). No status or duplicate check (`TODO(H-05)`, line 27). So a second pending disposal is accepted (approving both writes two DISPOSED records), and an asset on loan, under maintenance, or already disposed can be put up for disposal. The issue #25 guard, `findCustodyRequestConflict` in [custodyRequestGuard.ts:21](../../server/shared/services/custodyRequestGuard.ts#L21), already does this for loans (`loans.service.ts:119`, allowed: ACTIVE) and transfers (`transfers.service.ts:53`, allowed: ACTIVE, ON_LOAN), but it knows nothing about disposals.

**Change.** Make a pending disposal one more kind of pending request in the guard, and call the guard from the disposal request:

- `disposals.repository.ts`: a new `findPendingDisposalId(assetId)`, like `findPendingLoanId` and `findPendingTransferId`.
- `custodyRequestGuard.ts`: the guard reads it with the other two and refuses with `<tag> already has a pending disposal request (DISP-<n>).` It then applies to every kind: one pending loan, transfer, or disposal per asset.
- `disposals.service.ts`: `requestDisposal` calls `findCustodyRequestConflict(existing, ["ACTIVE"])` after the 404 check and throws **409** with the guard's message.

Messages a disposal request can now get (the first that applies):

| Case | Message |
|---|---|
| A pending loan | `<tag> already has a pending loan request (LOAN-<n>).` (existing text) |
| A pending transfer | `<tag> already has a pending transfer request (TRF-<n>).` (existing text) |
| A pending disposal | `<tag> already has a pending disposal request (DISP-<n>).` (new) |
| On loan, under maintenance, disposed | `<tag> is on loan and cannot take this request.` (or `is under maintenance`, `is disposed`; existing text) |

Because the guard is shared, **a loan or transfer request on an asset with a pending disposal is also refused** (409, the "pending disposal" message). That is the same rule seen from the other side, and it closes one way into #28. Question 6 asks whether to keep it in this one commit.

**What the screen shows.** Asset Inventory (Staff), Decommission: the Disposal dialog already shows `data.error` in red under the form (`DisposalFormDialog.tsx:112`) and keeps the dialog open. No screen change. Custodian loan and transfer forms already show the guard's 409s (issue #25).

#### #28: decommissioned assets still have a transfer request

**Now.** The report: an asset with a pending transfer was disposed, and the transfer stayed pending and could still be approved. Three things allow it on `1ce2aaa3`:

1. A disposal can be filed while a transfer is pending (#54 above).
2. A transfer (or loan) can be filed while a disposal is pending: the guard does not know disposals.
3. No approval looks at the asset: `decideTransfer` in [transfers.service.ts:186](../../server/features/transfers/transfers.service.ts#L186), `decideLoan` in [loans.service.ts:149](../../server/features/loans/loans.service.ts#L149), and `decideDisposal` in [disposals.service.ts:129](../../server/features/disposals/disposals.service.ts#L129) check only that the request is pending. So an old pending transfer on a disposed asset, as in the report and as CCS Cloud may still hold, is approved and writes an ON_LOAN record after the DISPOSED one: the disposed asset is "on loan" again.

**Change.** The #54 commit closes 1 and 2 for new requests. This commit closes 3: an **approval** checks the asset again, with the same allowed statuses as its request. A decline or reject is always allowed, so stale rows can be cleaned up.

- `custodyRequestGuard.ts`: a second function, `findDecisionConflict(asset, allowedStatuses, kind)`, reads the newest record status (the guard's ordering) and answers a message or null.
- `decideLoan` (allowed ACTIVE), `decideTransfer` (ACTIVE, ON_LOAN), `decideDisposal` (ACTIVE): on "approve" only, after the existing 404 and 400 checks, read the asset by id and throw **409** on a conflict.
- `decideDisposal` also refuses while the asset has a pending loan or transfer (question 2, a). After this branch that happens only with old rows or two clicks in the same instant.

| Case | Message |
|---|---|
| Loan or transfer approval, asset no longer allowed | `<tag> is disposed now, so this transfer can only be declined.` (or `is under maintenance now`, `this loan`) |
| Disposal approval, asset no longer Active | `<tag> is on loan now, so this disposal can only be rejected.` (or `under maintenance`, `disposed`) |
| Disposal approval, a pending loan or transfer | `<tag> has a pending transfer request (TRF-<n>). It must be approved or declined before this disposal can be approved.` (or `loan request (LOAN-<n>)`) |

The check reads outside the decision's transaction, so two approvals in the same instant can still both pass (`TODO(H-05)`, Phase 3 triggers).

**What the screen shows.** Custody Transitions (Lab Head): the red error line above the loan and transfer tables (`loanError`, `transferError`) shows the message. Approvals and Holds (Director): the red line above the disposal queue (`dbDisposalsError`). The bell (`NotificationCenter.tsx`, lines 558 and 572) and the Lab Head analytics panel's quick buttons (`LabHeadAnalyticsView.tsx`, lines 94 and 108) only log a refusal to the console; the card stays, with no message. The bell belongs to the bell rewrite (issues #55 and #57, a teammate), so this branch does not change it; the issue owner should know the bell can now get these 409s.

#### #53: an inspection with an unknown condition is saved as PERFECT

**Now.** `POST /api/assets/:assetTag/inspection` (Custodian, Staff) runs `fileReport` in [inspections.controller.ts:19](../../server/features/inspections/inspections.controller.ts#L19) with no validation, then `fileReport` in [inspections.service.ts:27](../../server/features/inspections/inspections.service.ts#L27), which after the asset lookup calls `readInspectionReport` in [inspections.validation.ts:36](../../server/features/inspections/inspections.validation.ts#L36). That function maps the stored names and the display names (`conditionMap`, line 11) and turns anything else, or nothing, into PERFECT (line 38, `TODO(H-07)` at line 33). The report is saved and the PERFECT condition is written onto the asset, with 200.

**Change.** A new `checkInspectionReport(data)` in `inspections.validation.ts`, called by the controller before the service (as the return route does). The condition is `reportCondition`, else `assetCondition`, as now.

| Case | Answer | Message |
|---|---|---|
| Neither field sent | 400, nothing written | `Missing required field: reportCondition.` |
| Not one of `ASSET_CONDITIONS` (`shared/enums/assetCondition.ts`): a typo, lower case, the stored spelling with a space, or a display name such as "Degraded Performance" (question 3, a) | 400, nothing written | `Unrecognized condition: <value>.` (the return route's wording) |
| One of the five | 200, as now | |

`readInspectionReport` then takes the checked value as it is; `conditionMap` and the PERFECT fallback go. The remarks and image fallbacks stay. Because the check moves before the asset lookup, a bad body for an unknown tag answers 400 instead of 404. The file headers and TSDoc that say "nothing is refused here" are corrected in the same commit. The same PERFECT fallback in the asset edit (`assets.service.ts`, the `conditionMap` in `updateAsset`) is not this issue and stays (noted below).

**What the screen shows.** Nothing changes. Inspection Manager (Staff, `InspectionQueue.tsx:324`) and Send Inspection Report (Custodian, `CustodianPortal.tsx:344`) both turn their labels into one of the five stored names before posting, so neither can send a refused value. Neither reads the answer (`TODO(H-16)` in both), so a 400 would not show; that stays for the web fixes.

#### #69: an asset with any report cannot be deleted

**Now.** `DELETE /api/assets/:assetTag` (Staff) runs `deleteAsset` in [assets.service.ts:518](../../server/features/assets/assets.service.ts#L518), then `deleteWithHistory` in [assets.repository.ts:227](../../server/features/assets/assets.repository.ts#L227), which deletes the rows of seven tables and then the asset, in one transaction. `asset_reports` is not among them, so its foreign key (`fk_reports_asset`, no cascade) makes the last delete fail; the transaction rolls back (nothing is deleted) and the answer is the generic **500**, "Something went wrong on the server. Please try again." Every condition report (Send Inspection Report), every inspection (Inspection Manager), and every Edit Asset save that sends a condition or remarks adds an `asset_reports` row, so most assets in use cannot be deleted.

**Change.** In the service, after the 404 check, count the asset's reports (a new `countReports(assetId)` in `assets.repository.ts`). If there is one or more, throw **409**:
`<tag> cannot be deleted because it has inspection or condition reports, which are part of its history. To take it out of use, file a disposal instead.`
Nothing is deleted, as now. An asset with no reports is deleted as now, whatever its status (no new status rule for delete). Keeping history on delete (a soft delete or "retire") is a later database change, not this branch; `TODO(H-03)` keeps that part.

**What the screen shows.** Asset Inventory (Staff), Delete, Confirm Asset Deletion: the dialog already shows the server's message in red ("⚠️ <message>") and stays open (`DeleteAssetDialog.tsx`). The message changes from the generic one to the reason. No screen change.

### 2. Allowed statuses per action

Statuses are the newest `asset_records` row's. "Pending" means a pending loan, transfer, or disposal on the same asset. Every refusal is **409**, after the existing 400 and 404 checks.

| Action | Endpoint | Allowed on `1ce2aaa3` | Allowed after group A |
|---|---|---|---|
| Return (finalize) | `POST /api/assets/:tag/return` | Any status | On Loan; or Active and held by a real person (question 1). Not Active in the pool, no record, Maintenance, Disposed |
| Disposal request | `POST /api/assets/:tag/disposal` | Any status, any number pending | Active, with nothing pending |
| Disposal approval | `PUT /api/asset_disposals/:id/decision`, approve | Any status | Active, with no pending loan or transfer (question 2) |
| Disposal reject | same, reject | Any status | Unchanged: any status |
| Loan request | `POST /api/assets/:tag/borrow` | Active, no pending loan or transfer (issue #25) | Also no pending disposal |
| Transfer request | `POST /api/assets/:tag/transfer` | Active or On Loan, no pending loan or transfer (issue #25) | Also no pending disposal |
| Loan approval | `PUT /api/asset_loans/:id/decision`, approve | Any status | Active |
| Transfer approval | `PUT /api/asset_transfers/:id/decision`, approve | Any status | Active or On Loan |
| Loan or transfer decline | same, decline | Any status | Unchanged: any status |
| Inspection report | `POST /api/assets/:tag/inspection` | Any status, any condition | Any status, one of the five conditions. With question 4 (b): not Disposed |
| Delete | `DELETE /api/assets/:tag` | Any status; 500 if it has reports | Any status, only with no reports |

**What happens to pending requests when an asset is disposed (#28).** After this branch, a disposal can be filed only when nothing else is pending, and nothing new can be filed while it is pending, so at approval there is normally nothing left over. Old rows (filed before this branch, as on CCS Cloud) are handled at decision time: the Director's approval is refused while a loan or transfer is still pending (the Lab Head decides it first); once the asset is Disposed, approving a pending loan, transfer, or second disposal on it is refused, and declining or rejecting it still works. Nothing is changed automatically. Hand check H13 lists any such rows on CCS Cloud, read-only, so the team knows what UAT may meet.

### 3. Tests

`npm test` runs after every commit. The typecheck stays at **65** (no new types).

| Commit | Test file | Change | Count after |
|---|---|---|---|
| 1 (#51) | `tests/api/returns.test.ts` | "accepts a return for an asset that is not on loan, and makes a disposed asset ACTIVE again (known defect H-05)" becomes "answers 409 for an asset that is $case, and writes nothing (issue #51)", 4 cases: disposed, under maintenance, Active in the pool, no record (+3) | |
| | | New: "answers 409 to a second return of the same asset, and writes nothing more (a stale request, issue #51)" (+1) | |
| | | New: "accepts an Active asset a custodian holds, and files the return under that custodian" (+1; with question 1 (a) it is a fifth 409 case instead, same count) | |
| | `tests/api/sessionUser.test.ts` | "records the Staff member as returner of an asset with no record, since nobody holds it" now gets a 409, so its asset becomes "on loan under the placeholder"; same check on the returner, same count | **396** |
| 2 (#54) | `tests/api/disposals.test.ts` | "accepts a disposal request for an asset that is $status (known defect H-05)" (3 cases) becomes "answers 409 for an asset that is $status, and writes nothing (issue #54)" (3 cases) | |
| | | "accepts a second pending disposal on the same asset (known defect H-05)" becomes "answers 409 to a second disposal request while one is pending (issue #54)" | |
| | | New: "answers 409 for an asset with a pending loan request" (+1) and "answers 409 for an asset with a pending transfer request (issue #28)" (+1) | |
| | | "approve: disposes of an asset that is on loan..." and "approving both of two pending disposals..." can no longer file their requests through the API, so their pending rows are written straight to the test database (as old data would be). They still pin the approval side until commit 3; same count | |
| | `tests/api/loans.test.ts`, `tests/api/transfers.test.ts` | New in each: "answers 409 while the asset has a pending disposal request (issue #54)" (+2) | **400** |
| 3 (#28) | `tests/api/disposals.test.ts` | "approve: disposes of an asset that is on loan, under its borrower... (known defect H-05)" becomes "approve: answers 409 for an asset that is $status now, and writes nothing (issue #28)", 2 cases: on loan, under maintenance (+1) | |
| | | "approving both of two pending disposals on one asset adds two DISPOSED records (known defect H-05)" becomes "approving the second of two old pending disposals answers 409: one DISPOSED record (issue #28)" | |
| | | New: "approve: answers 409 while the asset has a pending transfer, naming it (issue #28)" (+1) and "reject: still works on an asset that is no longer Active" (+1) | |
| | `tests/api/transfers.test.ts` | New: "approve: answers 409 when the asset is $status now, and writes nothing (issue #28)", 2 cases: under maintenance, disposed (+2); "decline: still works on a disposed asset" (+1) | |
| | `tests/api/loans.test.ts` | New: the same approve test for loans, 2 cases (+2) | **408** |
| 4 (#53) | `tests/api/inspections.test.ts` | "maps the condition '$sent' to $stored on the report and the record" (6 cases) becomes "stores the condition $sent on the report and the record" (the 5 stored names, -1) | |
| | | "stores PERFECT for $case, overwriting the asset's condition" (4 cases) becomes "answers 400 for $case, and writes nothing (issue #53)", 5 cases: unknown, lower case, the spelling with a space, a display name, no condition (+1). With question 3 (b) the mapping test keeps its 6 and the 400 test has 4; same count | **408** |
| 5 (#88, if question 4 is b) | `tests/api/inspections.test.ts` | New: "answers 409 for a disposed asset, and writes nothing (issue #88)" (+1) and "accepts an asset under maintenance" (+1) | **410** |
| 6 (#69) | `tests/api/assets.test.ts` | "cannot delete an asset that has an inspection report: answers 500 with a generic message and no database text, and deletes nothing (known defect H-03; H-16 fixed)" becomes "answers 409 for an asset with an inspection report, says why, and deletes nothing (issue #69)"; same count. The generic 500 stays pinned elsewhere (`repairs.test.ts`, `transfers.test.ts`) | **410** |
| 7 (docs) | none | | **410** |

Checked: the role table test (`tests/api/session.test.ts`, rows 13, 14, 17, 27) accepts any answer other than 401 and 403 for an allowed role, so the earlier 400 for an empty inspection body does not break it. `tests/api/analytics.test.ts` returns an ON_LOAN asset, so its H-04 test is unaffected. The disposal rows `analytics.test.ts` and `disposals.test.ts` write straight to the database are removed in their own `finally` blocks and are on assets no loan or transfer test uses while they exist; stop 2 confirms it with the full run.

### 4. Screens and roles that see a difference

| Screen (role) | Issue | What changes | Screen change needed? |
|---|---|---|---|
| Pending Returns (Staff) | #51 | A return for an asset that is not out is refused; the reason shows in the amber box | Yes, but in #99 (question 5): today the screen still says "Return Ledger Closed" and drops the request |
| Asset Inventory (Staff), Decommission | #54, #28 | A disposal is refused with the reason, in red, dialog stays open | No |
| Asset Inventory (Staff), Delete | #69 | The reason instead of "Something went wrong on the server" | No |
| Custody Transitions (Lab Head) | #28 | Approving a loan or transfer on an asset that is no longer allowed shows the reason in the red line; Decline works | No |
| Approvals and Holds (Director) | #28 | Approving a disposal on an asset that is no longer Active, or that still has a pending loan or transfer, shows the reason in the red line; Reject works | No |
| The bell (Lab Head, Director) | #28 | The same refusals, but the bell shows nothing and keeps the card | Yes, in the bell rewrite (#55, #57, a teammate) |
| Custodian loan and transfer forms (Available Equipment, My Assets, the asset modal) | #54 | Refused while a disposal is pending, with the issue #25 message style | No |
| Inspection Manager (Staff), Send Inspection Report (Custodian) | #53 | Nothing visible: both send only the five stored names | No |

**Teammates' files.** This branch changes only `server/` and `tests/` files, none in `web/`. Overlaps to know about:
- **#88** (Send Inspection Report lists assets under maintenance): its plan in the restructure log includes a status check on the inspection route, which is `server/features/inspections/` and `tests/api/inspections.test.ts`, the same files as #53 here. Question 4.
- **#55 and #57** (the bell): no shared file, but the bell will receive the new 409s (above).
- **#62 and #63** (`InspectionQueue.tsx`), **#47** (the registration wizard): no shared file.
- **#35**: I cannot read GitHub and the docs do not describe it, so I do not know its files. If it touches `server/` or `tests/api/`, please tell me.
- Not a teammate's, but next: **#99** rebuilds the Staff return flow in `ReturnForm.tsx`, which this branch leaves alone.

### 5. Stop 2 plan

On `fix/h05-state-guards`, in this order. After each commit: `npm run typecheck` (65), `npm test` (the count above). Commit, never push.

| # | Commit message | Files |
|---|---|---|
| 1 | `fix(returns)!: refuse a return for an asset that is not out (#51)` | `server/features/returns/returns.service.ts`, `returns.controller.ts` (TSDoc), `tests/api/returns.test.ts`, `tests/api/sessionUser.test.ts` |
| 2 | `fix(disposals)!: one pending request per asset, disposals included (#54)` | `server/shared/services/custodyRequestGuard.ts`, `server/features/disposals/disposals.repository.ts`, `disposals.service.ts`, `disposals.controller.ts` (TSDoc), the TSDoc of `requestLoan` and `requestTransfer`, `tests/api/disposals.test.ts`, `loans.test.ts`, `transfers.test.ts` |
| 3 | `fix(custody)!: an approval checks the asset's status again (#28)` | `custodyRequestGuard.ts`, `server/features/loans/loans.service.ts`, `transfers/transfers.service.ts`, `disposals/disposals.service.ts`, the three controllers' TSDoc, the three test files |
| 4 | `fix(inspections)!: refuse an unknown or missing condition (#53)` | `server/features/inspections/inspections.validation.ts`, `inspections.controller.ts`, `inspections.service.ts`, the header of `shared/enums/assetCondition.ts` (its "Imported by" list), `tests/api/inspections.test.ts` |
| 5 | `fix(inspections)!: refuse a report for a disposed asset (#88)`, only if question 4 is (b) | `inspections.service.ts`, `tests/api/inspections.test.ts` |
| 6 | `fix(assets)!: answer 409, not 500, when an asset with reports is deleted (#69)` | `server/features/assets/assets.service.ts`, `assets.repository.ts`, `assets.controller.ts` (TSDoc), `tests/api/assets.test.ts` |
| 7 | `docs(group A): record the build, drop the stale email lookup comments` | Comment lines only: `disposals.service.ts` lines 67 and 68 (above `notifyDirector`) and line 170 (above `notifyDecision`), `transfers.service.ts` lines 235 and 236 (above `notifyDecision`), all saying nothing catches the lookup, untrue since PR #101. Docs: this log ("Stop 2: what was built", the hand check results), `docs/README.md`, `docs/HANDOFF.md` |

Each fix removes the `TODO` line that describes its defect (returns.service.ts:26, disposals.service.ts:27, inspections.validation.ts:33, and the `asset_reports` half of assets.service.ts:517 and assets.repository.ts:226) and adds a `TODO(H-05)` where a check is not atomic. Then `npm run build`, and the hand checks below (the agent's on the local test database). Then the report, and stop.

### 6. Hand checks

#### Group A hand checks

**H1 to H12 and H14: the agent, in a browser (Playwright MCP), on the local test database `AdRIC_DB_test` only**, after stop 2. Before starting: stop any `npm run dev:all` and make sure ports 4000 and 5173 are free. A start script outside the repository (`%TEMP%\adric-groupA-handchecks\start.mts`, built on 13c's) empties and seeds the test database with the test harness, adds TEST-0901 (on loan to Custodian A), TEST-0902 (Active, nobody holds it), and TEST-0903 (Active, nobody holds it, no reports), moves the fixture emails to `@dlsu.edu.ph`, and starts the server and Vite. Database reads go through a SELECT-only helper beside it. Screenshots go to `%TEMP%\adric-groupA-handchecks\screenshots\`. `.playwright-mcp` is deleted from the repository afterwards. Seeded assets used: TEST-0002 (on loan to Custodian A), TEST-0003 (under maintenance), TEST-0004 (Disposed), TEST-0005 (a pending loan), TEST-0006 (Active, held by Custodian A, one inspection report).

**H13: Raiki, on CCS Cloud, read-only (SELECT only).**

| # | Issue | Role and screen | Steps | Expected | Database |
|---|---|---|---|---|---|
| H1 | #51, the old bug | Custodian A, then Staff, Pending Returns | Custodian A opens TEST-0901, Return Asset, twice (two requests). Staff, Pending Returns, Evaluate and Finalize the first, condition Operational | "Return Ledger Closed"; Asset Inventory shows TEST-0901 Active, custodian "None"; one `asset_returns` row | Local test |
| H2 | #51, a stale second return | Staff, Pending Returns | Finalize the second request for TEST-0901. If the screen offers only one request, send the same POST from the page with the session (the agent records which) | The amber box ends with "TEST-0901 is not out with anyone, so there is nothing to return."; still one `asset_returns` row; the newest record unchanged | Local test |
| H3 | #51, a disposed asset | Staff | POST a return for TEST-0004 from the page (no screen offers it) | 409, "TEST-0004 is disposed and cannot be returned."; Asset Inventory, Decommissioned Archive still lists TEST-0004 | Local test |
| H4 | #51, nearby | Custodian A, then Staff | Return Asset on TEST-0006 (Active, held by Custodian A); Staff finalizes it | Finalized; the return is filed under Custodian A; TEST-0006 shows "None" (question 1, b) | Local test |
| H5 | #54, the old bug | Staff, Asset Inventory | Decommission TEST-0902; then Decommission TEST-0902 again | First: "Disposal Request Submitted", DISP-n. Second: red "TEST-0902 already has a pending disposal request (DISP-n).", dialog open; one pending `asset_disposals` row | Local test |
| H6 | #54, statuses | Staff, Asset Inventory | Decommission TEST-0002, TEST-0003, TEST-0005 | "is on loan and cannot take this request.", "is under maintenance...", "already has a pending loan request (LOAN-n)."; no new rows | Local test |
| H7 | #28 and #54, the other side | Custodian B, Available Equipment | Request Loan on TEST-0902 (disposal pending since H5) | The loan form shows "TEST-0902 already has a pending disposal request (DISP-n)."; no new loan | Local test |
| H8 | #28, the reported case | Custodian A, then Staff | Custodian A requests a transfer of TEST-0002 to Custodian B; Staff Decommissions TEST-0002 | "TEST-0002 already has a pending transfer request (TRF-n)."; no disposal row | Local test |
| H9 | #28, old rows | Lab Head, Custody Transitions | The agent writes a pending transfer on TEST-0004 (Disposed) straight to the test database, as CCS Cloud may hold. Approve it; then Decline it | Approve: red "TEST-0004 is disposed now, so this transfer can only be declined.", no new record. Decline: the transfer is Declined | Local test |
| H10 | #28, nearby | Director, Approvals and Holds | Approve DISP-n on TEST-0902 (from H5). Then the agent writes a second pending disposal on TEST-0902; approve it, then reject it | First: TEST-0902 moves to the Decommissioned Archive. Second approve: red "TEST-0902 is disposed now, so this disposal can only be rejected."; reject works; one DISPOSED record | Local test |
| H11 | #53 | Staff, Inspection Manager; Custodian A, Send Inspection Report | Staff inspects TEST-0903 as Degraded Performance; Custodian A reports TEST-0006 as Minor Drift. Then POST an inspection for TEST-0903 with condition "Broken" from the page | Reports stored DEGRADED and MINOR_DRIFT, shown in the inspection log. The POST: 400 "Unrecognized condition: Broken."; no new `asset_reports` row; TEST-0903 still DEGRADED | Local test |
| H12 | #69 | Staff, Asset Inventory, Delete | Delete TEST-0006 (has reports); then delete a new asset registered in Register Equipment (no reports) | TEST-0006: red "TEST-0006 cannot be deleted because it has inspection or condition reports...", still listed. The new asset: deleted, gone from the list | Local test |
| H13 | #28, #54: what UAT may meet | Raiki, a MySQL client, CCS Cloud, read-only | Run the three SELECTs below. Nothing else | The rows the new rules will refuse at decision time. Zero rows is fine. Report the counts and the tags | CCS Cloud, SELECT only |
| H14 | All | The agent, terminal | `npm run typecheck`, `npm run build`, `npm test` with the browser, server, and Vite stopped | 65, passes, 410 (408 without commit 5) | Local test |

H13, the three read-only queries (SELECT only; they change nothing):

```sql
-- 1. Pending loans and transfers on assets whose newest record is DISPOSED
SELECT 'loan' AS kind, l.loan_id AS id, a.asset_tag FROM asset_loans l JOIN assets a ON a.asset_id = l.asset_id
WHERE l.status = 'pending' AND (SELECT r.status FROM asset_records r WHERE r.asset_id = l.asset_id
  ORDER BY r.date_logged DESC, r.asset_record_id DESC LIMIT 1) = 'DISPOSED'
UNION ALL
SELECT 'transfer', t.transfer_id, a.asset_tag FROM asset_transfers t JOIN assets a ON a.asset_id = t.asset_id
WHERE t.status = 'pending' AND (SELECT r.status FROM asset_records r WHERE r.asset_id = t.asset_id
  ORDER BY r.date_logged DESC, r.asset_record_id DESC LIMIT 1) = 'DISPOSED';

-- 2. Assets with more than one pending disposal
SELECT a.asset_tag, COUNT(*) AS pending FROM asset_disposals d JOIN assets a ON a.asset_id = d.asset_id
WHERE d.status = 'pending' GROUP BY a.asset_tag HAVING COUNT(*) > 1;

-- 3. Pending disposals on an asset that is not Active, or that also has a pending loan or transfer
SELECT d.disposal_id, a.asset_tag FROM asset_disposals d JOIN assets a ON a.asset_id = d.asset_id
WHERE d.status = 'pending' AND (
  (SELECT r.status FROM asset_records r WHERE r.asset_id = d.asset_id ORDER BY r.date_logged DESC, r.asset_record_id DESC LIMIT 1) <> 'ACTIVE'
  OR EXISTS (SELECT 1 FROM asset_loans l WHERE l.asset_id = d.asset_id AND l.status = 'pending')
  OR EXISTS (SELECT 1 FROM asset_transfers t WHERE t.asset_id = d.asset_id AND t.status = 'pending'));
```

H13 can run now, before stop 2; it does not depend on this branch.

### 7. Questions for Raiki

1. **When is an asset "out" for a return?** Pending Returns (Staff), and the Custodian's Return Asset button in the asset modal, which shows on any asset the Custodian holds that is not Disposed. Edit Asset can give an Active asset a custodian without a loan.
   - (a) Only On Loan. A Custodian who holds an Active asset (given through Edit Asset) can file a return request, but Staff get a 409 when they finalize it.
   - (b) On Loan, or Active and held by a real person (not the "nobody holds it" placeholder). Refused: Active in the pool, no record, Maintenance, Disposed.
   - **Recommendation: (b).** It matches the team rule "available means no custodian", and the Custodian who sees the button can finish the return.
2. **A disposal approval while a loan or transfer is still pending.** Approvals and Holds (Director), Custody Transitions (Lab Head). After this branch it happens only with old rows (as in issue #28's report) or two clicks at the same instant.
   - (a) Refuse the Director's approval with a message naming the pending request. The Lab Head decides it first, then the Director approves.
   - (b) Approve, and decline the pending loans and transfers in the same save. No email goes to their requesters, and the disposals code writes loan and transfer rows.
   - (c) Approve and leave them. Their later approval is refused (the asset is Disposed); declining still works.
   - **Recommendation: (a).** Nothing changes behind anyone's back, and each feature writes only its own rows.
3. **Which condition names the inspection route accepts.** Inspection Manager (Staff), Send Inspection Report (Custodian). Both screens already send the stored names, so neither changes.
   - (a) Only the five stored names (`PERFECT`, `OPERATIONAL`, `MINOR_DRIFT`, `DEGRADED`, `CRITICAL_DEFECT`), like the return route.
   - (b) Also the five display names ("Degraded Performance" and so on), mapped to the stored ones.
   - **Recommendation: (a).** One list, `ASSET_CONDITIONS`, for every route, and no caller sends a display name.
4. **A status rule for inspection reports, which issue #88 also planned.** Send Inspection Report (Custodian), Inspection Manager (Staff). #88's teammate fixes the Custodian's list on the web; the restructure log also gave #88 "a status check on the inspection route", in the same server and test files as #53 here. Staff inspect assets under maintenance on purpose (the Inspection Manager marks them Critical).
   - (a) This branch adds no status rule. #88's teammate adds it on their branch, in the files this branch also changes.
   - (b) This branch adds one more commit (5): a report for a Disposed asset gets 409, `<tag> is disposed and cannot take an inspection report.`; Maintenance stays allowed. #88 then needs only its web part.
   - (c) No status rule anywhere.
   - **Recommendation: (b).** It avoids two people editing the same test file before the freeze, and refusing only Disposed keeps the Staff repair inspections working.
5. **Pending Returns after a refusal.** Pending Returns (Staff). With #51, the screen shows a refusal under the heading "Return Ledger Closed", in a box that says "couldn't reach the database", and drops the request from the list.
   - (a) Leave the screen to issue #99 (the Staff "Record Return" button), which rebuilds this flow next.
   - (b) One small web commit here: show the refusal as an error and keep the request in the list.
   - **Recommendation: (a).** #99 changes the same file right after this branch, so one rewrite is safer than two before the freeze.
6. **One commit or two for the shared "one pending request" rule.** Custodian loan and transfer forms, Asset Inventory Decommission (Staff). Commit 2 teaches the shared guard about pending disposals, which makes disposal requests refuse a pending loan or transfer (#54) and also makes loan and transfer requests refuse a pending disposal (one way into #28).
   - (a) Keep both sides in commit 2, as planned: one rule, in one function.
   - (b) Split: commit 2 checks pending disposals inside the disposal code only; commit 3 moves that check into the shared guard for loans and transfers.
   - **Recommendation: (a).** Splitting writes the same check twice, and the commit message and log say plainly that loans and transfers change too.

### Noticed, not in this branch

- **Edit Asset can set any status**, Disposed back to Active included (`updateAsset`, `assets.service.ts`, `TODO(H-07)`), and its condition falls back to PERFECT the same way as #53 did. Both are the asset edit's own fixes.
- **A repair ticket is accepted for a Disposed asset** (`repairs.service.ts:34`, `TODO(H-05)`). The asset modal hides the button on a Disposed asset, so only a direct call can do it. Its own issue.
- **The bell and the Lab Head analytics panel** swallow decision errors (section 4); for the bell rewrite.
