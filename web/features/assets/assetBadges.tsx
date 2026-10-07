import { cn } from "@web/components/ui/utils";

export const statusBadgeClass: Record<string, string> = {
  "Active": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan": "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance": "bg-amber-50  text-amber-700  border-amber-200",
  "Disposed": "bg-red-50    text-red-700    border-red-200",
};

// Mirrors the `asset_records.asset_condition` ENUM in the MySQL schema —
// same 5-state condition the ReturnForm and AssetDetailModal use, so the
// registry tables/cards show the same descriptive state everywhere instead
// of the old (always-100, not DB-backed) numeric % score.
// NOTE: keys are the Prisma enum member names (underscore form), not the
// space-separated DB storage strings — see schema.prisma's @map values.
export const CONDITION_TEXT_CLASS: Record<string, string> = {
  PERFECT: "text-emerald-700",
  OPERATIONAL: "text-blue-700",
  MINOR_DRIFT: "text-amber-700",
  DEGRADED: "text-orange-700",
  CRITICAL_DEFECT: "text-red-700",
};
export const CONDITION_DOT_CLASS: Record<string, string> = {
  PERFECT: "bg-emerald-400",
  OPERATIONAL: "bg-blue-400",
  MINOR_DRIFT: "bg-amber-400",
  DEGRADED: "bg-orange-400",
  CRITICAL_DEFECT: "bg-red-500",
};
export const CONDITION_PILL_CLASS: Record<string, string> = {
  PERFECT: "border-emerald-500 bg-emerald-50 text-emerald-700",
  OPERATIONAL: "border-blue-500 bg-blue-50 text-blue-700",
  MINOR_DRIFT: "border-amber-500 bg-amber-50 text-amber-700",
  DEGRADED: "border-orange-500 bg-orange-50 text-orange-700",
  CRITICAL_DEFECT: "border-red-500 bg-red-50 text-red-700",
};
export function ConditionState({ value }: { value?: string }) {
  const cond = value || "PERFECT";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", CONDITION_TEXT_CLASS[cond] ?? "text-muted-foreground")}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", CONDITION_DOT_CLASS[cond] ?? "bg-muted-foreground")} />
      {cond.replace(/_/g, " ")}
    </span>
  );
}
