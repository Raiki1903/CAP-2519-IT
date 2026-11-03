/**
 * The derive helpers: an asset's holder, current location, condition, overdue flag, and open loan, and a person's
 * open loans (clearance), worked out from the loan and inspection rows instead of being stored a second time.
 * Layer: shared service. Called by the repositories and services of features/assets, loans, returns, maintenance,
 * retirements, and analytics. Calls Prisma through the client it is given (the shared client or the caller's
 * transaction); it never imports config/prisma.ts, so the tests can hand it their own client.
 * Used by: every asset list and detail, every rule that asks who holds an asset or whether it is free, and clearance.
 */
import type { Prisma, PrismaClient, asset_condition, asset_loans_status, assets_status } from '@prisma/client';
import { HELD_LOAN_STATUSES, OPEN_LOAN_STATUSES, UNCLEARED_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { TSG_INSPECTION_TYPES } from '@shared/constants/inspectionTypes';

/** The shared Prisma client or a transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Where the asset is while TSG has it for maintenance. */
export const TSG_OFFICE = "TSG Office";

/** An asset's open loan (Pending Approval, Pending Release, On Loan, or Return Requested), as the helpers give it. */
export interface OpenLoan {
    loanId: number;
    assetId: number;
    status: asset_loans_status;
    borrowerId: number;
    borrowerName: string;
    requestedAt: Date;
    releasedAt: Date | null;
    returnBy: Date;
    /** The destination lab's short code, or null when the loan names none. */
    destinationCode: string | null;
    destinationRoom: string | null;
}

/** An asset's condition now: its newest inspection by TSG (any type but Self Report). */
export interface CurrentCondition {
    inspectionId: number;
    condition: asset_condition;
    healthScore: number | null;
    inspectedAt: Date;
    remarks: string | null;
}

/** The parts of an asset the location rule reads. */
export interface LocatableAsset {
    asset_id: number;
    status: assets_status;
    home_room: string | null;
    research_centers: { short_code: string };
}

/** Everything worked out for one asset. */
export interface AssetState {
    openLoan: OpenLoan | null;
    /** The borrower of a held loan (On Loan or Return Requested); null when nobody holds the asset. */
    holder: { userId: number; name: string } | null;
    /** "<lab short code>, <room>", "<lab short code>", or "TSG Office"; null when Missing or Retired. */
    currentLocation: string | null;
    condition: CurrentCondition | null;
    isOverdue: boolean;
}

/** Today as yyyy-mm-dd in the server's local time zone, the day a return-by date is compared with. */
export function serverToday(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A DATE column as yyyy-mm-dd. Prisma reads a DATE as midnight UTC, so the UTC date is the stored one. */
function dateOnly(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Whether the loan is held by its borrower (On Loan or Return Requested). */
export function isHeld(loan: Pick<OpenLoan, 'status'> | null): boolean {
    return !!loan && HELD_LOAN_STATUSES.includes(loan.status);
}

/**
 * Whether a held loan's return-by date has passed. A loan still waiting for approval or release is never overdue:
 * nothing was handed over. (H-04)
 *
 * @param loan the asset's open loan, or null
 * @param today yyyy-mm-dd, for tests
 */
export function isOverdue(loan: OpenLoan | null, today: string = serverToday()): boolean {
    return isHeld(loan) && dateOnly(loan!.returnBy) < today;
}

/** The borrower of a held loan, or null. */
export function holderOf(loan: OpenLoan | null): AssetState['holder'] {
    return isHeld(loan) ? { userId: loan!.borrowerId, name: loan!.borrowerName } : null;
}

/** "<code>, <room>" or "<code>". */
function placeText(code: string, room: string | null): string {
    return room && room.trim() ? `${code}, ${room.trim()}` : code;
}

/**
 * Where the asset is now: a held loan's destination lab and room, the TSG Office while TSG has it for maintenance,
 * none when Missing or Retired, else its home lab and room. Never the campus.
 *
 * @param asset the asset with its status, home room, and home lab
 * @param loan the asset's open loan, or null
 */
export function currentLocationOf(asset: LocatableAsset, loan: OpenLoan | null): string | null {
    if (asset.status === "MISSING" || asset.status === "RETIRED") return null;
    if (asset.status === "MAINTENANCE") return TSG_OFFICE;
    if (isHeld(loan) && loan!.destinationCode) return placeText(loan!.destinationCode, loan!.destinationRoom);
    return placeText(asset.research_centers.short_code, asset.home_room);
}

/**
 * The open loan of each asset, in one query. An asset has at most one; if older data gives it two, the newest request wins.
 *
 * @param db the shared client or a transaction
 * @param assetIds the assets, or null for every asset
 * @returns open loans by asset id; an asset with none is not in the map
 */
export async function openLoansFor(db: Db, assetIds: number[] | null): Promise<Map<number, OpenLoan>> {
    const rows = await db.asset_loans.findMany({
        where: { status: { in: [...OPEN_LOAN_STATUSES] }, ...(assetIds ? { asset_id: { in: assetIds } } : {}) },
        orderBy: [{ requested_at: 'desc' }, { loan_id: 'desc' }],
        include: {
            users: { select: { first_name: true, last_name: true } },
            destination_center: { select: { short_code: true } },
        },
    });
    const byAsset = new Map<number, OpenLoan>();
    for (const l of rows) {
        if (byAsset.has(l.asset_id)) continue;
        byAsset.set(l.asset_id, {
            loanId: l.loan_id,
            assetId: l.asset_id,
            status: l.status,
            borrowerId: l.borrower_id,
            borrowerName: `${l.users.first_name} ${l.users.last_name}`,
            requestedAt: l.requested_at,
            releasedAt: l.released_at,
            returnBy: l.return_by,
            destinationCode: l.destination_center?.short_code ?? null,
            destinationRoom: l.destination_room,
        });
    }
    return byAsset;
}

/**
 * The condition now of each asset, in one query: its newest inspection by TSG, ties on the one-second time broken by
 * the higher inspection id. A Self Report never counts. (M-09)
 *
 * @param db the shared client or a transaction
 * @param assetIds the assets, or null for every asset
 * @returns conditions by asset id; an asset TSG never inspected is not in the map
 */
export async function conditionsFor(db: Db, assetIds: number[] | null): Promise<Map<number, CurrentCondition>> {
    const rows = await db.asset_inspections.findMany({
        where: { type: { in: [...TSG_INSPECTION_TYPES] }, ...(assetIds ? { asset_id: { in: assetIds } } : {}) },
        orderBy: [{ asset_id: 'asc' }, { inspected_at: 'desc' }, { inspection_id: 'desc' }],
        distinct: ['asset_id'],
        select: { inspection_id: true, asset_id: true, condition: true, health_score: true, inspected_at: true, remarks: true },
    });
    return new Map(rows.map(r => [r.asset_id, {
        inspectionId: r.inspection_id,
        condition: r.condition,
        healthScore: r.health_score,
        inspectedAt: r.inspected_at,
        remarks: r.remarks,
    }]));
}

/**
 * Everything worked out for a list of assets, in two queries whatever the list's length.
 *
 * @param db the shared client or a transaction
 * @param assets the assets, each with its status, home room, and home lab
 * @returns the state of each asset, by asset id
 */
export async function statesFor(db: Db, assets: LocatableAsset[]): Promise<Map<number, AssetState>> {
    const ids = assets.map(a => a.asset_id);
    const [loans, conditions] = await Promise.all([openLoansFor(db, ids), conditionsFor(db, ids)]);
    const today = serverToday();
    return new Map(assets.map(a => {
        const loan = loans.get(a.asset_id) ?? null;
        return [a.asset_id, {
            openLoan: loan,
            holder: holderOf(loan),
            currentLocation: currentLocationOf(a, loan),
            condition: conditions.get(a.asset_id) ?? null,
            isOverdue: isOverdue(loan, today),
        }];
    }));
}

/**
 * Everything worked out for one asset.
 *
 * @param db the shared client or a transaction
 * @param asset the asset with its status, home room, and home lab
 */
export async function stateOf(db: Db, asset: LocatableAsset): Promise<AssetState> {
    return (await statesFor(db, [asset])).get(asset.asset_id)!;
}

/**
 * The asset's open loan, or null.
 *
 * @param db the shared client or a transaction
 * @param assetId the asset
 */
export async function openLoanOf(db: Db, assetId: number): Promise<OpenLoan | null> {
    return (await openLoansFor(db, [assetId])).get(assetId) ?? null;
}

/**
 * A person's loans that keep them from being cleared (Pending Release, On Loan, Return Requested), oldest first.
 *
 * @param db the shared client or a transaction
 * @param userId the borrower
 */
export function unclearedLoansOf(db: Db, userId: number) {
    return db.asset_loans.findMany({
        where: { borrower_id: userId, status: { in: [...UNCLEARED_LOAN_STATUSES] } },
        orderBy: [{ requested_at: 'asc' }, { loan_id: 'asc' }],
    });
}

/**
 * Whether a person is cleared: no loan in Pending Release, On Loan, or Return Requested.
 *
 * @param db the shared client or a transaction
 * @param userId the borrower
 */
export async function isCleared(db: Db, userId: number): Promise<boolean> {
    const open = await db.asset_loans.count({ where: { borrower_id: userId, status: { in: [...UNCLEARED_LOAN_STATUSES] } } });
    return open === 0;
}
