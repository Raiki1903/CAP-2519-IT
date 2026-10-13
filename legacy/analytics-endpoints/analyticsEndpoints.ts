import express, { Request, Response } from 'express';
import { prisma } from './config/prisma.js';

const router = express.Router();

// 18.5 Aggregate descriptive analytics data for the reporting dashboard
router.get('/api/analytics/dashboard', async (req: Request, res: Response): Promise<void> => {
    try {
        // Independent queries — batched to cut connection-hold time.
        const [dbAssets, dbLoans, dbRepairs, dbDisposals, dbReturns] = await Promise.all([
            prisma.assets.findMany({
                include: {
                    asset_monetary: true,
                    asset_records: {
                        orderBy: { date_logged: 'desc' },
                        include: {
                            users: {
                                include: {
                                    user_roles: {
                                        include: {
                                            roles: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            prisma.asset_loans.findMany({
                where: { status: "approved" },
                include: {
                    users: true,
                    assets: true
                }
            }),
            prisma.asset_repairs.findMany({
                orderBy: { created_at: 'asc' }
            }),
            prisma.asset_disposals.findMany({
                where: { status: 'approved' },
                orderBy: { disposal_date: 'asc' }
            }),
            prisma.asset_returns.findMany({
                orderBy: { returned_on: 'asc' }
            }),
        ]);

        // 1. Funding Source Distribution (active assets by funder)
        const fundingCounts: Record<string, number> = {};
        // 2. Asset Lifecycle Status
        let activeCount = 0;
        let deployedCount = 0;
        let maintenanceCount = 0;
        let disposedCount = 0;
        // 4. Cross-Campus Distribution
        let manilaCount = 0;
        let lagunaCount = 0;
        // 6. Custodial Hierarchy
        const roleCounts: Record<string, number> = {};

        dbAssets.forEach(asset => {
            const latest = asset.asset_records[0];
            const status = latest?.status || 'ACTIVE';

            if (status === 'DISPOSED') {
                disposedCount++;
                return; // Disposed assets don't count for active metrics
            }

            // Active assets details
            if (status === 'ACTIVE') activeCount++;
            else if (status === 'ON_LOAN') deployedCount++;
            else if (status === 'MAINTENANCE') maintenanceCount++;

            // Funding Source
            const funder = asset.asset_monetary?.funding_source || 'Unspecified';
            fundingCounts[funder] = (fundingCounts[funder] || 0) + 1;

            // Campus Distribution
            const loc = latest?.location || '';
            if (loc.startsWith('Manila')) manilaCount++;
            else if (loc.startsWith('Laguna')) lagunaCount++;

            // Custodial Hierarchy
            const user = latest?.users;
            if (user) {
                const rolesList = user.user_roles.map(ur => ur.roles.role_name);
                const primaryRole = rolesList[0] || 'CUSTODIAN';
                roleCounts[primaryRole] = (roleCounts[primaryRole] || 0) + 1;
            }
        });

        const fundingDistribution = Object.entries(fundingCounts).map(([name, value]) => ({ name, value }));
        const lifecycleStatus = [
            { name: 'Procured', value: activeCount }, // active/available in inventory
            { name: 'Deployed', value: deployedCount }, // on loan
            { name: 'In-Repair', value: maintenanceCount },
            { name: 'Disposed', value: disposedCount }
        ];
        const campusDistribution = [
            { name: 'Manila', value: manilaCount },
            { name: 'Laguna', value: lagunaCount }
        ];
        const custodialHierarchy = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

        // 3. Uncleared Accountability (overdue loans)
        const overdueLoans = dbLoans.filter(loan => {
            const isOverdue = loan.due_date.getTime() < Date.now();
            if (!isOverdue) return false;
            // Check if current custodian is still the borrower and asset is ON_LOAN
            const asset = dbAssets.find(a => a.asset_id === loan.asset_id);
            const latest = asset?.asset_records[0];
            return latest && latest.status === 'ON_LOAN' && latest.current_custodian === loan.borrower_id;
        }).map(loan => {
            const overdueDays = Math.ceil((Date.now() - loan.due_date.getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: loan.loan_id,
                assetTag: loan.assets.asset_tag,
                assetName: loan.assets.name,
                borrowerName: `${loan.users.first_name} ${loan.users.last_name}`,
                borrowerEmail: loan.users.email,
                borrowerType: loan.users.user_type,
                dueDate: loan.due_date.toISOString().split('T')[0],
                overdueDays
            };
        });

        // 5. Lab-Specific Utilization (borrowing frequency across the 10 AdRIC labs by borrower type)
        const ALL_10_LABS = ["CITe4D", "CAR", "CeHCI", "HXIL", "GAME", "CeLT", "Bio", "CIVI", "CHEM", "MECH"];
        const labCounts: Record<string, { student: number; faculty: number }> = {};
        ALL_10_LABS.forEach(l => { labCounts[l] = { student: 0, faculty: 0 }; });
        dbLoans.forEach(loan => {
            const asset = dbAssets.find(a => a.asset_id === loan.asset_id);
            const record = asset?.asset_records.find(r => r.current_custodian === loan.borrower_id && r.status === 'ON_LOAN');
            const loc = record?.location || asset?.asset_records[0]?.location || '';
            const labName = loc.split(' — ')[1];
            if (labName && ALL_10_LABS.includes(labName)) {
                if (loan.users.user_type === 'STUDENT') {
                    labCounts[labName].student++;
                } else {
                    labCounts[labName].faculty++;
                }
            }
        });
        const labUtilization = Object.entries(labCounts).map(([name, counts]) => ({
            name,
            Student: counts.student,
            Faculty: counts.faculty
        }));

        // 7. Baseline Degradation (average condition of returns over time)
        const monthlyDegradation: Record<string, { sum: number; count: number }> = {};
        dbReturns.forEach(r => {
            const month = r.returned_on.toISOString().substring(0, 7); // YYYY-MM
            let score = 100;
            if (r.condition === 'PERFECT') score = 100;
            else if (r.condition === 'OPERATIONAL') score = 85;
            else if (r.condition === 'MINOR_DRIFT') score = 65;
            else if (r.condition === 'DEGRADED') score = 40;
            else if (r.condition === 'CRITICAL_DEFECT') score = 10;

            if (!monthlyDegradation[month]) {
                monthlyDegradation[month] = { sum: 0, count: 0 };
            }
            monthlyDegradation[month].sum += score;
            monthlyDegradation[month].count += 1;
        });
        // Default historical months for baseline chart if database lacks return logs
        let degradationTrend = Object.entries(monthlyDegradation).map(([month, data]) => ({
            date: month,
            condition: Math.round(data.sum / data.count),
            baseline: 100
        }));
        if (degradationTrend.length === 0) {
            degradationTrend = [
                { date: '2025-09', condition: 100, baseline: 100 },
                { date: '2025-12', condition: 98, baseline: 100 },
                { date: '2026-03', condition: 95, baseline: 100 },
                { date: '2026-06', condition: 92, baseline: 100 }
            ];
        }

        // 8. Repair Request Frequency (volume of repair logs over time)
        const monthlyRepairs: Record<string, number> = {};
        dbRepairs.forEach(r => {
            const month = r.created_at.toISOString().substring(0, 7); // YYYY-MM
            monthlyRepairs[month] = (monthlyRepairs[month] || 0) + 1;
        });
        let repairFrequency = Object.entries(monthlyRepairs).map(([month, count]) => ({
            date: month,
            repairs: count
        }));
        if (repairFrequency.length === 0) {
            repairFrequency = [
                { date: '2025-09', repairs: 0 },
                { date: '2025-12', repairs: 0 },
                { date: '2026-03', repairs: 0 },
                { date: '2026-06', repairs: 0 }
            ];
        }

        // 9. Disposal Volume (cumulative retired equipment over time)
        const monthlyDisposals: Record<string, number> = {};
        dbDisposals.forEach(d => {
            const month = d.disposal_date.toISOString().substring(0, 7); // YYYY-MM
            monthlyDisposals[month] = (monthlyDisposals[month] || 0) + 1;
        });
        let runningDisposals = 0;
        let disposalVolume = Object.entries(monthlyDisposals).map(([month, count]) => {
            runningDisposals += count;
            return {
                date: month,
                disposals: runningDisposals
            };
        });
        if (disposalVolume.length === 0) {
            disposalVolume = [
                { date: '2025-09', disposals: 0 },
                { date: '2025-12', disposals: 0 },
                { date: '2026-03', disposals: 0 },
                { date: '2026-06', disposals: 0 }
            ];
        }

        res.json({
            success: true,
            data: {
                fundingDistribution,
                lifecycleStatus,
                overdueLoans,
                campusDistribution,
                labUtilization,
                custodialHierarchy,
                degradationTrend,
                repairFrequency,
                disposalVolume
            }
        });
    } catch (error: any) {
        console.error("❌ Failed to fetch dashboard analytics:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});




// ---------------------------------------------------------------------------
// Reports & Analytics Dashboard Endpoints (with Lab Filter Support)
// ---------------------------------------------------------------------------

// ===========================================================================
// Reports & Analytics Dashboard Endpoints (with Lab Filter Support)
// ===========================================================================

// 1. Director: Funding Capital & Valuation Breakdown
router.get('/api/analytics/advanced/funding-valuation', async (req: Request, res: Response): Promise<void> => {
    try {
        const monetaries = await prisma.asset_monetary.findMany({
            select: {
                funding_source: true,
                acquisition_value: true,
                assets: {
                    select: {
                        category: true,
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1,
                            select: {
                                status: true
                            }
                        }
                    }
                }
            }
        });

        const fundingMap: Record<string, { totalValue: number; count: number; categories: Record<string, number> }> = {};
        monetaries.forEach((m) => {
            const latestRecord = m.assets?.asset_records[0];
            const status = latestRecord?.status || 'ACTIVE';
            if (status === 'DISPOSED') return;

            const f = m.funding_source || "DOST-PCIEERD";
            const val = Number(m.acquisition_value || 0);
            const cat = m.assets?.category || "DEV_KIT";

            if (!fundingMap[f]) {
                fundingMap[f] = { totalValue: 0, count: 0, categories: {} };
            }
            fundingMap[f].totalValue += val;
            fundingMap[f].count += 1;
            fundingMap[f].categories[cat] = (fundingMap[f].categories[cat] || 0) + val;
        });

        const outerPie = Object.keys(fundingMap).map(f => ({
            name: f,
            value: fundingMap[f].totalValue,
            count: fundingMap[f].count
        }));

        const innerPie: { name: string; value: number; parent: string }[] = [];
        Object.keys(fundingMap).forEach(f => {
            Object.keys(fundingMap[f].categories).forEach(cat => {
                innerPie.push({
                    name: `${f} - ${cat}`,
                    value: fundingMap[f].categories[cat],
                    parent: f
                });
            });
        });

        res.json({ success: true, data: { outerPie, innerPie } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Director: Cross-Campus Transfer Flow
router.get('/api/analytics/advanced/campus-transfer-flow', async (req: Request, res: Response): Promise<void> => {
    try {
        const usersWithCenters = await prisma.users.findMany({
            select: {
                user_id: true,
                user_centers: {
                    select: {
                        research_centers: {
                            select: {
                                location: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        const userLocationMap = new Map<number, { location: string; centerName: string }>();
        usersWithCenters.forEach((u) => {
            const firstCenter = u.user_centers[0]?.research_centers;
            userLocationMap.set(u.user_id, {
                location: firstCenter?.location || "MANILA",
                centerName: firstCenter?.name || "General"
            });
        });

        const transfers = await prisma.asset_transfers.findMany({
            select: {
                from_custodian_id: true,
                to_custodian_id: true
            }
        });

        let manilaToLaguna = 0;
        let lagunaToManila = 0;
        let internalManila = 0;
        let internalLaguna = 0;

        transfers.forEach(t => {
            const fromLoc = userLocationMap.get(t.from_custodian_id)?.location || "MANILA";
            const toLoc = userLocationMap.get(t.to_custodian_id)?.location || "MANILA";

            if (fromLoc === "MANILA" && toLoc === "LAGUNA") {
                manilaToLaguna += 1;
            } else if (fromLoc === "LAGUNA" && toLoc === "MANILA") {
                lagunaToManila += 1;
            } else if (fromLoc === "MANILA" && toLoc === "MANILA") {
                internalManila += 1;
            } else if (fromLoc === "LAGUNA" && toLoc === "LAGUNA") {
                internalLaguna += 1;
            }
        });

        res.json({
            success: true,
            data: {
                nodes: [
                    { name: "Manila Campus" },
                    { name: "Laguna Campus" },
                    { name: "Manila Internal" },
                    { name: "Laguna Internal" }
                ],
                links: [
                    { source: 0, target: 1, value: manilaToLaguna },
                    { source: 1, target: 0, value: lagunaToManila },
                    { source: 0, target: 2, value: internalManila },
                    { source: 1, target: 3, value: internalLaguna }
                ]
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Director: Grant Renewal Readiness Index
router.get('/api/analytics/advanced/grant-readiness-index', async (req: Request, res: Response): Promise<void> => {
    try {
        const allProjects = await prisma.projects.findMany({
            include: {
                asset_records: true,
                research_centers: true
            }
        });

        const readinessData = allProjects.map((p) => {
            const totalAssets = p.asset_records.length;
            const accountedAssets = p.asset_records.filter(r => r.status !== "ON_LOAN").length;
            const readinessScore = totalAssets > 0 ? Math.round((accountedAssets / totalAssets) * 100) : 100;

            return {
                projectId: p.project_id,
                projectName: p.project_name,
                leader: p.project_leader,
                center: p.research_centers?.name || "Unknown Center",
                readinessScore,
                status: readinessScore >= 90 ? "Renewal Ready" : "Document Audit Pending"
            };
        });

        const overallScore = readinessData.length > 0
            ? Math.round(readinessData.reduce((acc, curr) => acc + curr.readinessScore, 0) / readinessData.length)
            : 100;

        res.json({ success: true, data: { overallScore, projects: readinessData } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Director: Documentation Completeness / Compliance Analytics
router.get('/api/analytics/compliance', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const monetaries = await prisma.asset_monetary.findMany({
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            include: {
                                projects: true
                            }
                        }
                    }
                }
            }
        });

        const fundingMap: Record<string, { totalCount: number; documentedCount: number; totalValue: number }> = {};
        let govTotal = 0;
        let govDocumented = 0;

        monetaries.forEach((m) => {
            const latestRecord = m.assets?.asset_records[0];
            const status = latestRecord?.status || 'ACTIVE';
            if (status === 'DISPOSED') return;

            const loc = latestRecord?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const projectAgency = latestRecord?.projects?.funding_agency;
            const f = projectAgency || m.funding_source || "Unspecified";

            if (!fundingMap[f]) {
                fundingMap[f] = { totalCount: 0, documentedCount: 0, totalValue: 0 };
            }
            fundingMap[f].totalCount += 1;
            fundingMap[f].totalValue += Number(m.acquisition_value || 0);
            if (m.is_documented) {
                fundingMap[f].documentedCount += 1;
            }

            const isGov = ["DOST", "CHED", "USAID", "DOST-PCIEERD"].some((g) => f.toUpperCase().includes(g));
            if (isGov) {
                govTotal += 1;
                if (m.is_documented) govDocumented += 1;
            }
        });

        const byFundingSource = Object.keys(fundingMap).map((f) => ({
            fundingSource: f,
            totalCount: fundingMap[f].totalCount,
            documentedCount: fundingMap[f].documentedCount,
            compliancePercentage: fundingMap[f].totalCount > 0 ? Math.round((fundingMap[f].documentedCount / fundingMap[f].totalCount) * 100) : 100,
            totalValue: fundingMap[f].totalValue
        }));

        const auditReadyPercentage = govTotal > 0 ? Math.round((govDocumented / govTotal) * 100) : 100;

        res.json({ success: true, data: { byFundingSource, auditReadyPercentage, govTotal, govDocumented } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Director: Asset Utilization Justifier
router.get('/api/analytics/stakeholder/utilization', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_loans: { select: { loan_id: true } },
                asset_transfers: { select: { transfer_id: true } },
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const topUtilized = assets
            .filter((a) => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const borrowCount = a.asset_loans.length + a.asset_transfers.length;
                return {
                    assetId: a.asset_id,
                    assetName: a.name,
                    assetTag: a.asset_tag,
                    category: a.category,
                    borrowCount
                };
            })
            .sort((a, b) => b.borrowCount - a.borrowCount)
            .slice(0, 10);

        res.json({ success: true, data: topUtilized });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Director: Audit Discrepancy Analyzer
router.get('/api/analytics/stakeholder/audit-discrepancies', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = req.query.lab as string | undefined;
        const monetaries = await prisma.asset_monetary.findMany({
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1,
                            include: {
                                projects: {
                                    include: {
                                        research_centers: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const discrepancyMap: Record<string, { fundingSource: string; lab: string; gapCount: number; missingValue: number }> = {};

        monetaries.forEach(m => {
            const latestRecord = m.assets?.asset_records[0];
            const status = latestRecord?.status || 'ACTIVE';
            if (status === 'DISPOSED') return;

            const loc = latestRecord?.projects?.research_centers?.name || "Unassigned Center";
            const actualLoc = latestRecord?.location || "";
            if (labFilter && !actualLoc.toLowerCase().includes(labFilter.toLowerCase())) return;

            const isDoc = m.is_documented;
            const funding = m.funding_source || "Unspecified";
            const key = `${funding}__${loc}`;

            if (!discrepancyMap[key]) {
                discrepancyMap[key] = { fundingSource: funding, lab: loc, gapCount: 0, missingValue: 0 };
            }
            if (!isDoc) {
                discrepancyMap[key].gapCount += 1;
                discrepancyMap[key].missingValue += Number(m.acquisition_value || 0);
            }
        });

        const discrepancies = Object.values(discrepancyMap).filter(d => d.gapCount > 0);
        res.json({ success: true, data: discrepancies });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Director: Disposal & Clearance Engine
router.get('/api/analytics/stakeholder/disposal-prescriptions', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_monetary: true,
                asset_repairs: true,
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const now = new Date();
        const prescriptions = assets
            .filter(a => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map(a => {
                const ageYears = a.procurement_date
                    ? Math.floor((now.getTime() - new Date(a.procurement_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
                    : 2;
                const funding = a.asset_monetary?.funding_source || "University";
                const repairCount = a.asset_repairs?.length || 0;
                const isGov = ["DOST", "CHED", "USAID", "DOST-PCIEERD"].some(g => funding.toUpperCase().includes(g));

                let status = "Operational";
                let prescribedAction = "Retain in Service";
                let clearanceLevel = "Internal";

                if (repairCount >= 2 || ageYears >= 4) {
                    if (isGov && ageYears < 5) {
                        status = "Pending Agency Approval";
                        prescribedAction = `Submit formal clearance to ${funding} prior to property write-off.`;
                        clearanceLevel = "External Agency Clearance Required";
                    } else {
                        status = "Ready for Disposal";
                        prescribedAction = "Cleared for immediate warehouse disposal & staging.";
                        clearanceLevel = "Immediate Warehouse Disposal";
                    }
                }

                return {
                    assetId: a.asset_id,
                    assetTag: a.asset_tag,
                    name: a.name,
                    category: a.category,
                    fundingSource: funding,
                    ageYears,
                    repairCount,
                    status,
                    prescribedAction,
                    clearanceLevel
                };
            })
            .filter(p => p.status !== "Operational");

        res.json({ success: true, data: prescriptions });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// Lab Head Controllers (Project Allocation & Accountability)
// ===========================================================================

// 8. Lab Head: Project-to-Asset Allocation
router.get('/api/analytics/advanced/project-allocation', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const dbAssets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1,
                    include: {
                        projects: true
                    }
                }
            }
        });

        const projectMap: Record<string, number> = {};
        dbAssets.forEach(asset => {
            const latestRecord = asset.asset_records[0];
            const currentStatus = latestRecord?.status || 'ACTIVE';
            if (currentStatus !== 'ON_LOAN') return;

            const loc = latestRecord?.location || '';
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const pName = latestRecord.projects?.project_name || "General Lab Inventory";
            projectMap[pName] = (projectMap[pName] || 0) + 1;
        });

        const treemapData = Object.keys(projectMap).map(p => ({
            name: p,
            size: projectMap[p] * 10
        }));

        res.json({ success: true, data: treemapData });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. Lab Head: Custodianship & Delinquency Tracker
router.get('/api/analytics/delinquencies', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const now = new Date();
        const overdueLoans = await prisma.asset_loans.findMany({
            where: {
                due_date: { lt: now },
                status: { notIn: ["returned", "RETURNED"] }
            },
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        }
                    }
                },
                users: true
            }
        });

        const delinquencies = overdueLoans
            .filter((l) => {
                const loc = l.assets?.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((l) => {
                const overdueDays = Math.max(1, Math.floor((now.getTime() - new Date(l.due_date).getTime()) / (1000 * 60 * 60 * 24)));
                return {
                    id: String(l.assets.asset_tag),
                    assetName: l.assets.name,
                    assetTag: l.assets.asset_tag,
                    custodian: `${l.users.first_name} ${l.users.last_name}`,
                    email: l.users.email,
                    daysOverdue: overdueDays,
                    dueDate: l.due_date.toISOString(),
                    location: l.assets?.asset_records[0]?.location || "General Lab"
                };
            });

        res.json({ success: true, data: delinquencies });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. Lab Head: Accountability Bottleneck Mapper
router.get('/api/analytics/stakeholder/accountability-bottlenecks', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = req.query.lab as string | undefined;
        const loans = await prisma.asset_loans.findMany({
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        },
                        asset_returns: {
                            orderBy: { returned_on: "desc" },
                            take: 1
                        }
                    }
                },
                users: true
            }
        });

        const bottleneckMap: Record<string, { lab: string; studentBatch: string; avgOverdueDays: number; totalCount: number }> = {};
        const now = new Date();

        loans.forEach((l) => {
            const loc = l.assets?.asset_records[0]?.location || "General Lab";
            if (labFilter && !loc.toLowerCase().includes(labFilter.toLowerCase())) return;

            const lastReturn = l.assets.asset_returns[0];
            const endDate = lastReturn ? new Date(lastReturn.returned_on) : now;
            const due = new Date(l.due_date);
            const overdueDays = Math.max(0, Math.floor((endDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));

            const batch = l.users.id_number ? `ID ${String(l.users.id_number).slice(0, 3)} Cohort` : "Student Cohort";
            const key = `${loc}__${batch}`;

            if (!bottleneckMap[key]) {
                bottleneckMap[key] = { lab: loc, studentBatch: batch, avgOverdueDays: 0, totalCount: 0 };
            }
            bottleneckMap[key].avgOverdueDays += overdueDays;
            bottleneckMap[key].totalCount += 1;
        });

        const bottlenecks = Object.values(bottleneckMap).map((b) => ({
            lab: b.lab,
            studentBatch: b.studentBatch,
            avgOverdueDays: Math.round(b.avgOverdueDays / (b.totalCount || 1)),
            activeLoansCount: b.totalCount
        }));

        res.json({ success: true, data: bottlenecks });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 13. Lab Head: Automated Project-Closure Recall
router.post('/api/analytics/stakeholder/project-closure-recall', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = req.query.lab as string | undefined;
        const now = new Date();
        const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const closingProjects = await prisma.projects.findMany({
            where: {
                end_date: {
                    gte: now,
                    lte: fourteenDaysLater
                }
            },
            include: {
                asset_records: {
                    where: {
                        status: "ON_LOAN"
                    },
                    select: {
                        asset_id: true
                    }
                },
                research_centers: true
            }
        });

        const recallPayloads = closingProjects
            .filter((p) => !labFilter || p.research_centers?.name.toLowerCase().includes(labFilter.toLowerCase()))
            .map((p) => ({
                projectId: p.project_id,
                projectName: p.project_name,
                projectLeader: p.project_leader,
                centerName: p.research_centers?.name || "General Lab",
                endDate: p.end_date,
                affectedAssetsCount: p.asset_records.length,
                affectedAssetIds: p.asset_records.map(r => r.asset_id),
                prescribedRecall: `Initiate 1-Click Mass Recall for ${p.project_name} graduating cohort.`
            }));

        res.json({ success: true, data: recallPayloads });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// TSG Controllers (Maintenance & Workflows)
// ===========================================================================

// 15. TSG: Equipment Health Trend
router.get('/api/analytics/health-trends', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const repairs = await prisma.asset_repairs.findMany({
            where: { created_at: { gte: twelveMonthsAgo } },
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        // Category trends for Reports dashboard
        const categoryMap: Record<string, number> = {};
        const repairCounts: Record<number, number> = {};

        repairs.forEach((rep) => {
            const loc = rep.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const cat = rep.assets?.category || "Unknown";
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
            repairCounts[rep.asset_id] = (repairCounts[rep.asset_id] || 0) + 1;
        });

        const categoryTrends = Object.keys(categoryMap).map((cat) => ({
            category: cat,
            repairs: categoryMap[cat]
        }));

        const assets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

        const riskAlerts = assets
            .filter((a) => {
                const loc = a.asset_records?.[0]?.location || "";
                if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return false;
                return (repairCounts[a.asset_id] || 0) >= 2 || (a.procurement_date && new Date(a.procurement_date) < threeYearsAgo);
            })
            .map((a) => ({
                assetId: a.asset_id,
                assetTag: a.asset_tag,
                name: a.name,
                category: a.category,
                repairCount: repairCounts[a.asset_id] || 0,
                procurementDate: a.procurement_date,
                riskReason: (repairCounts[a.asset_id] || 0) >= 2 ? "High Repair Frequency" : "Aging Lifecycle Limit"
            }));

        // Monthly trends for TSG dashboard
        const returns = await prisma.asset_returns.findMany({
            where: { returned_on: { gte: twelveMonthsAgo } },
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentMonth = new Date().getMonth();
        const chronologicalMonths: string[] = [];
        for (let i = 11; i >= 0; i--) {
            const m = (currentMonth - i + 12) % 12;
            chronologicalMonths.push(months[m]);
        }

        const monthlyTrends = chronologicalMonths.map((m) => ({
            month: m,
            defectReports: 0,
            maintenanceLogs: 0
        }));

        const monthMap: Record<string, number> = {};
        chronologicalMonths.forEach((m, idx) => {
            monthMap[m] = idx;
        });

        repairs.forEach((rep) => {
            const loc = rep.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const date = new Date(rep.created_at);
            const mName = months[date.getMonth()];
            const idx = monthMap[mName];
            if (idx !== undefined) {
                monthlyTrends[idx].defectReports++;
            }
        });

        returns.forEach((ret) => {
            const loc = ret.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const date = new Date(ret.returned_on);
            const mName = months[date.getMonth()];
            const idx = monthMap[mName];
            if (idx !== undefined) {
                monthlyTrends[idx].maintenanceLogs++;
            }
        });

        res.json({ success: true, data: { categoryTrends, riskAlerts, monthlyTrends } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16. TSG: Degradation Root-Cause Tracker
router.get('/api/analytics/stakeholder/degradation', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_transfers: true,
                asset_returns: {
                    orderBy: { returned_on: "asc" }
                },
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const result = assets
            .filter((a) => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const transfersCount = a.asset_transfers.length;

                let conditionDrops = 0;
                const conditionSeverity: Record<string, number> = {
                    PERFECT: 0,
                    OPERATIONAL: 1,
                    "MINOR_DRIFT": 2,
                    DEGRADED: 3,
                    "CRITICAL_DEFECT": 4
                };

                let lastSeverity = -1;
                a.asset_returns.forEach((ret) => {
                    const currentSeverity = conditionSeverity[ret.condition] ?? 1;
                    if (lastSeverity !== -1 && currentSeverity > lastSeverity) {
                        conditionDrops += 1;
                    }
                    lastSeverity = currentSeverity;
                });

                const wearIndex = Math.min(100, (transfersCount * 15) + (conditionDrops * 25));

                return {
                    category: a.category,
                    handovers: transfersCount,
                    wearIndex,
                    conditionDrops
                };
            });

        const categorySummaryMap: Record<string, { handovers: number; wearIndexSum: number; count: number }> = {};
        result.forEach((r) => {
            const cat = r.category;
            if (!categorySummaryMap[cat]) {
                categorySummaryMap[cat] = { handovers: 0, wearIndexSum: 0, count: 0 };
            }
            categorySummaryMap[cat].handovers += r.handovers;
            categorySummaryMap[cat].wearIndexSum += r.wearIndex;
            categorySummaryMap[cat].count += 1;
        });

        const categorySummary = Object.keys(categorySummaryMap).map((cat) => ({
            category: cat,
            handovers: categorySummaryMap[cat].handovers,
            wearIndex: Math.round(categorySummaryMap[cat].wearIndexSum / categorySummaryMap[cat].count)
        }));

        res.json({ success: true, data: categorySummary });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16b. TSG: Degradation Tracker List for Role Dashboard
router.get('/api/analytics/stakeholder/degradation-tracker', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_repairs: true,
                asset_loans: true,
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const list = assets
            .filter((a) => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const handoverEvents = a.asset_loans.length;
                const repairCount = a.asset_repairs.length;
                const healthScore = Math.max(45, 100 - (handoverEvents * 6) - (repairCount * 12));

                return {
                    assetTag: a.asset_tag,
                    name: a.name,
                    category: a.category,
                    handoverEvents,
                    repairCount,
                    healthScore
                };
            });

        res.json({ success: true, data: list });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 17. TSG: Preventative Maintenance Scheduler
router.get('/api/analytics/stakeholder/preventative-schedule', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_returns: {
                    orderBy: { returned_on: "desc" },
                    take: 1
                },
                asset_repairs: true,
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const now = new Date();
        const schedules = assets
            .filter(a => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const latestReturn = a.asset_returns[0];
                const condition = latestReturn?.condition || "OPERATIONAL";
                const ageYears = a.procurement_date
                    ? Math.floor((now.getTime() - new Date(a.procurement_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
                    : 2;

                let action = "Routine Calibration";
                let priority = "Low";
                let dueForMaintenance = false;

                if (condition === "CRITICAL_DEFECT") {
                    action = "Decommission & Disposal Review";
                    priority = "Critical";
                    dueForMaintenance = true;
                } else if (condition === "DEGRADED" || ageYears >= 3) {
                    action = "Preventative Component Servicing & Calibration";
                    priority = "High";
                    dueForMaintenance = true;
                } else if (condition === "MINOR_DRIFT") {
                    action = "Diagnostic Check & Calibration Review";
                    priority = "Medium";
                    dueForMaintenance = true;
                } else if (a.asset_repairs.length > 0) {
                    action = "Post-Repair Inspection & Diagnostics";
                    priority = "Medium";
                    dueForMaintenance = true;
                }

                return {
                    assetId: a.asset_id,
                    assetTag: a.asset_tag,
                    name: a.name,
                    category: a.category,
                    condition,
                    ageYears,
                    prescribedAction: action,
                    priority,
                    dueForMaintenance
                };
            })
            .filter(s => s.dueForMaintenance);

        res.json({ success: true, data: schedules });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 18. TSG: Warranty Expiration Calendar
router.get('/api/analytics/advanced/warranty-calendar', async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const assets = await prisma.assets.findMany({
            where: {
                warranty_expiry: {
                    gte: now,
                    lte: ninetyDaysLater
                }
            }
        });

        const expiring = assets.map((a) => ({
            assetId: a.asset_id,
            assetTag: a.asset_tag,
            name: a.name,
            category: a.category,
            warrantyExpiry: a.warranty_expiry,
            daysRemaining: Math.max(1, Math.floor((new Date(a.warranty_expiry!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        }));

        res.json({ success: true, data: expiring });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 19. TSG: MTTR & Vendor Reliability
router.get('/api/analytics/advanced/vendor-reliability', async (req: Request, res: Response): Promise<void> => {
    try {
        const repairs = await prisma.asset_repairs.findMany({
            include: {
                assets: true
            }
        });

        const records = await prisma.asset_records.findMany({
            where: {
                status: "ACTIVE"
            },
            orderBy: { date_logged: "asc" }
        });

        const vendorStats: Record<string, { totalRepairs: number; totalResolutionTime: number }> = {};

        repairs.forEach((rep) => {
            const vendor = rep.assets?.manufacturer || "Generic Vendor";
            const start = new Date(rep.created_at).getTime();

            const resolveRecord = records.find(r => r.asset_id === rep.asset_id && new Date(r.date_logged).getTime() > start);
            const end = resolveRecord ? new Date(resolveRecord.date_logged).getTime() : start + (5 * 24 * 60 * 60 * 1000);

            const resolutionDays = (end - start) / (1000 * 60 * 60 * 24);

            if (!vendorStats[vendor]) {
                vendorStats[vendor] = { totalRepairs: 0, totalResolutionTime: 0 };
            }
            vendorStats[vendor].totalRepairs += 1;
            vendorStats[vendor].totalResolutionTime += resolutionDays;
        });

        const reliabilityData = Object.keys(vendorStats).map((v) => {
            const avgMttr = vendorStats[v].totalRepairs > 0
                ? Number((vendorStats[v].totalResolutionTime / vendorStats[v].totalRepairs).toFixed(1))
                : 0;
            const rating = Math.max(70, Math.min(100, Math.round(100 - (avgMttr * 3))));

            return {
                vendorName: v,
                mttrDays: avgMttr,
                totalRepairs: vendorStats[v].totalRepairs,
                reliabilityRating: `${rating}%`
            };
        });

        res.json({ success: true, data: reliabilityData });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// Student Researchers Controllers (Queueing & Stewardship)
// ===========================================================================

// 21. Student: Chain of Custody Defect Isolator
router.get('/api/analytics/stakeholder/chain-of-custody/:assetId', async (req: Request, res: Response): Promise<void> => {
    try {
        const assetId = Number(req.params.assetId);

        const transfers = await prisma.asset_transfers.findMany({
            where: { asset_id: assetId }
        });

        const returns = await prisma.asset_returns.findMany({
            where: { asset_id: assetId },
            include: { users: true }
        });

        const timeline: { type: string; date: Date; description: string; detail?: string }[] = [];

        transfers.forEach((t) => {
            timeline.push({
                type: "TRANSFER",
                date: t.requested_on,
                description: `Custodian shift request: from Custodian #${t.from_custodian_id} to Custodian #${t.to_custodian_id}`,
                detail: t.justification
            });
        });

        returns.forEach((r) => {
            timeline.push({
                type: "RETURN",
                date: r.returned_on,
                description: `Equipment returned in ${r.condition} condition by ${r.users?.first_name} ${r.users?.last_name}`,
                detail: `Reference: ${r.reference_number}`
            });
        });

        timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        res.json({ success: true, data: timeline });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 22. Student: Contextual Stewardship Prompts
router.get('/api/analytics/stakeholder/stewardship-guidelines/:category', async (req: Request, res: Response): Promise<void> => {
    try {
        const category = (req.params.category as string) || "DEV_KIT";

        const guidelines: Record<string, { storage: string; handling: string; calibration: string }> = {
            DEV_KIT: { storage: "Store in anti-static ESD bag at room temperature.", handling: "Ground yourself with anti-static wrist strap before pin connection.", calibration: "Verify GPIO pin voltage baseline prior to sensor load." },
            CPU: { storage: "Maintain 20°C ambient room temperature with ventilation.", handling: "Avoid blocking exhaust fans during high GPU compute workloads.", calibration: "Run stress testing scripts before machine learning model execution." },
            SIMULATOR: { storage: "Lock arm joints in transport park position.", handling: "Clear 1.5m radius workspace before executing cobot trajectories.", calibration: "Zero joint encoders every 10 operational hours." },
            CAMERA: { storage: "Keep in moisture-controlled dry box with silica gel.", handling: "Use lens cap when transferring between indoor and outdoor locations.", calibration: "Perform white balance and sensor dust check." }
        };

        const result = guidelines[category] || guidelines.DEV_KIT;
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 23. Student: Equipment Availability & Reservation Calendar
router.get('/api/analytics/advanced/equipment-calendar', async (req: Request, res: Response): Promise<void> => {
    try {
        const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;

        const loans = await prisma.asset_loans.findMany({
            where: assetId ? { asset_id: assetId } : undefined,
            include: {
                assets: true
            }
        });

        const events = loans.map((l) => ({
            id: l.loan_id,
            title: `Reserved: ${l.assets.name} (Tag: ${l.assets.asset_tag})`,
            start: l.loaned_on,
            end: l.due_date,
            status: l.status
        }));

        res.json({ success: true, data: events });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 24. Student: Borrower Stewardship Score
router.get('/api/analytics/advanced/stewardship-score/:userId', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = Number(req.params.userId);

        const loans = await prisma.asset_loans.findMany({
            where: { borrower_id: userId }
        });

        const returns = await prisma.asset_returns.findMany({
            where: { returned_by_id: userId }
        });

        const now = new Date();
        let overdueCount = 0;
        loans.forEach((l) => {
            if (new Date(l.due_date).getTime() < now.getTime() && l.status !== "returned" && l.status !== "RETURNED") {
                overdueCount++;
            }
        });

        let minorDriftCount = 0;
        let degradedCount = 0;
        let failureCount = 0;
        returns.forEach((r) => {
            if (r.condition === "MINOR_DRIFT") minorDriftCount++;
            else if (r.condition === "DEGRADED") degradedCount++;
            else if (r.condition === "CRITICAL_DEFECT") failureCount++;
        });

        const penalty = (overdueCount * 5) + (minorDriftCount * 3) + (degradedCount * 10) + (failureCount * 25);
        const score = Math.max(0, 100 - penalty);

        let tier = "Restricted Borrower";
        let perks = "Requires Faculty Sponsor Approval for Checkout";

        if (score >= 90) {
            tier = "Exemplary Borrower";
            perks = "Priority 24-Hour Express Checkout Granted";
        } else if (score >= 75) {
            tier = "Good Borrower";
            perks = "Standard Checkout Granted";
        } else if (score >= 50) {
            tier = "Needs Supervision";
            perks = "Limit of 2 active equipment checkouts";
        }

        res.json({
            success: true,
            data: {
                score,
                tier,
                onTimeReturns: returns.length - degradedCount - failureCount,
                lateReturns: overdueCount,
                damageFlags: degradedCount + failureCount,
                perks
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});
