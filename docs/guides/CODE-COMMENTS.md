# Code Comment Standard

For everyone on CAP-2519-IT, including AI coding agents. Follow this in every file you create or move during the restructure and afterwards.

---

## The rule

**The code shows *how*. The name shows *what*. The comment explains *why*.**

If you find yourself writing a comment that says what the next line does, delete the comment and improve the name instead.

There are exactly **three kinds** of comment. Nothing else.

---

## 1. File header

Every file you create or move gets one `/** */` block at the top. Five things:

1. What this file is for, in one line.
2. Its layer: page, feature component, api, routes, validation, controller, service, repository, or shared.
3. What calls it.
4. What it calls.
5. Which role or workflow uses it.

```ts
/**
 * Loans service: business rules for borrow requests and decisions.
 * Layer: service. Called by loans.controller.ts. Calls loans.repository.ts and shared/services/assetState.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */
```

Keep it to three or four lines. It is a signpost, not an essay.

## 2. TSDoc on every export

Every exported function, component, and type gets a `/** */` block:

- A one-line summary.
- A short *why* for any rule that is not obvious.
- `@param`, `@returns`, `@throws` where they apply.
- React components: list the key props and say which api function the component calls.

```ts
/**
 * Creates a pending loan request for an asset.
 * Rejects it if the asset is not ACTIVE or already has a pending loan,
 * because two approvals would give one item two custodians. (H-05)
 *
 * @param input assetTag, borrowerId (from the session), purpose, dueDate, destinationLab
 * @returns the created loan row
 * @throws NotFoundError if the tag does not exist
 * @throws ConflictError if the asset is not available
 */
```

## 3. Inline comments, only for a non-obvious why

Use one only for a business rule, a workaround, an ordering that matters, or a known defect. End with the finding ID in parentheses when one applies.

```ts
// Tag is generated inside the transaction so two staff registering at once
// cannot get the same number. (H-11)
```

For a known defect you are **not** fixing in this step:

```ts
// TODO(H-04): finalizing a return does not close the loan yet. Phase 3.
```

The `TODO(<finding ID>): <what is wrong>. <which phase fixes it>.` format matters, because we grep for it.

---

## Never write these

| Do not write | Why |
|---|---|
| `// loop through the assets` | Restates the code |
| `// moved from server.ts line 934` | History belongs in git and `02-restructure-log.md` |
| `// edited by Raiki, 2026-09-26` | Same. `git log` knows |
| `// fixed the borrower bug` | Vague, no finding ID, and it may not be true |
| Commented-out code | Delete it. Git remembers |
| Any comment claiming a fix is done when it is not | Worse than no comment. Use `TODO(<ID>)` |

**Comments describe what the code does now**, not what it used to do or what we hope it will do.

---

## One example per layer

### Page (`web/pages/staff/InventoryPage.tsx`)

```tsx
/**
 * Staff inventory screen: the searchable asset registry with intake and edit entry points.
 * Layer: page. Called by web/app/routes.tsx at /staff/inventory.
 * Calls: features/assets/AssetTable, features/assets/EditAssetDialog.
 * Used by: Staff (ITS and TSG).
 */

/**
 * Arranges the asset table and its dialogs. Holds no fetching of its own:
 * the table owns its query so the dialogs can invalidate it independently.
 */
export function InventoryPage() {
```

### Feature component (`web/features/loans/LoanForm.tsx`)

```tsx
/**
 * Borrow request form shown to a Custodian from the asset detail modal.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx.
 * Calls: api/loans.api.ts requestLoan().
 * Used by: Custodian borrow request.
 */

/**
 * Collects purpose, due date, and destination lab, then submits a borrow request.
 *
 * @param asset the asset being requested, for the tag and the header
 * @param onDone called after a successful submit so the parent can close and refetch
 */
export function LoanForm({ asset, onDone }: LoanFormProps) {
```

### Api file (`web/api/loans.api.ts`)

```ts
/**
 * Loan endpoints. The only place a loan URL appears in the frontend.
 * Layer: api. Called by features/loans/*. Calls api/client.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */

/**
 * Submits a borrow request for one asset.
 * The borrower is not sent: the server takes it from the session. (H-10)
 *
 * @param assetTag the human-facing tag, for example CITe4D-0004
 * @returns the created loan
 */
export function requestLoan(assetTag: string, input: CreateLoanInput) {
```

### Routes (`server/features/loans/loans.routes.ts`)

```ts
/**
 * Loan route table: which URL maps to which controller, and who may call it.
 * Layer: routes. Called by server/app.ts. Calls loans.controller.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */
```

### Controller (`server/features/loans/loans.controller.ts`)

```ts
/**
 * Loan controller: unpacks HTTP requests and formats loan responses.
 * Layer: controller. Called by loans.routes.ts. Calls loans.service.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */

/**
 * Handles POST /api/assets/:assetTag/borrow.
 * Errors are passed to next() so errorHandler picks the status code
 * and no raw database message reaches the browser. (H-16)
 */
export async function createLoanRequest(req, res, next) {
```

### Service (`server/features/loans/loans.service.ts`)

See the TSDoc example in section 2. That is a service function.

### Repository (`server/features/loans/loans.repository.ts`)

```ts
/**
 * Loan row access. The only layer that calls Prisma for asset_loans.
 * Layer: repository. Called by loans.service.ts. Calls server/config/prisma.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */

/**
 * Counts pending loans for one asset.
 * Used as a guard before creating a new request, so one item cannot
 * collect two pending requests. (H-05)
 */
export function hasPending(assetId: number) {
```

### Shared (`shared/enums/assetStatus.ts`)

```ts
/**
 * Asset status values, as stored in asset_records.status.
 * Layer: shared. Imported by both server/ and web/. Imports nothing.
 * Used by: every workflow that reads or writes an asset's state.
 */
```

`shared/` never imports from `server/` or `web/`. Say so in the header when it is worth reminding.

---

## Before you commit

- [ ] Every file I created or moved has a file header with all five parts.
- [ ] Every exported function, component, and type has TSDoc.
- [ ] Every inline comment explains a *why*, not a *what*.
- [ ] Every comment about a known defect carries its finding ID.
- [ ] No history comments, no commented-out code, no "fixed X" claims.
- [ ] No comment says a defect is fixed when it is not. If it is still broken, it is a `TODO(<ID>)`.
- [ ] The comments are in their own commit, separate from the move (`docs(step N): add file headers and TSDoc`).

Last point matters: comment commits stay separate from move commits so git can detect moves as clean renames, and so a reviewer can check each one on its own.
