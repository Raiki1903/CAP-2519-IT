/**
 * Anonymize dialog: the IT Admin confirms the Data Privacy Act step on an Inactive or Rejected account.
 * Layer: feature component. Called by pages/it-admin/UsersPage.tsx.
 * Calls: api/users.api.ts anonymizeUser().
 * Used by: the IT Admin's Users page.
 */
import { useState } from "react";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";

/**
 * Explains what the step does and cannot undo, then anonymizes. The server has the last word: its sentence is shown
 * when it refuses, for example when the person still has unreturned equipment.
 *
 * @param user the account
 * @param onClose closes the dialog without a change
 * @param onAnonymized called with a plain sentence about the change after the server accepted
 */
export function AnonymizeUserDialog({ user, onClose, onAnonymized }: {
  user: User;
  onClose: () => void;
  onAnonymized: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anonymize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await usersApi.anonymizeUser(user.userId);
      if (!data.success) {
        setError(data.error ?? "Could not anonymize this account. Try again.");
        return;
      }
      onAnonymized(`Account #${user.userId} anonymized.`);
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
          <DialogTitle>Anonymize Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to anonymize{" "}
            <span className="font-semibold text-foreground">{user.firstName} {user.lastName}</span>{" "}
            ({user.email})?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-xs text-muted-foreground">
          <p>
            This action cannot be undone. Their name will be set to "Former researcher", their email to an invalid
            address, and their ID number, photo and labs will be removed. The email and ID number are free for a new
            sign-up.
          </p>
          <p>Their loans, inspections, tickets and log entries stay, under the new name.</p>
          {error && <p role="alert" className="text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={anonymize} disabled={submitting}>
            {submitting ? "Anonymizing..." : "Confirm Anonymization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
