const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.ts');
let content = fs.readFileSync(serverPath, 'utf8');

const startMarker = "// 1. Real-Time Tracking & Location Analytics";
const endMarker = "// 19. Start the Application Listener";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1) {
    console.error("Start marker not found!");
    process.exit(1);
}
if (endIndex === -1) {
    console.error("End marker not found!");
    process.exit(1);
}

console.log(`Found start index at ${startIndex}, end index at ${endIndex}`);

const newAnalyticsCode = `// ===========================================================================
// Reports & Analytics Dashboard Endpoints (with Lab Filter Support)
// ===========================================================================

// 1. Director: Funding Capital & Valuation Breakdown
app.get('/api/analytics/advanced/funding-valuation', async (req: Request, res: Response): Promise<void> => {
    try {
        const monetaries = await prisma.asset_monetary.findMany({
            select: {
                funding_source: true,
                acquisition_value: true,
                assets: {
                    select: {
                        category: true
                    }
                }
            }
        });

        const fundingMap: Record<string, { totalValue: number; count: number; categories: Record<string, number> }> = {};
        monetaries.forEach((m) => {
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
                    name: \`\${f} - \${cat}\`,
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
app.get('/api/analytics/advanced/campus-transfer-flow', async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/analytics/advanced/grant-readiness-index', async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/analytics/compliance', async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/analytics/stakeholder/utilization', async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/analytics/stakeholder/audit-discrepancies', async (req: Request, res: Response): Promise<void> => {
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
            const loc = latestRecord?.projects?.research_centers?.name || "Unassigned Center";
            const actualLoc = latestRecord?.location || "";
            if (labFilter && !actualLoc.toLowerCase().includes(labFilter.toLowerCase())) return;

            const isDoc = m.is_documented;
            const funding = m.funding_source || "Unspecified";
            const key = \`\${funding}__\${loc}\`;

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
app.get('/api/analytics/stakeholder/disposal-prescriptions', async (req: Request, res: Response): Promise<void> => {
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
                        prescribedAction = \`Submit formal clearance to \${funding} prior to property write-off.\`;
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
app.get('/api/analytics/advanced/project-allocation', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const records = await prisma.asset_records.findMany({
            where: {
                status: "ON_LOAN"
            },
            include: {
                projects: true
            }
        });

        const projectMap: Record<string, number> = {};
        records.forEach(r => {
            if (lab && !r.location.toLowerCase().includes(lab.toLowerCase())) return;
            const pName = r.projects?.project_name || "General Lab Inventory";
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

// 9a. Lab Head: Asset Idle Time Analyzer (Idle Time groups)
app.get('/api/analytics/advanced/idle-time', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const activeAssets = await prisma.asset_records.findMany({
            where: {
                status: "ACTIVE"
            },
            include: {
                assets: {
                    include: {
                        asset_returns: {
                            orderBy: { returned_on: "desc" },
                            take: 1
                        }
                    }
                }
            }
        });

        let underSevenDays = 0;
        let sevenToThirtyDays = 0;
        let overThirtyDays = 0;

        const now = new Date().getTime();

        activeAssets.forEach((rec) => {
            if (lab && !rec.location.toLowerCase().includes(lab.toLowerCase())) return;
            const lastReturn = rec.assets?.asset_returns[0];
            const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : new Date(rec.date_logged).getTime();
            const daysIdle = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

            if (daysIdle < 7) {
                underSevenDays++;
            } else if (daysIdle <= 30) {
                sevenToThirtyDays++;
            } else {
                overThirtyDays++;
            }
        });

        res.json({
            success: true,
            data: [
                { category: "< 7 Days", count: underSevenDays },
                { category: "7-30 Days", count: sevenToThirtyDays },
                { category: "> 30 Days (Idle)", count: overThirtyDays }
            ]
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9b. Lab Head: Asset Idle Time Analyzer (Idle Frequency Range Chart)
app.get('/api/analytics/advanced/idle-frequency', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const activeAssets = await prisma.asset_records.findMany({
            where: {
                status: "ACTIVE"
            },
            include: {
                assets: {
                    include: {
                        asset_returns: {
                            orderBy: { returned_on: "desc" },
                            take: 1
                        }
                    }
                }
            }
        });

        let range1 = 0; // 1-7
        let range2 = 0; // 8-14
        let range3 = 0; // 15-30
        let range4 = 0; // 31-60
        let range5 = 0; // 60+

        const now = new Date().getTime();

        activeAssets.forEach((rec) => {
            if (lab && !rec.location.toLowerCase().includes(lab.toLowerCase())) return;
            const lastReturn = rec.assets?.asset_returns[0];
            const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : new Date(rec.date_logged).getTime();
            const daysIdle = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

            if (daysIdle <= 7) range1++;
            else if (daysIdle <= 14) range2++;
            else if (daysIdle <= 30) range3++;
            else if (daysIdle <= 60) range4++;
            else range5++;
        });

        res.json({
            success: true,
            data: [
                { durationRange: "1-7 Days", equipmentCount: range1, criticality: "Low" },
                { durationRange: "8-14 Days", equipmentCount: range2, criticality: "Normal" },
                { durationRange: "15-30 Days", equipmentCount: range3, criticality: "Moderate" },
                { durationRange: "31-60 Days", equipmentCount: range4, criticality: "High" },
                { durationRange: "60+ Days", equipmentCount: range5, criticality: "Critical" }
            ]
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. Lab Head: Inter-Lab Loan Recommender
app.get('/api/analytics/advanced/loan-recommender', async (req: Request, res: Response): Promise<void> => {
    try {
        const targetCategory = req.query.category as string | undefined;

        const activeOtherCenterAssets = await prisma.asset_records.findMany({
            where: {
                status: "ACTIVE",
                assets: targetCategory ? { category: targetCategory as any } : undefined
            },
            include: {
                assets: {
                    include: {
                        asset_returns: {
                            orderBy: { returned_on: "desc" },
                            take: 1
                        }
                    }
                },
                projects: {
                    include: {
                        research_centers: true
                    }
                }
            }
        });

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
                matchReason: \`Matches \${rec.assets.category} requirements. Idle for \${daysIdle} days at \${rec.location}.\`,
                ownerLab: rec.projects?.research_centers?.name || rec.location
            };
        });

        res.json({ success: true, data: recommendations });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. Lab Head: Custodianship & Delinquency Tracker
app.get('/api/analytics/delinquencies', async (req: Request, res: Response): Promise<void> => {
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
                    loanId: l.loan_id,
                    assetTag: l.assets.asset_tag,
                    assetName: l.assets.name,
                    borrowerName: \`\${l.users.first_name} \${l.users.last_name}\`,
                    borrowerEmail: l.users.email,
                    dueDate: l.due_date,
                    overdueDays
                };
            });

        res.json({ success: true, data: delinquencies });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. Lab Head: Accountability Bottleneck Mapper
app.get('/api/analytics/stakeholder/accountability-bottlenecks', async (req: Request, res: Response): Promise<void> => {
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

            const batch = l.users.id_number ? \`ID \${String(l.users.id_number).slice(0, 3)} Cohort\` : "Student Cohort";
            const key = \`\${loc}__\${batch}\`;

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
app.post('/api/analytics/stakeholder/project-closure-recall', async (req: Request, res: Response): Promise<void> => {
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
                prescribedRecall: \`Initiate 1-Click Mass Recall for \${p.project_name} graduating cohort.\`
            }));

        res.json({ success: true, data: recallPayloads });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// TSG Controllers (Maintenance & Workflows)
// ===========================================================================

// 14. TSG: Real-Time Location Tracking
app.get('/api/analytics/location-status', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const records = await prisma.asset_records.findMany({
            include: { assets: true }
        });

        const locationMap: Record<string, Record<string, number>> = {};
        const statusMap: Record<string, number> = { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 };

        records.forEach((rec) => {
            if (lab && !rec.location.toLowerCase().includes(lab.toLowerCase())) return;
            const loc = rec.location.includes("Laguna") ? "Laguna Campus" : "Manila Campus";
            const st = rec.status || "ACTIVE";

            if (!locationMap[loc]) {
                locationMap[loc] = { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 };
            }
            locationMap[loc][st] = (locationMap[loc][st] || 0) + 1;
            statusMap[st] = (statusMap[st] || 0) + 1;
        });

        const byLocation = Object.keys(locationMap).map((loc) => ({
            location: loc,
            ...locationMap[loc]
        }));

        const byStatus = Object.keys(statusMap).map((st) => ({
            name: st.replace('_', ' '),
            value: statusMap[st]
        }));

        res.json({ success: true, data: { byLocation, byStatus } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 15. TSG: Equipment Health Trend
app.get('/api/analytics/health-trends', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const repairs = await prisma.asset_repairs.findMany({
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

        const trendMap: Record<string, Record<string, number>> = {};
        repairs.forEach((rep) => {
            const loc = rep.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const date = new Date(rep.created_at);
            const monthYear = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
            const cat = rep.assets?.category || "Unknown";

            if (!trendMap[monthYear]) {
                trendMap[monthYear] = {};
            }
            trendMap[monthYear][cat] = (trendMap[monthYear][cat] || 0) + 1;
        });

        const formattedTrends = Object.keys(trendMap).map((monthYear) => ({
            month: monthYear,
            ...trendMap[monthYear]
        }));

        res.json({ success: true, data: formattedTrends });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16. TSG: Degradation Root-Cause Tracker
app.get(['/api/analytics/stakeholder/degradation', '/api/analytics/stakeholder/degradation-tracker'], async (req: Request, res: Response): Promise<void> => {
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
                    PRISTINE: 0,
                    OPERATIONAL: 1,
                    DEGRADED: 2,
                    COMPLETE_FAILURE: 3
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

// 17. TSG: Preventative Maintenance Scheduler
app.get('/api/analytics/stakeholder/preventative-schedule', async (req: Request, res: Response): Promise<void> => {
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

                if (condition === "COMPLETE_FAILURE") {
                    action = "Decommission & Disposal Review";
                    priority = "Critical";
                    dueForMaintenance = true;
                } else if (condition === "DEGRADED" || ageYears >= 3) {
                    action = "Preventative Component Servicing & Calibration";
                    priority = "High";
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
app.get('/api/analytics/advanced/warranty-calendar', async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/analytics/advanced/vendor-reliability', async (req: Request, res: Response): Promise<void> => {
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
                reliabilityRating: \`\${rating}%\`
            };
        });

        res.json({ success: true, data: reliabilityData });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 20. TSG: Staggered Routine Inspection Progress
app.get('/api/analytics/advanced/inspection-progress', async (req: Request, res: Response): Promise<void> => {
    try {
        const researchCenters = await prisma.research_centers.findMany({
            include: {
                projects: {
                    include: {
                        asset_records: true
                    }
                }
            }
        });

        const progress = researchCenters.map((rc) => {
            const centerRecords = rc.projects.flatMap(p => p.asset_records);
            const total = centerRecords.length;

            const inspected = centerRecords.filter(r => r.status === "ACTIVE").length;
            const percent = total > 0 ? Math.round((inspected / total) * 100) : 100;

            return {
                group: \`\${rc.name} (\${rc.short_code})\`,
                inspected,
                total,
                percent
            };
        });

        res.json({ success: true, data: progress });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// Student Researchers Controllers (Queueing & Stewardship)
// ===========================================================================

// 21. Student: Chain of Custody Defect Isolator
app.get('/api/analytics/stakeholder/chain-of-custody/:assetId', async (req: Request, res: Response): Promise<void> => {
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
                description: \`Custodian shift request: from Custodian #\${t.from_custodian_id} to Custodian #\${t.to_custodian_id}\`,
                detail: t.justification
            });
        });

        returns.forEach((r) => {
            timeline.push({
                type: "RETURN",
                date: r.returned_on,
                description: \`Equipment returned in \${r.condition} condition by \${r.users?.first_name} \${r.users?.last_name}\`,
                detail: \`Reference: \${r.reference_number}\`
            });
        });

        timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        res.json({ success: true, data: timeline });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 22. Student: Contextual Stewardship Prompts
app.get('/api/analytics/stakeholder/stewardship-guidelines/:category', async (req: Request, res: Response): Promise<void> => {
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
app.get('/api/analytics/advanced/equipment-calendar', async (req: Request, res: Response): Promise<void> => {
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
            title: \`Reserved: \${l.assets.name} (Tag: \${l.assets.asset_tag})\`,
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
app.get('/api/analytics/advanced/stewardship-score/:userId', async (req: Request, res: Response): Promise<void> => {
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

        let degradedCount = 0;
        let failureCount = 0;
        returns.forEach((r) => {
            if (r.condition === "DEGRADED") degradedCount++;
            else if (r.condition === "COMPLETE_FAILURE") failureCount++;
        });

        const penalty = (overdueCount * 5) + (degradedCount * 10) + (failureCount * 25);
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

`;

const modifiedContent = content.substring(0, startIndex) + newAnalyticsCode + content.substring(endIndex);

fs.writeFileSync(serverPath, modifiedContent, 'utf8');
console.log("server.ts updated successfully!");
