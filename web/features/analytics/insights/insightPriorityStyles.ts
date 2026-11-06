/**
 * Insight priority styles: one badge colour, one section dot colour, one card accent, and one label per insight priority, so every insight card
 * colours a priority the same way. Theme colours only.
 * Layer: feature component (style table). Called by InsightsPanel and InsightCard. Calls nothing.
 * Used by: the Insights section of the Staff, Lab Head, and Director analytics.
 */
import type { InsightPriority } from "@shared/types/analytics";

/** The word on each priority's badge. */
export const INSIGHT_PRIORITY_LABELS: Record<InsightPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  PLANNING: "Planning",
};

/** The badge colours of each priority, to go on a `Badge variant="outline"`. */
const INSIGHT_PRIORITY_BADGE: Record<InsightPriority, string> = {
  HIGH: "bg-destructive/10 text-destructive border-destructive/30",
  MEDIUM: "bg-chart-5/20 text-foreground border-chart-5",
  PLANNING: "bg-primary/10 text-primary border-primary/30",
};

/** The colour of the dot before a section label, for each priority. */
const INSIGHT_PRIORITY_DOT: Record<InsightPriority, string> = {
  HIGH: "bg-destructive",
  MEDIUM: "bg-chart-5",
  PLANNING: "bg-primary",
};

/** The left-border colour of a card for each priority. */
const INSIGHT_PRIORITY_ACCENT: Record<InsightPriority, string> = {
  HIGH: "border-l-destructive",
  MEDIUM: "border-l-chart-5",
  PLANNING: "border-l-primary",
};

/**
 * Returns the badge classes for an insight priority.
 *
 * @param priority HIGH, MEDIUM, or PLANNING
 */
export function insightPriorityBadgeClass(priority: InsightPriority): string {
  return INSIGHT_PRIORITY_BADGE[priority] ?? "bg-muted";
}

/**
 * Returns the background colour of the dot before a section label.
 *
 * @param priority HIGH, MEDIUM, or PLANNING
 */
export function insightPriorityDotClass(priority: InsightPriority): string {
  return INSIGHT_PRIORITY_DOT[priority] ?? "bg-muted-foreground";
}

/**
 * Returns the left-border colour of an insight card.
 *
 * @param priority HIGH, MEDIUM, or PLANNING
 */
export function insightPriorityAccentClass(priority: InsightPriority): string {
  return INSIGHT_PRIORITY_ACCENT[priority] ?? "border-l-border";
}
