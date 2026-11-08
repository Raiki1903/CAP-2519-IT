/**
 * Asset remarks: the Remarks section of the asset detail modal. It lists the asset's remarks, newest first, and offers
 * an add box and delete buttons only where the server says this user may use them.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx.
 * Calls: api/assets.api.ts listRemarks(), addRemark(), deleteRemark().
 * Used by: every role that opens an asset: TSG, the Secretary, the Director, a Lab Head, a Researcher, and the IT Admin.
 */
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { AssetRemark } from "@shared/types/assets";
import { ASSET_REMARK_MAX_LENGTH } from "@shared/constants/assetRemarks";
import * as assetsApi from "@web/api/assets.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Textarea } from "@web/components/ui/textarea";

/** A remark's time, for example "Nov 8, 2026, 3:05 PM". */
const remarkTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Shows the asset's remarks and lets the user add or delete one when the server allows it (`canAdd`, and each
 * remark's `canDelete`), so the screen never works out roles itself. A delete asks for confirmation first. After an
 * add or a delete the list loads again. Refusals show the server's sentence.
 *
 * @param assetTag the asset's tag; the list loads again when it changes
 */
export function AssetRemarks({ assetTag }: { assetTag: string }) {
  const [remarks, setRemarks] = useState<AssetRemark[]>([]);
  const [canAdd, setCanAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AssetRemark | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async (tag: string, isCurrent: () => boolean = () => true) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await assetsApi.listRemarks(tag);
      if (!isCurrent()) return;
      if (data.success) {
        setRemarks(data.remarks || []);
        setCanAdd(!!data.canAdd);
      } else {
        setLoadError(data.error || "Failed to load the remarks.");
      }
    } catch (err: any) {
      if (isCurrent()) setLoadError(err?.message || "Failed to load the remarks.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  // A new asset starts empty, and an answer for the asset shown before is dropped.
  useEffect(() => {
    let current = true;
    setRemarks([]);
    setCanAdd(false);
    setDraft("");
    setAddError(null);
    load(assetTag, () => current);
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTag]);

  const add = async () => {
    setSaving(true);
    setAddError(null);
    try {
      const data = await assetsApi.addRemark(assetTag, draft.trim());
      if (!data.success) {
        setAddError(data.error || "The remark could not be saved. Please try again.");
        return;
      }
      setDraft("");
      await load(assetTag);
    } catch (err: any) {
      setAddError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const closeDelete = () => { setToDelete(null); setDeleteError(null); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const data = await assetsApi.deleteRemark(assetTag, toDelete.remarkId);
      if (!data.success) {
        setDeleteError(data.error || "The remark could not be deleted. Please try again.");
        return;
      }
      closeDelete();
      await load(assetTag);
    } catch (err: any) {
      setDeleteError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-xl p-3 text-xs">
      <p className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">Remarks</p>

      {canAdd && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={ASSET_REMARK_MAX_LENGTH}
            placeholder="Write a remark about this asset"
            className="text-xs min-h-16"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">{draft.length}/{ASSET_REMARK_MAX_LENGTH}</span>
            <Button size="sm" className="text-xs font-bold" disabled={saving || !draft.trim()} onClick={add}>
              {saving ? "Saving…" : "Add Remark"}
            </Button>
          </div>
          {addError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{addError}</p>}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600 max-h-56 overflow-y-auto">
        {loading && remarks.length === 0 ? (
          <p className="text-slate-400 italic py-1">Loading the remarks…</p>
        ) : loadError ? (
          <p className="text-red-500 italic py-1">{loadError}</p>
        ) : remarks.length === 0 ? (
          <p className="text-slate-400 italic py-1">No remarks yet.</p>
        ) : (
          remarks.map(r => (
            <div key={r.remarkId} className="py-1 border-b border-slate-50 last:border-b-0">
              <div className="flex justify-between items-center gap-2">
                <span><strong className="text-slate-700">{r.author.name}</strong></span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400">{remarkTime(r.createdAt)}</span>
                  {r.canDelete && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-600"
                      title="Delete remark"
                      aria-label="Delete remark"
                      onClick={() => setToDelete(r)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </span>
              </div>
              <p className="mt-1 bg-white p-2 rounded-lg border border-slate-100 text-[11px] text-slate-600 whitespace-pre-wrap break-words">{r.text}</p>
            </div>
          ))
        )}
      </div>

      <Dialog open={toDelete !== null} onOpenChange={open => { if (!open) closeDelete(); }}>
        {/* z-[60]: this opens over AssetDetailModal, whose card is at z-index 51. Escape closes only this dialog: the
            modal closes on an Escape that reaches window, so it is stopped here. */}
        <DialogContent className="max-w-md z-[60]" overlayClassName="z-[60]" onEscapeKeyDown={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Delete this remark?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              The remark by <strong className="text-foreground">{toDelete?.author.name}</strong> will no longer show on {assetTag}.
            </DialogDescription>
          </DialogHeader>
          {toDelete && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{toDelete.text}</p>
          )}
          {deleteError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{deleteError}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" disabled={deleting} onClick={closeDelete}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting…" : "Delete Remark"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
