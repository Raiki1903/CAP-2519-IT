/**
 * Analytics API: the read-only dashboard data for the three live analytics views.
 * Layer: api. Called by DirectorAnalyticsView, LabHeadAnalyticsView, and TSGAnalyticsView. Calls client.ts.
 * Used by: Director, Lab Head, and Staff analytics.
 */
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
 * Loads the Staff (TSG) dashboard data.
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
