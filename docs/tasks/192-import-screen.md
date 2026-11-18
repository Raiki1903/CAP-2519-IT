# Joel: Import page for projects and assets (#192)

**Owner:** Joel. **Reviewer:** Raiki. **Save as:** `docs/tasks/192-import-screen.md` (first commit).
**Start now.** Your print reports PR (#198) and the import API (PR #193) are both merged on `main`.
**Agent:** your usual agent on its strongest model, high effort. Give it this file, `AGENTS.md` and `docs/contracts/import.md`. Work in stops: plan first, wait for "go", then build.
**Branch:** `feat/192-import-screen` from a fresh `main`: `git switch main`, `git pull`, `git switch -c feat/192-import-screen`, then `npm install` and `npm run prisma:generate` (main has new migrations since your last branch).
**Rules:** `AGENTS.md` and `docs/contracts/import.md`. Web only: no change in `server/`, `prisma/` or `package.json`. The screen never checks rows itself: it shows what the server answers. No new package. No em dashes. Typecheck stays at 19, build passes, tests stay at 1118.
**Due:** PR by **Thu Nov 19, 12 noon**. Go or no-go for the deploy: Thu 3 pm. If it misses, it waits until after the turnover.

---

## 1. API calls

`web/api/imports.api.ts`: `checkProjects(csv)`, `saveProjects(csv)`, `checkAssets(csv)`, `saveAssets(csv)`. Each POSTs `{ csv }` to its route (contract section 3) and returns the parsed answer, typed with `shared/types/imports.ts`. Use `readResult` from `web/api/client.ts` like the other files.

## 2. Page and navigation

- New page `web/pages/staff/ImportPage.tsx`, route `import` in the `/staff` tree (`web/app/routes.tsx`), sidebar item **"Import"** in the Staff list (`web/app/layouts/Sidebar.tsx`), icon `Upload` from lucide.
- Two tabs: **Projects** and **Assets**. TSG sees both. The Secretary sees Projects only (`currentUser?.staffUnit !== "TSG"` hides the Assets tab, like the Loans item). The server already refuses assets imports for the Secretary (403); the hidden tab just matches it.
- Page subtitle: "Load existing projects and equipment from a CSV file. Import projects first, then the assets that name them."

## 3. Each tab, top to bottom

1. **Template:** a "Download template" button that saves `projects-template.csv` or `assets-template.csv`: the header row only, built from `shared/constants/importColumns.ts`. Below it, a short table of the columns: name, required or not, what goes in it (copy the rule column of the contract).
2. **Allowed values** (from `useFormLookups()`): lab short codes, funding source names, categories and conditions (labels), and for assets the existing project codes. Small, collapsible. Categories now come from the server (Reference Data), so never use a hardcoded list.
3. **File:** a file input that takes `.csv` only, at most 1 MB (say so if bigger). Read it as text (`file.text()`).
4. **Check file:** calls the check route.
   - Errors: a table of Row, Column, Problem, from `errors`. Above it: "N problems found. Fix them in the file and choose it again."
   - No errors: "All N rows are ready." and a preview table of the first 50 rows from `preview` (for assets, show `expectedTag` first, labelled "Tag (expected)").
5. **Import N rows:** enabled only after a check with no errors, and only for the same file (choosing another file clears the check). Calls the save route.
   - 201: "N projects imported." or "N assets imported.", and a list of row and new tag (or project code). Then reload the shared lists (`refreshSharedLists()` from `useServerData()`), so Asset Inventory shows the new assets.
   - 400: show its `errors` the same way as the check (someone may have changed the data in between).
   - Any other error: the server's sentence.
6. While a request runs, disable the buttons and show "Checking..." or "Importing...".

## 4. Lookups after a projects import

Call `forgetFormLookups()` (already exported from `web/features/lookups/useLookups.ts`) after a successful projects import, so Register Asset and Edit Asset show the new projects without a reload.

## Hand checks (write them in the task file; Raiki runs them)

- **J-I1.** TSG sees Import with two tabs; the Secretary sees Projects only; other roles have no Import item, and `/staff/import` is not reachable for them.
  - **Database:** Local demo database (`AdRIC_DB_dev`).
  - **Roles:** TSG Staff, AdRIC Secretary, Researcher, Lab Head, AdRIC Director, IT Admin.
  - **Screen:** Sidebar and Import (`/staff/import`).
  - **Steps:**
    1. Log in as TSG Staff and click **Import** in the sidebar. Verify both **Projects** and **Assets** tabs appear.
    2. Log out, log in as AdRIC Secretary, and click **Import** in the sidebar. Verify only the **Projects** tab appears (no **Assets** tab).
    3. Log out, log in as Researcher (or Director / IT Admin), verify there is no **Import** item in the sidebar, and navigate to `/staff/import` in the address bar. Verify the no-access screen is shown instead of the Import page.
- **J-I2.** The downloaded templates open in Excel with the right headers and no sample row.
  - **Database:** Local demo database (`AdRIC_DB_dev`).
  - **Role:** TSG Staff.
  - **Screen:** Import (`/staff/import`).
  - **Steps:**
    1. On the **Projects** tab, click **Download template**. Open `projects-template.csv` in Excel or a text editor and verify it has only the 1 header row: `project_code,project_name,project_leader,lab,start_date,funding_source,end_date`.
    2. Switch to the **Assets** tab and click **Download template**. Open `assets-template.csv` and verify it has only the 1 header row: `lab,name,category,condition,health_score,serial_number,manufacturer,home_room,project_code,funding_source,acquisition_value,procurement_date,warranty_expiry,accessories,its_property_tag,tsg_tag,missing_accessories,inspection_remarks`.
- **J-I3.** A file with errors: the table shows each row and column, and Import stays disabled.
  - **Database:** Local demo database (`AdRIC_DB_dev`).
  - **Role:** TSG Staff.
  - **Screen:** Import (`/staff/import`).
  - **Steps:**
    1. On the **Projects** tab, choose a `.csv` file where row 2 has an empty `project_code` and an unknown `lab` (`UNKNOWN_LAB`).
    2. Click **Check file**.
    3. Verify the banner says `"2 problems found. Fix them in the file and choose it again."`, the table lists Row `2`, Column `project_code` and `lab` with their problem messages, and the **Import** button remains disabled.
- **J-I4.** A good assets file: preview with expected tags, Import, then the new assets appear in Asset Inventory without a reload.
  - **Database:** Local demo database (`AdRIC_DB_dev`).
  - **Role:** TSG Staff.
  - **Screen:** Import (`/staff/import`) and Asset Inventory (`/staff/inventory`).
  - **Steps:**
    1. On the **Assets** tab, choose a valid `.csv` file with 2 new assets for an existing lab (such as `CITe4D`).
    2. Click **Check file**. Verify `"All 2 rows are ready."` appears along with the preview table showing **Tag (expected)** as the first column.
    3. Click **Import 2 rows**. Verify `"2 assets imported."` appears with each row and its created asset tag.
    4. Click **Asset Inventory** in the sidebar without reloading the browser. Verify both newly imported assets appear immediately in the inventory list.
- **J-I5.** Import a project, then open Register Asset: the new project is in the list without a reload.
  - **Database:** Local demo database (`AdRIC_DB_dev`).
  - **Role:** TSG Staff.
  - **Screen:** Import (`/staff/import`) and Register Asset (`/staff/register`).
  - **Steps:**
    1. On the **Projects** tab, choose a valid `.csv` file with 1 new project (for example code `PRJ-IMPORT-01`), click **Check file**, then click **Import 1 rows**.
    2. Verify `"1 projects imported."` appears with `PRJ-IMPORT-01`.
    3. Switch to the **Assets** tab and open **Allowed values**: verify `PRJ-IMPORT-01` is listed under project codes.
    4. Click **Register Asset** in the sidebar without reloading the browser and check the Project dropdown: verify `PRJ-IMPORT-01` is available in the dropdown.
- **J-I6.** A file over 1 MB or a non-CSV file is refused with a message.
  - **Database:** Local demo database (`AdRIC_DB_dev`).
  - **Role:** TSG Staff.
  - **Screen:** Import (`/staff/import`).
  - **Steps:**
    1. Choose a `.txt` or `.xlsx` file in the file picker. Verify an error message is shown refusing the non-CSV file and **Check file** is disabled.
    2. Choose a `.csv` file larger than 1 MB. Verify an error message is shown stating the file exceeds 1 MB and **Check file** is disabled.
- **J-I7.** typecheck 19, build passes, tests 1118.
  - **Database:** Local test database (`AdRIC_DB_test`).
  - **Steps:** Run `npm run typecheck`, `npm run build`, and `npm test`. Verify typecheck reports 19 errors, build succeeds, and all 1118+ API and unit tests pass.

## Report (to Raiki, not the PR)

At the end, report in the AGENTS.md format: what changed commit by commit, the three check results, the hand checks, questions, anything not done. **Don't write the PR description:** Raiki sends the report to the advisor, who writes it. Open the PR with any short body; Raiki replaces it.
