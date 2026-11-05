/**
 * Shared inspection step component.
 * Layer: feature component. Called by IntakeWizard, LoanReleaseDialog, and LoanReceiveDialog.
 * Calls: useLookups (for metricsByCategory), components/ui/.
 * Used by: Staff asset registration, TSG loan release, and TSG loan return inspection.
 */
import { useEffect, useState } from "react";
import { Label } from "@web/components/ui/label";
import { Input } from "@web/components/ui/input";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABELS,
  SUGGESTED_HEALTH_SCORE,
  type AssetCondition,
} from "@shared/enums/assetCondition";
import { useFormLookups } from "@web/features/lookups/useLookups";

/** Inspection fields collected during intake, loan release, and return receipt. */
export interface InspectionStepValue {
  condition: AssetCondition;
  healthScore: number;
  missingAccessories?: string;
  remarks?: string;
  metrics?: { metricId: number; value: number }[];
}

/** Props for InspectionStep. */
export interface InspectionStepProps {
  /** The asset's category code, used to load category-specific metrics from lookups. */
  category?: string;
  /** Current inspection state. */
  value: InspectionStepValue;
  /** Callback fired when any inspection field changes. */
  onChange: (next: InspectionStepValue) => void;
  /** Optional flag to disable input fields. */
  disabled?: boolean;
}

/**
 * Renders standard inspection inputs: condition dropdown, health score,
 * missing accessories, remarks, and dynamic category metrics.
 */
export function InspectionStep({
  category,
  value,
  onChange,
  disabled = false,
}: InspectionStepProps) {
  const { lookups } = useFormLookups();

  const handleConditionChange = (condition: AssetCondition) => {
    const suggestedScore = SUGGESTED_HEALTH_SCORE[condition] ?? 100;
    onChange({
      ...value,
      condition,
      healthScore: suggestedScore,
    });
  };

  const handleHealthScoreChange = (scoreStr: string) => {
    const parsed = parseInt(scoreStr, 10);
    const score = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    onChange({
      ...value,
      healthScore: score,
    });
  };

  const handleMetricValueChange = (metricId: number, metricValue: number) => {
    const currentMetrics = value.metrics ?? [];
    const existingIndex = currentMetrics.findIndex((m) => m.metricId === metricId);
    let nextMetrics: { metricId: number; value: number }[];

    if (existingIndex >= 0) {
      nextMetrics = currentMetrics.map((m) =>
        m.metricId === metricId ? { ...m, value: metricValue } : m
      );
    } else {
      nextMetrics = [...currentMetrics, { metricId, value: metricValue }];
    }

    onChange({
      ...value,
      metrics: nextMetrics,
    });
  };

  const categoryMetrics = category && lookups?.metricsByCategory
    ? lookups.metricsByCategory[category] ?? []
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Condition select */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold text-foreground">Condition</Label>
          <select
            value={value.condition}
            disabled={disabled}
            onChange={(e) => handleConditionChange(e.target.value as AssetCondition)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {(ASSET_CONDITIONS as AssetCondition[]).map((c) => (
              <option key={c} value={c}>
                {ASSET_CONDITION_LABELS[c]} (suggested score {SUGGESTED_HEALTH_SCORE[c]})
              </option>
            ))}
          </select>
        </div>

        {/* Health Score input */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold text-foreground">Health Score (0-100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            disabled={disabled}
            value={value.healthScore ?? ""}
            onChange={(e) => handleHealthScoreChange(e.target.value)}
            placeholder="Score 0 to 100"
          />
        </div>
      </div>

      {/* Missing Accessories */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-bold text-foreground">Missing Accessories</Label>
        <Input
          type="text"
          disabled={disabled}
          value={value.missingAccessories ?? ""}
          onChange={(e) => onChange({ ...value, missingAccessories: e.target.value })}
          placeholder="Leave blank if all accessories and cables are present"
        />
      </div>

      {/* Remarks */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-bold text-foreground">Inspection Remarks</Label>
        <textarea
          rows={3}
          disabled={disabled}
          value={value.remarks ?? ""}
          onChange={(e) => onChange({ ...value, remarks: e.target.value })}
          placeholder="Technical observations, physical wear, notes, or issues observed..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-50"
        />
      </div>

      {/* Category Benchmark Metrics if defined */}
      {categoryMetrics.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-3">
          <p className="text-xs font-bold text-foreground">Category Metrics ({category})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categoryMetrics.map((m) => {
              const currentVal = value.metrics?.find((entry) => entry.metricId === m.metricId)?.value ?? "";
              return (
                <div key={m.metricId} className="flex flex-col gap-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    {m.name} {m.unit ? `(${m.unit})` : ""}
                  </Label>
                  <Input
                    type="number"
                    disabled={disabled}
                    value={currentVal}
                    onChange={(e) =>
                      handleMetricValueChange(m.metricId, parseFloat(e.target.value) || 0)
                    }
                    placeholder={`Measured ${m.name}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
