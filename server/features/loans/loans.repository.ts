/**
 * Loan row access: every database read and write the loan endpoints make.
 * Layer: repository. Called by loans.service.ts. Calls server/config/prisma.ts, shared/services/rowLocks.ts,
 * shared/services/assetState.ts (the open loan, read inside the lock, and clearance), shared/services/activityLog.ts, and
 * shared/services/inspectionShape.ts (what an inspection includes, and its metric baselines).
 * Used by: Researcher loan requests, Lab Head approval, TSG release and receipt, the loan lists, the Accountability
 * Form, and the clearance record.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { lockAsset } from '../../shared/services/rowLocks';
import { isCleared, openLoanOf } from '../../shared/services/assetState';
import { logActivity } from '../../shared/services/activityLog';
import { INSPECTION_INCLUDE, PERSON, metricBaselinesOf } from '../../shared/services/inspectionShape';

/** What a loan read for the Loan shape includes. */
const LOAN_INCLUDE = {
    assets: { select: { asset_id: true, asset_tag: true, name: true } },
    users: PERSON,
    decided_by: PERSON,
    released_by: PERSON,
    received_by: PERSON,
    projects: { select: { project_id: true, project_code: true, project_name: true } },
    destination_center: { select: { center_id: true, short_code: true } },
    release_inspection: { include: INSPECTION_INCLUDE },
    return_inspection: { include: INSPECTION_INCLUDE },
} satisfies Prisma.asset_loansInclude;

/** A loan row with everything the Loan shape names. */
export type LoanRow = Prisma.asset_loansGetPayload<{ include: typeof LOAN_INCLUDE }>;

/** Loan rows for the Loan shape, with the metric baselines their inspections are flagged against. */
export interface LoanRows {
    rows: LoanRow[];
    /** The asset's first recorded value of each metric, keyed "<assetId>:<metricId>". */
    baselines: Map<string, number>;
}

/** Every asset_loans row, newest request first, with its destination lab's code. */
export function findAllNewestFirst() {
    return prisma.asset_loans.findMany({
        orderBy: { requested_at: 'desc' },
        include: { destination_center: { select: { short_code: true } } },
    });
}

/**
 * Every user and asset (with its home lab), read together so the list can name each loan's borrower, asset, and lab.
 *
 * @returns [users, assets with research_centers]
 */
export function findListLookups() {
    return Promise.all([
        prisma.users.findMany(),
        prisma.assets.findMany({ include: { research_centers: true } }),
    ]);
}

/**
 * Loan rows in the Loan shape's detail, and the metric baselines of their inspections, in two queries whatever the
 * number of loans.
 *
 * @param where which loans
 * @param orderBy their order
 */
export async function findRows(where: Prisma.asset_loansWhereInput, orderBy: Prisma.asset_loansOrderByWithRelationInput[]): Promise<LoanRows> {
    const rows = await prisma.asset_loans.findMany({ where, orderBy, include: LOAN_INCLUDE });
    return { rows, baselines: await metricBaselinesOf(prisma, rows.flatMap(r => [r.release_inspection, r.return_inspection]).filter(i => i !== null)) };
}

/** The loan with this id, or null. Its asset never changes, so a step reads it first to know which asset to lock. */
export function findById(loanId: number) {
    return prisma.asset_loans.findUnique({ where: { loan_id: loanId } });
}

/** Whether the person belongs to the lab (user_centers). */
export async function isMemberOf(userId: number, centerId: number): Promise<boolean> {
    return (await prisma.user_centers.count({ where: { user_id: userId, center_id: centerId } })) > 0;
}

/** Whether a project with this id exists. */
export async function projectExists(projectId: number): Promise<boolean> {
    return (await prisma.projects.count({ where: { project_id: projectId } })) > 0;
}

/**
 * Runs one loan step in a transaction that locks the asset row first. The step then reads the loan and the asset
 * again inside the lock and checks them, so two steps on one asset run one after the other and the second sees what
 * the first wrote. Every step locks the asset before anything else, so no two steps wait on each other. (H-05)
 *
 * @param assetId the loan's asset
 * @param step the reads, checks, and writes, given the transaction
 * @returns what the step returns
 */
export function withAssetLock<T>(assetId: number, step: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, assetId);
        return step(tx);
    });
}

/** The asset row, read inside the caller's transaction. */
export function findAssetIn(tx: Prisma.TransactionClient, assetId: number) {
    return tx.assets.findUniqueOrThrow({ where: { asset_id: assetId } });
}

/** The loan row, read inside the caller's transaction. */
export function findLoanIn(tx: Prisma.TransactionClient, loanId: number) {
    return tx.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } });
}

/** The asset's open loan, read inside the caller's transaction. */
export function findOpenLoanIn(tx: Prisma.TransactionClient, assetId: number) {
    return openLoanOf(tx, assetId);
}

/** Inserts an asset_loans row inside the caller's transaction and returns it. */
export function createLoan(tx: Prisma.TransactionClient, data: Prisma.asset_loansUncheckedCreateInput) {
    return tx.asset_loans.create({ data });
}

/** Changes a loan row inside the caller's transaction and returns it. */
export function updateLoan(tx: Prisma.TransactionClient, loanId: number, data: Prisma.asset_loansUncheckedUpdateInput) {
    return tx.asset_loans.update({ where: { loan_id: loanId }, data });
}

/** Whether an issue type with this id exists. */
export async function issueTypeExists(issueTypeId: number): Promise<boolean> {
    return (await prisma.issue_types.count({ where: { issue_type_id: issueTypeId } })) > 0;
}

/** Inserts an asset_maintenance row inside the caller's transaction and returns it. */
export function createMaintenance(tx: Prisma.TransactionClient, data: Prisma.asset_maintenanceUncheckedCreateInput) {
    return tx.asset_maintenance.create({ data });
}

/** A person's name, ID number, email, and labs, or null when there is no such account. */
export function findPerson(userId: number) {
    return prisma.users.findUnique({
        where: { user_id: userId },
        select: {
            user_id: true,
            first_name: true,
            last_name: true,
            id_number: true,
            email: true,
            user_centers: { select: { research_centers: { select: { center_id: true, short_code: true } } }, orderBy: { center_id: 'asc' } },
        },
    });
}

/** Whether the person has no loan in Pending Release, On Loan, or Return Requested. */
export function findCleared(userId: number) {
    return isCleared(prisma, userId);
}

/**
 * Writes the CLEARANCE_RECORD_PRINTED row: TSG as the actor, the person as the target, no details.
 *
 * @param actorId the session user, TSG
 * @param targetUserId the person whose record was printed
 */
export function logClearancePrinted(actorId: number, targetUserId: number) {
    return prisma.$transaction(tx => logActivity(tx, { eventType: 'CLEARANCE_RECORD_PRINTED', actorId, targetUserId }));
}
