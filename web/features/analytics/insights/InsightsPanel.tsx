/**
 * Insights panel: the advice notes for the signed-in role, as the Insights section of an Analytics page (tabs Operational
 * and Strategic). Read-only; Dismiss hides a card until the page reloads.
 * Layer: feature component. Called by StaffAnalyticsView, LabHeadAnalyticsView, and DirectorAnalyticsView.
 * Calls api/analytics.api.ts getInsights() and InsightCard.tsx.
 * Used by: TSG Staff, Secretary, Lab Head, Director.
 * The panel never blocks the page: it has its own loading and error states, so the charts show either way.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import type { Insight, InsightChartKey, InsightView } from "@shared/types/analytics";
import * as analyticsApi from "@web/api/analytics.api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { InsightCard } from "./InsightCard";

const NONE_MESSAGE = "No insights right now.";
const ERROR_MESSAGE = "Insights are currently unavailable.";

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
 * Loads the insights once and shows them in tabs.
 *
 * @param centerId the lab to read, or none
 * @param charts the charts on this page, for the "Related chart" line
 */
export function InsightsPanel({ centerId = null, charts = {} }: InsightsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [chosenTab, setChosenTab] = useState<InsightView | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-insights", centerId],
    queryFn: () => analyticsApi.getInsights(centerId),
    retry: false,
  });

  const dismiss = (id: string) => setDismissed(previous => new Set(previous).add(id));
  const shown: Insight[] = (data?.insights ?? []).filter(insight => !dismissed.has(insight.id));

  const operational = shown.filter(insight => insight.view === "operational");
  const strategic = shown.filter(insight => insight.view === "strategic");
  // Open on the first tab that has a card, so a viewer with only strategic notes does not land on an empty tab.
  const tab: InsightView = chosenTab ?? (operational.length === 0 && strategic.length > 0 ? "strategic" : "operational");

  const list = (insights: Insight[]) =>
    insights.length === 0 ? (
      <p className="py-3 text-sm text-muted-foreground">{NONE_MESSAGE}</p>
    ) : (
      <div className="space-y-2">
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} chartTitle={charts[insight.chartKey]} onDismiss={dismiss} />
        ))}
      </div>
    );

  return (
    <section className="space-y-3" aria-label="Insights">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
          <Lightbulb className="w-5 h-5 text-primary" /> Insights
        </h2>
        <p className="text-xs text-muted-foreground">
          Notes on what may need attention, with a suggested next step. They only read your data and change nothing.
        </p>
      </div>
      {isLoading && <InsightsSkeleton />}
      {isError && <p className="text-sm text-muted-foreground">{ERROR_MESSAGE}</p>}
      {data && (
        <Tabs value={tab} onValueChange={value => setChosenTab(value as InsightView)}>
          <TabsList>
            <TabsTrigger value="operational">Operational ({operational.length})</TabsTrigger>
            <TabsTrigger value="strategic">Strategic ({strategic.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="operational">{list(operational)}</TabsContent>
          <TabsContent value="strategic">{list(strategic)}</TabsContent>
        </Tabs>
      )}
    </section>
  );
}
