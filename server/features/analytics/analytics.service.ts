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
import * as analyticsRepository from './analytics.repository';
import type { DirectorFilters, LabHeadFilters } from './analytics.validation';

// ===========================================================================
// Lab Head Controllers (Project Allocation & Accountability)
// ===========================================================================

/** 9a. Lab Head: Asset Idle Time Analyzer (Idle Time groups) */
export async function idleTime(lab: string | undefined): Promise<IdleTimeItem[]> {
    const dbAssets = await analyticsRepository.findAssetsWithLatestRecordAndReturn();

    let underSevenDays = 0;
    let sevenToThirtyDays = 0;
    let overThirtyDays = 0;

    const now = new Date().getTime();

    dbAssets.forEach((asset) => {
        const latestRecord = asset.asset_records[0];
        const currentStatus = latestRecord?.status || 'ACTIVE';
        if (currentStatus !== 'ACTIVE') return;

        const loc = latestRecord?.location || '';
        if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

        const lastReturn = asset.asset_returns[0];
        const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : (latestRecord ? new Date(latestRecord.date_logged).getTime() : now);
        const daysIdle = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

        if (daysIdle < 7) {
            underSevenDays++;
        } else if (daysIdle <= 30) {
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

/** 9b. Lab Head: Asset Idle Time Analyzer (Idle Frequency Range Chart) */
export async function idleFrequency(lab: string | undefined): Promise<IdleFrequencyItem[]> {
    const dbAssets = await analyticsRepository.findAssetsWithLatestRecordAndReturn();

    let range1 = 0; // 1-7
    let range2 = 0; // 8-14
    let range3 = 0; // 15-30
    let range4 = 0; // 31-60
    let range5 = 0; // 60+

    const now = new Date().getTime();

    dbAssets.forEach((asset) => {
        const latestRecord = asset.asset_records[0];
        const currentStatus = latestRecord?.status || 'ACTIVE';
        if (currentStatus !== 'ACTIVE') return;

        const loc = latestRecord?.location || '';
        if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

        const lastReturn = asset.asset_returns[0];
        const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : (latestRecord ? new Date(latestRecord.date_logged).getTime() : now);
        const daysIdle = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

        if (daysIdle <= 7) range1++;
        else if (daysIdle <= 14) range2++;
        else if (daysIdle <= 30) range3++;
        else if (daysIdle <= 60) range4++;
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

/** 10. Lab Head: Inter-Lab Loan Recommender */
export async function loanRecommendations(targetCategory: string | undefined): Promise<LoanRecommendationItem[]> {
    const activeOtherCenterAssets = await analyticsRepository.findActiveRecordsForRecommender(targetCategory);

    const now = new Date().getTime();
    const recommendations = activeOtherCenterAssets.map((rec) => {
        const lastReturn = rec.assets?.asset_returns[0];
        const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : new Date(rec.date_logged).getTime();
        const daysIdle = Math.max(1, Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24)));

        return {
            recommendationId: rec.asset_record_id,
            targetLab: rec.location,
            idleAssetName: rec.assets.name,
            assetTag: rec.assets.asset_tag,
            matchReason: `Matches ${rec.assets.category} requirements. Idle for ${daysIdle} days at ${rec.location}.`,
            ownerLab: rec.projects?.research_centers?.name || rec.location
        };
    });

    return recommendations;
}

// ===========================================================================
// TSG Controllers (Maintenance & Workflows)
// ===========================================================================

/** 14. TSG: Real-Time Location Tracking */
export async function locationStatus(lab: string | undefined): Promise<LocationStatusData> {
    // Fetch all assets with their latest record
    const assets = await analyticsRepository.findAssetsWithLatestRecord();

    const campusMap: Record<string, Record<string, number>> = {
        "Manila Campus": { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
        "Laguna Campus": { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 }
    };
    const statusMap: Record<string, number> = { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 };

    const labs = ["CITe4D", "CAR", "CeHCI", "HXIL", "GAME", "CeLT", "Bio"];
    const labMap: Record<string, { available: number; onLoan: number; underRepair: number }> = {};
    labs.forEach((l) => {
        labMap[l] = { available: 0, onLoan: 0, underRepair: 0 };
    });

    assets.forEach((asset) => {
        const latestRec = asset.asset_records[0];
        const locString = latestRec?.location || "Manila — CITe4D";
        const st = latestRec?.status || "ACTIVE";

        // If lab query filter is provided, filter by location string
        if (lab && !locString.toLowerCase().includes(lab.toLowerCase())) return;

        // Campus grouping (for ReportsAnalyticsDashboard.tsx)
        const campus = locString.includes("Laguna") ? "Laguna Campus" : "Manila Campus";
        campusMap[campus][st] = (campusMap[campus][st] || 0) + 1;

        // Overall status grouping (for ReportsAnalyticsDashboard.tsx and TSGAnalyticsView.tsx)
        statusMap[st] = (statusMap[st] || 0) + 1;

        // Lab-specific grouping (for TSGAnalyticsView.tsx)
        let parsedLab = "CITe4D";
        for (const lName of labs) {
            if (locString.includes(lName)) {
                parsedLab = lName;
                break;
            }
        }

        if (st === "ACTIVE") {
            labMap[parsedLab].available++;
        } else if (st === "ON_LOAN") {
            labMap[parsedLab].onLoan++;
        } else if (st === "MAINTENANCE") {
            labMap[parsedLab].underRepair++;
        }
    });

    // 1. byLocation formatted for ReportsAnalyticsDashboard.tsx
    const byLocation = Object.keys(campusMap).map((campus) => ({
        location: campus,
        ...campusMap[campus]
    }));

    // 2. byStatus formatted for ReportsAnalyticsDashboard.tsx
    const byStatus = Object.keys(statusMap).map((st) => ({
        name: st.replace('_', ' '),
        value: statusMap[st]
    }));

    // 3. locationDistribution formatted for TSGAnalyticsView.tsx
    const locationDistribution = Object.keys(labMap).map((lName) => ({
        location: lName,
        available: labMap[lName].available,
        onLoan: labMap[lName].onLoan,
        underRepair: labMap[lName].underRepair
    }));

    // 4. statusCounts formatted for TSGAnalyticsView.tsx
    const statusCounts = [
        { name: "Available", value: statusMap.ACTIVE || 0 },
        { name: "On Loan", value: statusMap.ON_LOAN || 0 },
        { name: "Under Repair", value: statusMap.MAINTENANCE || 0 },
        { name: "Disposed", value: statusMap.DISPOSED || 0 }
    ];

    return { byLocation, byStatus, locationDistribution, statusCounts };
}

/** 20. TSG: Staggered Routine Inspection Progress */
export async function inspectionProgress(): Promise<InspectionProgressItem[]> {
    const researchCenters = await analyticsRepository.findCentersWithProjectRecords();

    const progress = researchCenters.map((rc) => {
        const centerRecords = rc.projects.flatMap(p => p.asset_records);
        const total = centerRecords.length;

        const inspected = centerRecords.filter(r => r.status === "ACTIVE").length;
        const percent = total > 0 ? Math.round((inspected / total) * 100) : 100;

        return {
            group: `${rc.name} (${rc.short_code})`,
            inspected,
            total,
            percent
        };
    });

    return progress;
}

// ==========================================
// DASHBOARD ANALYTICS & DB INTEGRATION API
// ==========================================

/** 1. Task 1: Director & Secretary Analytics (Macro & Financial View) */
export async function directorDashboard(filters: DirectorFilters): Promise<DirectorAnalyticsData> {
    const { labFilter, isSpecificLab, startDate, endDate } = filters;

    const monetaryAggregation = await analyticsRepository.sumAcquisitionValue();
    const totalPortfolioValue = Number(monetaryAggregation._sum.acquisition_value || 0);

    const pendingDisposalsCount = await analyticsRepository.countPendingDisposals();

    const fundingGroups = await analyticsRepository.groupValueByFundingSource();

    const fundingData = fundingGroups.map(g => ({
        name: g.funding_source || "Unspecified",
        value: Number(g._sum.acquisition_value || 0),
        count: g._count.asset_id
    }));

    const allRecords = await analyticsRepository.findRecordsForDirector(isSpecificLab ? labFilter : null, startDate, endDate);

    const latestRecordsMap = new Map<number, typeof allRecords[0]>();
    for (const r of allRecords) {
        if (!latestRecordsMap.has(r.asset_id)) {
            latestRecordsMap.set(r.asset_id, r);
        }
    }

    let manilaActive = 0, manilaOnLoan = 0, manilaMaintenance = 0, manilaDisposed = 0;
    let lagunaActive = 0, lagunaOnLoan = 0, lagunaMaintenance = 0, lagunaDisposed = 0;

    for (const record of latestRecordsMap.values()) {
        const locUpper = (record.location || "").toUpperCase();
        const isLaguna = locUpper.includes("LAGUNA") || locUpper.includes("CAR") || locUpper.includes("HXIL") || locUpper.includes("CELT") || locUpper.includes("CIVI") || locUpper.includes("MECH");

        const st = record.status;
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

    const reportsByMonthMap = new Map<string, number>();
    for (const rep of reports) {
        const d = new Date(rep.report_date);
        const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        reportsByMonthMap.set(monthLabel, (reportsByMonthMap.get(monthLabel) || 0) + 1);
    }

    let auditComplianceData = Array.from(reportsByMonthMap.entries()).map(([month, count]) => ({
        month,
        count
    }));

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

/** 2. Task 2: Lab Head Analytics & Decisions (Operational & Localized View - Prefix Filtered) */
export async function labHeadDashboard(filters: LabHeadFilters): Promise<LabHeadAnalyticsData> {
    const { prefixFilter, startDate, endDate } = filters;

    const rawLoans = await analyticsRepository.findLoansForLabHead(prefixFilter, startDate, endDate);

    console.log(`📡 [Prisma/MySQL] /api/analytics/lab-head (prefix: "${prefixFilter}") fetched ${rawLoans.length} filtered loans from DB.`);

    const loans = rawLoans.map(l => {
        // Destination lab picked on LoanForm was encoded into purpose at
        // request time (see /borrow) — pulled out here for display,
        // stripped from the shown purpose text so it isn't shown twice.
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
            requestedOn: l.loaned_on.toISOString().split('T')[0],
            dueDate: l.due_date.toISOString().split('T')[0],
            status: l.status.charAt(0).toUpperCase() + l.status.slice(1)
        };
    });

    const rawTransfers = await analyticsRepository.findTransfersForLabHead(prefixFilter, startDate, endDate);

    const transfers = rawTransfers.map(t => {
        // Destination lab picked on TransferForm was encoded into
        // justification at creation time (see /transfer) — pulled out
        // here for display, stripped from the shown text.
        const destLabMatch = t.justification?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
        const destinationLab = destLabMatch ? destLabMatch[1] : undefined;
        const cleanJustification = destLabMatch ? t.justification.replace(/^Destination Lab:\s*.+?\n\n?/, "") : t.justification;

        return {
            transferId: t.transfer_id,
            assetId: t.assets?.asset_tag || `ASSET-${t.asset_id}`,
            asset: t.assets?.name || "Equipment",
            justification: cleanJustification,
            destinationLab,
            requestedOn: t.requested_on.toISOString().split('T')[0],
            status: t.status.charAt(0).toUpperCase() + t.status.slice(1)
        };
    });

    const labAssets = await analyticsRepository.findLabAssetsWithLatestRecord(prefixFilter);

    let assignedCount = 0;
    let unassignedCount = 0;
    for (const a of labAssets) {
        const latestRec = a.asset_records[0];
        if (latestRec && latestRec.project_id !== null && latestRec.project_id !== undefined) {
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

    // 5. Project-to-Asset Allocation Matrix (for Treemap)
    const allProjects = await analyticsRepository.findProjectsWithCenter();

    const projectCountsMap = new Map<number, number>();
    for (const a of labAssets) {
        const r = a.asset_records[0];
        if (r && r.project_id) {
            projectCountsMap.set(r.project_id, (projectCountsMap.get(r.project_id) || 0) + 1);
        }
    }

    const colors = ["#005A36", "#059669", "#10B981", "#34D399", "#6EE7B7", "#047857"];
    const projectAllocation: any[] = [];
    let colorIdx = 0;
    for (const p of allProjects) {
        const count = projectCountsMap.get(p.master_id) || 0;
        if (count > 0) {
            projectAllocation.push({
                projectId: p.project_id,
                name: p.project_name,
                leader: p.project_leader,
                center: p.research_centers?.name || "Research Center",
                count,
                size: count,
                pct: `${totalAssetsCount > 0 ? ((count / totalAssetsCount) * 100).toFixed(1) : 0}%`,
                value: count * 250000,
                color: colors[colorIdx % colors.length]
            });
            colorIdx++;
        }
    }
    projectAllocation.sort((a, b) => b.count - a.count);

    // 6. Custodianship & Overdue Delinquencies Filtered by Prefix
    const now = new Date();

    const allLoansForDelinquency = await analyticsRepository.findLoansForDelinquency(prefixFilter);

    const overdueLoans = allLoansForDelinquency.filter(l => {
        const dueDate = new Date(l.due_date);
        return dueDate.getTime() < now.getTime() && l.status !== 'returned' && l.status !== 'declined';
    });

    const delinquencies = overdueLoans.map(l => {
        const dueDate = new Date(l.due_date);
        const daysOverdue = Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const assetRecord = l.assets?.asset_records[0];
        const project = allProjects.find(p => p.master_id === assetRecord?.project_id);

        return {
            id: l.loan_id,
            assetName: l.assets?.name || `Asset #${l.asset_id}`,
            assetTag: l.assets?.asset_tag || `ASSET-${l.asset_id}`,
            custodian: l.users ? `${l.users.first_name} ${l.users.last_name}` : "Student Custodian",
            email: l.users?.email || "student@dlsu.edu.ph",
            daysOverdue,
            dueDate: l.due_date.toISOString(),
            project: project?.project_name || "Unassigned Cohort",
            projectId: project?.master_id || 0
        };
    });

    // 7. Accountability Scatter Plot Data (Real Database Aggregations Only)
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

    // 8. Cohort Accountability Heatmap Matrix (Real Database Aggregations Only)
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
        transfers,
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

/** 3. Task 3: TSG & ITS Staff Analytics & Repairs (Maintenance & Lifecycle View) */
export async function staffDashboard(): Promise<StaffAnalyticsData> {
    const dbRepairs = await analyticsRepository.findRepairsWithAssetAndReporter();

    const repairs = dbRepairs.map(r => ({
        repairId: r.repair_id,
        assetId: r.assets?.asset_tag || `ASSET-${r.asset_id}`,
        assetName: r.assets?.name || "Equipment",
        reportedBy: r.users ? `${r.users.first_name} ${r.users.last_name}` : "Staff",
        issueDescription: r.issue_description,
        isImmediate: r.is_immediate,
        progressStatus: r.progress_status || "Reported",
        createdAt: r.created_at.toISOString().split('T')[0]
    }));

    const records = await analyticsRepository.findAllRecordsNewestFirst();
    const latestRecordsMap = new Map<number, typeof records[0]>();
    for (const r of records) {
        if (!latestRecordsMap.has(r.asset_id)) {
            latestRecordsMap.set(r.asset_id, r);
        }
    }

    let goodCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;

    const conditionItems: any[] = [];
    const allAssets = await analyticsRepository.findAllAssets();

    for (const a of allAssets) {
        const rec = latestRecordsMap.get(a.asset_id);
        const cond = rec?.asset_condition || "PERFECT";
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
            location: rec?.location || "Unassigned"
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
