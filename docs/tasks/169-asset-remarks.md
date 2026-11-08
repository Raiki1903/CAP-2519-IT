# Issue #169 brief: asset remarks

**Branch:** `feat/169-asset-remarks` from a fresh `main` (after PR #168 merged), in `C:\dev\CAP-2519-IT`.
**Issue:** #169.
**First commit:** this brief, as `docs/tasks/169-asset-remarks.md`. The agent then works from it.

## Goal

Remarks on an asset, shown in the asset modal, with a soft delete, and a read-only Asset Inventory page for the IT Admin. One additive migration. No package changes. Raiki approves the schema and migration change described here.

## Rules

- **Add:** TSG_STAFF, ADRIC_DIRECTOR, ADRIC_SECRETARY, or the Head of the asset's home lab (`research_centers.head_user_id`). Anyone else gets 403, including a Lab Head of another lab, a Researcher and the IT Admin.
- **Read:** any active account (same as `GET /api/assets/:assetTag/history`). Deleted remarks are never sent.
- **Delete:** the remark's author, the Head of the asset's home lab, or IT_ADMIN (any remark). Anyone else 403. A delete is soft: set `deleted_by` and `deleted_at`, keep the row. Deleting an already deleted remark: 404. A remark id that belongs to another asset: 404.
- **Text:** trimmed, required, at most 500 characters (400 otherwise). Unknown asset 404. No editing route. Allowed in every asset status; a remark never changes the asset, so no lifecycle guard and no status change.
- **History:** an asset with any remark row (deleted or not) counts as having history: `DELETE /api/assets/:assetTag` is refused (409) the same way it is for other history. Check how the delete check works today and extend it.

## What Raiki knows from main (confirm at Stop 0)

- `assets.routes.ts` has the benchmarks route with `requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'LAB_HEAD')` and the service keeps a Lab Head to their own lab. Copy that pattern (route-level role list plus the own-lab check in the service). `server/shared/services/permissions.ts` has the Lab Head helpers. Delete needs a service check (author, home Lab Head, or IT Admin), not only a route role list.
- **Migrations:** the newest is `20261108120000_personal_funding_source`. Yours must have a later timestamp. Follow `docs/guides/DATABASE-MIGRATIONS.md` ("Writing a Phase 3 change", migrate diff against the test DB, read the SQL) and add the row to "The migrations so far". Never `migrate dev`, `db push` or `db pull`.
- **Table:** `asset_remarks` (`remark_id` PK, `asset_id` FK to assets, `author_id` FK to users, `remark_text` VARCHAR(500), `created_at` DATETIME(3) default now, `deleted_by` FK to users nullable, `deleted_at` DATETIME(3) nullable, index on `asset_id`). Match the naming and FK style of the existing tables.
- Use `lockAsset` or another row lock only if a rule needs it; say why at Stop 0.
- The seed and the test reset list their tables (`seed.ts` has an empty-tables list). Add the new table wherever that is needed so the seed and `npm test` keep working.
- **Where it goes:** a "remarks" part inside the assets feature (routes, validation, controller, service, repository) unless the repo's structure says a separate feature folder fits better. Say which at Stop 0.
- **IT Admin page:** the Director already has `/adric-director/inventory` with `<InventoryPage readOnly />` (#163). Add the same under it-admin in `web/app/routes.tsx` and an "Asset Inventory" entry in the ITAdmin nav in `web/app/layouts/Sidebar.tsx` (Package icon, after Users). Check that RootLayout, the bell and AssetDetailModal behave for the IT Admin (no asset action buttons) and that `GET /api/assets` and the history route answer the IT Admin.

## Web

- A "Remarks" section in `web/features/assets/AssetDetailModal.tsx` (pick the spot that fits the current layout and say why).
- List newest first: author name, date and time, text, and a small delete button only on remarks this user may delete.
- An add box (textarea with a character count and an "Add Remark" button) only for users allowed to add.
- GET returns `{ remarks: [{ ..., canDelete }], canAdd }` so the screen doesn't guess roles.
- Ask for confirmation before a delete (a small dialog in the app's style, not `window.confirm`).
- Calls go through `web/api/assets.api.ts`.
- Follow the app's existing card, button and dialog styles; name the component you copied.

## Stops (stop after each one and report)

- **Stop 0, Plan:** confirm the facts, list files, the migration SQL you expect, questions in the AGENTS.md format.
- **Stop 1, Server:** migration, `schema.prisma`, five layers, tests (each add, read and delete rule above, plus a `Promise.all` of two adds at once both saved), typecheck stays 25, build, `npm test` (say the new count).
- **Stop 2, Web:** the modal section and the IT Admin page, typecheck, build, `npm test`. Then hand checks for Raiki on `adric_uat_check`, with the setup step first (the one-line PowerShell `prisma migrate deploy` on `adric_uat_check`). Checks:
  - TSG, Director and the CITe4D Lab Head add a remark.
  - The HXIL Lab Head and a Researcher see remarks but no add box and no delete buttons.
  - TSG deletes their own remark but not the Director's.
  - The CITe4D Lab Head deletes the Director's remark on a CITe4D asset.
  - The IT Admin opens Asset Inventory from the sidebar, sees no edit or asset action buttons and no add box, and deletes any remark.
  - A deleted remark is gone from the modal but still in the table (one-line mysql query).
  - 500-character limit.
  - Newest first.
  - The remark shows in the Director's Asset Inventory modal.
  - Deleting an asset with a remark is refused.
- Don't use Playwright. Don't write PR text.

## Decisions (Raiki, Nov 8)

- Q1 (a): the column is `deleted_by_id`, like `resolved_by_id` and `completed_by_id`.
- Q2 (b): everyone sees every remark author's name, a Researcher too. Only TSG, the Director, the Secretary and Lab Heads can add a remark, so an author is always an official, never a borrower. Holders and borrowers stay hidden as before.
- Q3 (a): the delete refusal names remarks: "has history (loans, maintenance, a retirement, inspections, or remarks)".
- Q4 (a): `docs/contracts/lifecycle.md` is updated on this branch, with the Q2 exception in section 6.
- Q5 (a): no activity log rows for remarks; the remark row keeps who and when.

## Stop 2 hand checks

Written for Raiki, to run by hand. Every check uses **`adric_uat_check` only** (the local copy), on branch `feat/169-asset-remarks`. Nothing here touches CCS Cloud. Find this section by searching the exact heading text `Stop 2 hand checks` in `docs/tasks/169-asset-remarks.md`; the checks are H1 to H12. Each ends with a Pass line.

**Order.** Run them in order and in one sitting: each check uses the remarks the one before it left. The main asset is **CITe4D-0001, "ASUS TUF Gaming A15"** (Available, home lab CITe4D).

**Setup (before H1)**

1. Ports 4000 and 5173 must be free: no leftover `npm run dev:all`, which talks to CCS Cloud.
2. In `C:\dev\CAP-2519-IT`, on the branch: `npm run prisma:generate` (the schema changed).
3. Build the new table on `adric_uat_check`, one PowerShell line (replace `<password>` with your local MySQL password):
   ```
   $env:PRISMA_TARGET_URL = "mysql://root:<password>@localhost:3306/adric_uat_check"; npx.cmd prisma migrate deploy; Remove-Item Env:PRISMA_TARGET_URL
   ```
   Expect `Applying migration 20261108180000_asset_remarks` (and `20261108120000_personal_funding_source` first, if #167's was never applied here), then "All migrations have been successfully applied."
4. Start the app with `C:\dev\uat-data\start-local-uat.ps1`. The startup line must say `Starting on localhost / adric_uat_check`. If it names anything else, stop.
5. Every demo account logs in with the demo password you chose when you seeded the database (the agent did not read any password file). The accounts used, with their user ids on a demo seed:
   - `demo.tsg@dlsu.edu.ph`, "Demo TSG Staff A" (id 4)
   - `demo.director@dlsu.edu.ph`, "Demo Director" (id 2)
   - `demo.labhead.cite4d@dlsu.edu.ph`, "Demo Lab Head CITe4D" (id 6, heads CITe4D)
   - `demo.labhead.car@dlsu.edu.ph`, "Demo Lab Head CAR" (id 7, heads CAR: the Head of another lab; the seed has no HXIL Head)
   - `demo.researcher.a@dlsu.edu.ph`, "Demo Researcher A" (id 8, CITe4D)
   - `demo.admin@dlsu.edu.ph`, "Demo IT Admin" (id 1)
6. Use one private browser window at `http://localhost:5173`. To switch account, click the red logout button at the bottom of the sidebar first.
7. Four checks paste one command into the browser console: DevTools (F12), Console, on the app's page. The first time the browser may ask you to type `allow pasting`. The command prints the server's answer.
8. Where the section is: in the asset modal, **Remarks** is the card between "Staff Service Remarks" and "Asset History". It sits there so it is next to the other remarks card and above the long history list.

**H1. TSG adds a remark.** Role: Demo TSG Staff A. Screen: "Asset Inventory". Database: `adric_uat_check` (writes: one remark).
- Log in as `demo.tsg@dlsu.edu.ph`. Click Asset Inventory in the sidebar, then the card "ASUS TUF Gaming A15" (CITe4D-0001).
- The Remarks card has an empty box "Write a remark about this asset", the count `0/500` and an "Add Remark" button, which is greyed out. Under it: "No remarks yet."
- Type `H1 TSG remark`. The count shows `13/500` and the button turns on. Click Add Remark.
- Expect: the box empties; the list shows **Demo TSG Staff A**, today's date and time (for example "Nov 8, 2026, 3:05 PM"), the text "H1 TSG remark", and a small trash icon on it.
- **Pass:** [ ] yes [ ] no. Notes:

**H2. The Director adds a remark, and sees TSG's in the Director's Asset Inventory.** Role: Demo Director. Screen: "Asset Inventory". Database: `adric_uat_check` (writes: one remark).
- Log out, log in as `demo.director@dlsu.edu.ph`. Click Asset Inventory, then "ASUS TUF Gaming A15".
- Expect first: the modal has no QR tag, no "Asset Actions" and no buttons. Remarks lists "H1 TSG remark" by Demo TSG Staff A with **no** trash icon (the Director is not its author).
- Type `H2 Director remark` and click Add Remark.
- Expect: "H2 Director remark" by Demo Director is **above** "H1 TSG remark" (newest first). Only the Director's own remark has a trash icon.
- **Pass:** [ ] yes [ ] no. Notes:

**H3. The CITe4D Lab Head adds a remark; newest first.** Role: Demo Lab Head CITe4D. Screen: "Lab Inventory". Database: `adric_uat_check` (writes: one remark).
- Log out, log in as `demo.labhead.cite4d@dlsu.edu.ph`. Click Lab Inventory, then "ASUS TUF Gaming A15".
- Expect first: both remarks show, and **both** have a trash icon (the Head of the asset's home lab may delete any remark on it).
- Type `H3 Lab Head remark` and click Add Remark.
- Expect, top to bottom: "H3 Lab Head remark" (Demo Lab Head CITe4D), "H2 Director remark" (Demo Director), "H1 TSG remark" (Demo TSG Staff A). Each shows its date and time; the times go from newest to oldest.
- **Pass:** [ ] yes [ ] no. Notes:

**H4. The 500-character limit.** Role: Demo Lab Head CITe4D (still logged in). Screen: "Lab Inventory", the same modal. Database: `adric_uat_check` (writes: one remark; the console step writes nothing).
- In a PowerShell window, put 600 x's on the clipboard: `Set-Clipboard ("x" * 600)`.
- Click into the remark box and paste (Ctrl+V). Expect: the count shows `500/500` and the box holds no more. Click Add Remark. Expect: a new remark of x's at the top of the list, wrapped over several lines inside its card.
- In the console, send 501 characters straight to the server:
  ```
  fetch('http://localhost:4000/api/assets/CITe4D-0001/remarks',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'y'.repeat(501)})}).then(r=>r.json()).then(console.log)
  ```
  Expect: `{success: false, error: 'A remark can be at most 500 characters.'}`. Close and reopen the modal: no y's remark in the list.
- **Pass:** [ ] yes [ ] no. Notes:

**H5. A Researcher sees remarks, with names, but cannot add or delete.** Role: Demo Researcher A. Screen: "Available Equipment". Database: `adric_uat_check` (read only).
- Log out, log in as `demo.researcher.a@dlsu.edu.ph`. Click Available Equipment, then "ASUS TUF Gaming A15".
- Expect: Remarks lists the four remarks from H1 to H4, each with its author's name (Demo Lab Head CITe4D, Demo Director, Demo TSG Staff A: remark authors are shown to everyone). There is **no** remark box, no count, no "Add Remark" button, and **no** trash icon on any remark.
- **Pass:** [ ] yes [ ] no. Notes:

**H6. The Head of another lab cannot add or delete.** Role: Demo Lab Head CAR. Screen: "Lab Inventory", then the console. Database: `adric_uat_check` (writes nothing: the step is refused).
- Log out, log in as `demo.labhead.car@dlsu.edu.ph`. Click Lab Inventory. Expect: only CAR assets; CITe4D-0001 is not in the list (a Lab Head's view shows its own lab only, so the refusal is checked in the console).
- Nearby behavior: click "Robotics Arm Simulator Kit" (CAR-0001). Expect: the Remarks card **has** the remark box and "Add Remark" (its own lab). Do not add anything. Close the modal.
- In the console, read CITe4D-0001's remarks:
  ```
  fetch('http://localhost:4000/api/assets/CITe4D-0001/remarks',{credentials:'include'}).then(r=>r.json()).then(console.log)
  ```
  Expect: `canAdd: false`, and in `remarks` (4 items) every `canDelete: false`.
- Then try to add one:
  ```
  fetch('http://localhost:4000/api/assets/CITe4D-0001/remarks',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'H6 not my lab'})}).then(r=>r.json()).then(console.log)
  ```
  Expect: `{success: false, error: "This asset belongs to another lab. Only that lab's Head can add a remark to it."}`.
- **Pass:** [ ] yes [ ] no. Notes:

**H7. TSG deletes their own remark, but not the Director's.** Role: Demo TSG Staff A. Screen: "Asset Inventory". Database: `adric_uat_check` (writes: one soft delete; the console step writes nothing).
- Log out, log in as `demo.tsg@dlsu.edu.ph`. Asset Inventory, "ASUS TUF Gaming A15".
- Expect: a trash icon only on "H1 TSG remark". None on "H2 Director remark", "H3 Lab Head remark" or the x's.
- Click the trash icon on "H1 TSG remark". A small dialog "Delete this remark?" opens over the modal, naming Demo TSG Staff A and showing the text. Press **Escape**: only the dialog closes; the asset modal stays open. Click the trash icon again, then **Cancel**: the remark is still there.
- Click the trash icon again, then **Delete Remark**. Expect: "H1 TSG remark" is gone from the list; the other three stay.
- In the console, try to delete the Director's remark:
  ```
  fetch('http://localhost:4000/api/assets/CITe4D-0001/remarks',{credentials:'include'}).then(r=>r.json()).then(d=>fetch('http://localhost:4000/api/assets/CITe4D-0001/remarks/'+d.remarks.find(x=>x.text==='H2 Director remark').remarkId,{method:'DELETE',credentials:'include'})).then(r=>r.json()).then(console.log)
  ```
  Expect: `{success: false, error: "Only the remark's author, the Head of the asset's lab, or the IT Admin can delete this remark."}`.
- **Pass:** [ ] yes [ ] no. Notes:

**H8. The CITe4D Lab Head deletes the Director's remark.** Role: Demo Lab Head CITe4D. Screen: "Lab Inventory". Database: `adric_uat_check` (writes: one soft delete).
- Log out, log in as `demo.labhead.cite4d@dlsu.edu.ph`. Lab Inventory, "ASUS TUF Gaming A15".
- Click the trash icon on "H2 Director remark", then Delete Remark.
- Expect: "H2 Director remark" is gone. "H3 Lab Head remark" and the x's remain.
- **Pass:** [ ] yes [ ] no. Notes:

**H9. The IT Admin opens Asset Inventory from the sidebar and deletes any remark.** Role: Demo IT Admin. Screen: "Asset Inventory". Database: `adric_uat_check` (writes: one soft delete).
- Log out, log in as `demo.admin@dlsu.edu.ph`. Expect: the sidebar shows, in order, Approvals, Users, **Asset Inventory** (a package icon), Activity Log, Tickets. There is no notification bell.
- Click Asset Inventory. Expect: the title "Asset Inventory", the In Service and Disposed tabs, search and filters, and asset cards with **no** Edit, Decommission or Delete buttons. Switch to Table: there is **no** Action column.
- Click "ASUS TUF Gaming A15". Expect: no QR tag, no "Asset Actions" and no buttons. Remarks has **no** remark box and no "Add Remark", and **every** remark has a trash icon.
- Click the trash icon on "H3 Lab Head remark" (another person's remark), then Delete Remark. Expect: it is gone; only the x's remark remains.
- **Pass:** [ ] yes [ ] no. Notes:

**H10. A deleted remark is gone from the modal but still in the table.** Role: none (MySQL). Database: `adric_uat_check` (read only).
- In PowerShell (it asks for your local MySQL password; or run the same SELECT in MySQL Workbench on `adric_uat_check`):
  ```
  mysql -u root -p adric_uat_check -e "SELECT remark_id, author_id, LEFT(remark_text, 20) AS text, deleted_by_id, deleted_at FROM asset_remarks ORDER BY remark_id;"
  ```
- Expect four rows, in order:
  - "H1 TSG remark", author 4, `deleted_by_id` 4, with a `deleted_at` time.
  - "H2 Director remark", author 2, `deleted_by_id` 6, with a time.
  - "H3 Lab Head remark", author 6, `deleted_by_id` 1, with a time.
  - the x's, author 6, `deleted_by_id` NULL, `deleted_at` NULL.
- The y's from H4 and "H6 not my lab" are not there.
- **Pass:** [ ] yes [ ] no. Notes:

**H11. Deleting an asset with a remark is refused; one without history still deletes.** Role: Demo TSG Staff A. Screens: "Register Equipment", then "Asset Inventory". Database: `adric_uat_check` (writes: two new assets, one remark, one soft delete, one asset deleted; the asset "H11 Remark Test Asset" stays, because it cannot be deleted).
- Log out, log in as `demo.tsg@dlsu.edu.ph`. Click Register Equipment. Asset Name `H11 Remark Test Asset`, Serial Number `SN-H11-REMARK`, any category; Continue Step 2, Continue Step 3; Home Lab CITe4D, any Condition at Intake; Commit Intake Registry. The form empties.
- Register a second one the same way: `H11 Plain Test Asset`, Serial Number `SN-H11-PLAIN`.
- Asset Inventory: open "H11 Remark Test Asset", add the remark `H11 keep me`, close the modal.
- On its card, click the trash icon (Delete Asset), then Permanently Delete. Expect: the dialog stays open with `<tag> cannot be deleted because it has history (loans, maintenance, a retirement, inspections, or remarks). To take it out of use, request its retirement instead.` Click Cancel; the card is still there.
- Open it again, delete the remark "H11 keep me" (trash icon, Delete Remark), close the modal, and try Delete Asset again. Expect: the same refusal (a deleted remark still counts as history).
- Nearby behavior: on the card "H11 Plain Test Asset", Delete Asset, Permanently Delete. Expect: the dialog closes and the card is gone.
- **Pass:** [ ] yes [ ] no. Notes:

**H12. Who may open the IT Admin's Asset Inventory, and the old views still work.** Roles: Demo Researcher A, then Demo IT Admin. Screens: `/it-admin/inventory`, "Users". Database: `adric_uat_check` (read only).
- Log out, log in as `demo.researcher.a@dlsu.edu.ph`. Type `http://localhost:5173/it-admin/inventory` in the address bar. Expect: "You don't have access to this page".
- Log out, log in as `demo.admin@dlsu.edu.ph`. Click Users: the users list loads as before. Click Asset Inventory, then Approvals: both open.
- **Pass:** [ ] yes [ ] no. Notes:
