/**
 * Delete asset dialog: Staff confirm the permanent removal of an asset from the registry.
 * Layer: feature component. Called by pages/staff/InventoryPage.tsx.
 * Calls: api/assets.api.ts deleteAsset(), state/serverData.tsx syncFromDb().
 * Used by: Staff (ITS and TSG) inventory.
 */
import { useState } from "react";
import { useServerData } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";

/**
 * Asks for confirmation, then deletes the asset through assetsApi.deleteAsset(). On success it
 * reloads the shared lists, closes, and calls onDeleted; on failure it stays open with the error.
 *
 * @param assetToDelete the asset tag to delete; the dialog is open while this is not null
 * @param onClose closes the dialog (Cancel, outside click, or after a successful delete)
 * @param onDeleted reloads the caller's own asset list
 */
// TODO(H-03): a delete either wipes the asset's whole history or, if it has an inspection report, fails on a foreign key. Anyone can call it (C-02). Step 12 and step 13.
export function DeleteAssetDialog({ assetToDelete, onClose, onDeleted }: { assetToDelete: string | null; onClose: () => void; onDeleted: () => Promise<void> }) {
  const { syncFromDb } = useServerData();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await assetsApi.deleteAsset(assetToDelete);
      if (!result.success) {
        throw new Error(result.error || "Delete failed");
      }
      syncFromDb();
      onClose();
      await onDeleted();
    } catch (err: any) {
      console.error("❌ Asset delete failed:", err);
      setDeleteError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={assetToDelete !== null} onOpenChange={open => { if (!open) { onClose(); setDeleteError(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Confirm Asset Deletion</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to permanently delete asset <strong className="text-primary">{assetToDelete}</strong> from the AdRIC registry? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {deleteError && <p className="text-xs text-red-600 font-semibold">⚠️ {deleteError}</p>}
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => { onClose(); setDeleteError(null); }}>Cancel</Button>
          <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDeleteConfirm}>
            {deleting ? "Deleting..." : "Permanently Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
