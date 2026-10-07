/**
 * Inspection reports for Staff: loads every report saved in asset_reports.
 * Layer: feature component (data hook). Called by pages/staff/InspectionsPage.tsx.
 * Calls: api/inspections.api.ts listInspectionReports().
 * Used by: Staff (ITS and TSG) inspection log.
 */
import { useState, useEffect } from "react";
import * as inspectionsApi from "@web/api/inspections.api";

/**
 * Loads GET /api/asset-reports once when the calling page mounts, newest first.
 * A failed request leaves the list empty and is written to the console only.
 *
 * @returns `dbReports` and `fetchDbReports()` to reload after a new report is saved
 */
export function useInspectionReports() {
  const [dbReports, setDbReports] = useState<any[]>([]);

  const fetchDbReports = async () => {
    try {
      const data = await inspectionsApi.listInspectionReports();
      if (data.success) {
        setDbReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to fetch asset reports from DB:", err);
    }
  };

  useEffect(() => {
    fetchDbReports();
  }, []);

  return { dbReports, fetchDbReports };
}
