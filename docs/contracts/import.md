# CSV Import API Contract

API contract for bulk CSV import of projects and assets (Issue #192).

## 1. Overview

The CSV import API allows authorized staff to bulk import projects and assets into the DLSU CCS AdRIC system. The import runs in two phases:
1. **Check (`/check`):** Validates the entire CSV file without writing any changes to the database. Returns validation status, total row counts, preview rows, and a complete list of errors (capped at 200).
2. **Save (root):** Validates the entire CSV file and, if there are zero errors, writes all rows and corresponding activity logs in a single atomic transaction. If any error is found, nothing is written, and HTTP 400 is returned with the exact validation result JSON.

## 2. Endpoints and Permissions

| Endpoint | Method | Allowed Roles | Description |
|---|---|---|---|
| `/api/imports/projects/check` | POST | TSG Staff, AdRIC Secretary (`requireAssetMasterEditor`) | Validate projects CSV without saving |
| `/api/imports/projects` | POST | TSG Staff, AdRIC Secretary (`requireAssetMasterEditor`) | Atomic bulk creation of projects |
| `/api/imports/assets/check` | POST | TSG Staff (`requireTsg`) | Validate assets CSV without saving |
| `/api/imports/assets` | POST | TSG Staff (`requireTsg`) | Atomic bulk creation of assets with Initial inspections |

All endpoints require an authenticated and active session (`requireAuth`, `requireActive`). Requests from unauthorized roles return HTTP 403. Requests with no session return HTTP 401.

## 3. Request and Response Formats

### Request Payload
Every import endpoint accepts a JSON body:
```json
{
  "csv": "<the file's raw text content>"
}
```

### TypeScript Interfaces (`shared/types/imports.ts`)

```typescript
export interface ImportRowError {
  row: number;
  column: string | null;
  message: string;
}

export interface ImportCheckResult {
  success: boolean;
  rowCount: number;
  errors: ImportRowError[];
  preview: Record<string, string | number | null>[];
}

export interface ImportSaveResult {
  success: true;
  created: {
    row: number;
    key: string;
  }[];
}
```

### Response Status Codes
- **Check (`/check`):**
  - **HTTP 200:** Returns `ImportCheckResult`. `success` is `true` when `errors` is empty; `false` otherwise.
- **Save (root):**
  - **HTTP 200:** When valid, returns `ImportSaveResult` with `success: true` and array of `{ row, key }` created (where `key` is the `project_code` for projects or `asset_tag` for assets).
  - **HTTP 400:** When invalid, returns `ImportCheckResult` with `success: false`, `rowCount`, `errors`, and `preview`. Nothing is saved.

### Error Capping Rule
If the file contains more than 200 errors across headers and rows, the `errors` array is capped at the first 200 errors, followed by exactly one file-level item:
```json
{
  "row": 0,
  "column": null,
  "message": "and N more"
}
```
where `N` is the number of remaining errors beyond 200.

## 4. File and Header Rules

1. **Row Limits:**
   - The file must contain between 1 and 500 data rows.
   - An empty file (0 data rows) produces a file-level error (`row: 1`, `column: null`, message: `"The file contains no data rows."`).
   - More than 500 data rows produces a file-level error (`row: 1`, `column: null`, message: `"The file exceeds the limit of 500 rows."`).
2. **UTF-8 and Formatting:**
   - Leading UTF-8 Byte Order Marks (BOM `\uFEFF`) are automatically stripped.
   - Standard RFC 4180 rules apply: fields containing commas, line breaks, or double quotes must be enclosed in double quotes. Escaped quotes are represented as `""`.
   - Blank lines (only whitespace or empty commas) are ignored and do not count toward data rows.
3. **Header Normalization:**
   - Headers are trimmed, converted to lower case, and spaces or hyphens are normalized to underscores (`Project Code` becomes `project_code`).
   - Every column in the header row must match a recognized canonical column for that import type.
   - Any unknown column produces a file error (`row: 1`, `column: "<header>"`, message: `"Unknown column: <header>."`).
   - Any missing required column produces a file error (`row: 1`, `column: "<column>"`, message: `"Missing required column: <column>."`).
   - Any duplicate column header produces a file error (`row: 1`, `column: "<column>"`, message: `"Duplicate column header: <column>."`).

## 5. Projects Import Specification

### Columns
| Column | Required | Constraints |
|---|---|---|
| `project_code` | Yes | Non-empty text, max 255 chars. Unique in CSV and unique against `projects.project_code` in the database. |
| `project_name` | Yes | Non-empty text, max 255 chars. |
| `project_leader` | Yes | Non-empty text, max 255 chars. |
| `lab` | Yes | Must match `research_centers.short_code` (case-insensitive). |
| `funding_source` | No | If present, must match `funding_sources.name` (case-insensitive). |
| `start_date` | Yes | Valid date (`yyyy-mm-dd` or `m/d/yyyy`). |
| `end_date` | No | If present, valid date (`yyyy-mm-dd` or `m/d/yyyy`). Must be on or after `start_date`. |

### Save Side Effects
- Inserts row into `projects`.
- Writes one `activity_log` row per project:
  - `event_type`: `PROJECT_CREATED`
  - `actor_id`: session user ID
  - `details`: `project_code`

## 6. Assets Import Specification

### Columns
| Column | Required | Constraints |
|---|---|---|
| `lab` | Yes | Must match `research_centers.short_code` (case-insensitive). |
| `name` | Yes | Non-empty text, max 255 chars. |
| `category` | Yes | Must match `assets_category` enum key or label (case-insensitive). |
| `condition` | Yes | Must match `asset_condition` enum key or label (case-insensitive). |
| `health_score` | No | Integer 0 to 100. If omitted, defaults to `SUGGESTED_HEALTH_SCORE` for the condition. |
| `serial_number` | No | Max 255 chars. If non-empty, must be unique across all existing assets in the database (including RETIRED) and earlier rows in the CSV. |
| `manufacturer` | No | Max 255 chars. |
| `home_room` | No | Max 100 chars. |
| `project_code` | No | If present, must match existing `projects.project_code` (case-insensitive). |
| `funding_source` | No | If present, must match `funding_sources.name` (case-insensitive). |
| `acquisition_value` | No | Money value from 0 to 99,999,999.99. Strips leading `PHP`, `₱`, `$`, commas, and spaces. |
| `procurement_date` | No | Valid date (`yyyy-mm-dd` or `m/d/yyyy`). |
| `warranty_expiry` | No | Valid date (`yyyy-mm-dd` or `m/d/yyyy`). |
| `accessories` | No | Max 500 chars. |
| `its_property_tag` | No | Max 100 chars. If non-empty, must be unique across all existing assets in the database (including RETIRED) and earlier rows in the CSV. |
| `tsg_tag` | No | Max 100 chars. If non-empty, must be unique across all existing assets in the database (including RETIRED) and earlier rows in the CSV. |
| `missing_accessories` | No | Max 255 chars. Saved to the Initial inspection. |
| `inspection_remarks` | No | Max 255 chars. Saved to the Initial inspection. |

### Duplicate Identifier Matching
For `serial_number`, `its_property_tag`, and `tsg_tag`, checks are trimmed and case-insensitive.
- Against earlier row in the file: `"Serial number repeats row N."` (or `"ITS property tag repeats row N."`, `"TSG tag repeats row N."`).
- Against database asset: `"Serial number already used by <tag>."` (or `"ITS property tag already used by <tag>."`, `"TSG tag already used by <tag>."`).

### Save Side Effects
- Locks research centers in ascending `center_id` order (`lockCenter`).
- Generates sequential asset tags per lab using `nextTagOf`.
- Inserts asset with status `AVAILABLE`.
- Inserts Initial inspection (`asset_inspections`) with `type: INITIAL`, condition, health score, remarks, and missing accessories.
- Writes one `activity_log` row per asset:
  - `event_type`: `ASSET_REGISTERED`
  - `actor_id`: session user ID
  - `asset_id`: created asset ID
  - `details`: `asset_tag`

## 7. Concurrency and Atomicity

1. **Transaction Timeout:** Bulk save transactions are configured with `{ timeout: 60000 }`.
2. **Locking Order:** To prevent deadlocks, all research centers referenced in the batch are deduplicated and sorted by `center_id` ascending. Each center is locked via `lockCenter(tx, center_id)` before tag generation and insertions.
3. **All or Nothing:** If any validation rule fails, the save endpoint rolls back all changes and returns HTTP 400.

## 8. Date and Money Parsing

- **Dates:** Supported formats are `yyyy-mm-dd` (ISO) and `m/d/yyyy` (or `mm/dd/yyyy`). Year must be 4 digits. Month must be 1 to 12. Day must be 1 to 31 and valid for the month and year.
- **Money:** Strips leading currency tokens (`PHP`, `₱`, `$`), commas, and whitespace. Must parse to a non-negative decimal with at most 2 fractional digits, between 0 and 99,999,999.99.

## 9. Verification Scenarios

1. Unauthenticated calls return 401.
2. Unauthorized roles return 403 (e.g. Researcher for projects and assets; Secretary for assets).
3. Missing required headers return file error on row 1.
4. Unknown or repeated headers return file error on row 1.
5. Empty CSV or CSV exceeding 500 rows returns file error on row 1.
6. Errors exceeding 200 are capped at 200 with an appended `"and N more"` item.
7. Projects check detects duplicate code in file and in database.
8. Projects check detects unknown lab and unknown funding source.
9. Projects check validates start date and end date relationships.
10. Projects save successfully creates rows and activity logs.
11. Assets check validates categories, conditions, health score bounds, and lab codes.
12. Assets check detects duplicate serial numbers, ITS tags, and TSG tags against file and database.
13. Assets save generates sequential tags with lab row locking, creates initial inspections, and logs activity.
14. Atomic rollback: saving a batch with even one invalid row creates zero records in the database.

