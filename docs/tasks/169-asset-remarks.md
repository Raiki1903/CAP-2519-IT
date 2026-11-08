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
