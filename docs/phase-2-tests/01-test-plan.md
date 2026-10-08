# 01. API Test Plan

Written in Part A of [PROMPT-tests.md](PROMPT-tests.md), 2026-10-08. Branch `test/phase-2-api-tests`.

This plan lists all 62 endpoints in `server.ts`: the 40 that get tests, which session writes them, what those tests check, and the 22 that are skipped, with the reason. How to set up and run the tests is in [tests/README.md](../../tests/README.md). Finding IDs refer to [01B-findings-register.md](../phase-1b-deep-map/01B-findings-register.md).

---

## 1. What the tests are for

Restructure steps 10 to 12 move the backend out of the single `server.ts` into `server/features/<process>/`. Those steps must not change what the API does. These tests make that checkable with one command, `npm test`, instead of long hand checks.

They are **characterization tests**: each one records what an endpoint does **today**, including known defects. If a later step changes that by accident, a test fails. If a later step changes it on purpose (for example step 13 adding `requireAuth`, or a fix for H-04), that step updates the affected tests in the same commit.

Every test talks to the server over HTTP only, so the tests do not care how the server is split into files.

### What each test checks

- **The status code** the endpoint answers with today.
- **The response shape**: the fields the screens read (named per endpoint below).
- **The database effect**: the rows created or changed, read back through Prisma (`db` in the harness) or a follow-up request.
- **Both sides of every guard**: the request the guard refuses, and the request it lets through.
- **Known defects, as they are**, with the finding ID in the test name, for example `it("finalizing a return leaves the loan open (known defect H-04)")`.

Not asserted: exact timestamps, generated ids or reference numbers, and any text containing today's date.

### Test data

Every file starts from the same fake data ([tests/setup/fixtures.ts](../../tests/setup/fixtures.ts)): 8 accounts (one per database role, plus two custodians), one lab (`TEST`, Manila), and six assets `TEST-0001` to `TEST-0006`, one in each state the workflows care about. The table in [tests/README.md](../../tests/README.md#the-fake-data) summarizes it. A session that needs more rows (for example projects, or a warranty that expires within 90 days, for B4) adds them in its own file's `beforeAll`, unless several files need them; then they go into the shared seed, with the smoke test still passing. The custody workflows (B2) change an asset's state with every request, so their write tests each add an asset of their own with [tests/setup/extraAssets.ts](../../tests/setup/extraAssets.ts) (tags `TEST-0101` onward) instead of sharing the six seeded ones. B3 does the same for repairs, inspections, and disposals (`TEST-0401`, `TEST-0501`, and `TEST-0601` onward).

---

## 2. Endpoints by feature

"Called from" names the web file that calls the endpoint through `web/api/`. "No caller" means nothing in `web/` calls it; those endpoints still get tests here, because step 12 moves them behavior-neutral and no decision deletes them.

Counts: B1 13 endpoints, B2 9, B3 10, B4 8. Total 40.

### 2.1 Auth (B1)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | `web/pages/auth/Login.tsx` | 200 with `role` and `user` (`userId`, names, `email`, `idNumber`, `userType`, `labAffiliation`, `staffUnit`) for each seeded role: ADMIN, ADRIC_SECRETARY, ITS_STAFF to `Staff`/`ITS`; TSG_STAFF to `Staff`/`TSG`; ADRIC_DIRECTOR to `AdRICDirector`; LAB_HEAD to `LabHead`; CUSTODIAN to `Custodian`. `labAffiliation` falls back to `CITe4D` for an account with no lab. 400 with no email or password; 401 for a wrong password | B1 | M-11 (`ITS_STAFF` maps to Staff, the Phase 2 test the team asked for; ADRIC_SECRETARY still maps to Staff/ITS); C-03 (the password is compared in SQL, so a different letter case still logs in) |
| `/api/auth/me` | GET | `web/state/session.tsx`, `web/pages/AccountDetailsPage.tsx` | 200 with the same profile fields plus `role` for any seeded email; 400 without `email`; 404 for an unknown email | B1 | C-06 (answers any email, no session needed) |
| `/api/auth/account` | PUT | `web/state/session.tsx` | 200 and the new first and last name in `users`; picture saved when sent; lab link updated through `user_centers` for a known lab code; 400 without email or names; 404 for an unknown email; another person's email in the body renames that person | B1 | C-02 (the body names the account to change); new: an unknown lab code tries to create a center with location `MANILA_CAMPUS`, which is not a valid value, fails silently, and the answer still names the lab the account is not linked to; new: with no lab sent, the answer says `CITe4D` whatever the account's lab is, and the account page shows that until reload |
| `/api/auth/register-request` | POST | `web/pages/auth/Register.tsx` | 200 with a `registration` (`REG-` id, `status` PENDING, defaults `Custodian` and `CITe4D`); written to `pending_registrations.json` in the server's **temporary** working folder (confirmed in Part A, see the log); 400 without names, email, or id number; 400 for an email or id number already in `users` | B1 | H-17 (stored in a JSON file in the working folder); C-03 (a missing password becomes `password123`) |
| `/api/auth/pending-registrations` | GET | `web/state/serverData.tsx` (Lab Head dashboard) | 200 with only `PENDING` entries, newest first, after register-request | B1 | C-04 (each entry includes its `password`) |
| `/api/auth/approve-registration` | POST | `web/state/serverData.tsx` (Lab Head dashboard) | For a pending id: 200, a `users` row, a `user_roles` row (requested "Custodian" to CUSTODIAN, "Lab Head" to LAB_HEAD, "TSG" to TSG_STAFF, "ITS" to ADMIN), a `user_centers` row for a known lab, and the entry gone from the pending list. 404 for an unknown id with no body details | B1 | C-05 (an unknown id with names and email in the body creates the account anyway, with the requested role); M-11 ("ITS" becomes ADMIN); 01C 4.1 (the answer echoes the created row, `password` included); new: a lab name it does not know creates a new research center (location MANILA) and links the account to it |
| `/api/auth/reject-registration` | POST | `web/state/serverData.tsx` (Lab Head dashboard) | 200 and the entry gone from the pending list; 200 for an unknown id as well | B1 | |
| `/api/auth/register` | POST | No caller | 200, a `users` row with a CUSTODIAN role and an optional lab link, no approval step; 400 for missing fields and for a duplicate email or id number | B1 | C-05 family (direct account creation) |

### 2.2 Assets (B1)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets` | GET | `web/state/serverData.tsx`, `web/features/assets/useStaffAssets.ts`, `web/pages/custodian/CustodianPortal.tsx`, `web/pages/director/AdRICDirectorDashboard.tsx`, `web/pages/lab-head/LabHeadDashboard.tsx`, `web/features/analytics/staff/StaffAnalyticsView.tsx` | 200 with one entry per asset: `id` (the tag), `name`, `category`, `status` (Active, On Loan, Maintenance, Disposed, or Overdue), `location` and `lab` split from the newest record, `custodian`, `condition` (number) and `assetCondition`, `cost` and `funding`, `borrowedOn`/`dueDate`/`daysLeft` for an asset on loan, `disposalDetails` for a disposed one, and the nested `asset_records`, `asset_transfers`, `asset_reports` | B1 | M-13 (disposal details parsed back out of one text column); M-09 (newest record by `date_logged`, then id) |
| `/api/assets/:tag/custodian-history` | GET | `web/features/assets/AssetDetailModal.tsx` | 200 with `custodianHistory` oldest first (`sequence`, `custodianName`, `status`, `location`, `condition`, `remarks`, `isCurrent` on the last); a numeric tag is also looked up as an asset id; 404 for an unknown tag | B1 | 01C 4.2 (each entry includes the custodian's `custodianEmail` and `custodianId`); an asset with no records gets an invented first entry (`custodian@dlsu.edu.ph`, H-09 family) |
| `/api/assets` | POST | `web/features/assets/IntakeWizard.tsx` | 200 and the next free tag for the lab prefix (`TEST-0007`); one `assets`, one `asset_monetary`, and one ACTIVE PERFECT `asset_records` row; an unknown category stored as `DEV_KIT`; custodian defaults to user 1; 400 without name or category; 400 for an image that is not an image | B1 | H-10 (custodian defaults to user 1) |
| `/api/assets/:tag` | PUT | `web/features/assets/EditAssetDialog.tsx` | 200; only the fields sent are changed; custodian found by typed name; a remark or condition also adds an `asset_reports` row; 404 for an unknown tag; 400 for a bad image | B1 | H-14 (rewrites the newest `asset_records` row instead of adding one); M-16 (a new acquisition value is ignored when a monetary row exists); new, M-16 family: sending only an acquisition value resets the funding source to "Unspecified"; H-10 (report filed under user 1 when the custodian name matches nobody) |
| `/api/assets/:tag` | DELETE | `web/features/assets/DeleteAssetDialog.tsx` | 200 and the asset gone with its records, loans, repairs, transfers, returns, and disposals; 404 for an unknown tag | B1 | H-03 (deletes the whole history; an asset with an inspection report cannot be deleted and answers 500); H-16 (that 500 carries the raw database error) |

### 2.3 Loans (B2)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets/:tag/borrow` | POST | `web/features/loans/LoanForm.tsx` | 200 and one `pending` `asset_loans` row, no new `asset_records` row; the borrower found by typed name; the destination lab written into `purpose`; 400 for missing fields; 404 for an unknown tag. The issue #25 guard (`findCustodyRequestConflict`), both sides: 409 when the asset has a pending loan, a pending transfer, or is On Loan, in Maintenance, or Disposed; 200 for an Active asset with nothing pending | B2 | H-10 (a name that matches nobody files the loan under user 1); H-05 note (the guard is check-then-insert; the race is not testable) |
| `/api/asset_loans` | GET | `web/state/serverData.tsx`, `web/pages/lab-head/LabHeadDashboard.tsx` | 200 with `loans` (`id` LOAN-n, `assetId`, `borrower`, `purpose` without the lab line, `destinationLab`, `status` capitalized, `lab` from the tag prefix) | B2 | H-08 (when no loan is pending, the GET inserts a pending loan with id 9 for the first asset and first student, and shows its asset as "ASUS TUF Gaming A15") |
| `/api/asset_loans/:id/decision` | PUT | `web/pages/lab-head/LabHeadDashboard.tsx`, `web/state/serverData.tsx` (notification bell) | approve: 200, loan `approved`, a new ON_LOAN record under the borrower with `current_location` from the destination lab; decline: 200, loan `declined`, no new record; 400 for a decided loan, a bad id, or a word other than approve/decline (`"reject"` included); 404 for an unknown id | B2 | restructure log note (`LabHeadAnalyticsView` sends `"reject"`, which answers 400) |

### 2.4 Returns (B2)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets/:tag/return` | POST | `web/features/returns/ReturnForm.tsx` | 200, one `asset_returns` row (reference number not asserted), and a new ACTIVE record with the reported condition, custodian user 1, and `current_location` back to the home lab; the comment replaces the remarks; 400 without a condition or with one outside the five; 404 for an unknown tag | B2 | H-04 (the loan stays `approved`); H-10 (returned-by found by typed name, else user 1); H-05 (no state check: an asset that is not on loan, even a disposed one, is accepted and becomes ACTIVE). H-21 cannot be reproduced here: the test database is built from `schema.prisma`, where the enum values have no spaces (see section 4) |
| `/api/asset_returns` | GET | No caller | 200 with `returns` (`id` RET-n, `assetId`, `asset`, `returnedBy`, `condition`, `referenceNumber`) | B2 | |

### 2.5 Transfers (B2)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets/:tag/transfer` | POST | `web/features/transfers/TransferForm.tsx` | 200 and one `pending` `asset_transfers` row from the asset's current custodian to the recipient found by email, destination lab written into `justification`; 400 without `toEmail` or `reason`; 404 for an unknown tag or email. The issue #25 guard, both sides: 409 for a pending loan or transfer, Maintenance, or Disposed; 200 for an Active or On Loan asset | B2 | H-19 (the destination lab is packed into the justification text; the effective date is dropped) |
| `/api/asset_transfers` | GET | `web/state/serverData.tsx`, `web/pages/lab-head/LabHeadDashboard.tsx` | 200 with `transfers` (`id` TRF-n, `from`, `fromCustodianId`, `to`, `toEmail`, `justification`, `destinationLab`, `status` Pending/Approved/Declined, `lab` from the tag prefix) | B2 | 01C 4.3 (recipient email sent to any caller); M-12 interplay (a `pending_approver` row shows as Pending) |
| `/api/asset_transfers/:id/decision` | PUT | `web/pages/lab-head/LabHeadDashboard.tsx`, `web/features/notifications/NotificationCenter.tsx` | approve: 200, `approved`, a new ON_LOAN record under the recipient; decline: 200, `declined`, no new record; 400 for a decided transfer, a bad id, or another word; 404 for an unknown id | B2 | |
| `/api/asset_transfers/:id/accept` | PUT | No caller | 200 and status `pending_approver`, remarks appended to the justification; afterwards `/decision` answers 400; 404 for an unknown id | B2 | M-12 (the transfer is stuck for good); new, M-12 family: it changes a transfer in any status, even an approved one; new, M-12 family: the issue #25 guard counts only `pending`, so the asset then takes a second transfer request; H-16 (an id that is not a number answers 500 with the raw Prisma message, including the server's file path and source lines) |

### 2.6 Repairs (B3)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets/:tag/repair` | POST | `web/features/repairs/RepairForm.tsx`, `web/features/returns/ReturnForm.tsx`, `web/state/serverData.tsx` (Custodian portal, asset detail modal) | 200 and one `asset_repairs` row, status "Pending TSG Review" or "Awaiting Immediate Dispatch" (when `isImmediate`), no `asset_records` change; reporter found by typed name ("Dr." dropped); 400 without a description; 404 for an unknown tag; 409 for the same tag and description again within 8 seconds, 200 for another description or another asset | B3 | M-07 (the server's 8-second duplicate guard); H-10 (reporter defaults to user 1); H-05 (a disposed asset takes a repair); new: the duplicate guard runs before the tag lookup, so a repeated request for an unknown tag answers 409, not 404 |
| `/api/asset_repairs` | GET | `web/state/serverData.tsx`, `web/features/repairs/useRepairTickets.ts` | 200 with `repairs` (`id` MNT-n, `repairId`, `assetId`, `assetName`, `reportedBy`, `custodian` (the reporter, shown as "Submitted By"), `description`, `progressStatus`, `isImmediate`, `priority`, `acknowledged` false only for the two starting statuses), newest first | B3 | |
| `/api/asset_repairs/:id` | PUT | `web/features/repairs/useRepairTickets.ts`, `web/state/serverData.tsx` | "Inspection Phase", "Warranty Holder Possession", "Third-Party Repairer Possession": 200 and one MAINTENANCE record at the TSG Office (none added if already in maintenance); "Fixed & Completed": 200, a record restoring the status, custodian, and location from before maintenance with the sent condition (else the current one), and an `asset_reports` row; any other text: 200, ticket updated, no record; 400 without `progressStatus` or with a bad id; 404 for an unknown id | B3 | H-07 (any text is accepted as a status); H-06 (differs from `/status`); new: neither record sets `repair_id`; new, H-07 family: "Fixed & Completed" adds a record and a report even for a ticket that never went into maintenance |
| `/api/asset_repairs/:id/status` | PUT | `web/features/analytics/staff/StaffAnalyticsView.tsx` | 200 and only the ticket's `progress_status` changed, no `asset_records` or `asset_reports` row even for a maintenance status or "Fixed & Completed"; 400 without `progressStatus`; an unknown id, or one that is not a number, answers 500 | B3 | H-06 (no asset status change); H-07; H-16 (the 500 carries the raw Prisma error); new, H-06 family: a status of only spaces is accepted |

### 2.7 Inspections and reports (B3)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets/:tag/inspection` | POST | `web/features/inspections/InspectionQueue.tsx`, `web/pages/custodian/CustodianPortal.tsx` | 200 and one `asset_reports` row; reporter from `reporterEmail`, else `reportedById`, else user 1; condition names mapped ("Minor Drift" to MINOR_DRIFT), an unknown one stored as PERFECT; default remarks, remarks cut to 255; the newest record's condition and remarks updated; a numeric tag looked up as an asset id; an asset with no records gets one at "DLSU Campus"; 404 for an unknown tag | B3 | H-14 (updates the newest record in place); H-10 (reporter defaults to user 1, and an unknown email wins over a valid `reportedById`); H-16 (a `reportedById` that is no account answers 500 with the raw foreign key error); new, H-07 family: an unknown condition (lower case, or "MINOR DRIFT") silently becomes PERFECT on the asset; new: the image is not checked |
| `/api/asset-reports` | GET | `web/features/inspections/useInspectionReports.ts` | 200 with `reports` (`reportId` number, `assetId` tag, `assetName`, `reportedBy`, `reporterEmail`, `reportCondition`, `reportRemarks`, `reportImg`), newest first | B3 | L-07 (two report endpoints with different shapes); 01C 4.2 (reporter email) |
| `/api/asset_reports` | GET | `web/state/serverData.tsx` | 200 with `reports` (`id`, `reportId` RPT-n, `asset_tag`, `assetName`, `reportedBy`, `condition`, `remarks`), newest first | B3 | L-07 |

### 2.8 Disposals (B3)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/assets/:tag/disposal` | POST | `web/features/disposals/DisposalFormDialog.tsx` | 200 and one `pending` `asset_disposals` row whose reason text holds the pathway, last custodian, target date, and justification; requester found by typed name; no `asset_records` change; 400 without `breakdownReasons` or `disposalPathway`; 404 for an unknown tag | B3 | H-05 (no state guard: an asset that is on loan, in maintenance, or already disposed is accepted; new case: a second pending disposal on the same asset is accepted); M-13 (details packed into one text column); H-10 (requester defaults to user 1) |
| `/api/asset_disposals` | GET | `web/state/serverData.tsx`, `web/pages/director/AdRICDirectorDashboard.tsx` | 200 with `disposals` (`id` DISP-n, `disposalId`, `assetId`, `assetName`, `requestedBy`, `reason`, `status` Pending/Approved/Rejected), newest first | B3 | H-07 family (any other status text shows as Pending) |
| `/api/asset_disposals/:id/decision` | PUT | `web/pages/director/AdRICDirectorDashboard.tsx`, `web/features/notifications/NotificationCenter.tsx` | approve: 200, `approved`, a DISPOSED record carrying `disposal_id`, the last custodian, and the condition, and the asset list shows it Disposed with the details read back; reject: 200, `rejected`, no record; 400 for a decided disposal, a bad id, or a word other than approve/reject (`"decline"` included); 404 for an unknown id | B3 | restructure log note (disposals use "reject" where loans and transfers use "decline"); H-05 (an asset on loan is disposed under its borrower; approving two disposals of one asset writes two DISPOSED records); new, M-13 family: the typed "Last Custodian" is never shown, the list uses the record's custodian |

### 2.9 Analytics with a live caller (B4)

| Endpoint | Method | Called from | What the tests check | Session | Known defects pinned |
|---|---|---|---|---|---|
| `/api/analytics/director` | GET | `web/features/analytics/director/DirectorAnalyticsView.tsx` | 200 with `data`: `totalPortfolioValue` (sum of the seeded values), `pendingDisposalsCount`, `fundingData`, `locationStatusData` (Manila and Laguna counts by status), `auditComplianceData` (reports per month); the `lab` and date filters | B4 | H-09 (with no reports, `auditComplianceData` is a fixed demo series); new: a location containing "CAR" (or another Laguna lab code) anywhere counts as Laguna |
| `/api/analytics/lab-head` | GET | `web/features/analytics/labHead/LabHeadAnalyticsView.tsx` | 200 with `data`: `loans`, `transfers`, `utilization`, `categoryData`, `projectAllocation`, `delinquencies`, `scatterData`, `heatmapData`, all limited to tags starting with the `lab` prefix; default prefix `CITe4D` | B4 | H-04 (a returned item whose loan is past due still counts as delinquent); 01C 4.4 (any prefix is accepted); M-14 (an unknown prefix gives empty data, not an error) |
| `/api/analytics/tsg` | GET | `web/features/analytics/staff/StaffAnalyticsView.tsx` | 200 with `data`: `repairs`, `conditionSummary` (good, degraded, critical counts from each asset's newest record, `conditionItems`), `warrantyExpiringSoon` (within 90 days; B4 seeds a warranty relative to today) | B4 | |
| `/api/analytics/location-status` | GET | `web/features/analytics/staff/StaffAnalyticsView.tsx` | 200 with `data`: `byLocation`, `byStatus`, `locationDistribution`, `statusCounts`; the `lab` filter | B4 | M-03 (a lab missing from the hardcoded list, such as `TEST`, is counted as CITe4D); M-09 (newest record by date only, no id tie-break) |
| `/api/analytics/advanced/inspection-progress` | GET | `web/features/analytics/staff/StaffAnalyticsView.tsx` | 200 with one entry per research center (`group`, `inspected`, `total`, `percent`) | B4 | new: a center with no projects reports 100% |
| `/api/analytics/advanced/idle-time` | GET | No live caller (its widget is in `legacy/analytics-widgets/`) | **Responds with 200 and `success: true` only**, as the prompt allows for the three endpoints kept on 2026-10-07 | B4 | |
| `/api/analytics/advanced/idle-frequency` | GET | No live caller (as above) | **200 and `success: true` only** | B4 | |
| `/api/analytics/advanced/loan-recommender` | GET | No live caller (as above) | **200 and `success: true` only** | B4 | |

---

## 3. Skipped endpoints

22 endpoints get no test. All are analytics.

> **Team decision, 2026-10-08 (covers 3.1 and 3.2).** None of these 22 endpoints is deleted. This replaces the 2026-10-04 decision to delete the 11 in section 3.1. In step 12 the handler code of all 22 moves to `legacy/analytics-endpoints/` with a README (one line per endpoint: path, method, what it computed, which tables it read, and its group, 3.1 or 3.2), and their routes are no longer registered, so calling them answers not found (404). No tests for them in Phase 2. Recorded in the decisions table of [PROMPT-2-restructure.md](../phase-1c-restructure/PROMPT-2-restructure.md) ("Old analytics") and in the [test log](02-test-log.md).

### 3.1 Callers quarantined in `legacy/analytics-v1/` (11): moved to legacy and unregistered in step 12

**Note (2026-10-08):** these 11 are no longer deleted. In step 12 their handlers move to `legacy/analytics-endpoints/` (README group 3.1) and their routes are unregistered. No tests in Phase 2.

Decided 2026-10-04, replaced 2026-10-08 (above): the 11 endpoints whose only callers were quarantined in `legacy/analytics-v1/` were to be deleted when the analytics backend is extracted in step 12. The list is the one in [legacy/analytics-v1/README.md](../../legacy/analytics-v1/README.md#backend-endpoints-that-now-have-no-caller-at-all) and [01A section 6.11](../phase-1b-deep-map/01A-system-trace.md#611-analytics-and-reporting) ("called only by dead components").

| Endpoint | Method | Was called by | Reason skipped |
|---|---|---|---|
| `/api/analytics/dashboard` | GET | `AnalyticsDashboard.tsx` (legacy) | Moved to legacy and unregistered in step 12 (decision 2026-10-08) |
| `/api/analytics/compliance` | GET | `ReportsAnalyticsDashboard.tsx` (legacy) | Same |
| `/api/analytics/delinquencies` | GET | `ReportsAnalyticsDashboard.tsx` (legacy) | Same |
| `/api/analytics/health-trends` | GET | `ReportsAnalyticsDashboard.tsx` (legacy) | Same |
| `/api/analytics/stakeholder/utilization` | GET | `RoleAnalyticsModule.tsx` (legacy) | Same |
| `/api/analytics/stakeholder/audit-discrepancies` | GET | `RoleAnalyticsModule.tsx` (legacy) | Same |
| `/api/analytics/stakeholder/degradation-tracker` | GET | `RoleAnalyticsModule.tsx` (legacy) | Same |
| `/api/analytics/stakeholder/disposal-prescriptions` | GET | `RoleAnalyticsModule.tsx` (legacy) | Same |
| `/api/analytics/stakeholder/preventative-schedule` | GET | `RoleAnalyticsModule.tsx` (legacy) | Same |
| `/api/analytics/stakeholder/accountability-bottlenecks` | GET | `RoleAnalyticsModule.tsx` (legacy) | Same |
| `/api/analytics/advanced/stewardship-score/:userId` | GET | `StudentAnalyticsView.tsx` (legacy) | Same |

### 3.2 Never called by anything (11): moved to legacy and unregistered in step 12

**Note (2026-10-08):** the team answered the question below. These 11 are not deleted: in step 12 their handlers move to `legacy/analytics-endpoints/` (README group 3.2) and their routes are unregistered, like section 3.1. They get no test in Phase 2, not even a "responds with 200" one in B4.

[01A section 6.11](../phase-1b-deep-map/01A-system-trace.md#611-analytics-and-reporting) lists a **second** group of 11 analytics endpoints that no file has ever called, live or legacy (checked again on 2026-10-08 across `web/`, `shared/`, and `legacy/`). They are not in the step 12 deletion (that list is 3.1), they are not among the three kept on 2026-10-07, and they have no live caller, so they fall outside B4.

| Endpoint | Method | Reason skipped |
|---|---|---|
| `/api/analytics/advanced/funding-valuation` | GET | No caller ever; moved to legacy and unregistered in step 12 (decision 2026-10-08) |
| `/api/analytics/advanced/campus-transfer-flow` | GET | Same |
| `/api/analytics/advanced/grant-readiness-index` | GET | Same |
| `/api/analytics/advanced/project-allocation` | GET | Same |
| `/api/analytics/advanced/warranty-calendar` | GET | Same (the Staff view has a `tsg-warranty-calendar` query key, but it calls `GET /api/assets`) |
| `/api/analytics/advanced/vendor-reliability` | GET | Same |
| `/api/analytics/advanced/equipment-calendar` | GET | Same |
| `/api/analytics/stakeholder/degradation` | GET | Same |
| `/api/analytics/stakeholder/chain-of-custody/:assetId` | GET | Same |
| `/api/analytics/stakeholder/stewardship-guidelines/:category` | GET | Same |
| `/api/analytics/stakeholder/project-closure-recall` | POST | Same |

**Question for the team (answered 2026-10-08, see the note above):** step 12 will move these 11 as they are. Should they be deleted with the 11 in 3.1, or kept? If kept, B4 can give them the same "responds with 200" test as the three in section 2.9, so the move is checked. Until then they stay untested.

---

## 4. Not covered, and why

| What | Why |
|---|---|
| Two requests at the same instant (the H-05 race in the #25 guard, H-11 tag and decision races) | Cannot be made to happen reliably in a test. A test that sometimes passes is worse than none. Phase 3 adds database triggers |
| Email content and delivery (transfer, disposal) | Mail is switched off for the tests (`MAILGUN_*` empty), so the server skips it. Tests check that the answer is unaffected |
| The 6-hour backup job | Switched off (`BACKUP_DIR` empty). Not part of the API |
| H-21 (two return conditions cannot be saved) | The test database is built from `prisma/schema.prisma`, and there the `asset_returns.condition` values have no spaces, so MINOR_DRIFT saves fine. The live database differs (its enum has spaces). A return test therefore describes behavior on `schema.prisma`, not on CCS Cloud. The live schema is baselined in step 14 |
| Any other difference between `schema.prisma` and the live database | Same reason. `docs/reference/AdRIC_DB_Schema.sql` is known not to match the live database (restructure log, H-23). Step 14 baselines from the live database |
| The frontend, including issue #49 (reloading logs the user out) | These are API tests. #49 has its own fix |
| Who may call what (C-02) | No endpoint checks a role today, so there is nothing to test yet. Tests that show "anyone can do this" are written where they pin a known defect (for example `/api/auth/me` and C-06). Step 13 adds the checks and their tests |

---

## 5. Session plan

| Session | Features | Endpoints | Files (planned) |
|---|---|---|---|
| A | Harness and smoke test | `GET /api/assets`, `POST /api/auth/login` (smoke only) | `tests/setup/*`, `tests/api/smoke.test.ts` |
| B1 | Auth, assets | 13 | `tests/api/auth.test.ts`, `tests/api/registration.test.ts`, `tests/api/assets.test.ts` |
| B2 | Loans, returns, transfers | 9 | `tests/api/loans.test.ts`, `tests/api/returns.test.ts`, `tests/api/transfers.test.ts` |
| B3 | Repairs, inspections and reports, disposals | 10 | `tests/api/repairs.test.ts`, `tests/api/inspections.test.ts`, `tests/api/disposals.test.ts` |
| B4 | Analytics with a live caller, plus the three kept | 8 | `tests/api/analytics.test.ts` |

One commit per feature (for example `test(B2): loans`), then docs housekeeping. Each session ends with `npm test`, `npm run build`, and the typecheck count.
