/**
 * Analytics service: turns the rows the repository reads into the figures each analytics view draws.
 * Layer: service. Called by analytics.controller.ts. Calls analytics.repository.ts.
 * Used by: the Director, Lab Head, and Staff analytics views (the idle and loan recommender figures have no live caller).
 * An asset's status is assets.status and its lab and campus its home lab (assets.center_id). Several figures are still
 * invented when the data is missing (H-09), and the response shapes keep four of the six statuses; both are kept as
 * they are, with a TODO at each place, for the #96 rework (Batch 1 commits 12 and 13).
 */
import type {
    DirectorAnalyticsData,
    IdleFrequencyItem,
    IdleTimeItem,
    InspectionProgressItem,
    LabHeadAnalyticsData,
    LoanRecommendationItem,
    LocationStatusData,
    StaffAnalyticsData,
} from '@shared/types/analytics';
import { asset_loans_status, type assets_status } from '@prisma/client';
import { CAMPUS_LABELS, type Campus } from '@shared/constants/campuses';
import * as analyticsRepository from './analytics.repository';
import { progressTextOf } from '../maintenance/maintenance.service';
import { legacyLoanStatusLabel } from '../loans/loans.service';
import type { DirectorFilters, LabHeadFilters } from './analytics.validation';
import type { SessionIdentity } from '@shared/types/auth';
import { AppError } from '../../shared/errors/AppError';

/**
 * The old four status keys the response shapes still use, for each stored status. Pending Retirement and Missing have
 * none, so they count only in totals.
 */
// TODO(#96): the dashboards show four statuses. Batch 1 commits 12 and 13 move them to the six.
const OLD_STATUS_KEY: Partial<Record<assets_status, "ACTIVE" | "ON_LOAN" | "MAINTENANCE" | "DISPOSED">> = {
    AVAILABLE: "ACTIVE",
    ON_LOAN: "ON_LOAN",
    MAINTENANCE: "MAINTENANCE",
    RETIRED: "DISPOSED",
};

/** Whether the lab query names this asset's home lab, by short code in any letter case. No lab means every asset. */
function inLab(lab: string | undefined, shortCode: string): boolean {
    return !lab || shortCode.toLowerCase() === lab.trim().toLowerCase();
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Days since the asset's last return, else since its procurement date; 0 when it has neither. */
function daysIdle(asset: { procurement_date: Date | null; asset_loans: { closed_at: Date | null }[] }, now: number): number {
    const lastReturn = asset.asset_loans[0]?.closed_at;
    const reference = lastReturn ? lastReturn.getTime() : asset.procurement_date ? asset.procurement_date.getTime() : now;
    return Math.floor((now - reference) / MS_PER_DAY);
}

// ===========================================================================
// Lab Head widgets kept on 2026-10-07 (no live caller)
// ===========================================================================

/**
 * Counts the Available assets by days idle (since their last return, else since their procurement date): under 7,
 * 7 to 30, over 30.
 *
 * @param lab the home lab's short code (any letter case), or undefined for every asset
 */
export async function idleTime(lab: string | undefined): Promise<IdleTimeItem[]> {
    const dbAssets = await analyticsRepository.findAssetsWithLastReturn();

    let underSevenDays = 0;
    let sevenToThirtyDays = 0;
    let overThirtyDays = 0;

    const now = new Date().getTime();

    dbAssets.forEach((asset) => {
        if (asset.status !== 'AVAILABLE') return;
        if (!inLab(lab, asset.research_centers.short_code)) return;

        const idle = daysIdle(asset, now);
        if (idle < 7) {
            underSevenDays++;
        } else if (idle <= 30) {
            sevenToThirtyDays++;
        } else {
            overThirtyDays++;
        }
    });

    return [
        { category: "< 7 Days", count: underSevenDays },
        { category: "7-30 Days", count: sevenToThirtyDays },
        { category: "> 30 Days (Idle)", count: overThirtyDays }
    ];
}

/**
 * Counts the same Available assets as idleTime in five ranges: 1 to 7 days (0 included), 8 to 14, 15 to 30, 31 to 60, over 60.
 *
 * @param lab as for idleTime
 */
export async function idleFrequency(lab: string | undefined): Promise<IdleFrequencyItem[]> {
    const dbAssets = await analyticsRepository.findAssetsWithLastReturn();

    let range1 = 0;
    let range2 = 0;
    let range3 = 0;
    let range4 = 0;
    let range5 = 0;

    const now = new Date().getTime();

    dbAssets.forEach((asset) => {
        if (asset.status !== 'AVAILABLE') return;
        if (!inLab(lab, asset.research_centers.short_code)) return;

        const idle = daysIdle(asset, now);
        if (idle <= 7) range1++;
        else if (idle <= 14) range2++;
        else if (idle <= 30) range3++;
        else if (idle <= 60) range4++;
        else range5++;
    });

    return [
        { durationRange: "1-7 Days", equipmentCount: range1, criticality: "Low" },
        { durationRange: "8-14 Days", equipmentCount: range2, criticality: "Normal" },
        { durationRange: "15-30 Days", equipmentCount: range3, criticality: "Moderate" },
        { durationRange: "31-60 Days", equipmentCount: range4, criticality: "High" },
        { durationRange: "60+ Days", equipmentCount: range5, criticality: "Critical" }
    ];
}

/**
 * Lists every Available asset as a loan suggestion, with its days idle (at least 1) and its owning lab.
 *
 * @param targetCategory an assets_category value, or undefined for every category
 */
// TODO(M-09): the asking lab's own assets are not left out. With the insights endpoint, analytics batch.
export async function loanRecommendations(targetCategory: string | undefined): Promise<LoanRecommendationItem[]> {
    const available = await analyticsRepository.findAvailableAssetsForRecommender(targetCategory);

    const now = new Date().getTime();
    return available.map((asset) => {
        const idle = Math.max(1, daysIdle(asset, now));
        const homeLab = asset.research_centers.short_code;
        return {
            recommendationId: asset.asset_id,
            targetLab: homeLab,
            idleAssetName: asset.name,
            assetTag: asset.asset_tag,
            matchReason: `Matches ${asset.category} requirements. Idle for ${idle} days at ${homeLab}.`,
            ownerLab: asset.projects?.research_centers?.name || asset.research_centers.name,
        };
    });
}

// ===========================================================================
// Staff analytics: location status and inspection progress
// ===========================================================================

/**
 * Counts the assets by status, per campus, overall, and per lab, each from the asset's home lab.
 * The Staff view reads `locationDistribution` and `statusCounts`; `byLocation` and `byStatus` were read by the
 * screens now in legacy/analytics-v1/ and are still sent.
 *
 * @param lab the home lab's short code (any letter case), or undefined for every asset
 */
// TODO(#96): Pending Retirement and Missing assets count in no status here, and Retired ones are not in the per-lab bars. Batch 1 commit 12.
export async function locationStatus(lab: string | undefined): Promise<LocationStatusData> {
    const assets = await analyticsRepository.findAssetsWithLab();

    const campusMap: Record<string, Record<string, number>> = {};
    for (const campus of Object.keys(CAMPUS_LABELS) as Campus[]) {
        campusMap[`${CAMPUS_LABELS[campus]} Campus`] = { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 };
    }
    const statusMap: Record<string, number> = { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 };
    const labMap = new Map<string, { available: number; onLoan: number; underRepair: number }>();

    assets.forEach((asset) => {
        const center = asset.research_centers;
        if (!inLab(lab, center.short_code)) return;
        if (!labMap.has(center.short_code)) labMap.set(center.short_code, { available: 0, onLoan: 0, underRepair: 0 });

        const st = OLD_STATUS_KEY[asset.status];
        if (!st) return;
        campusMap[`${CAMPUS_LABELS[center.location]} Campus`][st]++;
        statusMap[st]++;

        // Retired assets count in the campus and status totals, but not in the per-lab bars.
        const bars = labMap.get(center.short_code)!;
        if (st === "ACTIVE") bars.available++;
        else if (st === "ON_LOAN") bars.onLoan++;
        else if (st === "MAINTENANCE") bars.underRepair++;
    });

    const byLocation = Object.keys(campusMap).map((campus) => ({
        location: campus,
        ...campusMap[campus]
    }));

    const byStatus = Object.keys(statusMap).map((st) => ({
        name: st.replace('_', ' '),
        value: statusMap[st]
    }));

    const locationDistribution = [...labMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([lName, bars]) => ({ location: lName, ...bars }));

    const statusCounts = [
        { name: "Available", value: statusMap.ACTIVE },
        { name: "On Loan", value: statusMap.ON_LOAN },
        { name: "Under Repair", value: statusMap.MAINTENANCE },
        { name: "Disposed", value: statusMap.DISPOSED }
    ];

    return { byLocation, byStatus, locationDistribution, statusCounts };
}

/**
 * Gives one progress entry per research center: `inspected` out of `total`, as a percentage.
 * `total` is the center's assets that are not Retired, `inspected` the Available ones; a center with none reports 100%.
 */
// Known defect, kept: no inspection report is read, so "inspected" means Available, not inspected. Batch 5 builds the
// routine queue from the inspections.
export async function inspectionProgress(): Promise<InspectionProgressItem[]> {
    const researchCenters = await analyticsRepository.findCentersWithAssetStatuses();

    return researchCenters.map((rc) => {
        const inService = rc.assets.filter(a => a.status !== "RETIRED");
        const total = inService.length;
        const inspected = inService.filter(a => a.status === "AVAILABLE").length;
        const percent = total > 0 ? Math.round((inspected / total) * 100) : 100;

        return {
            group: `${rc.name} (${rc.short_code})`,
            inspected,
            total,
            percent
        };
    });
}

// ===========================================================================
// The three dashboards
// ===========================================================================

/**
 * Builds the Director dashboard: portfolio value, pending disposals, value per funding source,
 * asset counts by campus and status, and inspection reports per month.
 * The location counts take each asset's newest record (inside the date range, when one is given).
 */
// Known defect, kept: the lab filter narrows only the location counts; the portfolio value, the funding breakdown, and the
// pending disposals stay the totals of every lab, so the lab dropdown changes one chart and not the figures beside it.
// Pinned by the Phase 2 tests; proposed as its own commit (restructure log, batch 4 proposals).
export async function directorDashboard(filters: DirectorFilters): Promise<DirectorAnalyticsData> {
    const { labFilter, isSpecificLab, startDate, endDate } = filters;

    const monetaryAggregation = await analyticsRepository.sumAcquisitionValue();
    const totalPortfolioValue = Number(monetaryAggregation._sum.acquisition_value || 0);

    const pendingDisposalsCount = await analyticsRepository.countPendingDisposals();

    const [fundingGroups, fundingSources] = await analyticsRepository.groupValueByFundingSource();

    const fundingData = fundingGroups.map(g => ({
        name: fundingSources.find(f => f.funding_source_id === g.funding_source_id)?.name || "Unspecified",
        value: Number(g._sum.acquisition_value || 0),
        count: g._count.asset_id
    }));

    // The lab filter names a lab by short code, or a campus by its label (the dropdown offers both).
    const filterText = isSpecificLab ? labFilter.trim().toLowerCase() : null;
    const allAssets = await analyticsRepository.findAssetsForDirector(null);
    const counted = filterText
        ? allAssets.filter(a => a.research_centers.short_code.toLowerCase() === filterText || CAMPUS_LABELS[a.research_centers.location].toLowerCase() === filterText)
        : allAssets;

    // TODO(#96): the date range no longer narrows the location counts (an asset's status has no date), and McKinley assets count under Laguna. Batch 1 commit 12 gives each campus its own counts.
    let manilaActive = 0, manilaOnLoan = 0, manilaMaintenance = 0, manilaDisposed = 0;
    let lagunaActive = 0, lagunaOnLoan = 0, lagunaMaintenance = 0, lagunaDisposed = 0;

    for (const asset of counted) {
        const isLaguna = asset.research_centers.location !== "MANILA";
        const st = OLD_STATUS_KEY[asset.status];
        if (isLaguna) {
            if (st === "ACTIVE") lagunaActive++;
            else if (st === "ON_LOAN") lagunaOnLoan++;
            else if (st === "MAINTENANCE") lagunaMaintenance++;
            else if (st === "DISPOSED") lagunaDisposed++;
        } else {
            if (st === "ACTIVE") manilaActive++;
            else if (st === "ON_LOAN") manilaOnLoan++;
            else if (st === "MAINTENANCE") manilaMaintenance++;
            else if (st === "DISPOSED") manilaDisposed++;
        }
    }

    const locationStatusData: DirectorAnalyticsData['locationStatusData'] = [
        {
            location: "MANILA",
            ACTIVE: manilaActive,
            ON_LOAN: manilaOnLoan,
            MAINTENANCE: manilaMaintenance,
            DISPOSED: manilaDisposed,
            total: manilaActive + manilaOnLoan + manilaMaintenance + manilaDisposed
        },
        {
            location: "LAGUNA",
            ACTIVE: lagunaActive,
            ON_LOAN: lagunaOnLoan,
            MAINTENANCE: lagunaMaintenance,
            DISPOSED: lagunaDisposed,
            total: lagunaActive + lagunaOnLoan + lagunaMaintenance + lagunaDisposed
        }
    ];

    const reports = await analyticsRepository.findReportsForDirector(startDate, endDate);

    // Month labels such as "Oct 26", in the server's time zone, in the order the months first appear (oldest first).
    const reportsByMonthMap = new Map<string, number>();
    for (const rep of reports) {
        const d = new Date(rep.inspected_at);
        const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        reportsByMonthMap.set(monthLabel, (reportsByMonthMap.get(monthLabel) || 0) + 1);
    }

    let auditComplianceData = Array.from(reportsByMonthMap.entries()).map(([month, count]) => ({
        month,
        count
    }));

    // TODO(H-09): with no report in range, the chart shows this fixed demo series as if it were data. Show an empty chart instead; proposed as its own commit.
    if (auditComplianceData.length === 0) {
        auditComplianceData = [
            { month: "Jan 26", count: 4 },
            { month: "Feb 26", count: 8 },
            { month: "Mar 26", count: 15 },
            { month: "Apr 26", count: 12 },
            { month: "May 26", count: 20 },
            { month: "Jun 26", count: 18 },
            { month: "Jul 26", count: 25 }
        ];
    }

    return {
        totalPortfolioValue,
        pendingDisposalsCount,
        fundingData,
        locationStatusData,
        auditComplianceData
    };
}

/**
 * Builds the Lab Head dashboard for the lab the viewer heads: loan requests, utilization, categories,
 * project allocation, overdue loans, and the scatter and heatmap built from them.
 * The date range limits the loans only.
 *
 * @param filters the date range
 * @param viewer the session user, a Lab Head (the route checks it)
 * @throws AppError 403 if the viewer heads no lab
 */
export async function labHeadDashboard(filters: LabHeadFilters, viewer: SessionIdentity): Promise<LabHeadAnalyticsData> {
    const { startDate, endDate } = filters;
    const lab = viewer.headOfCenterId === null ? null : await analyticsRepository.findLab(viewer.headOfCenterId);
    if (!lab) {
        throw new AppError(403, "Only the account that heads a lab has a lab dashboard.");
    }
    const prefixFilter = lab.short_code;

    const rawLoans = await analyticsRepository.findLoansForLabHead(prefixFilter, startDate, endDate);

    const loans = rawLoans.map(l => {
        // The borrow form's destination lab is stored as the first line of the purpose, so it is read back
        // from there and cut from the purpose shown. (H-19)
        const destLabMatch = l.purpose?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
        const destinationLab = destLabMatch ? destLabMatch[1] : undefined;
        const cleanPurpose = destLabMatch ? l.purpose.replace(/^Destination Lab:\s*.+?\n\n?/, "") : l.purpose;

        return {
            loanId: l.loan_id,
            assetId: l.assets?.asset_tag || `ASSET-${l.asset_id}`,
            asset: l.assets?.name || "Equipment",
            borrower: l.users ? `${l.users.first_name} ${l.users.last_name}` : "Borrower",
            purpose: cleanPurpose,
            destinationLab,
            requestedOn: l.requested_at.toISOString().split('T')[0],
            dueDate: l.return_by.toISOString().split('T')[0],
            status: legacyLoanStatusLabel(l.status)
        };
    });

    const labAssets = await analyticsRepository.findLabAssets(prefixFilter);

    // An asset is "assigned" when it has an owning project.
    // TODO(#96): utilization should count assets On Loan, not assets with a project. Batch 1 commit 12.
    let assignedCount = 0;
    let unassignedCount = 0;
    for (const a of labAssets) {
        if (a.project_id !== null) {
            assignedCount++;
        } else {
            unassignedCount++;
        }
    }
    const totalAssetsCount = labAssets.length;
    const utilizationPercentage = totalAssetsCount > 0 ? Math.round((assignedCount / totalAssetsCount) * 100) : 0;

    const categoryCounts = await analyticsRepository.countLabAssetsByCategory(prefixFilter);

    const categoryData = categoryCounts.map(c => ({
        category: c.category.replace(/_/g, " "),
        count: c._count.asset_id
    }));

    const allProjects = await analyticsRepository.findProjectsWithCenter();

    const projectCountsMap = new Map<number, number>();
    for (const a of labAssets) {
        if (a.project_id) {
            projectCountsMap.set(a.project_id, (projectCountsMap.get(a.project_id) || 0) + 1);
        }
    }

    const colors = ["#005A36", "#059669", "#10B981", "#34D399", "#6EE7B7", "#047857"];
    const projectAllocation: any[] = [];
    let colorIdx = 0;
    for (const p of allProjects) {
        const count = projectCountsMap.get(p.project_id) || 0;
        if (count > 0) {
            projectAllocation.push({
                projectId: p.project_code,
                name: p.project_name,
                leader: p.project_leader,
                center: p.research_centers?.name || "Research Center",
                count,
                size: count,
                pct: `${totalAssetsCount > 0 ? ((count / totalAssetsCount) * 100).toFixed(1) : 0}%`,
                // TODO(H-09): an invented value of 250,000 per asset, not the assets' acquisition value. Proposed as its own commit.
                value: count * 250000,
                color: colors[colorIdx % colors.length]
            });
            colorIdx++;
        }
    }
    projectAllocation.sort((a, b) => b.count - a.count);

    const now = new Date();

    const allLoansForDelinquency = await analyticsRepository.findLoansForDelinquency(prefixFilter);

    // TODO(H-04): a loan counts as overdue unless it is returned or declined, so a pending request past its due date counts, although nothing was handed over. Batch 3.
    const overdueLoans = allLoansForDelinquency.filter(l => {
        const dueDate = new Date(l.return_by);
        return dueDate.getTime() < now.getTime() && l.status !== asset_loans_status.RETURNED && l.status !== asset_loans_status.DECLINED;
    });

    const delinquencies = overdueLoans.map(l => {
        const dueDate = new Date(l.return_by);
        const daysOverdue = Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const project = allProjects.find(p => p.project_id === l.assets?.project_id);

        return {
            id: l.loan_id,
            assetName: l.assets?.name || `Asset #${l.asset_id}`,
            assetTag: l.assets?.asset_tag || `ASSET-${l.asset_id}`,
            custodian: l.users ? `${l.users.first_name} ${l.users.last_name}` : "Student Custodian",
            // TODO(H-09): an invented address when the borrower is missing. The borrower is a required relation, so it does not happen today.
            email: l.users?.email || "student@dlsu.edu.ph",
            daysOverdue,
            dueDate: l.return_by.toISOString(),
            project: project?.project_name || "Unassigned Cohort",
            projectId: project?.project_id || 0
        };
    });

    // Scatter: per project ("cohort"), the overdue loans and their average days overdue, with a severity colour.
    const cohortOverdueMap = new Map<string, { daysOverdueList: number[]; project_name: string }>();
    for (const d of delinquencies) {
        const key = d.project;
        if (!cohortOverdueMap.has(key)) {
            cohortOverdueMap.set(key, { daysOverdueList: [], project_name: key });
        }
        cohortOverdueMap.get(key)!.daysOverdueList.push(d.daysOverdue);
    }

    const scatterData = Array.from(cohortOverdueMap.entries()).map(([cohortName, info]) => {
        const unreturnedCount = info.daysOverdueList.length;
        const avgDaysOverdue = Math.round(info.daysOverdueList.reduce((a, b) => a + b, 0) / (unreturnedCount || 1));
        let color = "#10B981";
        let severity = "Low Risk";

        if (avgDaysOverdue >= 10 || unreturnedCount >= 5) {
            color = "#EF4444";
            severity = "Critical Bottleneck";
        } else if (avgDaysOverdue >= 4 || unreturnedCount >= 3) {
            color = "#F59E0B";
            severity = "Moderate Risk";
        }

        return {
            cohort: cohortName,
            avgDaysOverdue,
            unreturnedCount,
            bubbleSize: 140 + (unreturnedCount * 30),
            color,
            severity
        };
    });

    // Heatmap: per project, the overdue loans in five bands of days overdue (up to 3, 7, 14, 30, and more).
    const heatmapMatrixMap = new Map<string, number[]>();
    for (const d of delinquencies) {
        const cohortKey = d.project;
        if (!heatmapMatrixMap.has(cohortKey)) {
            heatmapMatrixMap.set(cohortKey, [0, 0, 0, 0, 0]);
        }
        const counts = heatmapMatrixMap.get(cohortKey)!;
        const days = d.daysOverdue;
        if (days <= 3) counts[0]++;
        else if (days <= 7) counts[1]++;
        else if (days <= 14) counts[2]++;
        else if (days <= 30) counts[3]++;
        else counts[4]++;
    }

    const heatmapData = Array.from(heatmapMatrixMap.entries()).map(([cohort, counts]) => ({
        cohort,
        counts,
        totalOverdue: counts.reduce((a, b) => a + b, 0)
    }));

    return {
        loans,
        utilization: {
            assignedCount,
            unassignedCount,
            totalAssetsCount,
            utilizationPercentage
        },
        categoryData,
        projectAllocation,
        delinquencies,
        scatterData,
        heatmapData
    };
}

/**
 * Builds the Staff dashboard: every repair ticket, a condition summary from each asset's newest record,
 * and the warranties expired or expiring within 90 days (counted from now).
 */
export async function staffDashboard(): Promise<StaffAnalyticsData> {
    const dbRepairs = await analyticsRepository.findRepairsWithAssetAndReporter();

    const repairs = dbRepairs.map(r => ({
        repairId: r.maintenance_id,
        assetId: r.assets?.asset_tag || `ASSET-${r.asset_id}`,
        assetName: r.assets?.name || "Equipment",
        reportedBy: r.users ? `${r.users.first_name} ${r.users.last_name}` : "Staff",
        issueDescription: r.issue_description,
        isImmediate: r.is_immediate,
        progressStatus: progressTextOf(r),
        createdAt: r.reported_at.toISOString().split('T')[0]
    }));

    const conditions = await analyticsRepository.findCurrentConditions();

    let goodCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;

    const conditionItems: any[] = [];
    const allAssets = await analyticsRepository.findAllAssets();

    for (const a of allAssets) {
        // TODO(H-09): an asset TSG never inspected shows as PERFECT. Batch 1 commit 12 leaves it out of the counts.
        const cond = conditions.get(a.asset_id)?.condition || "PERFECT";
        let trafficLight: "GREEN" | "YELLOW" | "RED" = "GREEN";

        if (cond === "PERFECT" || cond === "OPERATIONAL") {
            goodCount++;
            trafficLight = "GREEN";
        } else if (cond === "MINOR_DRIFT" || cond === "DEGRADED") {
            degradedCount++;
            trafficLight = "YELLOW";
        } else if (cond === "CRITICAL_DEFECT") {
            criticalCount++;
            trafficLight = "RED";
        }

        conditionItems.push({
            assetTag: a.asset_tag,
            name: a.name,
            category: a.category.replace(/_/g, " "),
            condition: cond,
            trafficLight,
            // The home lab and room, not where the asset is now, so an asset at the TSG Office shows its lab.
            location: a.home_room ? `${a.research_centers.short_code}, ${a.home_room}` : a.research_centers.short_code
        });
    }

    const now = new Date();

    const warrantyAssets = await analyticsRepository.findAssetsWithWarranty();

    const warrantyExpiringSoon = warrantyAssets
        .filter(a => {
            if (!a.warranty_expiry) return false;
            const daysRemaining = Math.ceil((a.warranty_expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysRemaining <= 90;
        })
        .map(a => {
            const expiry = a.warranty_expiry!;
            const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                assetTag: a.asset_tag,
                name: a.name,
                manufacturer: a.manufacturer || "N/A",
                warrantyExpiry: expiry.toISOString().split('T')[0],
                daysRemaining,
                isExpired: daysRemaining < 0
            };
        });

    return {
        repairs,
        conditionSummary: {
            goodCount,
            degradedCount,
            criticalCount,
            totalCount: allAssets.length,
            conditionItems
        },
        warrantyExpiringSoon
    };
}
