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

## Results at Stop 1 and Stop 2

Branch `feat/batch-3-loans`, from `main` after PR #141. Nothing pushed. No schema change, no new package, nothing run against CCS Cloud.

| # | Commit | Hash | Typecheck | Tests (total) | Why the tests moved |
|---|---|---|---|---|---|
| 1 | `docs(tasks): save the Batch 3 brief` | `c2194652` | 25 | 569 | Docs only |
| 2a | `refactor(inspections): move readInspectionInput and the field readers to server/shared/validation` | `700ad1f7` | 25 | 569 | Move only |
| 2 | `feat(loans): request, cancel, approve and decline in the new loan shape` | `b5030dee` | 25 | 578 | +9: the 31 old borrow and decision tests became 41 request, cancel, approve and decline tests, permissions +2, session +1 |
| 3 | `feat(loans): TSG release with a Loan Release inspection` | `c61d304f` | 25 | 595 | +17: release tests +15, one session row, one IT Admin row |
| 4 | `feat(loans): return requests and TSG receipt (#87)` | `3dbc2f40` | 25 | 594 | -1: `returns.test.ts` removed (-21), return request and receipt tests +18, session +1, IT Admin +1 |
| 5 | `feat(loans): loan lists, Accountability Form data and clearance record` | `2bf5fbe3` | 25 | 622 | +28: `loanLists.test.ts` (24) and four session rows |
| 6 | `fix(analytics): count only handed-over loans as overdue` | `8bde111e` | 25 | 623 | +1: the analytics test for a Pending Approval loan past its return-by date |
| 7 | `feat(notifications): notifications worked out from loans (#131)` | `43e2bbeb` | 25 | 631 | +8: `notifications.test.ts` (7) and one session row |
| 8 | `feat(web): today's loan screens use the new loan steps` | `9a3f4c7e` | 25 | 631 | Unchanged (web only) |
| 9 | `feat(web): the bell reads my notifications from the server (#131)` | `213beb45` | 25 | 631 | Unchanged (web only) |
| 10 | `docs: Batch 3 contract, guide and counts` | this commit | 25 | 631 | Unchanged (docs only) |

Build passes after every code commit. Typecheck stayed at 25 (the same 25 errors as `main`). `AGENTS.md` now says 631 tests.

**Where the build differs from the brief or went beyond it:**

- The Lab Head analytics view also read "Destination Lab:" out of the purpose, so it now reads `destination_center_id` (commit 2). The test seed's two loan purposes lost their packed line.
- `fields.ts` (new) holds `readId`, `readText` and `readDate`, and `inspectionInput.ts` holds `readInspectionInput`, both in `server/shared/validation/` (commit 2a). Registration now answers 400 for a badly shaped `metrics` list.
- A decision on a loan that is not Pending Approval answers 409, not 400.
- The Accountability Form and the clearance record count a loan as handed over by its status, so loans the Batch 1 migration moved to On Loan (no `released_at`) count. For those, `releaseInspection` is null.
- Purpose, decision remarks and a damage description are limited to 2000 characters (the columns are TEXT); a return request's remarks to 255, as the brief says.
- `repairListItemOf` is exported from `maintenance.service.ts`, so receive can answer with the ticket in the Repairs list's shape.
- Any account that heads a lab gets "Use your personal account to borrow.", whatever its role.
- Web: LoanForm lists the session's `labs`, has an optional room, and shows the real loan id as the reference. It has no project picker (`projectId` is optional and not sent).
- Web: the Researcher's return form has no Return Date any more (the server dates the request); its comments go in as the remarks, at most 255 characters.
- Web: Record Return and the Pending Returns list are for TSG only (`staffUnit` "TSG"). The Secretary, who is on the Staff view, sees "Only TSG staff receive returns." and no Record Return button, because the server refuses her receive.
- Web: the Lab Head Custody tab draws the new screen words ("Pending release", "Return requested") as approved loans and leaves cancelled ones out.
- Web: the bell lost its Clearance Holds tab and banner altogether. The manual holds are gone with `browserOnly.tsx`, and the system holds were built from overdue assets matched by custodian name, which is what Q1 A removed. Staff, Director and Lab Head keep their repair, disposal and health cards; their asset-based overdue cards are replaced by the server's notifications, which only the borrower gets.
- Web: commit 8 left `browserOnly.tsx` and `openReturnRequests.ts` in place, because the bell still read them; commit 9 removed both with the bell's rewrite. Between the two commits the bell's Decline sent no reason, so the server refused it. Only commit 9 has the reason box in the bell.
- Browsers that used the old screens may still hold an unused `ems_returns` key in localStorage. Nothing reads it.

## Recommendations notes

For the Recommendations document, from Batch 3:

- **A borrower who later heads a lab cannot cancel or ask to return their own loan.** Those two routes are for a Researcher who heads no lab, as agreed at Stop 0. TSG can still receive such a loan as a walk-in.
- **`GET /api/loans` with no query still sends every loan to every caller (M-02).** Today's screens read it. It goes, with the old row shape and its bridge map of screen words, when Joel's loan screens move to `/mine`, `/lab-requests` and `?status=`.
- **Marking an asset missing, or requesting its retirement, while its loan is still Pending Approval or Pending Release** is not handled (section 7). Batch 5 decides.
- **The Researcher's repair cards in the bell** are gone until Batch 5 finds them by user id.
- **Loans migrated by Batch 1 have no `released_at` and no Loan Release inspection.** Screens that show a release must allow a null.

## Batch 3 hand checks

Written for Raiki, to run by hand. The agent did not run them. Every check uses **`adric_uat_check` only** (the local copy), started through `C:\dev\uat-data\start-local-uat.ps1` on branch `feat/batch-3-loans`. Nothing here touches CCS Cloud. Find this section by searching the exact heading text `Batch 3 hand checks` in `docs/tasks/batch-3-loans.md`; each check below names its number (3-H1 to 3-H14).

**Before the checks**

1. Ports 4000 and 5173 must be free (no leftover `npm run dev:all`, which talks to CCS Cloud). `adric_uat_check` must be at the latest migrations with hashed passwords, as for the Batch 2b checks.
2. Start the app with `C:\dev\uat-data\start-local-uat.ps1`. Accounts and passwords are in `C:\dev\uat-data\uat-passwords.txt` (do not copy them anywhere). Use a private window per account, or log out between accounts. The accounts: TSG "UAT Staff One"; the Head of the home lab "UAT LabHead CITe4D One"; the Head of another lab "UAT LabHead CAR"; the borrower "UAT Custodian One"; a second Researcher "UAT LabHead CITe4D Two"; the "UAT Director" account.
3. Pick two **Available CITe4D assets** in UAT Staff One's Inventory and write their tags down: **A1** and **A2**. The loan ids are the numbers in `LOAN-<number>`: **L1** is the first loan (3-H1), **L2** the second (3-H10).
4. **Console commands.** Open DevTools (F12), Console, on a page of `http://localhost:5173` while logged in as the account named in the check. The first time the browser may ask you to type `allow pasting`. Replace `<A1>`, `<L1>` and so on before sending. Each command prints the server's answer; `success` is the first thing to read.
5. **To read the database**, SELECT only, never a `password` column. PowerShell, it asks for the root password: `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "<SELECT>"`. One check (3-H11) runs a single UPDATE on `adric_uat_check`, and says so.
6. These checks leave loans, inspections and activity rows in `adric_uat_check`. The next `uat-reset.sql` load removes them.

**3-H1. A Researcher requests an asset: the destination picker lists only their own labs.** Role: UAT Custodian One. Database: `adric_uat_check` (writes one loan).
- Account page: note the labs listed there. Then Available Equipment, open A1, click Request Loan.
- Expect: "Research Lab Destination" lists exactly the labs from the Account page and no other (the old bug: it listed every research center). There is a "Room (optional)" box, and the date field is named "Return By". Type a past date: "The return-by date cannot be in the past." shows and Submit Request stays disabled.
- Pick a lab, Room `Room 301`, purpose `Batch 3 check one`, Return By 7 days from today. Click Submit Request. Expect "Loan Request Sent" and a reference `LOAN-<number>`. That number is the real loan id (it used to be made up in the browser). Write it down as **L1**.
- Database: `SELECT loan_id, status, destination_center_id, destination_room, return_by FROM asset_loans WHERE loan_id=<L1>` shows PENDING_APPROVAL, the id of the lab you picked, `Room 301`, and the date.

**3-H2. A second Researcher's request on the same asset is refused with the server's sentence.** Role: UAT LabHead CITe4D Two (a plain Researcher). Database: `adric_uat_check` (writes nothing).
- Available Equipment, open A1. The Request Loan button is replaced by a grey "Requested by another user" tile.
- Console:
```js
fetch("http://localhost:4000/api/auth/me",{credentials:"include"}).then(r=>r.json()).then(m=>fetch("http://localhost:4000/api/assets/<A1>/loans",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({destinationCenterId:m.user.labs[0].centerId,returnBy:"2030-01-01",purpose:"Second request"})})).then(r=>r.json()).then(console.log)
```
- Expect it to print `{success: false, error: "<A1> already has a loan in Pending Approval (LOAN-<L1>)."}`. If this account is in no lab, the command stops with an error about `undefined` before it sends anything; then run the same command as UAT Custodian One, who is refused with the same sentence.
- Database: `SELECT COUNT(*) FROM asset_loans l JOIN assets a ON a.asset_id=l.asset_id WHERE a.asset_tag='<A1>' AND l.status='PENDING_APPROVAL'` shows 1.

**3-H3. The Head of another lab does not see the request and cannot approve it.** Role: UAT LabHead CAR. Database: `adric_uat_check` (writes nothing).
- Custody tab ("Loan Requests"): LOAN-<L1> is not listed. Open the bell: there is no "Equipment Loan Request" card for A1.
- Console:
```js
fetch("http://localhost:4000/api/loans/<L1>/approve",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "This asset belongs to another lab. Only that lab's Head can decide its loans."}`.
- Database: `SELECT status FROM asset_loans WHERE loan_id=<L1>` still shows PENDING_APPROVAL.

**3-H4. The home lab's Head sees the request and approves it.** Role: UAT LabHead CITe4D One. Database: `adric_uat_check` (writes the decision).
- Custody tab: LOAN-<L1> is listed with the badge "Pending", borrower UAT Custodian One, the destination lab and the purpose. The bell (Requests tab) has a red "Pending Approval" card "Equipment Loan Request" with Approve Loan and Decline.
- On the Custody tab click Approve. Expect: the badge becomes "Pending release" (green), "Loans pending" drops by one and "Loans approved" rises by one, and the timeline shows the approval step done and "Handed Over" still waiting. After a page reload the bell card is gone.
- Lab Inventory tab: open A1. It still says Available and offers only Asset History (approval does not hand the asset over).
- Database: `SELECT status, decided_by_id, decided_at FROM asset_loans WHERE loan_id=<L1>` shows PENDING_RELEASE, this Head's user id and a time; `SELECT status FROM assets WHERE asset_tag='<A1>'` shows AVAILABLE.

**3-H5. The Lab Head's office account cannot borrow.** Role: UAT LabHead CITe4D One (stay logged in). Database: `adric_uat_check` (writes nothing).
- Console, with A2 (a different, Available asset):
```js
fetch("http://localhost:4000/api/auth/me",{credentials:"include"}).then(r=>r.json()).then(m=>fetch("http://localhost:4000/api/assets/<A2>/loans",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({destinationCenterId:m.user.headOf.centerId,returnBy:"2030-01-01",purpose:"Office account"})})).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "Use your personal account to borrow."}`.
- Database: `SELECT COUNT(*) FROM asset_loans l JOIN assets a ON a.asset_id=l.asset_id WHERE a.asset_tag='<A2>'` shows the same number as before the command.

**3-H6. TSG releases the loan (console): the asset is On Loan with the borrower as holder, and the Accountability Form data comes back.** Role: UAT Staff One. Database: `adric_uat_check` (writes the release, one inspection, one activity row).
- The bell has a red card "Loan Ready for Release: <A1 name>" with the tag "Waiting for Release". There is no release screen in this batch (Joel builds it), so release from the console:
```js
fetch("http://localhost:4000/api/loans/<L1>/release",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({inspection:{condition:"OPERATIONAL",remarks:"Batch 3 release"}})}).then(r=>r.json()).then(console.log)
```
- Expect it to print `success: true` and a `loan` with `status: "ON_LOAN"`, `statusLabel: "On Loan"`, `releasedBy` named "UAT Staff One", `releasedAt` set, and `releaseInspection` with `type: "LOAN_RELEASE"`, `condition: "OPERATIONAL"`.
- Inventory: A1 shows On Loan, custodian UAT Custodian One, Current Location the lab you picked in 3-H1 and `Room 301`.
- Accountability Form data:
```js
fetch("http://localhost:4000/api/loans/<L1>/accountability-form",{credentials:"include"}).then(r=>r.json()).then(console.log)
```
- Expect `success: true`, `loan.status: "ON_LOAN"`, `asset.tag` = A1, `borrower` with `name: "UAT Custodian One"`, an `idNumber`, an `email` and `labs`, and `releaseInspection` with `typeLabel: "Loan Release"` by UAT Staff One. Write down `borrower.userId` as **U1**.
- Clearance record while the asset is out:
```js
fetch("http://localhost:4000/api/users/<U1>/clearance-record",{method:"POST",credentials:"include"}).then(r=>r.json()).then(console.log)
```
- Expect `success: true`, `cleared: false`, and `loans` holding LOAN-<L1> as On Loan.
- Database: `SELECT status, released_by_id, released_at FROM asset_loans WHERE loan_id=<L1>` shows ON_LOAN, this TSG's user id and a time; `SELECT status FROM assets WHERE asset_tag='<A1>'` shows ON_LOAN; `SELECT i.type, i.condition FROM asset_inspections i JOIN assets a ON a.asset_id=i.asset_id WHERE a.asset_tag='<A1>' ORDER BY i.inspection_id DESC LIMIT 1` shows LOAN_RELEASE and OPERATIONAL; `SELECT event_type, details FROM activity_log ORDER BY log_id DESC LIMIT 1` shows CLEARANCE_RECORD_PRINTED with `details` empty.

**3-H7. The Accountability Form is closed to someone who is not the borrower, the home Head or TSG.** Role: UAT LabHead CITe4D Two. Database: `adric_uat_check` (writes nothing).
- Console: the same Accountability Form command as 3-H6.
- Expect `{success: false, error: "Only the borrower, the Head of the asset's lab, and TSG can see this Accountability Form."}` and no email or ID number anywhere in the answer.

**3-H8. The Researcher asks to return; TSG sees it in another browser (proof it is on the server).** Roles: UAT Custodian One, then UAT Staff One in **another browser or a private window**. Database: `adric_uat_check` (writes the return request).
- UAT Custodian One: My Assets, open A1, Return Asset. Expect no "Return Date" field. Type the comments `Batch 3 return`, click Submit Return Request. Expect "Return Initiated". Open Return Asset again and submit: the form stays open with a red "The return request was not sent: Loan <L1> is Return Requested, so a return cannot be requested."
- In DevTools, Application, Local Storage, the `http://localhost:5173` entry has no new `ems_returns` entry from this request (old screens used it; nothing reads or writes it now).
- UAT Staff One, in the other browser: Pending Returns lists A1 first, with Custodian UAT Custodian One, Return By = the date from 3-H1 and the comments `"Batch 3 return"`. Any rows after it with the grey "Not asked yet" mark are loans still On Loan (walk-ins TSG may receive). System Overview: "Pending Returns" counts only the asked-for returns, so it is one more than before. The bell has a "Return Request" card.
- Database: `SELECT status, return_requested_at, remarks FROM asset_loans WHERE loan_id=<L1>` shows RETURN_REQUESTED, a time, and `Batch 3 return`; `SELECT status FROM assets WHERE asset_tag='<A1>'` still shows ON_LOAN.

**3-H9. TSG records the return: Available, back home.** Role: UAT Staff One. Database: `adric_uat_check` (writes the return and one inspection).
- Pending Returns, click Evaluate & Finalize on A1. The blue box shows the turn-in comments. Pick Operational, click Finalize Return and Close Ledger. Expect "Return Ledger Closed" with the reference `LOAN-<L1>`.
- Inventory: A1 is Available, custodian None, Current Location back to its home lab (and home room, if it has one). Pending Returns no longer lists A1.
- Clearance record (the 3-H6 command with U1): expect `cleared: true`, and `loans` still lists LOAN-<L1>, now Returned.
- Database: `SELECT status, received_by_id, closed_at FROM asset_loans WHERE loan_id=<L1>` shows RETURNED, this TSG's user id and a time; `SELECT i.type FROM asset_inspections i JOIN assets a ON a.asset_id=i.asset_id WHERE a.asset_tag='<A1>' ORDER BY i.inspection_id DESC LIMIT 2` shows RETURN then LOAN_RELEASE.

**3-H10. A second loan: Decline asks for a reason, then the Head approves it.** Roles: UAT Custodian One, then UAT LabHead CITe4D One. Database: `adric_uat_check` (writes a second loan and its approval).
- UAT Custodian One: request A2 as in 3-H1, with Return By **2 days from today** and purpose `Batch 3 check two`. Write the new loan id down as **L2**.
- UAT LabHead CITe4D One: Custody tab, LOAN-<L2>, click Decline. A box "Reason for declining" opens and "Send decline" stays disabled until you type. Type a reason, then click Cancel (do not send it). The loan is still Pending.
- Console (declining with no reason is refused):
```js
fetch("http://localhost:4000/api/loans/<L2>/decline",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({decisionRemarks:""})}).then(r=>r.json()).then(console.log)
```
- Expect `{success: false, error: "Write the reason for declining."}`.
- Open the bell: the "Equipment Loan Request" card for A2 has Approve Loan and Decline. Click Decline there: the same reason box shows. Cancel it, then click Approve Loan. The card leaves the bell.
- Database: `SELECT status FROM asset_loans WHERE loan_id=<L2>` shows PENDING_RELEASE.

**3-H11. The bell by person: due soon, overdue, and nobody sees another person's.** Roles: UAT Staff One (console release), then UAT Custodian One, UAT LabHead CITe4D Two, UAT Staff One. Database: `adric_uat_check` (writes the release; **one UPDATE**, on `adric_uat_check` only).
- UAT Staff One, console: the Accountability Form command for L2 first. Expect `{success: false, error: "This loan has not been released yet."}`. Then release L2 with the 3-H6 release command (use `<L2>`). Expect `success: true` and `status: "ON_LOAN"`.
- UAT Custodian One: the bell, Reminders tab, shows a card "Return Reminder: <A2 name>" saying the device is due on the date you set (2 days from today). Its red count is one more.
- UAT LabHead CITe4D Two: the bell shows no card about A2. UAT Staff One: no due-soon card about A2 either (TSG see only waiting releases and returns). UAT LabHead CITe4D One: no card about A2 any more.
- Make the loan overdue (PowerShell, this one writes, to `adric_uat_check` only): `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "UPDATE asset_loans SET return_by = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE loan_id=<L2>"`. Reload as UAT Custodian One: the Reminders tab now shows "Overdue Equipment Return: <A2 name>" with "WARNING: This device was due on <yesterday>".
- Database: `SELECT status, released_at FROM asset_loans WHERE loan_id=<L2>` shows ON_LOAN and a time.

**3-H12. A return with damage: Maintenance and a ticket on the Repairs board.** Role: UAT Staff One. Database: `adric_uat_check` (writes the return, an inspection, a maintenance ticket).
- Console (it takes the first issue type from the lookups and receives L2 with a damaged condition):
```js
fetch("http://localhost:4000/api/lookups").then(r=>r.json()).then(l=>fetch("http://localhost:4000/api/loans/<L2>/receive",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({inspection:{condition:"DEGRADED",remarks:"Cracked screen"},returnDamage:{issueTypeId:l.issueTypes[0].issueTypeId,issueDescription:"Cracked screen found on return"}})})).then(r=>r.json()).then(console.log)
```
- Expect `success: true`, a `loan` with `status: "RETURNED"` and `closedAt` set, and a `maintenance` object with an `id` like `MNT-<number>`, `assetId` = A2's tag, `statusLabel: "Inspection Phase"` and the description.
- Inventory: A2 shows Maintenance (not Available), at the TSG Office. Repairs: a new ticket for A2 with the description, status "Inspection Phase".
- Nearby: a normal receive still works (3-H9). A second receive of L2 (run the command again) answers `{success: false, error: "Loan <L2> is Returned, so it cannot be received."}` (409) and adds no second ticket.
- Database: `SELECT status FROM assets WHERE asset_tag='<A2>'` shows MAINTENANCE; `SELECT m.type, m.status FROM asset_maintenance m JOIN assets a ON a.asset_id=m.asset_id WHERE a.asset_tag='<A2>' ORDER BY m.maintenance_id DESC LIMIT 1` shows RETURN_DAMAGE and INSPECTING; `SELECT status FROM asset_loans WHERE loan_id=<L2>` shows RETURNED.

**3-H13. The old routes answer 404, and the server terminal is clean.** Role: any logged-in account. Database: `adric_uat_check` (reads nothing).
- Console:
```js
Promise.all([["POST","/api/assets/<A1>/borrow"],["PUT","/api/loans/<L1>/decision"],["POST","/api/assets/<A1>/return"]].map(([m,p])=>fetch("http://localhost:4000"+p,{method:m,credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>r.status))).then(console.log)
```
- Expect `[404, 404, 404]`.
- Look at the terminal where the server runs, across all the checks above. Expect short plain lines with ids only, for example `Loan 41 requested by user 12`, `Loan 41 approved by user 6`, `Loan 41 released by user 3`, `Loan 41 return requested by user 12`, `Loan 41 received by user 3`, `Loan 42 received by user 3, with maintenance 77`, and `Clearance record of user 12 printed by user 3`. No emoji, no email address, no request body, no password.

**3-H14. Nearby behavior still works.** Database: `adric_uat_check` (reads only).
- UAT Staff One: Asset Inventory, Repairs, Inspections and System Overview load with no red error.
- UAT Director: Overview and Analytics load with the campus and lab numbers.
- UAT LabHead CITe4D One: the Analytics tab loads. In its loan list, A1 and A2 show the destination lab you picked (no "Destination Lab:" text packed into the purpose).
- UAT Custodian One: My Assets loads; the bell opens and shows no Clearance Holds tab.
