import React from "react";
import { useApp } from "../context";
import ReportsAnalyticsDashboard from "./ReportsAnalyticsDashboard";
import RoleAnalyticsModule from "./RoleAnalyticsModule";

export function AnalyticsModule({ lab }: { lab?: string } = {}) {
  const { role } = useApp();
  const isLabHead = role === "LabHead";
  const targetLab = "CITe4D";

  const effectiveLab = lab || (isLabHead ? targetLab : undefined);

  return (
    <div className="space-y-10 font-sans">
      <ReportsAnalyticsDashboard lab={effectiveLab} />
      <RoleAnalyticsModule lab={effectiveLab} />
    </div>
  );
}

export default AnalyticsModule;
