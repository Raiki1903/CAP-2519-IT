/**
 * Analytics API: the read-only dashboard data for the three live analytics views.
 * Layer: api. Called by DirectorAnalyticsView, LabHeadAnalyticsView, StaffAnalyticsView, InsightsPanel, and LoansPerWeekChart. Calls client.ts.
 * Used by: Director, Lab Head, and Staff analytics, and the Insights panel on the home screens.
 */
import type { InsightsData, UtilizationData } from "@shared/types/analytics";
import { apiGet, apiGetRaw, type ApiResult } from "./client";

// Every function except getDirectorAnalytics returns the untouched Response,
// because its caller checks `res.ok` before parsing the answer.

/**
 * Loads the Director dashboard data.
 *
 * @param query the query string without "?", built by the caller
 * @returns `success` and `data`
 */
export function getDirectorAnalytics(query: string): Promise<ApiResult> {
  return apiGet(`/api/analytics/director?${query}`);
}

/**
 * Loads the Lab Head dashboard data.
 *
 * @param query the query string without "?", built by the caller (labPrefix, lab, and optionally startDate, endDate)
 * @returns the raw Response
 */
export function getLabHeadAnalyticsRaw(query: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/lab-head?${query}`);
}

// The next three have no live caller: their widgets are in legacy/analytics-widgets/.
// The team keeps the functions and the endpoints for now (2026-10-07); they were not among the 22 that step 12 unregistered.

/**
 * Loads the idle-time histogram for a lab's assets.
 *
 * @param lab the lab code
 * @returns the raw Response
 */
export function getIdleTimeRaw(lab: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/advanced/idle-time?lab=${encodeURIComponent(lab)}`);
}

/**
 * Loads how many of a lab's assets fall in each idle-duration range.
 *
 * @param lab the lab code
 * @returns the raw Response
 */
export function getIdleFrequencyRaw(lab: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/advanced/idle-frequency?lab=${encodeURIComponent(lab)}`);
}

/**
 * Loads suggested inter-lab loans.
 *
 * @returns the raw Response
 */
export function getLoanRecommenderRaw(): Promise<Response> {
  return apiGetRaw("/api/analytics/advanced/loan-recommender");
}

/**
 * Loads the Staff analytics dashboard data. The endpoint, and so this function,
 * still carry the `tsg` name: renaming the URL changes the API, so step 12 moved it as it was.
 *
 * @param query the query string without "?", built by the caller (optionally startDate, endDate)
 * @returns the raw Response
 */
export function getTsgAnalyticsRaw(query: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/tsg?${query}`);
}

/**
 * Loads asset counts per location.
 *
 * @returns the raw Response
 */
export function getLocationStatusRaw(): Promise<Response> {
  return apiGetRaw("/api/analytics/location-status");
}

/**
 * Loads inspection progress per lab group.
 *
 * @returns the raw Response
 */
export function getInspectionProgressRaw(): Promise<Response> {
  return apiGetRaw("/api/analytics/advanced/inspection-progress");
}

/**
 * Loads the advice notes for the signed-in role: all of them, both views, sorted by the server.
 *
 * @param centerId one lab, for the Staff and Director views; leave out for the viewer's whole scope (a Lab Head always gets their own lab)
 * @returns the answer without `success`
 * @throws if the server refuses or cannot be reached, so the panel shows its error line
 */
export async function getInsights(centerId?: number | null): Promise<InsightsData> {
  const query = centerId ? `?centerId=${centerId}` : "";
  const res = await apiGet(`/api/analytics/insights${query}`);
  if (!res.success) throw new Error(res.error || "Insights are unavailable.");
  return res as unknown as InsightsData;
}

/**
 * Loads loans out and released per week for the signed-in role.
 *
 * @param weeks how many weeks to show, this one included
 * @param centerId one lab, for the Director view; leave out for the viewer's whole scope (a Lab Head always gets their own lab)
 * @returns the answer without `success`
 * @throws if the server refuses or cannot be reached, so the chart shows its error line
 */
export async function getUtilization(weeks: number, centerId?: number | null): Promise<UtilizationData> {
  const params = new URLSearchParams({ weeks: String(weeks) });
  if (centerId) params.set("centerId", String(centerId));
  const res = await apiGet(`/api/analytics/utilization?${params.toString()}`);
  if (!res.success) throw new Error(res.error || "Loans per week are unavailable.");
  return res as unknown as UtilizationData;
}
