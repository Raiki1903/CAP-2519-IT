# Task Brief: Issue #192 CSV Import API for Projects and Assets

**Branch:** `feat/192-import-api` from `main`
**Issue:** #192

## 1. Goal

Implement the backend CSV Import API for research projects and equipment assets, following `docs/contracts/import.md`. The API supports pre-flight validation (`/check`) and atomic batch execution (`/`), enforcing role permissions, row locking, error capping, and activity logging.

## 2. Commit Sequence

1. `docs(imports): import contract and task file (#192)`
   - Create `docs/contracts/import.md` and `docs/tasks/192-import.md`.
2. `refactor(assets): move nextTagOf to shared services (#192)`
   - Extract `nextTagOf` from `server/features/assets/assets.service.ts` to `server/shared/services/assetTags.ts`.
   - Update `assets.service.ts` to import `nextTagOf`.
3. `db(activity-log): add the PROJECT_CREATED event type (#192)`
   - Add `PROJECT_CREATED` to `prisma/schema.prisma` under `enum activity_log_event_type`.
   - Add `PROJECT_CREATED` to `shared/constants/activityEvents.ts`.
   - Generate migration `prisma/migrations/20261117120000_project_created_event/migration.sql` using `migrate diff`.
   - Update `docs/guides/DATABASE-MIGRATIONS.md`.
4. `feat(imports): column lists and answer types (#192)`
   - Create `shared/constants/importColumns.ts` and `shared/types/imports.ts`.
5. `feat(imports): CSV reader (#192)`
   - Create `server/features/imports/csv.ts` and unit tests in `tests/unit/csv.test.ts`.
6. `feat(imports): check and save projects (#192)`
   - Implement `POST /api/imports/projects/check` and `POST /api/imports/projects`.
   - Mount router in `server/app.ts`.
7. `feat(imports): check and save assets (#192)`
   - Implement `POST /api/imports/assets/check` and `POST /api/imports/assets`.
8. `test(imports): comprehensive API tests (#192)`
   - Create `tests/api/imports.test.ts` testing all Contract Section 9 scenarios.
9. `docs(agents): update the test count (#192)`
   - Update `AGENTS.md` test count.

## 3. Hand Checks

Run these against the local demo database (`AdRIC_DB_dev`).

### A-H1: Unauthorized role rejection
- **Role**: Researcher (`demo.researcher.a@dlsu.edu.ph`)
- **Action**: Send POST requests to `/api/imports/projects/check` and `/api/imports/assets/check`.
- **Expected**: Both requests return HTTP 403 Forbidden.

### A-H2: Projects Check error validation
- **Role**: AdRIC Secretary (`demo.secretary@dlsu.edu.ph`)
- **Action**: Submit CSV with missing `project_code`, invalid lab code `INVALID`, and end date earlier than start date.
- **Expected**: HTTP 200 with `success: false` and specific row errors for each invalid column.

### A-H3: Projects Save execution and activity log
- **Role**: AdRIC Secretary (`demo.secretary@dlsu.edu.ph`)
- **Action**: Submit valid CSV with 2 new projects to `POST /api/imports/projects`.
- **Expected**: HTTP 200 with `success: true` and 2 created keys. Both projects exist in `projects` table and 2 `PROJECT_CREATED` rows exist in `activity_log`. Re-submitting the same CSV returns HTTP 400 with duplicate project code errors.

### A-H4: Assets Check error validation
- **Role**: TSG Staff (`demo.tsg@dlsu.edu.ph`)
- **Action**: Submit CSV with unknown category `INVALID_CAT`, duplicate serial number matching an existing asset, and invalid cost `abc`.
- **Expected**: HTTP 200 with `success: false` and corresponding row errors.

### A-H5: Assets Save execution, sequential tagging, and inspections
- **Role**: TSG Staff (`demo.tsg@dlsu.edu.ph`)
- **Action**: Submit valid CSV with 3 assets in lab `CITe4D` to `POST /api/imports/assets`.
- **Expected**: HTTP 200 with `success: true`. Three assets are created with status `AVAILABLE` and consecutive tags (e.g. `CITe4D-0005`, `CITe4D-0006`, `CITe4D-0007`). Each has an Initial inspection and an `ASSET_REGISTERED` activity log row.

### A-H6: Atomic rollback on save failure
- **Role**: TSG Staff (`demo.tsg@dlsu.edu.ph`)
- **Action**: Submit CSV containing 1 valid asset row followed by 1 invalid asset row (unknown lab) to `POST /api/imports/assets`.
- **Expected**: HTTP 400 with error on row 3. Zero assets are inserted from the batch.

