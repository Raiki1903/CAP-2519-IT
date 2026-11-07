/**
 * Intake wizard: the three-step form Staff use to register a newly acquired asset.
 * Layer: feature component. Called by pages/staff/RegisterPage.tsx.
 * Calls: api/assets.api.ts createAssetRaw() and readResult(), features/lookups/useLookups.ts (labs and funding sources), state/serverData.tsx syncFromDb().
 * The registration sends the contract body (centerId, fundingSourceId, and the Initial inspection).
 * Used by: Staff asset registration.
 */
import { useEffect, useState } from "react";
import { useServerData } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";
import { ASSET_CATEGORIES } from "@shared/enums/assetCategory";
import { ASSET_CONDITIONS, ASSET_CONDITION_LABELS, SUGGESTED_HEALTH_SCORE, type AssetCondition } from "@shared/enums/assetCondition";
import type { AssetCreateInput } from "@shared/types/assets";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import { Separator } from "@web/components/ui/separator";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { compressImage, ASSET_PHOTO_MAX_SIDE, PHOTO_UNREADABLE_MESSAGE } from "@web/features/images/compressImage";

interface IntakeForm {
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  /** A funding source id as text, "" for none. */
  fundingSourceId: string;
  acquisitionValue: number;
  procured: string;
  warranty: string;
  /** The home lab's id as text. */
  centerId: string;
  homeRoom: string;
  /** The condition of the Initial inspection. */
  condition: AssetCondition;
  image?: string;
  remarks?: string;
}

const generateAdricSerial = () => {
  const year = new Date().getFullYear();
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
  return `ADRIC-${year}-${hex}`;
};

const createEmptyForm = (centerId = ""): IntakeForm => ({
  name: "", serial: generateAdricSerial(), manufacturer: "", category: "CPU",
  fundingSourceId: "", acquisitionValue: 0, procured: new Date().toISOString().split("T")[0],
  warranty: "", centerId, homeRoom: "", condition: "PERFECT", image: "", remarks: ""
});

/** The registration body for the form: the master data and the Initial inspection with its suggested health score. */
function createBody(form: IntakeForm): AssetCreateInput {
  return {
    name: form.name,
    category: form.category,
    serialNumber: form.serial || null,
    manufacturer: form.manufacturer || null,
    centerId: Number(form.centerId),
    homeRoom: form.homeRoom || null,
    fundingSourceId: form.fundingSourceId ? Number(form.fundingSourceId) : null,
    acquisitionValue: form.acquisitionValue || null,
    procurementDate: form.procured || null,
    warrantyExpiry: form.warranty || null,
    imageUrl: form.image || null,
    initialInspection: {
      condition: form.condition,
      healthScore: SUGGESTED_HEALTH_SCORE[form.condition],
      remarks: form.remarks || null,
    },
  };
}

/**
 * Collects the asset's details over three steps (identity and photo, procurement and funding,
 * home lab, room, and the Initial inspection) and registers it through assetsApi.createAssetRaw(). On success it
 * reloads the shared lists and starts over at step 1; on failure it shows the server's error
 * text under the buttons. Takes no props.
 */
export function IntakeWizard() {
  const { syncFromDb } = useServerData();
  const [form, setForm] = useState<IntakeForm>(createEmptyForm);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { lookups, failed: lookupsFailed } = useFormLookups();
  const labs = lookups?.labs ?? [];
  // The home lab starts on the first lab in the list: there is no default lab.
  const startingLab = labs.length > 0 ? String(labs[0].centerId) : "";
  useEffect(() => {
    if (labs.length > 0 && !labs.some(l => String(l.centerId) === form.centerId)) setForm(f => ({ ...f, centerId: startingLab }));
  }, [lookups]);

  const handleSubmit = async () => {
    setSubmitted(true);
    setRegistrationError(null);
    try {
      const res = await assetsApi.createAssetRaw(createBody(form));
      const result = await assetsApi.readResult(res, "The asset could not be registered. Please try again.");
      if (!result.success) {
        throw new Error(result.error);
      }

      syncFromDb();
      setForm(createEmptyForm(startingLab));
      setPhotoError(null);
      setStep(1);
    } catch (err: any) {
      console.error("❌ Asset registration failed:", err);
      setRegistrationError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setSubmitted(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-4 px-5">
        <div>
          <CardTitle className="text-sm">New Asset</CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">Fill in every field.</p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-extrabold">STEP {step} OF 3</Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {lookupsFailed && <p className="text-xs text-red-600 font-semibold">Could not load the options. Reload the page.</p>}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Asset Name</Label>
              <Input placeholder="e.g. MacBook Pro M3 Max" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Manufacturer</Label>
                <Input placeholder="Apple Inc." value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Serial Number</Label>
                <Input placeholder="SN-C02Z4..." value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Asset Category</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {ASSET_CATEGORIES.map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Upload Asset Photo (.jpg or .png)</Label>
                  {form.image && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image: "" })}
                      className="text-[10px] text-red-600 hover:underline font-semibold"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={async e => {
                    const input = e.target;
                    const file = input.files?.[0];
                    if (!file) return;
                    setPhotoError(null);
                    if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
                      alert("Security Error: Only valid .jpg and .png image files are permitted!");
                      input.value = "";
                      return;
                    }
                    try {
                      // TODO(M-17): the photo is sent and stored as a base64 string inside the asset row. Phase 3.
                      const photo = await compressImage(file, ASSET_PHOTO_MAX_SIDE);
                      setForm(f => ({ ...f, image: photo }));
                    } catch {
                      setPhotoError(PHOTO_UNREADABLE_MESSAGE);
                      input.value = "";
                    }
                  }}
                  className="text-xs text-slate-500 cursor-pointer"
                />
                {photoError && <p className="text-[11px] font-semibold text-red-600">{photoError}</p>}
                {form.image && (
                  <div className="mt-1 flex items-center gap-2 bg-muted/30 p-1.5 rounded border border-border">
                    <img src={form.image} alt="Preview" className="w-8 h-8 object-cover rounded border" />
                    <span className="text-[10px] text-emerald-700 font-bold">Image loaded successfully</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Procurement Date</Label>
                <Input type="date" value={form.procured} onChange={e => setForm({ ...form, procured: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Warranty Expiration</Label>
                <Input type="date" value={form.warranty} onChange={e => setForm({ ...form, warranty: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Funding Source</Label>
                <select value={form.fundingSourceId} onChange={e => setForm({ ...form, fundingSourceId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">None</option>
                  {(lookups?.fundingSources ?? []).map(f => <option key={f.fundingSourceId} value={String(f.fundingSourceId)}>{f.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Acquisition Value (₱)</Label>
                <Input type="number" min={0} placeholder="e.g. 50000" value={form.acquisitionValue || ""} onChange={e => setForm({ ...form, acquisitionValue: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Home Lab</Label>
                <select value={form.centerId} onChange={e => setForm({ ...form, centerId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {labs.map(l => (
                    <option key={l.centerId} value={String(l.centerId)}>{l.code} ({l.campusLabel})</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Home Room</Label>
                <Input placeholder="e.g. G406" value={form.homeRoom} onChange={e => setForm({ ...form, homeRoom: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Condition at Intake</Label>
              <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value as AssetCondition })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {(ASSET_CONDITIONS as AssetCondition[]).map(c => (
                  <option key={c} value={c}>{ASSET_CONDITION_LABELS[c]} (health score {SUGGESTED_HEALTH_SCORE[c]})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Initial Inspection Remarks</Label>
              <textarea
                value={form.remarks || ""}
                onChange={e => setForm({ ...form, remarks: e.target.value })}
                placeholder="Freely input any comments, technical notes, or initial remarks on this specific asset..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
        )}

        <Separator className="my-4" />

        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
          ) : <div />}

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!form.name || !form.serial}>Continue Step {step + 1}</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitted}>
              {submitted ? "Compiling registry..." : "Commit Intake Registry"}
            </Button>
          )}
        </div>
        {registrationError && (
          <p className="text-xs text-red-600 font-semibold mt-2">{registrationError}</p>
        )}
      </CardContent>
    </Card>
  );
}
