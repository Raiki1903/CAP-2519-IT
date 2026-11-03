/**
 * The lifecycle guard: which actions each asset status allows. One table, used by every service before a step.
 * Layer: shared service. Called by the services of features/loans, maintenance, retirements, inspections, and assets.
 * Calls shared/errors/AppError.ts and @shared (the status and loan labels).
 * Used by: every workflow that changes an asset or files a request on it.
 */
import type { assets_status } from '@prisma/client';
import { ASSET_STATUS_LABELS } from '@shared/enums/assetStatus';
import { LOAN_STATUS_LABELS, type LoanStatus } from '@shared/constants/loanStatuses';
import { AppError } from '../errors/AppError';

/** A step that the asset's status may allow or refuse. */
export type LifecycleAction =
    | "REQUEST_LOAN"
    | "START_MAINTENANCE"
    | "RECEIVE_FOR_MAINTENANCE"
    | "REQUEST_RETIREMENT"
    | "DECIDE_RETIREMENT"
    | "COMPLETE_RETIREMENT"
    | "MARK_MISSING"
    | "MARK_FOUND"
    | "EDIT_MASTER_DATA"
    | "ROUTINE_INSPECTION";

/** Every action, for tests and for screens that build a table from it. */
export const LIFECYCLE_ACTIONS: readonly LifecycleAction[] = [
    "REQUEST_LOAN",
    "START_MAINTENANCE",
    "RECEIVE_FOR_MAINTENANCE",
    "REQUEST_RETIREMENT",
    "DECIDE_RETIREMENT",
    "COMPLETE_RETIREMENT",
    "MARK_MISSING",
    "MARK_FOUND",
    "EDIT_MASTER_DATA",
    "ROUTINE_INSPECTION",
];

/**
 * The actions each status allows (docs/contracts/lifecycle.md, section 3). Pending Retirement allows only the
 * decision and, once approved, the completion; Retired allows nothing; Missing allows found and a retirement request.
 */
export const ALLOWED_ACTIONS: Record<assets_status, readonly LifecycleAction[]> = {
    AVAILABLE: ["REQUEST_LOAN", "START_MAINTENANCE", "RECEIVE_FOR_MAINTENANCE", "REQUEST_RETIREMENT", "MARK_MISSING", "EDIT_MASTER_DATA", "ROUTINE_INSPECTION"],
    ON_LOAN: ["START_MAINTENANCE", "RECEIVE_FOR_MAINTENANCE", "MARK_MISSING", "EDIT_MASTER_DATA"],
    MAINTENANCE: ["REQUEST_RETIREMENT", "EDIT_MASTER_DATA"],
    PENDING_RETIREMENT: ["DECIDE_RETIREMENT", "COMPLETE_RETIREMENT"],
    RETIRED: [],
    MISSING: ["MARK_FOUND", "REQUEST_RETIREMENT", "EDIT_MASTER_DATA"],
};

/** The words a refusal uses for each action. */
const ACTION_WORDS: Record<LifecycleAction, string> = {
    REQUEST_LOAN: "be requested for a loan",
    START_MAINTENANCE: "take a maintenance ticket",
    RECEIVE_FOR_MAINTENANCE: "be received for maintenance",
    REQUEST_RETIREMENT: "be requested for retirement",
    DECIDE_RETIREMENT: "have its retirement decided",
    COMPLETE_RETIREMENT: "have its retirement completed",
    MARK_MISSING: "be marked missing",
    MARK_FOUND: "be marked found",
    EDIT_MASTER_DATA: "be edited",
    ROUTINE_INSPECTION: "take a routine inspection",
};

/**
 * Whether an asset in this status may take this action.
 *
 * @param status the asset's stored status
 * @param action the step being asked for
 */
export function isActionAllowed(status: assets_status, action: LifecycleAction): boolean {
    return ALLOWED_ACTIONS[status].includes(action);
}

/** The parts of an asset the guard reads. */
export interface GuardedAsset {
    asset_tag: string;
    status: assets_status;
}

/** A loan that is in the way of a new request, as the derive helpers give it. */
export interface BlockingLoan {
    loanId: number;
    status: LoanStatus;
}

/**
 * Says why the asset may not take this action, or null when it may.
 * An open loan in Pending Approval or Pending Release keeps the asset Available but blocks a second loan request and
 * a retirement request, because approving both would promise one item twice. (H-05)
 *
 * @param asset the asset's tag and status
 * @param action the step being asked for
 * @param openLoan the asset's open loan, when the caller read it; only REQUEST_LOAN and REQUEST_RETIREMENT look at it
 * @returns the message for a 409 answer, or null
 */
export function refusalFor(asset: GuardedAsset, action: LifecycleAction, openLoan: BlockingLoan | null = null): string | null {
    if (!isActionAllowed(asset.status, action)) {
        return `${asset.asset_tag} is ${ASSET_STATUS_LABELS[asset.status]} and cannot ${ACTION_WORDS[action]}.`;
    }
    if ((action === "REQUEST_LOAN" || action === "REQUEST_RETIREMENT") && openLoan) {
        return `${asset.asset_tag} already has a loan in ${LOAN_STATUS_LABELS[openLoan.status]} (LOAN-${openLoan.loanId}).`;
    }
    return null;
}

/**
 * Refuses the step with 409 when the asset's status does not allow it. Call it before setAssetStatus and before any
 * request row is written.
 *
 * @param asset the asset's tag and status
 * @param action the step being asked for
 * @param openLoan the asset's open loan, for REQUEST_LOAN and REQUEST_RETIREMENT
 * @throws AppError 409 with the reason
 */
export function assertActionAllowed(asset: GuardedAsset, action: LifecycleAction, openLoan: BlockingLoan | null = null): void {
    const refusal = refusalFor(asset, action, openLoan);
    if (refusal) throw new AppError(409, refusal);
}
