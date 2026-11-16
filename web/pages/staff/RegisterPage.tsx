/**
 * Staff Register: the asset intake page.
 * Layer: page. Called by app/routes.tsx at /staff/register.
 * Calls: features/assets/IntakeWizard.tsx, state/session.tsx.
 * Used by: Staff asset registration (TSG only; the Secretary is sent to the Overview).
 */
import { Navigate } from "react-router";
import { IntakeWizard } from "@web/features/assets/IntakeWizard";
import { useSession } from "@web/state/session";

/** The heading and the intake wizard. The Secretary, who shares the Staff view, goes to the Overview. Takes no props. */
export function RegisterPage() {
  const { currentUser } = useSession();
  // The server refuses a Secretary's registration too; this keeps a typed address from opening a form that can't be sent.
  if (currentUser && currentUser.staffUnit !== "TSG") return <Navigate to="/staff/overview" replace />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Register Asset</h1>
        <p className="text-muted-foreground text-sm">Add newly acquired equipment to the inventory.</p>
      </div>

      <IntakeWizard />
    </div>
  );
}
