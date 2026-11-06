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

**Accepted after Stop 2 (the merge of `main` with Joel's loan screens):**

1. **Q1: A.** The Researcher's My Loans screen gets a "Report an issue" button on each On Loan and Return Requested row. It opens the existing asset detail, whose Request Repair button opens the same report form the old My Assets cards opened. No new form, no new types. Commit `6268233e`, in Joel's `web/features/loans/ResearcherMyLoans.tsx` (approved by Raiki).
2. **Q2: A.** My Loans History also lists loans Ended by Maintenance and Ended by Loss, with the status label the server sends. Commit `ad051ef5`, same file.
3. **Q3: left for after Nov 9.** The asset detail offers the report form only to Staff and Researcher views, so a Lab Head cannot report an issue from the screen, although the server allows it (the Head of the asset's home lab). It was like this before the merge. 5-H17 checks the Lab Head's report by console only.

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

## Batch 5 hand checks

Written for Raiki, to run by hand. The agent did not run them. Every check uses **`adric_uat_check` only** (the local copy), started through `C:\dev\uat-data\start-local-uat.ps1` on branch `feat/batch-5-maintenance`, after `main` was pulled in (Joel's #147 and #148 are in). Nothing here touches CCS Cloud. Find this section by searching the exact heading text `Batch 5 hand checks` in `docs/tasks/batch-5-maintenance.md`; each check below names its number (5-H1 to 5-H20).

**Order.** TSG first (5-H1 to 5-H10), then the Secretary and the Director (5-H11, 5-H12), then TSG once more (5-H13), then the Researcher and the Lab Heads (5-H14 to 5-H17), then three general checks (5-H18 to 5-H20). Two steps leave the by-role order because they need an earlier step by someone else: Complete Disposal (5-H13) needs the Director's approval from 5-H12, and the loan ending on receipt (5-H15) needs the Researcher's report, so TSG receives inside 5-H15.

**Before the checks**

1. Ports 4000 and 5173 must be free (no leftover `npm run dev:all`, which talks to CCS Cloud). Batch 5 has no migration, so `adric_uat_check` needs nothing beyond the migrations and hashed passwords of the earlier batches.
2. Start the app with `C:\dev\uat-data\start-local-uat.ps1`. Accounts and passwords are in `C:\dev\uat-data\uat-passwords.txt` (do not copy them anywhere). Use one private window per account, because the login lives in the browser's cookies. The accounts: TSG "UAT Staff One"; the Secretary "UAT Custodian Three"; the Director "UAT Director One"; the Head of CITe4D "UAT LabHead CITe4D One"; the Head of CAR "UAT LabHead CAR"; the borrower "UAT Custodian One"; a second Researcher "UAT LabHead CITe4D Two".
3. In UAT Staff One's Asset Inventory, pick and write down these assets. None may have an open loan, ticket or disposal. The asset detail shows "Warranty Exp.".
   - **A1**, **M1** and **A2**: three Available assets of CITe4D.
   - **W1**: an Available asset of CITe4D whose warranty date is **after** today (Nov 5, 2026). In the seed data `CITe4D-0002` qualifies.
   - **N1**, **N2** and **N3**: three Available assets, any lab, whose warranty date is **before** today. In the seed data `CITe4D-0003`, `CeHCI-0002`, `GAME-0004`, `GAME-0005`, `Bio-0004` and `Bio-0009` qualify. Check the date, the copy may differ.
4. **Two loans (setup, writes two loans).** As UAT Custodian One: Available Equipment, open A1, Request Loan, any destination lab, Return By 14 days from today (a past date is refused, and the database refuses a return-by before the request date), purpose `Batch 5 setup`, Submit Request. Write the number in `LOAN-<number>` as **L1**. Do the same for M1 and write **L2**. As UAT LabHead CITe4D One: the Requests tab, Approve both. Both now show "Pending release".
5. **A picture of A1's QR tag (optional, only for the extra step in 5-H15).** As UAT Staff One: QR Tags, tick A1, and save a screenshot of the QR preview as an image file.
6. **Console commands.** Open DevTools (F12), Console, on a page of `http://localhost:5173` while logged in as the account the check names. The first time the browser may ask you to type `allow pasting`. Replace `<T1>`, `<N1>` and so on before sending. Each command prints the server's answer. The commands that report an issue use `issueTypeId:1`. If one answers "Pick an issue type from the list.", open `http://localhost:4000/api/lookups` and use an `issueTypeId` from `issueTypes`.
7. **To read the database**, SELECT only, never a `password` column. PowerShell, it asks for the root password: `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "<SELECT>"`. One check (5-H14) runs a single UPDATE on `adric_uat_check`, and says so. `condition` is a reserved word, so the SELECTs in 5-H8 and 5-H14 write it with backticks. PowerShell drops a single backtick inside double quotes, so in the command type each one twice (``` ``condition`` ```).
8. These checks leave loans, tickets, disposals, inspections and activity rows in `adric_uat_check`. The next UAT reset removes them.

**5-H1. TSG releases a loan on Joel's Releases tab; the merge left his screen working.** Role: UAT Staff One. Screen: "Asset Loans", Releases tab. Database: `adric_uat_check` (writes two releases, two Loan Release inspections).
- The sidebar has one "Asset Loans" item and no "Pending Returns" item. The Releases tab lists L1 (A1) and L2 (M1).
- On A1's row click Release. In the dialog type a wrong tag: "Confirm & Release Asset" stays disabled. Type A1's tag: it turns on. Leave the condition Operational, click it.
- Expect: the green line "Loan #<L1> released successfully. Opening Accountability Form...", and a new browser tab with the Accountability Form for A1 (allow pop-ups for `localhost:5173` if the browser blocks it), borrower UAT Custodian One. The row leaves the Releases tab. Close the form tab. Release M1 (L2) the same way.
- Asset Inventory: A1 and M1 show On Loan, held by UAT Custodian One.
- Database: `SELECT loan_id, status FROM asset_loans WHERE loan_id IN (<L1>,<L2>)` shows ON_LOAN twice.

**5-H2. TSG flags a warranty asset and receives it.** Role: UAT Staff One. Screen: Asset Inventory, then Repairs. Database: `adric_uat_check` (writes ticket **T1**, one Maintenance inspection).
- Asset Inventory, open W1 (Available), click "Flag for Maintenance". The dialog closes.
- Repairs, "Open Repair Tickets": a new ticket `MNT-<number>` for W1, status Pending Receipt, issue type Other. Write the number as **T1**. The sidebar Repairs item shows a red count. The bell (Requests tab) has "Repair Ticket: <W1 name>" with "Waiting for Receipt". It has no card titled "Your maintenance ticket" for T1 (TSG filed it, so it gets only the first).
- On T1's row click Receive. Heading "Condition on arrival": pick Minor Drift, type a remark, click "Receive the asset".
- Expect: T1 reads Inspecting. Open W1 in Asset Inventory: Maintenance, current location the TSG Office.
- Database: `SELECT m.status, a.status FROM asset_maintenance m JOIN assets a ON a.asset_id=m.asset_id WHERE m.maintenance_id=<T1>` shows INSPECTING and MAINTENANCE.

**5-H3. The warranty rule: Repairing needs a reason, External Service needs a provider.** Role: UAT Staff One. Screen: Repairs. Database: `adric_uat_check` (writes T1's stage twice).
- T1, Manage, "Start the work". Expect a blue line "Under warranty until <W1's warranty date>. Send it to the warranty holder, or write why TSG repairs it." With Stage "Repairing (TSG repairs it)", the box "Why TSG repairs it under warranty" shows and "Start the work" stays disabled while it is empty.
- Console, the same call without a reason (the old bug: an 8-second guard and no warranty rule):
```js
fetch("http://localhost:4000/api/maintenance/<T1>/start",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({stage:"REPAIRING"})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "This asset is under warranty. Send it to the warranty holder, or write why TSG repairs it."}`, and T1 still reads Inspecting.
- Back in the dialog pick Stage "External Service (the warranty holder or a repair shop)". The box "Provider" shows and the button stays disabled while it is empty. Type `Batch 5 Service Center`, click "Start the work". Expect T1 reads External Service, "With Batch 5 Service Center".
- T1, Manage, "Back to Repairing": it says "Move this ticket to Repairing" and asks for the reason. Type `Warranty claim refused`, click "Change the stage". Expect T1 reads Repairing.
- Database: `SELECT status, warranty_override_reason FROM asset_maintenance WHERE maintenance_id=<T1>` shows REPAIRING and `Warranty claim refused`.

**5-H4. Complete Resolved: the asset is Available and back home.** Role: UAT Staff One. Screen: Repairs. Database: `adric_uat_check` (writes T1's completion and one Maintenance inspection).
- T1, Manage, "Complete". Outcome "Resolved (the asset is Available again, back home)". "What was done": `Replaced the part`. "Condition after the work": Operational. Click "Complete the work".
- Expect: T1 moves to "Closed Tickets" as Resolved. Asset Inventory: W1 is Available, current location its home lab (not the TSG Office), condition Operational. W1's Asset History has "Maintenance completed (Resolved) by UAT Staff One".
- Database: `SELECT m.status, a.status FROM asset_maintenance m JOIN assets a ON a.asset_id=m.asset_id WHERE m.maintenance_id=<T1>` shows RESOLVED and AVAILABLE.

**5-H5. No warranty: Start works at once; Complete Beyond Repair keeps the asset in Maintenance.** Role: UAT Staff One. Screen: Asset Inventory, then Repairs. Database: `adric_uat_check` (writes ticket **T2**).
- Open N1, "Flag for Maintenance". Repairs: the new ticket `MNT-<number>` for N1 is **T2**. Receive it (condition Degraded). Manage, "Start the work": **no** blue warranty line and **no** reason box. Stage "Repairing (TSG repairs it)", click "Start the work". Expect T2 reads Repairing.
- Manage, "Complete": Outcome "Beyond Repair (the asset stays in Maintenance until a disposal is requested)", "What was done": `Cannot be repaired`, condition Critical Defect, "Complete the work".
- Expect: T2 is in "Closed Tickets" as Beyond Repair. N1 still reads Maintenance, at the TSG Office. Open N1 in Asset Inventory: no "Flag for Maintenance" button.
- Database: `SELECT m.status, a.status FROM asset_maintenance m JOIN assets a ON a.asset_id=m.asset_id WHERE m.maintenance_id=<T2>` shows BEYOND_REPAIR and MAINTENANCE.

**5-H6. TSG requests two disposals on Beyond Repair assets.** Role: UAT Staff One. Screen: Asset Inventory. Database: `adric_uat_check` (writes ticket **T3**, disposals **D1** and **D2**).
- Asset Inventory, In Service tab: on N1's card click the "Decommission Asset" icon. Type the reason `Beyond repair`, pathway Recycle (or leave it), click "Submit for Approval". Expect "Disposal Request Submitted" with "Disposal ID: DISP-<number>". Write it as **D1**. N1 now reads Pending Retirement.
- Do the same on N3 for a second asset: Flag for Maintenance, Receive, Start the work, Complete as Beyond Repair (this ticket is **T3**), then "Decommission Asset" and "Submit for Approval". Write its `DISP-<number>` as **D2**. Note N3's tag.
- Database: `SELECT retirement_id, status, previous_status FROM asset_retirements WHERE retirement_id IN (<D1>,<D2>)` shows PENDING twice, with previous status MAINTENANCE. The reason is plain text, with no packed lines.

**5-H7. Cancel a ticket after receipt.** Role: UAT Staff One. Screen: Asset Inventory, then Repairs. Database: `adric_uat_check` (writes ticket **T4**).
- Open N2, "Flag for Maintenance". The new ticket in Repairs is **T4**. Receive it. Manage, "Cancel ticket", remark `Batch 5 cancel`, click "Cancel this ticket".
- Expect: T4 is in "Closed Tickets" as Cancelled. N2 is Available again at its home lab. N2's Asset History has "Maintenance cancelled by UAT Staff One". It does not say Resolved.
- Database: `SELECT m.status, a.status FROM asset_maintenance m JOIN assets a ON a.asset_id=m.asset_id WHERE m.maintenance_id=<T4>` shows CANCELLED and AVAILABLE.

**5-H8. The routine inspection queue skips assets that are out or in repair, and the filing refuses long remarks.** Role: UAT Staff One. Screen: Inspections. Database: `adric_uat_check` (writes one Routine inspection).
- Inspections page. The line under "Not inspected in the last" says only Available assets are listed. Walk the group tabs (the five groups, each with a name and the labs it holds). A1 and M1 (On Loan), N1 and N3 (Pending Retirement) are in **no** group. N2 (Available again) may be.
- Pick an Available asset from any group and write its tag as **R1**. Click "Inspect / Log Report". Condition Minor Drift, remark `Batch 5 routine`, click "Submit & Finalize Inspection". Expect the message "Inspection saved for <name>." R1 leaves the queue. Asset Inventory shows R1 with condition Minor Drift.
- Console, remarks over 255 characters (the old body cut them silently):
```js
fetch("http://localhost:4000/api/assets/<R1>/inspection",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({condition:"OPERATIONAL",remarks:"x".repeat(300)})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "remarks can be at most 255 characters."}` and no new inspection.
- Console, the old body, which was removed:
```js
fetch("http://localhost:4000/api/assets/<R1>/inspection",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportCondition:"PERFECT"})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "Pick the condition of the inspection from the list."}`.
- Database: ``SELECT i.type, i.`condition` FROM asset_inspections i JOIN assets a ON a.asset_id=i.asset_id WHERE a.asset_tag='<R1>' ORDER BY i.inspection_id DESC LIMIT 1`` shows ROUTINE and MINOR DRIFT (stored with a space).

**5-H9. Mark Missing on an On Loan asset ends the loan; Mark Found files a Recovery inspection.** Role: UAT Staff One. Screen: Asset Inventory. Database: `adric_uat_check` (writes L2's end, one Recovery inspection).
- Open M1 (On Loan). Click "Mark Missing". Type `Not returned after the event`, click "Mark Missing". Expect M1 reads Missing, and its detail says "This asset is Missing."
- Database: `SELECT status FROM asset_loans WHERE loan_id=<L2>` shows ENDED_BY_LOSS. `SELECT status FROM assets WHERE asset_tag='<M1>'` shows MISSING.
- M1's Asset History has "Marked missing".
- Click "Mark Found". "Condition when found": Operational. "Where it was found (optional)": `Stock room`. Click "Mark Found". Expect M1 is Available, at its home lab, with no holder. The history has "Found".
- Database: `SELECT i.type FROM asset_inspections i JOIN assets a ON a.asset_id=i.asset_id WHERE a.asset_tag='<M1>' ORDER BY i.inspection_id DESC LIMIT 1` shows RECOVERY. The loan stays ENDED_BY_LOSS.
- As UAT Custodian One: My Loans, History tab. LOAN-<L2> is listed with the badge "Ended by Loss" (before the fix it was on no tab).

**5-H10. TSG's own account cannot decide the disposal it asked for.** Role: UAT Staff One. Screen: the bell. Database: `adric_uat_check` (writes nothing).
- Bell, Requests tab: "Disposal Request: <N1 name>" (D1) with the badge "Pending Approval". TSG asked for it, so the card has no Deny button and no "Approve Disposal" button.
- Console:
```js
fetch("http://localhost:4000/api/retirements/<D1>/decision",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:"approve"})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "Your role is not allowed to do this."}`. D1 stays Pending.
- Database: `SELECT status FROM asset_retirements WHERE retirement_id=<D1>` shows PENDING.

**5-H11. The Secretary denies one disposal: the asset goes back to its previous status.** Role: UAT Custodian Three (the Secretary). Screen: the bell. Database: `adric_uat_check` (writes D2's denial).
- Bell, Requests tab: "Disposal Request: <N3 name>" (D2) and the one for N1 (D1), each with Deny and "Approve Disposal". She did not request them, so she may decide.
- On D2 click Deny, type `Batch 5 denial` in "Reason for denying", click "Send denial". Expect D2's card goes away.
- Staff view, Asset Inventory: N3 is Maintenance again (its status before the request), not Pending Retirement. Do not touch D1.
- Database: `SELECT r.status, a.status FROM asset_retirements r JOIN assets a ON a.asset_id=r.asset_id WHERE r.retirement_id=<D2>` shows DENIED and MAINTENANCE.

**5-H12. The Director approves the other disposal.** Role: UAT Director One. Screen: "Disposal Approvals" (`/adric-director/clearance-disposal`). Database: `adric_uat_check` (writes D1's approval).
- The "Disposal Requests" card lists N1 (D1) with its reason, "Requested by: UAT Staff One" and the badge Pending. D2 is not listed (it was decided). Click "Approve Disposal".
- Expect: D1 leaves the list. N1 still reads Pending Retirement.
- Database: `SELECT status, decided_by_id FROM asset_retirements WHERE retirement_id=<D1>` shows APPROVED and the Director's user id (not TSG's).

**5-H13. TSG completes the disposal: the asset is Retired and nothing else can be done to it.** Role: UAT Staff One. Screen: Asset Inventory. Database: `adric_uat_check` (writes D1's completion).
- Open N1. The detail says "DISP-<D1> was approved. Complete it once the asset has left." with a "Complete Disposal" button. Click it. Pathway Recycle, "Disposition reference" `Batch 5 DOD-1`, click "Complete disposal".
- Expect: N1 reads Retired. In Asset Inventory it is under the Disposed tab, not In Service. Its detail has no action buttons.
- Console, two refusals:
```js
fetch("http://localhost:4000/api/assets/<N1>/missing",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"test"})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "<N1> is Retired and cannot be marked missing."}`.
```js
fetch("http://localhost:4000/api/assets/<N1>/maintenance",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({issueTypeId:1,issueDescription:"test"})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "<N1> is Retired and cannot take a maintenance ticket."}`.
- Database: `SELECT status, pathway, disposition_reference, completed_by_id FROM asset_retirements WHERE retirement_id=<D1>` shows COMPLETED, RECYCLE, `Batch 5 DOD-1` and TSG's user id. `SELECT status FROM assets WHERE asset_tag='<N1>'` shows RETIRED.

**5-H14. A Self Report files a Self Report inspection, clears the status check, and does not change the asset's condition.** Role: UAT Custodian One. Screen: the bell, then "Send Inspection Report". Database: `adric_uat_check` (**one UPDATE**, then one Self Report inspection).
- First back-date A1's inspections so a status check is due (it is due when the newest inspection is older than 90 days). In PowerShell, one statement, `adric_uat_check` only. It changes no column with a CHECK (those are `health_score`, loan `return_by`, maintenance `completed_at`, retirement `decided_by_id` and `completed_at`): `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "UPDATE asset_inspections SET inspected_at = DATE_SUB(NOW(), INTERVAL 100 DAY) WHERE asset_id = (SELECT asset_id FROM assets WHERE asset_tag='<A1>')"`
- Reload the page. Bell, Reminders tab: "Status check due: <A1 name>", text "Its last inspection was on <a date about 100 days ago>. Send a status report on the Report tab."
- Before filing, note A1's condition: as UAT Staff One, Asset Inventory, open A1 (it should read Operational, from the release).
- Report tab ("Send Inspection Report"): pick A1, status Minor Drift, a short description, click "Send Inspection Report". Expect "Report Sent" and "Your report is saved." Only A1 (On Loan, held by this person) is on the list.
- Reload. The "Status check due" card for A1 is gone.
- As UAT Staff One, Asset Inventory, open A1: the condition is **still** Operational (a Self Report never changes it).
- Database: ``SELECT i.type, i.`condition` FROM asset_inspections i JOIN assets a ON a.asset_id=i.asset_id WHERE a.asset_tag='<A1>' ORDER BY i.inspection_id DESC LIMIT 1`` shows SELF_REPORT and MINOR DRIFT (stored with a space).

**5-H15. The holder reports an issue on A1; a second report is refused; TSG receives it and the loan ends.** Roles: UAT Custodian One, then UAT Staff One. Screen: My Loans, then Repairs. Database: `adric_uat_check` (writes ticket **T5**, ends L1).
- As UAT Custodian One: My Loans, Out tab. On L1's row (A1) click "Report an issue". Expect A1's detail to open. Click "Request Repair".
- "Report an Issue" says "The asset stays with you until TSG receives it." Pick the issue type "Display" (or any): a green "Suggested first step:" line shows that type's suggested action. Type a description, click "Report Issue". Expect a ticket reference `MNT-<number>`. Write it as **T5**.
- A1 still reads On Loan and still shows UAT Custodian One as the holder (open its detail again from "Report an issue"). My Loans still lists L1 on the Out tab.
- Bell: "Your maintenance ticket: <A1 name>" with "MNT-<T5> is Pending Receipt." It has no action badge.
- Report again: L1's "Report an issue", "Request Repair", any type, any description, click "Report Issue". Expect the red line `<A1> already has an open maintenance ticket (MNT-<T5>).` and no second ticket.
- As UAT Staff One (another window): Repairs lists T5 with "Reported by UAT Custodian One", status Pending Receipt. The bell has the card "Repair Ticket: <A1 name>" with "Waiting for Receipt". Click Receive, pick a condition, click "Receive the asset".
- Expect: T5 reads Inspecting. Asset Inventory: A1 is Maintenance, at the TSG Office, and no longer held by UAT Custodian One.
- Database: `SELECT status FROM asset_loans WHERE loan_id=<L1>` shows ENDED_BY_MAINTENANCE. `SELECT status FROM assets WHERE asset_tag='<A1>'` shows MAINTENANCE.
- As UAT Custodian One, My Loans: L1 has left the Out tab and is in the History tab with the badge "Ended by Maintenance" (before the fix it was on no tab).
- Extra, optional: the same form is reachable from the QR Scan tab. Upload the picture of A1's tag from setup step 5, expect "Asset Found" and A1's detail, which has the same "Request Repair" button.

**5-H16. Each bell card reaches only its person.** Roles: UAT Custodian One, UAT Staff One, UAT LabHead CITe4D Two, UAT LabHead CITe4D One, UAT Director One, UAT Custodian Three. Screen: the bell, both tabs. Database: `adric_uat_check` (writes nothing). Run it right after 5-H15, while T5 is open.
- UAT Custodian One (the reporter and holder of A1 until 5-H15): "Your maintenance ticket: <A1 name>" for T5, no action badge. No "Repair Ticket" card with "Waiting for Receipt". No "Status check due" for A1 (5-H14 cleared it).
- UAT Staff One (TSG): no "Your maintenance ticket" card for T5 (TSG gets "Repair Ticket" cards instead, and T5 is past receipt now, so it has none). No "Status check due" card at all.
- UAT LabHead CITe4D Two (a plain Researcher): no card for A1, T5, L1, D1 or D2.
- UAT LabHead CITe4D One: no "Status check due" and no "Your maintenance ticket" (this account did not report T5 and does not hold A1).
- UAT Director One and UAT Custodian Three: no "Disposal Request" card for D1 or D2. Both were decided in 5-H11 and 5-H12, and only TSG gets a card for an approved disposal.

**5-H17. A Lab Head sees only their own lab's tickets and disposals, and reports only on their own lab's assets.** Roles: UAT LabHead CITe4D One, then UAT LabHead CAR. Screen: Analytics, then the console. Database: `adric_uat_check` (writes nothing).
- As UAT LabHead CITe4D One: Analytics tab. The repair table has the columns "Ticket ID", "Asset ID", "Asset Name", "Issue Description", "Reported At", "Issue Type" and "Status". It lists `MNT-<T5>` for A1 (a CITe4D asset), with the issue type you picked and status Inspecting. A ticket on a CAR asset is not listed.
- As UAT LabHead CAR, console:
```js
fetch("http://localhost:4000/api/maintenance",{credentials:"include"}).then(r=>r.json()).then(console.log)
```
- Expect `success: true` and a `tickets` list with no `MNT-<T5>` (A1 is a CITe4D asset).
- Same account, report on A2 (a CITe4D asset):
```js
fetch("http://localhost:4000/api/assets/<A2>/maintenance",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({issueTypeId:1,issueDescription:"test"})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "This asset belongs to another lab. Only that lab's Head can report an issue on it."}` and no new ticket on A2.
- Database: `SELECT COUNT(*) FROM asset_maintenance m JOIN assets a ON a.asset_id=m.asset_id WHERE a.asset_tag='<A2>'` shows 0.

**5-H18. The old routes answer 404, and the server terminal shows only plain lines with ids.** Role: UAT Staff One. Screen: the console and the terminal that runs the start script. Database: `adric_uat_check` (writes nothing).
- Console:
```js
fetch("http://localhost:4000/api/maintenance/<T1>",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>console.log(r.status))
fetch("http://localhost:4000/api/maintenance/<T1>/status",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>console.log(r.status))
```
- Expect 404 twice.
- Terminal: look back over the lines from 5-H2 to 5-H15. They read like `Maintenance <id> received by user <id>`, `Maintenance <id> on <tag> reported by user <id>`, `Retirement <id> approved by user <id>`, `Asset <id> marked missing by user <id>` and `Inspection <id> on asset <id> filed by user <id>`. No name, email, ID number, description, reason, remark or photo appears in any line.

**5-H19. Nearby: a loan goes from request to receive, as before.** Roles: UAT Custodian One, UAT LabHead CITe4D One, UAT Staff One. Screens: Available Equipment, Requests, "Asset Loans", My Loans. Database: `adric_uat_check` (writes one loan, one release, one return).
- As UAT Custodian One: Available Equipment, open A2, Request Loan, any lab, Return By 14 days from today, purpose `Batch 5 nearby`, Submit Request. Write `LOAN-<number>` as **L3**.
- As UAT LabHead CITe4D One: Requests tab, Approve L3.
- As UAT Staff One: "Asset Loans", Releases, Release on A2 with the tag typed, "Confirm & Release Asset". A2 reads On Loan.
- As UAT Custodian One: My Loans, Out section, on L3 click "Ask to Return", remark `Batch 5 nearby`, submit. L3 reads Return Requested.
- As UAT Staff One: Returns tab, L3 first with the chip "Return requested". Click "Receive Return", type the tag, leave the "Damage found during return" switch off, confirm. Expect A2 is Available. L3 is under History in the Researcher's My Loans (Returned).
- Database: `SELECT status FROM asset_loans WHERE loan_id=<L3>` shows RETURNED. `SELECT status FROM assets WHERE asset_tag='<A2>'` shows AVAILABLE.

**5-H20. Nearby: the other screens still load.** Roles: UAT Staff One, UAT Director One, UAT Custodian Three, UAT LabHead CITe4D One. Screens: see below. Database: `adric_uat_check` (writes nothing).
- UAT Staff One: System Overview (the card "Open Maintenance Tickets" counts the open tickets, and the "Pending Returns" card opens "Asset Loans"), Asset Inventory (both tabs), Repairs, Inspections (the log below the queue), Analytics.
- UAT Director One: Overview, Analytics, Disposal Approvals, Inventory Report.
- UAT Custodian Three (the Secretary): the Staff view loads; "Asset Loans" is not in her sidebar; Repairs lists tickets to read, with no step buttons.
- UAT LabHead CITe4D One: Requests, Lab Inventory, Analytics.
- Expect on every page: no red error box, no failed call in DevTools, Network, and the repair numbers match the Repairs page.
