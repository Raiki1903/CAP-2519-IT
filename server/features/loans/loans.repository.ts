import type { Prisma, asset_loans, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

export function findAllNewestFirst() {
    return prisma.asset_loans.findMany({
        orderBy: { loaned_on: 'desc' }
    });
}

export function findFirstAsset() {
    return prisma.assets.findFirst();
}

export function findFirstStudent() {
    return prisma.users.findFirst({ where: { user_type: 'STUDENT' } });
}

export function findListLookups() {
    return Promise.all([
        prisma.users.findMany(),
        prisma.assets.findMany(),
        prisma.user_centers.findMany({
            include: { research_centers: true }
        }),
    ]);
}

export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
}

export function create(data: Prisma.asset_loansUncheckedCreateInput) {
    return prisma.asset_loans.create({ data });
}

export function findById(loanId: number) {
    return prisma.asset_loans.findUnique({ where: { loan_id: loanId } });
}

export function saveDecision(
    loan: asset_loans,
    newStatus: string,
    buildHandoverRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput) | null,
) {
    // asset_loans (approval status) and asset_records (append-only custody log)
    // are updated together so a failure on either rolls back the whole decision.
    return prisma.$transaction(async (tx) => {
        const updated = await tx.asset_loans.update({
            where: { loan_id: loan.loan_id },
            data: { status: newStatus },
        });

        if (buildHandoverRecord) {
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: loan.asset_id },
                orderBy: { date_logged: "desc" },
            });

            await tx.asset_records.create({
                data: buildHandoverRecord(latestRecord),
            });
        }

        return updated;
    });
}
