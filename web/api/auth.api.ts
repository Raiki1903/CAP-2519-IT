import { apiGet, apiPost, apiPostRaw, apiPut, type ApiResult } from "./client";

export interface AccountUpdateInput {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  profilePicture: string;
  userImg: string;
  labAffiliation?: string;
}

export function login(email: string, password: string): Promise<ApiResult> {
  return apiPost("/api/auth/login", { email, password });
}

export function getMe(email: string): Promise<ApiResult> {
  return apiGet(`/api/auth/me?email=${encodeURIComponent(email)}`);
}

export function updateAccount(input: AccountUpdateInput): Promise<ApiResult> {
  return apiPut("/api/auth/account", input);
}

export function requestRegistrationRaw(registration: unknown): Promise<Response> {
  return apiPostRaw("/api/auth/register-request", registration);
}

export function listPendingRegistrations(): Promise<ApiResult> {
  return apiGet("/api/auth/pending-registrations");
}

export function approveRegistration(registration: unknown): Promise<ApiResult> {
  return apiPost("/api/auth/approve-registration", registration);
}

export function rejectRegistrationRaw(requestId: string): Promise<Response> {
  return apiPostRaw("/api/auth/reject-registration", { requestId });
}
