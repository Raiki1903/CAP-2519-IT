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
| H | `fix/99-returns` | #99, with #59 as a rider | Merged in PR #108; the agent's hand checks H1 to H10 and H12 passed on the local test database; H11 (CCS Cloud, read-only) run by Raiki | Plan `a2d316bb`; `59d6c599`, `684f0212`, `cc8a1190`, `791dd3ba`, `365957eb`, `e178991b`, `d0e9b5d0`; docs and comments: `44dcb6bd` | **65** (unchanged) | **410** to **413** | 2026-10-20 |
| F | `fix/92-data-loading` | #92, with #57 and #89 | Merged in PR #109; the agent's hand checks H1 to H9 passed on the local test database | Plan `14f01629`; `05fccb46`, `c40280b9`, `03a7fb1c`, `e8208ddb`, `059ee8bb`, `f3516874`, `128dce87`, `22ad1dd0`; docs: the last commit | **65** (unchanged) | **413** (unchanged) | 2026-10-20 |
| Pre-deploy | `fix/pre-deploy` | H-08, H-13 (the disposal card), disposed assets in the inspection queue (with H-16 there), past loan due dates | Merged in PR #114; the agent's hand checks H1 to H4 passed on the local test database | `5aad7d4f`, `b25ee9cd`, `1a8dc20a`, `518c0159`; docs: the last commit | **65** (unchanged) | **413** to **415** | 2026-10-20 |
| W | `fix/uat1-labels-ui` | UAT session 1: labels L1 to L10, small UI U2, U8, U10, U13, U14, phone check M1 | Built; the agent's hand checks H1 to H13 passed on the local UAT copy (H13 on the local test database); pull request next | Plan `c6bb7581`; `cafc2810` to `34bb6ca5` (22 commits, section 8); docs: the last commit | **65** (unchanged) | **415** (unchanged) | 2026-10-23 |

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

---

## Group F: data loading (fix/92-data-loading)

Issue #92 (the Director and Lab Head dashboards ask for the same lists up to 9 times after login), with #57 (a loan decided in the bell or in Custody Transitions does not show in the other) and #89 (the asset detail modal shows an older status than the list it was opened from). Branch `fix/92-data-loading` from `main` at `0053be6b` (groups A and H merged). Baseline there: typecheck **65**, `npm run build` passes, `npm test` **413** passed. Web only: no schema, migration, server, or test change. The goal for UAT on the slow CCS Cloud database is fewer requests with the same screens; pages loading their own data (01D) and the asset list rewrite (#76) stay after UAT.

### 1. Where the code is now, and the change

Line numbers are on `main` at `0053be6b`.

#### #92, cause 1: every page mounts twice when the URL changes

**Now.** Login sends the user to the role's tree, not to a tab: `navigate(`/${roleToSlug[determinedRole]}`)` in `handleSubmit`, [Login.tsx:78](../../web/pages/auth/Login.tsx#L78). Each tree's index route redirects to the default tab (`<Navigate to="overview" replace />` and the like, [routes.tsx](../../web/app/routes.tsx), the four `index: true` lines). `RootLayout` ([RootLayout.tsx:146-156](../../web/app/layouts/RootLayout.tsx#L146-L156)) wraps the page in `<AnimatePresence mode="wait">` with a `motion.div` keyed by `location.pathname`, and puts `<Outlet />` inside it. When the path changes, the leaving `motion.div` stays on screen for its 0.22 s fade, and its `<Outlet />` reads the router's current match, so it renders the **new** page. Then the entering `motion.div` mounts the new page again. So every page mounts twice on every URL change: after login (`/adric-director` to `/adric-director/overview`) and on every tab click. On a tab click of the Director, Lab Head, or Custodian screen, the leaving copy is the old dashboard instance with a new `activeTab`, so its `[activeTab]` effect runs once more as well. The network log confirms it (section 2): the Director's tab click asks for `/api/analytics/director` twice, once per mount.

**Change.** `RootLayout` keeps the page element it rendered: `const outlet = useOutlet();` (from `react-router`, next to the other hooks at the top of the function, before the early returns, so the hook order never changes), and the `motion.div` renders `{outlet}` instead of `<Outlet />`. `AnimatePresence` then keeps the old element in the leaving wrapper, so the old page fades out and the new page mounts once. The import line (line 8) swaps `Outlet` for `useOutlet`. Nothing else in the file changes. `Login.tsx` and `routes.tsx` do not change: with the frozen outlet, the leaving wrapper after login holds only the index `<Navigate>`, which renders nothing, so going straight to the default tab would save no request.

#### #92, cause 2: two loading effects per dashboard

**Now.** Every tab change already remounts the dashboard (cause 1, the key), so an effect with `[]` and one with `[activeTab]` both run on every mount.

| Screen | Effects (line) | Each mount asks for |
|---|---|---|
| Director, `AdRICDirectorDashboard` | `[]` (233-237) and `[activeTab]` (239-243), each calls `fetchDbAssets()`, `fetchDbDisposals()`, `syncFromDb()` | assets 2 + 2, disposals 2 + 2, and the four other shared lists 2 each |
| Lab Head, `LabHeadDashboard` | assets: `[fetchDbAssets]` (195-197) and `[activeTab]` for Branch Inventory (199-203); loans: 249-251 and 253-257 for Custody; transfers: 315-317 and 319-323 for Custody | assets 1 (2 on Branch Inventory), loans 2 and transfers 2 on Custody (1 each elsewhere) |
| Custodian, `CustodianPortal` | `[]` (122-124) and `[activeTab]` for My Assets, Available Equipment, and Send Inspection Report (128-132) | assets 2 (1 on QR Scan) |
| Staff pages | `useStaffAssets` (`useStaffAssets.ts:44`), `useRepairTickets` (line 48), `useInspectionReports` (line 30): one `[]` effect each | 1 per hook: no duplicate effect; Staff's extra requests come from cause 1 only |

**Change.** One loading effect per dashboard, keyed on `[activeTab]`, which loads what the mount loads today, once:
- **Director** (lines 233 to 243): one effect, `fetchDbAssets()` and `fetchDbDisposals()`, `[activeTab]`. The `syncFromDb()` calls go (cause 3).
- **Lab Head** (the six effects at 195-203, 249-257, 315-323): one effect after `fetchTransferRequests` is defined, calling `fetchDbAssets()`, `fetchLoanRequests()`, `fetchTransferRequests()`, with `[activeTab, fetchDbAssets, fetchLoanRequests, fetchTransferRequests]` (all three are `useCallback` with stable dependencies, so it runs once per tab). Every tab still gets all three lists, as each mount does today.
- **Custodian** (lines 122 to 132 only): one effect, `fetchDbAssets()`, `[activeTab]`, on every tab (QR Scan included, as the `[]` effect does today). The comment above it says so.
- **Staff:** nothing to change.

#### #92, cause 3: `syncFromDb()` from a page that loads the same lists

**Now.** `syncFromDb()` in [serverData.tsx:203-283](../../web/state/serverData.tsx#L203-L283) asks, one after another, for assets, transfers, reports (Staff, Director), loans, disposals (Staff, Director, Lab Head), and repairs, then re-reads the browser lists and drops finished return requests (`reloadFromStorage`, `dropReturnRequests`, group H). `ServerDataProvider` runs it once when the role is set (line 344). The Director dashboard runs it twice more per mount (lines 236 and 242), although it loads its own assets and disposals. No other page calls it on load; forms call it after a save, the bell after a decision.

**Change.** The Director dashboard no longer calls `syncFromDb()` when a tab opens (above). The provider's call at login stays, so the bell and the shared lists load once. `syncFromDb()` itself is unchanged by #92: `openReturnRequests()` and the `dropReturnRequests()` call keep working as group H left them. With question 1 (a), Approvals and Holds calls `syncFromDb()` once after a successful decision (line 253, after `fetchDbDisposals()`), so the bell drops the disposal card; today the next tab click does that.

#### #57: the bell and Custody Transitions keep separate loan lists

**Now.**
- The bell (`NotificationCenter.tsx`) builds its loan cards from `dbLoans` (line 51), the shared list. Its Authorize Loan button (lines 756 and 757) calls `authorizeLoan` ([serverData.tsx:397-412](../../web/state/serverData.tsx#L397-L412), which changes the one loan's status in `dbLoans`) and then `syncFromDb()`.
- Custody Transitions keeps its own `loanRequests` ([LabHeadDashboard.tsx:228](../../web/pages/lab-head/LabHeadDashboard.tsx#L228)), filled by `fetchLoanRequests` (lines 232 to 247, `loansApi.listLoans()`) when the tab opens, and shown through `branchLoanRequests` (line 501). Its Authorize and Decline buttons call `decideLoan` (lines 261 to 278), which reloads only `loanRequests` (line 270).

So a decision in the bell leaves Custody Transitions showing the loan as Pending until the tab is opened again (and clicking Authorize there then gets the group A 409), and a decision in Custody Transitions leaves the bell card until the next `syncFromDb()`. `dbLoans` loads at login and after any save that calls `syncFromDb()`.

**Change.** One loan list, the shared `dbLoans`:
- `serverData.tsx`: a new `reloadLoans()`, wrapped in `useCallback` so it is stable: `loansApi.listLoans()`, `setDbLoans` on success, and it returns the answer. The loan block in `syncFromDb()` (lines 242 to 247) calls it, so the request and the list are the same. It is added to the context type and value, with TSDoc.
- `LabHeadDashboard.tsx`: the `loanRequests` state goes; `branchLoanRequests` filters `dbLoans`. `fetchLoanRequests` keeps its loading flag and red error line but calls `reloadLoans()` instead of `loansApi.listLoans()`. `decideLoan` is unchanged: after a success it calls `fetchLoanRequests()`, which now reloads the shared list, so the bell drops the card.
- The bell is **not changed**: its path already reloads `dbLoans`, which Custody Transitions now shows. Transfers stay as they are (question 3).

#### #89: the asset detail modal prefers the shared list

**Now.** [AssetDetailModal.tsx:98](../../web/features/assets/AssetDetailModal.tsx#L98): `const asset = propAsset ? (assets.find(a => a.id === propAsset.id) || propAsset) : null;`. The shared `assets` copy wins whenever it exists. It loads at login and after any `syncFromDb()`. My Assets and Available Equipment show `CustodianPortal`'s own list (`displayedAssets`, line 134), which reloads on every tab change (`fetchDbAssets`, lines 104 to 132) and never refreshes the shared one. So after a Lab Head approves a Custodian's loan, the Custodian's next tab click shows the asset On Loan in My Assets, while the modal still reads the login-time copy: Active, with Request Loan. The same holds for the Lab Head's Branch Inventory and the Staff Asset Inventory, which also show their own lists. The shared copy is preferred on purpose: after a form inside the modal saves, `syncFromDb()` runs and the modal shows the new status (group H relies on it: after Record Return the modal shows the asset Active, "None").

**Change (question 2, a).** The modal shows the copy it was opened with, until the shared list reloads after it opened:
- `serverData.tsx`: a counter `assetsVersion`, raised by one each time `syncFromDb()` stores a new asset list (next to `setAssets`, line 211), in the context type and value.
- `AssetDetailModal.tsx`, line 98: the modal remembers the `assetsVersion` at the moment an asset is opened (state keyed by the asset tag, set during render when the tag changes, so the first frame is already right). It uses the shared copy only when `assetsVersion` is higher than that, otherwise `propAsset`. The TSDoc of `asset` (lines 92 and 93) says so.

So the modal opens with the status of the row that was clicked, and after a save inside the modal it still shows the reloaded status. `CustodianPortal.tsx` is **not changed** for #89.

### 2. Request counts per role

Measured by Playwright on the local `AdRIC_DB_test` (seeded by the test harness, nothing else), `main` at `0053be6b`, 2026-10-20: `GET /api/...` requests, not counting `/api/auth`. "Login" is the 6 s after Sign In; "tab" is the 5 s after one sidebar click. Every login also sends `POST /api/auth/login` and `GET /api/auth/me` (1 each, unchanged); the Lab Head also `GET /api/auth/pending-registrations` (1, unchanged). The Director's 38 plus `/me` are the issue's 39.

| Role | Moment | Before (measured) | After (expected) |
|---|---|---|---|
| Director | Login, Executive Overview | **38**: assets 9, asset_disposals 9, asset_transfers 5, asset_reports 5, asset_loans 5, asset_repairs 5 | **8**: assets 2, asset_disposals 2, the other four 1 each |
| Director | Tab, Descriptive Analytics | **26**: analytics/director 2, assets 6, asset_disposals 6, asset_transfers 3, asset_reports 3, asset_loans 3, asset_repairs 3 | **3**: analytics/director 1, assets 1, asset_disposals 1 |
| Lab Head | Login, Custody Transitions | **15**: assets 3, asset_loans 5, asset_transfers 5, asset_disposals 1, asset_repairs 1 | **8**: assets 2, asset_loans 2, asset_transfers 2, asset_disposals 1, asset_repairs 1 |
| Lab Head | Tab, Branch Inventory | **5**: assets 3, asset_loans 1, asset_transfers 1 | **3**: 1 each |
| Staff | Login, System Overview | **10**: assets 3, asset_repairs 3, asset_transfers 1, asset_reports 1, asset_loans 1, asset_disposals 1 | **8**: assets 2, asset_repairs 2, the other four 1 each |
| Staff | Tab, Asset Inventory | **2**: assets 2 | **1** |
| Custodian | Login, My Assets | **8**: assets 5, asset_transfers 1, asset_loans 1, asset_repairs 1 | **5**: assets 2, the other three 1 each |
| Custodian | Tab, Available Equipment | **3**: assets 3 | **1** |

Why "after" is not 1 each: at login the provider loads the shared lists for the bell, and the page loads its own copy of the lists it shows (the second `assets`, and the Lab Head's second loans and transfers). Merging those copies is 01D and #76, after UAT. With question 1 (a), a disposal decision on Approvals and Holds adds one `syncFromDb()` (6 requests), only when the Director decides one. `GET /api/assets` is the slow one (it reads nine tables, `TODO(M-01)`), and it goes from 9 to 2 for the Director at login.

### 3. Tests

`npm test` runs only `tests/**/*.test.ts` (API and seed), and every commit here is web only, so **no test changes or is added**, and the count stays **413** after every commit. The typecheck stays **65** (no new types expected; `reloadLoans` and `assetsVersion` are typed in the context; if the count moves, the report says why). The checks are the hand checks below.

| Commit | Tests | Count after |
|---|---|---|
| 1 to 6 | none (web) | **413** |
| 7 (docs) | none | **413** |

### 4. Screens and roles that see a difference

| Screen (role) | Issue | What changes |
|---|---|---|
| Every signed-in screen (all roles) | #92 | Each page mounts once per URL change; fewer requests (section 2). The fade between tabs shows the old page fading out, then the new one fading in |
| Executive Overview, Descriptive Analytics, Approvals and Holds, Audit Generator (Director) | #92 | Opening a tab loads assets and disposals once and no longer reloads the bell's lists. With question 1 (a), a decision there reloads them |
| Custody Transitions (Lab Head) | #57 | A loan decided in the bell shows Approved or Declined at once; a decision here removes the bell card. A refusal still shows in the red line |
| The bell (Lab Head) | #57 | Its loan cards follow decisions made in Custody Transitions. No code change in the bell |
| Asset detail modal (Custodian, Lab Head, Staff) | #89 | Opens with the status of the list it was opened from; after a save inside it, shows the reloaded status as today |
| My Assets, Available Equipment, QR Scan, Send Inspection Report (Custodian) | #92 | One asset request per tab instead of two or three |

**The page transition.** The animation (fade and slide, 0.22 s, `mode="wait"`) is the same; what changes is the content of the leaving wrapper. Today it fades out a second copy of the new page, so a tab click shows the new page twice (fade out, then fade in). After, the old page fades out and the new one fades in, which is what the code means. Risks, each checked by H2: (1) the old page stays mounted 0.22 s longer with its old props; no page under `web/pages` or `web/features` reads `useLocation`, `useParams`, or `useSearchParams`, so none reacts to the new URL meanwhile. (2) The index `<Navigate>` stays in the leaving wrapper after login; its target is worked out from its own route, so it does not navigate again (H1 counts would show a repeat). (3) A form or dialog open on the old page fades out with it, as today.

**Teammates' files.**
- `CustodianPortal.tsx` (Joel, #88 web part): **only lines 122 to 132**, the two effects and their comment, become one effect of four lines. Nothing in the Send Inspection Report code (`handleSubmitReport`, line 330 on) or elsewhere.
- `NotificationCenter.tsx` (Joel, #55): **not touched**.
- `LabHeadDashboard.tsx` (#55's Lab Head return cards are in the bell, not here; #96 dashboard numbers may be): lines 195 to 203, 228 to 257, 270 (unchanged, now reloads the shared list), 315 to 323, 501, the `useServerData()` line (165), and the header and TSDoc.
- `AdRICDirectorDashboard.tsx` (#96 may touch the numbers): lines 112 (the `syncFromDb` name, kept with question 1 a), 233 to 243, 253 with question 1 (a), and the TSDoc at line 101.
- `IntakeWizard.tsx` (Aryan, #102): not touched. It calls `syncFromDb()` after a save, which keeps working.
- Shared by everyone: `RootLayout.tsx` (lines 8, 27 (the new hook), and 154) and `serverData.tsx` (new `reloadLoans`, `assetsVersion`; the loan block of `syncFromDb`).

### 5. Stop 2 plan

On `fix/92-data-loading`, in this order. After each commit: `npm run typecheck` (65) and `npm test` (413). Commit, never push.

| # | Commit message | Files |
|---|---|---|
| 1 | `fix(layout)!: mount each page once during the page transition (#92)` | `web/app/layouts/RootLayout.tsx` (`useOutlet`, the header's "Calls") |
| 2 | `fix(director)!: load each Director list once per tab (#92)` | `web/pages/director/AdRICDirectorDashboard.tsx`: one effect, no `syncFromDb()` on load; with question 1 (a), one `syncFromDb()` after a decision; the TSDoc |
| 3 | `fix(lab-head)!: load each Lab Head list once per tab (#92)` | `web/pages/lab-head/LabHeadDashboard.tsx`: the six effects become one; the comment above `dbAssets` |
| 4 | `fix(custodian)!: load the Custodian asset list once per tab (#92)` | `web/pages/custodian/CustodianPortal.tsx`, lines 122 to 132 only |
| 5 | `fix(lab-head)!: Custody Transitions and the bell share one loan list (#57)` | `web/state/serverData.tsx` (`reloadLoans`, the loan block of `syncFromDb`, the TSDoc list), `LabHeadDashboard.tsx` (`loanRequests` goes, `fetchLoanRequests` calls `reloadLoans`, the header) |
| 6 | `fix(assets)!: the asset modal shows the list it was opened from (#89)` | `web/state/serverData.tsx` (`assetsVersion`), `web/features/assets/AssetDetailModal.tsx` (line 98, its TSDoc) |
| 7 | `docs(group F): record the build` | This log ("Stop 2: what was built", the hand check results), `docs/README.md`, `docs/HANDOFF.md` |

With question 2 (b), commit 6 is instead `fix(custodian)!: the Custodian screens show the shared asset list (#89)`, in `CustodianPortal.tsx` (its own list goes; a new `reloadAssets()` in `serverData.tsx`) and the modal is not changed. With question 3 (b), commit 5 also moves Custody Transitions' transfers onto `dbTransfers`. Then `npm run build`, the hand checks below (the agent's, on the local test database), the report, and stop.

### 6. Hand checks

#### Group F hand checks

**H1 to H9: the agent, in a browser (Playwright MCP), on the local test database `AdRIC_DB_test` only**, after stop 2. Raiki may run any of them again the same way. Before starting: stop any `npm run dev:all` and make sure ports 4000 and 5173 are free. The start script `%TEMP%\adric-groupF-handchecks\start.mts` (group H's, without the extra assets) empties and seeds the test database through the test harness, moves the fixture emails to `@dlsu.edu.ph`, and starts the server; Vite runs with `VITE_API_URL=http://localhost:4000`. Reads go through `q.mts` beside it (SELECT only). Each role gets its own browser context; "context 1" and "context 2" stand for two computers. Screenshots go to `%TEMP%\adric-groupF-handchecks\screenshots\`; `.playwright-mcp` is deleted from the repository afterwards. The before counts in section 2 were measured this way on 2026-10-20 (`before-counts.txt` beside the script). Seeded assets used: TEST-0001 (Active, nobody holds it), TEST-0002 (on loan to Custodian A), TEST-0005 (Active, pending loan LOAN-2 from Custodian B), TEST-0006 (Active). **No check touches CCS Cloud.**

| # | Issue | Role and screen | Steps | Expected | Database |
|---|---|---|---|---|---|
| H1 | #92, the old bug: request counts | Director, Lab Head, Staff, Custodian, each in a new context | Log in; count the `GET /api/` requests (not `/api/auth`) in the network log for 6 s; click the tab of section 2; count for 5 s | The "After" column of section 2, each list exactly. Any list above it fails the check | Local test |
| H2 | #92, nearby: the transition | Each role | Click every sidebar tab once, slowly; reload the browser on `/lab-head/inventory` and on `/custodian/available`; log out and log in as another role | Each tab shows its own screen after one fade; no blank page, no second fade of the same page; the reloads open the typed tab (issue #49); the console shows no new error | Local test |
| H3 | #57, the old bug: bell to Custody | Lab Head, Custody Transitions | Note LOAN-2 (TEST-0005) Pending and the "Pending" count. Open the bell, Authorize Loan on LOAN-2. Do not click any tab | Custody Transitions shows LOAN-2 Approved and the Pending count one lower, without a tab click; the bell card is gone | Local test |
| H4 | #57, the old bug: Custody to bell | Context 1: Custodian A, Available Equipment. Context 2: Lab Head | Context 1: TEST-0001, Request Loan. Context 2: log in, open the bell (the TEST-0001 card is there), close it; Custody Transitions, Decline the TEST-0001 loan; open the bell | The loan shows Declined; the bell has no TEST-0001 card | Local test |
| H5 | #57, nearby: a new request appears | Context 1: Custodian B. Context 2: Lab Head, on Branch Inventory | Context 1: TEST-0006, Request Loan. Context 2: click Custody Transitions | The new TEST-0006 loan is listed Pending (the tab still reloads the list when it opens) | Local test |
| H6 | #89, the old bug | Context 1: Custodian B, Available Equipment. Context 2: Lab Head, Custody Transitions | Context 1 logs in first. Context 2: Authorize the TEST-0006 loan (H5). Context 1: click My Assets; open TEST-0006 | My Assets lists TEST-0006 On Loan; the modal shows On Loan and Custodianship Transfer, Request Repair, Return Asset; no Request Loan | Local test |
| H7 | #89, nearby: the modal after a save | Staff, Asset Inventory | Open TEST-0002 (On Loan), Record Return, Operational, finalize; close the success screen | The modal shows TEST-0002 Active, custodian "None", no Record Return (group H, H1) | Local test |
| H8 | #92, question 1 | Staff, then Director | Staff: Asset Inventory, Decommission TEST-0001 (Active after H4). Director: log in; the bell has the disposal card; Approvals and Holds, Reject & Recirculate it | With 1 (a): the bell card is gone at once. With 1 (b): it stays until the next reload. TEST-0001 stays Active | Local test |
| H9 | All | The agent, terminal | `npm run typecheck`, `npm run build`, `npm test` with the browser, server, and Vite stopped | 65, passes, 413 | Local test |

**Results (2026-10-20). H1 to H9: all passed** (the agent, on the local `AdRIC_DB_test` only). No check touched CCS Cloud.

How they ran: a real browser (Chrome, driven by the Playwright MCP) against Vite at `http://localhost:5173` (started with `VITE_API_URL=http://localhost:4000`) and `server/main.ts` on port 4000, started by `%TEMP%\adric-groupF-handchecks\start.mts`, which empties and seeds the test database through the test harness and its guard (it takes only `TEST_DATABASE_URL` from `.env`, as `npm test` does; the agent did not open `.env` or `pending_registrations.json`). Ports 4000 and 5173 were free before each start; afterwards their processes were ended by PID and the ports checked free. Each role, and each "computer", had its own browser context. Reads went through `q.mts` (SELECT only); nothing was written to the database by hand. `npm test` resets the same test database, so after each test run during the build the start script was run again before the next check (H6 to H8 ran on a fresh seed). Screenshots are in `%TEMP%\adric-groupF-handchecks\screenshots\`, the console logs in `playwright-logs\`, the H9 output in `h9-npm-test.txt`, and the before counts in `before-counts.txt`, all beside the start script. `.playwright-mcp` was deleted from the repository afterwards. H1 and H2 were run again on the final commit, with the same results.

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| H1 | Passed | `GET /api` (not `/api/auth`), 6 s after login and 5 s after one tab click. **Director** login 7 (assets 1, asset_disposals 2, asset_transfers 1, asset_reports 1, asset_loans 1, asset_repairs 1); tab (Descriptive Analytics) 8 (analytics/director 1, asset_disposals 2, the other five shared lists 1 each). **Lab Head** login 8 (assets 2, asset_loans 2, asset_transfers 2, asset_disposals 1, asset_repairs 1); tab (Branch Inventory) 3 (1 each). **Staff** login 8 (assets 2, asset_repairs 2, the other four 1 each); tab (Asset Inventory) 1. **Custodian** login 5 (assets 2, the other three 1 each); tab (Available Equipment) 1. The Director's counts are the ones of the changed commit 2 (see section 8), the others are section 2's "After" exactly | none (network log) |
| H2 | Passed | Every sidebar tab of every role, in turn (Director 4, Lab Head 4, Staff 8, Custodian 4): the URL is the tab's; 60 ms after the click the page area holds one wrapper showing the **old** page (the leaving copy keeps its content), and 1.2 s later one wrapper with the new page. Reloads on `/lab-head/inventory` and `/custodian/available` open those tabs; Sign Out goes to `/login` and the Lab Head then lands on Custody Transitions. Console: only React's development warning about `ref` (from `AnimatePresence` in the bell, seen in groups A and H). Requests per click, Lab Head: 3 per tab, Health Benchmarking 8 (its own analytics, 5); Staff: 0 to 4 (each page's own lists, once); Custodian: 1; Director: 1 or 2, and 7 when the shared reload runs (more than 5 s since the last one) | none |
| H3 | Passed | Lab Head, Custody Transitions: LOAN-2 (TEST-0005) Pending. The bell, Authorize Loan on it, no tab click: Custody Transitions shows LOAN-2 Approved; its bell card is gone. The bell then showed a new LOAN-9 card: with no pending loan left, the loan list wrote loan 9 as pending (the known `TODO(H-08)` in `loans.service.ts:29`, not this branch); it is the "1 Pending" | `h3-1-bell-approve-shows-in-custody.png` |
| H4 | Passed, on LOAN-9 | A new TEST-0001 request could not be filed (LOAN-9, from H-08, was already pending on it), so LOAN-9 was used. The bell had its card; Custody Transitions, Decline on LOAN-9: it shows Declined, and the bell has no LOAN-9 card | `h4-1-custody-decline-leaves-bell.png` |
| H5 | Passed | Lab Head on Branch Inventory. Custodian B (another context): Available Equipment, TEST-0006, Request Loan: "Loan Request Lodged". Lab Head clicks Custody Transitions: the TEST-0006 loan is listed Pending | `h5-1-new-request-on-tab-open.png` |
| H6 | Passed (after commit `128dce87`) | Custodian B requests TEST-0006; the Lab Head (another context) authorizes it; Custodian B clicks My Assets: TEST-0006 On Loan, due Nov 15, 2026; opens it: status On Loan, buttons Custodianship Transfer, Request Repair, Return Asset; no Request Loan; one `GET /api/asset_loans` when the asset opened. The first run (before `128dce87`) showed On Loan and Return Asset but "Your request is pending" in place of Custodianship Transfer (section 8) | `h6-1-modal-matches-my-assets.png` |
| H7 | Passed (after commit `22ad1dd0`) | Staff, Asset Inventory, TEST-0002 (On Loan): Record Return, Operational, Finalize: "Return Ledger Closed"; Close. The list row shows TEST-0002 custodian None, OPERATIONAL, ACTIVE; reopened, the modal has no Record Return (Send to Maintenance only). The first run (before `22ad1dd0`) left the row On Loan and the reopened modal offered Record Return again (section 8) | `h7-0-reopen-after-record-return.png` (the first run), `h7-1-record-return-closed.png`, `h7-2-modal-after-return.png` |
| H8 | Passed, with a second part | TEST-0002 (Active after H7) instead of TEST-0001 (on loan by then). The Director logs in first; bell: no disposal card. Staff (another context) Decommissions TEST-0002: "Disposal Request Submitted". The Director's bell still has none; more than 5 s later the Director clicks a tab: 7 requests (`asset_disposals` and the six shared lists), and the bell has the card (counted on Descriptive Analytics, so the queue's own button is not counted). Approvals and Holds, Reject & Recirculate: `PUT /api/asset_disposals/<n>/decision`, then the disposal list and the shared reload; the bell has no card at once (answer 1a). Run twice, same result; TEST-0002 stays Active | `h8-1-reject-bell-updated.png` |
| H9 | Passed | With the browser, server, and Vite stopped: typecheck **65**, build passes, `npm test` 16 files, **413 passed** | `h9-npm-test.txt` |

### 7. Questions for Raiki

1. **Should a disposal decision on Approvals and Holds also refresh the bell?** Approvals and Holds and the bell (Director). Today the bell's disposal card goes after the Director's next tab click, because each tab reloads every shared list; this branch stops that reload, which costs 6 requests per tab.
   - (a) After a successful Authorize or Reject there, reload the shared lists once (`syncFromDb()`), so the bell card goes at once. 6 requests per decision, none per tab.
   - (b) No reload: the card stays until the next login or save elsewhere.
   - **Recommendation: (a).** Decisions are rare and the bell stays right; tab clicks stay cheap.
2. **How #89 is fixed.** The asset detail modal (Custodian My Assets and Available Equipment; also Lab Head Branch Inventory and Staff Asset Inventory).
   - (a) The modal shows the row it was opened from, and switches to the shared list only after that list reloads (after a save in the modal). Changes the modal and `serverData.tsx`; `CustodianPortal.tsx` is not touched.
   - (b) The Custodian screens drop their own asset list and show the shared one, reloaded on each tab change. List and modal then read one list, but it changes more lines in `CustodianPortal.tsx`, which Joel is editing for #88, and fixes only the Custodian side.
   - **Recommendation: (a).** Smaller, stays out of Joel's file, and fixes all three roles the same way.
3. **Transfers in Custody Transitions too?** Custody Transitions and the bell (Lab Head). The same split exists for transfers: the bell reloads the shared list after a transfer decision, but Custody Transitions keeps its own list until the tab opens again.
   - (a) Loans only, as #57 asks. Transfers after UAT.
   - (b) Transfers too, in commit 5. The shared transfer list is filled first from rows inside the asset list, which have a different shape, so the transfer table would need checks for that.
   - **Recommendation: (a).** The issue is about loans, and the transfer list's mixed shape is a risk the day before UAT.

**Answers (Raiki, 2026-10-20):** 1 (a), 2 (a), 3 (a). Also asked: list every screen or bell card that relied on the Director's tab-click reload, say how each still refreshes, and fix any that would stay stale until the next login with one reload after the action. That list is in section 8.

### 8. Stop 2: what was built (2026-10-20)

On `fix/92-data-loading`, in the planned order, with two commits added after hand checks found them (H6, H7). After every commit: typecheck **65**, build passes, `npm test` **413**. Nothing pushed.

| Commit | Kind | What it does | Tests |
|---|---|---|---|
| `05fccb46` | **Behavior change** (#92) | `RootLayout` renders `useOutlet()`; each page mounts once per URL change, and the leaving wrapper fades out the old page | **413** |
| `c40280b9` | **Behavior change** (#92, answer 1a) | Director: one effect per tab loads the disposal queue and calls the new `refreshSharedLists()` (skipped when a reload started less than 5 s ago or is running, as at login); the dashboard shows the shared asset list instead of its own copy; a decision on Approvals and Holds reloads the shared lists | **413** |
| `03a7fb1c` | **Behavior change** (#92) | Lab Head: the six effects become one per tab | **413** |
| `e8208ddb` | **Behavior change** (#92) | Custodian: one effect per tab (`CustodianPortal.tsx`, the lines 122 to 132 only) | **413** |
| `059ee8bb` | **Behavior change** (#57) | `reloadLoans()` in `serverData.tsx`, the one loader of `dbLoans` (`syncFromDb()` uses it); Custody Transitions shows `dbLoans` and reloads through it. The bell is not changed. Transfers stay (answer 3a) | **413** |
| `f3516874` | **Behavior change** (#89, answer 2a) | `assetsVersion` in `serverData.tsx`; the modal shows the row it was opened from until the shared list reloads after that | **413** |
| `128dce87` | **Behavior change** (#89, added) | The modal reloads the loan list (one request) each time an asset opens | **413** |
| `22ad1dd0` | **Behavior change** (#89, added) | `useStaffAssets` shows the shared list once it has reloaded after the page's own list arrived (no extra request) | **413** |
| this commit | Docs | This section, the hand check results, `docs/README.md`, `docs/HANDOFF.md` | **413** |

**Test count: 413 in every commit** (all web changes; no test file changed). The typecheck stayed at **65** in every commit. No schema, migration, server, `package.json`, or CCS Cloud change. `NotificationCenter.tsx` is not touched; `CustodianPortal.tsx` only at the planned lines.

#### What relied on the Director's tab-click reload, and how it refreshes now

Only the Director dashboard called `syncFromDb()` when a tab opened, so only a Director session relied on that reload; no Staff, Lab Head, or Custodian screen or bell card did (their screens reload their own lists per tab, as before; their bells refresh at login, at a browser reload, and after their own saves and decisions, as before). In a Director session the reload refreshed every shared list, which is the only way that session picked up **other people's** changes:

| What the Director sees | Shared list | How it refreshes after this branch |
|---|---|---|
| The bell, disposal cards (the Director's action cards) | `pendingDisposals` | Each tab open (`refreshSharedLists`, H8); after a decision on Approvals and Holds (answer 1a, H8); after a decision in the bell (as before) |
| The bell, repair, transfer, loan, and return cards; Reminders (overdue, high value degraded, active loans); Holds (overdue custodians) | `repairRequests`, `dbTransfers`, `dbLoans`, `assets` | Each tab open; after any save or decision in this session (as before) |
| Descriptive Analytics widgets (distribution, funding, campus transfer flow, utilization) | `assets`, `dbReports`, `pendingDisposals`, `dbTransfers`, `dbLoans` | Each tab open; its own `/api/analytics/director` once per open (as before) |
| Executive Overview and Audit Generator numbers, the audit list | `assets` (before: the page's own copy) | Each tab open |
| Audit Generator CSV, repair logs | `repairRequests` | Each tab open |
| Approvals and Holds queue | the page's own disposal list | Each tab open; after its own decision (as before) |

**None stays stale until the next login.** Because "one reload after that action" cannot run after an action on another computer, the action it follows here is the Director opening a tab: one shared reload per tab open, never two, and none when a reload started less than 5 s ago (so not right after login, and not on quick clicks). This is a change to the plan (below).

#### Differences from the plan, and why

- **Commit 2 keeps one shared reload per Director tab.** The plan removed it, which would have left everything in the table above stale for changes made by other people until the next login or browser reload. Instead the dashboard reads the shared asset list (one asset request fewer per tab) and calls `refreshSharedLists()` once per tab. Counts: Director login **7** (plan 8), a tab click **7** when the shared reload runs (**8** on Descriptive Analytics, with its own analytics request; plan 3), **1 or 2** within 5 s of the last reload. Before: 38 and 26.
- **`128dce87` (added, #89).** H6's first run showed the modal On Loan, as My Assets does, but with "Your request is pending" in place of Custodianship Transfer: that notice reads the shared loan list, also older than the page's list. One loan request per opened asset fixes it.
- **`22ad1dd0` (added, #89).** With the modal showing the row it was opened from, H7's first run found a regression: after Record Return, Asset Inventory's own list (loaded once per tab) still said On Loan, and the reopened modal offered Record Return again (before this branch the modal read the shared list, which had reloaded). The Staff list now shows the shared list once that has reloaded after the page's own list. Record Return is the only save inside the modal that changes an asset's status, so the Lab Head and Custodian lists need no such change.
- **H4 and H8 used other assets** than planned (LOAN-9 from H-08, and TEST-0002), for the reasons in the results table.
- Commit 1 did not change the header's "Calls" line (it already names what the file calls).

#### What every teammate must do

Pull and run `npm test` once (413). `serverData.tsx` now has `refreshSharedLists()` (for a screen that opens), `reloadLoans()` (the loan list only), and `assetsVersion`. A screen that needs fresh shared lists when it opens should call `refreshSharedLists()`, not `syncFromDb()`; a save still calls `syncFromDb()`. Joel: `CustodianPortal.tsx` changed only at lines 122 to 132 (the two loading effects); `NotificationCenter.tsx` is untouched.

### Noticed, not in this branch

- **Loan 9 is written by a read** (`TODO(H-08)`, `loans.service.ts:29`): once no loan is pending, the next loan list inserts loan 9 as pending on the first asset for the first student. Seen in H3. On CCS Cloud it appears whenever every loan is decided.
- **Health Benchmarking (Lab Head) asks for its analytics five times per open**, once per section (`LabHeadAnalyticsView.tsx`). For #96 (dashboard numbers).
- **Approvals and Holds does not see a decision made in the bell** until its tab opens again (the same split as #57, for disposals); with the fix of cause 1 a click on the same tab does not reload it either, as today.
- **`syncFromDb()` asks for its lists one after another**, so on CCS Cloud the bell's lists arrive as slowly as the six requests added together. Asking in parallel would be faster but puts six queries on the Prisma pool at once, where UAT already saw pool timeouts. After UAT, with #76.
- **Staff pages load their own asset list** (`useStaffAssets`) on top of the shared one, so Staff still ask for assets twice at login. 01D.
- **`handleLoanDecision` and `handleTransferDecision` in `LabHeadAnalyticsView.tsx`** are not called anywhere (their comment says so). Left alone.

---

## Pre-deploy fixes (fix/pre-deploy)

Four small fixes for problems the agent's smoke test of `main` found on 2026-10-20, before tonight's deploy and UAT on 2026-10-21. Branch `fix/pre-deploy` from `main` at `8fb0e2bb` (groups A, H, and F merged, and the teammates' #88, #55, and #43). Baseline there: typecheck **65**, `npm run build` passes, `npm test` **413** passed. Planned and built in one go (no plan stop), one commit per fix. No schema, migration, `package.json`, or CCS Cloud change.

### 1. The fixes

| # | Commit | Kind | What it does | Files | Tests |
|---|---|---|---|---|---|
| 1 | `5aad7d4f` `fix(loans)!: the loan list no longer inserts a fake loan 9 (H-08)` | **Behavior change** | `listLoans` no longer inserts a pending loan 9 when no loan is pending. The list names each loan's asset from the asset row, or "Unknown asset" if the row is gone; the "ASUS TUF Gaming A15" special case for loan 9 is gone. `findFirstAsset` and `findFirstStudent` are deleted (only the insert used them). The bell's two loan cards had the same ASUS fallback and now say "Unknown asset" | `loans.service.ts`, `loans.repository.ts`, `NotificationCenter.tsx` (the two `assetName` fallback lines, 295 and 502), `tests/api/loans.test.ts` | **413** (the H-08 test now pins the fix: with no pending loan, `GET /api/asset_loans` writes nothing and lists only the real loans) |
| 2 | `b25ee9cd` `fix(notifications): the disposal card shows the asset and pathway (H-13)` | **Behavior change** (web) | The Director's bell card read `breakdownReasons` and `disposalPathway`, which `PendingDisposal` declared but nothing filled, so it showed `Decommission request: "undefined". Pathway: undefined.` The shared list only fills the server's packed `reason` text (M-13). The card now reads the pathway and the justification out of `reason` by the labels the server writes (the same labels `GET /api/assets` reads), and shows a reason without them whole | `NotificationCenter.tsx` (the disposal card only), `serverData.tsx` (`PendingDisposal` declares `reason` instead of the three unfilled fields, so the card's read type-checks; nothing else read them) | **413** |
| 3 | `1a8dc20a` `fix(inspections): leave disposed assets out of the inspection queue` | **Behavior change** (web) | The Inspection Operations Manager leaves Disposed assets out, so they no longer count in a group's Total Assets. The submit now reads the answer (H-16, this dialog only): a refusal shows the server's error, a network failure says the server could not be reached, and in both cases the dialog stays open and the row is not marked Inspected. The success alert shows only after a saved report | `InspectionQueue.tsx`, `inspections.api.ts` (the `submitInspectionRaw` comment, which said no caller reads the answer) | **413** |
| 4 | `518c0159` `fix(loans)!: refuse a loan with a past due date` | **Behavior change** | Server: `requestLoan` answers 400 "The due date cannot be in the past." for a due date before today, before any database read. Dates only (yyyy-mm-dd), so a loan due today is accepted. "Today" is the **server's local date** (the Node process's time zone), not UTC. Web: `LoanForm`'s date input has `min` today (the browser's local date); a typed past date shows the same message and keeps Submit Request disabled | `loans.service.ts`, `loans.validation.ts` (its comment, which said nothing checks the date), `LoanForm.tsx`, `tests/api/loans.test.ts` | **413** to **415** (added: a past due date answers 400 and writes nothing; a due date of today is accepted) |

**Counts.** Typecheck **65** after every commit. Build passes after every commit. Tests **413** after commits 1 to 3 (commit 1 rewrote the H-08 test, it did not add one), **415** after commit 4 (two tests added).

**Past due dates in the seed and the tests.** `prisma/seed.ts` files no loans. `tests/setup/seed.ts` writes its two loans straight to the database, due in 30 and 14 days. The overdue tests in `analytics.test.ts` (`addOverdueLoan`) already write their rows straight to the database, as group A did, and every test that files a loan through the API uses a due date 14 days ahead. So no seed row or test had to change.

**Joel's PR #112** touches `NotificationCenter.tsx` too. This branch changes only lines 295 and 502 (the loan cards' fallback name) and the disposal card (lines 354 to 364 on `main`), not the session-user or lab-matching lines. The PR #112 branch was not available locally, so the two could not be compared line by line.

### 2. Hand checks

#### Pre-deploy hand checks

**H1 to H4: the agent, in a browser (Playwright MCP), on the local test database `AdRIC_DB_test` only**, after commit 4. Raiki may run any of them again the same way. Before starting: stop any `npm run dev:all` and make sure ports 4000 and 5173 are free. The start script `%TEMP%\adric-predeploy-handchecks\start.mts` (the smoke test's) empties and seeds the test database through the test harness, moves the fixture emails to `@dlsu.edu.ph`, and starts the server; Vite runs with `VITE_API_URL=http://localhost:4000`. Reads go through `q.mts` beside it (SELECT only). Each role gets its own browser context; "Staff context 1" and "Staff context 2" stand for two computers. Seeded assets used: TEST-0001 (Active, nobody holds it), TEST-0004 (Disposed), TEST-0005 (Active, pending loan LOAN-2 from Custodian B), TEST-0006 (Active, held by Custodian A, one report). **No check touches CCS Cloud.**

| # | Fix | Role and screen | Steps | Expected | Database |
|---|---|---|---|---|---|
| H1 | 1, H-08 | Lab Head, Custody Transitions | Decline LOAN-2 (TEST-0005), the only pending loan. Reload the browser. Open the bell | LOAN-2 shows Declined, LOAN-1 Approved, with their real asset names; no LOAN-9 anywhere, no "ASUS"; `asset_loans` still holds loans 1 and 2 only | Local test |
| H2 | 2, H-13 | Staff context 2, Asset Inventory (Table); then Director, the bell | Staff: Decommission TEST-0001 with the justification "Screen cracked beyond repair" and the pathway "Donate to Partner Institution", submit. Director: log in, open the bell, read the disposal card; then Authorize Disposal | The card reads `Decommission request: "Screen cracked beyond repair". Pathway:` then the full text of the Donate to Partner Institution option, then `Requested by: Test Staff TSG.`; no "undefined". After Authorize Disposal the card is gone and TEST-0001 is Disposed | Local test |
| H3 | 3 | Staff context 1, Inspection Manager | Before H2: open Inspect / Log Report on TEST-0001 and leave the dialog open. After H2: Submit & Finalize Inspection. Then Cancel, reload, look at Group A. Then inspect TEST-0006 | The submit gets 409 and the alert shows the server's message; the dialog stays open and the row stays "For Inspection". After the reload neither TEST-0001 nor TEST-0004 is listed, and Total Assets is 4. TEST-0006 saves: the success alert, the row shows Inspected, one more report in `asset_reports` | Local test |
| H4 | 4 | Custodian A, Available Equipment, TEST-0005, Request Loan | Type the due date 2026-10-19 (yesterday). Then pick 2026-10-20 (today) and Submit Request. Then, in the same session, post a loan with due date 2026-10-19 straight to `POST /api/assets/TEST-0006/borrow` | The date input's min is today; yesterday shows "The due date cannot be in the past." and Submit Request is disabled; today submits ("Loan Request Lodged", a pending loan due 2026-10-20). The direct post answers 400 with the same message and writes nothing | Local test |

**Results (2026-10-20). H1 to H4: all passed** (the agent, on the local `AdRIC_DB_test` only). No check touched CCS Cloud.

How they ran: a real browser (Chrome, driven by the Playwright MCP) against Vite at `http://localhost:5173` (started with `VITE_API_URL=http://localhost:4000`) and `server/main.ts` on port 4000, started by `%TEMP%\adric-predeploy-handchecks\start.mts`, which empties and seeds the test database through the test harness and its guard (it takes only `TEST_DATABASE_URL` from `.env`, as `npm test` does; the agent did not open `.env` or `pending_registrations.json`). Ports 4000 and 5173 were free before the start; afterwards their processes were ended by PID and the ports checked free. Each role, and each "computer", had its own browser context. Reads went through `q.mts` (SELECT only); nothing was written to the database by hand. Screenshots are in `%TEMP%\adric-predeploy-handchecks\screenshots\`. `.playwright-mcp` was deleted from the repository afterwards. The only console error was a missing `favicon.ico` (404).

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| H1 | Passed | Before: loans 1 (approved) and 2 (pending). Decline on LOAN-2; after the reload, two `GET /api/asset_loans` (200). Custody Transitions: 0 Pending, 1 Completed, 1 Declined; LOAN-2 "Test Tablet Pending Loan (TEST-0005)" Declined, LOAN-1 "Test Monitor On Loan (TEST-0002)" Approved. The bell's Requests tab: "No Pending Requests"; no LOAN-9, no "ASUS" on the page. `asset_loans` after: loans 1 (approved) and 2 (declined), nothing else | `h1-1-custody-no-loan-9.png`, `h1-2-bell-no-loan-9.png` |
| H2 | Passed | Staff: "Disposal Request Submitted", DISP-2, pending, with the packed reason (pathway, last custodian, date, justification). Director's bell: `Disposal Authorization: Test Dev Kit Available`, `Decommission request: "Screen cracked beyond repair". Pathway:` followed by the Donate to Partner Institution option's full text, `Requested by: Test Staff TSG.`; the word "undefined" is nowhere on the page. Authorize Disposal: `PUT /api/asset_disposals/2/decision` 200; the card is gone; DISP-2 approved and TEST-0001's newest record DISPOSED | `h2-1-decommission-sent.png`, `h2-2-director-bell-card.png`, `h2-3-after-authorize.png` |
| H3 | Passed | Before H2 the queue already listed TEST-0001, 0002, 0003, 0005, 0006 (no TEST-0004). The dialog left open on TEST-0001, submitted after H2: `POST /api/assets/TEST-0001/inspection` 409 `{"success":false,"error":"TEST-0001 is disposed and cannot take an inspection report."}`; the alert showed exactly that message; the dialog stayed open; the row stayed "For Inspection"; TEST-0001 has no report. After Cancel and a reload: TEST-0002, 0003, 0005, 0006 only, Total Assets 4. TEST-0006: 200, the alert "Inspection Report logged & saved ... for Test Projector Inspected!", the dialog closed, the row shows Inspected; its reports went from 1 to 2 | `h3-1-queue-before.png`, `h3-2-refused-dialog-open.png`, `h3-3-queue-without-disposed.png`, `h3-4-inspection-saved.png` |
| H4 | Passed | The date input's `min` is `2026-10-20`. With 2026-10-19: the message shows under the input and Submit Request is disabled. With 2026-10-20: enabled; `POST .../TEST-0005/borrow` 200, "Loan Request Lodged"; LOAN-3 pending, borrower Custodian A, due 2026-10-20. The direct post for TEST-0006 with 2026-10-19: `400 {"success":false,"error":"The due date cannot be in the past."}`; `asset_loans` has no loan on TEST-0006 | `h4-1-past-date-refused.png`, `h4-2-today-accepted.png` |

### 3. Before deploying

- **The server's time zone decides "today" for fix 4.** The local PC runs at UTC+8. If the deploy host runs in UTC, then between midnight and 8 AM Manila time the server's "today" is still yesterday, so it accepts yesterday's date in that window (the browser still blocks it). It never refuses Manila's today. Setting `TZ=Asia/Manila` on the host makes the server match the browser.
- **Loan 9 rows already on CCS Cloud stay.** Fix 1 stops new ones; it does not remove a loan 9 the old code inserted. A read-only check on CCS Cloud (`SELECT loan_id, asset_id, borrower_id, status, purpose FROM asset_loans WHERE loan_id = 9`) shows whether one exists. A row with the purpose "Graphics & AI Performance Testing" was made by H-08, not by a person. Removing it is a team decision.
- **Two breaking changes** for anyone calling the API by hand: the loan list no longer creates loan 9, and `POST /api/assets/:tag/borrow` refuses a due date before today.

### Noticed, not in this branch

- **`NotificationCenter.tsx:272`** still has the comment "Includes LOAN-9 for Lab Head" above the loan cards. It is stale now, but it sits next to the Lab Head lab-matching lines that Joel's PR #112 changes, so it was left alone to avoid a conflict. One-line comment fix after #112 merges.
- **The Custodian's Send Inspection Report** (`CustodianPortal.tsx`, `TODO(H-16)` at line 385) still does not read the answer, so a refusal there still shows success. Fix 3 covers the Staff dialog only.
- **The disposal pathway options** in `DisposalFormDialog.tsx` contain an em dash between "Decommission" and the pathway (for example before "Scrap / Recycle"); they are stored in the reason text and shown in the card as they are. Not changed: renaming them would change stored text.

---

## Batch W: UAT 1 labels and small UI (fix/uat1-labels-ui)

UAT session 1 (a Lab Head, 2026-10-21) found the labels unusual and inconsistent, with each other and with apps people already use (Jakob's Law; Nielsen's "consistency and standards" and "match between system and the real world"). This batch changes display text and five small screen behaviors. Branch `fix/uat1-labels-ui` from `main` at `5b728d41` (PR #114 merged). Baseline there: typecheck **65**, `npm run build` passes, `npm test` **415** passed (16 files). Web only: no schema, migration, server, `package.json`, or test change. Stop 1 (this section) is the plan and the phone check; stop 2 is the build after Raiki's answers.

**The rule for L5 and L6.** "Active" stays the value everywhere it is compared or sent: `serverData.tsx`, `CustodianPortal.tsx`, `StaffAnalyticsView.tsx`, `EditAssetDialog.tsx`'s `form.status`, the badge class maps, the server, and every request body. Only what is shown changes, through one function (section 2, commit 1).

**Out of scope, marked "after workshop" below:** the Requests page layout (tabs, a separate loaned list, the card redesign, decline undo), the bell's lab matching (PR #112), the condition names, "Procured", "Staff Service Remarks", the "On Loan" wording, and custodian versus borrower logic. These wait for the design workshop on 2026-10-29.

Line numbers are on `main` at `5b728d41`.

### 1. Label inventory

One table per role, then one for screens every role sees. **Mark:** "change" (stop 2 changes it), "keep", or "after workshop". **Item** is the brief's group (L1 to L10, U13); it decides the commit (section 5). An em dash in the current text is written here as `--` (no em dashes in this log). Proposed text never has one, and where a changed line had one, it goes.

#### Lab Head

| # | Screen | Where | Now | Proposed | Why | Item | Mark |
|---|---|---|---|---|---|---|---|
| LH1 | Sidebar | `Sidebar.tsx:54` | Custody Transitions | Requests | What the page holds; matches the bell's Requests tab | L2 | change |
| LH2 | Sidebar | `Sidebar.tsx:55` | Branch Inventory | Lab Inventory | The app calls them labs everywhere else, never branches | L10 | change |
| LH3 | Sidebar | `Sidebar.tsx:56` | Health Benchmarking | Analytics | Plain; one name for this kind of page in every role (answer 1b) | L3 | change |
| LH4 | Sidebar | `Sidebar.tsx:57` | Account Approvals | Account Approvals | Already plain | | keep |
| LH5 | Requests, title | `LabHeadDashboard.tsx:494` | Digital Handshake Monitoring | Loan and Transfer Requests | Says what is listed | L2 | change |
| LH6 | Requests, subtitle | `LabHeadDashboard.tsx:495` | Equipment loan/borrow requests and custodianship transfers for {lab} research branch, pending your authorization. | Loan and transfer requests for {lab}. Approve or decline the pending ones. | Plain; "Approve" (L1) | L2 | change |
| LH7 | Requests, counters | `LabHeadDashboard.tsx:497-500` | Pending, Completed This Period, Declined | Section 2, U2 | | U2 | change |
| LH8 | Requests, headings | `:503`, `:568-570` | Equipment Loan Requests; Custodianship Transfer Requests ({n} pending) | as now | "Custodianship" waits for the custodian wording | | after workshop |
| LH9 | Requests, buttons | `:554`, `:621` | Authorize | Approve | The statuses are Pending, Approved, Declined | L1 | change |
| LH10 | Requests, card label; printed report | `:537`, `:609`, `:906` | TRANSFER LOCATION (on loans too); report column Transfer Location | DESTINATION LAB; Destination Lab | A loan has no transfer; it is the lab the asset goes to | L10 | change |
| LH11 | Requests, card | `:546` | Due {date} on every card | Only on Pending and Approved | Section 2, U14 | U14 | change |
| LH12 | Requests, timeline | `:81-90` | Initiated, Pending Approval / Declined, Custody Transferred | as now | Part of the card redesign and custodian wording | | after workshop |
| LH13 | Requests, empty | `:513`, `:580` | No loan or borrow requests logged for {lab} branch. / No custodianship transfer requests logged for {lab} branch. | No loan requests for {lab}. / No transfer requests for {lab}. | Plain; no "branch" | L10 | change |
| LH14 | Lab Inventory, title | `:748-749` | Branch Inventory -- {lab}; Filtered view -- other research centers are masked. | Lab Inventory: {lab}; Only your lab's assets are shown. | Plain, no dash | L10 | change |
| LH15 | Lab Inventory, badge | `:765` | BRANCH-SCOPED VIEW | removed | Repeats the subtitle; it is also what pushes the header off a phone screen (section 3) | L10 | change |
| LH16 | Lab Inventory, error | `:754` | {error} -- showing local data only. | {error} Showing the last list loaded. | No dash; "local data" means nothing to a user | L10 | change |
| LH17 | Lab Inventory, table | `:804` | Status | Availability | Section 1 rule, next to Condition | L5 | change |
| LH18 | Lab Inventory, table | `:804` | Cond. | Condition | No abbreviation; every other screen spells it | L10 | change |
| LH19 | Lab Inventory, badges | `:780`, `:814` | Active | Available | Display only | L6 | change |
| LH20 | Lab Inventory, button | `:759` | Generate Audit Report | Inventory Report | An audit is someone else checking the inventory; this lists it | L4 | change |
| LH21 | Report dialog | `:832-833` | Generate Lab Audit Report; Preview the audit report for DLSU AdRIC {lab} research center equipment. | Lab Inventory Report; Preview and print the inventory report for {lab}. | L4 | L4 | change |
| LH22 | Printed report, window title | `:330` | Equipment Audit Report - CITe4D | Inventory Report - {lab} | L4; it also said CITe4D for every lab | L4 | change |
| LH23 | Printed report, header | `:843`, `:846`, `:848` | Audit Ledger ID: AUD-{lab}-2026; EQUIPMENT AUDIT REPORT; Generated By: {lab} Lab Head / Project Leader | (removed); INVENTORY REPORT; Generated by: {name}, Lab Head | The ledger ID is made up (fixed year 2026); the person's name instead of a title | L4 | change |
| LH24 | Printed report, summary | `:855-858` | Active Equipment Count; Pending Custody Handshakes; Maintenance Operations Logged; Average Equipment Health Score | Assets in service; Pending transfers; Repair tickets; Average condition score | Says what each number counts | L4 | change |
| LH25 | Printed report, sections | `:869`, `:901`, `:967`, `:1000` | I. Branch Asset Registry; II. Custody Transitions, Loans & Transfer Trail; III. Component Maintenance & Troubleshooting Operations; IV. Decommissioned & Disposed Assets Archive | I. Assets; II. Loans and Transfers; III. Repairs; IV. Disposed Assets | Plain | L4 | change |
| LH26 | Printed report, tables | `:874`, `:890`, `:906`, `:972`, `:989`, `:1005` | Status (Active); Transaction ID; Urgency Status; Acknowledge State (Resolved & Acknowledged / Pending Evaluation); Primary Breakdown Reason | Availability (Available); Request ID; Priority; Acknowledged (Yes / Not yet); Reason | L5, L6; "Resolved" was wrong: the flag only says Staff acknowledged it | L4 | change |
| LH27 | Printed report, empty | `:943`, `:979`, `:1012` | No loan or transfer operations logged for {lab} branch.; No maintenance tickets logged for CITe4D branch.; No decommissioned or disposed assets recorded for {lab} branch. | No loans or transfers for {lab}.; No repair tickets for {lab}.; No disposed assets for {lab}. | The repairs line said CITe4D for every lab | L4 | change |
| LH28 | Printed report, footer | `:1035-1046` | Auditor Signature / Digital Signature Verified / CITe4D Lab Head / Project Leader; Compliance Status / ✓ AdRIC Assets Compliant / DLSU Engineering Standards | removed | Nothing is checked or signed (section 2, U13) | U13 | change |
| LH29 | Report dialog, button | `:1052` | Print Audit Ledger | Print Report | L4 | L4 | change |
| LH30 | Account Approvals | `:645`, `:648` | Lab Head Account Approvals; Authorize or reject pending institutional user registration requests for your assigned research laboratory. | Account Approvals; Approve or decline sign-up requests for your lab. | Title matches the sidebar; "Approve" (L1) | L1 | change |
| LH31 | Account Approvals | `:652`, `:681` | {n} PENDING REGISTRATION REQUESTS FOR {LAB}; Institutional ID: | {n} pending sign-ups; ID number: | Plain | L10 | change |
| LH32 | Account Approvals | `:701`, `:703` | ...This will create their active user account in the database.; Account for {name} approved & added to database! | ...This creates their account.; Account for {name} approved. | No database words | L10 | change |
| LH33 | Account Approvals, empty | `:729-730` | No Pending Account Approvals for {lab}; All registration requests for your research laboratory have been processed. | No sign-up requests for {lab}; Nothing is waiting for your approval. | Plain | L10 | change |
| LH34 | Analytics, title | `LabHeadAnalyticsView.tsx:936`, `:939`, `:943` | Lab Head Project Allocation & Efficiency Dashboard ({lab}); Real operational equipment loan & transfer approvals, hardware utilization gauge, ...; {lab} Research Laboratory Restricted | Analytics: {lab}; Loans, transfers, project use, and overdue items for your lab.; (badge removed) | Plain; the badge repeats the lab | L3 | change |
| LH35 | Analytics, widgets | `LabHeadAnalyticsView.tsx:165`, `:172`, `:354`, `:432`, `:570`, `:666`, `:757`, `:838` | Utilization Gauge: Lab Assets Assigned to Projects; Query DB: percentage of lab assets actively assigned to a valid project_id versus unassigned (null).; Project-to-Asset Allocation Matrix (Treemap Preview) and (in its expanded view) ({lab}); Custodianship & Overdue Delinquencies -- {lab}; Diagnostic -- Accountability Scatter Plot ({lab}) and (expanded) Accountability Scatter Plot -- Complete Cohort Analysis ({lab}); Diagnostic -- Cohort Accountability Heatmap Matrix ({lab}) | Assets Assigned to Projects; Share of your lab's assets that belong to a project.; Assets by Project (expanded: Assets by Project ({lab})); Overdue Loans: {lab}; Overdue Loans by Borrower ({lab}), the same in the expanded view; Overdue Loans by Group ({lab}) | Says what the chart shows, not its chart type; no database words | L10 | change |
| LH36 | Dashboard, button | `LabHeadAnalyticsView.tsx:369`, `:684` | Maximize Tab | Expand | Plain | L10 | change |
| LH37 | Dashboard, widgets | `:207`, `:230`, `:275` | Equipment Category Breakdown; Equipment Loan Requests; Inter-Lab Transfer Requests | as now | Already plain | | keep |
| LH38 | Analytics, loading and allocation | `LabHeadAnalyticsView.tsx:124`, `:446` | Synchronizing Lab Analytics with MySQL Database...; Lead research cohort assigned hardware equipment from MySQL database. | Loading analytics...; The project with the most assets from your lab. | No database words (found in the final sweep) | L10 | change |

#### Staff

| # | Screen | Where | Now | Proposed | Why | Item | Mark |
|---|---|---|---|---|---|---|---|
| S1 | Sidebar | `Sidebar.tsx:40-42`, `:45` | System Overview, Register Equipment, Asset Inventory, Pending Returns | as now | Already plain | | keep |
| S2 | Sidebar | `Sidebar.tsx:43`, `:44`, `:46` | Repair Manager, Inspection Manager, QR Tag Wizard | Repairs, Inspections, QR Tags | Common one-word names; page titles follow | L10 | change |
| S3 | Sidebar | `Sidebar.tsx:47` | Health Benchmarking | Analytics | Answer 1b | L3 | change |
| S4 | Sidebar role text | `Sidebar.tsx:229`, `:264` | Staff (ITS) / Staff (TSG) | Staff | ITS was removed; one Staff role (L8, L9) | L9 | change |
| S5 | System Overview | `OverviewPage.tsx:62` | Real-time status summaries, operational telemetry, and quick action routing controls. | Assets, repairs, and returns at a glance, with shortcuts. | Plain | L10 | change |
| S6 | System Overview, cards | `OverviewPage.tsx:83`, `:97`, `:101-102`, `:110`, `:119`, `:128-129`, `:139` | Pending Return Ledgers; Quick Action Operations; Asset Procurement Registration / Log new hardware items into AdRIC databases; Repair Operations Manager; Inspection Operations Manager; Barcoding & QR Tag Wizards / Generate, select, and preview barcode stickers; Campus Affiliations | Pending Returns; Shortcuts; Register Equipment / Add newly acquired equipment to the inventory; Repairs; Inspections; QR Tags / Pick assets and print their QR tags; Assets by Campus | Match the sidebar names | L10 | change |
| S7 | System Overview, card | `OverviewPage.tsx:89-90` | 97.8% System Operational Index | removed | A fixed number (`TODO(H-09)`), no source (U13 list, question 6) | U13 | change |
| S8 | Register Equipment | `RegisterPage.tsx:14-15`, `IntakeWizard.tsx:89-90` | Equipment Procurement Registration; Procurement Intake Wizard; Complete all fields to compile hardware records | Register Equipment; New Asset; Fill in every field. | Matches the sidebar | L10 | change |
| S9 | Register Equipment | `IntakeWizard.tsx:179`, `:205` | Funding Origin; Responsible Laboratory Group | Funding Source; Lab | Plain; same words as Edit Asset | L10 | change |
| S10 | Register Equipment | `IntakeWizard.tsx:226-229` | Procurement Compliance Checklist: ✓ Registry tagging matches barcode guidelines ✓ ... | removed | Nothing checks it (U13 list, question 6) | U13 | change |
| S11 | Asset Inventory | `InventoryPage.tsx:76` | Complete hardware registry · {n} active assets across 2 campuses | {n} assets in service across 2 campuses | "active" would now clash with Available | L10 | change |
| S12 | Asset Inventory, tabs | `InventoryPage.tsx:92`, `:98` | Active Registry ({n}); Decommissioned Archive ({n}) | In Service ({n}); Disposed ({n}) | "Active" here means "not disposed", which includes On Loan | L6 | change |
| S13 | Asset Inventory, filter | `InventoryPage.tsx:109` | All Funding Origins | All Funding Sources | Same word as the form | L10 | change |
| S14 | Asset Inventory, table | `InventoryPage.tsx:164` | Status; Cond. | Availability (L5 commit); Condition (Staff L10 commit) | L5; no abbreviation | L5 | change |
| S15 | Asset Inventory, badges | `InventoryPage.tsx:174`, `AssetGalleryCard.tsx:30` | Active | Available | L6 | L6 | change |
| S16 | Asset Inventory, buttons | `InventoryPage.tsx:205`, `AssetGalleryCard.tsx:69` | Remove Asset (tooltip) | Delete Asset | It deletes; the dialog says "Confirm Asset Deletion" | L10 | change |
| S17 | Edit Asset | `EditAssetDialog.tsx:76-77` | Edit Registry Asset -- {id}; Modify registry information to correct configuration errors or entry mistakes. | Edit Asset: {id}; Correct this asset's details. | Plain, no dash | L10 | change |
| S18 | Edit Asset | `EditAssetDialog.tsx:148`, `:151-152` | Asset Status; options Active, On Loan, Maintenance | Availability; options Available, On Loan, Maintenance (values unchanged: Active, On Loan, Maintenance) | L5, L6; what is sent stays | L5 | change |
| S19 | Edit Asset | `EditAssetDialog.tsx:102`, `:127`, `:157`, `:177`, `:230` | Funding Origin; Responsible Laboratory Group; Condition State; Current Custodian Assignment; Save Modifications | Funding Source; Lab; Condition; Custodian; Save Changes | Plain, same as the other screens | L10 | change |
| S20 | Repairs | `RepairsPage.tsx:52`, `:67` | Repair Operations Manager; Maintenance Request & Priority Matrix | Repairs; Open Repair Requests | Matches the sidebar | L10 | change |
| S21 | Repairs, table | `RepairsPage.tsx:86`, `:213` | Acknowledge State; Completion State | Acknowledged; Completed | Plain | L10 | change |
| S22 | Repairs, table | `RepairsPage.tsx:86` | Dispatched To | as now | Tied to the forward-to choice (question 2) | | keep |
| S23 | Pending Returns | `ReturnsPage.tsx:37` | Pending Returns Ledger | Pending Returns | Matches the sidebar | L10 | change |
| S24 | Inspections | `InspectionsPage.tsx:25` | Inspection Operations Manager | Inspections | Matches the sidebar | L10 | change |
| S25 | Inspections dialog | `InspectionQueue.tsx:222-225` | Inspector Role: TSG Staff (Technical Operations), ITS Staff (Central Asset Admin), Lab Head / Approver, Custodian Auditor | Staff, Lab Head, Custodian (the ITS option goes) | ITS was removed; the role is not sent to the server | L8 | change (question 2) |
| S26 | Inspections dialog | `InspectionQueue.tsx:249`, `:258`, `:262` | TSG Technical & Hardware Remarks; ITS Governance & Compliance Remarks; its placeholder (...or audit compliance notes...) | Hardware Remarks; Records Remarks; Tag check, warranty claim, software licence, or other records notes... | ITS was removed; the stored prefixes `[TSG Remarks]` and `[ITS Remarks]` stay (answer 2a) | L8 | change |
| S27 | Inspections dialog | `InspectionQueue.tsx:232-238` | Condition Rating options (Perfect (Brand New / 100%) ...) | as now | Condition names | | after workshop |
| S28 | Inspections dialog | `InspectionQueue.tsx:350` | Inspection Report logged & saved under asset_reports table in MySQL for {asset}! | Inspection report saved for {asset}. | No database words | L10 | change |
| S29 | QR Tags | `QrTagsPage.tsx:167-168` | QR Tag Layout Wizard; Generate and export printable physical tracking barcodes for laboratory assets. | QR Tags; Pick assets and print their QR tags. | Matches the sidebar | L10 | change |
| S30 | Analytics | `HealthPage.tsx:35`, `:39-40` | Staff Maintenance & Workflows Dashboard / Numeric Health Benchmarking Grid; their subtitles | Analytics / Condition Benchmarks (sample data); Repairs, condition, warranties, and inspections. / Battery, storage, and uptime per asset. These numbers are samples, not your data. | Answer 1b; the grid shows fixed numbers from `healthData`, so it says so | L3 | change |
| S31 | Dashboard | `HealthPage.tsx:46` | Technical Support Group Active (badge) | removed | TSG names a unit, not this screen (L8) | L8 | change |
| S32 | Analytics | `HealthPage.tsx:56`, `:64` | Benchmarks Grid; Advanced Analytics | Benchmarks; Charts | Plain | L3 | change |
| S33 | Dashboard, widgets | `StaffAnalyticsView.tsx:156`, `:422`, `:559`, `:640` | ...to trigger MySQL DB progress_status updates.; Real-Time Location & Inventory Distribution; Warranty Expiration & Vendor Lifecycle Calendar (90-Day Filter); Staggered Routine Inspection Progress Tracker | ...to update the repair's progress.; Assets by Lab; Warranties Ending in 90 Days; Inspection Progress | Plain; no database words | L10 | change |
| S34 | Dashboard, chart | `StaffAnalyticsView.tsx:378`, `:405` | Available, On Loan, Under Repair, Disposed | as now | Already says Available | | keep |
| S35 | Fallback place names | `OverviewPage.tsx:222`, `StaffAnalyticsView.tsx:366` | ITS Warehouse; ITS Main Warehouse | Unknown location | ITS was removed; no such place in the data | L8 | change |
| S36 | Asset modal, QR | `AssetDetailModal.tsx:440-442` | Permanent QR Tag; Scannable routing node link: | QR Tag; Link: | Plain | L10 | change |
| S37 | Repair Progress dialog | `RepairProgressDialog.tsx:61`, `:72-76` | MAINTENANCE ➔ RE-ASSIGNED TO CUSTODIAN; condition options | as now | Condition names and custodian wording | | after workshop |
| S38 | Decommission dialog, success | `DisposalFormDialog.tsx:70` | Sent to the AdRIC Director for approval. The asset stays active until it's authorized. | ...The asset stays in service until it's approved. | L1; "active" would clash with Available | L1 | change |

#### Custodian

| # | Screen | Where | Now | Proposed | Why | Item | Mark |
|---|---|---|---|---|---|---|---|
| C1 | Sidebar role text | `Sidebar.tsx:228`, `:263` | Active Custodian | Custodian | The role's name; "Active" now means something else (L6) | L9 | change |
| C2 | Sidebar tooltip | `Sidebar.tsx:259` | A. Dela Cruz (Active Custodian) (shown when no user is loaded) | Signed-in user | A made-up person | L9 | change |
| C3 | Sidebar | `Sidebar.tsx:64-67` | My Assets, Available Equipment, QR Scan, Send Inspection Report | as now | Already plain; "Available" now matches L6 | | keep |
| C4 | My Assets | `CustodianPortal.tsx:401`, `:418` | My Borrowed Assets; No borrowed assets under your custody. | as now | Custodian versus borrower | | after workshop |
| C5 | My Assets, badges | `CustodianPortal.tsx:432`, `:461` | Active (when shown) | Available | L6 | L6 | change |
| C6 | Available Equipment | `CustodianPortal.tsx:503` | Browse and select available assets from AdRIC research branches. | Assets you can request to borrow, from every lab. | No "branch" | L10 | change |
| C7 | Available Equipment | `CustodianPortal.tsx:508` | {error} -- showing local data. | {error} Showing the last list loaded. | No dash | L10 | change |
| C8 | Available Equipment, badges | `CustodianPortal.tsx:561`, `:588` | Active | Available | L6; matches the page name | L6 | change |
| C9 | QR Scan | `CustodianPortal.tsx:622`, `:663`, `:646` | Camera viewport inactive; Activate Scanner; Asset Identified | Camera is off; Start Camera; Asset Found | Plain | L10 | change |
| C10 | QR Scan, result | `CustodianPortal.tsx:650` | Status: Active | Availability: Available | L5, L6 | L5 | change |
| C11 | Send Inspection Report | `CustodianPortal.tsx:713` | Submit your asset condition report for Staff inspection compliance. Saves directly to asset_reports in the database and marks the asset as Inspected. | Report the condition of an asset you hold. Staff see it in the inspection log. | No database words; "compliance" has no source (U13 list) | L10 | change |
| C12 | Send Inspection Report, result | `CustodianPortal.tsx:724`, `:727`, `:731` | Report Archived -- Asset Healthy / Repair Request Triggered; Logged in the archival timeline. Asset card updated with green status indicator. / Report routed to Staff as high-priority On-Demand Repair Request.; STAFF ALERT DISPATCHED | Report Sent / Repair Requested; Your report is saved. / Your report went to Staff as a high-priority repair request.; STAFF NOTIFIED | No dash; nothing turns green | L10 | change |
| C13 | Send Inspection Report, form | `CustodianPortal.tsx:771-774`, `:822`, `:826`, `:831`, `:843` | REPAIR ENGINE WILL BE TRIGGERED -- Staff alert on submit; FAULT DETECTED IN DESCRIPTION -- Staff alert on submit; Monitor status -- describe issue...; Healthy state -- will archive to timeline log; Manual Diagnostic Encoding; its placeholder; Fault keywords detected -- Staff repair request auto-generated; Bypass standard trimestral evaluation for critical defects | A repair request will go to Staff when you send this.; Your description sounds like a fault, so Staff will be told when you send this.; Describe the problem so Staff can tell whether it needs a repair.; No problem reported. The report will be saved.; Description; Describe what you see or hear, and any damage.; This sounds like a fault, so a repair request will go to Staff.; For a serious fault: ask Staff to inspect it now. | No dashes, plain | L10 | change |
| C14 | Send Inspection Report, form | `CustodianPortal.tsx:52-58`, `:808` | Operational Status -- Preset Selection; the five condition pills | as now | Condition names | | after workshop |
| C15 | Request Loan form | `LoanForm.tsx:46`, `:111-113`, `:158` | Governance Approvals Pipeline; Request Lodged / Custodian signature, Lab Head Approval / Digital handshake auth, Staff Verification / Asset check-out complete; Your request has been successfully submitted and forwarded to the Lab Head for approval. | Approval Steps; Request Sent / By you, Lab Head Approval / Approve or decline, **Collect the Asset / After approval, get it from the lab**; Your request went to the Lab Head for approval. | The last step is what happens today: approval puts the asset On Loan at once, there is no Staff step (Raiki) | L10 | change |
| C16 | Request Loan form | `LoanForm.tsx:155`, `:179`, `:181`, `:239` | Loan Request Lodged; Borrow Equipment Request; Initiating loan approval chain for active asset; Expected Return Date | Loan Request Sent; Request a Loan; (removed); Due Date | "Due date" is the word the cards and the error message already use | L10 | change |
| C17 | Transfer form | `TransferForm.tsx:43`, `:112-114`, `:161`, `:164`, `:188`, `:299` | Governance Approvals Pipeline; Current Owner Sign-off (Custodian confirmation) / Lab Head Approval (Digital handshake auth) / Staff Log Verification (Registry update); Handshake Initiated; Transfer request logged. Lab Head approval is now pending.; Initiate formal liability handoff between research personnel; Initiate Handshake | Approval Steps; Your Request (By you) / Lab Head Approval (Approve or decline) / **Done (The asset moves to the new custodian)**; Transfer Request Sent; Your transfer request is waiting for the Lab Head.; Ask to move this asset to another custodian.; Send Transfer Request | "Handshake" is not a word users know; the last step is what happens today (Raiki) | L10 | change |
| C18 | Transfer form | `TransferForm.tsx:186`, `AssetDetailModal.tsx:59`, `:547` | Custodianship Transfer | as now | Custodian wording | | after workshop |
| C19 | Repair form | `RepairForm.tsx:38`, `:162`, `:298`, `:374` | Approvals Pipeline Monitor; Incident Logged; Log hardware anomalies to the core optimization track; Log Incident to Maintenance Queue | Repair Steps; Repair Request Sent; Report a fault with this asset.; Send Repair Request | Plain | L10 | change |
| C20 | Repair form | `RepairForm.tsx:117`, `:323-332`, `:191` | ITS Central Override step; Forward Target Department: TSG, ITS, Both | as now | The chosen unit is sent in the request body; waits for the ITS removal branch (answer 2a) | | keep (ITS removal branch) |
| C21 | Transfer form | `TransferForm.tsx:226` | The recipient must accept this transfer before custody moves. | Once the Lab Head approves, the asset moves to the new custodian. | Says what happens: approval moves the asset at once (follow-up after stop 2) | L10 | change |

#### AdRIC Director

| # | Screen | Where | Now | Proposed | Why | Item | Mark |
|---|---|---|---|---|---|---|---|
| D1 | Sidebar | `Sidebar.tsx:74` | Executive Overview | Overview | Plain; Staff's home is "System Overview" | L10 | change |
| D2 | Sidebar | `Sidebar.tsx:75` | Descriptive Analytics | Analytics | Answer 1b | L3 | change |
| D3 | Sidebar | `Sidebar.tsx:76` | Approvals & Holds | Disposal Approvals | There are no holds on that page (the holds screen went in step 8, F-37) | L10 | change |
| D4 | Sidebar | `Sidebar.tsx:77` | Audit Generator | Inventory Report | L4 | L4 | change |
| D5 | Every tab, header | `AdRICDirectorDashboard.tsx:983-986` | AdRIC Director Control Suite; ADMIN OVERWATCH badge; High-level executive oversight, health tracking, decommissioning approvals, and compliance audit trail reporting. | The tab's name (Overview, Disposal Approvals, Inventory Report); no badge; no subtitle. The Analytics tab shows only its own title ("Analytics"), not two | Every other role's page title is the tab's name; "compliance audit trail" has no source (U13 list) | L10 | change |
| D6 | Overview, cards | `:306`, `:323`, `:328`, `:340` | Registry Valuation; Active Inventory; {n} Equipment; Maintenance & Degrading | Total Value; Assets in Service; {n} assets; In Maintenance or Degraded | "Active" would clash with Available | L10 | change |
| D7 | Overview | `:401-404` | Administrative Oversight paragraph | removed | No information | L10 | change |
| D8 | Overview, lab table | `:412`, `:419`, `:424`, `:450-456` | Specialized Laboratories Status Matrix; Laboratory ID; Status (Safe, Attention, Critical Watch, Unassigned) | Labs; Lab; Condition (Good, Attention, Critical, No assets) | "Status" would read as availability; it is the lab's average condition | L10 | change |
| D9 | Disposal Approvals | `:495`, `:499` | Regulated Disposal Approvals Queue; Assets scheduled for decommissioning by Staff cannot be purged without the Director's authorized sign-off. | Disposal Requests; Staff asked to dispose of these assets. Each one needs your approval. | Plain | L10 | change |
| D10 | Disposal Approvals, card | `:518`, `:521` | Proposed by:; Pending Sign-off | Requested by:; Pending | Same words as the other cards | L10 | change |
| D11 | Disposal Approvals, buttons | `:537`, `:545` | Reject & Recirculate; Authorize Disposal | **Decline**; Approve Disposal | L1; Decline everywhere, as for loans, transfers, and sign-ups (Raiki) | L1 | change |
| D12 | Disposal Approvals, empty | `:556-557` | Approvals Queue Empty; No assets require decommissioning sign-off. | No Disposal Requests; Nothing is waiting for your approval. | Plain | L10 | change |
| D13 | Inventory Report | `:641`, `:714`, `:719` | Custom Audit Report Generator Filters; AdRIC Compliance Audit Report ({n} ASSETS FOUND); Audit Ready (badge) | Inventory Report Filters; Inventory Report ({n} assets); (badge removed) | L4; "Audit Ready" has no source (U13) | L4 | change |
| D14 | Inventory Report | `:659`, `:704`, `:751` | Funding Source (Segregated); Export CSV Archive; 0 ASSETS FOUND matching the active filter criteria. | Funding Source; Export CSV; No assets match these filters. | Plain | L4 | change |
| D15 | Inventory Report, table | `:727`, `:733`, `:790`, `:803` | Equipment ID; Status / Custodian (Active); Full Lifecycle | Asset ID; Availability / Custodian (Available); History | Same words as the other tables; L5, L6 | L5 | change |
| D16 | Inventory Report, table, history dialog, CSVs | `:728`, `:765-766`, `:853-854`, `:146-147`, `:609`, `:612` | Physical Tag: DLSU-ITS-{id} over DLSU-TSG-{id} (made up when the asset has no tag); ITS Property Tag; TSG Property Tag; CSV header Property Tag | Property Tags: "ITS: {tag or None}" over "TSG: {tag or None}"; the two labels kept, "None" instead of a made-up tag; CSV header ITS Property Tag, value None when there is none | Answer 3a | L8 | change |
| D17 | Inventory Report, CSV | `:609`, `:620`, `:630` | header Status, value Active; file AdRIC_Audit_Report_{filter}_Funding.csv | header Availability, value Available; AdRIC_Inventory_Report_{filter}_Funding.csv | L4, L5, L6: people read the file | L4 | change |
| D18 | History dialog | `:825`, `:828`, `:857`, `:968` | Asset Lifecycle Audit Trail: {id}; Full chronological registry logs mapping physical location, history, and custody transitions.; Current Status: Active; Close Audit Trail | Asset History: {id}; Transfers, repairs, inspections, and disposal of this asset.; Availability: Available; Close | L4, L5, L6 | L4 | change |
| D19 | History dialog | `:855` | Deed of Donation Ref: DOD-2024-{n} | removed | Made up from the asset tag; no such record (U13 list, question 6) | U13 | change |
| D20 | History CSV | `:135`, `:148` | Asset Lifecycle Audit Trail Report; Current Status | Asset History Report; Availability (value through the label function) | L4, L5 | L4 | change |
| D21 | Analytics | `DirectorAnalyticsView.tsx:1062`, `:1065` | AdRIC Director Executive Dashboard; Governance & Funding analytics: ... grant renewal readiness, audit readiness, and procurement budget justification. | Analytics; Value, funding, transfers, and use of assets across AdRIC. | Answer 1b; "readiness" has no source | L3 | change |
| D22 | Analytics, widgets | `DirectorAnalyticsView.tsx:277`, `:292`, `:305`, `:308`, `:333`, `:336`, `:661`, `:929` | Filtered acquisition valuation from MySQL database; Filtered items awaiting decommissioning sign-off; Stacked Column Chart: Location vs. Status; X-axis: ... (ACTIVE=Green, ON_LOAN=Yellow, MAINTENANCE=Red).; Line Graph: Audit Compliance (`asset_reports` over time); Counts of asset_reports submitted over time ...; Cross-Campus Resource Transfer Flow (Dynamic Sankey Diagram); Descriptive -- Asset Utilization Preview | Total value of the filtered assets; Filtered disposal requests waiting for your approval; Assets by Campus and Availability; (removed); Inspection Reports per Month; Inspection reports filed each month.; Transfers Between Campuses; Asset Use | Says what the chart shows; "Audit Compliance" is only a count of inspection reports | L10 | change |
| D23 | Analytics, legend | `DirectorAnalyticsView.tsx:320-322` | ACTIVE (Green); ON_LOAN (Yellow); MAINTENANCE (Red) | Available; On Loan; Maintenance (the `dataKey`s stay) | L6 | L6 | change |
| D24 | Analytics | `DirectorAnalyticsView.tsx:407` | Funding Capital & Valuation Breakdown | Value by Funding Source | Plain | L10 | change |

#### Every role (shell, bell, asset modal, account, login)

| # | Screen | Where | Now | Proposed | Why | Item | Mark |
|---|---|---|---|---|---|---|---|
| A1 | Sidebar config | `Sidebar.tsx:32-33`, `:37-38`, `:51-52`, `:61-62`, `:71-72` | label and subtitle per role: "Staff" / "Asset Administration & Maintenance", "Lab Head / Project Leader" / "Command Suite", "Active Custodian" / "Borrower Micro-Portal", "AdRIC Director" / "Executive Oversight" | removed (the two fields) | **Never shown**: nothing reads `cfg.label` or `cfg.subtitle` (checked in the code and in the browser). What users see is the role text in A2 | L9 | change |
| A2 | Sidebar role text, mobile header chip, Preferences, Account Settings | `Sidebar.tsx:227-230`, `:262-265`, `:551`, `:557-558`, `RootLayout.tsx:111-114`, `AccountDetailsPage.tsx:126-134` | five separate role-name copies: AdRIC Director / Active Custodian / Staff (ITS) / Lab Head; Director / Custodian / Staff / Lab Head; "Authorized User:" and "Role Context: LabHead" (the code name); the Account page's own list (with Active Custodian) | one `roleLabel` map in `session.tsx`: Staff, Lab Head, Custodian, AdRIC Director, read by all of them; Preferences shows "Signed in as:" and "Role: Lab Head" | One name per role everywhere; U10 needs it too | L9 | change |
| A3 | Sidebar | `Sidebar.tsx:402-412` | SYSTEM STATUS / All services operational / Last sync: 2 min ago | removed | Fixed text; nothing is checked (U13 list, question 6) | U13 | change |
| A4 | Sidebar | `Sidebar.tsx:380-383` | CURRENT ROUTE /lab-head/custody | as now | Not a label; noted at the end | | keep |
| A5 | Bell, loan button | `NotificationCenter.tsx:807` | Authorize Loan | Approve Loan | L1 | L1 | change |
| A6 | Bell, disposal button | `NotificationCenter.tsx:862` | Authorize Disposal | Approve Disposal | L1 | L1 | change |
| A6b | Bell, disposal decline button | `NotificationCenter.tsx:871` | Reject | Decline | Decline everywhere (Raiki) | L1 | change |
| A7 | Bell, other text | `NotificationCenter.tsx:362`, `:682`, `:686`, `:706`, `:765`, `:996` | Disposal Authorization: {asset}; Scope: {name} ({role code, for example LabHead}); Action Required; Clearance Holds; Pending Approval; Dynamic role-filtered notification stream | as now | PR #112 (Joel) is in this file; only the two button lines change here. To do after #112 merges: "Disposal Request:", "({role label})", and drop the footer line | | after PR #112 |
| A8 | Asset modal, header | `AssetDetailModal.tsx:320-322` | badge Active | Available | L6 | L6 | change |
| A9 | Asset modal, header | `AssetDetailModal.tsx:311-324` | (no custodian near the top) | Custodian: {name} | Section 2, U8 | U8 | change |
| A10 | Asset modal, facts | `AssetDetailModal.tsx:233-234` | Funding Org.; Condition State | Funding Source; Condition | Same words as the forms and tables | L10 | change |
| A11 | Asset modal, facts | `AssetDetailModal.tsx:238` | Procured | as now | Named in the brief | | after workshop |
| A12 | Asset modal | `AssetDetailModal.tsx:387` | Staff Service Remarks | as now | Named in the brief | | after workshop |
| A13 | Asset modal, history | `AssetDetailModal.tsx:396`, `:63`, `:696` | Custodian History & Lifecycle Audit Trail; Custodian History Audit Trail | Custodian History | L4 (not an audit) | L4 | change |
| A14 | Asset modal, history | `AssetDetailModal.tsx:415` | Original Intake: {name} / fallback "Staff Tagging Registry" | First custodian: {name} / fallback "Not assigned" | L7 | L7 | change |
| A15 | Asset modal, history | `AssetDetailModal.tsx:411` | Prior Custodian; No prior custodian on record | Previous custodian; None | Plain | L7 | change |
| A16 | Asset modal, full history | `AssetDetailModal.tsx:709`, `:717`, `:744`, `:748` | Fetching custodian records from MySQL database…; No historical custodian records logged for this asset in the database.; Email / Institutional Contact:; Status / Asset Condition: ACTIVE · PERFECT | Loading custodian history…; No custodian history for this asset yet.; Email:; Availability / Condition: Available · PERFECT | No database words; L5; the history sends the stored form (ACTIVE, ON_LOAN), so the label function reads both forms | L5 | change |
| A17 | Account Settings | `AccountDetailsPage.tsx:150`, `:257`, `:269`, `:282`, `:307` | Manage your active profile credentials and session state; Assigned Security Role; Institutional ID Number; Institutional Lab Affiliation; Profile successfully updated! Changes are synchronized across your active session block. | Your profile and sign-in details.; Role; ID Number; Lab; Profile saved. | Plain | L10 | change |
| A18 | Account Settings | `AccountDetailsPage.tsx:298` | Security Lockout: Under DLSU Laboratory Infrastructure Policy, you are barred from changing your system role, user type, ID number, or lab affiliation. Contact your AdRIC Director or IT Services for authorization overrides. | You cannot change your role, user type, or ID number (, or your lab) here. Ask the AdRIC Director if one of them is wrong. | Cites a policy with no source (U13 list) | U13 | change |
| A19 | Account Settings | `AccountDetailsPage.tsx:218`, `:229` | placeholders "Joel P.", "Balanay II" | "e.g. Juan", "e.g. Dela Cruz" | A teammate's real name in the code | L10 | change |
| A20 | Login | `Login.tsx:106-107`, the field labels, the submit button | Secure Institutional Sign-In; Authorized access via @dlsu.edu.ph credentials; Institutional Email Address; Institutional Password; Authenticate & Enter System; Authenticating Credentials... | Sign In; Use your @dlsu.edu.ph account.; DLSU Email; Password; Sign In; Signing in... | What every other sign-in page says | L10 | change |
| A21 | Not found page | `NotFound.tsx` | The route you requested does not exist in this system.; Return to Login (also to someone signed in) | This page does not exist.; Go to my home page when signed in, Return to Login when not (answer 5b) | Plain | U10 | change |
| A22 | Every pending card, modal | `AssetDetailModal.tsx:219` | Requested by another user | as now | Plain | | keep |
| A23 | Asset modal, header of an open form | `AssetDetailModal.tsx:249`, `:307` | Request Equipment Loan -- {asset} | Request a Loan: {asset} | No dash; the same name as the form's own title (found by H6) | L10 | change |

**Counts (as built, stop 2).** Rows marked "change": Lab Head **34**, Staff **33**, Custodian **15** (with C21, a follow-up after stop 2), Director **23**, every role **19** (A1 to A23 with A6b, less A4, A7, A11, A12, A22): **124** in all. "After workshop" or "after PR #112": 10. "Keep": 9 (C20 joined them with answer 2a). At stop 1 the counts were 33, 32, 15, 23, 17 (120); the rows that changed since are listed in section 8, "Differences from the plan".

### 2. Small UI

#### U2: the Lab Head counters count loans only

**Now.** [LabHeadDashboard.tsx:487-500](../../web/pages/lab-head/LabHeadDashboard.tsx#L487-L500): three cards above both lists: `pendingCount` (loans Pending), `approvedCount` (loans Approved or Returned, labelled "Completed This Period", although no period applies: it counts every loan ever), `declinedCount` (loans Declined). `pendingTransferCount` (line 490) is shown only in the transfer heading (line 569).

**Change.** Four cards, labelled as what they count: **Loans pending**, **Loans approved** (Approved plus Returned, all time; question 4), **Loans declined**, **Transfers pending** (`pendingTransferCount`). The grid goes from `grid-cols-3` to `grid-cols-2 sm:grid-cols-4`, so four cards fit a phone in two rows (a new fourth card in a three-column grid would wrap badly at 390 px, so this layout change is caused by this item). The transfer heading keeps its "({n} pending)".

#### U8: the current custodian near the top of the asset modal

**Now.** The custodian shows only inside the closed "Custodian History & Lifecycle Audit Trail" section ([AssetDetailModal.tsx:407](../../web/features/assets/AssetDetailModal.tsx#L407)), and in the full history (Lab Head only).

**Change.** One line under the badges in the modal header (after line 323), on the detail view: **Custodian: {name}**, from `holderLabel(asset.custodian, asset.custodianHidden)`. So a Custodian sees "Not shown" for an asset someone else holds (D2, the existing rule), and everyone sees "None" for an asset nobody holds. It reads the asset row, not the history, so it shows at once (the history loads after). Not in the facts grid: on a phone that grid's column is 68 px wide and cuts text (section 3).

#### U10: another role's address

**Now.** [RootLayout.tsx:70-77](../../web/app/layouts/RootLayout.tsx#L70-L77): `isOnWrongSection` (any path not under the user's own slug) and `isAtRoot` both `<Navigate to={roleDefaultPath[role]} replace />`. Seen on the UAT copy: a Lab Head who opens `/adric-director/overview` lands on `/lab-head/custody` with no message. An address that no route has (for example `/director/overview`; the Director's tree is `/adric-director/`) shows `NotFound` (outside `RootLayout`), whose button says "Return to Login" to a user who is logged in.

**Change.** `isAtRoot` and a logged-out visitor keep the redirect. For `isOnWrongSection`, `RootLayout` renders its normal frame (sidebar, mobile header, bell) and, in place of the page, a new `web/pages/NoAccess.tsx`: heading **You don't have access to this page**, the line "You are signed in as {roleLabel[role]}. This page is for another role.", and one button **Go to my home page** (`roleDefaultPath[role]`). The other role's page is never mounted, so none of its requests are sent (the server would refuse them with 403 anyway). `RootLayout`'s TSDoc changes with it. With question 5 (b), `NotFound` also shows **Go to my home page** instead of "Return to Login" when someone is logged in.

#### U13: the Lab Head report's "Compliance Status"

**Now.** [LabHeadDashboard.tsx:1034-1046](../../web/pages/lab-head/LabHeadDashboard.tsx#L1034-L1046): a footer with "Auditor Signature / Digital Signature Verified" and "Compliance Status / ✓ AdRIC Assets Compliant / DLSU Engineering Standards". Nothing is checked, signed, or compared with a standard; it is fixed text.

**Change.** The footer goes, both halves. The printed report ends after section IV.

**Other wording with no real source** (every row is fixed text or a made-up value; none reads data that supports it):

| Where | Text | Proposal |
|---|---|---|
| `AdRICDirectorDashboard.tsx:719` | Audit Ready (badge) | Remove (in L4's commit, D13) |
| `AdRICDirectorDashboard.tsx:986` | ...compliance audit trail reporting. | Remove (D5) |
| `AdRICDirectorDashboard.tsx:855` | Deed of Donation Ref: DOD-2024-{n} | Remove (D19) |
| `DirectorAnalyticsView.tsx:333`, `:1065` | Audit Compliance; audit readiness, grant renewal readiness | Rename and remove (D21, D22) |
| `IntakeWizard.tsx:226-229` | Procurement Compliance Checklist (three ✓ lines) | Remove (S10) |
| `CustodianPortal.tsx:713` | ...for Staff inspection compliance. | Rewrite (C11) |
| `InspectionQueue.tsx:258`, `:262` | ITS Governance & Compliance Remarks; ...audit compliance notes... | Rewrite (S26) |
| `OverviewPage.tsx:89-90` | 97.8% System Operational Index | Remove (S7) |
| `Sidebar.tsx:402-412` | All services operational, Last sync: 2 min ago | Remove (A3) |
| `AccountDetailsPage.tsx:298` | Under DLSU Laboratory Infrastructure Policy... | Rewrite (A18) |

With answer 6 (a) the removals beyond the Lab Head footer went into the same commit, only where the text had no data behind it (section 8 lists what was removed).

#### U14: a declined loan still shows a due date

**Now.** [LabHeadDashboard.tsx:546](../../web/pages/lab-head/LabHeadDashboard.tsx#L546): every loan card shows `Due {loan.dueDate}`. Seen on the UAT copy: LOAN-11 (Declined) shows "Due 2026-11-04".

**Change.** The due date line shows only when `loan.status` is Pending or Approved. Declined and Returned cards show only "Requested {date}". (A returned loan's due date has passed its use; the brief names pending and approved.)

### 3. Phone check (M1)

**Run by the agent on 2026-10-23, Playwright (Chrome) at 390 x 844, on the local UAT copy `adric_uat_check`** (started with `C:\dev\uat-data\start-local-uat.ps1`, which printed "Starting on localhost / adric_uat_check"; every API request went to `http://localhost:4000`), logged in as the CITe4D Lab Head account. Nothing was changed: no click approved, declined, or saved anything. Screenshots: `%TEMP%\adric-batchW-m1\screenshots\` (14 files, `m1-01` to `m1-14`). "Wide" is the page area's scroll width against its 375 px visible width. **Nothing was fixed** (no label change exists yet).

| Screen | Wide | What breaks | Screenshot |
|---|---|---|---|
| Requests (Custody Transitions) | **713 px** | **Approve and Decline are off screen**: each loan card puts its buttons to the right of the details (`flex-shrink-0`), at x 513 to 713, so a Lab Head must scroll the whole page sideways to find them. The details row (borrower, destination, purpose, dates) and the three-step timeline also run past the edge ("Pending A..." cut, "Requested {date}" at x 386 to 497). The three counters fit, with "Completed This Period" on three lines. The bell button covers part of the second card | `m1-01-requests-top.png`, `m1-02-requests-full.png` |
| Navigation drawer | fits | Opens and closes. Role text "Lab Head"; the long name is cut ("UAT LabHead CITe4D O...") | `m1-03-nav-drawer.png` |
| Lab Inventory, Gallery | **639 px** | The header row does not wrap: the title is squeezed into a 120 px column ("Branch / Inventory / -- / CITe4D" on four lines) and the Gallery/Table switch and the BRANCH-SCOPED VIEW badge sit off screen (to x 639). The cards themselves fit | `m1-04-inventory-gallery.png` |
| Lab Inventory, Table | 639 px, table 1088 px | The table scrolls inside its card (Asset ID and Name show; Status, Custodian, Location, Condition, Funding need a sideways swipe), which is normal for a table. Clicking "Table" (off screen) scrolled the page sideways and left a blank strip until scrolled back | `m1-05-inventory-table.png`, `m1-06-inventory-table-left.png` |
| Asset detail modal | fits (358 px) | The picture and the facts sit side by side, so the facts column is 68 px wide and cuts serial, property tag, location, and dates ("SN-TUFN...", "2025-08..."). The custodian is not visible without opening the history section (U8). Escape does not close it (the X does) | `m1-07-asset-modal.png` |
| Inventory report dialog | fits | The dialog uses the full screen; the report scrolls inside it and its tables scroll sideways. The four summary figures squeeze into four 60 px columns and their labels run into each other ("MAINTENANCE OPERATIONS LOGGED" into "AVERAGE EQUIPMENT"). Print and Close are reachable | `m1-08-report-dialog.png` |
| Dashboard (Health Benchmarking) | **467 px** | A "Maximize Tab" button row pushes the page sideways. The page is 4,098 px tall. The text shows database words ("Query DB", "project_id", "(null)") | `m1-09-health-top.png`, `m1-10-health-full.png` |
| Account Approvals | fits | No pending sign-ups on the copy, so only the empty state was seen | `m1-11-approvals.png` |
| The bell | fits (342 px) | Fits; Approve Transfer, Authorize Loan, and Decline are on screen. The tab "Clearance Holds" wraps to two lines; the header shows the code name "(LabHead)" (A7) | `m1-12-bell.png` |
| Requests, a declined card | 713 px | LOAN-11 (Declined) shows "Due 2026-11-04" (U14) | `m1-13-declined-loan-card.png` |
| Account Settings | fits | Nothing breaks | `m1-14-account.png` |

**Not counted:** in two screenshots taken right after a page load, the navigation drawer showed half open over the page. Measured at once and six more times over three seconds, it was closed (x = -240) each time, and a second screenshot showed it closed. It may be the screenshot catching the drawer's 0.28 s animation; it was not seen by eye on a real phone. **Changes in this batch that affect a phone:** U2 (four counters, laid out 2 x 2), LH15 (the badge that overflows goes), LH36 ("Expand" is shorter than "Maximize Tab"), U8 (a line in the modal header). Stop 2's H12 measures the same screens again. The Requests buttons off screen are the worst problem; fixing them is a card layout change, out of scope here (question 7).

### 4. Tests

Searched `tests/` for every text this plan changes ("Authoriz", "Audit", "Health Benchmark", "Custody Transition", "Handshake", "Original Intake", "Staff Tagging", "Compliance", the sidebar subtitles, "Available", "Availability", "Completed This Period", "Inventory Report", "ITS Governance", "don't have access"). `npm test` runs only `tests/**/*.test.ts` (API and seed); there are **no web tests** (`*.test.tsx`, `*.spec.*`: none). The hits are all server values this batch does not touch:
- `"Active"` as the listed status: `assets.test.ts:37`, `disposals.test.ts:121`, `:339`, `loans.test.ts:138`, `:323`, `repairs.test.ts:139`, `:363`, `:428`, `returns.test.ts:109`, `:121`, `transfers.test.ts:150`, `:291`, and `tests/setup/fixtures.ts:93`, `:112`, `:120`, `:122`. They pin what `GET /api/assets` sends; L6 changes only what the screen shows, so they stay as they are.
- `auditComplianceData` (`analytics.test.ts:106`, `:164`, `:210`) and `{ name: "Available" }` (`analytics.test.ts:625`, `:657`): field names and values of `/api/analytics`, not changed.

So **no test changes or is added**, and the count stays **415** after every commit. The typecheck stays **65** (the new `assetStatusLabel` and `roleLabel` are typed; removing the unused `label` and `subtitle` fields changes the `roleConfig` type in the same file only). If either count moves, the report says why.

| Commit (section 5) | Tests | Count after |
|---|---|---|
| 1 to 22 (as built, section 8) | none (web) | **415** |
| 23 (docs) | none | **415** |

### 5. Stop 2 plan

On `fix/uat1-labels-ui`, in this order. After every commit: `npm run typecheck` (65) and `npm test` (415); `npm run build` at the end and after commit 1. One label group or one U item per commit. Commit, never push.

| # | Commit message | Files (rows of section 1) |
|---|---|---|
| 1 | `feat(web): one display name per asset availability and per role` | `web/features/assets/assetBadges.tsx`: `assetStatusLabel(status)`, with TSDoc: "Active" and "ACTIVE" give "Available", "ON_LOAN" gives "On Loan", "MAINTENANCE" "Maintenance", "DISPOSED" "Disposed", anything else as it came (so "On Loan", "Overdue" pass through). `web/state/session.tsx`: `roleLabel: Record<Role, string>`. Nothing uses them yet: no screen changes |
| 2 | `fix(labels): Approve instead of Authorize (L1)` | `LabHeadDashboard.tsx` (LH9, LH30), `NotificationCenter.tsx` **lines 807 and 862 only** (A5, A6), `AdRICDirectorDashboard.tsx` (D11, the Authorize button only) |
| 3 | `fix(lab-head): plain names for the Requests page (L2)` | `Sidebar.tsx:54` (LH1), `LabHeadDashboard.tsx:494-495` (LH5, LH6), the file header and TSDoc tab names |
| 4 | `fix(labels): Dashboard for the analytics pages (L3)` | `Sidebar.tsx:47`, `:56`, `:75` (S3, LH3, D2), `HealthPage.tsx` (S30, S32), `LabHeadAnalyticsView.tsx:936-943` (LH34), `DirectorAnalyticsView.tsx:1062-1065` (D21) |
| 5 | `fix(labels): Inventory Report instead of Audit Report (L4)` | `LabHeadDashboard.tsx` (LH20 to LH27, LH29), `Sidebar.tsx:77` (D4), `AdRICDirectorDashboard.tsx` (D13, D14, D17, D18, D20), `AssetDetailModal.tsx` (A13) |
| 6 | `fix(labels): Availability, and Available for Active, on screen only (L5, L6)` | Every status badge, column, and option through `assetStatusLabel`: `LabHeadDashboard.tsx` (LH17, LH19, LH26), `InventoryPage.tsx`, `AssetGalleryCard.tsx` (S12, S14, S15), `EditAssetDialog.tsx` (S18: the `<option>` text only; `value` stays), `CustodianPortal.tsx` (C5, C8, C10: the badge and result lines only), `AdRICDirectorDashboard.tsx` (D15, D17, D18), `DirectorAnalyticsView.tsx:320-322` (D23: `name` only), `AssetDetailModal.tsx` (A8, A16). No comparison changes |
| 7 | `fix(assets): plain names in the custodian summary (L7)` | `AssetDetailModal.tsx:411`, `:415` (A14, A15) |
| 8 | `fix(labels): drop leftover ITS and TSG wording (L8)` | `InspectionQueue.tsx` (S25, S26: labels and options only; the `[TSG Remarks]` and `[ITS Remarks]` prefixes stay, question 2), `HealthPage.tsx:46` (S31), `OverviewPage.tsx:222`, `StaffAnalyticsView.tsx:366` (S35). With question 2 (b) and 3 (b), also C20 and D16 |
| 9 | `fix(layout): one plain name per role in the shell (L9)` | `Sidebar.tsx` (A1: the unused fields go; A2: `roleLabel` in the session card, tooltip, and Preferences; S4, C1, C2), `RootLayout.tsx:111-114` (the chip reads `roleLabel`; "Director" becomes "AdRIC Director") |
| 10 | `fix(staff): plain labels on the Staff screens (L10)` | S2, S5, S6, S8, S9, S11, S13, S16, S17, S19 to S21, S23, S24, S28, S29, S33, S36 |
| 11 | `fix(lab-head): plain labels on the Lab Head screens (L10)` | LH2, LH10, LH13 to LH16, LH18, LH31 to LH33, LH35, LH36 |
| 12 | `fix(custodian): plain labels on the Custodian screens (L10)` | C6, C7, C9, C11 to C13, C15 to C17, C19 |
| 13 | `fix(director): plain labels on the Director screens (L10)` | D1, D3, D5 to D10, D11 ("Reject" only), D12, D22, D24 |
| 14 | `fix(web): plain labels on the account, login, and asset modal (L10)` | A10, A17, A19, A20, A21 (text only) |
| 15 | `fix(lab-head): label the custody counters and add pending transfers (U2)` | `LabHeadDashboard.tsx:487-500` |
| 16 | `fix(assets): show the current custodian near the top of the asset modal (U8)` | `AssetDetailModal.tsx` (after line 323) |
| 17 | `fix(layout): show a no-access screen for another role's address (U10)` | `RootLayout.tsx` (lines 70 to 77 and the TSDoc), new `web/pages/NoAccess.tsx`; with question 5 (b), `NotFound.tsx` |
| 18 | `fix(lab-head): drop the unchecked compliance footer from the report (U13)` | `LabHeadDashboard.tsx:1034-1046` (LH28); with question 6 (a), also S7, S10, A3, A18, D19 |
| 19 | `fix(lab-head): show a loan's due date only while it is pending or approved (U14)` | `LabHeadDashboard.tsx:546` |
| 20 | (only if a hand check finds something) | |
| 21 | `docs(batch W): record the build` | This log ("Stop 2: what was built", the hand check results), `docs/README.md`, `docs/HANDOFF.md` |

**Other people's files.**
- `NotificationCenter.tsx` (Joel, PR #112): **lines 807, 862, and 871 only** (as built), the text inside three buttons ("Authorize Loan" to "Approve Loan", "Authorize Disposal" to "Approve Disposal", "Reject" to "Decline"). No other line, so the merge with #112 is three one-word conflicts at most. The bell's other wording (A7) waits for #112.
- `CustodianPortal.tsx` (Joel, #88 merged): text lines only (C5 to C13), no logic.
- `IntakeWizard.tsx` (Aryan, #102): lines 89, 90, 179, 205, 226 to 229, text only. If #102 is still open, Raiki says so and commit 10 leaves this file out.
- Shared by everyone: `Sidebar.tsx`, `RootLayout.tsx`, `session.tsx` (a new export), `assetBadges.tsx` (a new export).

### 6. Hand checks

#### Batch W hand checks

**H1 to H12: the agent, in a browser (Playwright MCP), on the local UAT copy `adric_uat_check` only**, after stop 2. Raiki may run any of them again the same way. Before starting: stop any `npm run dev:all` and make sure ports 4000 and 5173 are free. Start the app only with `powershell -ExecutionPolicy Bypass -File C:\dev\uat-data\start-local-uat.ps1` (in the background; it refuses a non-local host or a busy port); stop it afterwards and check the ports free. The browser opens only `http://localhost:5173`, and the network log is checked to show only `http://localhost:4000` for `/api`. Accounts: `C:\dev\uat-data\uat-passwords.txt` (never copied anywhere). Screenshots go to `%TEMP%\adric-batchW-handchecks\`; `.playwright-mcp` is deleted from the repository afterwards. H1, H5, and H7 write to the local UAT copy (a loan decision, an unchanged asset save, one inspection report); nothing is written by hand. **No check touches CCS Cloud.** H13 runs in the terminal on the test database.

| # | Item | Role and screen | Steps | Expected | Database |
|---|---|---|---|---|---|
| H1 | L1, the old wording | Lab Head (CITe4D), Requests | Find a Pending loan card; click **Approve** | The buttons read Approve and Decline (no "Authorize" on the page); the loan turns Approved; the counters update | Local UAT copy |
| H2 | L1, the bell and the Director | Lab Head, the bell; Director, Disposal Approvals and the bell | Open each | Lab Head bell: "Approve Loan", "Approve Transfer", "Decline". Director: "Approve Disposal" and "Reject" on the page and in the bell (if the copy has a pending disposal; if not, the empty state reads "No Disposal Requests") | Local UAT copy |
| H3 | L2, L3, L9 | Each role, the navigation drawer and Preferences | Open the drawer; open Preferences | Lab Head: Requests, Lab Inventory, Dashboard (or Analytics), Account Approvals; role text "Lab Head" in the card, the chip, and "Role: Lab Head". Staff: role "Staff" (no unit). Custodian: "Custodian". Director: Overview, Analytics, Disposal Approvals, Inventory Report; "AdRIC Director" | Local UAT copy |
| H4 | L4, U13 | Lab Head, Lab Inventory, Inventory Report | Open it; scroll to the end; click Print Report and read the new window's title | Dialog "Lab Inventory Report"; header "INVENTORY REPORT", the user's name; sections I to IV renamed; no "Audit", "Compliance", "Signature", or ledger ID anywhere in the dialog; the window title is "Inventory Report - CITe4D" | Local UAT copy |
| H5 | L5, L6, the old wording, and that the value did not change | Staff, Asset Inventory (Table), then Edit Asset on an Available asset | Read the table; open Edit Asset; save without changing anything; read the request body | Column "Availability", rows "Available"; the select shows "Available"; the `PUT` body has `"status":"Active"`; the row still shows Available | Local UAT copy |
| H6 | L6, nearby behavior | Custodian, Available Equipment; then the asset modal | Open Available Equipment; open one asset | The list still has assets (the filter compares "Active"); badges "Available"; the modal shows Request Loan (its check compares "Active") | Local UAT copy |
| H7 | L8 | Staff, Inspections, Inspect / Log Report on one asset | Read the dialog; type a hardware remark; Submit & Finalize | Labels "Hardware Remarks", "Records Remarks", no ITS option; the `POST` body's remarks start with `[TSG Remarks]:` (unchanged); the success alert has no "MySQL" | Local UAT copy |
| H8 | U2 | Lab Head, Requests, at 1280 px and at 390 px | Read the counters; count the Pending transfer cards | Four cards: Loans pending, Loans approved, Loans declined, Transfers pending; Transfers pending equals the pending transfer cards; at 390 px two rows of two | Local UAT copy |
| H9 | U8, L7 | Lab Head, Lab Inventory, an asset on loan; Custodian, Available Equipment, an asset someone else held before | Open each modal; open the history section | Lab Head: "Custodian: {name}" under the title, the same name as "Current custodian"; "First custodian: ..." (or "Not assigned"). Custodian, on an asset another person holds (if one is listed): "Custodian: Not shown" | Local UAT copy |
| H10 | U10, the old bug and nearby | Lab Head | Type `/adric-director/overview`; click Go to my home page. Type `/`. Log out and type `/adric-director/overview` | The no-access screen with "Lab Head" and the sidebar; no `/api/analytics/director` or `/api/asset_disposals` request from it; the button opens `/lab-head/custody`. `/` opens `/lab-head/custody`. Logged out: `/login` | Local UAT copy |
| H11 | U14 | Lab Head, Requests | Read LOAN-11 (Declined), a Pending card, an Approved card | LOAN-11 has no "Due"; Pending and Approved show "Due {date}" | Local UAT copy |
| H12 | M1 again | Lab Head, every screen and the asset modal, at 390 x 844 | Measure each page's scroll width as in section 3 | No screen wider than in section 3 (Requests 713, Lab Inventory 639, Dashboard 467 or less, Approvals and Account 375 or 390); the counters, the modal header line, and the no-access screen fit | Local UAT copy |
| H13 | All | The agent, terminal | `npm run typecheck`, `npm run build`, `npm test` with the browser and both servers stopped | 65, passes, 415 | Local test (`adric_db_test`) |

**Results (2026-10-23). H1 to H13: all passed** (the agent; H1 to H12 in Chrome driven by the Playwright MCP on the local UAT copy `adric_uat_check`, H13 in the terminal). No check touched CCS Cloud.

How they ran: the app was started only with `C:\dev\uat-data\start-local-uat.ps1` (it printed "Starting on localhost / adric_uat_check"), after checking ports 4000 and 5173 free; every `/api` request in the network log went to `http://localhost:4000`; the browser opened only `http://localhost:5173`. Accounts from `C:\dev\uat-data\uat-passwords.txt` (not copied anywhere). The Lab Head checks ran at 1280 x 800 and at 390 x 844. Writes to the local copy, all through the screens: LOAN-13 approved (H1), HXIL-0009 saved unchanged (H5), one inspection report on CITe4D-0001 (H7). The print window (H4) and the CSV download (Director) were read inside the page, without opening a print dialog or saving a file. Afterwards the servers were stopped by PID and the ports checked free; `.playwright-mcp` was deleted. Screenshots: `%TEMP%\adric-batchW-handchecks\screenshots\`; the phone before and after pairs: `%TEMP%\adric-batchW-handchecks\phone-before-after\`; the H13 output: `%TEMP%\adric-batchW-handchecks\h13-npm-test.txt`. The only console errors were React's two known development warnings about `ref` (seen in every group).

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| H1 | Passed | Lab Head, Requests: cards show Approve and Decline, no "Authoriz" on the page. Approve on LOAN-13: `PUT /api/asset_loans/13/decision` 200; LOAN-13 Approved, with its due date; counters 2 / 10 / 1 / 1 became 1 / 11 / 1 / 1 | `h1-approved-loan13.png` |
| H2 | Passed | Lab Head bell: Approve Loan, Approve Transfer, Decline. Director, Disposal Approvals (title "Disposal Approvals", "Disposal Requests", "Requested by:", badge "Pending"): Decline and Approve Disposal; Director bell: Approve Disposal and Decline. No decision was made. The bell's disposal card title still says "Disposal Authorization:" (A7, after PR #112) | `h2-labhead-bell.png`, `h2-director-disposals.png`, `h2-director-bell.png` |
| H3 | Passed | Lab Head: Requests, Lab Inventory, Analytics, Account Approvals; role "Lab Head" in the card and chip; Preferences "Signed in as:", "Role: Lab Head"; no SYSTEM STATUS block. Staff: System Overview, Register Equipment, Asset Inventory, Repairs, Inspections, Pending Returns, QR Tags, Analytics; role "Staff"; no Operational Index card. Custodian: My Assets, Available Equipment, QR Scan, Send Inspection Report; role "Custodian". Director: Overview, Analytics, Disposal Approvals, Inventory Report; role "AdRIC Director"; page title "Overview"; no "Control Suite", badge, or "Administrative Oversight"; lab table columns Lab, Campus, Assets, Health Index, Utilization, Condition. Login: "Sign In", "DLSU Email", "Password" | `h3-labhead-sidebar-prefs.png` |
| H4 | Passed | Dialog "Lab Inventory Report"; header "INVENTORY REPORT", "Generated by: UAT LabHead CITe4D One, Lab Head"; summary Assets in Service, Pending Transfers, Repair Tickets, Average Condition Score; sections I. Assets, II. Loans and Transfers, III. Repairs, IV. Disposed Assets; the asset table's column Availability, first row "Available"; none of "Audit", "Compliance", "Signature", "Ledger", "AUD-" in the dialog; the print window's title "Inventory Report - CITe4D" | `h4-inventory-report.png` |
| H5 | Passed | Staff, Asset Inventory (Table): columns ..., Availability, Custodian, Location, Condition, ...; values Available 115, On Loan 9, Maintenance 1, Overdue 1 (no "Active"); tabs "In Service (126)", "Disposed (1)". Edit Asset on HXIL-0009: "Edit Asset: HXIL-0009", labels Funding Source, Lab, Availability, Condition, Custodian; the select shows "Available" with value `Active` (options `Active=>Available`, `On Loan`, `Maintenance`). Save Changes unchanged: `PUT /api/assets/HXIL-0009` 200 with `"status":"Active"`; the row still reads Available | `h5-edit-asset.png` |
| H6 | Passed | Custodian, Available Equipment: "Assets you can request to borrow, from every lab."; 115 badges, all "Available" (the list's filter compares "Active", so it still lists them). Asset modal on CITe4D-0123: badge Available, Request Loan offered (its check compares "Active"); the form's title "Request a Loan", "Due Date". Found here: the modal header read "Request Equipment Loan --" with an em dash; fixed in `34bb6ca5` | `h6-h9-custodian-modal.png` |
| H7 | Passed | Staff, Inspections: title "Inspections"; dialog labels Inspector Role, Condition Rating, Hardware Remarks, Records Remarks; Inspector Role options Staff, Lab Head, Custodian (no ITS). Submit on CITe4D-0001 with a hardware remark: `POST /api/assets/CITe4D-0001/inspection` 200, `reportRemarks` "[TSG Remarks]: ..." (prefix unchanged); alert "Inspection report saved for ASUS TUF Gaming A15." | `h7-inspection-roles.png` |
| H8 | Passed | Desktop: four cards, Loans pending 2, Loans approved 10, Loans declined 1, Transfers pending 1, and one pending transfer card. At 390 px the cards sit two per row (tops 176, 176, 282, 282) | `h8-h11-requests-desktop.png`, `phone-before-after\p1-after-requests.png` |
| H9 | Passed | Lab Head, CITe4D-0102 (On Loan): "Custodian: UAT Custodian One" under the title, the same as "Current custodian"; "Previous custodian: None", "First custodian: None" (its first record had no holder). Custodian, CITe4D-0123 (Available, held by another person): "Custodian: Not shown" | `h9-labhead-modal-custodian.png`, `h6-h9-custodian-modal.png` |
| H10 | Passed | Lab Head types `/adric-director/overview`: the URL stays, the sidebar and bell show, and the page says "You don't have access to this page / You are signed in as Lab Head. This page is for another role. / Go to my home page". Requests sent: only the shared lists of a Lab Head login (`/api/auth/me`, assets, pending-registrations, asset_transfers, asset_loans, asset_disposals, asset_repairs, one each, all 200); no `/api/analytics/director` and no Director disposal queue. The button opens `/lab-head/custody`; `/` opens `/lab-head/custody`. `/director/overview` signed in: the 404 page with "Go to my home page", which opens `/lab-head/custody`. Signed out: `/adric-director/overview` opens `/login`; the 404 page shows "Return to Login" | `h10-no-access.png`, `h10-404-signed-in.png`, `h12-no-access-phone.png` |
| H11 | Passed | LOAN-11 (Declined) and LOAN-1 (Returned) show no "Due"; LOAN-13 and LOAN-12 (Pending) and the Approved cards show "Due {date}" | `h8-h11-requests-desktop.png` |
| H12 | Passed | 390 x 844, page area scroll width against its visible width: Requests 375/375 (was 713), Lab Inventory 375/375 (was 639), Analytics 375/375 (was 467), Account Approvals 390/390, Account Settings 375/375, the no-access screen 390/390. The asset modal's facts sit under the picture, 301 px wide, nothing cut (was 68 px, five values cut). Desktop at 1280: Approve and Decline still at the top right of each card, the Lab Inventory header on one row, the modal facts beside the picture, the Analytics Expand button beside its title | `phone-before-after\` (all) |
| H13 | Passed | With the browser and both servers stopped: typecheck **65**, build passes, `npm test` 16 files, **415** passed | `h13-npm-test.txt` |

### 7. Questions for Raiki

1. **What to call the analytics pages (L3).** The sidebar entry "Health Benchmarking" for Lab Head and Staff, and "Descriptive Analytics" for the Director. Staff already have "System Overview" as their home, and the Director "Executive Overview" (Overview after D1).
   - (a) "Dashboard" for Lab Head and Staff, as the brief proposes; the Director's stays "Analytics". Staff then see both "System Overview" and "Dashboard".
   - (b) "Analytics" for all three roles.
   - **Recommendation: (b).** One name for the same kind of page in every role, and no second "home" for Staff.
2. **ITS and TSG text that is sent to the server (L8).** Staff, Inspections dialog (the remarks prefixes `[TSG Remarks]` and `[ITS Remarks]` saved in the report), and the Custodian's Request Repair form (Forward Target Department: TSG, ITS, Both, sent as `forwardedTo`, which the server ignores; and the "ITS Central Override" step). The 2026-10-08 decision put the forward-to options and the unit labels on a separate ITS removal branch.
   - (a) This batch changes the labels only; the saved prefixes, the forward-to options, and that step wait for the ITS removal branch.
   - (b) This batch also merges the two remarks into one "Remarks" field (new reports saved with one prefix) and drops ITS from the forward-to options and the steps.
   - **Recommendation: (a).** Display only, as the brief asks; (b) changes what is saved.
3. **Property tags on the Director's Inventory Report (L8).** Director, Inventory Report table ("Physical Tag") and the asset history dialog ("ITS Property Tag", "TSG Property Tag"). When an asset has no such tag, the screen invents `DLSU-ITS-{id}` and `DLSU-TSG-{id}`.
   - (a) Keep both labels (they name DLSU offices' tags, not app roles) and show "None" instead of an invented tag.
   - (b) One "Property Tag" showing the asset tag, both DLSU tags gone.
   - (c) Leave as it is.
   - **Recommendation: (a).** The labels are real things; the invented values are not.
4. **What "Completed This Period" becomes (U2).** Lab Head, Requests counters. It counts Approved plus Returned loans, all time.
   - (a) "Loans approved" (Approved plus Returned, all time).
   - (b) Two cards, "Loans out" (Approved) and "Loans returned" (five cards in all).
   - **Recommendation: (a).** Four cards fit a phone; the split can come with the Requests page redesign after the workshop.
5. **An address no route has, for a logged-in user (U10).** Any role. `/director/overview` (not a real address; the Director's is `/adric-director/`) shows the 404 page, whose button says "Return to Login" to someone logged in.
   - (a) U10 covers other roles' real addresses only; the 404 page stays.
   - (b) Also: the 404 page offers "Go to my home page" when someone is logged in (one small change in `NotFound.tsx`).
   - **Recommendation: (b).** It is the same confusion, and the brief's own example (`/director/...`) lands there.
6. **Other text that claims something nothing checks (U13 list).** System Overview ("97.8% System Operational Index"), Register Equipment ("Procurement Compliance Checklist"), the sidebar ("All services operational, Last sync: 2 min ago"), the Director's history dialog ("Deed of Donation Ref"), Account Settings ("Under DLSU Laboratory Infrastructure Policy").
   - (a) Remove or rewrite them in the U13 commit, as section 1 proposes.
   - (b) Only the Lab Head report footer now; list the rest as findings.
   - **Recommendation: (a).** Each is fixed text with no source, as the footer is, and UAT users read them as facts.
7. **The Requests buttons off a phone screen (M1).** Lab Head, Requests, on a phone: Approve and Decline sit at x 513 to 713, reachable only by scrolling the page sideways.
   - (a) Leave it for the Requests page redesign after the workshop (2026-10-29), as the brief puts the card layout out of scope.
   - (b) One small commit here: the card's row wraps on a narrow screen, so the buttons drop under the details. Layout only, no wording.
   - **Recommendation: (b).** UAT continues on phones before 2026-10-29, and it is a two-class change that the redesign would replace anyway.

**Answers (Raiki, 2026-10-23):** 1 (b) "Analytics" for all three roles (LH3, LH34 "Analytics: {lab}", S3, S30). 2 (a) labels only. 3 (a) keep both labels, "None" instead of a made-up tag. 4 (a) "Loans approved". 5 (b). 6 (a), only text with no data behind it; a value from the database keeps its value and only its label changes; the log lists what was removed. 7 (b), as one commit `fix(layout): stop Lab Head screens overflowing on phones`: the Requests card buttons, the Lab Inventory header, the Analytics "Maximize Tab" button, and the asset modal's facts column; CSS classes only (wrapping, min-width, overflow), no structural or desktop change; Escape on the modal stays out (its own issue). Also: "Decline" everywhere, never "Reject" (D11, and the bell's disposal button at line 871); C15 and C17's last step describes what happens today (loans: "Collect the Asset / After approval, get it from the lab"; transfers: "Done / The asset moves to the new custodian"); `IntakeWizard.tsx` is ours to change (#102 is merged).

### 8. Stop 2: what was built (2026-10-23)

On `fix/uat1-labels-ui`, in the planned order, with two commits added (the final sweep, and one found by H6) and the phone commit of answer 7. After every commit: typecheck **65**, build passes, `npm test` **415** (16 files). Nothing pushed.

| # | Commit | Kind | What it does | Tests |
|---|---|---|---|---|
| 1 | `cafc2810` | Addition | `assetStatusLabel()` in `assetBadges.tsx` (Active and ACTIVE give Available; reads the stored form too); `roleLabel` in `session.tsx`. Nothing uses them yet | **415** |
| 2 | `04f6a51c` | Text (L1) | Approve instead of Authorize, Decline instead of Reject: Lab Head cards and Account Approvals, the bell (lines 807, 862, 871 only), the Director's queue, the decommission dialog's success line (S38) | **415** |
| 3 | `ed191d1d` | Text (L2) | Requests; Loan and Transfer Requests | **415** |
| 4 | `adb7f5a5` | Text (L3) | Analytics for Lab Head, Staff, and Director (answer 1b); the Staff benchmark grid says its numbers are samples | **415** |
| 5 | `4dbc0619` | Text (L4) | Inventory Report instead of Audit Report, Lab Head and Director; the made-up ledger ID and the "Audit Ready" badge go; the print title names the user's lab | **415** |
| 6 | `d6bd9a3c` | Text (L5, L6) | Availability, and Available for Active, through `assetStatusLabel()`, on every screen, report, CSV, chart legend, and the modal; no comparison or request body changes | **415** |
| 7 | `740b3d5e` | Text (L7) | First custodian / Not assigned; Previous custodian / None | **415** |
| 8 | `f7c1dea1` | Text (L8) | ITS and TSG labels in the inspection dialog (saved prefixes kept, answer 2a); the TSG badge and ITS Warehouse fallbacks go; "None" instead of made-up property tags (answer 3a) | **415** |
| 9 | `b859f9a9` | Text (L9) | `roleLabel` in the sidebar card, tooltip, mobile chip, and Preferences; the unused sidebar labels and subtitles go | **415** |
| 10 | `3774f2fe` | Text (L10) | Staff screens | **415** |
| 11 | `c38c0e37` | Text (L10) | Lab Head screens (Lab Inventory, Destination Lab, Expand, and the rest) | **415** |
| 12 | `63565afd` | Text (L10) | Custodian screens and the request forms (C15, C17 as Raiki asked) | **415** |
| 13 | `7df34dd5` | Text (L10) | Director screens; the page title is the tab's name | **415** |
| 14 | `a4916014` | Text (L10) | Account Settings (its role through `roleLabel`), Login, the asset modal, the 404 text | **415** |
| 15 | `7cd2daf2` | **Behavior change** (U2) | Four counters: Loans pending, Loans approved, Loans declined, Transfers pending; 2 per row on a phone | **415** |
| 16 | `36eee017` | **Behavior change** (U8) | Custodian: {name} under the asset's name in the modal; "Not shown" for a Custodian on someone else's asset | **415** |
| 17 | `e96dd3e0` | **Behavior change** (U10) | `NoAccess` inside the frame for another role's URL; the 404 page offers the user's home when signed in (answer 5b) | **415** |
| 18 | `450ca4be` | **Behavior change** (U13) | Removes the fixed claims (answer 6a, list below) | **415** |
| 19 | `78e2a04d` | **Behavior change** (U14) | Due date only on Pending and Approved loans | **415** |
| 20 | `42095b6c` | **Behavior change** (answer 7) | `fix(layout): stop Lab Head screens overflowing on phones`: CSS classes only (below) | **415** |
| 21 | `0115b495` | Text (L10, added) | The final sweep: "Signed in as:" in Preferences; the Lab Head analytics loading and allocation texts without "MySQL" (LH38); two stale comments | **415** |
| 22 | `34bb6ca5` | Text (L10, added) | Found by H6: the modal header named the open form with an em dash; now "Request a Loan: {asset}" (A23) | **415** |
| 23 | this commit | Docs | This section, the rows that changed, the hand check results, `docs/README.md`, `docs/HANDOFF.md` | **415** |

**Counts.** Typecheck **65** and tests **415** in every commit (web only; no test file changed). No schema, migration, server, `package.json`, or CCS Cloud change. `NotificationCenter.tsx`: lines 807, 862, 871 only.

#### What U13 removed (answer 6a)

Each is fixed text or a value made up in the browser; none reads data. Nothing that comes from the database was removed.

| Where | Removed | Why there was nothing behind it |
|---|---|---|
| Lab Head inventory report, footer (`LabHeadDashboard.tsx`) | "Auditor Signature / Digital Signature Verified / CITe4D Lab Head / Project Leader" and "Compliance Status / ✓ AdRIC Assets Compliant / DLSU Engineering Standards" | Fixed text; nothing is signed or checked, and it said CITe4D for every lab |
| Staff System Overview (`OverviewPage.tsx`) | The card "97.8% System Operational Index" (the grid now has three cards) | A fixed number (`TODO(H-09)`) |
| Register Equipment (`IntakeWizard.tsx`) | "Procurement Compliance Checklist" with three ✓ lines | Fixed text; nothing checks the form against it |
| Sidebar, every role (`Sidebar.tsx`) | "SYSTEM STATUS / All services operational / Last sync: 2 min ago" | Fixed text; nothing checks the server or times a sync |
| Director, asset history dialog (`AdRICDirectorDashboard.tsx`) | "Deed of Donation Ref: DOD-2024-{n}" | Made from the asset tag's last part; no such record exists |
| Account Settings (`AccountDetailsPage.tsx`) | Rewritten, not removed: the lockout note no longer cites "DLSU Laboratory Infrastructure Policy" or "IT Services" | The rule is real (the fields are read-only); the policy name had no source |

Also removed in their label commits (L4, L10), as section 1 planned: the Lab Head report's ledger ID, the Director's "Audit Ready" badge and "compliance audit trail" subtitle, the Director analytics' "audit readiness" subtitle, and "Audit Compliance" (renamed "Inspection Reports per Month", the same data).

#### The phone fix (answer 7)

CSS classes only, in three files; no element added, moved, or removed. Measured at 390 x 844 before and after on the local UAT copy (pairs in `%TEMP%\adric-batchW-handchecks\phone-before-after\`):

| Screen | Classes | Before | After | Pair |
|---|---|---|---|---|
| Requests, loan and transfer cards (`LabHeadDashboard.tsx`) | The card row `flex-wrap`; the details `min-w-[16rem]`; the details row `flex-wrap gap-y-2` | Page 705 px wide; Approve at x 513 to 606, Decline 614 to 705 | Page 375 px; Approve 44 to 137, Decline 145 to 236, under the details | `p1-before-requests.png`, `p1-after-requests.png` (and `p1-desktop-requests.png`) |
| Lab Inventory header (`LabHeadDashboard.tsx`) | The header and its button group `flex-wrap` | Page 459 px; the title squeezed to 121 px on three lines; Table at x 383 to 458 | Page 375 px; the title on one line (267 px); the buttons on the next line, 16 to 337 | `p2-before-lab-inventory.png`, `p2-after-lab-inventory.png` |
| Analytics widget headers (`LabHeadAnalyticsView.tsx`) | The two card headers with Expand, and the badge and button group, `flex-wrap` | Page 391 px (467 at stop 1, before "Expand" replaced "Maximize Tab"); Expand at x 302 to 391 | Page 375 px; Expand at x 199 to 288 | `p3-before-analytics.png`, `p3-after-analytics.png` |
| Asset modal facts (`AssetDetailModal.tsx`) | The picture and facts row `flex-wrap`; the facts grid `min-w-[16rem]` | Facts grid 152 px, each column 68 px; five values cut (serial, tag, location, two dates) | Facts under the picture, 301 px wide; nothing cut | `p4-before-asset-modal.png`, `p4-after-asset-modal.png` (and `p4-desktop-asset-modal.png`) |

At 1280 x 800 each screen lays out as before: the wraps only happen when the row does not fit.

#### Differences from the plan, and why

- **Answers 1b, 2a, 3a, 5b, 6a, 7b** changed rows LH3, LH34, S3, S30, D2, D21 (Analytics), C20 (now "keep"), D16 (None instead of made-up tags), A21 (the 404 button), and added commit 20.
- **Raiki's inventory changes:** D11 and the bell's disposal button (A6b, line 871) say Decline; C15 and C17's last step describes what happens today.
- **Rows added while building:** S38 (the decommission dialog's "until it's authorized", in commit 2), LH38 and the Preferences "Signed in as:" (final sweep, commit 21), A23 (found by H6, commit 22). A2 also covers the Account page's own role list, which said "Active Custodian" (commit 14).
- **Rows with more text than planned:** LH10 (the report's column too), LH27 (two more empty states), LH35 (the expanded views), S6 (two card descriptions), C12, C13, C19, D5 (the Analytics tab keeps its own title only), D22 (two descriptions).
- **S14's "Cond." went in the Staff commit (10)**, not the L5 commit (6), with LH18 in the Lab Head commit (11), as their L10 rows say.
- **Not changed:** `ReturnForm.tsx`'s fallback name "Active Custodian" for a return with no holder. It is stored with the return request in the browser and the bell matches on it, so it is a value, not a label.

### Noticed, not in this branch

- **Escape does not close the asset modal**; the X and a click outside do (M1).
- **The Health "Benchmarks Grid" shows fixed sample numbers** (`healthData`), not the inventory; S30 labels them as samples. Removing the grid or reading real data is for #96.
- **The custodian history invents an entry** ("Equipment Custodian", `custodian@dlsu.edu.ph`) for an asset with no records (`TODO(H-09)` in `assets.service.ts`). A16's label change leaves it.
- **The "CURRENT ROUTE" pill** in the sidebar shows the URL path, which is for developers (A4).
- **`/lab-headx`** passes the `startsWith("/lab-head")` check in `RootLayout`; a prefix-plus-slash check would be exact. Harmless today (no such route).
- **Existing em dashes elsewhere** (for example the disposal pathway options, `DisposalFormDialog.tsx`, and the server's "Manila -- CITe4D" location text) are stored data, so they stay.
- **The loan and transfer timeline truncates on a phone** ("I...", "P...", "Custod...") now that the card fits the screen. The timeline is part of the Requests card redesign after the workshop.
- **The Transfer form said "The recipient must accept this transfer before custody moves."** Wrong: `decideTransfer` appends a custody record held by the recipient as soon as the Lab Head approves (`handoverRecord` in `transfers.service.ts`). Fixed after stop 2 in `fix(transfers): say what happens after approval on the transfer form (#115)` (row C21): "Once the Lab Head approves, the asset moves to the new custodian."
- **The bell's disposal card title** still says "Disposal Authorization:" (A7, after PR #112), with the two stale bell comments at lines 828 and 852.

---

## Batch L: sign-up and account security (fix/security-batch-l)

Six issues about sign-ups and the account page, one commit each, in the brief's order: #68, #71, #72, #70, #14 with #81, #73. Branch `fix/security-batch-l` from `main` at `9d8cc5fa` (PR #117, Batch W, merged). Baseline there: typecheck **65**, `npm run build` passes, `npm test` **415** passed (16 files). Server, `shared/types/`, three web files (`Register.tsx`, `serverData.tsx`, and with question 2, `session.tsx` and `AccountDetailsPage.tsx`), and the tests. No schema, migration, `package.json`, or CCS Cloud change: nothing here needs one. Stop 1 (this section) is the plan; stop 2 is the build after Raiki's answers.

**Not in this batch:** password hashing (#10, its own branch next), tokens (#11), and anything in `prisma/`. Pending sign-ups stay in `pending_registrations.json` (H-17, Phase 3). Its shape here is taken from the code that reads and writes it (`auth.repository.ts:209-259`, `PendingRegistration` in `shared/types/auth.ts:42-59`); the file itself was not opened.

Line numbers are on `main` at `9d8cc5fa`.

### 1. The issues

#### #68: same-tab sign-up approval uses the wrong request ID

**Cause.** After a sign-up, the Register page adds its own copy of the request to the tab's pending list, with an ID it made up (`REG-` and the time in milliseconds), while the server stored the request under `REG-` and six random digits. In that tab, Approve sends the made-up ID. The server does not find it and builds the account from the body instead (the C-05 fallback, #71), and the real request stays in the file. Rejecting sends the made-up ID too, so nothing is removed on the server. Seen in step 12 batch 3, hand check 5.

**When it happens now (after 13b).** The pending list loads when the role changes. So it happens when a Lab Head is logged in and the sign-up is done in the same tab: Login, Sign up, submit, Return to Sign In, log in again as the same Lab Head (the role does not change, so the list is not reloaded), Account Approvals. A sign-up made while logged out is replaced by the server's list at the next login, so it is not affected.

**Where.** [Register.tsx:97-110](../../web/pages/auth/Register.tsx#L97-L110) builds `regData` with `id: REG-${Date.now()}`, `submittedAt`, and `status`, sends it as the request body (the server ignores those three), and at [Register.tsx:133-135](../../web/pages/auth/Register.tsx#L133-L135) adds `regData` to the list. The server's answer, `data.registration` ([auth.controller.ts:48-58](../../server/features/auth/auth.controller.ts#L48-L58)), is never read.

**Change.** `Register.tsx` sends only the form fields (no `id`, `submittedAt`, or `status`), and adds `data.registration` from the server's answer to the list. Nothing else changes on the page. The file header and TSDoc say so.

**Screens and roles.** Sign-up page (anyone), and the Lab Head's Account Approvals in the same tab. No visible change, except that approving or declining such a request now acts on the server's request.

#### #71 (C-05): approve-registration builds a user from the request body

**Cause.** When the request ID matches no pending request and the body has an email and names, the server makes up a request from the body (any role, any lab, `password123` when none is sent) and creates that account. A Lab Head session is needed since 13b, but one request still creates an account with any role, for example ITS, which maps to ADMIN (M-11).

**Where.** [auth.service.ts:129](../../server/features/auth/auth.service.ts#L129) (`TODO(C-05)`), the fallback at [auth.service.ts:135-149](../../server/features/auth/auth.service.ts#L135-L149); the controller passes every body field ([auth.controller.ts:65-72](../../server/features/auth/auth.controller.ts#L65-L72)); `ApproveRegistrationInput` ([shared/types/auth.ts:61-75](../../shared/types/auth.ts#L61-L75)); the web sends the whole list entry ([serverData.tsx:395](../../web/state/serverData.tsx#L395)); `TODO(C-05)` at [auth.api.ts:87](../../web/api/auth.api.ts#L87).

**Change.** The fallback goes: an unknown ID answers **404** "Pending registration request details not found." (today's text for an unknown ID with no details). The account is built only from the stored request. The controller reads only `requestId`; `ApproveRegistrationInput` becomes `{ requestId: string }`; `serverData.tsx` sends `{ requestId }` only; the two `TODO(C-05)` and the "fallback" comment at line 205 go. Must come after #68, or the same-tab approval of #68 would answer 404.

**Screens and roles.** Lab Head, Account Approvals: no visible change for a request in the list. A direct call with a made-up ID now answers 404 and creates nothing.

#### #72 (C-04): passwords, and the custodian history's emails, sent where no screen needs them

**Cause.** Three answers carry a password that no screen shows: the pending list (every applicant's password, to the Lab Head), the sign-up answer (the applicant's own, back to them), and the approval answer (the whole new `users` row: password, ID number, the picture as base64 text). And the custodian history sends each holder's email to every role, though only one screen shows it.

**Where.**
- Pending list: [auth.service.ts:74-76](../../server/features/auth/auth.service.ts#L74-L76), `TODO(C-04)` at [auth.controller.ts:38](../../server/features/auth/auth.controller.ts#L38) and [auth.api.ts:76](../../web/api/auth.api.ts#L76).
- Sign-up answer: [auth.service.ts:116-117](../../server/features/auth/auth.service.ts#L116-L117) returns the stored request; [auth.controller.ts:57](../../server/features/auth/auth.controller.ts#L57).
- Approval answer: [auth.service.ts:191-209](../../server/features/auth/auth.service.ts#L191-L209) returns the `users` row; [auth.controller.ts:71](../../server/features/auth/auth.controller.ts#L71) sends it as `user`. Nothing reads it: `serverData.tsx` returns it and `LabHeadDashboard.tsx:708` ignores it.
- Custodian history: [assets.service.ts:247](../../server/features/assets/assets.service.ts#L247) (`TODO(C-02)`), `custodianEmail` at [assets.service.ts:270](../../server/features/assets/assets.service.ts#L270), the type at [shared/types/assets.ts:186-187](../../shared/types/assets.ts#L186-L187). The ID number is already gone (13c, answer 6; pinned by `sessionUser.test.ts:140`).

**What the screens show (checked).**
- The Lab Head's sign-up card ([LabHeadDashboard.tsx:664-725](../../web/pages/lab-head/LabHeadDashboard.tsx#L664-L725)): picture, name, user type, email, ID number, requested role, lab, submitted date. No password. So the list keeps every field except `password`.
- The sign-up page reads only `success` and `error` today; after #68 it adds `registration` to the list, which needs no password.
- The asset modal ([AssetDetailModal.tsx](../../web/features/assets/AssetDetailModal.tsx)) loads the history when it opens, for every role ([lines 158-165](../../web/features/assets/AssetDetailModal.tsx#L158-L165)), for the summary "Current custodian / Previous custodian / First custodian" (names only, lines 400-423). The email shows in one place: the full Custodian History view, "Email:" ([lines 750-753](../../web/features/assets/AssetDetailModal.tsx#L750-L753)), whose button is for a Lab Head only ([line 466](../../web/features/assets/AssetDetailModal.tsx#L466)). Staff, the Director, and a Custodian get emails no screen of theirs shows.

**Change.**
- Pending list and sign-up answer: each request without `password`. A new type `PendingRegistrationView` (`Omit<PendingRegistration, "password">`) in `shared/types/auth.ts` for both answers. The stored request keeps its password until #10 and H-17 (approval needs it).
- Approval answer: `user` is `{ userId, firstName, lastName, email }` (a new `ApprovedUser` type); the `message` stays.
- Custodian history: with question 1 (a), `custodianEmail` only for a Lab Head; Staff, the Director, and a Custodian (their own entries too) get no email. **No change to `AssetDetailModal.tsx`** under (a). Under (b), lines 750 to 753 (the "Email:" cell) go and nothing else.
- The `TODO(C-04)` and `TODO(C-02)` comments go; `TODO(H-17)` and `TODO(C-03)` stay (the file and the plain text password are #10 and Phase 3).

**Screens and roles.** No visible change for anyone under 1 (a). The network answers lose the password (Lab Head, the applicant) and the emails (Staff, Director, Custodian).

#### #70: delete the unused POST /api/auth/register

**Cause.** A Lab Head-only route that creates a Custodian account at once, with no approval. No screen calls it.

**Checked:** `web/` and `shared/` have no call to `/api/auth/register` (the only `register` calls are `/api/auth/register-request` in `auth.api.ts:68`; `/register` and `/staff/register` are page routes).

**Where and change.** Delete the route ([auth.routes.ts:17-18](../../server/features/auth/auth.routes.ts#L17-L18), with the comment), `register` in the controller ([auth.controller.ts:19-32](../../server/features/auth/auth.controller.ts#L19-L32)), `register` in the service ([auth.service.ts:29-67](../../server/features/auth/auth.service.ts#L29-L67)), `checkRegistration` ([auth.validation.ts:9-20](../../server/features/auth/auth.validation.ts#L9-L20)), and `RegisterInput` ([shared/types/auth.ts:9-21](../../shared/types/auth.ts#L9-L21)). The file headers' route counts ("nine endpoints") change to eight. `POST /api/auth/register` then answers Express's own 404, as any unknown path.

**Screens and roles.** None.

#### #14 and #81: sign-up accepts an email or ID number already in use

**Cause.** The sign-up checks only accounts, not pending requests ([auth.service.ts:89-97](../../server/features/auth/auth.service.ts#L89-L97), and the note at lines 26-27). So one email (or ID number) can be filed twice; approving the second then fails inside the database with a 500 (the unique key on `users.email` or `users.id_number`). An account clash answers **400**, not 409.

**EV-05.** The UAT manual is not in the repository or in `C:\dev\uat-data`, so EV-05 was not opened. The brief quotes it as "a registered user with this email already exists", which is the server's text today, word for word: "A registered user with this email already exists." It is shown on the sign-up page as the server sends it (`data.error`, [Register.tsx:129-131](../../web/pages/auth/Register.tsx#L129-L131)), whatever the status, so a 409 shows the same text.

**Change.** In `requestRegistration`, in this order:
1. An account has the email: **409** "A registered user with this email already exists." (text unchanged, status 400 to 409).
2. An account has the ID number: **409** "A registered user with this ID number already exists." (same).
3. A pending request has the email (trimmed, any letter case): **409** "A sign-up request with this email is already waiting for approval." (question 4).
4. A pending request has the ID number: **409** "A sign-up request with this ID number is already waiting for approval."

And in `approveRegistration`, before the account is created, checks 1 and 2 again, answering 409 with the same texts instead of a 500, with the request kept. That covers a request filed before this fix (the deployed server's file may hold duplicates) and an account created in between. The pending check reads the list through `authRepository.listPendingRegistrations()`; no new repository function. The note at lines 26-27 goes.

**Screens and roles.** Sign-up page: the two new messages. Lab Head, Account Approvals: an approval that would clash shows the server's message instead of "Something went wrong on the server".

#### #73 (and M-03): the account update's lab, and labs made from typos

**Cause, account update** ([auth.service.ts:382-439](../../server/features/auth/auth.service.ts#L382-L439)).
- The answer's `labAffiliation` is the lab sent, or "CITe4D" when none is sent ([line 436](../../server/features/auth/auth.service.ts#L436)), whatever the account's lab is. The session stores that answer ([session.tsx:310-320](../../web/state/session.tsx#L310-L320)), so the session's lab can become wrong.
- A lab code no research center has is "created" ([lines 404-412](../../server/features/auth/auth.service.ts#L404-L412)). The create always fails today (`MANILA_CAMPUS` is not a valid location), an empty `catch` swallows it, and the answer still names the unknown lab. The name is saved first, so a refused lab still changes the name.
- **Found while planning (from the code).** The Account Settings page always sends a lab, although its lab field is read-only (and hidden for the Director and Staff, [AccountDetailsPage.tsx:272-282](../../web/pages/AccountDetailsPage.tsx#L272-L282)). It sends the lab `/me` answers, which is "CITe4D" for an account with no lab ([auth.service.ts:356](../../server/features/auth/auth.service.ts#L356)). So **a Director or Staff member who saves their name is linked to CITe4D** (the code finds the CITe4D research center and adds a link). The page also starts from the full name "Center for ICT for Development (CITE4D)" before `/me` answers ([AccountDetailsPage.tsx:38](../../web/pages/AccountDetailsPage.tsx#L38)), which matches no short code. Question 2.

**Cause, approval** ([auth.service.ts:168-189](../../server/features/auth/auth.service.ts#L168-L189)). The lab is matched by name, short code, or the code in brackets; when nothing matches, a new research center is created from the text (location MANILA, so this create works). The sign-up form's labs ([shared/constants/labs.ts](../../shared/constants/labs.ts)) all match a research center on the UAT copy by full name, except "DLSU AdRIC" (and "No affiliation", which links no lab). So today approving a "DLSU AdRIC" request, or any typed text from a direct call, creates a research center.

**Change.**
- **Account update.** The lab is checked before anything is saved. No lab sent, an empty one, or "Not Affiliated": the lab is not changed. A short code that matches a research center: the account moves to it, as today. Anything else: **400** "Unknown lab: {code}." and nothing is saved, the name included. Never a research center created. The answer's `labAffiliation` is the account's lab after the save, worked out as `/me` does (the first lab link's short code, or "CITe4D" with none), so the account page and `/me` always agree. With question 2 (a), `session.tsx` stops sending the lab and `AccountDetailsPage.tsx` stops passing it (lines 91, 103, 116); `updateProfile` loses its `labAffiliation` parameter.
- **Approval.** No research center is created. A lab that matches nothing answers **400** "The lab on this request, {lab}, is not a known lab. Decline it and ask the applicant to sign up again." and creates nothing; the request stays in the list so the Lab Head can decline it. "No affiliation" and "Not Affiliated" still link no lab. With question 3 (a), the sign-up itself is not checked.
- `createResearchCenter` ([auth.repository.ts:182-187](../../server/features/auth/auth.repository.ts#L182-L187)) then has no caller and is deleted. `TODO(M-03)` at line 408 goes; the M-03 lab list itself is Phase 3. `AccountUser.labAffiliation`'s TSDoc changes.

**Screens and roles.** Every role, Account Settings: no visible change (with 2 (a), the session's lab is the real one). Lab Head, Account Approvals: a request with an unknown lab shows the refusal instead of making a lab.

### 2. Tests that pin the old behavior

Every test that asserts what this batch changes, by file and line on `9d8cc5fa`. Count after each commit is in section 4.

| Commit | Test | Pins | Change |
|---|---|---|---|
| #71 | `registration.test.ts:183` "creates an account with the requested role from the body alone when the request id is unknown (known defect C-05)" | 200 and an ADMIN account | Becomes "answers 404 for an unknown request id even with applicant details, and creates no account": 404, `success: false`, no `users` row with that email |
| #72 | `registration.test.ts:76` "stores password123 when no password is sent (known defect C-03)" | Reads `registration.password` from the sign-up answer | Reads the stored request from the file (`pendingFile()`) instead, so it keeps pinning C-03 (#10) |
| #72 | `registration.test.ts:114` "includes each applicant's password, to any caller (known defect C-04)" | `listed.password` is the password | Becomes "lists each request without its password, with the fields the card shows": no `password` key; name, email, ID number, user type, role, lab, picture, date present |
| #72 | `registration.test.ts:141` "answers with the created row, password included (known defect, 01C 4.1)" | `user` has `password` | Becomes "answers the new account's id, names, and email only": `user` equals `{ userId, firstName, lastName, email }` |
| #72 | `sessionUser.test.ts:119` "gives a Custodian their own entries in full, hides other holders..." | `own` has `custodianEmail` | With 1 (a): `own` has `custodianName` and no `custodianEmail`. The rest stays. `sessionUser.test.ts:140` (Lab Head gets emails) stays under (a); under (b) it asserts no email |
| #70 | `registration.test.ts:215-258`, the four "POST /api/auth/register (no caller)" tests | The route works | Deleted, with the `describe` |
| #70 | `session.test.ts:45`, row 8 of the role table (`POST /api/auth/register`, Lab Head) | 401, 403, and the Lab Head reaches the handler | Row deleted (an unknown path answers 404 before any session check, so the row cannot pass) |
| #14 | `registration.test.ts:91` "answers 400 for an email or an id number that already belongs to an account" | 400 | 409, and the two exact texts |
| #73 | `auth.test.ts:187` "answers an unknown lab code as saved, but creates no lab and keeps the old link" | 200 and `labAffiliation: "NOLAB"` | Becomes "answers 400 for an unknown lab code and saves nothing": 400, no `NOLAB` research center, the old link kept, the name not changed |
| #73 | `auth.test.ts:201` "answers labAffiliation CITe4D when no lab is sent, whatever the account's lab is (new finding)" | `CITe4D` | Becomes "answers the account's own lab when no lab is sent": `LAB.shortCode`, link unchanged |
| #73 | `registration.test.ts:163` "creates a new research center for a lab it does not know, and links the account to it (new finding)" | A `TESTX` research center | Becomes "answers 400 for a lab it does not know, and creates no research center and no account": 400, no `TESTX` center, no `users` row, the request still listed |

Also read, and unchanged: the B1 lab tests `auth.test.ts:161` (no lab to a known code) and `:173` (move to another known code), and `:56` (login answers CITe4D for no lab: the `/me` rule, which #73's answer reuses); `registration.test.ts:49` (the sign-up defaults, CITe4D included: the sign-up is not checked under question 3 (a)); `:125` and `:149` (approval by short code, roles); `:176` (unknown ID with no details: 404); `:194-212` (reject); `session.test.ts:318` (register-request is public). No test reads `pending_registrations.json` other than `registration.test.ts` (the test server's own temporary copy).

### 3. New tests

Each fix has at least one test that fails on `9d8cc5fa` and passes after it, marked **fails before**. Where the fix replaces a pinned defect, the changed test in section 2 is that test.

| Commit | File | Test | Fails before |
|---|---|---|---|
| #68 | none | No web test runner exists (`npm test` runs `tests/**/*.test.ts` against the API; there are no `*.test.tsx`), and adding one needs packages. The fix is checked by hand check H1, and after #71 the old same-tab path would answer 404 (question 5) | n/a |
| #71 | `registration.test.ts` | The changed C-05 test (section 2) | **yes** (200 before) |
| #71 | `registration.test.ts` | "approves from the stored request and ignores other fields in the body": a known ID with a body naming another email and role ITS creates the stored applicant as CUSTODIAN, and no account for the body's email | no (a guard: the web now sends the ID only) |
| #72 | `registration.test.ts` | "answers a sign-up without its password": the register-request answer has no `password` key and has the server's `REG-` ID | **yes** |
| #72 | `sessionUser.test.ts` | "sends no email to Staff or the Director" (1 (a)): every entry of `custodian-history` for Staff and the Director has a name and no `custodianEmail` | **yes** |
| #70 | `registration.test.ts` | "has no POST /api/auth/register: 404 for a Lab Head, and no account": full body, 404, no `users` row | **yes** (200 before) |
| #14 | `registration.test.ts` | "answers 409 for an email a pending request has, in any letter case": the second sign-up, same email in capitals, 409 with the pending text, one request listed | **yes** (200 before) |
| #14 | `registration.test.ts` | "answers 409 for an ID number a pending request has" | **yes** |
| #14 | `registration.test.ts` | "accepts an email again once its request was declined" | no (a guard: the check reads the pending list, not a history) |
| #14 | `registration.test.ts` | "answers 409, not 500, when an account took the request's email before approval, and keeps the request": sign up, create a `users` row with that email in the test database, approve | **yes** (500 before) |
| #73 | `auth.test.ts` | "answers the same lab as GET /api/auth/me": Custodian B (TEST lab) and TSG Staff (no lab), names only; the answer's `labAffiliation` equals `/me`'s | **yes** (CITe4D for Custodian B before) |
| #73 | `registration.test.ts` | "finds the lab by its full name, as the sign-up form sends it": `labAffiliation: LAB.name`, the account linked to `LAB.centerId` | no (a guard for the match without the create) |

Test values are made up (`@example.test` emails, ID numbers from 91000001, `test-password-*`), as the file does today.

### 4. Stop 2 plan

On `fix/security-batch-l`, in this order. After every commit: `npm run typecheck` (65) and `npm test`; `npm run build` after the web commits (1, 2, 6) and at the end. One issue per commit; a test that pins the old behavior changes in the same commit. Commit, never push.

| # | Commit message | Files | Tests | Count after |
|---|---|---|---|---|
| 1 | `fix(auth): list the server's copy of a same-tab sign-up (#68)` | `web/pages/auth/Register.tsx` | none | **415** |
| 2 | `fix(auth): refuse approval of an unknown sign-up request (#71)` | `auth.service.ts`, `auth.controller.ts`, `shared/types/auth.ts`, `web/state/serverData.tsx`, `web/api/auth.api.ts` (the TODO and TSDoc); with question 6 (b), the one alert in `serverData.tsx` | 1 changed, 1 added | **416** |
| 3 | `fix(auth): send no passwords, and custodian emails only where shown (#72)` | `auth.service.ts`, `auth.controller.ts`, `shared/types/auth.ts`, `web/api/auth.api.ts` (TODO), `assets.service.ts`, `shared/types/assets.ts`; under 1 (b) also `AssetDetailModal.tsx:750-753` | 4 changed, 2 added | **418** |
| 4 | `refactor(auth): delete the unused POST /api/auth/register (#70)` | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.validation.ts`, `shared/types/auth.ts`; `tests/api/registration.test.ts` and `session.test.ts` | 5 removed, 1 added | **414** |
| 5 | `fix(auth): refuse a sign-up whose email or ID number is taken or pending (#14, #81)` | `auth.service.ts` (sign-up and approval checks), the controller TSDoc | 1 changed, 4 added | **418** |
| 6 | `fix(auth): answer the real lab and never create a lab from a sign-up or account (#73)` | `auth.service.ts`, `auth.repository.ts` (`createResearchCenter` deleted), `shared/types/auth.ts` (TSDoc); with question 2 (a), `web/state/session.tsx` and `web/pages/AccountDetailsPage.tsx` | 3 changed, 2 added | **420** |
| 7 | (only if a hand check finds something) | | | |
| 8 | `docs(batch L): record the build` | This log (stop 2 section, hand check results), `docs/README.md`, `docs/HANDOFF.md` | none | **420** |

Commit 4 is `refactor`: it removes a route no screen calls; its only behavior change is that path answering 404. **The typecheck** should stay 65: the deleted code has no errors in the list, and the narrowed types are used in one place each. If it moves, the report says why.

**Other people's files.** `NotificationCenter.tsx` (Joel, PR #112): not touched. `AssetDetailModal.tsx` (Aryan, Escape): not touched under question 1 (a); under (b), lines 750 to 753 only (the "Email:" cell inside the full history grid).

### 5. Hand checks

#### Batch L hand checks

**H1 to H10: the agent, in a browser (Playwright MCP), on the local UAT copy `adric_uat_check` only**, at stop 2. Raiki may run any of them again the same way. Before starting: make sure ports 4000 and 5173 are free (stop any `npm run dev:all`). Start the app only with `powershell -ExecutionPolicy Bypass -File C:\dev\uat-data\start-local-uat.ps1`, in the background (it refuses a non-local host or a busy port); stop it afterwards and check the ports free. The browser opens only `http://localhost:5173`; direct API calls go only to `http://localhost:4000`, sent from the logged-in page (`fetch` with the session cookie), and the network log is checked to show only `localhost:4000` for `/api`. Accounts: `C:\dev\uat-data\uat-passwords.txt` (never copied anywhere). Screenshots: `%TEMP%\adric-batchL-handchecks\`; `.playwright-mcp` is deleted from the repository afterwards. **No check touches CCS Cloud.** H11 runs in the terminal on the test database.

**Made-up applicants.** Sign-ups use made-up names, `@dlsu.edu.ph` addresses the form accepts (for example `batch-l-h1@dlsu.edu.ph`, checked against the copy's accounts first), and ID numbers from 99000001; direct calls use `@example.test`. **Writes:** H1 and H8 create two accounts on the UAT copy (local only). The server keeps sign-ups in `pending_registrations.json` in its working folder, the repository root under the start script (question 7): every request the checks file is approved or declined before the end, and no other request is touched.

| # | Issue | Role and screen | Steps | Expected | Database |
|---|---|---|---|---|---|
| H1 | #68, the old bug | Lab Head (CITe4D), Login, Sign up, then Account Approvals, one tab | Log in as the Lab Head. Open `/login` in the same tab (the session is restored). Click Sign up; fill the form (lab CITE4D); Submit. Click Return to Sign In; log in again as the same Lab Head. Open Account Approvals from the sidebar (no reload). Approve the new card. Reload the page | The sign-up answer's `registration.id` is `REG-` and six digits; the card is listed; the approve body is `{"requestId": <that id>}` and answers 200; after the reload the card is gone (before the fix it came back). The new account logs in to the Custodian portal | Local UAT copy |
| H2 | #71 | Lab Head, a direct call | `POST /api/auth/approve-registration` with `requestId: "REG-000000"`, names, an `@example.test` email, `requestedRole: "ITS"`, a made-up password. Then `POST /api/auth/login` with that email and password | 404, "Pending registration request details not found."; the login answers 401 (no account) | Local UAT copy |
| H3 | #72 | Lab Head, Account Approvals, and the network answers | File one sign-up (logged out, a second browser context). As the Lab Head, open Account Approvals; read `GET /api/auth/pending-registrations`. Read H1's sign-up and approve answers | No entry has `password`; each has name, email, ID number, user type, role, lab, picture, date, and the card shows them. The sign-up answer has no `password`. The approve answer's `user` has exactly `userId`, `firstName`, `lastName`, `email` | Local UAT copy |
| H4 | #72, custodian history | Lab Head, Staff, Director, Custodian; the asset modal of an asset on loan | Lab Head: open the asset, then the full Custodian History. Each other role: open the same asset; read `custodian-history` | Lab Head: "Email:" shows each holder's email (1 (a)). Staff, Director, Custodian: no `custodianEmail` in any entry; the summary names (Current, Previous, First custodian) as before; a Custodian still sees "Not shown" for another holder | Local UAT copy |
| H5 | #14, #81 | Signed out, Sign up | (1) An existing account's email (one from the copy, not written down). (2) A new email: submit. (3) The same new email in capitals, another ID number. (4) Another email, the ID number of (2). Then as the Lab Head, decline (2) | (1) "A registered user with this email already exists." with status 409. (2) Success. (3) "A sign-up request with this email is already waiting for approval.", 409. (4) The ID number text, 409. The decline removes (2) | Local UAT copy |
| H6 | #73, the old bug | Custodian (a lab other than CITe4D, if the copy has one; else the CITe4D one), Account Settings, then direct calls | Change the first name, Save; read the `PUT` body and answer. Direct `PUT /api/auth/account` with names only. Direct `PUT` with `labAffiliation: "NOLAB"` and another first name. `GET /api/auth/me`. Put the name back | Save works; with 2 (a) the body has no `labAffiliation`; the answer's `labAffiliation` is the account's lab (as `/me`), not CITe4D. Names only: the same lab. NOLAB: 400 "Unknown lab: NOLAB."; `/me` shows the name unchanged | Local UAT copy |
| H7 | #73, M-03 | Lab Head (CITe4D), Account Approvals | Signed out, a direct `POST /api/auth/register-request` with `labAffiliation: "CITE4D Typo Lab (CITE4DX)"` (the Lab Head's list shows it because it contains "CITE4D"). As the Lab Head, Approve it; then Decline it | Approve: the refusal "The lab on this request, ... is not a known lab..." (400), shown once with 6 (b); the card stays; a login with its email answers 401. Decline removes it | Local UAT copy |
| H8 | Nearby: a normal approval | Signed out, Sign up; then Lab Head (CITe4D), Account Approvals | Sign up with lab "Center for ICT for Development (CITE4D)" in a fresh context. Log in as the Lab Head; Approve. Log in as the new account; open Account Settings | One alert "Account for {name} approved."; the card goes; the new account opens the Custodian portal; Account Settings shows lab CITe4D | Local UAT copy |
| H9 | #70 | Lab Head, a direct call | `POST /api/auth/register` with a full body (`@example.test` email); then a login with it | 404; login 401 | Local UAT copy |
| H10 | Nearby: decline and the empty list | Lab Head, Account Approvals | After H1 to H9, read the list | Only requests the checks did not file (if any); "No sign-up requests for CITe4D" if none. A Director and a Staff account's Account Settings save still works (name only) | Local UAT copy |
| H11 | All | The agent, terminal | `npm run typecheck`, `npm run build`, `npm test`, with the browser and both servers stopped | 65 (64 as built, section 7), passes, 420 | Local test (`adric_db_test`) |

### 6. Questions for Raiki

1. **Who gets the custodian's email in the custodian history (#72).** The history answer sends each holder's email to every role; only the Lab Head's full Custodian History view (asset modal, "Email:") shows it.
   - (a) Send the email to a Lab Head only; Staff, the Director, and a Custodian get none. Server only; `AssetDetailModal.tsx` is not touched.
   - (b) Send no email to anyone, and remove the "Email:" cell from the full history (`AssetDetailModal.tsx` lines 750 to 753 only).
   - (c) Keep it as it is.
   - **Recommendation: (a).** Each role gets what its screens show, and Aryan's file stays untouched.
2. **The lab that Account Settings sends (#73).** Every role, Account Settings: the lab field is read-only, but the page sends a lab on every save, and for the Director and Staff that is "CITe4D" (the fallback `/me` answers), which links them to CITe4D.
   - (a) The server fix as planned, and the page stops sending the lab (`session.tsx` and `AccountDetailsPage.tsx`, about five lines). A lab change then needs a direct call with a known code.
   - (b) The server fix only; the page keeps sending it, so a Director or Staff save still links them to CITe4D.
   - (c) The server fix, and the account update never changes the lab at all: any lab in the body is refused with 400, until Phase 3 gives labs their own screen.
   - **Recommendation: (a).** It stops the wrong CITe4D links, keeps the brief's rule for a lab that is sent, and the screen already treats the lab as read-only.
3. **Where an unknown lab on a sign-up is refused (#73, M-03).** Sign-up page (anyone) and the Lab Head's Account Approvals. The form's labs all match a research center except "DLSU AdRIC".
   - (a) At approval only (400, the request stays to be declined); the sign-up is not checked.
   - (b) Also at sign-up: an unknown lab answers 400 there, so the applicant picks again. "DLSU AdRIC" would then be refused at sign-up (or removed from the list), and the sign-up tests send a lab the test database has.
   - **Recommendation: (a).** It is what the brief asks, and no Lab Head's list shows a "DLSU AdRIC" request today anyway (Noticed, below).
4. **The text for a sign-up already waiting (#14, #81).** Sign-up page (anyone). I could not open the UAT manual (it is not in the repository or `C:\dev\uat-data`), so EV-05 was matched to the brief's quote, which is the server's text today.
   - (a) Accounts keep today's text ("A registered user with this email already exists.", and the ID number one); a pending request gets "A sign-up request with this email is already waiting for approval." (and the ID number one).
   - (b) A pending request gets the account text too.
   - (c) You paste EV-05's expected text and I match it.
   - **Recommendation: (a).** The applicant learns the truth: wait for the Lab Head, do not try to log in.
5. **The test for #68.** It is a web bug, and the project has no web tests.
   - (a) No automated test: hand check H1 checks it, and #71's test makes the old path fail loudly (404) if it ever comes back.
   - (b) Move the "which copy to list" step into a small function and test it from `tests/` (a first web-side test, no new package).
   - **Recommendation: (a).** A one-line web change does not need a new kind of test; (b) is better done once for the whole web app.
6. **Two alerts when the server refuses an approval.** Lab Head, Account Approvals: today a refusal shows the server's message, then a second alert "Error connecting to server: ..." (`serverData.tsx`, the `catch` catches its own `throw`). After this batch the server refuses with real reasons (404, 409, 400).
   - (a) Leave it.
   - (b) One alert with the server's message, in #71's commit (three lines in `serverData.tsx`).
   - **Recommendation: (b).** The second alert says the server could not be reached, which is false and is what the Lab Head would report.
7. **The pending sign-up file during the hand checks.** The start script runs the server from the repository root, so the hand checks' sign-ups are written to the repository's `pending_registrations.json` (ignored by git), the same file a run against CCS Cloud uses.
   - (a) Run them so: the checks approve or decline every request they file and touch no other, and nobody opens the file.
   - (b) Run only the checks with no sign-up (H2, H4, H6, H9, H11), and you run the others.
   - **Recommendation: (a).** The file ends as it started, and the checks need the real server path to prove #68.

**Answers (Raiki, 2026-10-23):** 1 (a), 2 (a), 3 (a), 4 (a), 5 (a), 6 (b), 7 (a). On 3: the sign-up form does not change in this batch; "DLSU AdRIC" is listed under Noticed for Raiki to file. On 7: every sign-up the checks file is approved or declined, so the file ends as it started; the file is never opened.

### 7. Stop 2: what was built (2026-10-23)

On `fix/security-batch-l`, in the planned order, one commit per issue. After every commit: `npm run typecheck`, `npm run build`, `npm test`. Each new or changed test that should fail before its fix was run against the old server code (the fix's server files stashed) and failed, then passed with the fix. Nothing pushed.

| # | Commit | Kind | What it does | Typecheck | Tests |
|---|---|---|---|---|---|
| 1 | `9f9f304e` | Behavior change (#68) | `Register.tsx` sends only the form fields and lists `data.registration`, the server's copy with its ID | 65 | **415** |
| 2 | `b648751f` | Behavior change (#71) | No account from the body: an unknown ID answers 404; the web sends `{ requestId }` only; one alert on a refusal (answer 6b) | 65 | **416** |
| 3 | `6cdba684` | Behavior change (#72) | No password in the pending list or the sign-up answer; the approval answers `{ userId, firstName, lastName, email }`; the custodian email for a Lab Head only (answer 1a) | 65 | **418** |
| 4 | `75bdd5d1` | Removal (#70) | `POST /api/auth/register` deleted (route, controller, service, validation, type); the path answers 404 | 65 | **414** |
| 5 | `ab41e857` | Behavior change (#14, #81) | 409 for an email or ID number an account or a waiting request has (answer 4a); approval answers 409, not 500 | 65 | **418** |
| 6 | `e5e40ccf` | Behavior change (#73) | The account update checks the lab first (unknown: 400, nothing saved) and answers the account's lab; approval refuses an unknown lab (400); `createResearchCenter` deleted; the account page sends no lab (answer 2a) | **64** | **420** |
| 7 | (none needed) | | No hand check found anything to fix | | |
| 8 | this commit | Docs | This section, the answers, the hand check results, `docs/README.md`, `docs/HANDOFF.md`, and the two counts in `AGENTS.md` | 64 | **420** |

**Counts.** Tests 415, 416, 418, 414, 418, 420, as planned. **Typecheck 65 to 64 in commit 6:** one of the old errors was the account update's `createResearchCenter({ ..., location: "MANILA_CAMPUS" })` (`TS2322`, not a valid `research_centers_location`), the very create that #73 deletes; the error list is otherwise the same (compared line by line before and after). No schema, migration, `package.json`, or CCS Cloud change. `NotificationCenter.tsx` and `AssetDetailModal.tsx` are not touched.

#### Differences from the plan, and why

- **Two more tests pinned the email for Staff** (`assets.test.ts:182` "includes each custodian's email ... for any role" and `:196` the H-09 invented entry with `custodian@dlsu.edu.ph`); section 2 missed them. Both changed in commit 3: the first now pins the email for a Lab Head and none for Staff, the second keeps the invented entry pinned without its email for Staff. The count is unchanged (changed, not added).
- **The invented H-09 entry's email** goes to a Lab Head only, like the real ones (answer 1a covers every entry).
- **Commit 6's typecheck** went down by one (above).
- **The account update reads the lab before saving** and answers the lab with the same rule as `getProfile` (one extra read of the account after the save).

#### Batch L hand checks: results

**Results (2026-10-23). H1 to H11: all passed** (the agent; H1 to H10 in Chrome driven by the Playwright MCP on the local UAT copy `adric_uat_check`, H11 in the terminal on `adric_db_test`). No check touched CCS Cloud.

How they ran: ports 4000 and 5173 were checked free; the app was started only with `C:\dev\uat-data\start-local-uat.ps1` in the background (the first start did not run: the shell dropped the backslashes in the path, so PowerShell found no file; the second, with the path quoted, printed "Starting on localhost / adric_uat_check"). Every `/api` request went to `http://localhost:4000` (the only other requests were the app's Google fonts and Unsplash preset pictures); the browser opened only `http://localhost:5173`. Accounts from `C:\dev\uat-data\uat-passwords.txt`, not copied anywhere. Afterwards the two servers were stopped by PID and the ports checked free; `.playwright-mcp` was deleted. Screenshots: `%TEMP%\adric-batchL-handchecks\screenshots\` (15 files); H11's output: `%TEMP%\adric-batchL-handchecks\h11-checks.txt`.

**Writes to the local UAT copy and the sign-up file.** Two accounts created by approval (H1: `batch-l-h1@dlsu.edu.ph`, H8: `batch-l-h8@dlsu.edu.ph`, made-up names "BatchL Hcheck"); Custodian Four's first name changed and put back (H6); the Staff and Director names saved unchanged (H10). Four requests filed (H1, H5, H7, H8): H1 and H8 approved, H5 and H7 declined, so the sign-up file holds what it held before. One request filed before the checks (lab "No affiliation") was listed by the server and not touched: no Lab Head's list shows it (Noticed). The file was not opened.

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| H1 | Passed | Lab Head logged in; `/login` in the same tab (session restored); Register New Account; submit. The body had no `id`, `submittedAt`, or `status`; the answer's `registration.id` was `REG-103164`, with no `password`. Return to Sign In; the same Lab Head again: no `pending-registrations` request followed this login (the old bug's condition). Account Approvals from the sidebar: the card was listed; Approve sent `{"requestId":"REG-103164"}`, 200. After a reload the server's list no longer had it. The new account logged in to `/custodian/myassets` | `h1-after-reload.png`, `h1-new-account-custodian.png` |
| H2 | Passed | `POST /api/auth/approve-registration` with `REG-000000`, names, an `@example.test` email, role ITS: 404 `{"success":false,"error":"Pending registration request details not found."}`; a login with that email: 401 | |
| H3 | Passed | `GET /api/auth/pending-registrations`: no entry has `password`; keys `id, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, avatarUrl, submittedAt, status`. The cards show name, user type, email, ID number, role, lab, date. The sign-up answers had no `password` (H1, H5, H7, H8). H8's approve answer: `user` is exactly `{ userId, firstName, lastName, email }` | `h7-h8-approvals-list.png` |
| H4 | Passed | CITe4D-0102 (on loan, held by UAT Custodian One). Lab Head, full Custodian History: "Email:" shows the holder's email (and "--" for the first entry, which has no holder). Staff, Director, Custodian One (the holder), Custodians Two to Four: no `custodianEmail` in any entry; the names as before; Custodians Two to Four get `custodianHidden`. Staff's modal: "Custodian: UAT Custodian One", "Current custodian: UAT Custodian One" | `h4-labhead-full-history.png`, `h4-staff-modal-summary.png` |
| H5 | Passed | Signed out, Sign up. (1) An existing account's email: 409, the form shows "Registration Error: A registered user with this email already exists." (2) A new email: submitted. (3) The same email typed in capitals: 409 "A sign-up request with this email is already waiting for approval." (the form lowercases it; a direct call with ` BATCH-L-H5@DLSU.EDU.PH ` also answered 409). (4) Another email, the ID number of (2): 409 "A sign-up request with this ID number is already waiting for approval." Then (2) was declined by the Lab Head | `h5-1-account-email.png` to `h5-4-same-id.png` |
| H6 | Passed | Custodian Four (lab CAR), Account Settings, first name changed, Save: the body had `firstName`, `lastName`, and the picture only (no `labAffiliation`), 200, answer lab `CAR` (the old code answered CITe4D when no lab was sent). Names only by direct call: lab `CAR`. `labAffiliation: "NOLAB"` with another name: 400 "Unknown lab: NOLAB."; `/me` then showed the name unchanged and lab CAR. The name was put back | `h6-custodian-car-save.png` |
| H7 | Passed | A direct sign-up with lab "CITE4D Typo Lab (CITE4DX)" was listed for the CITe4D Lab Head. Approve: 400; dialogs seen: the confirm, then **one** alert "Error approving registration: The lab on this request, CITE4D Typo Lab (CITE4DX), is not a known lab. Decline it and ask the applicant to sign up again." (no "Error connecting to server"); the card stayed; a login with its email: 401. Decline removed it | `h7-refused-card-stays.png` |
| H8 | Passed | A sign-up with lab "Center for ICT for Development (CITE4D)"; the Lab Head approved it: one alert "Account for BatchL Hcheck Eight approved."; the card went. The new account logged in to the Custodian portal; Account Settings shows lab CITe4D | `h8-h10-after-decisions.png`, `h8-new-account-settings.png` |
| H9 | Passed | `POST /api/auth/register` with a full body as the Lab Head: 404; a login with its email: 401 | |
| H10 | Passed | After the decisions, Account Approvals showed "No sign-up requests for CITe4D". Staff and Director Account Settings, Save: 200, the body without `labAffiliation`; the Director's page said "Profile saved." | `h10-staff-account-save.png`, `h10-director-account-save.png` |
| H11 | Passed | With the browser and both servers stopped: typecheck **64**, build passes, `npm test` 16 files, **420** passed | `h11-checks.txt` |

Console errors seen: the expected refusals (404, 401, 409, 400 answers and the Register page's own error line), and an uncaught error from the Lab Head's Approve button after a refusal (Noticed).

### Noticed, not in this branch

- **"DLSU AdRIC" on the sign-up lab list can never be approved:** no research center has that name or code, and no Lab Head's list shows it, so it should be removed from the list or mapped to a lab. Raiki files it. (The same is true of "No affiliation" requests: the Lab Head's list keeps the requests whose lab text contains the Lab Head's lab code, `matchesBranch` in `LabHeadDashboard.tsx`; the local file holds one such request from before the checks.)
- **A refused approval leaves an uncaught error in the console.** `LabHeadDashboard.tsx`'s Approve handler awaits `approveRegistration`, which throws after its alert so the success alert is skipped, and nothing catches it. Harmless on screen; a `try` in the handler would quiet it.
- **The request ID is six random digits** (the `REG-` line in `requestRegistration`, `auth.service.ts`): two requests can draw the same one, and approving or declining one then drops both. Small; H-17 (the table) gives real IDs.
- **Server log lines print emails** (the sign-up, approval, and account update handlers in `auth.controller.ts`). They are console lines on the server, not answers; a separate small cleanup.
- **On CCS Cloud, Director and Staff accounts that saved their name may already be linked to CITe4D** (#73, from the code). A read-only count of their `user_centers` rows would show it; nothing in this batch changes existing links.
- **Approve-registration with no `requestId`** answers 404, not 400. It stays: nothing sends that.
