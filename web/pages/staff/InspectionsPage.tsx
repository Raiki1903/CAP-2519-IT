import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { useInspectionReports } from "@web/features/inspections/useInspectionReports";
import { InspectionQueue } from "@web/features/inspections/InspectionQueue";
import { InspectionLog } from "@web/features/inspections/InspectionLog";

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
