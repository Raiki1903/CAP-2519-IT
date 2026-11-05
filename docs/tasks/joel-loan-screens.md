# Joel: loan screens on the Batch 3 server

**Owner:** Joel. **Reviewer:** Raiki. **Save as:** `docs/tasks/joel-loan-screens.md` (first commit of Part 1).
**Server:** Batch 3 (`feat/batch-3-loans`, merging Thu Nov 5 afternoon). Until it merges, use mock data shaped exactly like the types in `shared/types/loans.ts` on that branch (`git fetch origin feat/batch-3-loans`, then open the file with `git show origin/feat/batch-3-loans:shared/types/loans.ts`). After it merges, pull `main` and swap the mock for the functions in `web/api/loans.api.ts`.
**Rules:** `AGENTS.md` and `docs/guides/TEAMMATES-AI-GUIDE.md`. Screens never work out a status, holder, location or overdue. Show what the server sends, and when it refuses, show its `error` (use `readResult` from `web/api/client.ts`). Option lists come from `shared/` or `GET /api/lookups`, never typed into a page. No em dashes. Typecheck must not go above 25.

**Why the rush:** TSG's UAT is **Fri Nov 6**. Part 1 is what TSG tests, so it must be merged and deployed **Thu night**.

---

## Part 1: TSG screens (PR by Thu Nov 5, 9 pm)

Branch `feat/tsg-loan-screens` from `main`. PR title: `feat(loans): TSG Releases and Returns tabs and the Accountability Form`.

### 1.1 Staff page "Asset Loaning and Return" (TSG)

- New page `web/pages/staff/LoansPage.tsx`, title from `shared/constants/pageTitles.ts`.
- Sidebar (Staff view): this page replaces the current Returns item. After Batch 3 merges, delete `web/pages/staff/ReturnsPage.tsx` and its route in `web/app/routes.tsx`, and point the Overview "Pending Returns" card at the new page.
- Two tabs:
  - **Releases:** loans in Pending Release (`GET /api/loans?status=PENDING_RELEASE`), oldest first.
  - **Returns:** Return Requested loans first, then On Loan loans as walk-ins (`GET /api/loans?status=RETURN_REQUESTED,ON_LOAN`). Show a "Return requested" or "Walk-in" chip, and an "Overdue" chip when `isOverdue` is true.
- Each row: asset tag and name, borrower, destination lab and room, return-by, approved by. A search box filters by tag, serial or name.
- Only TSG loads this page (the Secretary is also on the Staff view and gets a 403 from these lists, so hide the item for her).

### 1.2 Release dialog

Opens from a Releases row.
1. Shows the loan: asset, borrower, destination lab and room, return-by, purpose, approved by and their remarks.
2. **Confirm the tag:** TSG types the tag (or scans it, if the existing QR scanner is easy to reuse). The Release button stays disabled until it matches the loan's tag. This is the manual fallback the panel asked for (CAP1DEF comment 1).
3. **Inspection:** condition, health score (prefilled with the condition's suggested score), missing accessories, remarks, and the metrics for the asset's category (`metricsByCategory` from lookups). Reuse the inspection step from `web/features/assets/IntakeWizard.tsx`. If you need it in two places, move it to `web/features/inspections/` as one shared component, in its own commit with no other change.
4. **Release** calls the release endpoint with `{ inspection }`. On success, close the dialog, refresh both tabs, and open the Accountability Form for that loan.

### 1.3 Returns dialog (receive)

Opens from a Returns row.
1. Shows the loan, plus the borrower's return remarks if any (`remarks`).
2. Confirm the tag, same as 1.2.
3. The same inspection fields as 1.2.
4. **"Damage found" switch.** When on: an issue type select (`issueTypes` from lookups, showing each one's suggested action) and a required description. It sends `returnDamage: { issueTypeId, issueDescription }`. The asset then goes to Maintenance and a ticket appears on the Repairs board.
5. **Receive** calls the receive endpoint with `{ inspection, returnDamage? }`. On success, refresh, and say where the asset went: "Back at <home lab>" or "Sent to Repairs".

### 1.4 Accountability Form print page

- One print route that the borrower, the home lab's Head and TSG can all open, outside the sidebar layout (check how `web/app/routes.tsx` is set up; ask Raiki if a shared route is unclear). Data: `GET /api/loans/:loanId/accountability-form`. A 403 or 409 shows the server's sentence.
- Layout follows Appendix 1 of Doc Joel's "CCS Equipment Monitoring Policies" v1.0:
  - **Accountability ID:** `AF-` plus the loan id padded to 5 digits (loan 18 is `AF-00018`).
  - **Asset Tag, Equipment Name, Model, Serial:** the form's `asset` (`manufacturer` stands in for Model; there is no model column).
  - **Responsible Person, Email:** the form's `borrower` (name, ID number, email, labs).
  - **Destination:** lab and room. **Purpose.**
  - **Clauses** (fixed text in the page, shown below; Macy confirms the wording with TSG on Friday).
  - **Release inspection:** condition, health score, missing accessories, remarks, released by.
  - **Signatures:** two blank lines, "Responsible Person" and "TSG", each with a date line.
  - **Date issued:** `releasedAt`. **Effective period:** `releasedAt` to `returnBy`.
- A **Print** button calls `window.print()`. Before printing, set `document.title` to `accountability_<asset-tag>_<lastname>_<YYYYMMDD>` (date issued), so "Save as PDF" suggests the policy's file name. Use a print stylesheet so the sidebar and buttons don't print.

**Clause text** (from the policy's own sections 3, 5, 9.4 and 10.2):
- **Care and use:** The Responsible Person keeps the equipment in good order, uses it only for the stated purpose and destination, and does not lend it to anyone else.
- **Damage and loss:** The Responsible Person reports any damage, fault or loss through the system as soon as it is found. Missing or damaged items may delay clearance until they are resolved under these terms.
- **Return and clearance:** The equipment and all accessories are returned to TSG on or before the return-by date. TSG inspects it on return and records the result. Clearance is issued within 5 business days of the return.
- **Periodic status:** While the equipment is out, the Responsible Person answers status checks (condition and location) at the end of each term or when TSG asks. Missing updates may affect clearance and borrowing privileges.

---

## Part 2: Lab Head and Researcher screens (PR by Sat Nov 7, noon; freeze is Sat 6 pm)

Branch `fix/116` (pull `main` into it first). PR title: `feat(loans): Lab Head Requests and My Loans (#116)`, with `Closes #116`.

### 2.1 Lab Head "Requests" (#116)

- Replaces today's Custody tab loan list. Data: `GET /api/loans/lab-requests` (only loans on assets of the lab this account heads).
- Tabs: **Requests** (Pending Approval, oldest first) and **Out on loan** (Pending Release, On Loan, Return Requested; Overdue chip from `isOverdue`).
- Each request: asset, borrower, destination lab and room, return-by, purpose. **Approve** (optional remarks) and **Decline** (remarks required). After either, refresh.
- Each "Out on loan" row has a link to its Accountability Form (once released).
- No transfers anywhere.

### 2.2 Researcher "My Loans"

- Data: `GET /api/loans/mine`. Tabs or sections by status: Waiting (Pending Approval, Pending Release), Out (On Loan, Return Requested), History (Returned, Declined, Cancelled).
- **Cancel** on Pending Approval and Pending Release. **Ask to return** on On Loan, with optional remarks (at most 255 characters). An Accountability Form link on released loans.
- Show "Overdue" from `isOverdue`. Never show other people.

### 2.3 Clearance print page (TSG, last; drop it first if time runs out)

- TSG picks a person (search by name or ID number), then calls `POST /api/users/:userId/clearance-record` (each call writes a log row, so call it only when TSG presses "Prepare clearance").
- Layout follows Appendix 4 (Return and Clearance Form): person, labs, each released loan (asset tag, return date, condition on return, missing accessories, TSG inspection remarks), and **Clearance issued: Yes** or **No** from `cleared`. File name `return_<asset-tag>_<lastname>_<YYYYMMDD>` for one loan, or `clearance_<lastname>_<YYYYMMDD>` for the whole record.

---

## Hand checks (write them in the task file; Raiki runs them on the local UAT copy)

Number them J-H1 onward. At least:
- TSG releases a loan: the tag must match, the Accountability Form opens with every field filled, and the asset shows On Loan with the borrower as holder.
- Printing to PDF suggests the file name from 1.4.
- TSG receives a requested return (asset Available) and a walk-in (asset Available).
- TSG receives with "Damage found": the asset goes to Maintenance and the ticket is on Repairs.
- A Researcher can't open another person's Accountability Form (the server's sentence shows).
- Part 2: the Head sees only their own lab's requests, decline needs remarks, and the Researcher's My Loans shows only their own loans.

## Report in the PR

What changed, typecheck and build results, screenshots of each tab and dialog, and the form's print preview.


---

## Hand Check Results (Local Demo Database)

### J-H0: Sidebar visibility for non-TSG Staff
- **Role:** AdRIC Secretary (`secretary@dlsu.edu.ph` / demo password)
- **Screen:** Navigation Sidebar
- **Action:** Sign in as Secretary. Observe the navigation menu.
- **Expected:** "Asset Loaning and Return" is hidden. Other staff routes remain accessible.
- **Result:** Pass. Navigation filters out loans item when `currentUser.staffUnit !== "TSG"`.

### J-H1: TSG releases a loan
- **Role:** TSG Staff (`tsg@dlsu.edu.ph` / demo password)
- **Screen:** Asset Loaning and Return (`/staff/loans`), Releases tab
- **Action:** Open Releases tab. Click "Release Equipment" on a Pending Release loan. Type a non-matching tag, verify button is disabled. Type exact asset tag. Adjust health score and remarks. Click "Confirm Release".
- **Expected:** Loan transitions to On Loan, item leaves Releases tab, Accountability Form opens in a new tab.
- **Result:** Pass. Handover inspection recorded and Accountability Form URL opened.

### J-H2: Print Accountability Form
- **Role:** TSG Staff or Borrower
- **Screen:** Accountability Form (`/loans/:loanId/accountability-form`)
- **Action:** Click "Print / Save PDF".
- **Expected:** Print preview opens with title `accountability_<tag>_<lastname>_<YYYYMMDD>`.
- **Result:** Pass. Clean print stylesheet without sidebars or app shell buttons.

### J-H3: TSG receives a return in good condition
- **Role:** TSG Staff (`tsg@dlsu.edu.ph` / demo password)
- **Screen:** Asset Loaning and Return (`/staff/loans`), Returns tab
- **Action:** Find a "Return Requested" loan. Click "Receive Return". Verify asset tag, submit inspection with damage switch OFF.
- **Expected:** Asset status returns to "Available". Loan marked completed.
- **Result:** Pass.

### J-H4: TSG receives return with damage found
- **Role:** TSG Staff (`tsg@dlsu.edu.ph` / demo password)
- **Screen:** Asset Loaning and Return (`/staff/loans`), Returns tab
- **Action:** Click "Receive Return". Toggle "Damage found during return" ON. Select issue type and enter description. Confirm return.
- **Expected:** Asset status transitions to "Maintenance" and a repair ticket appears on the Repairs board.
- **Result:** Pass.

### J-H5: Unauthorized access to Accountability Form
- **Role:** Researcher A (attempting to view Researcher B's loan)
- **Screen:** `/loans/:loanId/accountability-form`
- **Action:** Direct navigate to URL of a loan owned by another borrower.
- **Expected:** 403 Forbidden banner with server explanation.
- **Result:** Pass.

### J-H6: Overview card navigation
- **Role:** TSG Staff
- **Screen:** Overview (`/staff/overview`)
- **Action:** Click "Pending Returns" stat card.
- **Expected:** Navigates directly to `/staff/loans` with Returns tab selected.
- **Result:** Pass.

### J-H7: Lab Head requests scoped to lab
- **Role:** Lab Head (`labhead@dlsu.edu.ph` / demo password)
- **Screen:** Requests (`/lab-head/custody`)
- **Action:** View Requests tab. Inspect pending requests and out-on-loan items.
- **Expected:** Only assets belonging to the lab this account heads are displayed. No foreign lab assets appear.
- **Result:** Pass. Data loaded from `GET /api/loans/lab-requests`.

### J-H8: Lab Head decline requires remarks
- **Role:** Lab Head (`labhead@dlsu.edu.ph` / demo password)
- **Screen:** Requests (`/lab-head/custody`)
- **Action:** Click "Decline" on a pending request. Leave remarks empty and click "Confirm Decline". Verify validation error. Enter remarks and confirm.
- **Expected:** Empty remarks blocked with error message. Non-empty remarks successfully declines request.
- **Result:** Pass.

### J-H9: Researcher My Loans privacy
- **Role:** Researcher (`custodian@dlsu.edu.ph` / demo password)
- **Screen:** My Loans (`/custodian/myassets`)
- **Action:** Open "My Loans" from sidebar. Inspect Waiting, Out, and History tabs.
- **Expected:** Only loans where the logged-in user is the borrower are shown. Never shows loans of other users.
- **Result:** Pass. Data loaded from `GET /api/loans/mine`.

### J-H10: Researcher cancel and ask to return
- **Role:** Researcher (`custodian@dlsu.edu.ph` / demo password)
- **Screen:** My Loans (`/custodian/myassets`)
- **Action:** On a Waiting loan, click "Cancel Request" and confirm. On an Out loan, click "Ask to Return", enter remarks (under 255 chars), and submit.
- **Expected:** Waiting request cancelled and moves to History. Out loan updates status to "Return Requested".
- **Result:** Pass.

### J-H11: TSG prepares and prints clearance record
- **Role:** TSG Staff (`tsg@dlsu.edu.ph` / demo password)
- **Screen:** Asset Loaning and Return (`/staff/loans`), Clearance tab
- **Action:** Enter a researcher's user ID. Click "Prepare Clearance".
- **Expected:** Opens `/staff/clearance/:userId`. Shows borrower profile, clearance determination banner (Yes/No), and return inspection history. Printing suggests `clearance_<lastname>_<YYYYMMDD>`.
- **Result:** Pass.
