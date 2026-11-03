/**
 * Reject dialog: the IT Admin rejects a Pending sign-up, with optional remarks.
 * Layer: feature component. Called by pages/it-admin/ApprovalsPage.tsx.
 * Calls: api/users.api.ts rejectSignUp().
 * Used by: the IT Admin's Approvals page.
 */
import { useState } from "react";
import { REJECT_REMARKS_MAX_LENGTH } from "@shared/constants/signUp";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";
import { Textarea } from "@web/components/ui/textarea";

/**
 * Asks for optional remarks, then rejects. The count shows the remarks as the server will read them (trimmed). Past
 * the limit the box is not cut: the count turns red, the message says why, and Confirm waits, so nothing typed is
 * dropped silently.
 *
 * @param user the Pending sign-up
 * @param onClose closes the dialog without a decision
 * @param onRejected called with the rejected user's id after the server accepted
 */
export function RejectSignUpDialog({ user, onClose, onRejected }: {
  user: User;
  onClose: () => void;
  onRejected: (userId: number) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = remarks.trim().length;
  const tooLong = length > REJECT_REMARKS_MAX_LENGTH;

  const reject = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await usersApi.rejectSignUp(user.userId, { remarks: remarks.trim() || null });
      if (!data.success) {
        setError(data.error ?? "Could not reject this sign-up. Try again.");
        return;
      }
      onRejected(user.userId);
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
          <DialogTitle>Reject sign-up</DialogTitle>
          <DialogDescription>
            {user.firstName} {user.lastName} will not be able to log in, and will see that the sign-up was not approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reject-remarks" className="text-xs font-bold">Remarks (optional)</Label>
          <Textarea
            id="reject-remarks"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            disabled={submitting}
            rows={4}
            className="text-xs"
            aria-invalid={tooLong}
          />
          <p className={tooLong ? "text-[11px] text-red-600 font-semibold" : "text-[11px] text-muted-foreground"}>
            {length} / {REJECT_REMARKS_MAX_LENGTH}
            {tooLong && ` Remarks must be at most ${REJECT_REMARKS_MAX_LENGTH} characters.`}
          </p>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={reject} disabled={submitting || tooLong}>
            {submitting ? "Rejecting..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
