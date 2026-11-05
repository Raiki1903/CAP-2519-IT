# Batch 5: maintenance, disposal, Missing and Found on the server

**Owner:** Raiki (Claude Code agent). **Branch:** `feat/batch-5-maintenance`, from `main` after PR #145 (`5e01392`).
**Target:** merged **Fri Nov 6, about 5 pm**, deployed before Saturday's UAT (Lab Heads, then Doc Joel at 3 pm as Director).
**Source of truth:** this file. Contract: `docs/contracts/lifecycle.md` sections 3, 4 (Maintenance, Retirement, Missing and Found, Inspection types), 7.4, 7.5, 7.6 and 7.10. Where this brief and the contract differ, this brief wins and the docs commit updates the contract.
**Closes:** nothing by number. Fixes H-05 (a second open ticket; inspections outside the step's transaction), H-06 (two ways to change a ticket), H-07 (maintenance texts, priority, retirement skipping Approved), M-07 (in-memory repeat check), M-13 (pathway packed into text), H-20 (unescaped disposal email).

Read first, fully: `AGENTS.md`, `CLAUDE.md`, `docs/contracts/lifecycle.md`, `docs/guides/CODE-COMMENTS.md`, `tests/README.md`, `docs/tasks/batch-1-foundation.md`, then `docs/tasks/batch-3-loans.md` (the pattern to copy: `withAssetLock`, `writeInspection`, `readInspectionInput`, the `Loan` builder, the Decisions and notes), then this brief.

---

## 1. Why

The frozen manuscript (1.3.4, 1.6.2.2, 1.6.2.4, 1.7 "Flexible Routine Health Inspections") and CAP1DEF comments 5 (warranty goes to the seller) and 6 (predefined issue options with suggested actions) need maintenance with issue types and warranty, a two-step disposal that the requester can't approve, Missing and Found, and routine inspections that skip assets that are out, in repair or retired. Batch 1 already added every column. Batch 5 builds the steps on the server and moves **today's** maintenance, disposal and inspection screens onto them, because Joel has no time for new ones before Saturday.

Core principle: approval permits; TSG confirms the physical step; history is never overwritten.

## 2. Hard rules

Same as Batch 3, section 2, all of them:
1. **No schema change.** If a column is missing, stop and ask.
2. **Every step runs in one transaction that locks the asset row first** (`withAssetLock` style), then re-reads the ticket, retirement, loan and asset inside the lock and checks them.
3. **`assets.status` only through `setAssetStatus`**, in the same transaction.
4. **Asset status checks only through the lifecycle guard.** Add guard actions and update the table test if needed.
5. **The acting person comes from the session.**
6. **Logs:** no emoji, no body, no email, no ID number. Short lines with ids only.
7. **Privacy:** a Researcher never gets another person's name or id.
8. Never read `.env`. Never touch CCS Cloud. No `migrate dev`, `db push`, `db pull`. No new package. No em dashes. Typecheck **25 or lower**.

**Priority, if time runs short** (Saturday's UAT is fixed): P1 is sections 3.1 to 3.4 and their web (4.1, 4.2). P2 is 3.5 and 4.3. P3 is 3.6. Cut from the bottom and say so at the stop.

## 3. Server

### 3.1 The `Maintenance` and `Retirement` shapes

One builder each (in the feature's service), giving the contract's `Maintenance` and `Retirement` (section 7, "Common objects"). Every new endpoint answers with it. `underWarranty` is worked out: the asset's `warranty_expiry` is on or after the day TSG received it (before receipt: on or after today). Labels come from `shared/constants/maintenanceStatuses.ts` and `retirementStatuses.ts`. People are `{ userId, name }`, or `{ hidden: true }` for a Researcher who is not that person.

`GET /api/maintenance` and `GET /api/retirements` move to the new shapes in the web commits, together with the screens that read them. Keep every commit building. If a list must keep its old shape for a while (like `GET /api/loans` in Batch 3), say so at Stop 0.

### 3.2 Maintenance (P1)

| Meaning | Method and path | Who |
|---|---|---|
| Report an issue | `POST /api/assets/:assetTag/maintenance` | the holder, the Head of the asset's home lab, TSG |
| Receive | `PUT /api/maintenance/:maintenanceId/receive` | TSG |
| Start the work | `PUT /api/maintenance/:maintenanceId/start` | TSG |
| Change stage | `PUT /api/maintenance/:maintenanceId/stage` | TSG |
| Complete | `PUT /api/maintenance/:maintenanceId/complete` | TSG |
| Cancel | `PUT /api/maintenance/:maintenanceId/cancel` | the reporter (Pending Receipt only), TSG |

- **Report** `{ issueTypeId, issueDescription }`: issue type must exist (400 "Pick an issue type from the list."), description required (at most 2,000). Holder means `holderOf` in `assetState.ts`; any other Researcher gets 403. Guard: Available or On Loan. **One open ticket per asset** (Pending Receipt, Inspecting, Repairing, External Service), checked inside the lock: 409 "<tag> already has an open maintenance ticket (MNT-<id>)." Type is TSG_MAINTENANCE when TSG files it, else BORROWER_REPORT. Status Pending Receipt. **The asset and its loan don't change.** Remove the in-memory repeat check (TODO M-07).
- **Receive** `{ inspection }`: only from Pending Receipt (409). Writes a **Maintenance** inspection (`writeInspection`), sets `received_by_id`, `received_at`, `trigger_inspection_id`, status Inspecting, asset Maintenance. **If the asset has an open loan (On Loan or Return Requested), it ends in the same step: Ended by Maintenance, `closed_at`.** The asset goes to TSG; it never goes back to the borrower afterwards.
- **Start** `{ stage, provider?, warrantyOverrideReason? }`: only from Inspecting (409). `stage` is REPAIRING or EXTERNAL_SERVICE. **Under warranty and stage Repairing needs `warrantyOverrideReason`** (400 "This asset is under warranty. Send it to the warranty holder, or write why TSG repairs it."). External Service needs `provider` (400). Store the reason and provider.
- **Stage** `{ stage, provider? }`: Repairing to External Service or back (409 otherwise). External Service needs `provider`. Going to Repairing on a warranty asset with no stored override reason: same 400.
- **Complete** `{ outcome, resolutionRemarks, inspection }`: from Inspecting, Repairing or External Service (409). Writes a **Maintenance** inspection as `completion_inspection_id`, sets `completed_by_id`, `completed_at`, remarks (required, 400). RESOLVED: asset Available (back home, worked out). BEYOND_REPAIR: asset stays Maintenance, ticket closed; the next step is a retirement request.
- **Cancel** `{ remarks? }`: Pending Receipt by the reporter or TSG (asset unchanged); Inspecting by TSG only (asset Available). 409 from anything else. Remarks go in `resolution_remarks`.
- Remove `PUT /api/maintenance/:repairId` and `PUT /api/maintenance/:repairId/status` (H-06; they answer 404). Remove the priority (H-07): screens show the issue type.
- `GET /api/maintenance`: TSG, Director, Secretary see all; a Lab Head sees their lab's; a Researcher sees only tickets they reported (contract 7.4). `?status=` and `?type=` optional (400 for unknown values).

### 3.3 Disposal (retirement) (P1)

| Meaning | Method and path | Who |
|---|---|---|
| Request | `POST /api/assets/:assetTag/retirement` | TSG |
| Decide | `PUT /api/retirements/:retirementId/decision` | Director or Secretary, never the requester |
| Complete | `PUT /api/retirements/:retirementId/complete` | TSG |

- **Request** `{ reason, pathway?, assessmentInspection? }`: reason required (at most 2,000). Allowed from Available, Missing, or **Maintenance only when the asset's latest ticket ended Beyond Repair and no ticket is open** (contract section 3, note 3; 409 "Finish the maintenance ticket first. Only an asset found beyond repair can be disposed of from Maintenance."). One open retirement per asset (Pending or Approved, 409). Saves `previous_status`, asset Pending Retirement. With `assessmentInspection`, writes a **Retirement** inspection and links it. `pathway` in its own column (TODO M-13 goes).
- **Decide** `{ decision: "approve" or "deny", decisionRemarks? }`: only from Pending (409). `notSameActor`: the requester gets 403 "You requested this disposal, so someone else must decide it." Approve: Approved, asset stays Pending Retirement (TODO H-07 goes). Deny: remarks required (400), Denied, asset back to `previous_status` through `setAssetStatus`.
- **Complete** `{ pathway, dispositionReference }`: only from Approved (409). Both required (reference at most 255). Completed, asset **Retired**.
- **The disposal email** stays as today (one email to the deciders when a request is made), but every value in its HTML is escaped (TODO H-20 goes). Errors still log only the error name.

### 3.4 Missing and Found (P1)

| Meaning | Method and path | Who |
|---|---|---|
| Mark missing | `PUT /api/assets/:assetTag/missing` | TSG |
| Mark found | `PUT /api/assets/:assetTag/found` | TSG |

- **Missing** `{ reason }`: required, at most 255 (it goes in `activity_log.details`). Guard: Available or On Loan. Asset Missing. **An open loan ends: Ended by Loss, `closed_at`.** A ticket still in Pending Receipt is cancelled with remarks "Asset marked missing." One ASSET_MARKED_MISSING activity row (actor TSG, asset, the reason).
- **Found** `{ inspection, remarks? }`: only from Missing (guard). Writes a **Recovery** inspection. Asset Available (back home). The old loan is not reopened. One ASSET_FOUND row.
- Both answer `{ asset }` in the asset list's shape.

### 3.5 Inspections (P2)

- **Filing** (`POST /api/assets/:assetTag/inspection`, today's route): TSG files a **Routine** inspection (guard ROUTINE_INSPECTION, Available only); the holder files a **Self Report** (asset On Loan or Return Requested, caller is the holder, else 403). Both through `writeInspection` inside the asset lock (TODO H-05 in `inspections.service.ts` goes), with metrics. A Self Report never changes the condition (`conditionsFor` already counts only TSG inspections; confirm at Stop 0).
- **Routine queue** `GET /api/inspections/routine-queue?days=&centerId=` (TSG): Available assets whose newest TSG inspection is older than `days` (default 90; this is the manuscript's "selected inspection periods"), or that have none, grouped by `INSPECTION_LAB_GROUPS` (`shared/constants/inspectionGroups.ts`), oldest first. Answer as contract 7.6. On Loan, Maintenance, Pending Retirement, Retired and Missing assets are never in it.
- **Notifications** (add to `GET /api/notifications/mine`, labels in `shared/constants/notifications.ts`):
  - `STATUS_CHECK_DUE`: the borrower, for each asset they hold (On Loan or Return Requested) whose newest inspection of any type is older than 90 days (one constant, `STATUS_CHECK_DAYS`). Filing a Self Report clears it. **This replaces the contract's "members of a lab when their lab's cycle starts"**: the policy (section 3, "Periodic status update") puts the update on the Responsible Person, and there is no stored cycle. The docs commit updates 7.10.
  - `RECEIPT_WAITING`: TSG, one per ticket in Pending Receipt.
  - `DISPOSAL_DECISION_WAITING`: the Director and the Secretary, one per Pending retirement **they did not request**.
  - `MAINTENANCE_OPEN`: the reporter, one per open ticket they reported, with its status label (the Researcher's repair cards the contract promised for Batch 5).
  - By user id only.

### 3.6 Benchmarks (P3, cut first)

`GET /api/assets/:assetTag/benchmarks` (TSG, Director, the home lab's Head), as contract 7.6, using `METRIC_FLAG_RULES` and the baseline rule already in `shared/constants/metricFlagRules.ts`. No screen in this batch.

### 3.7 Waiting loans (decided; the Batch 3 note)

A loan still in Pending Approval or Pending Release is **left as it is** when its asset goes to Maintenance, Missing or Pending Retirement. The guard already refuses approve and release on those statuses; decline and cancel still work. Same rule as Batch 3 for maintenance. Note it in the task file and the contract.

## 4. Web (today's screens on the new steps)

Like Batch 3 section 4: no redesign, only enough for every role to do its part on screen on Saturday. Use `readResult`, lookups for option lists, and show the server's sentence on a refusal.

### 4.1 Maintenance (P1)

- **`web/api/maintenance.api.ts`:** one function per endpoint in 3.2, typed from `shared/types`.
- **Report an issue (`RepairForm.tsx`, and the "flag for repair" in `ReturnForm.tsx` if it still makes sense; say at Stop 0):** an issue type select from `issueTypes` that shows the chosen type's suggested action under it, and a description. It says "The asset stays with you until TSG receives it." Remove the dead outcome fields (#137) while there.
- **Repairs board (Staff) and `RepairProgressDialog.tsx`:** columns by the new statuses and labels. Buttons follow the allowed moves only: Receive (inspection fields, reused from `IntakeWizard.tsx` or the shared component Joel may have added; check `main`), Start (stage, provider, warranty override reason when under warranty, with the "Under warranty until <date>" line shown), Change stage, Complete (outcome, remarks, inspection), Cancel. Each card shows the issue type, not a priority.
- **`StaffAnalyticsView.tsx` board:** drag and drop that called `updateRepairStatus` is removed; cards open the dialog instead (the server decides the moves).
- **Researcher and Lab Head:** their ticket lists read the new list.

### 4.2 Disposal and Missing (P1)

- **`web/api/retirements.api.ts`:** request, decide, complete.
- **Request (`DisposalFormDialog.tsx`, TSG):** reason, optional pathway (from `retirementStatuses.ts` pathways), and the server's refusal for a Maintenance asset not Beyond Repair.
- **Decide (Director dashboard and the bell):** approve, or deny with required remarks. The requester never sees Approve on their own request (the server refuses anyway). **The Secretary can decide too:** make sure they have a place to do it (the bell's `DISPOSAL_DECISION_WAITING` cards at least; say at Stop 0 what today's Secretary view has).
- **Complete (TSG):** on an Approved disposal, a Complete button with pathway and disposition reference. Then the asset shows Retired.
- **Missing and Found (TSG, Staff asset modal):** "Mark missing" with a required reason; on a Missing asset, "Mark found" with the inspection fields.

### 4.3 Inspections (P2)

- **`InspectionQueue.tsx` (Staff):** reads the routine queue, by group, with a period select (30, 90, 180 days). Filing sends a Routine inspection.
- **Researcher self report (`CustodianPortal.tsx`):** sends a Self Report for an asset they hold.
- **The bell:** shows the four new kinds from 3.5.

## 5. Tests

Update tests that pin old behavior in the same commit. At least:
- **Report:** holder, home Head, TSG get 201; another Researcher 403; unknown issue type 400; a second open ticket 409; **two reports at once (`Promise.all`): one 201, one 409**; the asset and loan unchanged.
- **Receive:** Maintenance inspection written; asset Maintenance; an On Loan asset's loan becomes Ended by Maintenance and closed; 409 not Pending Receipt; **receive and cancel at once: one wins**.
- **Start and stage:** warranty asset to Repairing without a reason 400, with a reason 200 and stored; External Service needs provider; 409 from wrong statuses.
- **Complete:** Resolved makes the asset Available at home; Beyond Repair keeps Maintenance and allows a retirement request; inspection required.
- **Cancel:** reporter from Pending Receipt; reporter from Inspecting 403; TSG from Inspecting makes the asset Available.
- **Retirement:** request from Available, Missing, Maintenance after Beyond Repair; from Maintenance with an open ticket 409; from On Loan 409; a second request 409; the requester can't decide (403); Secretary and Director can; deny needs remarks and restores Maintenance and Missing correctly; complete only from Approved, makes Retired; a Retired asset can't be reported, loaned, or marked missing; **two decisions at once: one wins**.
- **Missing and Found:** On Loan asset's loan becomes Ended by Loss; a Pending Receipt ticket is cancelled; Found needs an inspection and makes Available; the old loan stays closed; one activity row each, no email.
- **Inspections (P2):** Routine only on Available; Self Report only by the holder and doesn't change the condition; the queue holds no On Loan, Maintenance, Pending Retirement, Retired or Missing asset; `days` works.
- **Notifications (P2):** each new kind reaches only its person; the requester of a disposal doesn't get its decision card.
- **Removed routes** answer 404.
- **Waiting loans:** an asset with a Pending Approval loan goes to Maintenance; approve is refused with the guard's sentence; decline still works.

## 6. Commits and stops

**Stop 0 (no commit):** report what maintenance, retirement and inspection code does today; every screen, test and analytics query that reads the old maintenance texts, priorities or disposal fields; the guard actions you will add or rename; the shape question in 3.1; your plan per commit with expected test counts. Questions in the "When unsure" format. Wait for go.

| # | Commit | What |
|---|---|---|
| 1 | `docs(tasks): save the Batch 5 brief` | This file as `docs/tasks/batch-5-maintenance.md`, with a Decisions section |
| 2 | `feat(maintenance): report, receive and cancel with issue types` | 3.1 (Maintenance), 3.2 report, receive, cancel, removed routes, tests |
| 3 | `feat(maintenance): start, stage and complete with the warranty rule (CAP1DEF 5)` | 3.2 rest, tests |
| 4 | `feat(retirements): two-step disposal that the requester can't decide` | 3.1 (Retirement), 3.3, tests |
| 5 | `feat(assets): mark missing and found` | 3.4, tests |
| 6 | `feat(inspections): routine and self-report filing and the routine queue` | 3.5 except notifications (P2) |
| 7 | `feat(notifications): status checks, receipts, disposal decisions and my tickets` | 3.5 notifications (P2) |
| 8 | `feat(assets): benchmark data` | 3.6 (P3) |

Analytics queries that read the old maintenance texts change in the commit that changes the texts.

**Stop 1** after commit 8 (or the last one done): checks after each commit, test counts and why they moved, anything that surprised you.

| # | Commit | What |
|---|---|---|
| 9 | `feat(web): today's maintenance screens use the new steps` | 4.1 |
| 10 | `feat(web): disposal and Missing on today's screens` | 4.2 |
| 11 | `feat(web): routine queue, self reports and the new bell cards` | 4.3 (P2) |
| 12 | `docs: Batch 5 contract, guide and counts` | Contract 7.4, 7.5, 7.6, 7.10 marked live, 3.7 and the STATUS_CHECK_DUE change, AGENTS.md counts, the guide, `tests/README.md`, results and notes in the task file |

**Stop 2** after commit 12: checks, then hand checks (section 8), then the report.

Report typecheck, build and tests after every code commit.

## 7. Not in Batch 5

- New maintenance or disposal screens (after Nov 9; today's screens move instead).
- Evidence files, external service dates, a missing-case table, audit (P3, likely no-go).
- Removing the old `GET /api/loans` shape (after Joel's loan screens).
- The demo seed (Raiki, next).

## 8. Hand checks (for Raiki, `adric_uat_check` only)

Under the heading **"Batch 5 hand checks"**, numbered **5-H1** onward, in run order, each with role, screen, clicks, expected result and database. **Only setup goes before the checks** (ports, start script, accounts). Each value to write down (a tag, a ticket id) is noted inside the check where it first appears, and a later check names where it came from. Any database write is one line, on `adric_uat_check` only, and respects the table's check constraints. At least:
- A Researcher reports an issue on an asset they hold: the issue type shows its suggested action; the asset stays On Loan and with them; a second report is refused with the server's sentence.
- TSG receives it: the loan ends (Ended by Maintenance), the asset is Maintenance at TSG.
- A warranty asset: Start as Repairing without a reason is refused with the warranty sentence; External Service with a provider works.
- Complete Resolved: Available, back home. Another ticket completed Beyond Repair, then a disposal request on it.
- Disposal: TSG requests; TSG's own account can't approve; the Secretary denies one (asset back to its previous status) and the Director approves another; TSG completes it with pathway and reference: Retired, and nothing else can be done to it.
- Missing on an On Loan asset: the loan ends (Ended by Loss); Found with a Recovery inspection: Available.
- P2: the routine queue skips assets that are out or in repair; a Self Report doesn't change the condition; each bell card reaches only its person.
- Old routes answer 404; the server terminal shows only plain lines with ids.
- Nearby: loans (request to receive) still work; Staff Inventory, the Director dashboard and Analytics load.

## Decisions

Made by Raiki at Stop 0 (2026-11-05). Where they differ from the sections above, these win.

**Stop 0 answers:**

- **Q1: A.** `POST /api/assets/:assetTag/inspection` takes both the contract's `InspectionInput` and today's body (`reportCondition`, `reportRemarks`, `reportImg`), and answers both `inspection` and `report`. Commit 11 moves the Staff Inspections page and the Researcher's "Send Inspection Report" to the new body, and the old names go with it. The screens keep working if commit 11 is cut. **Final (after commit 11):** the old body is removed in its own commit after commit 11, not in commit 12 (`d1cf1efd`). See "Accepted after commit 11".
- **Q2: A.** Commits 2 and 4 send the old keys and rows (`repairs`, `disposals`) next to the new ones (`tickets`, `retirements`). The old rows are built from the new statuses, so the Staff board and analytics show sensible texts until commits 9 and 10, which switch the screens and drop the old keys. Analytics changes in the same commit as the texts.
- **Q3: A.** The disposal request email goes to the Director and the Secretary. The decision email to the requester stays, reworded for two steps (approved: TSG completes it; denied: with the remarks). Every value in both is escaped.
- **Q4: A.** The TSG "flag for maintenance" button in the asset modal and the Researcher's immediate-inspection toggle (including its automatic ticket on a critical fault) send issue type OTHER, found by its key in the lookups, with their text as the description, and stop sending a priority. `RepairForm.tsx` gets the real issue type select with the suggested action (CAP1DEF 6).

**Accepted with the plan:**

- **Guard actions:** `WORK_ON_MAINTENANCE` (Maintenance only) for start, stage, complete, and cancelling an Inspecting ticket; `SELF_REPORT_INSPECTION` (On Loan only). A waiting loan no longer blocks `REQUEST_RETIREMENT` (section 3.7); it still blocks `REQUEST_LOAN`. Report keeps `START_MAINTENANCE`, receive keeps `RECEIVE_FOR_MAINTENANCE`. "Maintenance only after Beyond Repair" is a rule in the retirement service.
- **Cancel** also sets `completed_by_id` and `completed_at`, because no other column holds who cancelled and when. The asset history labels a cancelled ticket "Cancelled by", not "Completed by" (with a test).
- **Lab Head scoping:** `GET /api/retirements` shows a Lab Head only their lab's disposals, like `GET /api/maintenance`.
- **IT Admin:** `GET /api/maintenance` answers 403 (contract 7.4 lists the roles).
- **Last custodian:** a disposal can no longer be requested from On Loan, so a retired asset's `disposalDetails.lastCustodian` is "No Custodian" for new rows.
- **Lab Head report:** a Lab Head reporting on another lab's asset gets its own 403 sentence.
- **Routine inspections** are Available only; TSG inspecting an asset in repair (issue #88) now happens through the maintenance steps (Receive and Complete).
- **ReturnForm "flag for repair"** stays, with the issue type select.
- **The Secretary** is on the Staff view, which has no disposal page; the bell shows disposal cards to the Director only. In commit 10 the Secretary's (and the Director's) Approve and Deny bell cards come from `GET /api/retirements` (Pending, not requested by them), not from the P2 notification kind, so P1 works even if P2 is cut. Deny asks for remarks.
- **Loan receive answer** (commit 2): the key stays `maintenance` (contract 7.3), now in the `Maintenance` shape.

**Waiting loans on an asset that ends Retired** (section 3.7): left as they are. The Lab Head can decline them and the borrower can cancel them. No code.

**Accepted at Stop 1 (the extras beyond the brief, after commit 10):**

- **Stage change takes `warrantyOverrideReason`.** Without it, a warranty asset sent to External Service first could never come back to Repairing.
- **Extra answer fields:** `Maintenance.asset.warrantyExpiry` (for the "Under warranty until" line), `issueType.suggestedAction`, and `Retirement.previousStatusLabel`. Recorded in the contract (common objects).
- **Emails carry ids only in their subjects**, for example `New disposal request DISP-12 (TEST-0001)`, because the mailer logs the subject. The decision email does not name who decided. Every value in a body is escaped (`server/shared/utils/html.ts`).
- **History labels:** "Maintenance cancelled by" (kind `MAINTENANCE_CANCELLED`) and "Maintenance completed (<outcome>) by". A cancelled ticket keeps who cancelled it in `completed_by_id` and `completed_at`.
- **Report checks who first, then the asset's status:** a Researcher who does not hold a Retired asset gets 403; TSG on the same asset gets 409.
- **Test seed:** the seeded disposal now has a plain reason, pathway Recycle, a disposition reference, and TSG as the one who completed it. Tests that read the packed reason, the waiting-loan block or the word "reject" were updated.
- **Shared `InspectionFields`** (condition and remarks) in `web/features/inspections/`, used by receive, complete, Found and the routine queue. `main` has no shared component from Joel.

**Accepted after commits 6 and 7:**

1. **Never inspected counts as due** for `STATUS_CHECK_DUE`, the same as the queue. The card's `date` is the newest inspection's day, and it is left out when there is none.
2. **The routine queue always sends all five groups,** even empty ones. Each group has `group` (the id) and a `name`. Other's `labs` are the codes of the labs its assets belong to.
3. **A Self Report checks who first, then the status.** Someone who does not hold the asset gets 403 before the guard runs, the same order as Report.
4. **Q5: B.** TSG gets no `MAINTENANCE_OPEN` card for a ticket it filed itself. It already sees the ticket as `RECEIPT_WAITING` and on the Repairs page. Its own small commit (`933f3198`), with a test.

**Accepted after commit 11:**

1. **The bell's action badges need the lists and the notifications to load together.** The ticket and disposal cards come from the lists; `RECEIPT_WAITING` and `DISPOSAL_DECISION_WAITING` decide which of them need the person's action. If the notifications call fails, the cards stay but lose their "action required" badge.
2. **The Other tab is hidden when it has no assets,** as before, although the server always sends all five groups.
3. **The Researcher's Self Report is offered only for assets they hold that are On Loan.** The `|| a.isOverdue` test was dropped: an overdue asset is always On Loan.
4. **Q1: yes, the old inspection body goes, in its own commit after commit 11** (not in commit 12): `chore(inspections): drop the old inspection body (Q1)`, `d1cf1efd`. The old-body reader, the `InspectionReportInput` type and the `report` key in the filing answer are removed. `GET /api/inspections` and `/log` keep their old field names (L-07).
5. **Inspection remarks over 255 characters answer 400** ("remarks can be at most 255 characters."), where the old body cut them silently. Both screens already limit the length. A browser tab left open from before the deploy would break on its next inspection.

**Accepted after commit 8:**

1. **Self Reports are left out of the benchmark data,** as they are left out of the asset's condition. Only TSG's inspections count.
2. **A metric recorded before the asset's category changed is still listed,** so no recorded value disappears.
3. **A category with metrics never flags a health score** (only a category with no metrics flags a score below `HEALTH_SCORE_FLAG_BELOW`).

**Run order:** commits 1 to 5, then Stop 1. After Raiki's go: 9 and 10 (P1 web), then 6, 7 and 11 (P2), then 8 (P3), then 12 (docs), then Stop 2. If time runs short, cut from the bottom (8, then 11, 7, 6) and say so.

**Issues:** the pull request also closes #65 (the 8-second repair guard) and #66 (the board statuses). The results in this file name both.

## Results (after commit 12)

Branch `feat/batch-5-maintenance`, from `main` at `6a2376b3`. Nothing pushed (Raiki pulls `main` into the branch, pushes and opens the pull request). No schema change, no new package, nothing run against CCS Cloud. The pull request closes #65 (the 8-second repair guard) and #66 (the board statuses). Hand checks 5-H1 onward come at Stop 2 and have not been run.

| # | Commit | Hash | Typecheck | Tests | One line |
|---|---|---|---|---|---|
| 1 | `docs(tasks): save the Batch 5 brief` | `20b37520` | 25 | 631 | This file, with the Decisions section |
| 2a | `refactor(inspections): move the Inspection shape builder to server/shared/services` | `37a34efb` | 25 | 631 | Move only: `inspectionShape.ts`, so maintenance can answer with the Inspection shape |
| 2 | `feat(maintenance): report, receive and cancel with issue types` | `e9eff530` | 25 | 625 | Report, receive, cancel, the Maintenance shape, scoped list, old update routes removed, `WORK_ON_MAINTENANCE` |
| 3 | `feat(maintenance): start, stage and complete with the warranty rule (CAP1DEF 5)` | `636b7ceb` | 25 | 642 | Start, stage and complete with the warranty and provider rules |
| 4 | `feat(retirements): two-step disposal that the requester can't decide` | `c23e7be2` | 25 | 643 | Request, decide, complete; escaped emails; pathway in its own column |
| 5 | `feat(assets): mark missing and found` | `829fbd1e` | 25 | 659 | Missing ends a held loan by loss; Found files a Recovery inspection |
| 9 | `feat(web): today's maintenance screens use the new steps` | `f249f565` | 25 | 659 | Report form with issue types, Repairs page and dialog by status, board with every status, `repairs` key dropped |
| 10 | `feat(web): disposal and Missing on today's screens` | `45dd81b9` | 25 | 659 | Request, decide (Director and Secretary), complete, Mark Missing and Found, `disposals` key dropped |
| 6 | `feat(inspections): routine and self-report filing and the routine queue` | `8d7658db` | 25 | 679 | Filing inside the asset lock for TSG (Routine) and the holder (Self Report); the routine queue |
| 7 | `feat(notifications): status checks, receipts, disposal decisions and my tickets` | `1ba1d8ba` | 25 | 682 | Four new notification kinds, by user id |
| Q5 | `fix(notifications): TSG gets no ticket card for a ticket it filed itself` | `933f3198` | 25 | 683 | TSG is left out of `MAINTENANCE_OPEN` |
| 11 | `feat(web): routine queue, self reports and the new bell cards` | `2e288fcb` | 25 | 683 | Routine queue page, Self Report body, the four bell kinds |
| 8 | `feat(assets): benchmark data` | `dc091cc3` | 25 | 692 | `GET /api/assets/:assetTag/benchmarks`, no screen |
| Q1 | `chore(inspections): drop the old inspection body (Q1)` | `d1cf1efd` | 25 | 690 | The filing takes only `InspectionInput`; answers `{ inspection }` |
| 12 | `docs: Batch 5 contract, guide and counts` | this commit | 25 | 690 | Contract 7.4 to 7.6 and 7.10 live, 3.7, counts, this section |

Build passes after every code commit. Test moves from 631 to 690 (+59): commit 2 -6 (old update-route and repeat-check tests replaced), 3 +17, 4 +1, 5 +16, 9 and 10 unchanged, 6 +20, 7 +3, Q5 +1, 11 unchanged (no web tests), 8 +9 (benchmarks.test.ts 8, session row 64), Q1 -2, 12 unchanged. The Q1 commit deleted three tests that pinned only the old body (the `assetCondition` alias, the default remarks sentence, the silent cut to 255) and added one (400 for remarks over 255); the no-condition row of the 400 table stays, now expecting "Pick the condition of the inspection from the list." instead of "Missing required field: reportCondition.". `inspections.test.ts` went 50 to 48.

**Left as it was (not moved on today's screens):**

1. No hand checks have been run; they come at Stop 2.
2. The Staff analytics board still reads `data.repairs` from `GET /api/analytics/tsg`; its `progressStatus` is now the status label, and a card opens the dialog from the shared ticket list. The analytics endpoint itself is unchanged.
3. The Secretary can open the Repairs page and read, but the step buttons are TSG only (the server refuses her anyway).
4. In the asset modal, the older branch for Missing and Pending Retirement assets may still show TSG a "Flag for Maintenance" button; the server refuses it with its sentence, shown under the button. That branch was not restructured.
5. Old disposal rows on `adric_uat_check` hold the packed text and show it whole as the reason, with pathway "Not recorded". The Nov 8 database is fresh.
6. `GET /api/inspections` and `GET /api/inspections/log` keep today's field names (L-07).
7. The benchmark data has no screen yet.
8. No web tests exist; the web changes are checked by typecheck, build and the hand checks.

**Also open:** `withAssetLock` now exists in four repositories (loans, maintenance, retirements, assets). A later refactor could move it to shared.
