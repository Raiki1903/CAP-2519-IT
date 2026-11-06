/**
 * Insights panel: the advice notes for the signed-in role, either the full Insights section of an Analytics page (tabs
 * Operational and Strategic) or the top three on a home screen. Read-only; Dismiss hides a card until the page reloads.
 * Layer: feature component. Called by StaffAnalyticsView, LabHeadAnalyticsView, DirectorAnalyticsView, pages/staff/OverviewPage,
 * the Director Overview, and LabHeadLoanRequests. Calls api/analytics.api.ts getInsights() and InsightCard.tsx.
 * Used by: TSG Staff, Secretary, Lab Head, Director.
 * The panel never blocks the page: it has its own loading and error states, so the charts show either way.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Lightbulb } from "lucide-react";
import type { Insight, InsightChartKey, InsightView } from "@shared/types/analytics";
import * as analyticsApi from "@web/api/analytics.api";
import { cn } from "@web/components/ui/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { InsightCard } from "./InsightCard";

/** How many cards a home screen shows. */
const PREVIEW_COUNT = 3;

const NONE_MESSAGE = "No insights right now.";
const ERROR_MESSAGE = "Insights are currently unavailable.";

interface InsightsPanelProps {
  /** `full` is the Analytics section with tabs; `preview` is the top three for a home screen. */
  variant: "full" | "preview";
  /** One lab, for the Staff and Director views that can pick a lab. A Lab Head sends none. */
  centerId?: number | null;
  /** The charts on this page, by insight chart key, with their titles. A card names its chart only if it is listed. */
  charts?: Partial<Record<InsightChartKey, string>>;
  /** Where "See all in Analytics" goes. Preview only. */
  analyticsPath?: string;
  /** Extra classes for the preview's outer element, for a gap that must disappear with the panel. */
  className?: string;
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
 * Loads the insights once and shows them as the full section or the home preview.
 *
 * @param variant full or preview
 * @param centerId the lab to read, or none
 * @param charts the charts on this page, for the "Related chart" line
 * @param analyticsPath the Analytics page, for the preview's link
 * @param className extra classes for the preview
 */
export function InsightsPanel({ variant, centerId = null, charts = {}, analyticsPath, className }: InsightsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [chosenTab, setChosenTab] = useState<InsightView | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-insights", centerId],
    queryFn: () => analyticsApi.getInsights(centerId),
    retry: false,
  });

  const dismiss = (id: string) => setDismissed(previous => new Set(previous).add(id));
  const shown: Insight[] = (data?.insights ?? []).filter(insight => !dismissed.has(insight.id));

  if (variant === "preview") {
    if (isLoading) return <InsightsSkeleton />;
    if (isError) return <p className="text-xs text-muted-foreground">{ERROR_MESSAGE}</p>;
    if (shown.length === 0) return null;
    return (
      <section className={cn("space-y-2", className)} aria-label="Insights">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Lightbulb className="w-4 h-4 text-primary" /> Insights
          </h2>
          {analyticsPath && (
            <Link to={analyticsPath} className="text-xs font-bold text-primary hover:underline">
              See all in Analytics
            </Link>
          )}
        </div>
        {shown.slice(0, PREVIEW_COUNT).map(insight => (
          <InsightCard key={insight.id} insight={insight} onDismiss={dismiss} />
        ))}
      </section>
    );
  }

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
