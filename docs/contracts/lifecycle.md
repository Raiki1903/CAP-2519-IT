# Asset lifecycle and API contract (batches 2 to 8)

For Joel and Aryan, to build screens with mock data before the server parts exist. Written in Batch 1 (`feat/batch-1-foundation`). The source of truth for the rules is the Batch 1 brief, `docs/tasks/batch-1-foundation.md`; this file says the same in screen terms.

Every endpoint below is marked **live (Batch 1)** (it exists when Batch 1 merges) or **planned (Batch N)** (it does not exist yet; build against mock data shaped exactly like this). If a planned endpoint needs to differ when it is built, that batch updates this file first.

**Batch 1 built (2026-11-03):** the data model below (one migration adds it, a second drops `asset_records`, `asset_monetary`, `asset_returns`, `asset_transfers`, `asset_maintenance.is_immediate`, and `projects.funding_agency`); the lifecycle guard, the status setter, and the derive helpers on the server; the constants in `shared/`; the permission rules of section 6 on every live route; the session with every lab; and the live endpoints marked below. **Removed in Batch 1:** transfers (every route and screen), `GET /api/asset_returns`, `GET /api/lookups/users` (the custodian picker), and `GET /api/assets/:assetTag/custodian-history` (replaced by `/history`).

**Batch 2b built (2026-11-04):** sign-ups are `users` rows with status Pending (no more `pending_registrations.json`); the IT Admin approves or rejects them on its own view (`/it-admin`, app role "ITAdmin"); login answers by account status, writes LOGIN_SUCCESS and LOGIN_FAILURE rows, and stops after 5 failed tries (429). The endpoints marked "live (Batch 2b)" in 7.1 and 7.7 exist. **Removed in Batch 2b:** `GET /api/auth/pending-registrations`, `POST /api/auth/approve-registration`, `POST /api/auth/reject-registration`, and the Lab Head's "Account Approvals" tab. Where Batch 2b's brief and an earlier line here differed, this file now says what Batch 2b built.

**Batch 3 built (2026-11-05):** the loan chain on the server. The endpoints marked "live (Batch 3)" in 7.3 and 7.10 exist: request, cancel, approve, decline, release (a Loan Release inspection), return request, receive (a Return inspection, and a Return Damage ticket when TSG found damage), the loan lists, the Accountability Form data, the clearance record, and `GET /api/notifications/mine`. Every loan step locks the asset first, so two requests, an approve and a cancel, two releases or two receives at once give one winner and one 409. The guard gained approve, release, ask-to-return and receive. **Removed in Batch 3:** `POST /api/assets/:assetTag/borrow`, `PUT /api/loans/:loanId/decision` and `POST /api/assets/:assetTag/return` (they answer 404), and the browser-stored return requests. Today's loan screens use the new steps; the new loan screens are Joel's (#116).

**Batch 5 built (2026-11-05):** maintenance, disposal, Missing and Found, inspections, the routine queue, the benchmark data and four notification kinds on the server, with today's screens moved onto them. The endpoints marked "live (Batch 5)" in 7.4, 7.5, 7.6 and 7.10 exist. Every step locks the asset first, so two reports, a receive and a cancel, or two disposal decisions at once give one winner and one 409. The guard gained `WORK_ON_MAINTENANCE` and `SELF_REPORT_INSPECTION`. **Removed in Batch 5:** `PUT /api/maintenance/:maintenanceId` and `PUT /api/maintenance/:maintenanceId/status` (the free-form update routes, H-06; they answer 404), the 8-second repeat check on repairs (#65), the `repairs` and `disposals` keys in the ticket and disposal lists (they answer `tickets` and `retirements` only), the packed disposal text, and the old inspection body (`reportCondition`, `reportRemarks`, `reportImg`) with the `report` key in its answer. No schema change. Where the brief and an earlier line here differed, this file now says what Batch 5 built.

---

## 1. Data model

**Each fact is stored once.** Anything that can be worked out from stored facts is worked out by the server, never stored a second time and never computed by a screen. The one deliberate exception is the asset's status, which is stored because every list and every rule filters on it.

### What is stored

| Fact | Where it lives |
|---|---|
| Asset status (one of six, section 3) | `assets.status`. Changed only by the server's status setter, in the same step that causes it |
| Home lab, and through it the campus | `assets.center_id`, pointing at `research_centers` (`short_code`, `name`, `location` = campus) |
| Home room (for example G406) | `assets.home_room`, optional |
| Owning project | `assets.project_id`, optional |
| Funding | `assets.funding_source_id` (a row of `funding_sources`) and `assets.acquisition_value` |
| Accessories, ITS property tag, TSG tag | `assets.accessories`, `assets.its_property_tag`, `assets.tsg_tag` |
| Each loan, maintenance ticket, retirement and inspection | Its own row in `asset_loans`, `asset_maintenance`, `asset_retirements`, `asset_inspections` |
| Steps that have no table of their own (registered, edited, deleted, marked missing, found, clearance record printed) | `activity_log` |
| Which labs a person belongs to (one or more) | `user_centers` |
| Who heads a lab (at most one per lab, one lab per person) | `research_centers.head_user_id` |

### What is worked out

| Value | Rule |
|---|---|
| Holder (who has it now) | The borrower of the asset's open loan (status On Loan or Return Requested). Otherwise nobody |
| Current location | Open loan: its destination lab and room. In maintenance and received by TSG: "TSG Office". Missing or Retired: none. Otherwise: the home lab and room |
| Condition now | The newest inspection done by TSG (any type except Self Report). A borrower's Self Report never changes it |
| Overdue | The asset has an open loan whose return-by date has passed. The status stays On Loan; overdue is a separate flag |
| Cleared | The person has no loan in Pending Release, On Loan or Return Requested |
| History of an asset | The asset's loan, inspection, maintenance and retirement rows, plus its `activity_log` rows, in time order |

### The fields screens receive

Every asset in an answer carries these, worked out on the server:

| Field | Type | Example | Notes |
|---|---|---|---|
| `status` | string | `"ON_LOAN"` | One of the six values in section 3 |
| `statusLabel` | string | `"On Loan"` | Show this, never a label of your own |
| `homeLab` | object | `{ "centerId": 1, "code": "CITe4D", "name": "...", "campus": "MANILA", "campusLabel": "Manila" }` | From `center_id`, never from the tag or a location text |
| `homeRoom` | string or null | `"G406"` | |
| `currentLocation` | string or null | `"CAR, V302"`, `"CITe4D"`, `"TSG Office"` | `"<lab short code>, <room>"` or `"<lab short code>"`; never the campus; null when Missing or Retired |
| `holder` | object or null | `{ "userId": 12, "name": "First Last" }` | null when nobody holds it. A Researcher gets `{ "hidden": true }` instead of another person's name and id |
| `condition` | string or null | `"OPERATIONAL"` | null when TSG has never inspected it |
| `conditionLabel` | string or null | `"Operational"` | |
| `healthScore` | number or null | `80` | From the newest TSG inspection |
| `isOverdue` | boolean | `false` | |
| `openLoan` | object or null | `{ "loanId": 41, "status": "ON_LOAN", "returnBy": "2026-11-20" }` | The loan in Pending Approval, Pending Release, On Loan or Return Requested, if any |

`GET /api/assets` sends the fields above. Since Batch 1, `status` and `condition` hold the stored keys (before, they held display text and a 0 to 100 score). Next to them it still sends the older fields today's screens read: `id` (the tag), `serial`, `funding` (the name, or "Unspecified"), `cost`, `procured`, `warranty`, `location` (the campus label), `lab` (the home lab's code), `assetCondition`, `custodian`, `custodianId`, `custodianHidden`, `borrowedOn`, `dueDate`, `daysLeft`, `disposalId`, `disposalDetails`, `image`, `image_url`, `description`, `remarks`, and `asset_reports`. New screens read only the fields above.

---

## 2. Locations

- **Home** is stored on the asset: the home lab (`homeLab`, which also gives the campus) and an optional home room (`homeRoom`). TSG and the Secretary change it through Edit Asset.
- **Current location** is worked out (section 1): the open loan's destination lab and room, or "TSG Office" while TSG holds it for maintenance, or home. Missing and Retired assets have none.
- **A return always brings the asset back to its home lab and room.** There is no "return to somewhere else".
- A loan's destination lab is picked from **the borrower's own labs** (the session's `labs`, section 9). The room is optional free text.
- Campus labels are Manila, Laguna and McKinley. A screen gets a lab's campus from the lab (`GET /api/lookups` or the asset's `homeLab`), never from its own list.

---

## 3. Asset statuses

| Status | Label | Meaning |
|---|---|---|
| `AVAILABLE` | Available | At home and free to borrow. A loan waiting for approval or release keeps it Available, but no second request can be made |
| `ON_LOAN` | On Loan | Released to a borrower (their loan is On Loan or Return Requested) |
| `MAINTENANCE` | Maintenance | Received by TSG for inspection or repair |
| `PENDING_RETIREMENT` | Pending Retirement | A retirement was requested; waiting for the decision or for the disposal to be done |
| `RETIRED` | Retired | Disposed. Nothing more happens to it |
| `MISSING` | Missing | Cannot be found. It can be found again or retired |

### Which actions each status allows (the lifecycle guard)

The server checks this table before every step. A refused step answers **409** with a plain message. Screens may use the same table to hide buttons, but the server decides.

| Action | Available | On Loan | Maintenance | Pending Retirement | Retired | Missing |
|---|---|---|---|---|---|---|
| Request a loan | yes (1) | no | no | no | no | no |
| Approve a loan | yes | no | no | no | no | no |
| Release a loan to the borrower | yes | no | no | no | no | no |
| Ask to return | no | yes | no | no | no | no |
| Receive a return | no | yes | no | no | no | no |
| Report an issue (open a maintenance ticket) | yes | yes | no | no | no | no |
| Receive for maintenance | yes | yes (2) | no | no | no | no |
| Request retirement | yes | no | yes (3) | no | no | yes |
| Decide retirement (approve or deny) | no | no | no | yes | no | no |
| Complete retirement | no | no | no | yes (4) | no | no |
| Mark missing | yes | yes (5) | no | no | no | no |
| Mark found | no | no | no | no | no | yes |
| Edit master data | yes | yes | yes | no | no | yes |
| Routine inspection | yes | no | no | no | no | no |
| Work on a maintenance ticket (start, stage, complete, cancel while Inspecting) | no | no | yes | no | no | no |
| Self Report (the holder's inspection) | no | yes | no | no | no | no |

1. Refused while the asset has a loan in Pending Approval or Pending Release. This is the only action a waiting loan blocks (see below).
2. Receiving ends the open loan (Ended by Maintenance) in the same step.
3. After maintenance ends Beyond Repair.
4. Only once the retirement is Approved. Completing it sets the asset to Retired.
5. Marking missing ends the open loan (Ended by Loss) in the same step.

Decline and cancel do not check the asset's status, so a loan on an asset that went to Maintenance can still be declined or cancelled. Approve and release need the asset Available: approving does not take the asset, it stays Available until release.

**Waiting loans (Batch 5, decided).** A loan still in Pending Approval or Pending Release is **left as it is** when its asset goes to Maintenance, Missing or Pending Retirement, and when the asset ends Retired. A waiting loan does not block a maintenance ticket, marking the asset missing, or a retirement request; it blocks only a second loan request. The guard then refuses approve and release on the changed asset with its own sentence, and the Lab Head can still decline the loan and the borrower can still cancel it. Nothing closes a waiting loan by itself.

---

## 4. Process statuses and moves

Each move names who makes it and what happens to the asset. Any move not listed is refused with **409**.

### Loan (`asset_loans.status`)

| Status | Label |
|---|---|
| `PENDING_APPROVAL` | Pending Approval |
| `PENDING_RELEASE` | Pending Release |
| `DECLINED` | Declined |
| `CANCELLED` | Cancelled |
| `ON_LOAN` | On Loan |
| `RETURN_REQUESTED` | Return Requested |
| `RETURNED` | Returned |
| `ENDED_BY_MAINTENANCE` | Ended by Maintenance |
| `ENDED_BY_LOSS` | Ended by Loss |

| From | To | Who | Asset |
|---|---|---|---|
| (new) | Pending Approval | The borrower | stays Available |
| Pending Approval | Pending Release | The Head of the asset's home lab (approve) | stays Available |
| Pending Approval | Declined | The Head of the asset's home lab (decline, remarks required) | stays Available |
| Pending Approval or Pending Release | Cancelled | The borrower | stays Available |
| Pending Release | On Loan | TSG (release, with a Loan Release inspection) | On Loan |
| On Loan | Return Requested | The borrower | stays On Loan |
| On Loan or Return Requested | Returned | TSG (receive, with a Return inspection) | Available, back at home |
| On Loan or Return Requested | Ended by Maintenance | TSG receives the asset for maintenance | Maintenance |
| On Loan or Return Requested | Ended by Loss | TSG marks the asset missing | Missing |

- Declined, Cancelled, Returned, Ended by Maintenance and Ended by Loss are final. `closedAt` is set when a loan reaches one of them.
- The return-by date is the one the borrower asks for; approval keeps it as is.
- When the asset's lab has no Head, approve and decline answer **409** "This lab has no Lab Head yet. Ask the IT Admin to set one."
- If the Return inspection finds damage, TSG can open a Return Damage maintenance ticket in the same step; the asset then goes to Maintenance instead of Available.

### Maintenance (`asset_maintenance.status`)

| Status | Label |
|---|---|
| `PENDING_RECEIPT` | Pending Receipt |
| `INSPECTING` | Inspecting |
| `REPAIRING` | Repairing |
| `EXTERNAL_SERVICE` | External Service |
| `RESOLVED` | Resolved |
| `BEYOND_REPAIR` | Beyond Repair |
| `CANCELLED` | Cancelled |

Ticket types: `BORROWER_REPORT` (Borrower Report), `TSG_MAINTENANCE` (TSG Maintenance), `RETURN_DAMAGE` (Return Damage).

| From | To | Who | Asset |
|---|---|---|---|
| (new) | Pending Receipt | The holder, the home lab's Head, or TSG (report an issue, with an issue type) | unchanged |
| Pending Receipt | Inspecting | TSG (receive, with a Maintenance inspection) | Maintenance; an open loan ends (Ended by Maintenance) |
| Inspecting | Repairing or External Service | TSG (start) | stays Maintenance |
| Repairing | External Service, or back | TSG (stage change) | stays Maintenance |
| Inspecting, Repairing or External Service | Resolved | TSG (complete, with a Maintenance inspection) | Available |
| Inspecting, Repairing or External Service | Beyond Repair | TSG (complete, with a Maintenance inspection) | stays Maintenance until a retirement is requested |
| Pending Receipt | Cancelled | The reporter or TSG | unchanged |
| Inspecting | Cancelled | TSG | Available |

- **Under warranty** is worked out: the asset's warranty expiry is on or after the day TSG received it. An asset under warranty goes to External Service (the warranty holder) unless TSG writes a warranty override reason.
- External Service names the `provider` (the warranty holder or a repair shop). The stage change may also carry `warrantyOverrideReason`, so a warranty asset sent to External Service first can still come back to Repairing.
- Cancelling also sets `completedBy` and `completedAt`, because no other column holds who cancelled and when; the asset history reads "Maintenance cancelled by".
- One open ticket per asset (Pending Receipt, Inspecting, Repairing or External Service). A held loan stays with the holder until TSG receives the asset.
- A ticket a TSG person files is type TSG Maintenance; a holder's or a Lab Head's is Borrower Report; the Return Damage ticket comes from the loan receive step (7.3).

### Retirement (`asset_retirements.status`, page title "Asset Disposal")

| Status | Label |
|---|---|
| `PENDING` | Pending |
| `APPROVED` | Approved |
| `DENIED` | Denied |
| `COMPLETED` | Completed |

| From | To | Who | Asset |
|---|---|---|---|
| (new) | Pending | TSG (request, with a reason) | Pending Retirement; the status before is kept as `previousStatus` |
| Pending | Approved | The Director or the Secretary, never the person who requested it | stays Pending Retirement |
| Pending | Denied | The Director or the Secretary, never the requester (remarks required) | back to `previousStatus` |
| Approved | Completed | TSG (pathway and disposition reference) | Retired |

Pathways: `DONATE` (Donate), `RECYCLE` (Recycle), `RETURN_TO_FUNDER` (Return to Funder), `SELL` (Sell), `OTHER` (Other).

- A request from Maintenance is allowed only when the asset's newest ticket ended Beyond Repair and no ticket is open. One open disposal (Pending or Approved) per asset.
- The requester never decides their own request (403), even when they are a Secretary or Director. The pathway, when TSG knows it at the request, is kept in its own column and can be set again at completion.

### Missing and Found

| From | To | Who | Notes |
|---|---|---|---|
| Available or On Loan | Missing | TSG (mark missing, with a reason) | An open loan ends (Ended by Loss). Logged as ASSET_MARKED_MISSING |
| Missing | Available | TSG (mark found, with a Recovery inspection) | Logged as ASSET_FOUND |
| Missing | Pending Retirement | TSG (request retirement) | As in the retirement table |

### Sign-up and account (`users.account_status`)

| Status | Label |
|---|---|
| `PENDING` | Pending |
| `ACTIVE` | Active |
| `INACTIVE` | Inactive |
| `REJECTED` | Rejected |

| From | To | Who |
|---|---|---|
| (new) | Pending | The applicant (sign-up) |
| Pending | Active | The IT Admin (approve, with one role and the person's labs: at least one for a Researcher, zero or more for the other roles) |
| Pending | Rejected | The IT Admin (reject) |
| Active | Inactive | The IT Admin (deactivate) |
| Inactive | Active | The IT Admin (reactivate) |

- Only an Active account can log in or act. A Pending, Rejected or Inactive account gets **403** on every action, with "This account is not active. Contact the IT Admin.".
- At login the 403 message depends on the status, and is shown only once the password matched, so it tells a stranger nothing: Pending "Your sign-up is waiting for IT Admin approval."; Rejected "Your sign-up was not approved. Contact the IT Admin."; Inactive "This account is not active. Contact the IT Admin.".
- A sign-up is an account from the start: its email and ID number are taken at once, whatever its status. A Rejected account keeps them, so the same person cannot sign up again (**409** "An account with this email or ID number already exists. Ask the IT Admin.") until the IT Admin anonymizes it (module 6).
- Only the IT Admin makes the role and lab choice. There is no Lab Head role: heading a lab is set on the lab (module 6).
- Anonymize (IT Admin), for an Inactive or Rejected account. Each field becomes:

  | Field | Becomes |
  |---|---|
  | Name | "Former researcher" (first name "Former", last name "researcher") |
  | Email | `anonymized-<userId>@invalid` |
  | ID number | empty (NULL) |
  | Password | cleared, so the account can never log in again |
  | `anonymizedAt` | the time of the step |

  The history is kept: the person's loans, inspections, tickets and log rows stay, under "Former researcher". The step writes a USER_ANONYMIZED row in the activity log.

### Ticket (`user_tickets.status`)

| Status | Label |
|---|---|
| `OPEN` | Open |
| `IN_PROGRESS` | In Progress |
| `RESOLVED` | Resolved |
| `REJECTED` | Rejected |

Types: `BUG` (Bug), `ACCOUNT_ACCESS` (Account Access), `QUESTION` (Question), `OTHER` (Other).

There is no ticket form on the login page: `user_tickets.created_by_id` is a required account, and an open form invites spam. The login page says "Can't log in? Contact the IT Admin."

| From | To | Who |
|---|---|---|
| (new) | Open | Any Active account (a ticket always needs a login) |
| Open | In Progress, Resolved or Rejected | The IT Admin |
| In Progress | Resolved or Rejected | The IT Admin (resolution remarks required) |

### Inspection types (`asset_inspections.type`)

`INITIAL` (Initial, at registration), `LOAN_RELEASE` (Loan Release), `RETURN` (Return), `MAINTENANCE` (Maintenance), `RECOVERY` (Recovery, when found), `ROUTINE` (Routine), `RETIREMENT` (Retirement assessment), `SELF_REPORT` (Self Report, by the holder). Every type except Self Report is done by TSG.

An inspection carries: `condition` (Perfect, Operational, Minor Drift, Degraded, Critical Defect), an optional `healthScore` (0 to 100; the form suggests Perfect 100, Operational 80, Minor Drift 60, Degraded 40, Critical Defect 20), `missingAccessories` (empty means nothing missing), `remarks`, an optional `photo`, and the metric values for the asset's category (section 8).

---

## 5. Clearance

- **A person is cleared** when they have no loan in Pending Release, On Loan or Return Requested.
- **The clearance record** (manuscript OUT5) is a printable page for one person: each of their loans with its release and return verification (who released it and when, who received it back and when, the condition at each), and then either "No unreturned equipment" or the list of open loans.
- TSG prints it. Each print writes a CLEARANCE_RECORD_PRINTED row in the activity log.
- Endpoint: section 7.3, live (Batch 3). Older loans handed over before the release step existed (moved to On Loan by the Batch 1 migration, with no `releasedAt`) count by their status.

---

## 6. Who may do what

| Role (view) | May |
|---|---|
| TSG | Register assets, edit master data, and every physical step: release, receive, inspect, maintenance, mark missing and found, request and complete retirements, print clearance records |
| Secretary (AdRIC Secretary) | Edit asset master data only, and decide retirements. Registration and every physical step answer 403 |
| Director | Decide retirements; read analytics and reports |
| Lab Head (the account that heads a lab) | Approve and decline loans for assets whose home lab it heads; report an issue on its lab's assets. It does not borrow: a loan request answers 403 "Use your personal account to borrow." |
| Researcher | Request, cancel and ask to return their own loans; report an issue on an asset they hold; file a Self Report |
| IT Admin | Accounts, labs, Heads, tickets and the activity log. **No asset actions:** every asset step answers 403 |

- A Lab Head is not a separate role: the role is Researcher, and heading a lab (`research_centers.head_user_id`) gives the Lab Head view. Heading a lab wins over Researcher when the server picks the view.
- **The Lab Head account is an office account** for the lab's Head position, like the practicum coordinator's account. It is handed over when the Head changes. The person who holds the position borrows with their own personal account; the office account cannot request loans (403 "Use your personal account to borrow.").
- When the Head changes, the office account is **not** deactivated or anonymized. Only its password changes.
- "Approved by" and "Declined by" show the office account, not the person behind it.
- Known limit (for the manuscript): when a Head borrows an asset of their own lab with their personal account, the approval comes from the office account they also hold.
- The app's internal role key for a Researcher is still `"Custodian"` (the screens under `/custodian`); the label shown is "Researcher".
- The IT Admin has its own view since Batch 2b: app role `"ITAdmin"` (label "IT Admin"), the screens under `/it-admin`, landing on Approvals. A Researcher, Staff, Director or Lab Head opening `/it-admin/*` sees No Access, and so does the IT Admin opening another view's URL. The Secretary still lands on the Staff view until Batch 6.
- The read-only lists (`GET /api/assets`, `/history`, `/api/loans`, `/api/maintenance`) stay open to any Active account on the server, as in section 7.2. The IT Admin's screens do not load them, and the notification bell is hidden for the IT Admin.
- A Researcher never sees another person's name or id on an asset or loan (`holder: { "hidden": true }`).

---

## 7. Endpoints

**Shapes used in every answer**

- Success: `{ "success": true, ...fields }`. Failure: `{ "success": false, "error": "<plain message>" }`. Show `error` as is.
- Dates are `yyyy-mm-dd`; date-times are ISO 8601 (`2026-11-20T09:30:00.000Z`).
- Every endpoint needs a login except login, sign-up and `GET /api/lookups`. Without one: **401**.
- The acting person always comes from the session, never from the body.

**Errors** (each endpoint lists the ones it adds):
- **400** the body is missing a field or has a wrong value.
- **401** not logged in.
- **403** the role, the account status (Pending, Inactive), or the lab does not allow it.
- **404** no such asset, loan, ticket or person.
- **409** the asset's status or the process's status does not allow this move, or another open request is in the way.
- **429** login only: 5 failed logins for one email from one address within 15 minutes.

**Common objects**

`Asset`: the fields in section 1, plus `assetId`, `tag`, `name`, `serialNumber`, `manufacturer`, `category`, `categoryLabel`, `project` (`{ projectId, code, name }` or null), `fundingSource` (`{ fundingSourceId, name }` or null), `acquisitionValue`, `procurementDate`, `warrantyExpiry`, `accessories`, `itsPropertyTag`, `tsgTag`, `imageUrl`.

`Inspection`: `{ inspectionId, type, typeLabel, inspectedBy: { userId, name }, inspectedAt, condition, conditionLabel, healthScore, missingAccessories, remarks, photo, metrics: [{ metricId, metricKey, name, unit, value, flagged }] }`.

`InspectionInput` (a body part): `{ condition, healthScore?, missingAccessories?, remarks?, photo?, metrics?: [{ metricId, value }] }`.

`Loan`: `{ loanId, asset: { assetId, tag, name }, borrower: { userId, name }, status, statusLabel, purpose, project, destinationLab: { centerId, code }, destinationRoom, returnBy, requestedAt, decidedBy, decidedAt, decisionRemarks, releasedBy, releasedAt, releaseInspection, returnRequestedAt, receivedBy, returnInspection, closedAt, remarks, isOverdue }`. People are `{ userId, name }`, `{ hidden: true }` (a Researcher looking at a person who is not them), or null.

`Maintenance`: `{ maintenanceId, asset: { assetId, tag, name, warrantyExpiry }, type, typeLabel, status, statusLabel, issueType: { issueTypeId, key, name, suggestedAction } or null, issueDescription, reportedBy, reportedAt, receivedBy, receivedAt, underWarranty, warrantyOverrideReason, provider, completedBy, completedAt, resolutionRemarks, triggerInspection, completionInspection }`. `issueType` is null only for a ticket filed before issue types existed. `completedBy` and `completedAt` hold who cancelled and when, when the status is Cancelled. `underWarranty` before receipt means the warranty expiry is on or after today.

`Retirement`: `{ retirementId, asset, status, statusLabel, reason, pathway, pathwayLabel, previousStatus, previousStatusLabel, requestedBy, requestedAt, decidedBy, decidedAt, decisionRemarks, completedBy, completedAt, dispositionReference, assessmentInspection }`.

`User`: `{ userId, firstName, lastName, email, idNumber, userType, role, roleLabel, accountStatus, labs: [{ centerId, code }], headOf: { centerId, code } or null }`. Sent only to the IT Admin and to the person themself. `role` is a database role key, or null for a Pending sign-up; for a Pending sign-up, `labs` are the labs it asked for.

`Ticket`: `{ ticketId, createdBy, type, typeLabel, title, description, status, statusLabel, resolutionRemarks, resolvedBy, resolvedAt, createdAt, updatedAt }`.

`ActivityEntry`: `{ logId, eventType, eventLabel, actor, targetUser, asset: { assetId, tag } or null, details, createdAt }`.

### 7.1 Session and lookups

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Log in | `POST /api/auth/login` | anyone | `{ email, password }` | `{ role, user: SessionUser }` | 401 wrong email or password; 403 account Pending, Rejected or Inactive (a message for each status, section 4); 429 "Too many failed logins. Try again in 15 minutes." | live (Batch 1); status messages, login log and 429 live (Batch 2b) |
| Who am I | `GET /api/auth/me` | logged in | | `{ user: SessionUser }` | 404 account gone | live (Batch 1) |
| Form option lists | `GET /api/lookups` | anyone | | `{ labs: [{ centerId, code, name, campus, campusLabel, headUserId }], categories: [{ key, label }], fundingSources: [{ fundingSourceId, name }], issueTypes: [{ issueTypeId, key, name, suggestedAction }], metricsByCategory: { "<CATEGORY>": [{ metricId, metricKey, name, unit, higherIsBetter }] }, projects: [{ projectId, code, name, centerId }] }`. A category with no metrics is left out of `metricsByCategory` | | live (Batch 1) |

**The failed-login limit (Batch 2b).** The key is the lowercased email plus the client's address. A failed login (wrong password, or an email with no account) counts toward it, and the 5th within 15 minutes blocks the key for 15 minutes. The block is checked before the password is verified, so a blocked key costs no hashing, and the 429 is the same whether or not the email has an account. A successful login clears the key. A 403 for a status is not a failed login: it neither counts nor clears. The count is kept in the server's memory, so a restart clears it. Behind nginx the address is the forwarded one (the server trusts only a proxy on the same machine).

`SessionUser`: `{ userId, firstName, lastName, email, idNumber, role, roleLabel, staffUnit, accountStatus, labs: [{ centerId, code, name, campus }], headOf: { centerId, code } or null, userImg }`. `labs` lists every lab the person belongs to; there is no "first" or default lab, and a person with no lab gets `[]`. `idNumber` is the person's own (never anyone else's), so the loan request form can prefill the name, ID number and labs.

### 7.2 Assets

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Asset list and search | `GET /api/assets` | logged in | `?q=&status=&centerId=` optional. `q` matches part of the tag, serial number or name, in any letter case (the fallback when a QR code will not scan, CAP1DEF 1) | `{ assets: Asset[] }` | | live (Batch 1) |
| One asset's history | `GET /api/assets/:assetTag/history` | logged in | | `{ events: [{ at, kind, label, actor, details, loanId?, maintenanceId?, retirementId?, inspectionId? }] }`, oldest first | 404 | live (Batch 1) |
| Register an asset | `POST /api/assets` | TSG | `{ name, serialNumber?, manufacturer?, category, centerId, homeRoom?, projectId?, fundingSourceId?, acquisitionValue?, procurementDate?, warrantyExpiry?, accessories?, itsPropertyTag?, tsgTag?, imageUrl?, initialInspection: InspectionInput }` | `{ asset: Asset }` with the new tag `<lab>-<next number>` | 400; 403 | live (Batch 1) |
| Edit master data | `PUT /api/assets/:assetTag` | TSG, Secretary | any of the register fields except `initialInspection` | `{ asset: Asset }` | 400 the body has `status`, `holder`, `location` or `condition`; 403; 404; 409 Pending Retirement or Retired | live (Batch 1) |
| Delete a mistaken registration | `DELETE /api/assets/:assetTag` | TSG | | `{ deleted: "<tag>" }` | 403; 404; 409 the asset has a loan, maintenance, retirement, or an inspection besides its initial one | live (Batch 1) |

Registration writes the Initial inspection and an ASSET_REGISTERED log row; an edit that changes something writes an ASSET_EDITED row naming the changed fields (`details`, for example "Changed: name, home_room"); a delete writes ASSET_DELETED with the tag. All three answer with the asset in the list's shape.

### 7.3 Loans

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Request a loan | `POST /api/assets/:assetTag/loans` | Researcher with at least one lab, whose account heads no lab | `{ destinationCenterId, destinationRoom?, projectId?, returnBy, purpose }`; `destinationCenterId` must be one of the borrower's labs | `{ loan: Loan }` (201) | 400 (no lab picked or a lab that is not theirs, return-by before today, no purpose); 403 Staff or IT Admin; 403 "Use your personal account to borrow." when the account heads a lab; 404; 409 asset not Available or already has a waiting loan; 409 the lab has no Head | live (Batch 3) |
| Cancel my request | `PUT /api/loans/:loanId/cancel` | the borrower | | `{ loan: Loan }` | 403 not theirs; 404; 409 not Pending Approval or Pending Release | live (Batch 3) |
| Approve | `PUT /api/loans/:loanId/approve` | Head of the asset's home lab | `{ decisionRemarks? }` | `{ loan: Loan }` | 403 not the Head of that lab; 404; 409 not Pending Approval; 409 the lab has no Head | live (Batch 3) |
| Decline | `PUT /api/loans/:loanId/decline` | Head of the asset's home lab | `{ decisionRemarks }` | `{ loan: Loan }` | 400 no remarks; 403; 404; 409 | live (Batch 3) |
| Release to the borrower | `PUT /api/loans/:loanId/release` | TSG | `{ inspection: InspectionInput }` | `{ loan: Loan }` | 400; 403; 404; 409 not Pending Release | live (Batch 3) |
| Ask to return | `PUT /api/loans/:loanId/return-request` | the borrower | `{ remarks? }` | `{ loan: Loan }` | 403; 404; 409 not On Loan | live (Batch 3) |
| Receive the return | `PUT /api/loans/:loanId/receive` | TSG | `{ inspection: InspectionInput, returnDamage?: { issueTypeId, issueDescription } }`; TSG's notes go in `inspection.remarks`, there is no top-level `remarks` | `{ loan: Loan, maintenance?: Maintenance }` | 400 (also an unknown issue type, or no description for the damage); 403; 404; 409 not On Loan or Return Requested | live (Batch 3) |
| Loan list (old shape) | `GET /api/loans` | logged in; a Researcher sees names only on their own loans | | `{ loans: [...] }`, today's row shape: `destinationLab` from `destination_center_id`, `purpose` as stored | | live (Batch 1), renamed from `/api/asset_loans`. **With no query it still sends every loan to every caller (M-02)**; it goes when Joel's loan screens move to the lists below |
| Loans by status (TSG Releases and Returns tabs) | `GET /api/loans?status=` | TSG | `?status=PENDING_RELEASE`, `?status=RETURN_REQUESTED`, or several separated by commas | `{ loans: Loan[] }` in the new shape, oldest request first | 400 unknown status; 403 | live (Batch 3) |
| My loans | `GET /api/loans/mine` | logged in | `?status=` optional | `{ loans: Loan[] }` | | live (Batch 3) |
| My lab's requests | `GET /api/loans/lab-requests` | a Lab Head | `?status=` optional | `{ loans: Loan[] }` for assets of the lab they head | 403 heads no lab | live (Batch 3) |
| Accountability Form data | `GET /api/loans/:loanId/accountability-form` | the borrower, the Head of the home lab, TSG | | `{ loan: Loan, asset: Asset, borrower: { userId, name, idNumber, email, labs }, releaseInspection: Inspection or null }`; `releaseInspection` is null only for a loan handed over before the release step existed; the email goes only to the people who may open this | 403; 404; 409 "This loan has not been released yet." | live (Batch 3) |
| Clearance record | `POST /api/users/:userId/clearance-record` | TSG | | `{ person: { userId, name, idNumber, labs }, cleared, loans: Loan[] }`: the person's loans that were released or still wait in Pending Release, newest first; a loan cancelled after approval is left out, nothing was handed over; writes CLEARANCE_RECORD_PRINTED | 403; 404 | live (Batch 3) |

Notes on the Batch 3 endpoints:

- Request lets a Researcher and a Lab Head account through the route, so that an account that heads a lab is told "Use your personal account to borrow." instead of a bare role refusal. Cancel and ask-to-return are for a Researcher who heads no lab; a borrower who later heads a lab can no longer cancel or ask to return their own loan, and TSG can still receive it as a walk-in.
- Approve and decline: the Head of the asset's home lab only; another lab's Head gets 403 and the loan is unchanged. A decision on a loan that is not Pending Approval answers 409, not 400. Remarks are limited to 2000 characters, as are the purpose and a damage description; a return request's remarks to 255.
- Receive works on On Loan too, so TSG can take back an asset whose borrower never asked (a walk-in). With `returnDamage` the asset goes to Maintenance and the answer carries `maintenance`, the new Return Damage ticket in the maintenance list's row shape.
- `GET /api/loans/mine` and `/lab-requests` take `?status=` as well; `/lab-requests` is the server's scoping of a Lab Head's requests (M-02) and answers 403 "You do not head a lab." to any other account.
- A Researcher sees `{ hidden: true }` for every person on a loan that is not theirs.

### 7.4 Maintenance

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Report an issue ("Request Immediate Inspection") | `POST /api/assets/:assetTag/maintenance` | the holder, the home lab's Head, TSG | `{ issueTypeId, issueDescription }`; the description is required, at most 2,000 characters | `{ maintenance: Maintenance }` (201; type Borrower Report, or TSG Maintenance when TSG files it) | 400 (also an unknown issue type); 403 a Researcher who does not hold the asset ("Only the person who holds this asset can report an issue on it."), or a Lab Head of another lab ("This asset belongs to another lab. Only that lab's Head can report an issue on it."), or the IT Admin or Secretary; 404; 409 the status does not allow it, or the asset already has an open ticket. The asset and its loan do not change | live (Batch 5) |
| Receive the asset | `PUT /api/maintenance/:maintenanceId/receive` | TSG | `{ inspection: InspectionInput }` (a Maintenance inspection) | `{ maintenance: Maintenance }` | 400; 403; 404; 409 not Pending Receipt. The asset becomes Maintenance, and a held loan ends (Ended by Maintenance) in the same step | live (Batch 5) |
| Start the work | `PUT /api/maintenance/:maintenanceId/start` | TSG | `{ stage: "REPAIRING" or "EXTERNAL_SERVICE", provider?, warrantyOverrideReason? }` | `{ maintenance: Maintenance }` | 400 under warranty, stage Repairing, no override reason ("This asset is under warranty. Send it to the warranty holder, or write why TSG repairs it."); 400 External Service with no provider; 403; 404; 409 not Inspecting | live (Batch 5) |
| Change stage | `PUT /api/maintenance/:maintenanceId/stage` | TSG | `{ stage, provider?, warrantyOverrideReason? }` | `{ maintenance: Maintenance }` | 400 (same rules as start); 403; 404; 409 not Repairing or External Service, or already in that stage | live (Batch 5) |
| Complete | `PUT /api/maintenance/:maintenanceId/complete` | TSG | `{ outcome: "RESOLVED" or "BEYOND_REPAIR", resolutionRemarks, inspection: InspectionInput }` | `{ maintenance: Maintenance }` | 400 (no remarks, no inspection, no outcome); 403; 404; 409 not Inspecting, Repairing or External Service. Resolved makes the asset Available at home; Beyond Repair keeps it in Maintenance | live (Batch 5) |
| Cancel | `PUT /api/maintenance/:maintenanceId/cancel` | the reporter (Pending Receipt only), TSG | `{ remarks? }` (kept as the ticket's resolution remarks) | `{ maintenance: Maintenance }` | 403 ("Only the person who reported this issue, or TSG, can cancel it."; the reporter on an Inspecting ticket gets "Only TSG can cancel a ticket once the asset is received."); 404; 409 not Pending Receipt or Inspecting. From Inspecting the asset becomes Available | live (Batch 5) |
| Ticket list | `GET /api/maintenance` | TSG, Director, Secretary; a Lab Head sees their lab; a Researcher sees their own | `?status=&type=` optional, one or several values separated by commas | `{ tickets: Maintenance[] }`, newest first | 400 an unknown status or type; 403 the IT Admin | live (Batch 1), renamed from `/api/asset_repairs`; the Maintenance shape and the role scoping from Batch 5 |

- **Report checks who first, then the asset's status.** A Researcher who does not hold a Retired asset gets 403; TSG on the same asset gets 409.
- **History labels.** The asset history reads "Maintenance cancelled by" for a cancelled ticket and "Maintenance completed (<outcome>) by" for a finished one.
- **Waiting loans.** Receiving an asset for maintenance leaves a loan in Pending Approval or Pending Release as it is (section 3).

### 7.5 Retirement, Missing and Found

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Request retirement | `POST /api/assets/:assetTag/retirement` | TSG | `{ reason, pathway?, assessmentInspection?: InspectionInput }`; the reason is required, at most 2,000 characters | `{ retirement: Retirement }` (201) | 400; 403; 404; 409 the asset's status does not allow it (an On Loan asset cannot be disposed of), it is in Maintenance and not Beyond Repair or has an open ticket ("Finish the maintenance ticket first. Only an asset found beyond repair can be disposed of from Maintenance."), or a disposal is already open | live (Batch 5) |
| Decide | `PUT /api/retirements/:retirementId/decision` | Director, Secretary; never the requester | `{ decision: "approve" or "deny", decisionRemarks? }` (remarks required to deny) | `{ retirement: Retirement }` | 400; 403 ("You requested this disposal, so someone else must decide it."); 404; 409 not Pending. Approve leaves the asset Pending Retirement; deny gives it its previous status back | live (Batch 5) |
| Complete | `PUT /api/retirements/:retirementId/complete` | TSG | `{ pathway, dispositionReference }`; the reference is at most 255 characters | `{ retirement: Retirement }` | 400; 403; 404; 409 not Approved. The asset becomes Retired | live (Batch 5) |
| Retirement list | `GET /api/retirements` | TSG, Director, Secretary, Lab Head (only their lab's) | `?status=` optional, one or several values separated by commas | `{ retirements: Retirement[] }`, newest first | 400 an unknown status; 403 | live (Batch 1), renamed from `/api/asset_disposals`; the Retirement shape and the Lab Head scoping from Batch 5 |
| Mark missing | `PUT /api/assets/:assetTag/missing` | TSG | `{ reason }`; required, at most 255 characters, kept in the activity log | `{ asset: Asset }` | 400; 403; 404; 409 not Available or On Loan. A held loan ends (Ended by Loss) and a ticket still in Pending Receipt is cancelled ("Asset marked missing.") in the same step | live (Batch 5) |
| Mark found | `PUT /api/assets/:assetTag/found` | TSG | `{ inspection: InspectionInput, remarks? }`; the inspection is a Recovery inspection | `{ asset: Asset }` | 400; 403; 404; 409 not Missing. The asset becomes Available at home; the old loan stays closed | live (Batch 5) |

Missing and Found send no email. A disposal request emails the Director and the Secretary; the decision emails the requester (approved: TSG completes it; denied: with the remarks). Subjects carry ids only, and every value in a body is escaped.

### 7.6 Inspections and benchmarks

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| File an inspection | `POST /api/assets/:assetTag/inspection` | TSG (Routine); the holder (Self Report) | `InspectionInput`; the remarks are at most 255 characters | `{ inspection: Inspection }` | 400 (a missing or unknown condition, a score outside 0 to 100, a metric that does not belong to the asset's category, remarks over 255 characters); 403 a Researcher who does not hold the asset ("Only the person who holds this asset can send a self report on it."); 404; 409 the status does not allow it | live (Batch 5) |
| Inspection list | `GET /api/inspections` | TSG, Director | `?assetTag=&type=` optional | `{ inspections: Inspection[] }` | | live (Batch 1) as `{ reports }` in today's field names, with `/api/inspections/log` beside it (L-07); this row is the target shape |
| Routine queue | `GET /api/inspections/routine-queue` | TSG | `?days=&centerId=` optional; `days` is a whole number from 1 to 3650, default 90 (the screen offers 30, 90 and 180) | `{ groups: [{ group, name, labs: [code], assets: [{ asset: Asset, lastTsgInspectionAt }] }] }`: the five groups A, B, C, D and Other, always all five, each with its assets oldest inspection first | 400 `days` or `centerId` is not a whole number in range; 403 | live (Batch 5) |
| Benchmark data | `GET /api/assets/:assetTag/benchmarks` | TSG, Director, the home lab's Head | | `{ metrics: [{ metricId, metricKey, name, unit, higherIsBetter, points: [{ inspectionId, inspectedAt, value, flagged }] }], healthScores: [{ inspectionId, inspectedAt, healthScore, flagged }] }` | 403 (the Head of another lab gets "This asset belongs to another lab. Only that lab's Head can see its benchmark data."); 404 | live (Batch 5), no screen yet |

- **Filing.** TSG files a Routine inspection, on an Available asset only; it sets the asset's condition. Anyone else files a Self Report: they must hold the asset (an On Loan or Return Requested loan of theirs) and the asset must be On Loan. The holder is checked before the status, so a person who does not hold the asset gets 403 on any status. A Self Report never changes the asset's condition. The reporter is always the session user. The body has `condition` and the other `InspectionInput` fields; any other field is ignored. The answer is the new `Inspection` only.
- **Routine queue.** It lists Available assets whose newest TSG inspection is older than `days`, or that TSG never inspected (those come first, then oldest, then by asset id). A Self Report does not count. On Loan, Maintenance, Pending Retirement, Retired and Missing assets are never in it. The groups come from `INSPECTION_LAB_GROUPS` (`shared/constants/inspectionGroups.ts`); `labs` of a lab group are its lab short codes, and for Other they are the codes of the labs its assets belong to. `name` is the group's display name ("Group A").
- **Benchmark data.** `metrics` lists each metric of the asset's category by metric id, and any metric recorded before a category change, with every value TSG recorded, oldest first. A value is `flagged` by its rule in `METRIC_FLAG_RULES` (`shared/constants/metricFlagRules.ts`) against the asset's first recorded value of that metric, the same baseline the Inspection shape uses. `healthScores` lists every TSG health score, oldest first; a score is `flagged` when it is below `HEALTH_SCORE_FLAG_BELOW`, only for a category that has no metrics. Self Reports are left out, as they are from the condition. Reads only.

### 7.7 Sign-up, users and activity log

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Sign up | `POST /api/auth/register-request` | anyone | `{ firstName, lastName, email, idNumber, userType, password, centerIds: [] }`: an `@dlsu.edu.ph` email (stored in lower case), an 8-digit ID number not starting with 0, `userType` STUDENT, FACULTY or STAFF, a password of 8 to 128 characters, and at least one lab that exists | 201 `{ message }`: a Pending account with no role, linked to the labs asked for | 400 a missing or wrong field, or an unknown lab; 409 email or ID number taken (by an account of any status) | live (Batch 2b) |
| Pending sign-ups | `GET /api/users?status=PENDING` | IT Admin | | `{ users: User[] }`, oldest first (by user id: an account has no sign-up date yet), each with the labs it asked for | 400 any other query ("Only status=PENDING is available for now."); 403 | live (Batch 2b) |
| Approve a sign-up | `PUT /api/users/:userId/approve` | IT Admin | `{ role, centerIds: [] }`: `role` is one of RESEARCHER, TSG_STAFF, ADRIC_DIRECTOR, ADRIC_SECRETARY, IT_ADMIN; **at least one lab for a Researcher, zero or more for the other roles** (the IT Admin, Director and Secretary usually have none) | `{ user: User }`, Active, with the one role and `centerIds` as its labs | 400 bad role, a Researcher with no lab, or an unknown lab; 403; 404; 409 not Pending | live (Batch 2b) |
| Reject a sign-up | `PUT /api/users/:userId/reject` | IT Admin | `{ remarks? }`: trimmed, at most 255 characters | `{ user: User }`, Rejected, with no labs | 400 remarks too long; 403; 404; 409 not Pending | live (Batch 2b) |
| Users list | `GET /api/users` | IT Admin | `?status=&role=&centerId=&q=` | `{ users: User[] }` | 403 | planned (module 6); until then only `?status=PENDING` answers |
| Change role | `PUT /api/users/:userId/role` | IT Admin | `{ role }` | `{ user: User }` | 400; 403; 404 | planned (module 6) |
| Change labs | `PUT /api/users/:userId/labs` | IT Admin | `{ centerIds: [] }` | `{ user: User }` | 400; 403; 404; 409 removes the lab they head | planned (module 6) |
| Change a lab's Head | `PUT /api/research-centers/:centerId/head` | IT Admin | `{ userId }` or `{ userId: null }` | `{ lab: { centerId, code, headUserId } }` | 400 the person is not in that lab; 403; 404; 409 they already head another lab | planned (module 6) |
| Deactivate | `PUT /api/users/:userId/deactivate` | IT Admin | | `{ user: User }` | 403; 404; 409 not Active, or heads a lab | planned (module 6) |
| Reactivate | `PUT /api/users/:userId/reactivate` | IT Admin | | `{ user: User }` | 403; 404; 409 not Inactive | planned (module 6) |
| Anonymize | `PUT /api/users/:userId/anonymize` | IT Admin | | `{ user: User }` | 403; 404; 409 not Inactive or Rejected, or not cleared | planned (module 6) |
| Activity log | `GET /api/activity-log` | IT Admin | `?eventType=&actorId=&targetUserId=&assetTag=&from=&to=&page=` | `{ entries: ActivityEntry[], page, pageCount }` | 403 | planned (module 6) |

Approve and reject lock the account row, so two decisions at once give one 200 and one 409. Each writes one activity row, with the IT Admin as actor and the account as target: SIGNUP_APPROVED (details `Role: <key>; labs: <codes, or none>`) and SIGNUP_REJECTED (details: the remarks). Each login on an existing account writes one row too: LOGIN_SUCCESS (actor: the account), or LOGIN_FAILURE (no actor, the account as target, details one of "Wrong password", "Account pending", "Account rejected", "Account inactive"). A failed login for an email with no account writes nothing.

Activity events: LOGIN_SUCCESS, LOGIN_FAILURE, SIGNUP_APPROVED, SIGNUP_REJECTED, ROLE_CHANGED, LABS_CHANGED, HEAD_CHANGED, USER_DEACTIVATED, USER_REACTIVATED, USER_ANONYMIZED, TICKET_STATUS_CHANGED, ASSET_REGISTERED, ASSET_EDITED (details list the changed field names), ASSET_DELETED, ASSET_MARKED_MISSING, ASSET_FOUND, CLEARANCE_RECORD_PRINTED. A log row never holds an email, a typed login name, or a password.

### 7.8 Tickets

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Create a ticket | `POST /api/tickets` | any Active account | `{ type, title, description }` | `{ ticket: Ticket }` | 400 | planned (module 6) |
| My tickets | `GET /api/tickets/mine` | logged in | | `{ tickets: Ticket[] }` | | planned (module 6) |
| All tickets | `GET /api/tickets` | IT Admin | `?status=&type=` | `{ tickets: Ticket[] }` | 403 | planned (module 6) |
| Change status | `PUT /api/tickets/:ticketId/status` | IT Admin | `{ status, resolutionRemarks? }` (required for Resolved and Rejected) | `{ ticket: Ticket }` | 400; 403; 404; 409 not a listed move | planned (module 6) |

### 7.9 Analytics

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| Dashboard snapshot | `GET /api/analytics/snapshot` | Director, Secretary, TSG; a Lab Head gets their lab only | `?centerId=&campus=` optional | `{ total, byStatus: [{ status, label, count }], byCondition: [{ condition, label, count }], byHomeLab: [{ centerId, code, count }], byCampus: [{ campus, label, count }], byCategory: [{ category, label, count }], byProject: [{ projectId, code, name, count }] }`. Assets TSG never inspected count under `condition: null`; assets with no project under `projectId: null` | 403 | planned (analytics batch) |
| Insights | `GET /api/analytics/insights` | TSG Staff, Secretary, Director; a Lab Head gets their own lab only | `?view=operational`, `strategic` or `all` (default `all`); `?centerId=` optional (a Lab Head may send only their own lab) | `{ success, asOfDate, scope: { type: "lab" or "all", centerId, code }, summary: { high, medium, planning }, insights: [{ id, ruleId, view, priority, assetTag, assetName, labCode, title, issue, preferredAction, evidence: [{ label, value }], alternatives: [{ rank, text }], chartKey }] }`. There is no `data` wrapper. Sorted HIGH, MEDIUM, PLANNING, then the most urgent number, then `id` | 400 unknown `centerId` (Staff, Director), `centerId` not a whole number, `view` not offered; 403 Researcher, IT Admin, a Lab Head asking for another lab | live (analytics batch) |
| Loans per week | `GET /api/analytics/utilization` | TSG Staff, Secretary, Director; a Lab Head gets their own lab only | `?weeks=` 1 to 52 (default 12); `?centerId=` optional (a Lab Head may send only their own lab) | `{ success, asOfDate, weekCount, scope: { type: "lab" or "all", centerId, code }, total: Series, labs: [{ centerId, code, ...Series }] }` where `Series` is `{ weeks: [{ weekStart, loansOut, loansReleased }], averageLoanDays, busiestWeeks: [weekStart] }`. There is no `data` wrapper. `total` adds every lab in scope together and is what the chart draws; `labs` has the same figures per home lab and leaves out a lab with no loan in the weeks shown | 400 `weeks` not a whole number from 1 to 52, unknown `centerId` (Staff, Director), `centerId` not a whole number; 403 Researcher, IT Admin, a Lab Head asking for another lab | live (analytics batch) |
| Inventory Report | `GET /api/analytics/inventory-report` | Director, Secretary, TSG | `?centerId=&status=&campus=&fundingSourceId=&acquiredFrom=&acquiredTo=` (today's filters kept; the acquisition dates filter the procurement date, `yyyy-mm-dd`) | `{ rows: [{ tag, name, category, homeLab, campus, homeRoom, status, condition, holder, acquisitionValue, fundingSource, procurementDate, warrantyExpiry }], totals: { count, acquisitionValue } }`; the screen makes the CSV | 403 | planned (analytics batch) |

Insights are short, read-only advice notes worked out on each request from assets, loans, tickets and inspections. Nothing is stored and nothing is written. `asOfDate` is today from `serverToday()` (the server's local day, `TZ=Asia/Manila` in deployment); the route never reads it from the query. A lab is limited by the asset's home lab (`assets.center_id`), never by its tag. Retired assets are skipped. A DATE column (warranty, purchase, return-by) is compared as its stored day, a DateTime column (ticket, inspection) as the local day. The five rules:

- **WAR-01** (Operational): `warranty_expiry` is 0 to 90 days away. HIGH within 30 days, else MEDIUM.
- **LOAN-02** (Operational): a loan On Loan or Return Requested is more than 7 days past `return_by`. HIGH over 14 days, else MEDIUM.
- **REP-03** (Operational): 3 or more tickets of any type, not Cancelled, reported in the last 180 days. HIGH if one is still open or the condition now is Critical Defect, else MEDIUM.
- **LIFE-04** (Strategic, PLANNING): whole months since purchase reach the category's review point: Monitor 60, Router 60, Dev Kit 48. Demo values, a review point and not policy. Other categories never fire.
- **COND-05** (Operational): the two newest TSG inspections (every type but Self Report) are on different days and the newest condition is worse. HIGH if it is Critical Defect, else MEDIUM.

The screen shows the text it receives and does not work out a note itself.

Loans per week (CAP1DEF 8) is worked out on each request from the loans that were handed over (`released_at` set). A loan counts for the home lab of its asset (`assets.center_id`), never its destination lab. Days are the server's local days and a week runs Monday to Sunday; the last week is this one.

- **Loans out** (`loansOut`): the loans whose days from `released_at` to `closed_at`, or to today for a loan still open, touch any day of the week.
- **Loans released** (`loansReleased`): the loans whose `released_at` falls in the week.
- **Average loan length** (`averageLoanDays`): over the loans closed within the weeks shown, the whole days from the release day to the closing day, to one decimal. A loan still open is not in it. `null` when there is none.
- **Busiest weeks** (`busiestWeeks`): up to three Mondays with the most loans out, busiest first, the newer week first on a tie. Empty when no loan was out in any week.
- **The Inventory Report's `holder` is a person's name.** That is why the report is for the Director, the Secretary and TSG only.

### 7.10 Notifications

| Meaning | Method and path | Who | Body or query | Answer | Errors | Mark |
|---|---|---|---|---|---|---|
| My notifications | `GET /api/notifications/mine` | logged in | | `{ notifications: [{ kind, label, loanId?, maintenanceId?, retirementId?, statusLabel?, assetTag?, centerId?, date? }] }` | | live (Batch 3); `STATUS_CHECK_DUE`, `RECEIPT_WAITING`, `DISPOSAL_DECISION_WAITING` and `MAINTENANCE_OPEN` and the three new fields live (Batch 5) |

Worked out on each call from loans, tickets, disposals and inspections; there is no notifications table. Each person gets only the kinds that apply to them:

| Kind | For | When |
|---|---|---|
| `LOAN_AWAITING_APPROVAL` | the account that heads the asset's home lab | a loan on its lab's asset is Pending Approval |
| `RELEASE_WAITING` | TSG | a loan is Pending Release |
| `RETURN_WAITING` | TSG | a loan is Return Requested |
| `LOAN_DUE_SOON` | the borrower | their On Loan or Return Requested loan's return-by date is today or within the next 3 days |
| `LOAN_OVERDUE` | the borrower | their On Loan or Return Requested loan's return-by date has passed |
| `STATUS_CHECK_DUE` | the borrower | for each asset they hold (On Loan or Return Requested) whose newest inspection of any type is older than 90 days (`STATUS_CHECK_DAYS`), or that has none. Filing a Self Report clears it |
| `RECEIPT_WAITING` | TSG | a maintenance ticket is Pending Receipt (one per ticket) |
| `DISPOSAL_DECISION_WAITING` | the Director and the Secretary | a disposal is Pending and they did not request it (one per disposal) |
| `MAINTENANCE_OPEN` | the reporter, except TSG | an open ticket they reported, with `statusLabel` (one per ticket). TSG sees its own ticket as `RECEIPT_WAITING` and on the Repairs page, so it gets no second card |

- **`STATUS_CHECK_DUE` replaces the earlier plan** ("members of a lab when their lab's cycle starts"). The policy puts the periodic status update on the Responsible Person, and there is no stored cycle. An asset that was never inspected counts as due; its `date` is the newest inspection's day and is left out when there is none.
- **Fields.** `maintenanceId` goes with `RECEIPT_WAITING` and `MAINTENANCE_OPEN`, `retirementId` with `DISPOSAL_DECISION_WAITING`, `loanId` with the loan kinds and `STATUS_CHECK_DUE`, and `statusLabel` with `MAINTENANCE_OPEN`. `date` is the request date (awaiting approval, disposal decision), the approval date (release waiting), the return request date (return waiting), the return-by date (due soon, overdue), the newest inspection's date (status check), or the report date (receipt waiting, my ticket).

People are matched by user id, never by display name. This replaced the notification bell's name matching (#131): the bell's loan, return, due-soon and overdue cards come only from this endpoint. A Researcher's repair cards are the `MAINTENANCE_OPEN` kind (Batch 5).

---

## 8. Lookups each form uses

All from `GET /api/lookups` (section 7.1), never a list kept in a page.

| Form | Lists |
|---|---|
| Register Equipment, Edit Asset | `labs` (home lab), `categories`, `fundingSources`, `projects`, and `metricsByCategory` for the initial inspection |
| Loan request | The destination lab picker lists **only the borrower's own labs**: the session's `labs` (`GET /api/auth/me`), which come from the person's lab memberships. `projects` for the optional project |
| Report an issue | `issueTypes`, showing each one's `suggestedAction` |
| Any inspection | Conditions with their suggested health score; `metricsByCategory` for the asset's category. Categories with no metrics use the health score only |
| Retirement | Pathways (section 4) |
| Sign-up, approve sign-up, change labs, change Head | `labs` |
| Analytics and report filters | `labs` (with campus) |

Statuses, types, labels, page titles, flag rules, care guidelines and the health score suggestions are fixed lists in `shared/constants/`, added in Batch 1 (commit 5). Import them; do not copy them into a page.

Page titles: "Repair and Maintenance", "Asset Disposal", "Asset Loaning and Return", "Asset Information", "Reports and Analytics", "System Administration".

---

## 9. Screens never compute status

The server sends every status, label, holder, location, condition, overdue flag and cleared flag. A screen shows what it receives and sends the step the person asked for. It never works out a status from dates or other rows, never keeps its own list of labs, campuses or statuses, and never decides on its own whether a step is allowed: if the server refuses, show its `error`.
