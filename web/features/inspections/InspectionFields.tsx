/**
 * Inspection fields: the condition and the remarks TSG writes when a step files an inspection (receiving an asset for
 * maintenance, completing the work, marking an asset found).
 * Layer: feature component. Called by features/repairs/RepairProgressDialog.tsx and features/assets/AssetDetailModal.tsx.
 * Calls nothing: the caller sends the inspection through its own api function.
 * Used by: TSG maintenance receipt and completion, and Missing and Found.
 */
import { ASSET_CONDITIONS, ASSET_CONDITION_LABELS, SUGGESTED_HEALTH_SCORE, type AssetCondition } from "@shared/enums/assetCondition";
import type { InspectionInput } from "@shared/types/assets";
import { Label } from "@web/components/ui/label";
import { Textarea } from "@web/components/ui/textarea";

/** What the fields hold while TSG types. */
export interface InspectionFieldsValue {
  condition: AssetCondition;
  remarks: string;
}

/** The fields' value when a form opens. */
export const EMPTY_INSPECTION: InspectionFieldsValue = { condition: "OPERATIONAL", remarks: "" };

/**
 * Turns the fields into the body part the server reads (InspectionInput), with the health score the form suggests for
 * the condition.
 *
 * @param value what the fields hold
 */
export function toInspectionInput(value: InspectionFieldsValue): InspectionInput {
  return { condition: value.condition, healthScore: SUGGESTED_HEALTH_SCORE[value.condition], remarks: value.remarks.trim() || null };
}

/**
 * The condition select, with the suggested health score of each condition, and the remarks box (at most 255 characters).
 *
 * @param value what the fields hold
 * @param onChange called with the new value on every change
 * @param heading the label above the select, for example "Condition on arrival"
 */
export function InspectionFields({ value, onChange, heading }: { value: InspectionFieldsValue; onChange: (next: InspectionFieldsValue) => void; heading: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-bold text-foreground">{heading}</Label>
        <select
          value={value.condition}
          onChange={e => onChange({ ...value, condition: e.target.value as AssetCondition })}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
        >
          {ASSET_CONDITIONS.map(c => (
            <option key={c} value={c}>{ASSET_CONDITION_LABELS[c as AssetCondition]} (health score {SUGGESTED_HEALTH_SCORE[c as AssetCondition]})</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-bold text-foreground">Inspection remarks (optional)</Label>
        <Textarea
          value={value.remarks}
          onChange={e => onChange({ ...value, remarks: e.target.value })}
          maxLength={255}
          rows={3}
          placeholder="What you found when you checked it."
          className="text-xs resize-y"
        />
      </div>
    </div>
  );
}
