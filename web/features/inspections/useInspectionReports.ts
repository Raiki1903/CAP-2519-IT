import { useState, useEffect } from "react";
import * as inspectionsApi from "@web/api/inspections.api";

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
