/**
 * Intake wizard: the three-step form Staff use to register a newly acquired asset.
 * Layer: feature component. Called by pages/staff/RegisterPage.tsx.
 * Calls: api/assets.api.ts createAssetRaw(), state/serverData.tsx syncFromDb().
 * Used by: Staff asset registration.
 */
import { useState, useEffect } from "react";
import { useServerData } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";
import { ASSET_CATEGORIES } from "@shared/enums/assetCategory";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import { Separator } from "@web/components/ui/separator";
import { fundingSources } from "./assetFields";

interface IntakeForm {
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  acquisitionValue: number;
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  image?: string;
  remarks?: string;
}

const generateAdricSerial = () => {
  const year = new Date().getFullYear();
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
  return `ADRIC-${year}-${hex}`;
};

// Known defect: this serial is generated once, when the module first loads. Every reset to
// emptyForm (after a successful registration, or on reopening the tab) offers the same serial
// again until the page is reloaded. Logged in 02-restructure-log.md, notes.
const emptyForm: IntakeForm = {
  name: "", serial: generateAdricSerial(), manufacturer: "", category: "CPU",
  funding: "DOST", acquisitionValue: 0, procured: new Date().toISOString().split("T")[0],
  warranty: "", location: "Manila", lab: "CITe4D", image: "", remarks: ""
};

/**
 * Collects the asset's details over three steps (identity and photo, procurement and funding,
 * location and remarks) and registers it through assetsApi.createAssetRaw(). On success it
 * reloads the shared lists and starts over at step 1; on failure it shows the server's error
 * text under the buttons. Takes no props.
 */
export function IntakeWizard() {
  const { syncFromDb } = useServerData();
  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.serial || form.serial.trim() === "") {
      setForm(prev => ({
        ...prev,
        serial: generateAdricSerial()
      }));
    }
  }, []);

  const handleSubmit = async () => {
    setSubmitted(true);
    setRegistrationError(null);
    try {
      const res = await assetsApi.createAssetRaw(form);
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const errText = await res.text();
        throw new Error(`Server returned error (${res.status}): ${errText.slice(0, 120)}`);
      }
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Registration failed");
      }

      syncFromDb();
      setForm(emptyForm);
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
          <CardTitle className="text-sm">Procurement Intake Wizard</CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">Complete all fields to compile hardware records</p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-extrabold">STEP {step} OF 3</Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
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
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="text-xs text-slate-500 cursor-pointer"
                />
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
                <Label className="text-xs font-bold text-foreground">Funding Origin</Label>
                <select value={form.funding} onChange={e => setForm({ ...form, funding: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {fundingSources.map(f => <option key={f} value={f}>{f}</option>)}
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
                <Label className="text-xs font-bold text-foreground">Campus Location</Label>
                <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Manila">Manila Campus</option>
                  <option value="Laguna">Laguna Campus</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Responsible Laboratory Group</Label>
                <select value={form.lab} onChange={e => setForm({ ...form, lab: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {/* TODO(M-03): another hardcoded lab list, separate from research_centers. Phase 3. */}
                  {["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "CNIS", "TE3D"].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Staff Comments &amp; Remarks</Label>
              <textarea
                value={form.remarks || ""}
                onChange={e => setForm({ ...form, remarks: e.target.value })}
                placeholder="Freely input any comments, technical notes, or initial remarks on this specific asset..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="p-4 bg-muted/40 rounded-xl border border-border text-xs space-y-1.5 text-muted-foreground">
              <p className="font-bold text-foreground">Procurement Compliance Checklist:</p>
              <p>✓ Registry tagging matches barcode guidelines</p>
              <p>✓ Campus location matches real-time room assignments</p>
              <p>✓ Funding boundaries bound to academic allocations</p>
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
          <p className="text-xs text-red-600 font-semibold mt-2">⚠️ {registrationError}</p>
        )}
      </CardContent>
    </Card>
  );
}
