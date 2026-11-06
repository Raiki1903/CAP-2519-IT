/**
 * IT Admin Activity Log: who did what and when, newest first, 50 rows a page, with filters.
 * Layer: page. Called by app/routes.tsx at /it-admin/activity-log.
 * Calls: api/activityLog.api.ts listActivity().
 * Used by: the IT Admin.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVITY_EVENT_LABELS, ACTIVITY_EVENT_TYPES, type ActivityEventType } from "@shared/constants/activityEvents";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import type { ActivityEntry } from "@shared/types/activityLog";
import * as activityLogApi from "@web/api/activityLog.api";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/** The event select's value for "every event". Event types are upper-case keys, so this never matches one. */
const ALL_EVENTS = "ALL";

/** How long the asset tag waits after the last key before it asks the server. */
const SEARCH_DELAY_MS = 300;

/** The longest asset tag the server takes. */
const ASSET_TAG_MAX_LENGTH = 50;

const RANGE_MESSAGE = "The start day must be on or before the end day.";

/** A time as the page shows it, in the browser's time zone. */
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Lists the activity log, one page at a time, with filters for the event, the days (both included) and the asset tag.
 * Changing a filter goes back to page 1. Previous and Next move between pages. The server has the last word: its
 * sentence shows when it refuses. Takes no props.
 */
export function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventType, setEventType] = useState<ActivityEventType | typeof ALL_EVENTS>(ALL_EVENTS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assetTagInput, setAssetTagInput] = useState("");
  const [assetTag, setAssetTag] = useState("");
  // Counts the loads, so a slow answer to an older filter never replaces a newer one.
  const loadCount = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAssetTag(assetTagInput.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [assetTagInput]);

  const rangeError = from !== "" && to !== "" && from > to;
  const filtered = eventType !== ALL_EVENTS || from !== "" || to !== "" || assetTagInput !== "";

  const load = useCallback(async () => {
    if (rangeError) return;
    const thisLoad = ++loadCount.current;
    setLoading(true);
    try {
      const data = await activityLogApi.listActivity({
        eventType: eventType === ALL_EVENTS ? undefined : eventType,
        assetTag: assetTag || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      });
      if (thisLoad !== loadCount.current) return;
      if (data.success && Array.isArray(data.entries)) {
        setEntries(data.entries);
        setPageCount(data.pageCount);
        setError(null);
        // The log shrank under a high page (a filter was changed elsewhere): go to the last page there is.
        if (page > data.pageCount) setPage(data.pageCount);
      } else {
        setError(data.error || "Could not load the activity log. Try again.");
      }
    } catch {
      if (thisLoad !== loadCount.current) return;
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      if (thisLoad === loadCount.current) setLoading(false);
    }
  }, [eventType, assetTag, from, to, page, rangeError]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFilters = () => {
    setEventType(ALL_EVENTS);
    setFrom("");
    setTo("");
    setAssetTagInput("");
    setAssetTag("");
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.activityLog}</h1>
        <p className="text-muted-foreground text-sm">Who did what and when, newest first. Nothing here can be edited.</p>
      </div>

      <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="space-y-1.5 lg:w-56">
          <Label htmlFor="log-event" className="text-xs font-bold">Event</Label>
          <Select value={eventType} onValueChange={value => { setEventType(value as ActivityEventType | typeof ALL_EVENTS); setPage(1); }}>
            <SelectTrigger id="log-event" className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EVENTS} className="text-xs">All events</SelectItem>
              {ACTIVITY_EVENT_TYPES.map(type => (
                <SelectItem key={type} value={type} className="text-xs">{ACTIVITY_EVENT_LABELS[type]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="log-from" className="text-xs font-bold">From</Label>
          <Input id="log-from" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} aria-invalid={rangeError} className="h-9 text-xs" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="log-to" className="text-xs font-bold">To</Label>
          <Input id="log-to" type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} aria-invalid={rangeError} className="h-9 text-xs" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="log-asset" className="text-xs font-bold">Asset tag</Label>
          <Input
            id="log-asset"
            value={assetTagInput}
            maxLength={ASSET_TAG_MAX_LENGTH}
            onChange={e => setAssetTagInput(e.target.value)}
            placeholder="For example TEST-0001"
            className="h-9 text-xs"
          />
        </div>

        {filtered && <Button variant="outline" size="sm" onClick={clearFilters} className="h-9">Clear filters</Button>}
      </div>

      {rangeError && <p role="alert" className="mb-3 text-sm text-destructive">{RANGE_MESSAGE}</p>}
      {error && !rangeError && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Time", "Event", "Actor", "Target", "Asset Tag", "Details"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                  {loading ? "Loading the activity log..." : "No entries match the filters."}
                </TableCell>
              </TableRow>
            ) : (
              entries.map(entry => (
                <TableRow key={entry.logId}>
                  <TableCell className="text-xs whitespace-nowrap">{when(entry.createdAt)}</TableCell>
                  <TableCell className="text-xs font-semibold">{entry.eventLabel}</TableCell>
                  <TableCell className="text-xs">{entry.actor?.name ?? <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="text-xs">{entry.targetUser?.name ?? <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="text-xs font-mono">{entry.asset?.tag ?? <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="text-xs">{entry.details ?? <span className="text-muted-foreground">None</span>}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-end gap-3">
        <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
        <Button variant="outline" size="sm" disabled={loading || page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
