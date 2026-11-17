/**
 * Reset password dialog: the IT Admin sets a new password for another account.
 * Layer: feature component. Called by pages/it-admin/UsersPage.tsx.
 * Calls: api/users.api.ts resetUserPassword().
 * Used by: the IT Admin's Users page.
 */
import { useState } from "react";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

/**
 * Collects a new password (at least 8 characters, confirmed) and resets it. The server has the last word:
 * its sentence is shown when it refuses.
 *
 * @param user the account whose password is being reset
 * @param onClose closes the dialog without a change
 * @param onReset called with a plain sentence about the change after the server accepted
 */
export function ResetPasswordDialog({ user, onClose, onReset }: {
  user: User;
  onClose: () => void;
  onReset: (message: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleReset = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await usersApi.resetUserPassword(user.userId, newPassword);
      if (!data.success) {
        setError(data.error ?? "Could not reset this password. Try again.");
        return;
      }
      onReset("Password reset. Give the new password to the user in person.");
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
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for{" "}
            <span className="font-semibold text-foreground">{user.firstName} {user.lastName}</span>.
            Give the new password to the user in person after saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rp-new" className="text-xs font-semibold">New Password</Label>
            <div className="relative">
              <Input
                id="rp-new"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-9 text-xs pr-9"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">At least 8 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm" className="text-xs font-semibold">Confirm Password</Label>
            <div className="relative">
              <Input
                id="rp-confirm"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat the new password"
                className="h-9 text-xs pr-9"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleReset} disabled={submitting || !canSubmit}>
            {submitting ? "Resetting..." : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
