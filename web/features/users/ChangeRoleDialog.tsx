/**
 * Change role dialog: the IT Admin gives an Active or Inactive account one other role.
 * Layer: feature component. Called by pages/it-admin/UsersPage.tsx.
 * Calls: api/users.api.ts changeRole().
 * Used by: the IT Admin's Users page.
 */
import { useState } from "react";
import { DATABASE_ROLES, DATABASE_ROLE_LABELS, type DatabaseRole } from "@shared/enums/role";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";

/**
 * Asks for the new role, then changes it. Confirm waits while the role is the one the account has, and while a
 * Researcher would have no lab (the labs are changed first). The server has the last word: its sentence is shown when
 * it refuses.
 *
 * Mount it with `key={user.userId}` so each account starts from its own role.
 *
 * @param user the account
 * @param onClose closes the dialog without a change
 * @param onChanged called with a plain sentence about the change after the server accepted
 */
export function ChangeRoleDialog({ user, onClose, onChanged }: {
  user: User;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [role, setRole] = useState<DatabaseRole>(user.role ?? "RESEARCHER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = role === user.role;
  const needsLab = role === "RESEARCHER" && user.labs.length === 0;

  const change = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await usersApi.changeRole(user.userId, { role });
      if (!data.success) {
        setError(data.error ?? "Could not change the role. Try again.");
        return;
      }
      onChanged(`${user.firstName} ${user.lastName} is now ${DATABASE_ROLE_LABELS[role]}.`);
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
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {user.firstName} {user.lastName} is {user.role ? DATABASE_ROLE_LABELS[user.role] : "without a role"}. Choose their new role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="change-role" className="text-xs font-bold">Role</Label>
          <Select value={role} onValueChange={value => setRole(value as DatabaseRole)} disabled={submitting}>
            <SelectTrigger id="change-role" className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATABASE_ROLES.map(value => (
                <SelectItem key={value} value={value} className="text-xs">{DATABASE_ROLE_LABELS[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsLab && <p className="text-[11px] text-destructive">A Researcher needs at least one lab. Change their labs first.</p>}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={change} disabled={submitting || unchanged || needsLab}>{submitting ? "Saving..." : "Change role"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
