/**
 * The demo history's base: the clock every date is counted back from (the day the seed runs, so the history always
 * ends today), the row types, the IT Admin's account steps, and each asset's registration. Each row is written the way
 * the service that owns the step writes it (the same columns, the same activity_log details text).
 * Layer: database tooling. Read by prisma/seed.ts, seedSteps.ts and seedStory.ts. Imports Prisma's types and prisma/seedData.ts.
 * Used by: npm run seed.
 */
import type { Prisma, asset_condition, asset_inspections_type } from "@prisma/client";
import { DEMO_ACCOUNTS, DEMO_ASSETS, DEMO_IT_ADMIN_ID, DEMO_TSG_IDS, type DemoAccount, type DemoAsset } from "./seedData";

/** A moment or a day, counted back from the day the seed runs, in the computer's local time. */
export interface SeedClock {
  /** The local date-time `daysAgo` days before today, at the hour and minute given (seconds 0, for DATETIME(0)). */
  at(daysAgo: number, hour: number, minute?: number): Date;
  /** The local day `daysAgo` days before today, as a DATE column value (midnight UTC of that day). */
  day(daysAgo: number): Date;
}

/** The clock for a seed run that starts at `now`. */
export function clockFor(now: Date): SeedClock {
  const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()];
  return {
    at: (daysAgo, hour, minute = 0) => new Date(y, m, d - daysAgo, hour, minute, 0, 0),
    day: (daysAgo) => new Date(Date.UTC(y, m, d - daysAgo)),
  };
}

/** An activity_log row before its id. */
export type ActivityRow = Prisma.activity_logCreateManyInput & { created_at: Date };

/** What the IT Admin's account steps leave on one account row. */
export interface AccountDecision {
  status_decided_by_id: number | null;
  status_decided_at: Date | null;
  anonymized_at: Date | null;
}

/** Lab short codes in the order MySQL's utf8mb4_unicode_ci sorts them, as the users service lists them. */
export function sortCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** The account's display name, as the users service writes it into a HEAD_CHANGED row. */
export function nameOf(account: DemoAccount): string {
  return `${account.firstName} ${account.lastName}`;
}

/**
 * The IT Admin's steps on every account: approve or reject the sign-up, set a lab's Head, change a role or labs,
 * deactivate, and anonymize. Returns what each step leaves on the account row and its activity_log rows, with the
 * details texts of users.service.ts (contract 7.7).
 */
export function accountSteps(clock: SeedClock): { decisions: Map<number, AccountDecision>; activity: ActivityRow[] } {
  const decisions = new Map<number, AccountDecision>();
  const activity: ActivityRow[] = [];
  const log = (row: Omit<ActivityRow, "actor_id">) => activity.push({ actor_id: DEMO_IT_ADMIN_ID, ...row });

  for (const a of DEMO_ACCOUNTS) {
    const decision: AccountDecision = { status_decided_by_id: null, status_decided_at: null, anonymized_at: null };
    if (a.decidedDaysAgo !== null) {
      // Each account gets its own minute, so the IT Admin's rows of one day read in the order of the user ids.
      const decidedAt = clock.at(a.decidedDaysAgo, 9, a.userId);
      decision.status_decided_by_id = DEMO_IT_ADMIN_ID;
      decision.status_decided_at = decidedAt;
      if (a.status === "REJECTED") {
        log({ event_type: "SIGNUP_REJECTED", target_user_id: a.userId, details: a.rejectRemarks ?? null, created_at: decidedAt });
      } else {
        const labs = sortCodes(a.approvedLabs ?? a.labs);
        log({
          event_type: "SIGNUP_APPROVED", target_user_id: a.userId,
          details: `Role: ${a.approvedAs ?? a.role}; labs: ${labs.join(", ") || "none"}`, created_at: decidedAt,
        });
      }
    }
    if (a.heads && a.headSinceDaysAgo !== undefined) {
      log({
        event_type: "HEAD_CHANGED", target_user_id: a.userId,
        details: `${a.heads}: none to ${nameOf(a)}`, created_at: clock.at(a.headSinceDaysAgo, 10, a.userId),
      });
    }
    if (a.approvedAs && a.roleChangedDaysAgo !== undefined) {
      log({
        event_type: "ROLE_CHANGED", target_user_id: a.userId,
        details: `From ${a.approvedAs} to ${a.role}`, created_at: clock.at(a.roleChangedDaysAgo, 11, 15),
      });
    }
    if (a.approvedLabs && a.labsChangedDaysAgo !== undefined) {
      log({
        event_type: "LABS_CHANGED", target_user_id: a.userId,
        details: sortCodes(a.labs).join(", ") || "none", created_at: clock.at(a.labsChangedDaysAgo, 14, 5),
      });
    }
    if (a.deactivatedDaysAgo !== undefined) {
      const at = clock.at(a.deactivatedDaysAgo, 15, 30);
      decision.status_decided_at = at;
      log({ event_type: "USER_DEACTIVATED", target_user_id: a.userId, details: null, created_at: at });
    }
    if (a.anonymizedDaysAgo !== undefined) {
      const at = clock.at(a.anonymizedDaysAgo, 16, 0);
      decision.anonymized_at = at;
      log({ event_type: "USER_ANONYMIZED", target_user_id: a.userId, details: null, created_at: at });
    }
    decisions.set(a.userId, decision);
  }
  return { decisions, activity };
}

/** An inspection before its id, with its metric values by metric key. */
export interface InspectionRow {
  /** Given by the seed once every inspection is sorted by time. */
  id?: number;
  asset_id: number;
  inspected_by_id: number;
  inspected_at: Date;
  type: asset_inspections_type;
  condition: asset_condition;
  health_score: number;
  remarks: string | null;
  missing_accessories: string | null;
  metrics: Record<string, number>;
}

/** The lowest health score each condition gets, and how many points above it a score may go. */
const HEALTH_BANDS: Record<asset_condition, [number, number]> = {
  PERFECT: [96, 5], OPERATIONAL: [80, 7], MINOR_DRIFT: [58, 7], DEGRADED: [38, 7], CRITICAL_DEFECT: [15, 6],
};

/** A health score that matches the condition (near the form's suggestion), varied by `n` so the scores are not all equal. */
export function healthScoreFor(condition: asset_condition, n: number): number {
  const [low, spread] = HEALTH_BANDS[condition];
  return low + (n % spread);
}

/** A seeded asset with its id (its place in DEMO_ASSETS, from 1) and its lab's short code. */
export interface SeededAsset extends DemoAsset {
  assetId: number;
  lab: string;
}

/** Every demo asset with its id and lab. */
export const SEEDED_ASSETS: SeededAsset[] = DEMO_ASSETS.map((a, i) => ({ ...a, assetId: i + 1, lab: a.tag.split("-")[0] }));

/**
 * TSG registers each asset (assets.repository.ts): an Initial inspection by the TSG account and an ASSET_REGISTERED row
 * whose details are the tag. The assets of one lab are registered on one day, a few minutes apart.
 */
export function registrationSteps(clock: SeedClock): { inspections: InspectionRow[]; activity: ActivityRow[] } {
  const inspections: InspectionRow[] = [];
  const activity: ActivityRow[] = [];
  const perDay = new Map<number, number>();
  for (const a of SEEDED_ASSETS) {
    const n = perDay.get(a.registeredDaysAgo) ?? 0;
    perDay.set(a.registeredDaysAgo, n + 1);
    const at = clock.at(a.registeredDaysAgo, 9 + Math.floor((n * 7) / 60), (n * 7) % 60);
    const tsg = DEMO_TSG_IDS[a.assetId % 2];
    inspections.push({
      asset_id: a.assetId, inspected_by_id: tsg, inspected_at: at, type: "INITIAL", condition: a.condition,
      health_score: healthScoreFor(a.condition, a.assetId), remarks: "Registered and tagged.", missing_accessories: null,
      metrics: { ...a.metrics },
    });
    activity.push({ actor_id: tsg, event_type: "ASSET_REGISTERED", asset_id: a.assetId, details: a.tag, created_at: at });
  }
  return { inspections, activity };
}

