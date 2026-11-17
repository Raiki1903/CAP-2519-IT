# Delete a lab that was added by mistake (#196)

**Owner:** Aryan. **Reviewer:** Raiki, then the advisor (it deletes a row). **Save as:** `docs/tasks/196-delete-unused-lab.md` (first commit).
**Agent:** your usual agent on its strongest model, high effort. Give it this file and `AGENTS.md`. Work in stops: plan first, wait for "go", then build.
**Branch:** `feat/196-delete-unused-lab` from a fresh `main` **after Raiki merges #194** (the Reference Data page and its routes). Run `npm run prisma:generate` after pulling.
**Rules:** `AGENTS.md`. **No change in `prisma/`** or `package.json`. No new package. No migration (the log type `REFERENCE_DATA_CHANGED` already exists). No em dashes. Typecheck stays at 19, build passes, tests: the count on `main` plus yours, all passing.
**Due:** PR by **Wed Nov 18, 6 pm**. In the Nov 20 deploy only if merged and green by Thu Nov 19, 3 pm.

**Scope:** delete a lab that nothing uses. **Not in scope:** making a lab inactive (needs a schema change; goes to Recommendations), deleting categories or funding sources, changing a lab's short code.

---

## Commits, in order

1. `docs(reference): task file for deleting an unused lab (#196)`: this file. **Commit it yourself before the agent starts.**
2. `feat(reference): delete a lab that nothing uses (#196)`: server route, service, repository, tests.
3. `feat(web): Delete on the Labs tab (#196)`.
4. `docs(reference): contract and test count (#196)`: `docs/contracts/lifecycle.md` section 7.11 (the new route and its log row), `AGENTS.md` test count.

## When a lab is "in use"

A lab is in use if **any** of these is true. These are the five places `research_centers` is pointed at in `prisma/schema.prisma`:

| What | Where |
|---|---|
| An asset has it as home lab, **any status, Retired too** | `assets.center_id` |
| A user is linked to it, **Pending sign-ups too** | `user_centers.center_id` |
| It has a Lab Head | `research_centers.head_user_id` is not null |
| A project belongs to it | `projects.center_id` |
| A loan was sent to it, **any status, past ones too** | `asset_loans.destination_center_id` |

## Points to get right (read these twice)

- **Check inside the transaction, after the lock.** In one `prisma.$transaction`: `lockCenter(tx, centerId)` (from `server/shared/services/rowLocks.ts`, the same lock Register Asset and the import take), then count the five things above with `tx`, then delete, then log. A check done before the transaction is not enough: an asset could be registered in between.
- **Never delete or change anything else.** No cascade, no clearing a Lab Head, no unlinking members. If anything uses the lab, refuse and change nothing.
- **The refusal says what uses it.** 409, for example: "This lab is in use and can't be deleted: 3 assets, 1 member, a Lab Head. Rename it instead." Name only the things that are non-zero.
- **Log in the same transaction:** `REFERENCE_DATA_CHANGED`, actor from the session, details `Lab deleted: <short code> (<name>)`. Use the same logging the other reference changes use in `reference.repository.ts`.
- **Five layers,** like the other reference routes: `reference.routes.ts` (`...editor`), `reference.validation.ts` (read the id), `reference.controller.ts`, `reference.service.ts`, `reference.repository.ts` (the only file that calls Prisma).
- **Only change what this brief lists.** If another file must change, say which and why in the report.
- **Every rule below has a test.** Write the test, see it fail, then make it pass.

## Server

`DELETE /api/reference/labs/:centerId`, `requireAuth, requireActive, requireAssetMasterEditor` (the `editor` list in `reference.routes.ts`).
- Unknown id: 404 "No lab found with id <id>." (the same sentence `changeLab` uses).
- In use: 409 with the sentence above.
- Deleted: 200 `{ success: true }`.
- **The lab list** (`GET /api/reference/labs`) gains `canDelete: boolean` on each lab (true when all five counts are zero), so the page shows Delete only where it can work. Add it to `ReferenceLab` in `shared/types/reference.ts` with a TSDoc line. The server still checks again on delete.

## Tests

Add to `tests/api/referenceData.test.ts`, at least:
- TSG adds a lab and deletes it: 200, the lab is gone from `GET /api/reference/labs` and from `GET /api/lookups`, and one `REFERENCE_DATA_CHANGED` row "Lab deleted: ..." exists.
- After the delete, a new lab with the same short code can be added.
- The Secretary can delete an unused lab too.
- 409 and nothing changes, one test each: a lab with an active asset, with only a Retired asset, with a member, with a Lab Head, with a project, with a loan sent to it. Check that the lab is still there after each.
- `canDelete` is true for an unused lab and false for a seeded lab.
- Unknown id: 404. Not logged in: 401. The Director, a Lab Head, a Researcher and the IT Admin: 403.

## Web

- `web/api/reference.api.ts`: `deleteLab(centerId)`. Use `readResult`, like the other calls there.
- **Labs tab** (`web/features/reference/LabsSection.tsx`): a "Delete" action on rows where `canDelete` is true, next to Edit. A confirm dialog: "Delete lab <short code> (<name>)? This can't be undone." with Cancel and Delete (destructive style, like other delete confirms in the app). On success: the row disappears, a short success message, and call `forgetFormLookups()` so Register Asset drops the lab without a reload. On error: show the server's sentence.
- Rows that can't be deleted show no Delete action.

## Hand checks (local UAT copy, `adric_uat_check`)

- D-H1. TSG, Reference Data, Labs: add "Typo Lab", short code TYPO. It shows Delete; the seeded labs don't.
- D-H2. Delete TYPO: confirm dialog, then it's gone. Register Asset (no reload): TYPO is not in the lab list.
- D-H3. Add a lab with short code TYPO again: it works. Register one asset in it. Back on Labs: TYPO no longer shows Delete.
- D-H4. IT Admin, Activity Log, filter "Reference data changed": the add, delete and second add rows are there.
- D-H5. typecheck 19, build passes, tests all pass (say the new count).

## Report (to Raiki, not the PR)

At the end, report in the AGENTS.md format: what changed commit by commit, the three check results, the hand checks, questions, anything not done. **Don't write the PR description:** Raiki sends the report to the advisor, who writes it.
