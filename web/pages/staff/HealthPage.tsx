/**
 * Staff Analytics: the page around the Staff analytics view.
 * Layer: page. Called by app/routes.tsx at /staff/analytics.
 * Calls: features/analytics/staff/StaffAnalyticsView.tsx.
 * Used by: Staff.
 */
import StaffAnalyticsView from "@web/features/analytics/staff/StaffAnalyticsView";
import { Wrench } from "lucide-react";

/** Shows the page title and StaffAnalyticsView. Takes no props. */
export function HealthPage() {
  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#005A36]" />
            Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Repairs, condition, warranties, and inspections.</p>
        </div>
      </div>

      <StaffAnalyticsView />
    </div>
  );
}
