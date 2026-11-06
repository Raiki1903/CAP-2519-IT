/**
 * Insight card: one advice note with its priority, issue, and suggested next step, a Why section with the evidence and
 * other options, and a Dismiss button. Compact, to fit three to a column of the Insights block. Read-only: no button
 * starts a workflow.
 * Layer: feature component. Called by InsightsPanel.tsx. Calls insightPriorityStyles.ts and components/ui (badge, button).
 * Used by: the Insights section of the Staff, Lab Head, and Director analytics.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { Insight } from "@shared/types/analytics";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { cn } from "@web/components/ui/utils";
import { INSIGHT_PRIORITY_LABELS, insightPriorityAccentClass, insightPriorityBadgeClass } from "./insightPriorityStyles";

interface InsightCardProps {
  insight: Insight;
  /** The title of the related chart, when that chart is on the page. Nothing is shown without it. */
  chartTitle?: string;
  /** Hides this card until the page reloads. The panel keeps the list; nothing is saved. */
  onDismiss: (id: string) => void;
}

/**
 * Renders one insight. Every word comes from the server; the card only lays it out.
 *
 * @param insight the note
 * @param chartTitle the related chart on this page, if any
 * @param onDismiss called with the insight's id when Dismiss is clicked
 */
export function InsightCard({ insight, chartTitle, onDismiss }: InsightCardProps) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className={cn("rounded-lg border border-border border-l-4 bg-card p-2.5 text-xs shadow-sm", insightPriorityAccentClass(insight.priority))}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", insightPriorityBadgeClass(insight.priority))}>
          {INSIGHT_PRIORITY_LABELS[insight.priority]}
        </Badge>
        <h3 className="text-xs font-extrabold text-foreground">{insight.title}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">{insight.assetTag} · {insight.labCode}</span>
      </div>
      <p className="mt-1 text-foreground">{insight.issue}</p>
      <p className="mt-0.5 text-muted-foreground">
        <span className="font-bold text-foreground">Suggested: </span>
        {insight.preferredAction}
      </p>
      {chartTitle && <p className="mt-0.5 text-[11px] text-muted-foreground">Related chart on this page: {chartTitle}</p>}

      <div className="mt-1 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-[11px] font-bold text-primary"
          aria-expanded={showWhy}
          onClick={() => setShowWhy(open => !open)}
        >
          {showWhy ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Why
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-[11px] text-muted-foreground"
          onClick={() => onDismiss(insight.id)}
          aria-label={`Dismiss ${insight.title} for ${insight.assetTag}`}
        >
          <X size={12} /> Dismiss
        </Button>
      </div>

      {showWhy && (
        <div className="mt-1 space-y-2 rounded-md bg-muted/50 p-2 text-[11px]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {insight.evidence.map(row => (
              <div key={`${row.label}:${row.value}`} className="contents">
                <dt className="font-bold text-foreground">{row.label}</dt>
                <dd className="text-muted-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          {insight.alternatives.length > 0 && (
            <div>
              <p className="font-bold text-foreground">Other options</p>
              <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-muted-foreground">
                {insight.alternatives.map(alternative => (
                  <li key={alternative.rank}>{alternative.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
