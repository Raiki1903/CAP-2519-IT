# legacy/repair-alert-card

**Do not import anything from this folder. Do not study it as an example of how the project works.**

One repair widget, moved here on 2026-10-08 (team decision on the step 8 part 2 notes). It was cut out of `ITSDashboard.tsx` in step 8 part 2 and placed in `web/features/repairs/`, but no page rendered it before or after the split, so nobody ever saw it. Moving it changed no behavior.

- Excluded from the TypeScript check and the Vite build: `tsconfig.json` lists `legacy` under `exclude`, and nothing imports this file.
- The file is unchanged from its last live location, header included. Its imports use the `@web/...` aliases, so they still resolve.

---

## What is here

| File | Component | Data | Notes |
|---|---|---|---|
| `RepairAlertCard.tsx` | `RepairAlertCard` | One `RepairRequest` (the type from `web/state/serverData.tsx`), passed in as a prop | A large card for one High or Critical repair ticket, with Acknowledge and a Full Report toggle. It calls no API itself: acknowledging goes through its `onAcknowledge` prop. Its pulse animation names a `pulseAlert` keyframe that no stylesheet defines, so the card would not pulse |

It still shows the repair's forwarding department as ITS, TSG, or "TSG & ITS". That is the department a ticket was sent to (data), not the app role, so it is correct after step 9 merged ITS and TSG into Staff.

## Bringing it back

Move it into `web/features/repairs/`, render it from a page (the Staff Repairs page is the natural place, for unacknowledged High and Critical tickets), pass `handleAcknowledgeRepair` from `useRepairTickets()` as `onAcknowledge`, and give it the file header and TSDoc required by [CODE-COMMENTS.md](../../docs/guides/CODE-COMMENTS.md). Add the `pulseAlert` keyframes or drop the animation.
