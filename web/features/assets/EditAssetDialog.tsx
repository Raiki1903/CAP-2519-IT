import { useState } from "react";
import * as assetsApi from "@web/api/assets.api";
import { ASSET_CONDITIONS } from "@shared/enums/assetCondition";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { cn } from "@web/components/ui/utils";
import { Trash2 } from "lucide-react";
import { CONDITION_PILL_CLASS } from "./assetBadges";

export function EditAssetDialog({ asset, onClose, onSave }: { asset: any; onClose: () => void; onSave: (updated: any) => void }) {
  const [form, setForm] = useState({
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
    custodian: asset?.custodian || "",
    status: asset?.status || "Active",
    image: asset?.image || asset?.image_url || "",
    description: asset?.description || asset?.remarks || ""
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await assetsApi.updateAssetRaw(asset.id, form);
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
          <DialogTitle className="text-sm font-bold text-foreground">Edit Registry Asset — {asset?.id}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Modify registry information to correct configuration errors or entry mistakes.</DialogDescription>
        </DialogHeader>
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
              {['DEV_KIT', 'MONITOR', 'TV', 'CPU', 'KEYBOARD', 'MOUSE', 'CAMERA', 'MEMORY_CARD', 'PROJECTOR', 'RECORDER', 'ROUTER', 'SIMULATOR', 'TABLET', 'VR', 'PRINTER', 'SWITCH', 'HARD_DRIVE', 'AUDIO', 'VIDEO_CAMERA', 'SPEAKER'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Funding Origin</Label>
            <select value={form.funding} onChange={e => setForm({ ...form, funding: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["DOST", "USAID", "CHED", "Internal Grants"].map(f => (
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
            <Label className="text-xs font-bold text-foreground">Responsible Laboratory Group</Label>
            <select value={form.lab} onChange={e => setForm({ ...form, lab: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "CNIS", "TE3D"].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">TSG / ITS Comments &amp; Remarks</Label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Freely input any comments, maintenance remarks, or observations on this specific asset..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Asset Status</Label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["Active", "On Loan", "Maintenance"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Condition State</Label>
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
            <Label className="text-xs font-bold text-foreground">Current Custodian Assignment</Label>
            <Input value={form.custodian} onChange={e => setForm({ ...form, custodian: e.target.value })} placeholder="None / Custodian Name" className="text-xs" />
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
            {saving ? "Saving..." : "Save Modifications"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
