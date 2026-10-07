# legacy/inspection-scheduling

**Do not import anything from this folder. Do not study it as an example of how the project works.**

One file, moved here on 2026-10-07 by step 8 part 2 of the restructure. It holds the scheduling controls that used to sit on the Staff Inspections tab (`/its/inspections` and `/tsg/inspections`). None of them saved anything (H-18 in [01B](../../docs/phase-1b-deep-map/01B-findings-register.md#h-18-inspection-scheduling-keeps-nothing), F-28 in [01A](../../docs/phase-1b-deep-map/01A-system-trace.md#f-28-inspection-queue-and-scheduling-its-and-tsg)). The team decided to move them here instead of deleting them (question 15), so they can be found without digging through git history.

- Excluded from the TypeScript check and the Vite build: `tsconfig.json` lists `legacy` under `exclude`, and nothing imports this file.
- The file is the removed code gathered into one component so it reads as a whole. It was never a component of its own: each piece sat inline in `ITSDashboard.tsx`. It is not meant to be dropped back in as is.
- The full original tab is in git: `git show 5d26ed8e:src/app/components/ITSDashboard.tsx` (the inspections tab starts around line 1434).

---

## What is here

`InspectionScheduling.tsx`:

| Piece | What it did | Saved anywhere? |
|---|---|---|
| Schedule Inspection Cycle / View Schedule button, and the schedule dialog | Start and end dates for each lab group (A to D), then "Dispatch Schedule to Custodians" | No. Dates lived in component state. The dispatch message says notifications were sent; none were |
| Reset Inspection Queue button | Cleared the schedule, the group flags, and the per-item "Inspected" badges | No. Its dialog says database records "will remain saved", which is true only because it never touched them |
| Inspection Frequency Engine card | Annual or Trimestral switch | Per browser only, in the `pref_cycle_mode` cookie (F-38) |
| Group status badge and Mark Group Completed | "UNSCHEDULED / PENDING", "SCHEDULED: dates", or "RESOLVED / COMPLETED" per group; marking a group completed showed every asset in it as Inspected | No. Component state |
| `maintenanceQueues` | An empty list per group. Nothing read it | n/a |

All of this was lost as soon as the user left the tab. A schedule set up on Monday was blank on Tuesday, while the individual reports filed in between were in the database, so the two disagreed.

The schedule dialog also showed "undefined Assets" for every group: it reads `g.assets` from the lab group list, which has no such field (a TS2339 error the typecheck reported).

## What stays live, and where

- **Inspecting an asset.** The Inspections tab still lists assets by lab group (A to D), each with **Inspect / Log Report**. That opens the finalize dialog, which posts the report to `POST /api/assets/:tag/inspection` and lands in `asset_reports`. After a submit the row shows "Inspected" until the user leaves the tab, as before.
- **The inspection log** on the same tab, which reads the database reports (F-28, changed in the same session).
- **The custodian condition report** (Custodian, Report tab). Unchanged.
- **The cycle setting.** Still in the sidebar Settings panel and still shown on the Custodian report banner. Only the Staff tab's copy of the switch moved here.

## Bringing scheduling back

Rebuild, do not restore. A real schedule needs:

1. A table for inspection windows and per-group completion (Phase 3), so a schedule survives a reload and every Staff member sees the same one.
2. One cycle setting for everyone, stored on the server, in place of the per-browser cookie (F-38). The cycle type on each report needs a column on `asset_reports` (issue #34).
3. Real notifications to custodians when a window opens, if "Dispatch" is to mean anything.

Then build the screen in `web/features/inspections/` against `web/api/inspections.api.ts`, with the file header and TSDoc required by [CODE-COMMENTS.md](../../docs/guides/CODE-COMMENTS.md).
