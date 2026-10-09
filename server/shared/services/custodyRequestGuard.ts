import { prisma } from '../../config/prisma';

/**
 * Says why a new loan or transfer request on an asset must be refused, or null if it may go ahead.
 * An asset may hold only one pending request of either kind, because approving
 * two would hand one item to two custodians. (H-05)
 *
 * @param asset the asset row being requested
 * @param allowedStatuses the asset_records statuses this kind of request accepts
 * @returns a message for a 409 answer, or null
 */
export async function findCustodyRequestConflict(
    asset: { asset_id: number; asset_tag: string },
    allowedStatuses: readonly string[],
): Promise<string | null> {
    // TODO(H-05): the check and the insert are not atomic, so two requests in the same instant can both pass. Phase 3 database triggers.
    const [latestRecord, pendingLoan, pendingTransfer] = await Promise.all([
        // Same ordering GET /api/assets uses, so this agrees with the status the screens show.
        prisma.asset_records.findFirst({
            where: { asset_id: asset.asset_id },
            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }],
            select: { status: true },
        }),
        prisma.asset_loans.findFirst({ where: { asset_id: asset.asset_id, status: "pending" }, select: { loan_id: true } }),
        prisma.asset_transfers.findFirst({ where: { asset_id: asset.asset_id, status: "pending" }, select: { transfer_id: true } }),
    ]);

    if (pendingLoan) return `${asset.asset_tag} already has a pending loan request (LOAN-${pendingLoan.loan_id}).`;
    if (pendingTransfer) return `${asset.asset_tag} already has a pending transfer request (TRF-${pendingTransfer.transfer_id}).`;

    // An asset with no record yet is listed as Active, so it is treated as ACTIVE here too.
    const status = latestRecord?.status ?? "ACTIVE";
    if (!allowedStatuses.includes(status)) {
        const described: Record<string, string> = { ACTIVE: "active", ON_LOAN: "on loan", MAINTENANCE: "under maintenance", DISPOSED: "disposed" };
        return `${asset.asset_tag} is ${described[status] ?? status} and cannot take this request.`;
    }
    return null;
}
