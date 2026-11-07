/**
 * Activity log API: the IT Admin's read of the log. The only place this URL appears in the frontend.
 * Layer: api. Called by pages/it-admin/ActivityLogPage.tsx. Calls client.ts; types from @shared/types/activityLog.
 * Used by: the IT Admin's Activity Log page.
 */
import type { ActivityLogFilters } from "@shared/types/activityLog";
import { apiGetRaw, readResult, type ApiResult } from "./client";

/**
 * Reads one page of the activity log, newest first. Only the filters that are set are sent.
 *
 * @param filters the event type, people, asset tag and days (each optional), and the page from 1
 * @returns `success`, `entries`, `page` and `pageCount`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listActivity(filters: ActivityLogFilters): Promise<ApiResult> {
  const query = new URLSearchParams();
  if (filters.eventType) query.set("eventType", filters.eventType);
  if (filters.actorId !== undefined) query.set("actorId", String(filters.actorId));
  if (filters.targetUserId !== undefined) query.set("targetUserId", String(filters.targetUserId));
  if (filters.assetTag) query.set("assetTag", filters.assetTag);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  query.set("page", String(filters.page));
  return readResult(await apiGetRaw(`/api/activity-log?${query}`), "Could not load the activity log. Try again.");
}
