/**
 * Analytics service: turns the rows the repository reads into the figures each analytics view draws.
 * Layer: service. Called by analytics.controller.ts. Calls analytics.repository.ts and shared/services/assetState.ts (overdue).
 * Used by: the Director, Lab Head, and Staff analytics views (the idle and loan recommender figures have no live caller).
 * An asset's status is assets.status and its lab and campus its home lab (assets.center_id). Every status count uses all
 * six statuses, named by the shared constants. A figure with no data behind it is empty or left out, never invented.
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
    StatusCounts,
} from '@shared/types/analytics';
import { CAMPUSES, CAMPUS_LABELS } from '@shared/constants/campuses';
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from '@shared/enums/assetStatus';
import * as analyticsRepository from './analytics.repository';
import { MAINTENANCE_STATUS_LABELS } from '@shared/constants/maintenanceStatuses';
import { legacyLoanStatusLabel } from '../loans/loans.service';
import type { DirectorFilters, LabHeadFilters } from './analytics.validation';
import type { SessionIdentity } from '@shared/types/auth';
import { AppError } from '../../shared/errors/AppError';
import { isOverdue, serverToday } from '../../shared/services/assetState';

/** A count of zero for each of the six asset statuses. */
function emptyStatusCounts(): StatusCounts {
    return Object.fromEntries(ASSET_STATUSES.map(status => [status, 0])) as StatusCounts;
}

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
 * Counts the assets by status, per campus, overall, and per lab, each from the asset's home lab and its status now.
 * The Staff view reads `locationDistribution` and `statusCounts`; `byLocation` and `byStatus` were read by the
 * screens now in legacy/analytics-v1/ and are still sent. Every campus and every status is listed, with 0 when empty.
 * The per-lab bars show Available, On Loan, and Maintenance; the other statuses count in the campus and status totals.
 *
 * @param lab the home lab's short code (any letter case), or undefined for every asset
 */
export async function locationStatus(lab: string | undefined): Promise<LocationStatusData> {
    const assets = await analyticsRepository.findAssetsWithLab();

    const campusMap = new Map(CAMPUSES.map(campus => [campus, emptyStatusCounts()]));
    const statusMap = emptyStatusCounts();
    const labMap = new Map<string, { available: number; onLoan: number; underRepair: number }>();

    assets.forEach((asset) => {
        const center = asset.research_centers;
        if (!inLab(lab, center.short_code)) return;
        if (!labMap.has(center.short_code)) labMap.set(center.short_code, { available: 0, onLoan: 0, underRepair: 0 });

        campusMap.get(center.location)![asset.status]++;
        statusMap[asset.status]++;

        const bars = labMap.get(center.short_code)!;
        if (asset.status === 'AVAILABLE') bars.available++;
        else if (asset.status === 'ON_LOAN') bars.onLoan++;
        else if (asset.status === 'MAINTENANCE') bars.underRepair++;
    });

    const byLocation = CAMPUSES.map(campus => ({
        location: `${CAMPUS_LABELS[campus]} Campus`,
        ...campusMap.get(campus)!
    }));

    const statusCounts = ASSET_STATUSES.map(status => ({
        name: ASSET_STATUS_LABELS[status],
        value: statusMap[status]
    }));

    const locationDistribution = [...labMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([lName, bars]) => ({ location: lName, ...bars }));

    return { byLocation, byStatus: statusCounts, locationDistribution, statusCounts };
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
 * The location counts use each asset's home lab and its status now. With a date range, they count only the assets
 * procured inside it (an asset's status has no date of its own).
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
    const allAssets = await analyticsRepository.findAssetsForDirector(startDate, endDate);
    const counted = filterText
        ? allAssets.filter(a => a.research_centers.short_code.toLowerCase() === filterText || CAMPUS_LABELS[a.research_centers.location].toLowerCase() === filterText)
        : allAssets;

    const campusCounts = new Map(CAMPUSES.map(campus => [campus, emptyStatusCounts()]));
    for (const asset of counted) {
        campusCounts.get(asset.research_centers.location)![asset.status]++;
    }

    const locationStatusData: DirectorAnalyticsData['locationStatusData'] = CAMPUSES.map(campus => {
        const counts = campusCounts.get(campus)!;
        return { location: campus, ...counts, total: ASSET_STATUSES.reduce((sum, status) => sum + counts[status], 0) };
    });

    const reports = await analyticsRepository.findReportsForDirector(startDate, endDate);

    // Month labels such as "Oct 26", in the server's time zone, in the order the months first appear (oldest first).
    const reportsByMonthMap = new Map<string, number>();
    for (const rep of reports) {
        const d = new Date(rep.inspected_at);
        const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        reportsByMonthMap.set(monthLabel, (reportsByMonthMap.get(monthLabel) || 0) + 1);
    }

    const auditComplianceData = Array.from(reportsByMonthMap.entries()).map(([month, count]) => ({
        month,
        count
    }));

    return {
        totalPortfolioValue,
        pendingDisposalsCount,
        fundingData,
        locationStatusData,
        auditComplianceData
    };
}

/**
 * Builds the Lab Head dashboard for the lab the viewer heads: loan requests, utilization (assets On Loan), categories,
 * project allocation (with the real acquisition values), overdue loans, and the scatter and heatmap built from them.
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
        return {
            loanId: l.loan_id,
            assetId: l.assets?.asset_tag || `ASSET-${l.asset_id}`,
            asset: l.assets?.name || "Asset",
            borrower: l.users ? `${l.users.first_name} ${l.users.last_name}` : "Borrower",
            purpose: l.purpose,
            destinationLab: l.destination_center?.short_code,
            requestedOn: l.requested_at.toISOString().split('T')[0],
            dueDate: l.return_by.toISOString().split('T')[0],
            status: legacyLoanStatusLabel(l.status)
        };
    });

    const labAssets = await analyticsRepository.findLabAssets(prefixFilter);

    // Utilization is the share of the lab's assets that are On Loan now.
    const onLoanCount = labAssets.filter(a => a.status === 'ON_LOAN').length;
    const totalAssetsCount = labAssets.length;
    const notOnLoanCount = totalAssetsCount - onLoanCount;
    const utilizationPercentage = totalAssetsCount > 0 ? Math.round((onLoanCount / totalAssetsCount) * 100) : 0;

    const categoryCounts = await analyticsRepository.countLabAssetsByCategory(prefixFilter);

    const categoryData = categoryCounts.map(c => ({
        category: c.category.replace(/_/g, " "),
        count: c._count.asset_id
    }));

    const allProjects = await analyticsRepository.findProjectsWithCenter();

    // Per project, the lab's assets it owns and their acquisition values added up (an asset with no value adds 0).
    const projectTotalsMap = new Map<number, { count: number; value: number }>();
    for (const a of labAssets) {
        if (a.project_id) {
            const totals = projectTotalsMap.get(a.project_id) ?? { count: 0, value: 0 };
            totals.count++;
            totals.value += Number(a.acquisition_value ?? 0);
            projectTotalsMap.set(a.project_id, totals);
        }
    }

    const colors = ["#005A36", "#059669", "#10B981", "#34D399", "#6EE7B7", "#047857"];
    const projectAllocation: any[] = [];
    let colorIdx = 0;
    for (const p of allProjects) {
        const { count, value } = projectTotalsMap.get(p.project_id) ?? { count: 0, value: 0 };
        if (count > 0) {
            projectAllocation.push({
                projectId: p.project_code,
                name: p.project_name,
                leader: p.project_leader,
                center: p.research_centers?.name || "Research Center",
                count,
                size: count,
                pct: `${totalAssetsCount > 0 ? ((count / totalAssetsCount) * 100).toFixed(1) : 0}%`,
                value,
                color: colors[colorIdx % colors.length]
            });
            colorIdx++;
        }
    }
    projectAllocation.sort((a, b) => b.count - a.count);

    const now = new Date();

    const allLoansForDelinquency = await analyticsRepository.findLoansForDelinquency(prefixFilter);

    // The same rule as the asset list's overdue flag: only a handed-over loan (On Loan or Return Requested) whose
    // return-by date has passed. A request still waiting for approval or release is never overdue. (H-04)
    const today = serverToday(now);
    const overdueLoans = allLoansForDelinquency.filter(l => {
        return isOverdue({ status: l.status, returnBy: l.return_by }, today);
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
            onLoanCount,
            notOnLoanCount,
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
 * Builds the Staff dashboard: every repair ticket, a condition summary from each asset's newest TSG inspection
 * (an asset TSG never inspected is counted apart, not as good),
 * and the warranties expired or expiring within 90 days (counted from now).
 */
export async function staffDashboard(): Promise<StaffAnalyticsData> {
    const dbRepairs = await analyticsRepository.findRepairsWithAssetAndReporter();

    const repairs = dbRepairs.map(r => ({
        repairId: r.maintenance_id,
        assetId: r.assets?.asset_tag || `ASSET-${r.asset_id}`,
        assetName: r.assets?.name || "Asset",
        reportedBy: r.users ? `${r.users.first_name} ${r.users.last_name}` : "Staff",
        issueDescription: r.issue_description,
        progressStatus: MAINTENANCE_STATUS_LABELS[r.status],
        createdAt: r.reported_at.toISOString().split('T')[0]
    }));

    const conditions = await analyticsRepository.findCurrentConditions();

    let goodCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;
    let notInspectedCount = 0;

    const conditionItems: any[] = [];
    const allAssets = await analyticsRepository.findAllAssets();

    for (const a of allAssets) {
        const cond = conditions.get(a.asset_id)?.condition;
        if (!cond) {
            notInspectedCount++;
            continue;
        }
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
            notInspectedCount,
            totalCount: allAssets.length,
            conditionItems
        },
        warrantyExpiringSoon
    };
}
