/**
 * Auth API: login, logout, the current user's profile, and sign-up requests.
 * Layer: api. Called by Login, Register, AccountDetailsPage, and state/session.tsx. Calls client.ts; types from @shared/types/auth.
 * Used by: login for every role, self-registration, account page.
 */
import type { AccountUpdateInput, RegistrationRequestInput } from "@shared/types/auth";
import { apiGet, apiGetRaw, apiPost, apiPostRaw, apiPut, type ApiResult } from "./client";

/**
 * Checks an email and password.
 *
 * @param email the institutional email, already trimmed
 * @param password the password as typed
 * @returns `success`, `role` (an app Role), and `user`; or `error`
 */
export function login(email: string, password: string): Promise<ApiResult> {
  return apiPost("/api/auth/login", { email, password });
}

/**
 * Ends the session on the server: the cookie is refused from now on, and the browser deletes it.
 *
 * @returns `success` (always true)
 */
export function logout(): Promise<ApiResult> {
  return apiPost("/api/auth/logout", {});
}

/**
 * Loads the logged-in user's own profile and role. The server reads whose from the session cookie. (C-06)
 *
 * @returns `success` and `user`
 */
export function getMe(): Promise<ApiResult> {
  return apiGet("/api/auth/me");
}

/**
 * Like getMe, but returns the untouched Response, so the session restore can tell a refused session (401)
 * from a server that failed (500) or answered nothing.
 *
 * @returns the raw Response; `success` and `user` in its JSON body
 * @throws if the server cannot be reached
 */
export function getMeRaw(): Promise<Response> {
  return apiGetRaw("/api/auth/me");
}

/**
 * Saves the name, picture, and lab of the logged-in user's own account. (C-06)
 *
 * @param input the new profile values
 * @returns `success` and the saved `user`
 */
export function updateAccount(input: AccountUpdateInput): Promise<ApiResult> {
  return apiPut("/api/auth/account", input);
}

/**
 * Files a sign-up, which the server stores as a Pending account for the IT Admin. Returns the untouched Response so
 * Register can read it with readResult, which keeps the server's sentence and hides any raw page.
 *
 * @param registration the registration form values
 * @returns the raw Response
 */
export function requestRegistrationRaw(registration: RegistrationRequestInput): Promise<Response> {
  return apiPostRaw("/api/auth/register-request", registration);
}
