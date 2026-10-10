import type { InspectionReportInput } from '@shared/types/inspections';

const conditionMap: Record<string, any> = {
    "PERFECT": "PERFECT",
    "Perfect": "PERFECT",
    "OPERATIONAL": "OPERATIONAL",
    "Operational": "OPERATIONAL",
    "MINOR_DRIFT": "MINOR_DRIFT",
    "Minor Drift": "MINOR_DRIFT",
    "DEGRADED": "DEGRADED",
    "Degraded Performance": "DEGRADED",
    "CRITICAL_DEFECT": "CRITICAL_DEFECT",
    "Critical Defect": "CRITICAL_DEFECT",
};

/** Reads the condition, remarks, and image an inspection report stores from the body's fields. */
export function readInspectionReport(data: InspectionReportInput): { condition: any; remarks: string; image: string | null } {
    const rawCond = String(data.reportCondition || data.assetCondition || "PERFECT").trim();
    const condition = conditionMap[rawCond] || "PERFECT";

    const remarksVal = String(data.reportRemarks || data.remarks || data.tsgRemarks || data.itsRemarks || data.description || "Routine technical inspection completed.").slice(0, 255);
    const imgVal = data.reportImg || data.image || data.image_url || null;

    return { condition, remarks: remarksVal, image: imgVal };
}
