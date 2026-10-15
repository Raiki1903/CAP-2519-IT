/**
 * Auth API: login, logout, the current user's profile, and sign-up requests.
 * Layer: api. Called by Login, Register, AccountDetailsPage, state/session.tsx, and state/serverData.tsx. Calls client.ts; types from @shared/types/auth.
 * Used by: login for every role, self-registration, approval of sign-ups, account page.
 */
import type { AccountUpdateInput, ApproveRegistrationInput, RegistrationRequestInput } from "@shared/types/auth";
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
 * Files a sign-up request. Returns the untouched Response because Register
 * checks the content type and status itself.
 *
 * @param registration the registration form values
 * @returns the raw Response
 */
// TODO(H-17): the server keeps pending sign-ups, password included, in a JSON file. Phase 3 makes it a table.
export function requestRegistrationRaw(registration: RegistrationRequestInput): Promise<Response> {
  return apiPostRaw("/api/auth/register-request", registration);
}

/**
 * Lists sign-up requests waiting for approval.
 *
 * @returns `success` and `pendingRegistrations`
 */
// TODO(C-04): the answer includes each applicant's password, sent to the Lab Head (issue #72). Phase 3.
export function listPendingRegistrations(): Promise<ApiResult> {
  return apiGet("/api/auth/pending-registrations");
}

/**
 * Approves a sign-up request, which creates the user.
 *
 * @param registration `requestId`, plus the registration's own fields when the caller has them
 * @returns `success`, or `error` when the user could not be created
 */
// TODO(C-05): the server creates an account from the body when the request id is unknown. Removing that fallback is issue #71, after issue #68.
export function approveRegistration(registration: ApproveRegistrationInput): Promise<ApiResult> {
  return apiPost("/api/auth/approve-registration", registration);
}

/**
 * Rejects a sign-up request. Returns the untouched Response because the
 * caller never reads the answer.
 *
 * @param requestId the registration's id
 * @returns the raw Response
 */
export function rejectRegistrationRaw(requestId: string): Promise<Response> {
  return apiPostRaw("/api/auth/reject-registration", { requestId });
}
