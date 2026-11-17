# Raiki: categories as a table, and the Reference Data page (#194)

**Owner:** Raiki. **Reviewer:** the advisor (send the PR link). **Save as:** `docs/tasks/194-reference-data.md` (first commit).
**Agent:** Claude Opus 5.5, effort high. Work in stops: plan first, wait for "go", then build. Stop after commit 2 (the migration) for Raiki to check the SQL by eye.
**Branch:** `feat/194-reference-data` from a fresh `main` (PR #193, the import API, is already merged).
**Rules:** `AGENTS.md`, `docs/guides/DATABASE-MIGRATIONS.md`. Raiki allows the schema change in commit 2 (AGENTS.md "ask first" is answered). No change in `package.json`. No em dashes. Typecheck stays at 19.
**Due:** PR by **Wed Nov 18, 8 pm**. Merge Thu morning, deploy Thu with the other migrations.

---

## The one rule that keeps this safe

**The category code stays the key.** `assets.category` holds `MONITOR` today and holds `MONITOR` after; it only gains a foreign key to `asset_categories.code`. No asset row is rewritten. If the generated SQL drops and re-adds a column instead of `MODIFY`, stop and rewrite it as `MODIFY`: a drop loses every asset's category.

## Commits, in order

1. `docs(reference): task file (#194)`: this file. **Raiki commits it before the agent starts.**
2. `db(reference): asset categories table (#194)`. **Stop after this one.**
   - `prisma/schema.prisma`: new model `asset_categories` (`code` String `@id @db.VarChar(30)`, `label` String `@unique @db.VarChar(100)`, `useful_life_years` Int `@default(5)`, `is_active` Boolean `@default(true)`, relations to `assets` and `category_metrics`). `assets.category` and `category_metrics.category` become `String @db.VarChar(30)` with a relation to it. Delete `enum assets_category`. Add `REFERENCE_DATA_CHANGED` and `PASSWORD_CHANGED` at the end of `enum activity_log_event_type` (after `PROJECT_CREATED`, from #193).
   - Migration folder `prisma/migrations/20261118090000_asset_categories/` (after #193's `20261117120000`), with `migrate diff` as the guide says, then hand-ordered so it runs as: (1) `CREATE TABLE asset_categories`; (2) `INSERT` the 20 current categories with their labels from `shared/enums/assetCategory.ts`, useful life 5. **No new categories:** the system records high-value research equipment only (the manuscript's scope), so cables, cords, whiteboards and the like stay out; AdRIC adds any real equipment category themselves on the new page; (3) `ALTER TABLE assets MODIFY category VARCHAR(30) NOT NULL` and the same for `category_metrics`; (4) the two foreign keys; (5) the `activity_log` enum with every old value plus `REFERENCE_DATA_CHANGED` and `PASSWORD_CHANGED` (the second is for Aryan's #186, which has no migration of its own, so the two never fight over this list).
   - `shared/constants/activityEvents.ts`: add `REFERENCE_DATA_CHANGED` ("Reference data changed") and `PASSWORD_CHANGED` ("Password changed").
   - Fix only what stops compiling because the Prisma enum type is gone (type-only changes).
   - Add the migration's row to "The migrations so far" in the guide.
   - **After Raiki checks the SQL, push the branch:** Aryan's #186 branch starts from this commit.
   - **At the stop, report:** the SQL; `npm test` (the test database is built from the migrations); and on a local copy of the demo data (`adric_uat_check`), `SELECT category, COUNT(*) FROM assets GROUP BY category` before and after `migrate deploy`: the same 20 rows and counts.
3. `feat(reference): categories read from the table (#194)`. Server only.
   - New `server/features/reference/` (five layers). Its repository has `listCategories()`; the service has `categoryMap()` (code to label, useful life, active), read once per request where needed.
   - `GET /api/lookups`: `categories` from the table, **active only**, as `{ key, label, usefulLifeYears }`.
   - Register and Edit Asset (`assets.validation.ts`): the category must be in the table; a new asset needs an active one; an edit may keep the asset's current category even if inactive.
   - Present value and `categoryLabel` (`assets.service.ts`, `retirements.service.ts`), insight labels (`insights.rules.ts`): from `categoryMap()`.
   - Analytics category filter (`analytics.validation.ts`, the TODO about the generic 500): an unknown category is a 400.
   - `shared/constants/usefulLife.ts`: delete `USEFUL_LIFE_YEARS`, keep `presentValue` and its helpers. `shared/enums/assetCategory.ts`: delete `ASSET_CATEGORIES` and `ASSET_CATEGORY_LABELS`; keep `export type AssetCategory = string` with a comment that the list lives in `asset_categories`. `careGuidelinesFor` and `LIFECYCLE_LIMIT_MONTHS` take a string and fall back as today for a code they don't list.
   - Update the tests that read the old constants, in the same commit, and say which.
4. `feat(reference): manage categories, labs and funding sources (#194)`. Routes in `server/features/reference/`, all `requireAuth, requireActive, requireAssetMasterEditor` (TSG and the Secretary):

   | Route | Body | Rules |
   |---|---|---|
   | `GET /api/reference/categories` | | every category, inactive too, with how many assets use each |
   | `POST /api/reference/categories` | `{ label, usefulLifeYears }` | code made from the label (upper case, spaces to `_`, letters and digits only, at most 30); label 1 to 100; useful life whole number 1 to 50; 409 if the label or code exists (any letter case) |
   | `PUT /api/reference/categories/:code` | `{ label?, usefulLifeYears?, isActive? }` | the code never changes; same checks; 404 unknown code |
   | `GET /api/reference/labs` | | every lab with campus and asset count |
   | `POST /api/reference/labs` | `{ name, shortCode, campus }` | short code 2 to 10 letters and digits, unique in any letter case; name 1 to 255; campus one of the three |
   | `PUT /api/reference/labs/:centerId` | `{ name?, campus? }` | the short code can't change (400 if sent): asset tags start with it |
   | `GET /api/reference/funding-sources` | | every funding source with asset and project counts |
   | `POST /api/reference/funding-sources` | `{ name }` | 1 to 100, unique in any letter case |
   | `PUT /api/reference/funding-sources/:fundingSourceId` | `{ name }` | same |

   - Each add or change, in the same transaction, logs `REFERENCE_DATA_CHANGED` with plain details: "Category added: Oscilloscope", "Category changed: Oscilloscope (useful life 8)", "Lab added: NEWLAB", "Funding source renamed: X to Y".
   - Answers: 201 on add, 200 on change, with the row in the shape the GET lists.
   - Tests in `tests/api/referenceData.test.ts`: each route's roles (TSG and Secretary 200 or 201; Director, Lab Head, Researcher, IT Admin 403; logged out 401); duplicates in another letter case 409; bad values 400; a deactivated category refused by Register Asset but kept by Edit Asset; a useful life change moves `presentValue` in `GET /api/assets`; a new lab, then Register Asset there gives `<CODE>-0001`; the short code can't change; one log row per change.
5. `feat(web): category options from lookups (#194)`: `IntakeWizard.tsx` (the category select), `CustodianPortal.tsx` (the filter, labels instead of `c.replace(...)`), `StaffAnalyticsView.tsx` (its hard-coded list, including the 5 categories that don't exist, see the comment at ~683). Use `useFormLookups()`. No other screen change.
6. `feat(web): Reference Data page (#194)`. `web/pages/staff/ReferenceDataPage.tsx`, route `reference-data` in the `/staff` tree, sidebar item "Reference Data" (TSG and the Secretary), title from `shared/constants/pageTitles.ts`. Three tabs, each a table with Add and Edit dialogs and the server's sentence on an error:
   - Categories: label, code, useful life, assets, Active. The useful life field says "Changing this changes the present value of every asset in this category."
   - Labs: short code, name, campus, assets. The short code is read-only after it's saved.
   - Funding sources: name, assets, projects.
   - After a save, clear the cached lookups so Register Asset sees the change without a reload: add and export `forgetFormLookups()` in `web/features/lookups/useLookups.ts` (if it's already on `main` from the import screen, reuse it).
7. `docs(reference): contract and counts (#194)`: `docs/contracts/lifecycle.md` (the lookups shape, the new routes, where the categories live), `AGENTS.md` test count.
8. `fix(imports): categories from the table (#194)`: `imports.service.ts` `resolveCategory` checks the code or label against the active categories (case-insensitive). Add one import test with a new category.

## Hand checks (local UAT copy, `adric_uat_check`, after `migrate deploy`)

- R-H1. Before the migration and after: `SELECT category, COUNT(*) FROM assets GROUP BY category` is identical (20 rows).
- R-H2. TSG, Reference Data, Categories: 20 rows, all Active. Add "Oscilloscope", useful life 10. Open Register Asset: it's in the list. Register one: tag and present value as expected.
- R-H3. Change Monitor's useful life to 3: in Asset Inventory each monitor's present value becomes cost x (1 - full years since purchase / 3), and 0 for one 3 or more years old. Set it back to 5 after.
- R-H4. Deactivate "Oscilloscope": not offered in Register Asset; the asset from R-H2 still shows it and can be edited.
- R-H5. Labs: add "Test Lab", short code TLAB, Manila. Register an asset there: `TLAB-0001`. Rename the lab; the short code field is read-only.
- R-H6. Funding sources: add "Test Grant"; it shows in Register Asset. Renaming to "dost" (an existing name in another case) is refused.
- R-H7. The Secretary can do R-H2 to R-H6; the Director and the IT Admin have no Reference Data item, and the API answers 403.
- R-H8. IT Admin, Activity Log, filter "Reference data changed": one row per change above.
- R-H9. typecheck 19, build passes, tests all pass (say the count).

## Report (to Raiki, not the PR)

At the end, report in the AGENTS.md format: what changed commit by commit, the three check results, the hand checks, questions, anything not done. **Don't write the PR description:** Raiki sends the report to the advisor, who writes it.

## Recommendations notes

For the Recommendations document, from #194:

- **Store the present value on a retirement when it is completed.** Today the Asset Disposal Record works out `presentValueAtCompletion` with the category's useful life of today, so a later useful life change on the Reference Data page changes the printed value of a retirement completed earlier (`docs/contracts/lifecycle.md`, section 7.11). Storing the value needs a new column on `retirements` and a migration. Raiki, Nov 17: keep the 7.11 note for now, and list this here.
