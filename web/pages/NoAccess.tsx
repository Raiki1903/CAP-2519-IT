/**
 * No-access screen: shown in place of a page that belongs to another role.
 * Layer: page. Called by app/layouts/RootLayout.tsx when a signed-in user opens another role's URL.
 * Calls: state/session.tsx (the role, its name, and its home page). No api calls.
 * Used by: every role.
 */
import { useNavigate } from "react-router";
import { ShieldAlert } from "lucide-react";
import { useSession, roleLabel, roleDefaultPath } from "@web/state/session";
import { Button } from "@web/components/ui/button";
import { Card, CardContent } from "@web/components/ui/card";

/**
 * Tells a signed-in user that the page they opened is for another role, names their own role, and offers
 * their home page. The other role's page is never mounted, so it sends no requests (the server would refuse
 * them anyway, requireRole). Takes no props.
 */
export function NoAccess() {
  const { role } = useSession();
  const navigate = useNavigate();
  if (!role) return null;

  return (
    <div className="flex justify-center pt-10">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <ShieldAlert size={22} className="text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-foreground">You don't have access to this page</h1>
          <p className="text-sm text-muted-foreground">
            You are signed in as {roleLabel[role]}. This page is for another role.
          </p>
          <Button className="mt-2" onClick={() => navigate(roleDefaultPath[role])}>
            Go to my home page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
