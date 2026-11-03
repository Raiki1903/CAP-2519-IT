/**
 * Edit asset dialog: TSG and the Secretary correct an asset's master data (registry details, home lab and room,
 * project, funding, tags, accessories, and photo). Status, holder, location, and condition are not edited here: each
 * changes through its own step.
 * Layer: feature component. Called by pages/staff/InventoryPage.tsx.
 * Calls: api/assets.api.ts updateAssetRaw(), features/lookups/useLookups.ts (the option lists).
 * Used by: TSG and the Secretary, asset editing.
 */
import { useState } from "react";
import * as assetsApi from "@web/api/assets.api";
import type { AssetUpdateInput } from "@shared/types/assets";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Trash2 } from "lucide-react";

/** The form's values: text inputs hold text, pickers hold an id as text ("" for none). */
interface EditForm {
  name: string;
  serialNumber: string;
  manufacturer: string;
  category: string;
  centerId: string;
  homeRoom: string;
  projectId: string;
  fundingSourceId: string;
  acquisitionValue: string;
  procurementDate: string;
  warrantyExpiry: string;
  accessories: string;
  itsPropertyTag: string;
  tsgTag: string;
  imageUrl: string;
}

/** The form's values from an asset as GET /api/assets sends it. */
function formOf(asset: any): EditForm {
  return {
    name: asset?.name ?? "",
    serialNumber: asset?.serialNumber ?? "",
    manufacturer: asset?.manufacturer ?? "",
    category: asset?.category ?? "",
    centerId: asset?.homeLab?.centerId ? String(asset.homeLab.centerId) : "",
    homeRoom: asset?.homeRoom ?? "",
    projectId: asset?.project?.projectId ? String(asset.project.projectId) : "",
    fundingSourceId: asset?.fundingSource?.fundingSourceId ? String(asset.fundingSource.fundingSourceId) : "",
    acquisitionValue: asset?.acquisitionValue === null || asset?.acquisitionValue === undefined ? "" : String(asset.acquisitionValue),
    procurementDate: asset?.procurementDate ?? "",
    warrantyExpiry: asset?.warrantyExpiry ?? "",
    accessories: asset?.accessories ?? "",
    itsPropertyTag: asset?.itsPropertyTag ?? "",
    tsgTag: asset?.tsgTag ?? "",
    imageUrl: asset?.imageUrl ?? asset?.image ?? "",
  };
}

/** One changed field as the server takes it: ids and the value as numbers, empty as null. */
function bodyValue(field: keyof EditForm, value: string): unknown {
  if (field === "centerId" || field === "projectId" || field === "fundingSourceId" || field === "acquisitionValue") {
    return value === "" ? null : Number(value);
  }
  if (field === "name" || field === "category") return value;
  return value === "" ? null : value;
}

const SELECT_CLASS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Edits one asset's master data and saves it through assetsApi.updateAssetRaw(), sending only the fields that changed.
 * Shows the server's error text under the form when the save fails, and stays open.
 *
 * @param asset the asset row as the inventory has it from GET /api/assets
 * @param onClose closes the dialog
 * @param onSave called after a successful save with the asset as the server answers it, so the caller can reload its lists
 */
export function EditAssetDialog({ asset, onClose, onSave }: { asset: any; onClose: () => void; onSave: (updated: any) => void }) {
  // The values the dialog opened with, so a save sends only what differs from them. (issue #74)
  const [start] = useState(() => formOf(asset));
  const [form, setForm] = useState(start);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lookups, failed: lookupsFailed } = useFormLookups();
  const set = (field: keyof EditForm) => (e: { target: { value: string } }) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    const changes: Record<string, unknown> = {};
    for (const field of Object.keys(form) as (keyof EditForm)[]) {
      if (form[field] !== start[field]) changes[field] = bodyValue(field, form[field]);
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await assetsApi.updateAssetRaw(asset.id, changes as AssetUpdateInput);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errText = await res.text();
        throw new Error(`Server returned error (${res.status}): ${errText.slice(0, 120)}`);
      }
      // A refusal (400, 403, 404, 409) is JSON with the reason in `error`, shown as it is, so the editor sees why. (H-16)
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Update failed");
      }
      onSave(result.asset);
      onClose();
    } catch (err: any) {
      console.error("❌ Asset update failed:", err);
      setError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const text = (field: keyof EditForm, label: string, extra = "", span = false) => (
    <div className={span ? "flex flex-col gap-1.5 col-span-2" : "flex flex-col gap-1.5"}>
      <Label className="text-xs font-bold text-foreground">{label}</Label>
      <Input value={form[field]} onChange={set(field)} className={`text-xs ${extra}`} />
    </div>
  );

  return (
    <Dialog open={!!asset} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Edit Asset: {asset?.id}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Correct this asset's details. Status, holder, location, and condition change through their own steps.
          </DialogDescription>
        </DialogHeader>
        {lookupsFailed && <p className="text-xs text-red-600 font-semibold px-1">Could not load the options. Reload the page.</p>}
        <div className="grid grid-cols-2 gap-3 py-3">
          {text("name", "Asset Name", "", true)}
          {text("serialNumber", "Serial Number", "font-mono")}
          {text("manufacturer", "Manufacturer")}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Category</Label>
            <select value={form.category} onChange={set("category")} className={SELECT_CLASS}>
              {(lookups?.categories ?? []).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Funding Source</Label>
            <select value={form.fundingSourceId} onChange={set("fundingSourceId")} className={SELECT_CLASS}>
              <option value="">None</option>
              {(lookups?.fundingSources ?? []).map(f => <option key={f.fundingSourceId} value={String(f.fundingSourceId)}>{f.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Acquisition Value (₱)</Label>
            <Input type="number" min={0} value={form.acquisitionValue} onChange={set("acquisitionValue")} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Owning Project</Label>
            <select value={form.projectId} onChange={set("projectId")} className={SELECT_CLASS}>
              <option value="">None</option>
              {(lookups?.projects ?? []).map(p => <option key={p.projectId} value={String(p.projectId)}>{p.code}: {p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Procurement Date</Label>
            <Input type="date" value={form.procurementDate} onChange={set("procurementDate")} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Warranty Expiration</Label>
            <Input type="date" value={form.warrantyExpiry} onChange={set("warrantyExpiry")} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Home Lab</Label>
            <select value={form.centerId} onChange={set("centerId")} className={SELECT_CLASS}>
              {(lookups?.labs ?? []).map(l => <option key={l.centerId} value={String(l.centerId)}>{l.code} ({l.campusLabel})</option>)}
            </select>
          </div>
          {text("homeRoom", "Home Room")}
          {text("itsPropertyTag", "ITS Property Tag", "font-mono")}
          {text("tsgTag", "TSG Tag", "font-mono")}
          {text("accessories", "Accessories", "", true)}

          <div className="flex flex-col gap-1.5 col-span-2 border-t border-border pt-2 mt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Asset Photo (.jpg or .png only)</Label>
              {form.imageUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, imageUrl: "" })}
                  className="text-[10px] h-6 px-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 size={10} className="mr-1" /> Remove Photo
                </Button>
              )}
            </div>
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
                  setForm({ ...form, imageUrl: ev.target?.result as string });
                  setError(null);
                };
                reader.readAsDataURL(file);
              }}
              className="text-xs w-full text-slate-500 cursor-pointer"
            />
            {form.imageUrl && (
              <div className="mt-2 flex items-center gap-3 bg-muted/20 p-2 rounded-lg border border-border">
                <img src={form.imageUrl} alt="Asset Preview" className="w-12 h-12 object-cover rounded border" />
                <p className="text-[10px] text-muted-foreground">Photo set. It shows on every card and drawer after saving.</p>
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
