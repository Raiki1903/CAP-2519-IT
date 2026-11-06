/**
 * Loans per week chart: a bar for each of the last 12 weeks showing how many loans were out, the busiest weeks marked, and
 * the average loan length under it. Read-only.
 * Layer: feature component. Called by DirectorAnalyticsView and LabHeadAnalyticsView. Calls api/analytics.api.ts getUtilization(),
 * components/ui/card, and recharts.
 * Used by: AdRIC Director (all labs, or the lab picked in the filter) and Lab Head (own lab).
 * The chart has its own loading, empty, and error states, so the rest of the page shows either way.
 */
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange } from "lucide-react";
import type { UtilizationWeek } from "@shared/types/analytics";
import * as analyticsApi from "@web/api/analytics.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@web/components/ui/card";

/** How many weeks the chart shows, this one included. */
const WEEKS_SHOWN = 12;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 3" for a yyyy-mm-dd, read as written so no time zone can move the day. */
function shortDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${MONTHS[month - 1]} ${date}`;
}

/** The hover box of a bar: loans out and loans released in that week. */
function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: UtilizationWeek }[] }) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs shadow-sm">
      <p className="font-bold text-foreground">Week of {shortDay(week.weekStart)}</p>
      <p className="text-muted-foreground">Loans out: {week.loansOut}</p>
      <p className="text-muted-foreground">Loans released: {week.loansReleased}</p>
    </div>
  );
}

interface LoansPerWeekChartProps {
  /** One lab, for the Director's lab filter. A Lab Head sends none: the server answers for their own lab. */
  centerId?: number | null;
}

/**
 * Loads the weekly counts and draws them.
 *
 * @param centerId the lab to show, or none for the viewer's whole scope
 */
export function LoansPerWeekChart({ centerId = null }: LoansPerWeekChartProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-utilization", WEEKS_SHOWN, centerId],
    queryFn: () => analyticsApi.getUtilization(WEEKS_SHOWN, centerId),
    retry: false,
  });

  const series = data?.total;
  const hasLoans = !!series && series.weeks.some(week => week.loansOut > 0);
  const busiest = series ? series.weeks.filter(week => series.busiestWeeks.includes(week.weekStart)) : [];

  return (
    <Card className="border border-border bg-card shadow-sm rounded-xl">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-primary" /> Loans out per week
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Loans handed over and out on any day of each of the last {WEEKS_SHOWN} weeks. The busiest weeks are darker.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="h-56 rounded-xl bg-muted/60 animate-pulse" aria-busy="true" aria-label="Loading loans per week" />}
        {isError && <p className="text-sm text-muted-foreground">Loans per week are currently unavailable.</p>}
        {series && !hasLoans && (
          <p className="py-6 text-sm text-muted-foreground">No loans have been handed over in the last {WEEKS_SHOWN} weeks.</p>
        )}
        {series && hasLoans && (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.weeks} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="weekStart" tickFormatter={shortDay} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<WeekTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="loansOut" radius={[4, 4, 0, 0]}>
                    {series.weeks.map(week => (
                      <Cell key={week.weekStart} fill={series.busiestWeeks.includes(week.weekStart) ? "var(--primary)" : "var(--secondary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-bold text-foreground">Busiest weeks: </span>
                {busiest
                  .sort((a, b) => series.busiestWeeks.indexOf(a.weekStart) - series.busiestWeeks.indexOf(b.weekStart))
                  .map(week => `week of ${shortDay(week.weekStart)} (${week.loansOut} out)`)
                  .join(", ")}
              </p>
              <p>
                <span className="font-bold text-foreground">Average loan length: </span>
                {series.averageLoanDays === null ? "no closed loans in these weeks yet" : `${series.averageLoanDays} days`}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
