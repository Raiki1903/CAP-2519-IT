# Import page: plain words in "What goes in it" (follow-up to #192)

**For:** Raiki (Claude Code agent). **Save as:** `docs/tasks/192-import-rules-text.md` (first commit, by Raiki). **File to change:** `web/pages/staff/ImportPage.tsx` only, the two rule maps `PROJECT_COLUMN_RULES` and `ASSET_COLUMN_RULES`. Text only, no logic. Commit 2 (the only code commit): `fix(imports): plain words for the import column rules (#192)`. Branch `fix/192-import-rules-text` from a fresh `main` (`git switch main; git pull; npm install; npm run prisma:generate; git switch -c fix/192-import-rules-text`). Typecheck 19, build passes, tests 1143 (or the count on `main`). No em dashes.
**Due:** pushed by **Thu Nov 19, 1 pm**, so it can be reviewed and merged before the 3 pm deploy. The agent writes its report for Raiki, not the PR description. No change to `AGENTS.md` (no new tests).

**Why:** the page shows database names (`research_centers.short_code`, `assets_category` enum, `SUGGESTED_HEALTH_SCORE`) to TSG Staff and the Secretary. Since #194, categories also aren't an enum any more.

Replace each value with the text below, word for word.

## Projects

| Column | New text |
|---|---|
| `project_code` | The project's code, up to 255 characters. It must not already be used, in this file or in the system. |
| `project_name` | The project's name, up to 255 characters. |
| `project_leader` | The project leader's name, up to 255 characters. |
| `lab` | The lab's short code, for example CITe4D (see Allowed values). Capital letters don't matter. |
| `start_date` | A date: yyyy-mm-dd or m/d/yyyy. |
| `funding_source` | Optional. One of the funding sources in Allowed values. |
| `end_date` | Optional. A date, on or after the start date. |

## Assets

| Column | New text |
|---|---|
| `lab` | The lab's short code, for example CITe4D (see Allowed values). Capital letters don't matter. |
| `name` | The asset's name, up to 255 characters. |
| `category` | One of the categories in Allowed values. |
| `condition` | One of the conditions in Allowed values. |
| `health_score` | Optional. A whole number from 0 to 100. Left empty, it gets the usual score for the condition. |
| `serial_number` | Optional, up to 255 characters. It must not already be used, in this file or in the system (Retired assets too). |
| `manufacturer` | Optional, up to 255 characters. |
| `home_room` | Optional, up to 100 characters. |
| `project_code` | Optional. A project code already in the system (see Allowed values). |
| `funding_source` | Optional. One of the funding sources in Allowed values. |
| `acquisition_value` | Optional. An amount from 0 to 99,999,999.99. PHP, ₱, $, commas and spaces are fine. |
| `procurement_date` | Optional. A date: yyyy-mm-dd or m/d/yyyy. |
| `warranty_expiry` | Optional. A date: yyyy-mm-dd or m/d/yyyy. |
| `accessories` | Optional, up to 500 characters. |
| `its_property_tag` | Optional, up to 100 characters. It must not already be used, in this file or in the system (Retired assets too). |
| `tsg_tag` | Optional, up to 100 characters. It must not already be used, in this file or in the system (Retired assets too). |
| `missing_accessories` | Optional, up to 255 characters. Saved on the asset's first inspection. |
| `inspection_remarks` | Optional, up to 255 characters. Saved on the asset's first inspection. |

**Hand check:** TSG Staff, Import, both tabs: the table reads as above, and no database names are left.
