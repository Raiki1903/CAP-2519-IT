# 01. UAT Fix Log

Running record of the bug fixes before user acceptance testing (UAT) on **2026-10-21**. Code freeze: **Tuesday 2026-10-20, 6 pm**.
The restructure is complete (PR #100); its record is [../phase-1c-restructure/02-restructure-log.md](../phase-1c-restructure/02-restructure-log.md). The rules are in [../../AGENTS.md](../../AGENTS.md).

One section per fix branch, each from a fresh `main`, in two stops: stop 1 is the plan (docs only), stop 2 is the build after Raiki's answers. Each behavior change is its own commit, marked with `!`, with its tests in the same commit. Teammates fix frontend issues in parallel (#35, #47, #55, #62, #63, #88), so each section says which of their files it touches. Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

Baseline on `main` at `1ce2aaa3` (the PR #101 merge): typecheck **65** errors, `npm run build` passes, `npm test` **391** passed.

---

## Status

| Group | Branch | Issues | Status | Commits | Typecheck | Tests | Date |
|---|---|---|---|---|---|---|---|
| A | `fix/h05-state-guards` | #51, #54, #28, #53, #69, and the server half of #88 | Merged in PR #106; the agent's hand checks H1 to H12 and H14 passed on the local test database; H13 (CCS Cloud, read-only) is Raiki's | Plan `6082b361`; `6d9e8164`, `d9c8292c`, `2059d17e`, `caf35fae`, `fca6666b`, `193db447`; docs and comments: the last commit | **65** (unchanged) | **391** to **410** | 2026-10-18, 2026-10-19 |
| H | `fix/99-returns` | #99, with #59 as a rider | Built (stop 2); the agent's hand checks H1 to H10 and H12 passed on the local test database; H11 (CCS Cloud, read-only) run by Raiki; pull request next | Plan `a2d316bb`; `59d6c599`, `684f0212`, `cc8a1190`, `791dd3ba`, `365957eb`, `e178991b`, `d0e9b5d0`; docs and comments: the last commit | **65** (unchanged) | **410** to **413** | 2026-10-20 |

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

**Results (2026-10-19). H1 to H12 and H14: all passed** (the agent, on the local `AdRIC_DB_test` only). **H13: not run yet** (Raiki, CCS Cloud, read-only).

How they ran: a real browser (Chrome, driven by the Playwright MCP) against Vite at `http://localhost:5173` (started with `VITE_API_URL=http://localhost:4000`) and `server/main.ts` on port 4000. Ports 4000 and 5173 were free before the start, and their processes were checked by command line to be the start script's server and this run's Vite. The start script `%TEMP%\adric-groupA-handchecks\start.mts` (13c's, with this group's three extra assets) emptied and seeded the test database through the test harness and its guard, which takes only `TEST_DATABASE_URL` from `.env`, as `npm test` does; the agent did not open `.env` or `pending_registrations.json`. Reads went through `q.mts` (SELECT only); the two old rows for H9 and H10 were written by `w.mts` (INSERT only, through the same guard, so only a local `*_test` database). Screenshots are in `%TEMP%\adric-groupA-handchecks\screenshots\`, the browser console logs in `playwright-logs\`, and the H14 test output in `h14-npm-test.txt`, all beside the start script. The MCP saves screenshots only inside the repository, so they were moved out afterwards and `.playwright-mcp` was deleted. Vite outlived its stopped wrapper and was ended by its PID (as in 13c).

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| H1 | Passed | Custodian A, TEST-0901, Return Asset, twice: two requests in Pending Returns. Staff finalized one as Operational: "Return Ledger Closed", no amber box; `asset_returns` row 1 with `returned_by_id` 6 (Custodian A); TEST-0901's newest record ACTIVE under user 1 (the placeholder); Asset Inventory "None" | `h1-1-first-return-finalized.png` |
| H2 | Passed | The second request for TEST-0901, finalized as Degraded: the amber box "Logged locally, but couldn't reach the database to finalize this return: TEST-0901 is not out with anyone, so there is nothing to return." under "Return Ledger Closed" (the wording #99 fixes, answer 5a). Still one `asset_returns` row; TEST-0901's newest record unchanged (ACTIVE, OPERATIONAL, not DEGRADED). The same browser also held a leftover request for TEST-0903 from an earlier session (2026-10-16), an Active asset nobody holds, which is the old bug's exact case: refused the same way, nothing written | `h2-1-stale-return-refused.png`, `h2-2-pool-asset-return-refused.png` |
| H3 | Passed | POST from the Staff page: TEST-0004, 409 "TEST-0004 is disposed and cannot be returned."; also TEST-0003, 409 "TEST-0003 is under maintenance and cannot be returned until its repair is finished." Asset Inventory: Decommissioned Archive (1) still TEST-0004 | none (API answers recorded here) |
| H4 | Passed, by a direct POST | The modal shows Return Asset only on an On Loan asset (see "Differences from the plan"), so the Active TEST-0006 held by Custodian A was returned by a POST from the Staff page: 200, return 2 with `returned_by_id` 6; TEST-0006 then "None" | `h4-0-test0006-modal.png` (no Return button on an Active asset) |
| H5 | Passed | Staff, Asset Inventory, Decommission TEST-0902: "Disposal Request Submitted", DISP-2. Again: red "TEST-0902 already has a pending disposal request (DISP-2).", dialog open. One pending disposal | `h5-1-second-disposal-refused.png` |
| H6 | Passed | Decommission TEST-0002: "TEST-0002 is on loan and cannot take this request."; TEST-0003: "TEST-0003 is under maintenance and cannot take this request."; TEST-0005: "TEST-0005 already has a pending loan request (LOAN-2)." No new `asset_disposals` row | `h6-1-on-loan-refused.png`, `h6-2-maintenance-refused.png`, `h6-3-pending-loan-refused.png` |
| H7 | Passed | Custodian B, Available Equipment, TEST-0902, Request Loan: red "TEST-0902 already has a pending disposal request (DISP-2)." under the form; no loan row for TEST-0902 | `h7-1-loan-refused-pending-disposal.png` |
| H8 | Passed | Custodian A, TEST-0002, Custodianship Transfer to Custodian B (CeLT): TRF-1 pending. Staff, Decommission TEST-0002: "TEST-0002 already has a pending transfer request (TRF-1)."; no disposal row | `h8-1-transfer-filed.png`, `h8-2-disposal-refused-pending-transfer.png` |
| H9 | Passed | TRF-2 written on TEST-0004 (Disposed). Lab Head, Custody Transitions, Authorize TRF-2: red "TEST-0004 is disposed now, so this transfer can only be declined."; TRF-2 still pending, TEST-0004 still 2 records, the newest DISPOSED. Decline: TRF-2 declined, no new record | `h9-1-transfer-approval-refused.png`, `h9-2-transfer-declined.png` |
| H10 | Passed | Director, Approvals & Holds, Authorize Disposal DISP-2: approved, TEST-0902's newest record DISPOSED with `disposal_id` 2. DISP-3 written on TEST-0902; Authorize: red "TEST-0902 is disposed now, so this disposal can only be rejected."; Reject & Recirculate: DISP-3 rejected; one DISPOSED record | `h10-1-second-disposal-approval-refused.png` |
| H11 | Passed | Staff, Inspection Manager, TEST-0903 as Degraded Performance: RPT-2 DEGRADED, TEST-0903 DEGRADED. Custodian A, Send Inspection Report, Minor Drift on TEST-0002 (not TEST-0006: she no longer held it after H4): RPT-3, stored "MINOR DRIFT" (the database spelling of MINOR_DRIFT), `reported_by_id` 6. POST "Broken" on TEST-0903: 400 "Unrecognized condition: Broken.", no new report, still DEGRADED. Also commit 5: POST on TEST-0004: 409 "TEST-0004 is disposed and cannot take an inspection report." | none (database rows recorded here) |
| H12 | Passed | Staff, Asset Inventory, Remove TEST-0006, Permanently Delete: "⚠️ TEST-0006 cannot be deleted because it has inspection or condition reports, which are part of its history. To take it out of use, file a disposal instead.", still listed, its report and 2 records kept. Remove TEST-0001 (no reports, nothing pending; used instead of a newly registered asset): deleted, gone from the list and the database | `h12-1-delete-refused-reports.png` |
| H13 | Not run | Raiki's, on CCS Cloud, SELECT only | |
| H14 | Passed | With the browser, server, and Vite stopped: typecheck **65**, build passes, `npm test` 16 files, **410 passed** | `h14-npm-test.txt` |

**Seen besides, not caused by this branch:** the console showed only the refusals the checks asked for (each 400 and 409 above), `GET /api/auth/me` 401 on the login page before each login, the `favicon.ico` 404, and React's development warning about refs; no 500. With two requests for one asset, the browser-only return list (H-02) marked the other row as finalized, not the one clicked (H1: the older row was clicked, the newer one left the list). For #99.

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

**Answers (Raiki, 2026-10-19):** 1 (b), 2 (a), 3 (a), 4 (b), 5 (a), 6 (a). On 4: issue #88 (Joel) becomes web only, and the server rule for Disposed assets is this branch's, in its own commit. On #35 (the Available Assets category filter): frontend only, in the Custodian screens; it touches neither `server/` nor `tests/api/`.

### 8. Stop 2: what was built (2026-10-19)

On `fix/h05-state-guards`, in the planned order. After every commit: typecheck **65**, build passes, `npm test` as below. Nothing pushed.

| Commit | Kind | What it does | Tests |
|---|---|---|---|
| `6d9e8164` | **Behavior change** (#51) | A return answers 409 unless the asset is On Loan, or Active and held by a real person (answer 1b) | **396** |
| `d9c8292c` | **Behavior change** (#54) | The custody request guard reads the pending disposal too; a disposal request needs an Active asset with nothing pending; loans and transfers are refused while a disposal is pending (answer 6a) | **400** |
| `2059d17e` | **Behavior change** (#28) | `findDecisionConflict`: approving a loan, transfer, or disposal checks the asset again; a disposal approval waits for a pending loan or transfer (answer 2a); decline and reject always work | **408** |
| `caf35fae` | **Behavior change** (#53) | `checkInspectionReport`: a missing condition, or one not in `ASSET_CONDITIONS` (display names included, answer 3a), answers 400 before any database work | **408** |
| `fca6666b` | **Behavior change** (#88, server half) | An inspection report for a Disposed asset answers 409; under maintenance is still accepted (answer 4b) | **410** |
| `193db447` | **Behavior change** (#69) | Deleting an asset with reports answers 409 with the reason, instead of the generic 500 | **410** |
| this commit | Docs and comments | The five stale comment lines above `notifyDirector` and `notifyDecision` (disposals) and `notifyDecision` (transfers) deleted (untrue since PR #101); this section, the hand check results, `docs/README.md`, `docs/HANDOFF.md` | **410** |

**Test count: 391 to 410**, exactly as planned in section 3. The typecheck stayed at **65** in every commit. No schema, `package.json`, or `web/` change.

#### Differences from the plan, and why

- **The Custodian's Return Asset button shows only on an On Loan asset.** Question 1 said it shows on any asset the Custodian holds that is not Disposed; the asset modal in fact offers Request Loan on an Active asset and no actions on one under maintenance. So answer 1b matters only for direct calls and old browser requests, and H4 was run as a direct POST. The rule itself is unchanged; no screen needs it to change.
- **#51 commit:** the asset with no record became its own test instead of a fourth `it.each` case (same count).
- **#53 commit:** the `InspectionReportInput` TSDoc in `shared/types/inspections.ts` said an unknown condition is saved as PERFECT; it was corrected in the same commit (not listed in the plan's files). `checkInspectionReport` reads the body with `?.`, so a request with no JSON body answers 400 rather than a 500.
- **#28 commit:** the disposal test file lost its now unused `LOCATION_SEPARATOR` import.
- **H11** used TEST-0002 for the Custodian's report, and **H12** deleted the seeded TEST-0001 instead of a newly registered asset; both for the reasons in the results table.

#### What every teammate must do

Pull and run `npm test` once (410). Screens that send a disposal, return, loan or transfer approval, or inspection should show the server's `error` text on a 409 or 400, as Asset Inventory, Custody Transitions, and Approvals & Holds already do; the bell, the Lab Head analytics panel's quick buttons, and the two inspection screens do not read it yet (section 4).

### Noticed, not in this branch

- **Edit Asset can set any status**, Disposed back to Active included (`updateAsset`, `assets.service.ts`, `TODO(H-07)`), and its condition falls back to PERFECT the same way as #53 did. Both are the asset edit's own fixes.
- **A repair ticket is accepted for a Disposed asset** (`repairs.service.ts:34`, `TODO(H-05)`). The asset modal hides the button on a Disposed asset, so only a direct call can do it. Its own issue.
- **The bell and the Lab Head analytics panel** swallow decision errors (section 4); for the bell rewrite.

---

## Group H: returns (fix/99-returns)

Issue #99 (a Custodian's return request stays in that Custodian's browser, so Staff on another computer cannot see or finalize it, and a finalized return leaves the loan approved), with issue #59 (a random CLR number on the return form) as a rider in the same file. Branch `fix/99-returns` from `main` at `22e85729` (group A, #35, #62, and #63 merged). Baseline there: typecheck **65**, `npm run build` passes, `npm test` **410** passed. No schema change: the request stays in the browser until Phase 3, and the loan is closed through the free-text `asset_loans.status` column that exists today.

### 1. Where the code is now, and the change

Line numbers are on `main` at `22e85729`.

#### #99, part 1: Staff cannot return an asset without a request in their own browser

**Now.** A Custodian's Return Asset button (the asset detail modal, [AssetDetailModal.tsx:572-589](../../web/features/assets/AssetDetailModal.tsx#L572-L589)) opens `ReturnForm`. Its Custodian branch ([ReturnForm.tsx:77-86](../../web/features/returns/ReturnForm.tsx#L77-L86)) calls `addReturnRequest` in [browserOnly.tsx:81](../../web/state/browserOnly.tsx#L81), which saves the request in that browser's `localStorage` (`ems_returns`); nothing about the return reaches the server. Staff reach the Staff side of the form only from Pending Returns ([ReturnsPage.tsx:22-26](../../web/pages/staff/ReturnsPage.tsx#L22-L26)), which reads the same storage. So Staff on another computer see "No pending return requests in queue." and have no way to return the asset. In the modal, Staff on an asset on loan see only Send to Maintenance (line 554); Return Asset is for the Custodian who holds it (line 573, since 13c). The server needs no request: `finalizeReturn` in [returns.service.ts:29](../../server/features/returns/returns.service.ts#L29) takes a Staff return of any asset that is out and records the holder as returner (line 46).

**Change.** A Staff button **Record Return** in the modal's action grid, on an asset whose status on screen is On Loan or Overdue (Overdue is an ON_LOAN asset past its loan's due date, [assets.service.ts:87](../../server/features/assets/assets.service.ts#L87)). It opens the existing `ReturnForm` in Staff mode with no request attached (`setView("return")`), which finalizes directly with `POST /api/assets/:assetTag/return`, as Pending Returns does. Only Staff see it, and never on an Active, Maintenance, or Disposed asset. The Staff grid on such an asset becomes two tiles: Send to Maintenance and Record Return. On success: the existing "Return Ledger Closed" screen with the server's CLR number; the shared lists reload (`syncFromDb`), so the modal then shows the asset Active, custodian "None". A refusal shows on the form (part 3).

The button checks the status itself, because the modal's last branch (line 512) is also where Staff land on a Maintenance asset. Correction to group A's log ("Differences from the plan"): the Custodian's Return Asset shows on an On Loan **or Overdue** asset the Custodian holds, not only On Loan.

#### #99, part 2: stale requests after a return from another computer

**Now.** Three places show every request with `status === "Pending"`:

| Place | Code |
|---|---|
| Pending Returns (Staff) | [ReturnsPage.tsx:26](../../web/pages/staff/ReturnsPage.tsx#L26) |
| Staff Overview, the "Pending Return Ledgers" count | [OverviewPage.tsx:27](../../web/pages/staff/OverviewPage.tsx#L27), shown at line 78 |
| The bell, section "D. Return Requests" (Staff, Lab Head, Director, and the Custodian whose name matches) | [NotificationCenter.tsx:310-311](../../web/features/notifications/NotificationCenter.tsx#L310-L311) |

A request whose asset was returned on another computer (or, after this branch, through Record Return) stays Pending in this browser forever. Group A's H2 showed what happens when Staff then finalize it: a 409, shown as if the return had worked.

**Change.** One new function, `openReturnRequests(returns, assets)`, in a new file `web/features/returns/openReturnRequests.ts`: the Pending requests, minus those whose asset is in the server's asset list (`useServerData().assets`) with a status other than On Loan or Overdue. A request whose asset is not in the list (the list not loaded yet, or the asset deleted) is kept, as today. The three places call it instead of their own `status === "Pending"` filter.

In `NotificationCenter.tsx` exactly this changes, nothing else: one import line after line 12, and lines 310 and 311 (`returns.forEach(ret => {` and `if (ret.status === "Pending") {`) become a loop over `openReturnRequests(returns, assets)`, with the closing brace of the `if` removed. `assets` is already read there (line 47) and is already in the `useMemo` list (line 544). The return cards' text, roles, and clicks are unchanged, and nothing about the 404s of #55.

`web/state/browserOnly.tsx` is **not changed** for this with question 2 (a). The filter needs the server's asset list, and `browserOnly.tsx` sits outside `ServerDataProvider` (App.tsx), so it cannot read that list; the filter lives with the return feature instead. With question 2 (b), `browserOnly.tsx` gains one function, `dropReturnRequests(ids)`, the only way to remove rows from `ems_returns`, and `serverData.tsx` calls it after each asset list load (question 2 says why).

#### #99, part 3: a failed finalize looks like a success, and the wrong row is marked

**Now.** In `handleSubmit`, the Staff branch ([ReturnForm.tsx:103-132](../../web/features/returns/ReturnForm.tsx#L103-L132)):
- calls `returnsApi.finalizeReturn` (line 111) and keeps any error in `submitError`, then calls the browser's `finalizeReturn` (line 124) **whatever the server answered**, and always shows the success screen (line 135). The success screen keeps the heading "Return Ledger Closed" and "Asset return has been finalized and registry status set to Available.", with the amber box (line 176) "Logged locally, but couldn't reach the database to finalize this return: <message>", also for a 409 the server sent on purpose. The request leaves Pending Returns although nothing was saved.
- picks the request to mark by asset, not by the row clicked: `pendingReturn` (line 67) is the first Pending request for the asset, and `addReturnRequest` puts new requests first, so with two requests for one asset the newer one is marked whichever row was clicked (group A, "Seen besides"). Pending Returns passes only the asset ([ReturnsPage.tsx:67-80](../../web/pages/staff/ReturnsPage.tsx#L67-L80) and 100).

**Change, in two commits.**
1. **The row clicked.** `ReturnForm` takes an optional `request` prop (the `ReturnRequest`); Pending Returns passes the row's request with its asset. The blue "Custodian Turn-in Comments" box shows that request, and only that request's id is marked. Line 67's search by asset goes; with no `request` (the modal: Custodian, and Staff's Record Return) no browser row is read or marked.
2. **A failure stays on the form.** If the answer has `success: false`, the form stays open, nothing in the browser is marked, and a red box above the buttons says **"The return was not recorded: <the server's message>"**, for example "The return was not recorded: TEST-0906 is not out with anyone, so there is nothing to return." With no message: "The return was not recorded. Please try again." If the server cannot be reached: "The return was not recorded: the server could not be reached. Please try again." The button works again for a retry. The lists still reload, so after a 409 for an asset that is no longer out, part 2 takes the stale row off Pending Returns. Only a `success: true` answer marks the request (part 3.1), stores the CLR number, and shows "Return Ledger Closed". The Staff text in the amber box goes (it can no longer appear); the Custodian's amber box about the repair ticket stays. The TSDoc's "If a server call fails, the success screen still appears" (lines 45 and 46) is corrected.

#### #99, part 4: the loan stays approved after a return (H-04)

**Now.** `saveReturn` in [returns.repository.ts:32-55](../../server/features/returns/returns.repository.ts#L32-L55) writes the `asset_returns` row and the new ACTIVE record in one transaction and never touches `asset_loans`. The loan stays `approved`, so:
- Lab Head, Health Benchmarking, the Custodianship & Overdue Delinquencies table lists it once its due date passes (`analytics.service.ts:480-483`, which already leaves out `returned`);
- the bell's Reminders tab keeps an "Active Equipment Loan" card for it (`NotificationCenter.tsx:466-472`, which already skips RETURNED);
- an asset put on loan later by a transfer shows the old loan's dates (`assets.service.ts:77-89`, which reads approved loans only).
The defect is marked at `returns.service.ts:27`, `returns.api.ts:16`, `ReturnForm.tsx:109`, `assets.service.ts:80`, and `analytics.service.ts:480`.

**Change.** Inside the same transaction, after the record, the asset's approved loans become `returned` (which ones: section 3). A failure on any of the three writes leaves none of them, and answers the generic 500 as today. The answer stays `{ success, return }`. `GET /api/asset_loans` shows such a loan as "Returned" (it capitalizes the stored status). This repository writes another feature's table because the three writes must be one transaction; `deleteWithHistory` in `assets.repository.ts` does the same. The TODO(H-04) lines at `returns.service.ts:27`, `returns.api.ts:16`, and `ReturnForm.tsx:109` go; `assets.service.ts:80` and `analytics.service.ts:480` keep a shorter TODO(H-04) about loans returned **before** this branch, which stay approved (old rows, as CCS Cloud may hold; question 4).

#### #59: a random CLR number that changes on every click

**Now.** `displayCertId` at [ReturnForm.tsx:148](../../web/features/returns/ReturnForm.tsx#L148) is the server's number after a finalize, else the `certId` of any finalized browser request for the same asset (line 147, so possibly an older return's number), else `CLR-` plus `Math.random()`, worked out again on every render. With Clearance Issued on, the form's Clearance Certificate ID field (line 401) shows it under "This reference is permanently bound to the return ledger record." (line 407), and it changes with every click on a condition or a key in the notes.

**Change.** Before the finalize, the field shows **"Assigned on finalize"**, and the line under it says **"The server assigns this reference when the return is finalized."** After a successful finalize, the success screen's Clearance Certificate shows the server's `reference_number`, the same as `asset_returns.reference_number`. Line 147 and the random fallback go. `browserOnly.tsx` still makes up a `certId` when a request is marked (line 93), but after this no screen shows it; it is left alone so that `browserOnly.tsx` changes only for question 2 (noted below).

#### The `returnRefusal` comment

[returns.service.ts:67-69](../../server/features/returns/returns.service.ts#L67-L69) says Edit Asset can give an Active asset a custodian, "who then sees Return Asset". The modal shows Return Asset (and after this branch, Record Return) only on an On Loan or Overdue asset, so an Active asset held by a person is returned only by a direct call or an old browser request. The comment is corrected in the docs commit; the rule (group A answer 1b) is unchanged.

### 2. The return flow after this branch

**Path A: Custodian request, then Staff finalize in the same browser.**
1. Custodian, My Assets, an asset they hold that is On Loan or Overdue, Return Asset. They fill in the date and comments (and may flag a repair), and Submit Return Request.
2. The request is saved in this browser only (`ems_returns`, Pending). A repair flag posts a repair ticket to the server, as today.
3. Staff log in **in the same browser**. Pending Returns lists the request, the Overview count and the bell include it, as long as the asset is still On Loan or Overdue.
4. Staff click Evaluate & Finalize on that row, choose the condition, add notes, may set Clearance Issued ("Assigned on finalize"), and click Finalize Return and Close Ledger.
5. The server checks the asset is out (group A), then in one transaction writes the `asset_returns` row (returner: the holder; the CLR number), an ACTIVE record under the placeholder (nobody holds it), and sets the asset's approved loans to `returned`.
6. On success: "Return Ledger Closed" with the server's CLR number, this row is marked Finalized in the browser, the lists reload. On a refusal: the reason on the form, the row stays Pending (and leaves the list if the asset is no longer out).

**Path B: Staff Record Return, no request, any computer.**
1. Staff, Asset Inventory, the asset (On Loan or Overdue), Record Return.
2. The same Staff form, with no Custodian comments box. Staff choose the condition and finalize.
3. Steps 5 and 6 of path A, except that no browser row is marked.
4. Any request for that asset in another browser is hidden there at its next list reload, because the asset is no longer On Loan (part 2).

**Still only in the browser until Phase 3** (status, requested_by, requested_at, and loan_id on `asset_returns`): the request itself (who asked, when, the proposed date, the comments), its Pending or Finalized state, the clearance flag and its `certId`. So a request is still seen only in the browser that made it: Staff on another computer use path B and do not see the Custodian's comments. On the server today: the finalized return, the record, and (new) the closed loans. With `loan_id` in Phase 3, the loan to close is named by the return instead of found by asset (section 3).

### 3. How "the asset's approved loan" is found

There is no link from a return to a loan, so the loan is found by asset: the `asset_loans` rows with this `asset_id` and `status = 'approved'`, inside the return's transaction. The borrower is not compared: the returner can be a transfer recipient, not the borrower.

| Case | How it happens | What happens |
|---|---|---|
| One approved loan | The normal loan: Lab Head approved it, the asset went ON_LOAN to the borrower | It becomes `returned` |
| Several approved loans | Loans returned before this branch stayed approved (H-04), so an asset lent several times has old approved rows; or a loan, then a transfer onward | Question 1: (a) all become `returned`; (b) only the newest (by `loaned_on`, then `loan_id`) |
| No approved loan | The asset was put ON_LOAN by a transfer, or is Active and held through Edit Asset, or its loan was declined | No loan changes; the return is saved as today |
| A pending or declined loan on the asset | Old rows (group A keeps new ones off an asset that is out) | Not touched |
| A refused return (409) | Group A's rule | Nothing is written, the loan included |

### 4. Tests

`npm test` after every commit; typecheck stays **65** (no new types expected; if it moves, the report says why). The web commits have no tests: `npm test` runs only `tests/**/*.test.ts` (API and seed), so their counts stay the same and their checks are the hand checks.

| Commit | Test file | Change | Count after |
|---|---|---|---|
| 1 (H-04) | `tests/api/returns.test.ts` | "finalizing a return leaves the loan open (known defect H-04)" becomes "finalizing a return closes the asset's approved loan, and the loan list shows it as Returned (issue #99, H-04 fixed)": LOAN-1 `returned`, `GET /api/asset_loans` shows "Returned", the asset Active with no due date; same count | |
| | | New: "closes every approved loan of the asset, and leaves its pending and declined loans and other assets' loans alone (issue #99)" (+1). With question 1 (b): "closes only the newest approved loan of the asset..." (+1, same count) | |
| | | New: "returns an asset with no approved loan (put on loan by a transfer), and changes no loan (issue #99)" (+1) | |
| | | New: "a refused return (409) leaves the asset's approved loan approved (issue #99)" (+1) | |
| | `tests/api/analytics.test.ts` | "still counts a loan as delinquent after the asset is returned through the return route (known defect H-04)" becomes "no longer counts a loan as delinquent once the asset is returned through the return route (issue #99, H-04 fixed)": loan `returned`, `delinquencies` empty; same count | **413** |
| 2 (the row clicked) | none (web) | | **413** |
| 3 (a failure stays on the form) | none (web) | | **413** |
| 4 (#59) | none (web) | | **413** |
| 5 (stale requests) | none (web) | | **413** |
| 6 (Record Return) | none (web) | | **413** |
| 7 (question 3, b) | none (web) | | **413** |
| 8 (docs) | none | | **413** |

Checked: no other test returns an asset that has a loan. `sessionUser.test.ts` (TEST-0851) and the other `returns.test.ts` returns use extra assets with no loan row, and `session.test.ts` row 27 returns an unknown tag (404). Each test file reseeds the database, so LOAN-1 being `returned` in `returns.test.ts` does not reach `loans.test.ts`.

### 5. Screens and roles that see a difference

| Screen (role) | Part | What changes |
|---|---|---|
| Asset detail modal, from Asset Inventory (Staff) | 1 | Record Return on an On Loan or Overdue asset; it finalizes at once, from any computer |
| Asset detail modal (Custodian, Lab Head) | none | Unchanged: Return Asset for the holder; Custodian History for the Lab Head |
| Pending Returns (Staff) | 2, 3, #59 | Requests whose asset is no longer On Loan or Overdue are hidden; a refusal or failure shows the reason in red and keeps the request; the row clicked is the one finalized; "Assigned on finalize" until the server's CLR number |
| System Overview (Staff), "Pending Return Ledgers" | 2 | Counts only requests whose asset is still out |
| The bell, Requests tab (Staff, Lab Head, Director, the Custodian) | 2 | Return Request cards for assets no longer out are gone |
| The bell, Reminders tab (Staff, Lab Head, Director, the borrower) | 4 | An "Active Equipment Loan" card goes once the asset is returned (no bell code change: the loan is no longer approved) |
| My Assets (Custodian) | 1, 4 | After a Record Return from any computer, the asset leaves My Assets at the next reload (as after a same-browser finalize today), with its due date and the "Overdue Return" banner |
| Health Benchmarking (Lab Head), the delinquency table | 4 | A returned loan is no longer listed as overdue |
| Custody Transitions (Lab Head) | 4 | A returned loan shows status "Returned" and leaves "Completed This Period" (that count reads "Approved"). With question 3 (b) it shows as completed instead |

**Teammates' files.** `CustodianPortal.tsx` (#88's web part) is **not** touched: the modal change is inside `AssetDetailModal.tsx`, which CustodianPortal only opens. `IntakeWizard.tsx` (#102) is not touched. `NotificationCenter.tsx` (the bell, #55, unassigned): only the import and lines 310 and 311 (part 2). `LabHeadDashboard.tsx` is touched only with question 3 (b); #55's Lab Head return cards may be in that file too, so its owner should know.

### 6. Stop 2 plan

On `fix/99-returns`, in this order. After each commit: `npm run typecheck` (65) and `npm test` (the count above). Commit, never push.

| # | Commit message | Files |
|---|---|---|
| 1 | `fix(returns)!: finalizing a return closes the asset's approved loan (#99)` | `server/features/returns/returns.repository.ts`, `returns.service.ts` (TSDoc, TODO), `returns.controller.ts` (TSDoc); TODO(H-04) comment lines in `server/features/assets/assets.service.ts:80`, `server/features/analytics/analytics.service.ts:480`, `web/api/returns.api.ts:16`, `web/features/returns/ReturnForm.tsx:109`; `tests/api/returns.test.ts`, `tests/api/analytics.test.ts` |
| 2 | `fix(returns)!: finalize the request that was clicked, not the asset's first one (#99)` | `web/features/returns/ReturnForm.tsx`, `web/pages/staff/ReturnsPage.tsx` |
| 3 | `fix(returns)!: a refused or failed finalize shows the reason and keeps the request (#99)` | `ReturnForm.tsx` |
| 4 | `fix(returns)!: show "Assigned on finalize" until the server gives the CLR number (#59)` | `ReturnForm.tsx` |
| 5 | `fix(returns)!: hide return requests whose asset is no longer on loan (#99)` | New `web/features/returns/openReturnRequests.ts`; `ReturnsPage.tsx`, `web/pages/staff/OverviewPage.tsx`, `web/features/notifications/NotificationCenter.tsx` (the import and lines 310 and 311 only). With question 2 (b), also `web/state/browserOnly.tsx` (`dropReturnRequests`) and `web/state/serverData.tsx` (one call) |
| 6 | `feat(returns)!: Staff can record a return from the asset detail modal (#99)` | `web/features/assets/AssetDetailModal.tsx` (the button, its TSDoc, the header's "Used by"), the header of `ReturnForm.tsx` |
| 7 | `fix(lab-head)!: show a returned loan as completed in Custody Transitions (#99)`, only if question 3 is (b) | `web/pages/lab-head/LabHeadDashboard.tsx`: "Returned" in `txnBadgeClass` (green), in the card's left edge, in "Completed This Period", and in `VisualTimeline` as done |
| 8 | `docs(group H): record the build, correct the returnRefusal comment` | `returns.service.ts` lines 67 to 69 (comment only); this log ("Stop 2: what was built", the hand check results), `docs/README.md`, `docs/HANDOFF.md` |

Then `npm run build`, the hand checks below (the agent's, on the local test database), the report, and stop.

### 7. Hand checks

#### Group H hand checks

**H1 to H10 and H12: the agent, in a browser (Playwright MCP), on the local test database `AdRIC_DB_test` only**, after stop 2. Before starting: stop any `npm run dev:all` and make sure ports 4000 and 5173 are free. A start script outside the repository (`%TEMP%\adric-groupH-handchecks\start.mts`, built on group A's) empties and seeds the test database through the test harness, adds the assets below, and starts the server and Vite; reads go through a SELECT-only helper beside it. **Two browser contexts** (separate cookies and `localStorage`) stand for two computers: context 1 and context 2. Screenshots go to `%TEMP%\adric-groupH-handchecks\screenshots\`; `.playwright-mcp` is deleted from the repository afterwards.

Assets: seeded TEST-0001 (Active), TEST-0002 (on loan to Custodian A, LOAN-1 approved), TEST-0003 (under maintenance), TEST-0004 (Disposed). Added: TEST-0901 (on loan to Custodian A, an approved loan), TEST-0902 (on loan to Custodian B, no loan row, as after a transfer), TEST-0903 (on loan to Custodian A, an approved loan), TEST-0904 (on loan to Custodian B, two approved loans: an old one, as H-04 left it, and the current one), TEST-0905 (on loan to Custodian A, an approved loan 5 days past due, so Overdue), TEST-0906 (on loan to Custodian A, an approved loan), TEST-0907 (on loan to Custodian A, an approved loan; a control that is never returned).

**H11: Raiki, on CCS Cloud, read-only (SELECT only).**

| # | Part | Role and screen | Steps | Expected | Database |
|---|---|---|---|---|---|
| H1 | #99, the old bug: two computers | Context 1: Custodian A, My Assets. Context 2: Staff, Pending Returns, System Overview, Asset Inventory | Context 1: TEST-0901, Return Asset, comment "H1 request", Submit Return Request. Context 2: open Pending Returns and System Overview; then Asset Inventory, TEST-0901, Record Return, Operational, Finalize Return and Close Ledger | Context 1: "Return Initiated". Context 2: Pending Returns "No pending return requests in queue." and "Pending Return Ledgers" 0 (expected: the request is browser-only until Phase 3); Record Return shows "Return Ledger Closed" with a CLR number; the modal then shows TEST-0901 Active, "None". One `asset_returns` row, returner Custodian A; newest record ACTIVE under the placeholder; its loan `returned` | Local test |
| H2 | #99, the stale request | Context 1: Custodian A, then Staff | Context 1, reload: the bell and My Assets. Log out; log in as Staff in context 1 (the browser holding the request): Pending Returns, System Overview, the bell | Custodian A: no "Return Request" card for TEST-0901, TEST-0901 not in My Assets. Staff: no TEST-0901 row, "Pending Return Ledgers" 0, no return card in the bell. `ems_returns` (read from the page): with question 2 (a) the request is still there, Pending; with (b) it is gone | Local test |
| H3 | #99 path A, and #59 | Context 1: Custodian A, then Staff, Pending Returns | Custodian A: TEST-0002, Return Asset. Staff in context 1: Pending Returns, Overview, the bell; Evaluate & Finalize; click several conditions, type in the notes, turn Clearance Issued on and off and on; Finalize | Before: one row, count 1, one bell card. The certificate field reads "Assigned on finalize" and never changes. After: "Return Ledger Closed"; the Clearance Certificate equals the new `asset_returns.reference_number`; the row leaves; LOAN-1 `returned` | Local test |
| H4 | #99, the row clicked | Context 1: Custodian A, then Staff, Pending Returns | Custodian A: TEST-0903, Return Asset twice, comments "older", then "newer". Staff: Evaluate & Finalize on the "older" row; finalize | The blue box shows "older". After: in `ems_returns` the "older" request is Finalized and "newer" is not (Pending, hidden as stale; or gone with question 2, b). Both rows leave the list. One `asset_returns` row | Local test |
| H5 | #99, a refused finalize | Context 1: Custodian A, then Staff, Pending Returns. Context 2: Staff, Asset Inventory | Custodian A: TEST-0906, Return Asset. Staff in context 1: Evaluate & Finalize, Operational, do not finalize yet. Context 2: TEST-0906, Record Return, finalize. Context 1: Finalize | Context 1: the form stays open, red "The return was not recorded: TEST-0906 is not out with anyone, so there is nothing to return."; no success screen; the request still Pending in `ems_returns`; after closing the dialog the row is gone (stale). One `asset_returns` row for TEST-0906 (context 2's) | Local test |
| H6 | Section 3, no loan | Staff, Asset Inventory | TEST-0902, Record Return, finalize | "Return Ledger Closed"; returner Custodian B; the number of `asset_loans` rows per status is the same before and after | Local test |
| H7 | Section 3, several loans | Staff, Asset Inventory | TEST-0904, Record Return, finalize | Question 1 (a): both its loans `returned`. (b): only the newer one | Local test |
| H8 | Part 4, overdue | Staff, Asset Inventory and the bell (Reminders); Lab Head, Health Benchmarking; Custodian A, My Assets | Before: TEST-0905 shows Overdue; note the Reminders card and the delinquency row. Staff: Record Return, finalize. Reload each screen | Before: Overdue, an "Active Equipment Loan" reminder, a delinquency row, the "Overdue Return" banner for Custodian A. After: none of them for TEST-0905 | Local test |
| H9 | Part 1, nearby: who sees Record Return | Staff, Asset Inventory; Custodian A, My Assets; Lab Head, Branch Inventory | Staff: open TEST-0001, TEST-0003, TEST-0004, TEST-0907. Custodian A: open TEST-0907. Lab Head: open TEST-0907 | Staff: Record Return on TEST-0907 only (Active: Send to Maintenance only; Maintenance: no Record Return; Disposed: no actions). Custodian A on TEST-0907: Custodianship Transfer, Request Repair, Return Asset, no Record Return. Lab Head: Custodian History only. TEST-0907 still On Loan, its loan still approved | Local test |
| H10 | Part 4, Lab Head view | Lab Head, Custody Transitions | Find LOAN-1 (returned in H3) | Status "Returned", no Authorize or Decline. With question 3 (b): green, counted in "Completed This Period", the timeline complete. With (a): as listed in section 5 | Local test |
| H11 | Part 4, what UAT may meet | Raiki, a MySQL client, CCS Cloud, read-only | Run the SELECT below. Nothing else | Approved loans on assets that are no longer on loan (left by H-04 before this branch). Zero rows is fine. Report the count and the tags | CCS Cloud, SELECT only |
| H12 | All | The agent, terminal | `npm run typecheck`, `npm run build`, `npm test` with the browser, server, and Vite stopped | 65, passes, 413 | Local test |

H11, the read-only query (SELECT only; it changes nothing):

```sql
-- Approved loans whose asset's newest record is not ON_LOAN
SELECT * FROM (
  SELECT l.loan_id, a.asset_tag, l.due_date,
    (SELECT r.status FROM asset_records r WHERE r.asset_id = l.asset_id
     ORDER BY r.date_logged DESC, r.asset_record_id DESC LIMIT 1) AS newest_status
  FROM asset_loans l JOIN assets a ON a.asset_id = l.asset_id
  WHERE l.status = 'approved'
) x
WHERE x.newest_status IS NULL OR x.newest_status <> 'ON_LOAN';
```

H11 can run now, before stop 2; it does not depend on this branch.

**Results (2026-10-20). H1 to H10 and H12: all passed** (the agent, on the local `AdRIC_DB_test` only). **H11: run by Raiki** (CCS Cloud, read-only).

How they ran: a real browser (Chrome, driven by the Playwright MCP) against Vite at `http://localhost:5173` (started with `VITE_API_URL=http://localhost:4000`) and `server/main.ts` on port 4000. Ports 4000 and 5173 were free before the start; afterwards their two processes were checked by command line to be the start script's server and this run's Vite, and ended by PID. The start script `%TEMP%\adric-groupH-handchecks\start.mts` (group A's, with this group's seven assets and their loans) emptied and seeded the test database through the test harness and its guard, which takes only `TEST_DATABASE_URL` from `.env`, as `npm test` does; the agent did not open `.env` or `pending_registrations.json`. Reads went through `q.mts` (SELECT only); nothing was written to the database by hand. **Context 1** was the MCP's own browser (its profile still held five Finalized requests from group A's sessions; Finalized rows are never shown or dropped). **Context 2** was a second, empty context in the same browser, with its own cookies and `localStorage`. Screenshots are in `%TEMP%\adric-groupH-handchecks\screenshots\`, context 1's console log in `playwright-logs\`, and the H12 output in `h12-npm-test.txt`, all beside the start script. `.playwright-mcp` was deleted from the repository afterwards.

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| H1 | Passed | Context 1, Custodian A, TEST-0901, Return Asset, "H1 request": "Return Initiated". Context 2, Staff: Pending Returns "No pending return requests in queue.", System Overview "Pending Return Ledgers" 0, and context 2's `ems_returns` empty (the request is browser-only, as expected until Phase 3). Asset Inventory, TEST-0901: Send to Maintenance and Record Return; Record Return showed no Custodian comments box; Operational, Finalize: "Return Ledger Closed". The modal then showed TEST-0901 Active, condition OPERATIONAL, and no Record Return. Database: return 1, `returned_by_id` 6 (Custodian A), CLR-MVFI0DDS; newest record ACTIVE under user 1 (the placeholder); loan 3 `returned` | `h1-1-staff-modal-record-return.png`, `h1-2-record-return-closed.png`, `h1-3-modal-after-return.png` |
| H2 | Passed | Context 1, Custodian A, reload: TEST-0901 gone from My Assets, no "Return Request" card in the bell. Staff logged in on context 1: Pending Returns empty, "Pending Return Ledgers" 0, no return card in the bell. `ems_returns`: the "H1 request" row is gone (answer 2b) | `h2-1-custodian-bell.png`, `h2-2-staff-same-browser.png` |
| H3 | Passed | Custodian A, TEST-0002, Return Asset, "H3 request". Staff on context 1, Evaluate & Finalize (the blue box: "H3 request"), Clearance Issued on, Finalize: "Return Ledger Closed", Clearance Certificate CLR-MVFI3JST, equal to return 2's `reference_number`; the row left the list; the request Finalized; LOAN-1 `returned`. The readings before the finalize (the count, the bell, the certificate field) were lost to a script error after the run, and were taken again in H4 | `h3-1-assigned-on-finalize.png`, `h3-2-server-clr.png` |
| H4 | Passed | Custodian A, TEST-0903, Return Asset twice ("older", "newer"). Staff: "Pending Return Ledgers" 2, two bell cards, two rows. Evaluate & Finalize on the "older" row: the blue box "older". With Clearance Issued on, the certificate field read "Assigned on finalize" at all six readings (after the switch, three condition clicks, typing notes, and the switch off and on), with "The server assigns this reference when the return is finalized." under it. Finalize: Clearance Certificate CLR-MVFI4NJJ (return 3). After: list empty; `ems_returns` holds "older" as Finalized, and "newer" was dropped (answer 2b) | `h4-1-assigned-on-finalize.png` |
| H5 | Passed | Custodian A, TEST-0906, Return Asset. Staff on context 1 opened Evaluate & Finalize (Operational). Context 2, Record Return on TEST-0906: "Return Ledger Closed" (return 4). Context 1, Finalize: the form stayed open with red "The return was not recorded: TEST-0906 is not out with anyone, so there is nothing to return.", no success screen, the button usable again. The request was never marked Finalized; the reload after the refusal dropped it (TEST-0906 now Active, answer 2b), so its row left the list. Still one `asset_returns` row for TEST-0906 | `h5-1-refused-on-form.png` |
| H5b | Passed (added) | The server cannot be reached: Custodian A, TEST-0907, Return Asset; Staff, Evaluate & Finalize, with the browser made to fail that one POST. Red "The return was not recorded: the server could not be reached. Please try again."; the request stays Pending in `ems_returns` and in the list (TEST-0907 is still on loan). Nothing written | `h5-2-unreachable-on-form.png` |
| H6 | Passed | Context 2, TEST-0902 (on loan to Custodian B, no loan row), Record Return: "Return Ledger Closed"; return 5, `returned_by_id` 7 (Custodian B). It has no loan row, and no other asset's loan changed (TEST-0907's loan 6 still approved, LOAN-2 still pending) | none |
| H7 | Passed | Context 2, TEST-0904 (two approved loans), Record Return: return 6; loans 7 and 8 both `returned` (answer 1a) | none |
| H8 | Passed | Before: Asset Inventory TEST-0905 "Overdue"; Lab Head, Health Benchmarking, the delinquency table "2 Overdue Items" (TEST-0904's old loan, 60 days, and TEST-0905); Custodian A's My Assets with the "Overdue Return" banner (read at the start of H1); the Staff bell's Reminders had cards for TEST-0904 (twice), TEST-0907, and TEST-0905's loan 9, which the loan list names "ASUS TUF Gaming A15" (H-08, below). Context 2, the TEST-0905 modal "Overdue", Record Return: return 7, loan 9 `returned`. After: "0 Overdue Items", "No overdue student loans currently flagged in TEST."; Staff Reminders only TEST-0907; Custodian A: no banner, no TEST-0905 | `h8-1-delinquency-before.png`, `h8-2-overdue-record-return.png`, `h8-3-delinquency-after.png` |
| H9 | Passed | Staff: TEST-0001 (Active) and TEST-0003 (Maintenance) only Send to Maintenance; TEST-0004 (Disposed) no Asset Actions; TEST-0907 (On Loan) Send to Maintenance and Record Return. Custodian A on TEST-0907: Custodianship Transfer, Request Repair, Return Asset, no Record Return. Lab Head, Branch Inventory, TEST-0907: Custodian History only. TEST-0907 still ON_LOAN, loan 6 still approved | `h9-1-staff-maintenance-no-record-return.png`, `h9-2-custodian-0907.png` |
| H10 | Passed | Lab Head, Custody Transitions: seven loans "Returned" (LOAN-1, 3, 4, 5, 7, 8, 9), each with the green badge and edge, a complete timeline, and no Authorize or Decline; "Completed This Period" 8 (the seven, and TEST-0907's approved loan); "1 Pending" (LOAN-2) | `h10-1-returned-loan-custody.png` |
| H11 | Run by Raiki | See below | |
| H12 | Passed | With the browser, server, and Vite stopped: typecheck **65**, build passes, `npm test` 16 files, **413 passed** | `h12-npm-test.txt` |

**H11 result (Raiki, CCS Cloud, read-only, 2026-10-20): 17 approved loans whose asset is not on loan.** As reported: loan_id 1, 2, 3, 4 (EQ-2026-8652), 5 and 7 (CIVI-0001, Disposed), 6 (GAME-0001), 11, 12 (CITe4D-0003), 14 (CITe4D-0006), 15 (CITe4D-0007), 17 (CNIS-0001, Maintenance), 18 (CITe4D-0009, Maintenance), 19 (CITe4D-0010), 20 (CITe4D-0011), 23 (CITe4D-0013), 30 (CITe4D-0002). The other assets are Active. **With answer 4a these stay approved until their asset is lent and returned again:** an Active asset cannot be returned (group A), so a loan on one closes only after a new loan is approved and the asset is returned, which then closes every approved loan of the asset (answer 1a). The two on the Disposed CIVI-0001 never close; the two under maintenance close only if the repair puts the asset back on loan and it is then returned. So **the Lab Head overdue numbers at UAT include these loans** (the delinquency table, once their due dates are past), and the bell's Reminders keep an "Active Equipment Loan" card for each. Any data cleanup is a team decision outside this branch.

**Seen besides, not caused by this branch:** the console showed only what the checks asked for (the 409 in H5, the failed POST in H5b), `GET /api/auth/me` 401 on the login page before each login, the `favicon.ico` 404, and React's development warnings about refs and a dialog description; the server log has no error and seven "Return finalized". Two older bugs showed up: the loan list names loan 9 "ASUS TUF Gaming A15" whatever its asset (`listLoans`, the H-08 seed block; TEST-0905's loan was number 9 here), and Staff see Send to Maintenance on an asset already under maintenance (the modal's last branch, noted in section 1).

### 8. Questions for Raiki

1. **Which loans a return closes when an asset has several approved loans.** Pending Returns and Record Return (Staff); it shows in the Lab Head's delinquency table and Custody Transitions, and in the bell's reminders. Loans returned before this branch stayed approved, so an asset lent more than once can have several.
   - (a) Every approved loan of the asset becomes `returned`. After a return the asset is back in the pool, so none of them can still be out.
   - (b) Only the newest approved loan (by request date, then loan number). Older ones stay approved.
   - **Recommendation: (a).** An asset in the pool has no open loan, and it also clears old H-04 rows on that asset.
2. **What happens to a stale browser request.** Pending Returns and System Overview (Staff), the bell (every role). The team decision is to hide a request when its asset is no longer On Loan. A repair ends with the asset back on loan to the same person, so a request hidden during a repair should come back; but one hidden after a return also comes back if the same asset is lent again later, and then looks like a new request for the new loan.
   - (a) Hide only, as decided. No change to `browserOnly.tsx`.
   - (b) Hide, and also drop the request from this browser once its asset is Active or Disposed (returned or retired), at the next list reload. Under maintenance it is only hidden. Adds one function to `browserOnly.tsx` and one call in `serverData.tsx`.
   - **Recommendation: (b).** An old request cannot come back as a phantom when the asset is lent again, which UAT testers repeating a flow would meet.
3. **How Custody Transitions shows a returned loan.** Custody Transitions (Lab Head). Today it knows only Pending, Approved, and Declined, so a returned loan gets a plain badge, an amber edge, an unfinished timeline, and drops out of "Completed This Period".
   - (a) Leave it for #55 (Lab Head screens, unassigned).
   - (b) One small web commit here (commit 7): "Returned" shows green, counts as completed, and its timeline is complete. Touches `LabHeadDashboard.tsx` only.
   - **Recommendation: (b).** Every return creates such a loan from this branch on, and UAT Lab Heads would otherwise see it as stuck.
4. **Loans returned before this branch** (H11 counts them on CCS Cloud). Health Benchmarking (Lab Head), the bell's reminders (all roles). They stay approved, so they still count as overdue or as active loans.
   - (a) Leave them. With question 1 (a) each one closes the next time its asset is returned. The team knows how many from H11.
   - (b) Close them with a one-time data migration in `prisma/migrations/`. That changes CCS Cloud when it is deployed and needs your go-ahead for a migration.
   - **Recommendation: (a).** No database change on the day before UAT; H11 tells you whether it matters.

**Answers (Raiki, 2026-10-20):** 1 (a), 2 (b), 3 (b), 4 (a). H11 was run on CCS Cloud (read-only); its result, and what 4 (a) means for UAT, are under "Group H hand checks".

### 9. Stop 2: what was built (2026-10-20)

On `fix/99-returns`, in the planned order. After every commit: typecheck **65**, build passes, `npm test` as below. Nothing pushed.

| Commit | Kind | What it does | Tests |
|---|---|---|---|
| `59d6c599` | **Behavior change** (H-04) | In the return's transaction, every approved loan of the asset becomes `returned` (answer 1a); the TODO(H-04) lines go, or are narrowed to loans returned before this branch | **413** |
| `684f0212` | **Behavior change** (#99) | Pending Returns passes the clicked request to `ReturnForm`, which shows and marks only that one | **413** |
| `cc8a1190` | **Behavior change** (#99) | A refused or failed finalize stays on the form with "The return was not recorded: ..." in red and marks nothing; only a success shows "Return Ledger Closed" | **413** |
| `791dd3ba` | **Behavior change** (#59) | "Assigned on finalize" until the server's CLR number; no random or borrowed number | **413** |
| `365957eb` | **Behavior change** (#99) | `openReturnRequests` hides requests whose asset is not On Loan or Overdue (Pending Returns, Overview, the bell); `dropReturnRequests` removes those whose asset is Active or Disposed after each asset list load (answer 2b) | **413** |
| `e178991b` | **Behavior change** (#99) | Record Return for Staff in the asset detail modal, on an On Loan or Overdue asset | **413** |
| `d0e9b5d0` | **Behavior change** (answer 3b) | Custody Transitions shows a Returned loan as completed | **413** |
| this commit | Docs and comments | The `returnRefusal` comment; this section, the hand check results, `docs/README.md`, `docs/HANDOFF.md` | **413** |

**Test count: 410 to 413**, all in the first commit, as planned in section 4. The typecheck stayed at **65** in every commit. No schema, migration, `package.json`, or CCS Cloud change.

#### Differences from the plan, and why

- **The bell changed by one line, not two:** the loop runs over `openReturnRequests(returns, assets)`, and its section comment says so. The `if (ret.status === "Pending")` under it stays (now always true, but removing it would reindent the whole block in a teammate's file). Nothing else in `NotificationCenter.tsx` changed.
- **`dropReturnRequests` takes asset tags, not request ids.** `serverData.tsx` holds the asset list but not the requests, so after each successful asset list load it passes the tags of the assets that are Active or Disposed, and `browserOnly.tsx` removes the Pending requests for them. If the list fails to load, nothing is dropped.
- **Pending Returns and the Overview filter against `useServerData().assets`**, the list that reloads after every finalize, not the page's own `useStaffAssets` copy, which loads once.
- **H5's expectation changed with answer 2b:** after the 409, the reload drops the request because its asset is now Active, so it is not "still Pending" as the plan wrote. What matters held: it is never marked Finalized and no success screen shows. H5b was added for the case where the request must stay: the server cannot be reached.
- **Commit 1 also corrected the header of `tests/api/returns.test.ts`**, which said TEST-0002 is returned "for H-04".
- **H3's readings before the finalize** were lost to a script error after the run; H4 took the same readings (the count, the bell, the certificate field), and they passed.

#### What every teammate must do

Pull and run `npm test` once (413). After a return, a loan's status is "Returned" (`asset_loans.status = 'returned'`); a screen that lists loans by status should treat it as finished, as the bell, the analytics, and now Custody Transitions do.

### Noticed, not in this branch

- **A pending transfer survives a return.** A transfer can be requested on an asset on loan; after the return the asset is Active, and group A's approval check allows Active, so approving the old transfer gives the returned asset to the recipient. Same before this branch; for the transfer rules (issue #22).
- **The browser still makes up a `certId`** when a request is marked (`browserOnly.tsx:93`). After #59 no screen shows it; it goes with the request when Phase 3 moves it to `asset_returns`.
- **Record Return is not offered on an Active asset held by a person** (given through Edit Asset), which the server accepts (group A answer 1b). The issue asks for On Loan assets only.
- **The bell matches a Custodian's return cards by name** (`NotificationCenter.tsx:323`, `ret.custodian === currentUserName`, issue #32 style). Left for the bell rewrite.
- **The loan list names loan 9 "ASUS TUF Gaming A15"** whatever its asset (`listLoans`, part of the H-08 seed block). Seen in H8; on CCS Cloud it shows only if a real loan has id 9.
- **Staff see Send to Maintenance on an asset already under maintenance** (the modal's last branch). Seen in H9; harmless, its own fix.
