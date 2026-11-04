# Batch 3: the loan chain on the server

**Owner:** Raiki (Claude Code agent). **Branch:** `feat/batch-3-loans`, from `main` after PR #141 (Batch 2b) merged (`e755bf9`).
**Target:** merged Thu Nov 5 night (checkpoint 2). Joel wires his loan screens to it on Thu Nov 5; the loan demo is Thu night (checkpoint 3).
**Source of truth:** this file. Contract: `docs/contracts/lifecycle.md` sections 1, 3, 4 (Loan), 5, 6, 7.3 and 7.10. Where this brief and the contract differ, this brief wins and the docs commit updates the contract.
**Closes:** #87 (two-stage return: return request, then TSG receipt) and #131 (the bell matches people by display name).

Read first, fully: `AGENTS.md`, `CLAUDE.md`, `docs/contracts/lifecycle.md`, `docs/guides/CODE-COMMENTS.md`, `tests/README.md`, `docs/tasks/batch-1-foundation.md` (the guard, the status setter, row locks, the derive helpers), `docs/tasks/batch-2b-signups.md` (the latest conventions), then this brief.

---

## 1. Why

Today a Lab Head's approval hands the asset over at once (no TSG release), a return request lives only in the borrower's browser, the destination lab is packed into the purpose text, and the bell finds people by display name. The frozen manuscript (1.6.2.3) and the workshop say: the borrower requests, the home lab's Head approves, TSG checks the asset and releases it, the borrower asks to return, and TSG receives and inspects it. Batch 1 already added every column this needs (`asset_loans` decided, released, return-requested, received and closed fields; `destination_center_id`, `destination_room`; release and return inspection links). Batch 3 builds the steps on the server and moves today's loan screens onto them.

Core principle: approval permits; TSG confirms the physical step; history is never overwritten.

## 2. Hard rules

1. **No schema change.** If a column is missing, stop and ask.
2. **Every loan step runs in one transaction that locks the asset row first** (`lockAsset` in `server/shared/services/rowLocks.ts`), then reads the loan and the asset again inside the lock and checks them. A check made before the lock does not count (lesson from #75). Always lock the asset before anything else, so two steps never wait on each other in opposite order.
3. **`assets.status` changes only through `setAssetStatus`**, in the same transaction as the step that causes it.
4. **Asset status checks go through the lifecycle guard** (`assertActionAllowed`). If a step needs an action the guard does not have yet (for example releasing a loan needs the asset still Available), add the action to the guard and its table test. Do not check asset status words in a service.
5. **The acting person comes from the session.** The borrower is always the session user; a borrower id or name in a body is ignored.
6. **Logs:** no emoji, no body, no email, no ID number. Short lines with ids only (for example "Loan 18 released by user 7").
7. **Privacy:** a Researcher never gets another person's name or id (contract section 6). A Researcher's lists hold only their own loans.
8. Never read `.env` or `pending_registrations.json`. Never touch CCS Cloud. Never run `prisma migrate dev`, `db push` or `db pull`. No new package. No em dashes. Typecheck must stay at **25 or lower**.

## 3. Server

### 3.1 The `Loan` shape

One builder in `loans.service.ts` turns a loan row into the contract's `Loan` (section 7, "Common objects"). Every new endpoint answers with it. Rules:
- `destinationLab` comes from `destination_center_id`, never from the purpose text. `purpose` is sent as stored.
- `isOverdue` uses `isOverdue` from `assetState.ts` (On Loan or Return Requested, return-by passed). A loan that was never released is never overdue.
- `releaseInspection` and `returnInspection` are the contract's `Inspection`, or null.
- People are `{ userId, name }` or null. For a Researcher who is not the borrower, `borrower` is `{ hidden: true }` (only possible on lists that a Researcher can call; see 3.5).
- Types go in `shared/types/loans.ts`; labels come from `shared/constants/loanStatuses.ts`.

### 3.2 Request, cancel, approve, decline

| Meaning | Method and path | Who |
|---|---|---|
| Request | `POST /api/assets/:assetTag/loans` | Researcher with at least one lab, whose account heads no lab |
| Cancel | `PUT /api/loans/:loanId/cancel` | the borrower |
| Approve | `PUT /api/loans/:loanId/approve` | the Head of the asset's home lab |
| Decline | `PUT /api/loans/:loanId/decline` | the Head of the asset's home lab |

- **Request** body `{ destinationCenterId, destinationRoom?, projectId?, returnBy, purpose }`.
  - `destinationCenterId` must be one of the borrower's labs (`user_centers`), else 400 "Pick one of your own labs."
  - `returnBy` is a date (`yyyy-mm-dd`), not before today (server date), else 400.
  - `purpose` required, trimmed. `destinationRoom` at most 100 characters. `projectId`, if given, must exist.
  - An account that heads a lab gets **403 "Use your personal account to borrow."** (contract section 6; new in this batch).
  - The asset's home lab must have a Head, else 409 with `NO_LAB_HEAD_MESSAGE`.
  - Inside the lock: the guard with the open loan (one open loan per asset: Pending Approval, Pending Release, On Loan, Return Requested). Writes the loan in Pending Approval. The asset stays Available. **Stop packing the destination into `purpose`** (removes TODO(H-19)).
  - Answers **201** `{ loan }`.
- **Cancel:** only the borrower (403 otherwise), only from Pending Approval or Pending Release (409 otherwise). Sets Cancelled and `closed_at`. The asset stays Available.
- **Approve** body `{ decisionRemarks? }`: `requireHomeLabHead` (403 `NOT_YOUR_LAB_MESSAGE`, 409 no Head), only from Pending Approval (409), asset still allowed by the guard. Sets Pending Release, `decided_by_id`, `decided_at`, remarks. **The asset stays Available** (removes TODO(H-04) and the old "approval hands it over").
- **Decline** body `{ decisionRemarks }` (required, 400 if empty): same checks; Declined, decided by and at, `closed_at`. Asset unchanged.
- Remove `POST /api/assets/:assetTag/borrow` and `PUT /api/loans/:loanId/decision` (they answer 404 after, like other removed routes).

### 3.3 Release (TSG)

`PUT /api/loans/:loanId/release`, TSG, body `{ inspection: InspectionInput }` (contract section 7).
- Only from Pending Release (409). The asset must still be Available (guard).
- In one transaction: write a **Loan Release** inspection (inspector = the session user), set the loan On Loan with `released_by_id`, `released_at`, `release_inspection_id`, and set the asset On Loan.
- **One inspection writer for every step:** add `server/shared/services/inspections.ts` with `writeInspection(tx, { assetId, type, input, inspectorId })`. It writes the row and, when `input.metrics` is given, its `asset_inspection_metrics` rows. A metric must belong to the asset's category (`category_metrics`), else 400 "That measurement does not apply to this asset." Read the body with the existing `readInspectionInput` (move it to a shared place if two features need it, in its own commit if that is a pure move). Release and receive use this writer; registration may switch to it later (not in this batch).

### 3.4 Return request and receipt (#87)

| Meaning | Method and path | Who |
|---|---|---|
| Ask to return | `PUT /api/loans/:loanId/return-request` | the borrower |
| Receive | `PUT /api/loans/:loanId/receive` | TSG |

- **Return request** body `{ remarks? }` (at most 255 characters, stored in `asset_loans.remarks`): only the borrower, only from On Loan (409). Sets Return Requested and `return_requested_at`. The asset stays On Loan; the borrower is still accountable.
- **Receive** body `{ inspection: InspectionInput, returnDamage?: { issueTypeId, issueDescription } }`:
  - From Return Requested, or straight from On Loan (a walk-in return, allowed and recorded as is: `return_requested_at` stays null).
  - Writes a **Return** inspection; the loan becomes Returned with `received_by_id`, `return_inspection_id`, `closed_at`.
  - No `returnDamage`: the asset becomes Available (back at its home lab and room, worked out).
  - With `returnDamage`: also writes an `asset_maintenance` row: type RETURN_DAMAGE, status INSPECTING, reported by and received by the TSG user, received now, `trigger_inspection_id` = the Return inspection, the issue type (must exist, 400) and description (required). The asset becomes Maintenance. Answers `{ loan, maintenance }` (`maintenance` in today's maintenance list shape is fine; Batch 5 gives it the contract shape).
  - TSG's notes go in the inspection's `remarks`. The contract's top-level `remarks` on receive is dropped (the docs commit updates 7.3).
- Remove `POST /api/assets/:assetTag/return`, the `returns` feature folder, and `shared/types/returns.ts` if nothing else uses them (old route answers 404).

### 3.5 Lists and records

| Meaning | Method and path | Who | Answer |
|---|---|---|---|
| Loans by status | `GET /api/loans?status=` | TSG | `{ loans: Loan[] }`. One or more statuses separated by commas; 400 for an unknown one. Oldest request first |
| My loans | `GET /api/loans/mine` | logged in | the session user's loans, `?status=` optional, newest first |
| My lab's requests | `GET /api/loans/lab-requests` | an account that heads a lab | loans on assets whose home lab it heads, `?status=` optional, oldest first; 403 "You do not head a lab." |
| Accountability Form data | `GET /api/loans/:loanId/accountability-form` | the borrower, the Head of the home lab, TSG | contract 7.3; 409 "This loan has not been released yet." |
| Clearance record | `POST /api/users/:userId/clearance-record` | TSG | `{ person: { userId, name, idNumber, labs }, cleared, loans: Loan[] }` |

- `GET /api/loans` **with no query keeps today's shape and its bridge map** (`SCREEN_LOAN_WORDS`), because screens Batch 3 does not touch still read it. Keep the TODO(H-07) note, reworded: the map goes when the last screen moves to the new lists (Joel's loan screens). With `?status=` it answers the new shape for TSG only.
- **Accountability Form data** follows Appendix 1 of Doc Joel's "CCS Equipment Monitoring Policies" v1.0 (Accountability ID, asset tag, name, model, serial, Responsible Person and email, clauses, signatures, date issued and effective period). So the answer's `borrower` adds `email` (the borrower's own, shown only to the borrower, the home Head and TSG): `{ userId, name, idNumber, email, labs }`. The asset's `manufacturer` stands in for Model (there is no model column). The clauses are fixed text on Joel's page, not server data.
- **Clearance record:** `cleared` from `isCleared` (`assetState.ts`). `loans`: the person's loans that reached Pending Release or later (released, open or closed after release), newest first. Writes a CLEARANCE_RECORD_PRINTED activity row (actor TSG, target the person, no email). Put the route in the loans feature (it reads loans); the path stays as in the contract.
- **Overdue in analytics:** `analytics.service.ts` counts a loan as overdue unless it is Returned or Declined (TODO(H-04) there). Make it use the same rule as `isOverdue` (only On Loan or Return Requested past return-by). Its own commit.

### 3.6 Notifications (#131)

`GET /api/notifications/mine`, logged in: `{ notifications: [{ kind, label, loanId?, assetTag?, centerId?, date? }] }`, worked out on each call from loans (contract 7.10). No table.
- `LOAN_AWAITING_APPROVAL`: the account that heads the asset's home lab, one per Pending Approval loan.
- `RELEASE_WAITING` and `RETURN_WAITING`: TSG, one per Pending Release or Return Requested loan.
- `LOAN_DUE_SOON` (return-by within 3 days, today included) and `LOAN_OVERDUE`: the borrower, for their On Loan or Return Requested loans.
- `STATUS_CHECK_DUE` comes in Batch 5. Labels in a new `shared/constants/notifications.ts`.
- People are matched by user id only.

## 4. Web (only today's loan screens, moved onto the new steps)

**Joel builds the new loan screens** (TSG Releases and Returns tabs with the release dialog, the Accountability Form print page, the clearance print page, the Lab Head Requests redesign #116, My Loans). Batch 3 does **not** build those. It only keeps today's screens working on the new server, so `main` never breaks:
- **`web/api/loans.api.ts`:** one function per endpoint in 3.2 to 3.6, typed with `shared/types/loans.ts`, so Joel calls them as they are. Remove `web/api/returns.api.ts` if nothing uses it.
- **Loan request form (`LoanForm.tsx`):** destination lab picker lists only the session's `labs`; optional room; sends `destinationCenterId`. Errors through `readResult`.
- **Lab Head decisions** (today's Custody tab and the bell's buttons): call approve and decline; decline asks for remarks.
- **Researcher "request return":** calls the return-request endpoint. Remove the browser-stored return requests (`browserOnly.tsx` returns part, `openReturnRequests.ts`).
- **Staff Pending Returns and "Record Return":** the list from `GET /api/loans?status=RETURN_REQUESTED,ON_LOAN` (a walk-in can be received too), and Record Return calls receive with an inspection (condition, optional remarks; the existing form fields map onto `InspectionInput`). The Staff overview count reads the same list.
- **The bell (`NotificationCenter.tsx`):** reads `GET /api/notifications/mine` instead of matching names and reading browser storage.
- **Release has no screen in this batch** (Joel's Releases tab). Hand checks release through the browser console (section 8).

## 5. Tests

Update tests that pin old behavior in the same commit (AGENTS rule 5). At least:
- Request: 201 Pending Approval with the destination lab; 400 lab not theirs, return-by in the past, no purpose; 403 an account that heads a lab ("Use your personal account to borrow."), Staff, IT Admin; 404; 409 asset not Available; 409 a loan already waiting; 409 the lab has no Head. **Two requests for one asset with `Promise.all`: one 201, one 409.**
- Cancel: by the borrower from Pending Approval and from Pending Release; 403 someone else; 409 after release.
- Approve and decline: the home Head only (another lab's Head 403, the loan unchanged); decline needs remarks; approve leaves the asset Available and blocks a second request (409); 409 not Pending Approval. **Approve and cancel at once (`Promise.all`): exactly one wins, the other 409.**
- Release: TSG only (Researcher, Head, Secretary, IT Admin 403); 409 not Pending Release; writes a Loan Release inspection with the TSG user; loan On Loan; asset On Loan; holder is the borrower; current location is the destination. **Two releases at once: one 200, one 409.** A metric of another category: 400 and nothing written.
- Return request: borrower only; 409 not On Loan; asset stays On Loan.
- Receive: from Return Requested and from On Loan (walk-in); Return inspection written; loan Returned and closed; asset Available at home; with `returnDamage`: a RETURN_DAMAGE maintenance row in INSPECTING, asset Maintenance; 400 unknown issue type and nothing written; 409 from Pending Release or Returned. **Two receives at once: one 200, one 409.**
- Lists: `?status=` TSG only, unknown status 400; `/mine` holds only the caller's loans; `/lab-requests` only the lab the caller heads, 403 for an account that heads none.
- Accountability Form: borrower, home Head and TSG get it; another Researcher 403; 409 before release.
- Clearance record: TSG only; `cleared` false with an open loan, true after the return; one CLEARANCE_RECORD_PRINTED row with no email.
- Notifications: each kind reaches only its person (by user id); none for others; overdue and due-soon by date.
- The removed routes (`/borrow`, `/decision`, `POST /api/assets/:assetTag/return`) answer 404.
- Overdue in analytics: a Pending Approval loan past its return-by is not counted.

## 6. Commits and stops

**Stop 0 (no commit):** read everything above; report what the loan and return code does today, every screen and test that calls `/borrow`, `/decision`, `POST .../return` or reads browser-stored returns, the guard actions you will add, where `readInspectionInput` will live, and your plan per commit with expected test counts. Questions in the "When unsure" format. Wait for go.

| # | Commit | What |
|---|---|---|
| 1 | `docs(tasks): save the Batch 3 brief` | This file as `docs/tasks/batch-3-loans.md`, with a "Decisions" section for the Stop 0 answers |
| 2 | `feat(loans): request, cancel, approve and decline in the new loan shape` | 3.1, 3.2 and tests |
| 3 | `feat(loans): TSG release with a Loan Release inspection` | 3.3 (with the shared inspection writer) and tests |
| 4 | `feat(loans): return requests and TSG receipt (#87)` | 3.4 and tests |
| 5 | `feat(loans): loan lists, Accountability Form data and clearance record` | 3.5 except analytics, and tests |
| 6 | `fix(analytics): count only handed-over loans as overdue` | 3.5 last point and its test |
| 7 | `feat(notifications): notifications worked out from loans (#131)` | 3.6 and tests |

**Stop 1** after commit 7: checks after each commit, test counts and why they moved, anything that surprised you.

| # | Commit | What |
|---|---|---|
| 8 | `feat(web): today's loan screens use the new loan steps` | Section 4 except the bell |
| 9 | `feat(web): the bell reads my notifications from the server (#131)` | Section 4, the bell |
| 10 | `docs: Batch 3 contract, guide and counts` | Contract 7.3 and 7.10 marked live (and the receive body without top-level remarks, the "Use your personal account" 403, `GET /api/loans` with no query keeping the old shape for now), AGENTS.md counts and paths, the guide, `tests/README.md`, results in this task file |

**Stop 2** after commit 10: checks, then hand checks (section 8), then the report.

Report typecheck, build and tests after every commit that changes code.

## 7. Not in Batch 3

- The new loan screens, the Accountability Form and clearance print pages, the Lab Head Requests redesign (Joel, #116).
- Maintenance receipt that ends a loan (Ended by Maintenance), Missing (Ended by Loss), the maintenance contract shape, `STATUS_CHECK_DUE` (Batch 5).
- **For Batch 5 to decide:** marking missing or requesting retirement on an asset whose loan is still Pending Approval or Pending Release. Note it in the task file; do not change it here.
- Removing the old `GET /api/loans` shape and its bridge map (after Joel's screens).
- The demo seed (Raiki, after Batch 5).

## 8. Hand checks (for Raiki, `adric_uat_check` only)

Under the heading **"Batch 3 hand checks"** in `docs/tasks/batch-3-loans.md`, numbered **3-H1** onward, in the order to run them, each with role, screen, clicks, expected result and database. Before them: ports 4000 and 5173 free, start through `C:\dev\uat-data\start-local-uat.ps1`. For release and the Accountability Form, give a one-line browser console command (logged in as TSG, `fetch` with the session cookie) and what it should print. At least:
- A Researcher requests an asset of another lab: the destination picker lists only their own labs.
- The Head of a third lab does not see the request; the home lab's Head approves it; a second Researcher's request on the same asset is refused with the server's sentence.
- The Lab Head office account tries to borrow: "Use your personal account to borrow."
- TSG releases it (console); the asset shows On Loan with the borrower as holder; the Accountability Form data comes back.
- The Researcher asks to return; in another browser, TSG sees it in Pending Returns (proves it is on the server, not in a browser).
- TSG records the return: Available, back home. A second loan returned with damage: Maintenance and a ticket on the Repairs board.
- The bell: the Head sees the waiting approval, TSG sees the waiting release and return, the borrower sees due soon or overdue; nobody sees someone else's.
- The old routes answer 404; the server terminal shows only plain lines with ids.
- Nearby: Staff Inventory, Repairs and Director dashboards still load.

## Decisions

Made by Raiki at Stop 0 (2026-11-05). Where they differ from the sections above, these win.

**Stop 0 answers:**

- **Q1: A.** The bell's loan, return, due-soon and overdue cards come only from `GET /api/notifications/mine`. The cards that found the Researcher by name are removed: their repair cards, the overdue hold card and its banner, and the manual holds. The Staff, Director and Lab Head repair, disposal and health cards stay. After this nothing reads `manualClearanceHolds`, so `web/state/browserOnly.tsx` and its provider are removed completely (commit 8 or 9). The Researcher's maintenance notifications (by user id) come in Batch 5.
- **Q2: A.** `LOAN_DUE_SOON` when the return-by date is today to today + 3 days (0 to 3 days left).
- **Q3: B.** No change to today's Record Return form. Return damage is tested in the API tests and in a hand check by console command.
- **Q4: A.** The Staff Overview "Pending Returns" count is only the Return Requested loans of the `?status=RETURN_REQUESTED,ON_LOAN` list. The Pending Returns page lists Return Requested loans first, then the walk-ins.

**Accepted with the plan:**

- **Guard actions:** `APPROVE_LOAN` and `RELEASE_LOAN` (Available only), `REQUEST_RETURN` and `RECEIVE_RETURN` (On Loan only). Cancel and decline do not check the asset's status, so a loan on an asset that went to maintenance can still be declined or cancelled.
- **`readInspectionInput`** moves, with its `readText` helper, to `server/shared/validation/inspectionInput.ts` in a commit that only moves code (2b), and reads `metrics` from commit 3. The `Inspection` shape works out `flagged` from the asset's first recorded value of each metric.
- **The old web types** (`LoanRequestInput`, `LoanDecision`, `ReturnInput`) stay until commit 8, so the typecheck count does not go up in between.
- **Routes:** cancel and return-request need a Researcher at the route, then the service checks the borrower. Request lets a Researcher and a Lab Head account through, then a Lab Head account gets 403 "Use your personal account to borrow.". The request route and `/lab-requests` refuse with their own sentences, so they are tested in `tests/api/loans.test.ts`, not in the session role table.
- **The old `GET /api/loans` list:** `destinationLab` comes from `destination_center_id`, and `purpose` is sent as stored (old UAT rows still show their "Destination Lab:" line; the Nov 8 database starts fresh). The asset modal's "request pending" notice also covers Pending Release.
- **Clearance record `loans`:** the loans that were released, plus those still in Pending Release. A loan cancelled after approval is left out: nothing was handed over.
- **Lab Head decline** shows a small remarks box, on the Custody tab and in the bell.
- **The Staff Pending Returns page** loads its list only for TSG (the Secretary is still on the Staff view).
- **Notifications on the web** go through a new `web/api/notifications.api.ts`, next to the server's `server/features/notifications/`.
- **The maintenance list item** becomes one exported function in `maintenance.service.ts`, so receive can answer with a ticket in that shape.

**For Batch 5 to decide (section 7):** marking an asset missing, or requesting its retirement, while its loan is still Pending Approval or Pending Release. Batch 3 does not change it.
