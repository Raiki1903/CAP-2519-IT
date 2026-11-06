/**
 * Insights panel: the advice notes for the signed-in role, as one block at the top of an Analytics page. A header row
 * (icon, title, description, count badge, Collapse or Expand) in the same pattern as the Repair Operations Kanban Board, and
 * three sections side by side: High, Medium, and Planning. Read-only; Dismiss hides a card until the page reloads, and
 * Collapse or Expand is component state too.
 * Layer: feature component. Called by StaffAnalyticsView, LabHeadAnalyticsView, and DirectorAnalyticsView.
 * Calls api/analytics.api.ts getInsights(), InsightCard.tsx, and insightPriorityStyles.ts.
 * Used by: TSG Staff, Secretary, Lab Head, Director.
 * The panel never blocks the page: it has its own loading and error states, so the charts show either way.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import type { Insight, InsightChartKey, InsightPriority } from "@shared/types/analytics";
import * as analyticsApi from "@web/api/analytics.api";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { cn } from "@web/components/ui/utils";
import { InsightCard } from "./InsightCard";
import { INSIGHT_PRIORITY_LABELS, insightPriorityBadgeClass } from "./insightPriorityStyles";

const NONE_MESSAGE = "No insights right now.";
const ERROR_MESSAGE = "Insights are currently unavailable.";

/** The sections, left to right. Planning is the strategic one. */
const SECTIONS: InsightPriority[] = ["HIGH", "MEDIUM", "PLANNING"];

interface InsightsPanelProps {
  /** One lab, for the Staff and Director views that can pick a lab. A Lab Head sends none. */
  centerId?: number | null;
  /** The charts on this page, by insight chart key, with their titles. A card names its chart only if it is listed. */
  charts?: Partial<Record<InsightChartKey, string>>;
}

/** A few grey bars while the notes load. */
function InsightsSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading insights">
      <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
      <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
    </div>
  );
}

/**
 * Loads the insights once and shows them in three sections by priority.
 *
 * @param centerId the lab to read, or none
 * @param charts the charts on this page, for the "Related chart" line
 */
export function InsightsPanel({ centerId = null, charts = {} }: InsightsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-insights", centerId],
    queryFn: () => analyticsApi.getInsights(centerId),
    retry: false,
  });

  const dismiss = (id: string) => setDismissed(previous => new Set(previous).add(id));
  const shown: Insight[] = (data?.insights ?? []).filter(insight => !dismissed.has(insight.id));

  return (
    <section aria-label="Insights">
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#005A36]" /> Insights
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Notes on what may need attention, from the records.</p>
          </div>
          <div className="flex items-center gap-2">
            {data && <Badge className="bg-[#005A36] text-white font-extrabold text-xs px-3 py-1">{shown.length} Insights</Badge>}
            <Button
              variant="outline"
              size="sm"
              aria-expanded={isOpen}
              onClick={() => setIsOpen(!isOpen)}
              className="text-xs font-bold gap-1 border-border text-foreground hover:bg-muted"
            >
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isOpen ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>

        {isOpen && (
          <>
            {isLoading && <InsightsSkeleton />}
            {isError && <p className="text-sm text-muted-foreground">{ERROR_MESSAGE}</p>}
            {data &&
              (shown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{NONE_MESSAGE}</p>
              ) : (
                <div className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                  {SECTIONS.map(priority => {
                    const items = shown.filter(insight => insight.priority === priority);
                    return (
                      <div key={priority} className="flex flex-col gap-2 p-3" aria-label={`${INSIGHT_PRIORITY_LABELS[priority]} insights`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", insightPriorityBadgeClass(priority))}>
                            {INSIGHT_PRIORITY_LABELS[priority]}
                          </Badge>
                          <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
                        </div>
                        {/* Fixed height, about three cards; the rest scrolls. */}
                        <div className="h-[31rem] space-y-2 overflow-y-auto pr-1">
                          {items.length === 0 ? (
                            <p className="py-2 text-xs text-muted-foreground">None</p>
                          ) : (
                            items.map(insight => (
                              <InsightCard key={insight.id} insight={insight} chartTitle={charts[insight.chartKey]} onDismiss={dismiss} />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </>
        )}
      </Card>
    </section>
  );
}
