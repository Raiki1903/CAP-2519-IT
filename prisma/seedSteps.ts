/**
 * The demo seed's step writers: a loan, a maintenance ticket, a retirement, a routine inspection and marking an asset
 * missing, each written with the columns its service writes. It also keeps track of when each asset is taken, so no two
 * loans of one asset overlap and nothing happens to an asset while it is away, and works out each asset's status.
 * Layer: database tooling. Read by prisma/seedStory.ts. Imports Prisma's types, prisma/seedData.ts and prisma/seedHistory.ts.
 * Used by: npm run seed.
 */
import type {
  asset_condition,
  asset_inspections_type,
  asset_loans_status,
  asset_maintenance_status,
  asset_maintenance_type,
  asset_retirements_pathway,
  asset_retirements_status,
  assets_status,
} from "@prisma/client";
import { DEMO_ACCOUNTS } from "./seedData";
import { healthScoreFor, SEEDED_ASSETS, type ActivityRow, type InspectionRow, type SeedClock, type SeededAsset } from "./seedHistory";

/** A loan before its id. Lab, project and inspections are named here and turned into ids by the seed. */
export interface LoanRow {
  asset_id: number;
  borrower_id: number;
  purpose: string;
  requested_at: Date;
  return_by: Date;
  status: asset_loans_status;
  projectCode: string | null;
  destinationLab: string;
  destination_room: string | null;
  decided_by_id: number | null;
  decided_at: Date | null;
  decision_remarks: string | null;
  released_by_id: number | null;
  released_at: Date | null;
  releaseInspection: InspectionRow | null;
  return_requested_at: Date | null;
  received_by_id: number | null;
  returnInspection: InspectionRow | null;
  closed_at: Date | null;
  remarks: string | null;
}

/** A maintenance ticket before its id. The issue type is named by its key. */
export interface TicketRow {
  asset_id: number;
  reported_by_id: number;
  issue_description: string;
  status: asset_maintenance_status;
  reported_at: Date;
  type: asset_maintenance_type;
  issueKey: string;
  warranty_override_reason: string | null;
  received_by_id: number | null;
  received_at: Date | null;
  provider: string | null;
  completed_by_id: number | null;
  completed_at: Date | null;
  resolution_remarks: string | null;
  triggerInspection: InspectionRow | null;
  completionInspection: InspectionRow | null;
}

/** A retirement before its id. */
export interface RetirementRow {
  asset_id: number;
  requested_by_id: number;
  requested_at: Date;
  reason: string;
  status: asset_retirements_status;
  pathway: asset_retirements_pathway | null;
  previous_status: assets_status;
  decided_by_id: number | null;
  decided_at: Date | null;
  decision_remarks: string | null;
  completed_by_id: number | null;
  completed_at: Date | null;
  disposition_reference: string | null;
  assessmentInspection: InspectionRow | null;
}

/** What TSG found at an inspection that is not a steady check: the condition and the notes it wrote. */
export interface Finding {
  condition: asset_condition;
  remarks: string;
  /** Metric values that differ from the asset's usual ones, by metric key. */
  metrics?: Record<string, number>;
  missingAccessories?: string;
}

/** The stage and the outcome of a ticket's work. */
export interface TicketWork {
  /** The stage the work is in, or was in before it ended. */
  stage?: { stage: "REPAIRING" | "EXTERNAL_SERVICE"; provider?: string; overrideReason?: string };
  completed?: { at: Date; by: number; outcome: "RESOLVED" | "BEYOND_REPAIR"; remarks: string; finding: Finding };
}

/** One loan's steps, each with its time. A step left out did not happen. */
export interface LoanPlan {
  tag: string;
  borrower: number;
  purpose: string;
  project?: string;
  /** The destination lab; the asset's home lab when left out. */
  destLab?: string;
  destRoom?: string | null;
  requested: Date;
  /** The return-by day, in days ago (negative for a day still to come). */
  returnBy: number;
  decided?: { at: Date; approve: boolean; remarks?: string | null };
  cancelled?: Date;
  released?: { at: Date; by: number };
  returnRequested?: { at: Date; remarks?: string | null };
  received?: {
    at: Date;
    by: number;
    finding?: Finding;
    /** Damage TSG found: the step also opens a Return Damage ticket (loans.service.ts receiveReturn). */
    damage?: { issue: string; description: string } & TicketWork;
  };
}

/** One ticket's steps. */
export interface TicketPlan extends TicketWork {
  tag: string;
  reporter: number;
  type: asset_maintenance_type;
  issue: string;
  description: string;
  reported: Date;
  received?: { at: Date; by: number; finding: Finding };
  /** The held loan that receiving the asset ends (Ended by Maintenance). */
  endsLoan?: LoanRow;
  cancelled?: { at: Date; by: number; remarks: string };
}

/** One retirement's steps. */
export interface RetirementPlan {
  tag: string;
  requestedBy: number;
  requested: Date;
  reason: string;
  pathway?: asset_retirements_pathway;
  previousStatus: assets_status;
  assessment?: Finding;
  decided?: { at: Date; by: number; approve: boolean; remarks: string | null };
  completed?: { at: Date; by: number; pathway: asset_retirements_pathway; reference: string };
}

/** A span of time an asset is taken; `to` null means from then on. */
interface Busy {
  from: Date;
  to: Date | null;
}

const HOUR_MS = 60 * 60 * 1000;

/** The ticket statuses that keep an asset in Maintenance. */
const IN_WORK: readonly asset_maintenance_status[] = ["INSPECTING", "REPAIRING", "EXTERNAL_SERVICE", "BEYOND_REPAIR"];

/** A metric value for a steady check: the asset's usual value with a small change that no flag rule catches. */
function steadyValue(key: string, base: number, n: number): number {
  const value = (() => {
    switch (key) {
      case "CPU_LOAD_TEMP": return base + ((n * 7) % 5) - 2;
      case "BATTERY_CAPACITY": return base - (n % 3);
      case "READ_SPEED": return base * (1 - (n % 4) / 100);
      case "PACKET_LOSS": return 0.1 + (n % 4) / 10;
      case "SENSOR_DRIFT": return Math.max(0.1, base + ((n % 5) - 2) / 10);
      case "MOTOR_SPEED": return base * (1 + ((n % 5) - 2) / 100);
      default: return base;
    }
  })();
  return Math.round(value * 100) / 100;
}

/** Writes the history one step at a time. */
export class HistoryBuilder {
  readonly inspections: InspectionRow[] = [];
  readonly loans: LoanRow[] = [];
  readonly tickets: TicketRow[] = [];
  readonly retirements: RetirementRow[] = [];
  readonly activity: ActivityRow[] = [];
  /** Inspections whose condition is the asset's condition at that time (a check that found nothing new). */
  private readonly steady = new Set<InspectionRow>();
  private readonly busy = new Map<number, Busy[]>();
  private readonly missing = new Set<number>();
  private readonly heads: Map<string, { userId: number; since: Date }>;
  private readonly byTag = new Map(SEEDED_ASSETS.map((a) => [a.tag, a]));

  constructor(readonly clock: SeedClock, initial: InspectionRow[]) {
    this.inspections.push(...initial);
    this.heads = new Map(
      DEMO_ACCOUNTS.filter((a) => a.heads && a.headSinceDaysAgo !== undefined).map((a) => [
        a.heads!,
        { userId: a.userId, since: clock.at(a.headSinceDaysAgo!, 10, a.userId) },
      ]),
    );
  }

  /** The asset with this tag. */
  asset(tag: string): SeededAsset {
    const asset = this.byTag.get(tag);
    if (!asset) throw new Error(`No demo asset has the tag ${tag}.`);
    return asset;
  }

  /** When TSG registered the asset (its Initial inspection). */
  registeredAt(asset: SeededAsset): Date {
    return this.inspections.find((i) => i.asset_id === asset.assetId && i.type === "INITIAL")!.inspected_at;
  }

  /** The Head of the lab at that moment, or null when the lab had none yet. */
  headAt(lab: string, at: Date): number | null {
    const head = this.heads.get(lab);
    return head && head.since <= at ? head.userId : null;
  }

  /** Whether nothing takes the asset from `from` to `to` (null: from then on), an hour apart, and it was registered before. */
  isFree(asset: SeededAsset, from: Date, to: Date | null): boolean {
    if (from <= this.registeredAt(asset)) return false;
    const end = (to ?? new Date(8.64e15)).getTime();
    return (this.busy.get(asset.assetId) ?? []).every(
      (b) => end + HOUR_MS <= b.from.getTime() || (b.to !== null && b.to.getTime() + HOUR_MS <= from.getTime()),
    );
  }

  /** Marks the asset taken; throws if something already takes it then, which is a mistake in the story. */
  private take(asset: SeededAsset, from: Date, to: Date | null, what: string): void {
    if (!this.isFree(asset, from, to)) throw new Error(`${asset.tag} is not free for ${what} at ${from.toISOString()}.`);
    const list = this.busy.get(asset.assetId) ?? [];
    list.push({ from, to });
    this.busy.set(asset.assetId, list);
  }

  /** Adds one activity_log row. */
  log(row: ActivityRow): void {
    this.activity.push(row);
  }

  /**
   * One inspection (shared/services/inspections.ts writeInspection). With no finding it is a steady check, which keeps
   * the condition and the metric values TSG found last.
   */
  private inspect(asset: SeededAsset, type: asset_inspections_type, at: Date, by: number, finding?: Finding, remarks?: string): InspectionRow {
    const row: InspectionRow = {
      asset_id: asset.assetId, inspected_by_id: by, inspected_at: at, type,
      condition: finding?.condition ?? asset.condition, health_score: 0,
      remarks: finding?.remarks ?? remarks ?? null, missing_accessories: finding?.missingAccessories ?? null,
      metrics: { ...finding?.metrics },
    };
    if (!finding) this.steady.add(row);
    this.inspections.push(row);
    return row;
  }

  /** A Routine inspection, on an Available asset that is at home (inspections.service.ts). */
  routine(asset: SeededAsset, at: Date, by: number, finding?: Finding): InspectionRow {
    this.take(asset, at, new Date(at.getTime() + HOUR_MS), "a routine inspection");
    return this.inspect(asset, "ROUTINE", at, by, finding, "Routine check: works as expected.");
  }

  /**
   * One loan through its steps (loans.service.ts): request; then decline, cancel, or approve and release; then a return
   * request and TSG's receipt. The Head of the asset's home lab at that time decides.
   */
  loan(plan: LoanPlan): LoanRow {
    const asset = this.asset(plan.tag);
    const row: LoanRow = {
      asset_id: asset.assetId, borrower_id: plan.borrower, purpose: plan.purpose, requested_at: plan.requested,
      return_by: this.clock.day(plan.returnBy), status: "PENDING_APPROVAL", projectCode: plan.project ?? null,
      destinationLab: plan.destLab ?? asset.lab, destination_room: plan.destRoom ?? null,
      decided_by_id: null, decided_at: null, decision_remarks: null, released_by_id: null, released_at: null,
      releaseInspection: null, return_requested_at: null, received_by_id: null, returnInspection: null, closed_at: null, remarks: null,
    };
    if (plan.decided) {
      const head = this.headAt(asset.lab, plan.decided.at);
      if (head === null) throw new Error(`${asset.lab} has no Head to decide the loan of ${asset.tag}.`);
      Object.assign(row, {
        status: plan.decided.approve ? "PENDING_RELEASE" : "DECLINED",
        decided_by_id: head, decided_at: plan.decided.at, decision_remarks: plan.decided.remarks ?? null,
        closed_at: plan.decided.approve ? null : plan.decided.at,
      });
    }
    if (plan.cancelled) Object.assign(row, { status: "CANCELLED", closed_at: plan.cancelled });
    if (plan.released) {
      row.releaseInspection = this.inspect(asset, "LOAN_RELEASE", plan.released.at, plan.released.by, undefined, "Checked with the borrower at release.");
      Object.assign(row, { status: "ON_LOAN", released_by_id: plan.released.by, released_at: plan.released.at });
    }
    if (plan.returnRequested) {
      Object.assign(row, { status: "RETURN_REQUESTED", return_requested_at: plan.returnRequested.at, remarks: plan.returnRequested.remarks ?? null });
    }
    if (plan.received) {
      const { at, by, finding } = plan.received;
      row.returnInspection = this.inspect(asset, "RETURN", at, by, finding, "Returned complete.");
      Object.assign(row, { status: "RETURNED", received_by_id: by, closed_at: at });
    }
    this.take(asset, plan.requested, row.closed_at, `a loan (${plan.purpose})`);
    this.loans.push(row);

    const damage = plan.received?.damage;
    if (damage) {
      const { at, by } = plan.received!;
      this.workOn(asset, {
        asset_id: asset.assetId, reported_by_id: by, issue_description: damage.description, status: "INSPECTING", reported_at: at,
        type: "RETURN_DAMAGE", issueKey: damage.issue, warranty_override_reason: null, received_by_id: by, received_at: at,
        provider: null, completed_by_id: null, completed_at: null, resolution_remarks: null,
        triggerInspection: row.returnInspection, completionInspection: null,
      }, damage, new Date(at.getTime() + HOUR_MS));
    }
    return row;
  }

  /** The stage and the end of a ticket's work (maintenance.service.ts start, stage and complete), and the time it takes the asset. */
  private workOn(asset: SeededAsset, row: TicketRow, work: TicketWork, takeFrom: Date): TicketRow {
    if (work.stage) {
      row.status = work.stage.stage;
      row.provider = work.stage.provider ?? null;
      row.warranty_override_reason = work.stage.overrideReason ?? null;
    }
    if (work.completed) {
      const c = work.completed;
      row.completionInspection = this.inspect(asset, "MAINTENANCE", c.at, c.by, c.finding);
      Object.assign(row, { status: c.outcome, completed_by_id: c.by, completed_at: c.at, resolution_remarks: c.remarks });
    }
    // Beyond Repair keeps the asset in Maintenance until a retirement is requested, and the retirement keeps it for good.
    this.take(asset, takeFrom, row.status === "RESOLVED" ? row.completed_at : null, `a ticket (${row.issue_description})`);
    this.tickets.push(row);
    return row;
  }

  /** One maintenance ticket through its steps: report, then cancel, or receive, stage and complete. */
  ticket(plan: TicketPlan): TicketRow {
    const asset = this.asset(plan.tag);
    const row: TicketRow = {
      asset_id: asset.assetId, reported_by_id: plan.reporter, issue_description: plan.description, status: "PENDING_RECEIPT",
      reported_at: plan.reported, type: plan.type, issueKey: plan.issue, warranty_override_reason: null,
      received_by_id: null, received_at: null, provider: null, completed_by_id: null, completed_at: null, resolution_remarks: null,
      triggerInspection: null, completionInspection: null,
    };
    if (plan.cancelled) {
      // Cancelling also sets completed_by and completed_at: no other column holds who cancelled and when.
      Object.assign(row, { status: "CANCELLED", completed_by_id: plan.cancelled.by, completed_at: plan.cancelled.at, resolution_remarks: plan.cancelled.remarks });
      this.take(asset, plan.reported, plan.cancelled.at, "a cancelled ticket");
      this.tickets.push(row);
      return row;
    }
    if (plan.received) {
      const r = plan.received;
      row.triggerInspection = this.inspect(asset, "MAINTENANCE", r.at, r.by, r.finding);
      Object.assign(row, { status: "INSPECTING", received_by_id: r.by, received_at: r.at });
      if (plan.endsLoan) Object.assign(plan.endsLoan, { status: "ENDED_BY_MAINTENANCE", closed_at: r.at });
    }
    // A held loan stays with the holder until TSG receives the asset, so such a ticket takes the asset from the receipt.
    const takeFrom = plan.endsLoan ? new Date(row.received_at!.getTime() + HOUR_MS) : plan.reported;
    if (plan.endsLoan) this.extendLoan(plan.endsLoan);
    return this.workOn(asset, row, plan, takeFrom);
  }

  /** Closes the time an ended loan takes its asset at the loan's closing. */
  private extendLoan(loan: LoanRow): void {
    const list = this.busy.get(loan.asset_id) ?? [];
    const span = list.find((b) => b.from.getTime() === loan.requested_at.getTime());
    if (span) span.to = loan.closed_at;
  }

  /** One retirement through its steps (retirements.service.ts): request, then a decision, then completion. */
  retirement(plan: RetirementPlan): RetirementRow {
    const asset = this.asset(plan.tag);
    const row: RetirementRow = {
      asset_id: asset.assetId, requested_by_id: plan.requestedBy, requested_at: plan.requested, reason: plan.reason,
      status: "PENDING", pathway: plan.pathway ?? null, previous_status: plan.previousStatus,
      decided_by_id: null, decided_at: null, decision_remarks: null, completed_by_id: null, completed_at: null,
      disposition_reference: null,
      assessmentInspection: plan.assessment ? this.inspect(asset, "RETIREMENT", plan.requested, plan.requestedBy, plan.assessment) : null,
    };
    if (plan.decided) {
      if (plan.decided.by === plan.requestedBy) throw new Error("The requester never decides their own retirement.");
      Object.assign(row, {
        status: plan.decided.approve ? "APPROVED" : "DENIED", decided_by_id: plan.decided.by,
        decided_at: plan.decided.at, decision_remarks: plan.decided.remarks,
      });
    }
    if (plan.completed) {
      Object.assign(row, {
        status: "COMPLETED", pathway: plan.completed.pathway, disposition_reference: plan.completed.reference,
        completed_by_id: plan.completed.by, completed_at: plan.completed.at,
      });
    }
    // From Maintenance, the Beyond Repair ticket already takes the asset for good.
    if (plan.previousStatus !== "MAINTENANCE") {
      this.take(asset, plan.requested, row.status === "DENIED" ? row.decided_at : null, "a retirement");
    }
    this.retirements.push(row);
    return row;
  }

  /**
   * TSG marks the asset missing (assets.service.ts): an ASSET_MARKED_MISSING row with the reason, and the held loan
   * ends (Ended by Loss) in the same step.
   */
  markMissing(loan: LoanRow, at: Date, by: number, reason: string): void {
    const asset = SEEDED_ASSETS[loan.asset_id - 1];
    Object.assign(loan, { status: "ENDED_BY_LOSS", closed_at: at });
    this.extendLoan(loan);
    this.take(asset, new Date(at.getTime() + HOUR_MS), null, "being missing");
    this.missing.add(asset.assetId);
    this.log({ actor_id: by, event_type: "ASSET_MARKED_MISSING", asset_id: asset.assetId, details: reason, created_at: at });
  }

  /** The asset's newest TSG inspection before `before` (every type but Self Report), or null. */
  lastTsgInspection(asset: SeededAsset, before: Date): Date | null {
    let latest: Date | null = null;
    for (const i of this.inspections) {
      if (i.asset_id === asset.assetId && i.type !== "SELF_REPORT" && i.inspected_at < before && (!latest || i.inspected_at > latest)) latest = i.inspected_at;
    }
    return latest;
  }

  /**
   * Gives every steady check the condition and metric values of the asset's newest TSG inspection before it, and every
   * inspection a health score that matches its condition. Returns each asset's status now, worked out from its rows the
   * way the services leave it.
   */
  settle(): Map<number, assets_status> {
    const order = new Map(this.inspections.map((row, i) => [row, i]));
    const sorted = [...this.inspections].sort((a, b) => a.inspected_at.getTime() - b.inspected_at.getTime() || order.get(a)! - order.get(b)!);
    const condition = new Map<number, asset_condition>();
    sorted.forEach((row, n) => {
      const asset = SEEDED_ASSETS[row.asset_id - 1];
      const usual = asset.metrics ?? {};
      if (this.steady.has(row)) row.condition = condition.get(row.asset_id) ?? asset.condition;
      if (row.type !== "INITIAL") {
        row.metrics = Object.fromEntries(Object.keys(usual).map((key) => [key, row.metrics[key] ?? steadyValue(key, usual[key], n)]));
      }
      row.health_score = healthScoreFor(row.condition, n + row.asset_id);
      condition.set(row.asset_id, row.condition);
    });

    const statuses = new Map<number, assets_status>();
    for (const asset of SEEDED_ASSETS) {
      const id = asset.assetId;
      const retirement = this.retirements.find((r) => r.asset_id === id && r.status !== "DENIED");
      const newestTicket = this.tickets.filter((t) => t.asset_id === id).sort((a, b) => b.reported_at.getTime() - a.reported_at.getTime())[0];
      const held = this.loans.some((l) => l.asset_id === id && (l.status === "ON_LOAN" || l.status === "RETURN_REQUESTED"));
      let status: assets_status = "AVAILABLE";
      if (retirement?.status === "COMPLETED") status = "RETIRED";
      else if (retirement) status = "PENDING_RETIREMENT";
      else if (this.missing.has(id)) status = "MISSING";
      else if (newestTicket && IN_WORK.includes(newestTicket.status)) status = "MAINTENANCE";
      else if (held) status = "ON_LOAN";
      statuses.set(id, status);
    }
    return statuses;
  }
}
