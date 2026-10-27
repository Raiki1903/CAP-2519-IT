/**
 * Edit asset dialog: Staff correct an asset's registry details, status, condition, custodian, and photo.
 * Layer: feature component. Called by pages/staff/InventoryPage.tsx.
 * Calls: api/assets.api.ts updateAssetRaw(), features/lookups/useLookups.ts (the option lists and the custodian list).
 * Used by: Staff asset editing.
 */
import { useState } from "react";
import * as assetsApi from "@web/api/assets.api";
import { useCustodianOptions, useFormLookups, withCurrentOption } from "@web/features/lookups/useLookups";
import { ASSET_CONDITIONS } from "@shared/enums/assetCondition";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { cn } from "@web/components/ui/utils";
import { Trash2 } from "lucide-react";
import { CONDITION_PILL_CLASS, assetStatusLabel } from "./assetBadges";

// The list sends the status as display text; the dialog keeps and sends the stored value. Overdue is On Loan past its
// due date, so it opens as On Loan and saves as such.
const STORED_STATUS: Record<string, string> = {
  Active: "ACTIVE",
  "On Loan": "ON_LOAN",
  Overdue: "ON_LOAN",
  Maintenance: "MAINTENANCE",
  Disposed: "DISPOSED",
};

/**
 * Edits one asset and saves it through assetsApi.updateAssetRaw(), sending only the fields Staff changed. Shows the
 * server's error text under the form when the save fails, and stays open.
 *
 * @param asset the asset row as the inventory shows it
 * @param onClose closes the dialog
 * @param onSave called after a successful save with the merged asset, so the caller can reload its lists
 */
export function EditAssetDialog({ asset, onClose, onSave }: { asset: any; onClose: () => void; onSave: (updated: any) => void }) {
  // The values the dialog opened with. Some are screen text rather than stored values (a placeholder remark, a default
  // lab), so a save sends only what differs from these, and the server sees only real changes. (issue #74)
  const [start] = useState(() => ({
    name: asset?.name || "",
    serial: asset?.serial || "",
    manufacturer: asset?.manufacturer || "",
    category: asset?.category || "IT Equipment",
    funding: asset?.funding || "Internal Grants",
    procured: asset?.procured || "",
    warranty: asset?.warranty || "",
    location: asset?.location || "Manila",
    lab: asset?.lab || "CITe4D",
    assetCondition: asset?.assetCondition || "PERFECT",
    // The holder's user id, or null for None (nobody holds it). Matched by id, never by name. (issue #95)
    custodianId: (asset?.custodianId ?? null) as number | null,
    status: STORED_STATUS[asset?.status] ?? (asset?.status || "ACTIVE"),
    image: asset?.image || asset?.image_url || "",
    description: asset?.description || asset?.remarks || ""
  }));
  const [form, setForm] = useState(start);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lookups, failed: lookupsFailed } = useFormLookups();
  // Each list from the server, plus the asset's own value when the list does not have it (older data).
  const categoryOptions = withCurrentOption(lookups?.categories ?? [], start.category);
  const fundingOptions = withCurrentOption(lookups?.fundingSources ?? [], start.funding);
  const labOptions = withCurrentOption(lookups?.labs.map(l => l.code) ?? [], start.lab);
  const statusOptions = withCurrentOption(lookups?.statuses ?? [], start.status);

  const { custodians, failed: custodiansFailed } = useCustodianOptions();
  // A holder who is not a Custodian account (older data) is still offered, so a save that does not touch it keeps it.
  const custodianOptions = start.custodianId !== null && !custodians.some(c => c.userId === start.custodianId)
    ? [...custodians, { userId: start.custodianId, name: asset?.custodian || `User ${start.custodianId}` }]
    : custodians;

  const handleSave = async () => {
    const changes: Partial<typeof form> = {};
    for (const key of Object.keys(form) as (keyof typeof form)[]) {
      if (form[key] !== start[key]) changes[key] = form[key];
    }
    // The server joins campus and lab into one location, so both go when either changed.
    if (changes.location !== undefined || changes.lab !== undefined) {
      changes.location = form.location;
      changes.lab = form.lab;
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await assetsApi.updateAssetRaw(asset.id, changes);
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const errText = await res.text();
        throw new Error(`Server returned error (${res.status}): ${errText.slice(0, 120)}`);
      }
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Update failed");
      }
      onSave({ ...asset, ...form });
      onClose();
    } catch (err: any) {
      console.error("❌ Asset update failed:", err);
      setError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!asset} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Edit Asset: {asset?.id}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Correct this asset's details.</DialogDescription>
        </DialogHeader>
        {lookupsFailed && <p className="text-xs text-red-600 font-semibold px-1">Could not load the options. Reload the page.</p>}
        <div className="grid grid-cols-2 gap-3 py-3">
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Asset Name</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Serial Number</Label>
            <Input value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} className="text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Manufacturer</Label>
            <Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Category</Label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {categoryOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Funding Source</Label>
            <select value={form.funding} onChange={e => setForm({ ...form, funding: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {fundingOptions.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Procurement Date</Label>
            <Input type="date" value={form.procured} onChange={e => setForm({ ...form, procured: e.target.value })} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Warranty Expiration</Label>
            <Input type="date" value={form.warranty} onChange={e => setForm({ ...form, warranty: e.target.value })} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Campus Location</Label>
            <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="Manila">Manila</option>
              <option value="Laguna">Laguna</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Lab</Label>
            <select value={form.lab} onChange={e => setForm({ ...form, lab: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {labOptions.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Staff Comments &amp; Remarks</Label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Freely input any comments, maintenance remarks, or observations on this specific asset..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Availability</Label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {statusOptions.map(s => (
                <option key={s} value={s}>{assetStatusLabel(s)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Condition</Label>
            <div className="grid grid-cols-3 gap-2">
              {ASSET_CONDITIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, assetCondition: c })}
                  className={cn(
                    "rounded-lg border-2 py-2 text-xs font-bold transition-colors",
                    form.assetCondition === c
                      ? CONDITION_PILL_CLASS[c]
                      : "border-border bg-white text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {c.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Custodian</Label>
            <select value={form.custodianId === null ? "" : String(form.custodianId)}
              onChange={e => setForm({ ...form, custodianId: e.target.value === "" ? null : Number(e.target.value) })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">None</option>
              {custodianOptions.map(c => (
                <option key={c.userId} value={String(c.userId)}>{c.name}</option>
              ))}
            </select>
            {custodiansFailed && <p className="text-[10px] text-red-600">Could not load the custodian list. Reload the page.</p>}
          </div>
          <div className="flex flex-col gap-1.5 col-span-2 border-t border-border pt-2 mt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Asset Photo (.jpg or .png only)</Label>
              {form.image && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, image: "" })}
                  className="text-[10px] h-6 px-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 size={10} className="mr-1" /> Remove Photo
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
                    alert("Security Error: Only valid .jpg and .png image files are permitted!");
                    e.target.value = "";
                    return;
                  }
                  // TODO(M-17): the photo is sent and stored as a base64 string inside the asset row. Phase 3.
                  const reader = new FileReader();
                  reader.onload = ev => {
                    setForm({ ...form, image: ev.target?.result as string });
                    setError(null);
                  };
                  reader.readAsDataURL(file);
                }}
                className="text-xs w-full text-slate-500 cursor-pointer"
              />
            </div>
            {form.image && (
              <div className="mt-2 flex items-center gap-3 bg-muted/20 p-2 rounded-lg border border-border">
                <img src={form.image} alt="Asset Preview" className="w-12 h-12 object-cover rounded border" />
                <p className="text-[10px] text-muted-foreground">Custom photo uploaded. Will propagate globally to all cards and drawers.</p>
              </div>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-red-600 font-semibold px-1">⚠️ {error}</p>}
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
