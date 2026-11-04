/**
 * Loans service: the business rules for loan requests, cancellations, Lab Head decisions, and the loan list, and the
 * one builder of the Loan shape.
 * Layer: service. Called by loans.controller.ts. Calls loans.repository.ts, features/assets/assets.repository.ts,
 * shared/services/lifecycleGuard.ts, shared/services/permissions.ts (the approver), shared/services/assetState.ts, and,
 * inside the step's transaction, shared/services/inspections.ts (the inspection writer) and shared/services/assetStatus.ts.
 * Used by: Researcher loan requests, Lab Head approval, TSG release, and the screens that list loans.
 */
import { asset_loans_status } from '@prisma/client';
import type { Loan, LoanListItem, LoanRequestBody } from '@shared/types/loans';
import type { Inspection } from '@shared/types/inspections';
import type { InspectionInput, PersonRef } from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import * as loansRepository from './loans.repository';
import type { LoanInspectionRow, LoanRow, LoanRows } from './loans.repository';
import * as assetsRepository from '../assets/assets.repository';
import { LOAN_STATUS_LABELS, WAITING_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { INSPECTION_TYPE_LABELS } from '@shared/constants/inspectionTypes';
import { ASSET_CONDITION_LABELS } from '@shared/enums/assetCondition';
import { CAMPUS_LABELS } from '@shared/constants/campuses';
import { isMetricFlagged } from '@shared/constants/metricFlagRules';
import { AppError } from '../../shared/errors/AppError';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';
import { NO_LAB_HEAD_MESSAGE, requireHomeLabHead, resolveLoanApprover } from '../../shared/services/permissions';
import { isOverdue, serverToday } from '../../shared/services/assetState';
import { writeInspection } from '../../shared/services/inspections';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { PICK_OWN_LAB_MESSAGE } from './loans.validation';

/** The 403 message when the account that heads a lab asks to borrow: it is the lab's office account. */
export const PERSONAL_ACCOUNT_MESSAGE = "Use your personal account to borrow.";

/**
 * The word the current loan screens compare against for each loan status ("Pending", "Approved"). An open loan is
 * still "approved" to them. Every other text about a loan uses LOAN_STATUS_LABELS.
 */
// TODO(H-07): today's loan screens still compare these words in the old GET /api/loans list. The map goes when the last screen moves to the new lists (Joel's loan screens).
const SCREEN_LOAN_WORDS: Record<asset_loans_status, string> = {
    PENDING_APPROVAL: "Pending",
    PENDING_RELEASE: "Pending release",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
    ON_LOAN: "Approved",
    RETURN_REQUESTED: "Return requested",
    RETURNED: "Returned",
    ENDED_BY_MAINTENANCE: "Ended by maintenance",
    ENDED_BY_LOSS: "Ended by loss",
};

/**
 * The word the current loan screens compare against: "Pending", "Approved", "Declined", "Returned".
 *
 * @param status the loan's status
 * @returns the word the screens compare against
 */
export function legacyLoanStatusLabel(status: asset_loans_status): string {
    return SCREEN_LOAN_WORDS[status];
}

/** A person row with the name fields the answers use. */
type NamedPerson = { user_id: number; first_name: string; last_name: string };

/**
 * The person as this viewer may see them: a Researcher (the "Custodian" app role) sees only their own name and id;
 * anyone else is `{ hidden: true }`. (D2)
 */
function personFor(viewer: SessionIdentity, person: NamedPerson | null): PersonRef | null {
    if (!person) return null;
    if (viewer.role === "Custodian" && person.user_id !== viewer.userId) return { hidden: true };
    return { userId: person.user_id, name: `${person.first_name} ${person.last_name}` };
}

/** A DATE column as yyyy-mm-dd. Prisma reads a DATE as midnight UTC, so the UTC date is the stored one. */
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** A date-time as ISO 8601, or null. */
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

/** An inspection row in the contract's Inspection shape, its metrics flagged against the asset's first values. */
function inspectionOf(row: LoanInspectionRow | null, baselines: Map<string, number>, viewer: SessionIdentity): Inspection | null {
    if (!row) return null;
    return {
        inspectionId: row.inspection_id,
        type: row.type,
        typeLabel: INSPECTION_TYPE_LABELS[row.type],
        inspectedBy: personFor(viewer, row.users)!,
        inspectedAt: row.inspected_at.toISOString(),
        condition: row.condition,
        conditionLabel: ASSET_CONDITION_LABELS[row.condition],
        healthScore: row.health_score,
        missingAccessories: row.missing_accessories,
        remarks: row.remarks,
        photo: row.photo,
        metrics: row.metrics.map(m => {
            const value = Number(m.value);
            const baseline = baselines.get(`${row.asset_id}:${m.metric_id}`) ?? null;
            return {
                metricId: m.metric_id,
                metricKey: m.metric_definitions.metric_key,
                name: m.metric_definitions.name,
                unit: m.metric_definitions.unit,
                value,
                flagged: isMetricFlagged(m.metric_definitions.metric_key, value, baseline),
            };
        }),
    };
}

/**
 * Builds the contract's Loan from a loan row. The destination lab comes from destination_center_id, never from the
 * purpose text, which is sent as stored. A Researcher gets no other person's name or id. (D2)
 *
 * @param row the loan row with its asset, people, project, destination lab, and inspections
 * @param baselines the metric baselines of its inspections
 * @param viewer the session user
 */
export function loanOf(row: LoanRow, baselines: Map<string, number>, viewer: SessionIdentity): Loan {
    return {
        loanId: row.loan_id,
        asset: { assetId: row.assets.asset_id, tag: row.assets.asset_tag, name: row.assets.name },
        borrower: personFor(viewer, row.users)!,
        status: row.status,
        statusLabel: LOAN_STATUS_LABELS[row.status],
        purpose: row.purpose,
        project: row.projects ? { projectId: row.projects.project_id, code: row.projects.project_code, name: row.projects.project_name } : null,
        destinationLab: row.destination_center ? { centerId: row.destination_center.center_id, code: row.destination_center.short_code } : null,
        destinationRoom: row.destination_room,
        returnBy: dateOnly(row.return_by),
        requestedAt: row.requested_at.toISOString(),
        decidedBy: personFor(viewer, row.decided_by),
        decidedAt: isoOrNull(row.decided_at),
        decisionRemarks: row.decision_remarks,
        releasedBy: personFor(viewer, row.released_by),
        releasedAt: isoOrNull(row.released_at),
        releaseInspection: inspectionOf(row.release_inspection, baselines, viewer),
        returnRequestedAt: isoOrNull(row.return_requested_at),
        receivedBy: personFor(viewer, row.received_by),
        returnInspection: inspectionOf(row.return_inspection, baselines, viewer),
        closedAt: isoOrNull(row.closed_at),
        remarks: row.remarks,
        isOverdue: isOverdue({ status: row.status, returnBy: row.return_by }),
    };
}

/** Every loan of some rows in the Loan shape. */
function loansOf({ rows, baselines }: LoanRows, viewer: SessionIdentity): Loan[] {
    return rows.map(row => loanOf(row, baselines, viewer));
}

/** One loan in the Loan shape, read after the step that changed it. */
async function loanById(loanId: number, viewer: SessionIdentity): Promise<Loan> {
    return loansOf(await loansRepository.findRows({ loan_id: loanId }, []), viewer)[0];
}

/**
 * Lists every loan, newest first, shaped for today's screens (the old list).
 * Every loan goes to every caller; the Lab Head screen keeps the loans of the lab it heads by `lab`, the asset's
 * home lab. (M-02)
 * A Custodian gets no borrower name on another person's loan (D2): `borrower_id` stays, because the asset modal
 * needs to know a loan is pending on the asset whoever asked, and the bell finds the caller's own loans by name.
 *
 * @param viewer the session user
 * @returns one LoanListItem per asset_loans row
 */
// TODO(M-02): scoping by lab happens only in the browser. Batch 3 adds GET /api/loans/lab-requests for the Lab Head.
export async function listLoans(viewer: SessionIdentity): Promise<LoanListItem[]> {
    const dbLoans = await loansRepository.findAllNewestFirst();

    const [dbUsers, dbAssets] = await loansRepository.findListLookups();

    const loans: LoanListItem[] = dbLoans.map(l => {
        const borrowerUser = dbUsers.find(u => u.user_id === l.borrower_id);
        const asset = dbAssets.find(a => a.asset_id === l.asset_id);
        // A loan belongs to the lab that owns the asset, its home lab, not to the borrower's own lab: a borrower from
        // another lab still asks the owning Lab Head.
        const homeLab = asset?.research_centers;

        return {
            id: `LOAN-${l.loan_id}`,
            loanId: l.loan_id,
            loan_id: l.loan_id,
            asset_id: l.asset_id,
            assetId: asset?.asset_tag || `EQ-2024-${l.asset_id}`,
            asset: asset?.name || "Unknown asset",
            assetName: asset?.name || "Unknown asset",
            borrower_id: l.borrower_id,
            borrower: borrowerUser ? `${borrowerUser.first_name} ${borrowerUser.last_name}` : `Borrower ID: ${l.borrower_id}`,
            purpose: l.purpose || "Research Project Use",
            destinationLab: l.destination_center?.short_code,
            requestedOn: l.requested_at ? l.requested_at.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            dueDate: l.return_by ? l.return_by.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: legacyLoanStatusLabel(l.status),
            statusLabel: LOAN_STATUS_LABELS[l.status],
            location: homeLab ? CAMPUS_LABELS[homeLab.location] : "",
            lab: homeLab?.short_code ?? "",
            center_id: homeLab?.center_id ?? null,
        };
    });

    return withoutOthersNames(loans, viewer);
}

/** For a Custodian, leaves the borrower name out of every loan that is not their own. Other roles get the list as is. (D2) */
function withoutOthersNames(loans: LoanListItem[], viewer: SessionIdentity): LoanListItem[] {
    if (viewer.role !== "Custodian") return loans;
    return loans.map(l => (l.borrower_id === viewer.userId ? l : { ...l, borrower: undefined }));
}

/**
 * Files a loan request, in Pending Approval. The asset stays Available; the lifecycle guard refuses an asset that is
 * not Available or already has an open loan, because two approvals would promise one item twice. (H-05, issue #54)
 * The guard runs inside a transaction that locks the asset first, so two requests at once give one loan. (#75)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: destination lab, room, project, return-by date, purpose
 * @param borrower the session user, who borrows as themselves (issue #32)
 * @returns the new loan in the Loan shape
 * @throws AppError 403 PERSONAL_ACCOUNT_MESSAGE if the account heads a lab (it is the lab's office account)
 * @throws AppError 400 if the return-by date is before today, the lab is not one of the borrower's, or the project does not exist
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 NO_LAB_HEAD_MESSAGE if the asset's lab has no Head to approve it
 * @throws AppError 409 if the guard refuses the request
 */
export async function requestLoan(assetTag: string, data: LoanRequestBody, borrower: SessionIdentity): Promise<Loan> {
    if (borrower.headOfCenterId !== null) throw new AppError(403, PERSONAL_ACCOUNT_MESSAGE);
    // Dates only, so a loan due today is accepted.
    if (data.returnBy < serverToday()) throw new AppError(400, "The return-by date cannot be in the past.");

    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) throw new AppError(404, `No asset found with tag ${assetTag}.`);
    if (!(await loansRepository.isMemberOf(borrower.userId, data.destinationCenterId))) {
        throw new AppError(400, PICK_OWN_LAB_MESSAGE);
    }
    if (data.projectId !== null && data.projectId !== undefined && !(await loansRepository.projectExists(data.projectId))) {
        throw new AppError(400, "Pick a project from the list.");
    }
    if ((await resolveLoanApprover(existing)) === null) throw new AppError(409, NO_LAB_HEAD_MESSAGE);

    const loan = await loansRepository.withAssetLock(existing.asset_id, async (tx) => {
        const asset = await loansRepository.findAssetIn(tx, existing.asset_id);
        assertActionAllowed(asset, "REQUEST_LOAN", await loansRepository.findOpenLoanIn(tx, asset.asset_id));
        return loansRepository.createLoan(tx, {
            asset_id: asset.asset_id,
            borrower_id: borrower.userId,
            purpose: data.purpose,
            return_by: new Date(data.returnBy),
            status: asset_loans_status.PENDING_APPROVAL,
            project_id: data.projectId ?? null,
            destination_center_id: data.destinationCenterId,
            destination_room: data.destinationRoom ?? null,
        });
    });
    return loanById(loan.loan_id, borrower);
}

/**
 * The loan with this id, or 404.
 *
 * @throws AppError 404 if no loan has this id
 */
async function existingLoan(loanId: number) {
    const loan = await loansRepository.findById(loanId);
    if (!loan) throw new AppError(404, `No loan found with id ${loanId}.`);
    return loan;
}

/** The 409 message for a loan whose status does not allow this step. */
function wrongStatus(loanId: number, status: asset_loans_status, step: string): string {
    return `Loan ${loanId} is ${LOAN_STATUS_LABELS[status]}, so it can no longer be ${step}.`;
}

/**
 * Cancels the borrower's own request while it waits for approval or release. The asset stays Available.
 *
 * @param loanId the loan
 * @param actor the session user, who must be the borrower
 * @returns the loan, Cancelled and closed
 * @throws AppError 404 if no loan has this id
 * @throws AppError 403 if the session user is not the borrower
 * @throws AppError 409 if the loan is not Pending Approval or Pending Release
 */
export async function cancelLoan(loanId: number, actor: SessionIdentity): Promise<Loan> {
    const loan = await existingLoan(loanId);
    if (loan.borrower_id !== actor.userId) throw new AppError(403, "Only the borrower can cancel this loan.");

    await loansRepository.withAssetLock(loan.asset_id, async (tx) => {
        const current = await loansRepository.findLoanIn(tx, loanId);
        if (!WAITING_LOAN_STATUSES.includes(current.status)) throw new AppError(409, wrongStatus(loanId, current.status, "cancelled"));
        await loansRepository.updateLoan(tx, loanId, { status: asset_loans_status.CANCELLED, closed_at: new Date() });
    });
    return loanById(loanId, actor);
}

/**
 * Approves or declines a loan in Pending Approval. Only the Head of the asset's home lab decides
 * (shared/services/permissions.ts resolveLoanApprover). Approval permits the loan: it goes to Pending Release and the
 * asset stays Available until TSG releases it, and the guard checks the asset is still Available. A decline closes
 * the loan and checks no asset status.
 *
 * @param loanId the loan
 * @param approve true to approve, false to decline
 * @param remarks the Head's remarks (required to decline, checked by the controller)
 * @param decider the session user who decides
 * @returns the loan, Pending Release or Declined
 * @throws AppError 404 if no loan has this id
 * @throws AppError 409 NO_LAB_HEAD_MESSAGE if the asset's lab has no Head
 * @throws AppError 403 if the session user is not the Head of the asset's home lab; the loan is unchanged
 * @throws AppError 409 if the loan is not Pending Approval, or an approval finds the asset no longer Available
 */
async function decideLoan(loanId: number, approve: boolean, remarks: string | null, decider: SessionIdentity): Promise<Loan> {
    const loan = await existingLoan(loanId);
    const asset = await assetsRepository.findById(loan.asset_id);
    if (!asset) throw new AppError(404, `No asset found for loan ${loanId}.`);
    await requireHomeLabHead(asset, decider.userId);

    await loansRepository.withAssetLock(loan.asset_id, async (tx) => {
        const current = await loansRepository.findLoanIn(tx, loanId);
        if (current.status !== asset_loans_status.PENDING_APPROVAL) throw new AppError(409, wrongStatus(loanId, current.status, "decided"));
        if (approve) assertActionAllowed(await loansRepository.findAssetIn(tx, loan.asset_id), "APPROVE_LOAN");
        const now = new Date();
        await loansRepository.updateLoan(tx, loanId, {
            status: approve ? asset_loans_status.PENDING_RELEASE : asset_loans_status.DECLINED,
            decided_by_id: decider.userId,
            decided_at: now,
            decision_remarks: remarks,
            ...(approve ? {} : { closed_at: now }),
        });
    });
    return loanById(loanId, decider);
}

/**
 * Approves a loan in Pending Approval: Pending Release, the asset stays Available. See decideLoan.
 *
 * @param loanId the loan
 * @param remarks optional remarks
 * @param decider the session user, the Head of the asset's home lab
 */
export function approveLoan(loanId: number, remarks: string | null, decider: SessionIdentity): Promise<Loan> {
    return decideLoan(loanId, true, remarks, decider);
}

/**
 * Declines a loan in Pending Approval: Declined and closed, the asset unchanged. See decideLoan.
 *
 * @param loanId the loan
 * @param remarks the reason, required
 * @param decider the session user, the Head of the asset's home lab
 */
export function declineLoan(loanId: number, remarks: string, decider: SessionIdentity): Promise<Loan> {
    return decideLoan(loanId, false, remarks, decider);
}

/**
 * TSG checks the asset and hands it to the borrower, in one transaction: a Loan Release inspection by the session
 * user, the loan On Loan with who released it and when, and the asset On Loan. The asset must still be Available.
 * From then on the borrower holds it at the loan's destination (shared/services/assetState.ts).
 *
 * @param loanId the loan
 * @param inspection the checked Loan Release inspection
 * @param releaser the session user, TSG (the route checks it)
 * @returns the loan, On Loan, with its release inspection
 * @throws AppError 404 if no loan has this id
 * @throws AppError 409 if the loan is not Pending Release, or the asset is no longer Available
 * @throws AppError 400 if a metric does not apply to the asset; nothing is written
 */
export async function releaseLoan(loanId: number, inspection: InspectionInput, releaser: SessionIdentity): Promise<Loan> {
    const loan = await existingLoan(loanId);

    await loansRepository.withAssetLock(loan.asset_id, async (tx) => {
        const current = await loansRepository.findLoanIn(tx, loanId);
        if (current.status !== asset_loans_status.PENDING_RELEASE) throw new AppError(409, wrongStatus(loanId, current.status, "released"));
        assertActionAllowed(await loansRepository.findAssetIn(tx, loan.asset_id), "RELEASE_LOAN");

        const row = await writeInspection(tx, { assetId: loan.asset_id, type: "LOAN_RELEASE", input: inspection, inspectorId: releaser.userId });
        await loansRepository.updateLoan(tx, loanId, {
            status: asset_loans_status.ON_LOAN,
            released_by_id: releaser.userId,
            released_at: new Date(),
            release_inspection_id: row.inspection_id,
        });
        await setAssetStatus(tx, loan.asset_id, "ON_LOAN");
    });
    return loanById(loanId, releaser);
}
