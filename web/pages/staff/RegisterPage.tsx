import { IntakeWizard } from "@web/features/assets/IntakeWizard";

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
