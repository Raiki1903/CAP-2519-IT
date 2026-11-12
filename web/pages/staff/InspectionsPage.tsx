/**
 * Staff Inspections: inspect the assets due for a routine inspection by lab group, and read the inspection reports on file.
 * Layer: page. Called by app/routes.tsx at /staff/inspections.
 * Calls: features/inspections (useInspectionReports, InspectionQueue, InspectionLog), state/session.tsx.
 * Used by: Staff inspections.
 */
import { useInspectionReports } from "@web/features/inspections/useInspectionReports";
import { InspectionQueue } from "@web/features/inspections/InspectionQueue";
import { InspectionLog } from "@web/features/inspections/InspectionLog";
import { useSession } from "@web/state/session";

/**
 * Loads the reports for the log; the queue (TSG only) loads its own list from the server. After a report is saved it reloads the
 * reports, so the new one appears in the log. Takes no props.
 * The queue's period is the manuscript's "selected inspection periods"; the old scheduling code is kept, unused, in
 * legacy/inspection-scheduling/ (H-18).
 */
export function InspectionsPage() {
  const { dbReports, fetchDbReports } = useInspectionReports();
  const { currentUser } = useSession();
  // The queue is TSG's work (the server answers it only to TSG); the Secretary reads the log.
  const isTsg = currentUser?.staffUnit === "TSG";

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-foreground mb-1">Inspections</h1>
          <p className="text-muted-foreground text-sm">
            {isTsg
              ? "Inspect the assets that are due, one lab group at a time, and review the condition reports on file."
              : "Review the condition reports on file."}
          </p>
        </div>
      </div>

      {isTsg && <InspectionQueue onReportSaved={fetchDbReports} />}

      <InspectionLog dbReports={dbReports} />
    </div>
  );
}
