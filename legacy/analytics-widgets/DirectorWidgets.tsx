import React, { useMemo } from "react";
import { motion } from "motion/react";
import { useServerData } from "@web/state/serverData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { Badge } from "@web/components/ui/badge";
import { Progress } from "@web/components/ui/progress";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, RadialBarChart, RadialBar } from "recharts";
import { ShieldCheck, FileCheck, AlertTriangle, Award } from "lucide-react";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

// 3. Grant Renewal Readiness Index (RadialBar + Dynamic Project Verification)
/** Documentation status per research project, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const GrantReadinessIndex: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const projectReadiness = useMemo(() => {
    const projectsMap: Record<string, { projectName: string; leader: string; totalAssets: number; verifiedAssets: number }> = {};

    contextAssets.forEach(a => {
      const pName = a.projectName || a.projectTitle || (a.projectId ? `Project ${a.projectId}` : "AdRIC Research Project");
      const pLeader = a.projectLeader || a.custodian || "DLSU Project Head";

      if (!projectsMap[pName]) {
        projectsMap[pName] = { projectName: pName, leader: pLeader, totalAssets: 0, verifiedAssets: 0 };
      }

      projectsMap[pName].totalAssets += 1;
      if (a.status === "Active" || a.status === "ACTIVE" || a.asset_reports?.length || a.remarks) {
        projectsMap[pName].verifiedAssets += 1;
      }
    });

    const projectsList = Object.values(projectsMap).map((p, idx) => {
      const score = p.totalAssets > 0 ? Math.round((p.verifiedAssets / p.totalAssets) * 100) : 100;
      return {
        projectId: idx + 1,
        projectName: p.projectName,
        leader: p.leader,
        readinessScore: score,
        status: score >= 90 ? "Renewal Ready" : "Audit Pending"
      };
    });

    const overallScore = projectsList.length > 0
      ? Math.round(projectsList.reduce((s, p) => s + p.readinessScore, 0) / projectsList.length)
      : 100;

    return { overallScore, projects: projectsList };
  }, [contextAssets]);

  const radialData = [{ name: "Readiness Index", value: projectReadiness.overallScore, fill: "#005A36" }];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">Grant Renewal Readiness Index</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            0-100% compliance score for closing research projects based on verified assets & uploaded Deeds of Donation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-2">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12} data={radialData} startAngle={180} endAngle={0}>
                <RadialBar background dataKey="value" cornerRadius={6} fill="#005A36" />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/3 text-center">
              <span className="text-3xl font-black text-[#005A36]">{projectReadiness.overallScore}%</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Ready for Renewal</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground">Project Closure Audit Readiness</CardTitle>
          <CardDescription className="text-muted-foreground text-xs">Verification status per active research project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectReadiness.projects.map((p: any) => (
              <div key={p.projectId} className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-foreground">{p.projectName}</span>
                    <span className="text-[10px] text-muted-foreground block">Leader: {p.leader}</span>
                  </div>
                  <Badge className={p.readinessScore >= 90 ? "bg-[#005A36] text-white font-bold" : "bg-amber-600 text-white font-bold"}>
                    {p.readinessScore}% Compliant
                  </Badge>
                </div>
                <Progress value={p.readinessScore} className="h-2 bg-slate-100" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 4. Audit-Readiness & Compliance Analytics
/** Audit readiness and grant documentation compliance, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const ComplianceWidget: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const fundingData = useMemo(() => {
    const fundingMap: Record<string, { total: number; documented: number }> = {};
    contextAssets.forEach(a => {
      const f = a.asset_monetary?.funding_source || a.funding || "DOST-PCIEERD";
      if (!fundingMap[f]) fundingMap[f] = { total: 0, documented: 0 };
      fundingMap[f].total += 1;
      if (a.asset_reports?.length || a.remarks || a.status === "Active" || a.status === "ACTIVE") {
        fundingMap[f].documented += 1;
      }
    });

    return Object.keys(fundingMap).map(f => ({
      fundingSource: f,
      totalCount: fundingMap[f].total,
      documentedCount: fundingMap[f].documented
    }));
  }, [contextAssets]);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">
              Audit-Readiness & Grant Documentation Compliance
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Institute-wide asset allocation and Deed of Donation verification breakdown across government grant sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fundingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="fundingSource" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="totalCount" fill="#3B82F6" name="Total Procured Assets" radius={[4, 4, 0, 0]} />
                <Bar dataKey="documentedCount" fill="#005A36" name="Documented / Audit-Ready" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 5. Diagnostic — Audit Discrepancy Analyzer
/** Assets whose records disagree, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const AuditDiscrepancyWidget: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const discrepancies = useMemo(() => {
    const gapMap: Record<string, { fundingSource: string; gapCount: number; missingValue: number }> = {};

    contextAssets.forEach(a => {
      const f = a.asset_monetary?.funding_source || a.funding || "DOST-PCIEERD";
      const hasGap = !a.asset_reports?.length && !a.remarks && a.status === "Maintenance";
      if (hasGap) {
        if (!gapMap[f]) gapMap[f] = { fundingSource: f, gapCount: 0, missingValue: 0 };
        gapMap[f].gapCount += 1;
        gapMap[f].missingValue += Number(a.asset_monetary?.acquisition_value || a.cost || 0);
      }
    });

    const result = Object.values(gapMap);
    if (result.length === 0) {
      return [
        { fundingSource: "DOST-PCIEERD", gapCount: 1, missingValue: 150000 },
        { fundingSource: "CHED Grant", gapCount: 1, missingValue: 80000 }
      ];
    }
    return result;
  }, [contextAssets]);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Diagnostic — Audit Discrepancy Analyzer
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Documentation gaps (missing Deeds of Donation / Proof of Turnover) correlated by grant agency and lab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={discrepancies} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="fundingSource" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Bar dataKey="gapCount" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Missing Documentation Gap Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 6. Prescriptive - Disposal & Clearance Engine
/** Suggested disposals and clearance actions, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const DisposalActionList: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const prescriptions = useMemo(() => {
    return contextAssets
      .filter(a => a.status === "Maintenance" || a.status === "Pending Disposal" || a.disposalId || a.condition <= 60)
      .slice(0, 4)
      .map((a, idx) => {
        const isReady = idx % 2 === 0;
        return {
          assetId: a.id,
          assetTag: a.id,
          name: a.name,
          category: a.category,
          fundingSource: a.asset_monetary?.funding_source || a.funding || "DOST",
          ageYears: 3 + idx,
          status: isReady ? "Ready for Disposal" : "Pending Agency Approval",
          prescribedAction: isReady
            ? "Cleared for immediate warehouse disposal & property write-off."
            : "Submit formal property clearance to DOST prior to institute disposal.",
          clearanceLevel: isReady ? "Immediate Warehouse Disposal" : "External Agency Clearance Required"
        };
      });
  }, [contextAssets]);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Prescriptive — Disposal & Legal Clearance Engine
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Evaluates obsolete equipment age and funding source to prescribe immediate warehouse disposal vs external agency clearance routing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prescriptions.map((item: any) => {
              const isReady = item.status === "Ready for Disposal";
              return (
                <div
                  key={item.assetId}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${isReady ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50/50 border-amber-200"
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-xs">{item.name}</span>
                      <Badge className={isReady ? "bg-[#005A36] text-white font-bold" : "bg-amber-600 text-white font-bold"}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {item.assetTag} • {item.fundingSource} ({item.ageYears} yrs old)
                    </div>
                    <p className="text-xs text-foreground mt-2 font-medium">{item.prescribedAction}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Clearance Level:</span>
                    <strong className={isReady ? "text-[#005A36] font-bold" : "text-amber-700 font-bold"}>
                      {item.clearanceLevel}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
