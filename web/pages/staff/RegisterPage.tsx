/**
 * Staff Register: the asset intake page.
 * Layer: page. Called by app/routes.tsx at /its/register and /tsg/register.
 * Calls: features/assets/IntakeWizard.tsx.
 * Used by: Staff (ITS and TSG) asset registration.
 */
import { IntakeWizard } from "@web/features/assets/IntakeWizard";

/** The heading and the intake wizard. Takes no props. */
export function RegisterPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Equipment Procurement Registration</h1>
        <p className="text-muted-foreground text-sm">Register newly acquired computing assets, sensors, and network devices.</p>
      </div>

      <IntakeWizard />
    </div>
  );
}
