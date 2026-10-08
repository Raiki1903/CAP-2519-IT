/**
 * Staff Inspections: inspect assets by lab group, and read the inspection reports on file.
 * Layer: page. Called by app/routes.tsx at /staff/inspections.
 * Calls: features/assets/useStaffAssets.ts, features/inspections (useInspectionReports, InspectionQueue, InspectionLog).
 * Used by: Staff inspections.
 */
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { useInspectionReports } from "@web/features/inspections/useInspectionReports";
import { InspectionQueue } from "@web/features/inspections/InspectionQueue";
import { InspectionLog } from "@web/features/inspections/InspectionLog";

/**
 * Loads the assets and the reports and hands them to the queue and the log. After a report is
 * saved it reloads both, so the new report appears in the log. Takes no props.
 * There is no scheduling here: that code is kept, unused, in legacy/inspection-scheduling/ (H-18).
 */
export function InspectionsPage() {
  const { displayedAssets, fetchDbAssets } = useStaffAssets();
  const { dbReports, fetchDbReports } = useInspectionReports();

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-foreground mb-1">Inspection Operations Manager</h1>
          <p className="text-muted-foreground text-sm">Inspect assets one lab group at a time and review the condition reports on file.</p>
        </div>
      </div>

      <InspectionQueue
        displayedAssets={displayedAssets}
        onReportSaved={async () => {
          await fetchDbAssets();
          await fetchDbReports();
        }}
      />

      <InspectionLog dbReports={dbReports} />
    </div>
  );
}
