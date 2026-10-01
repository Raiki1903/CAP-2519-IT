import { apiGet, apiGetRaw, type ApiResult } from "./client";

export function getDirectorAnalytics(query: string): Promise<ApiResult> {
  return apiGet(`/api/analytics/director?${query}`);
}

export function getLabHeadAnalyticsRaw(query: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/lab-head?${query}`);
}

export function getIdleTimeRaw(lab: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/advanced/idle-time?lab=${encodeURIComponent(lab)}`);
}

export function getIdleFrequencyRaw(lab: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/advanced/idle-frequency?lab=${encodeURIComponent(lab)}`);
}

export function getLoanRecommenderRaw(): Promise<Response> {
  return apiGetRaw("/api/analytics/advanced/loan-recommender");
}

export function getTsgAnalyticsRaw(query: string): Promise<Response> {
  return apiGetRaw(`/api/analytics/tsg?${query}`);
}

export function getLocationStatusRaw(): Promise<Response> {
  return apiGetRaw("/api/analytics/location-status");
}

export function getInspectionProgressRaw(): Promise<Response> {
  return apiGetRaw("/api/analytics/advanced/inspection-progress");
}
