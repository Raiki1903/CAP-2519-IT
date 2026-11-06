/**
 * Change Head dialog: the IT Admin picks a lab's Head from the lab's Active Researcher members, or leaves it with none.
 * Layer: feature component. Called by features/users/LabsTab.tsx.
 * Calls: api/users.api.ts setLabHead().
 * Used by: the Labs tab of the IT Admin's Users page.
 */
import { useState } from "react";
import type { LookupLab } from "@shared/types/lookups";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";

/** The select's value for "No Head". Account ids are numbers, so this never matches one. */
const NO_HEAD = "none";

const nameOf = (user: User) => `${user.firstName} ${user.lastName}`;

/**
 * Lists "No Head" and the lab's members. A member who already heads another lab is shown but cannot be picked: the
 * server answers 409 for them. Confirm waits while the choice is the lab's Head now. The server has the last word: its
 * sentence is shown when it refuses.
 *
 * Mount it with `key={lab.centerId}` so each lab starts from its own Head.
 *
 * @param lab the lab
 * @param members the lab's Active Researcher members
 * @param currentHeadId the account that heads the lab now, or null
 * @param onClose closes the dialog without a change
 * @param onChanged called with a plain sentence about the change after the server accepted
 */
export function ChangeLabHeadDialog({ lab, members, currentHeadId, onClose, onChanged }: {
  lab: LookupLab;
  members: User[];
  currentHeadId: number | null;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [choice, setChoice] = useState<string>(currentHeadId === null ? NO_HEAD : String(currentHeadId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = choice === (currentHeadId === null ? NO_HEAD : String(currentHeadId));

  const change = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const userId = choice === NO_HEAD ? null : Number(choice);
      const data = await usersApi.setLabHead(lab.centerId, { userId });
      if (!data.success) {
        setError(data.error ?? "Could not change the Head. Try again.");
        return;
      }
      const head = members.find(m => m.userId === userId);
      onChanged(head ? `${lab.code}: ${nameOf(head)} is now the Head.` : `${lab.code} has no Head now.`);
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
          <DialogTitle>Change Head</DialogTitle>
          <DialogDescription>
            {lab.code}: {lab.name}. The Head is an Active Researcher who belongs to the lab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="change-head" className="text-xs font-bold">Head</Label>
          <Select value={choice} onValueChange={setChoice} disabled={submitting}>
            <SelectTrigger id="change-head" className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HEAD} className="text-xs">No Head</SelectItem>
              {members.map(member => {
                const headsAnother = member.headOf !== null && member.headOf.centerId !== lab.centerId;
                return (
                  <SelectItem key={member.userId} value={String(member.userId)} disabled={headsAnother} className="text-xs">
                    {nameOf(member)}{headsAnother && member.headOf ? ` (Head of ${member.headOf.code})` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {members.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No Active Researcher belongs to this lab yet. Add one with Change labs first.</p>
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={change} disabled={submitting || unchanged}>{submitting ? "Saving..." : "Change Head"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
