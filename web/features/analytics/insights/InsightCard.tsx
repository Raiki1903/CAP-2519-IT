/**
 * Insight card: one advice note with its priority, issue, and suggested next step, a Why section with the evidence and
 * other options, and a Dismiss button. Read-only: no button starts a workflow.
 * Layer: feature component. Called by InsightsPanel.tsx. Calls insightPriorityStyles.ts and components/ui (card, badge, button).
 * Used by: the Insights section of the Staff, Lab Head, and Director analytics, and the three home previews.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { Insight } from "@shared/types/analytics";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
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
    <Card className={cn("border border-border border-l-4 bg-card shadow-sm rounded-xl p-4", insightPriorityAccentClass(insight.priority))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={insightPriorityBadgeClass(insight.priority)}>
              {INSIGHT_PRIORITY_LABELS[insight.priority]}
            </Badge>
            <h3 className="text-sm font-extrabold text-foreground">{insight.title}</h3>
            <span className="text-xs text-muted-foreground font-mono">{insight.assetTag} · {insight.labCode}</span>
          </div>
          <p className="text-sm text-foreground">{insight.issue}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">Suggested: </span>
            {insight.preferredAction}
          </p>
          {chartTitle && (
            <p className="text-xs text-muted-foreground">Related chart on this page: {chartTitle}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs text-muted-foreground"
          onClick={() => onDismiss(insight.id)}
          aria-label={`Dismiss ${insight.title} for ${insight.assetTag}`}
        >
          <X size={14} /> Dismiss
        </Button>
      </div>

      <div className="mt-2">
        <Button
          variant="ghost"
          size="sm"
          className="px-1 text-xs font-bold text-primary"
          aria-expanded={showWhy}
          onClick={() => setShowWhy(open => !open)}
        >
          {showWhy ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Why
        </Button>

        {showWhy && (
          <div className="mt-2 space-y-3 rounded-lg bg-muted/50 p-3 text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
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
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted-foreground">
                  {insight.alternatives.map(alternative => (
                    <li key={alternative.rank}>{alternative.text}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
