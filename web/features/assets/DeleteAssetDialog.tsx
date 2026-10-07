import { useState } from "react";
import { useServerData } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";

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
