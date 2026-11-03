/**
 * IT Admin Approvals: the sign-ups waiting for a decision, each approved with a role and labs or rejected.
 * Layer: page. Called by app/routes.tsx at /it-admin/approvals.
 * Calls: state/pendingSignUps.tsx (the list), features/lookups/useLookups.ts (the labs), features/users/ApproveSignUpDialog.tsx
 * and features/users/RejectSignUpDialog.tsx.
 * Used by: the IT Admin.
 */
import { useEffect, useState } from "react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { USER_TYPE_LABELS } from "@shared/constants/signUp";
import type { User } from "@shared/types/users";
import { usePendingSignUps } from "@web/state/pendingSignUps";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { ApproveSignUpDialog } from "@web/features/users/ApproveSignUpDialog";
import { RejectSignUpDialog } from "@web/features/users/RejectSignUpDialog";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/**
 * Lists the pending sign-ups, oldest first, with Approve and Reject on each row. The list reloads when the page opens.
 * A decided sign-up leaves the list at once. The table has no "Requested on" column: an account has no sign-up date
 * yet (module 6). Takes no props.
 */
export function ApprovalsPage() {
  const { users, loading, error, reload, remove } = usePendingSignUps();
  const { lookups, failed: lookupsFailed } = useFormLookups();
  const [approving, setApproving] = useState<User | null>(null);
  const [rejecting, setRejecting] = useState<User | null>(null);

  useEffect(() => {
    reload();
  }, [reload]);

  const decided = (userId: number) => {
    remove(userId);
    setApproving(null);
    setRejecting(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.administration}</h1>
        <p className="text-muted-foreground text-sm">Approvals: review each sign-up, then give it a role and labs or reject it.</p>
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {lookupsFailed && <p role="alert" className="mb-3 text-sm text-red-600">Could not load the labs. Reload the page.</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Name", "Email", "ID Number", "User Type", "Requested Labs", "Action"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {loading ? "Loading sign-ups..." : "No sign-ups are waiting for approval."}
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.userId}>
                  <TableCell className="text-xs font-semibold">{user.firstName} {user.lastName}</TableCell>
                  <TableCell className="text-xs">{user.email}</TableCell>
                  <TableCell className="text-xs font-mono">{user.idNumber}</TableCell>
                  <TableCell className="text-xs">{USER_TYPE_LABELS[user.userType]}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {user.labs.map(lab => <Badge key={lab.centerId} variant="outline" className="text-[10px]">{lab.code}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setApproving(user)} disabled={!lookups}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setRejecting(user)}>Reject</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {approving && lookups && (
        <ApproveSignUpDialog key={approving.userId} user={approving} labs={lookups.labs} onClose={() => setApproving(null)} onApproved={decided} />
      )}
      {rejecting && (
        <RejectSignUpDialog key={rejecting.userId} user={rejecting} onClose={() => setRejecting(null)} onRejected={decided} />
      )}
    </div>
  );
}
