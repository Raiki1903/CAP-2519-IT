/**
 * Change labs dialog: the IT Admin replaces the labs of an Active or Inactive account.
 * Layer: feature component. Called by pages/it-admin/UsersPage.tsx.
 * Calls: api/users.api.ts changeLabs(), features/labs/LabMultiSelect.tsx.
 * Used by: the IT Admin's Users page.
 */
import { useState } from "react";
import type { LookupLab } from "@shared/types/lookups";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { LabMultiSelect } from "@web/features/labs/LabMultiSelect";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";

/**
 * Shows every lab with a tick, the account's own labs ticked. Confirm waits while the labs are unchanged, while a
 * Researcher would have none, and while the lab the account heads is unticked (the Head is changed first). The server
 * has the last word: its sentence is shown when it refuses.
 *
 * Mount it with `key={user.userId}` so each account starts from its own labs.
 *
 * @param user the account
 * @param labs the labs from the lookups
 * @param onClose closes the dialog without a change
 * @param onChanged called with a plain sentence about the change after the server accepted
 */
export function ChangeLabsDialog({ user, labs, onClose, onChanged }: {
  user: User;
  labs: LookupLab[];
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [centerIds, setCenterIds] = useState<number[]>(user.labs.map(l => l.centerId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const before = user.labs.map(l => l.centerId);
  const unchanged = centerIds.length === before.length && centerIds.every(id => before.includes(id));
  const needsLab = user.role === "RESEARCHER" && centerIds.length === 0;
  const dropsHeadLab = user.headOf !== null && !centerIds.includes(user.headOf.centerId);

  const change = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await usersApi.changeLabs(user.userId, { centerIds });
      if (!data.success) {
        setError(data.error ?? "Could not change the labs. Try again.");
        return;
      }
      onChanged(`Labs of ${user.firstName} ${user.lastName} changed.`);
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
          <DialogTitle>Change labs</DialogTitle>
          <DialogDescription>
            {user.firstName} {user.lastName}. Tick the labs they belong to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold">
            Labs {user.role === "RESEARCHER" ? "(at least one)" : "(optional for this role)"}
          </Label>
          <LabMultiSelect labs={labs} value={centerIds} onChange={setCenterIds} idPrefix="change-labs" disabled={submitting} />
          {needsLab && <p className="text-[11px] text-destructive">Choose at least one lab for a Researcher.</p>}
          {dropsHeadLab && <p className="text-[11px] text-destructive">Change the lab's Head first.</p>}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={change} disabled={submitting || unchanged || needsLab || dropsHeadLab}>{submitting ? "Saving..." : "Change labs"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
