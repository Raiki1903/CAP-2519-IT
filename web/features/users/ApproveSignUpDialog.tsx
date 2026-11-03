/**
 * Approve dialog: the IT Admin gives a Pending sign-up one role and its labs.
 * Layer: feature component. Called by pages/it-admin/ApprovalsPage.tsx.
 * Calls: api/users.api.ts approveSignUp(), features/labs/LabMultiSelect.tsx.
 * Used by: the IT Admin's Approvals page.
 */
import { useState } from "react";
import { USER_TYPE_LABELS } from "@shared/constants/signUp";
import { DATABASE_ROLES, DATABASE_ROLE_LABELS, type DatabaseRole } from "@shared/enums/role";
import type { LookupLab } from "@shared/types/lookups";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { LabMultiSelect } from "@web/features/labs/LabMultiSelect";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";

/**
 * Asks for a role and the labs, then approves. The labs start as the ones the applicant asked for. A Researcher needs at
 * least one lab; the other roles may have none, so the button waits only for a Researcher. The server has the last
 * word: its sentence is shown when it refuses.
 *
 * Mount it with `key={user.userId}` so each sign-up starts from its own requested labs.
 *
 * @param user the Pending sign-up
 * @param labs the labs from the lookups
 * @param onClose closes the dialog without a decision
 * @param onApproved called with the approved user's id after the server accepted
 */
export function ApproveSignUpDialog({ user, labs, onClose, onApproved }: {
  user: User;
  labs: LookupLab[];
  onClose: () => void;
  onApproved: (userId: number) => void;
}) {
  const [role, setRole] = useState<DatabaseRole>("RESEARCHER");
  const [centerIds, setCenterIds] = useState<number[]>(user.labs.map(l => l.centerId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLab = role === "RESEARCHER" && centerIds.length === 0;

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await usersApi.approveSignUp(user.userId, { role, centerIds });
      if (!data.success) {
        setError(data.error ?? "Could not approve this sign-up. Try again.");
        return;
      }
      onApproved(user.userId);
    } catch {
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve sign-up</DialogTitle>
          <DialogDescription>
            {user.firstName} {user.lastName} ({USER_TYPE_LABELS[user.userType]}). Choose their role and labs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="approve-role" className="text-xs font-bold">Role</Label>
            <Select value={role} onValueChange={value => setRole(value as DatabaseRole)} disabled={submitting}>
              <SelectTrigger id="approve-role" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATABASE_ROLES.map(value => (
                  <SelectItem key={value} value={value} className="text-xs">{DATABASE_ROLE_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">
              Labs {role === "RESEARCHER" ? "(at least one)" : "(optional for this role)"}
            </Label>
            <LabMultiSelect labs={labs} value={centerIds} onChange={setCenterIds} idPrefix="approve" disabled={submitting} />
            {needsLab && <p className="text-[11px] text-red-600">Choose at least one lab for a Researcher.</p>}
          </div>

          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={approve} disabled={submitting || needsLab}>{submitting ? "Approving..." : "Approve"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
